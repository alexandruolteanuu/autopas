-- ============================================================
-- VERIFICĂRILE PASULUI 7 SAGA (migrarea 52, supabase/saga-api.sql)
--
-- Se rulează după migrarea 52, din Supabase → SQL Editor: lipești tot → Run.
-- Merge pe PRODUCȚIE. NU LASĂ NIMIC ÎN BAZĂ: totul între BEGIN și ROLLBACK, iar
-- blocul se termină ÎNTOTDEAUNA cu o eroare, care anulează tot (cheia de probă,
-- lacătul, rândul de jurnal de probă). Cheia REALĂ, dacă e deja salvată, revine
-- neatinsă la anulare — și nu apare nicăieri în rezultat.
--
-- REZULTATUL apare ÎNTOTDEAUNA în căsuța roșie de eroare:
--   · reușită: „REZULTAT OK: toate cele N verificări au trecut …”
--   · eșec:    „VERIFICARE PICATĂ: …”
-- ============================================================

begin;

do $$
declare
  n       int := 0;
  v_user  uuid;
  a       uuid := gen_random_uuid();
  b       uuid := gen_random_uuid();
  v_ok    boolean;
  v_err   boolean;
  v_cnt   int;
  v_rot   int;
  t       text;
  f       text;
begin
  -- ----------------------------------------------------------
  -- A. STRUCTURA ȘI DREPTURILE
  -- ----------------------------------------------------------
  foreach t in array array['saga_cheie', 'saga_blocare', 'saga_trimiteri'] loop
    if to_regclass('public.' || t) is null then raise exception 'VERIFICARE PICATĂ: lipsește tabela %', t; end if;
    if not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then
      raise exception 'VERIFICARE PICATĂ: RLS nu e pornit pe %', t;
    end if;
    n := n + 1;
  end loop;

  if exists (select 1 from pg_policies where schemaname = 'public' and tablename in ('saga_cheie', 'saga_blocare')) then
    raise exception 'VERIFICARE PICATĂ: saga_cheie sau saga_blocare au politici RLS (trebuie zero)';
  end if;
  n := n + 1;

  foreach t in array array['anon', 'authenticated'] loop
    if has_table_privilege(t, 'public.saga_cheie', 'select') or has_table_privilege(t, 'public.saga_cheie', 'update')
       or has_table_privilege(t, 'public.saga_cheie', 'insert') or has_table_privilege(t, 'public.saga_blocare', 'update') then
      raise exception 'VERIFICARE PICATĂ: rolul % are drepturi pe saga_cheie / saga_blocare', t;
    end if;
    if has_table_privilege(t, 'public.saga_trimiteri', 'insert') or has_table_privilege(t, 'public.saga_trimiteri', 'update')
       or has_table_privilege(t, 'public.saga_trimiteri', 'delete') then
      raise exception 'VERIFICARE PICATĂ: rolul % poate scrie în saga_trimiteri', t;
    end if;
    foreach f in array array['public.saga_ia_blocarea(uuid, integer)', 'public.saga_elibereaza(uuid)',
                             'public.saga_salveaza_cheia(text, uuid)', 'public.saga_roteste_cheia(text, text)'] loop
      if has_function_privilege(t, f, 'execute') then
        raise exception 'VERIFICARE PICATĂ: rolul % poate executa %', t, f;
      end if;
    end loop;
    n := n + 3;
  end loop;
  if has_table_privilege('anon', 'public.saga_trimiteri', 'select') then
    raise exception 'VERIFICARE PICATĂ: anon poate citi saga_trimiteri';
  end if;
  n := n + 1;

  if (select count(*) from public.saga_blocare) <> 1 then
    raise exception 'VERIFICARE PICATĂ: saga_blocare trebuie să aibă exact un rând';
  end if;
  n := n + 1;

  -- ----------------------------------------------------------
  -- B. LACĂTUL (pornit liber în tranzacție; starea reală revine la anulare)
  -- ----------------------------------------------------------
  update public.saga_blocare set detinator = null, pana = '-infinity';
  if not public.saga_ia_blocarea(a, 90) then raise exception 'VERIFICARE PICATĂ: lacătul liber nu s-a putut lua'; end if;
  if public.saga_ia_blocarea(b, 90) then raise exception 'VERIFICARE PICATĂ: lacătul luat a fost dat și altcuiva'; end if;
  if public.saga_ia_blocarea(a, 90) then raise exception 'VERIFICARE PICATĂ: lacătul luat a fost dat de două ori aceluiași'; end if;
  if public.saga_elibereaza(b) then raise exception 'VERIFICARE PICATĂ: altcineva a eliberat lacătul'; end if;
  if not public.saga_elibereaza(a) then raise exception 'VERIFICARE PICATĂ: deținătorul nu și-a putut elibera lacătul'; end if;
  if not public.saga_ia_blocarea(b, 90) then raise exception 'VERIFICARE PICATĂ: lacătul eliberat nu s-a putut lua din nou'; end if;
  n := n + 6;
  -- Expirarea: o funcție omorâtă la jumătate nu blochează pentru totdeauna.
  update public.saga_blocare set pana = now() - interval '1 second';
  if not public.saga_ia_blocarea(a, 90) then raise exception 'VERIFICARE PICATĂ: lacătul expirat nu s-a putut lua'; end if;
  if (select pana from public.saga_blocare) < now() + interval '80 seconds' then
    raise exception 'VERIFICARE PICATĂ: termenul lacătului nu e de ~90 s';
  end if;
  n := n + 2;

  -- ----------------------------------------------------------
  -- C. SALVAREA ȘI ROTIREA CHEII (cu o cheie de PROBĂ)
  -- ----------------------------------------------------------
  perform public.saga_salveaza_cheia('PROBA-cheie-0123456789', null);
  if (select cheie from public.saga_cheie) <> 'PROBA-cheie-0123456789' or (select rotiri from public.saga_cheie) <> 0
     or (select blocata_la from public.saga_cheie) is not null then
    raise exception 'VERIFICARE PICATĂ: salvarea cheii';
  end if;
  n := n + 1;
  foreach t in array array['', 'scurta', 'cu spatiu in ea 0123456789'] loop
    begin perform public.saga_salveaza_cheia(t, null); v_err := false;
    exception when others then v_err := true; end;
    if not v_err then raise exception 'VERIFICARE PICATĂ: o cheie greșită („%”) a fost acceptată', t; end if;
    n := n + 1;
  end loop;

  update public.saga_cheie set blocata_la = now(), blocata_motiv = 'proba';
  if public.saga_roteste_cheia('alta-cheie-veche', 'PROBA-noua-0123456789') then
    raise exception 'VERIFICARE PICATĂ: rotirea a înlocuit o cheie care nu era cea folosită';
  end if;
  if (select cheie from public.saga_cheie) <> 'PROBA-cheie-0123456789' then
    raise exception 'VERIFICARE PICATĂ: rotirea refuzată a schimbat totuși cheia';
  end if;
  if not public.saga_roteste_cheia('PROBA-cheie-0123456789', 'PROBA-noua-0123456789') then
    raise exception 'VERIFICARE PICATĂ: rotirea cheii folosite a fost refuzată';
  end if;
  select rotiri into v_rot from public.saga_cheie;
  if (select cheie from public.saga_cheie) <> 'PROBA-noua-0123456789' or v_rot <> 1
     or (select blocata_la from public.saga_cheie) is not null or (select rotita_la from public.saga_cheie) is null then
    raise exception 'VERIFICARE PICATĂ: după rotire (cheia, rotiri = %, marcajul de blocare)', v_rot;
  end if;
  if public.saga_roteste_cheia('PROBA-noua-0123456789', '') then
    raise exception 'VERIFICARE PICATĂ: rotirea a acceptat o cheie goală';
  end if;
  n := n + 4;

  -- ----------------------------------------------------------
  -- D. CA DIN BROWSER (rolul `authenticated`)
  -- ----------------------------------------------------------
  insert into public.saga_trimiteri (tip, http_status, raspuns) values ('test', 200, 'proba verifica-saga-api.sql');
  begin insert into public.saga_trimiteri (tip) values ('altceva'); v_err := false;
  exception when others then v_err := true; end;
  if not v_err then raise exception 'VERIFICARE PICATĂ: tipul de apel necunoscut a fost acceptat în jurnal'; end if;
  n := n + 1;

  select id into v_user from public.profiles
   where role in ('admin', 'contabil') order by (role = 'admin') desc, created_at limit 1;
  if v_user is null then raise exception 'VERIFICARE PICATĂ: nu există niciun profil admin sau contabil.'; end if;

  -- Admin / contabil: citește jurnalul, NU citește cheia, NU scrie în jurnal.
  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_user::text, true);
  set local role authenticated;
  select count(*) into v_cnt from public.saga_trimiteri where raspuns = 'proba verifica-saga-api.sql';
  begin perform cheie from public.saga_cheie; v_err := false;
  exception when others then v_err := true; end;
  begin insert into public.saga_trimiteri (tip) values ('test'); v_ok := true;
  exception when others then v_ok := false; end;
  reset role;
  if v_cnt <> 1 then raise exception 'VERIFICARE PICATĂ: adminul/contabilul nu vede jurnalul SAGA'; end if;
  if not v_err then raise exception 'VERIFICARE PICATĂ: adminul poate citi cheia SAGA din browser'; end if;
  if v_ok then raise exception 'VERIFICARE PICATĂ: adminul poate scrie în jurnalul SAGA din browser'; end if;
  n := n + 3;

  -- Un utilizator logat fără rol de facturare: nu vede jurnalul.
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', '', true);
  set local role authenticated;
  select count(*) into v_cnt from public.saga_trimiteri;
  reset role;
  if v_cnt <> 0 then raise exception 'VERIFICARE PICATĂ: un utilizator fără rol de facturare vede % rânduri din jurnalul SAGA', v_cnt; end if;
  n := n + 1;

  raise exception 'REZULTAT OK: toate cele % verificări au trecut. (Apare ca eroare intenționat: așa baza anulează tot — cheia de probă, lacătul, jurnalul de probă.)', n;
end $$;

rollback;
