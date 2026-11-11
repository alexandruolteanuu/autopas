-- ============================================================
-- VERIFICĂRILE PASULUI 10b SAGA (migrarea 54, supabase/saga-refacturare.sql)
--
-- Se rulează după migrarea 54, din Supabase → SQL Editor: lipești tot → Run.
-- Merge pe PRODUCȚIE. NU LASĂ NIMIC ÎN BAZĂ: totul între BEGIN și ROLLBACK, iar
-- blocul se termină ÎNTOTDEAUNA cu o eroare, care anulează tot (facturile, stornările
-- și refacturările de probă pe o serie „TEST …” unică, setările temporare).
-- Singura urmă: id-uri interne consumate (secvențele nu se anulează).
--
-- REZULTATUL apare ÎNTOTDEAUNA în căsuța roșie de eroare:
--   · reușită: „REZULTAT OK: toate cele N verificări au trecut …”
--   · eșec:    „VERIFICARE PICATĂ: …”
-- ============================================================

begin;

do $$
declare
  n        int := 0;
  v_user   uuid;
  v_orig   jsonb;
  o1       public.orders%rowtype;
  o2       public.orders%rowtype;
  v_serie  text := 'TEST ' || upper(substr(md5(clock_timestamp()::text || random()::text), 1, 8));
  r        json;
  f1       bigint;  f1b bigint;  f1c bigint;  f1d bigint;  f2 bigint;
  s1       bigint;  s2  bigint;
  v_err    boolean;
  v_msg    text;
  v_nr1    int;
begin
  -- 0. Amprentele: funcțiile din bază sunt versiunile din 54.
  if (select md5(replace(prosrc, E'\r', '')) from pg_proc where oid = to_regprocedure('public.emite_factura(bigint)'))
       is distinct from '05f9fdfb49e73145c8004f290ed6ec42'
     or (select md5(replace(prosrc, E'\r', '')) from pg_proc where oid = to_regprocedure('public.retrage_factura(bigint)'))
       is distinct from '8ea9759db0a900c3043eff58663ea1fb' then
    raise exception 'VERIFICARE PICATĂ: emite_factura / retrage_factura din bază nu sunt versiunile din migrarea 54';
  end if;
  n := n + 1;

  select id into v_user from public.profiles
   where role in ('admin', 'contabil') order by (role = 'admin') desc, created_at limit 1;
  if v_user is null then raise exception 'VERIFICARE PICATĂ: nu există niciun profil admin sau contabil.'; end if;

  -- Două comenzi existente, facturabile, nemarcate ca facturate.
  select * into o2 from public.orders o
   where o.status <> 'anulata' and o.factura_serie is null and coalesce(o.factura_status, 'de_emis') = 'de_emis'
     and exists (select 1 from public.order_items i where i.order_id = o.id)
     and not exists (select 1 from public.facturi fx where fx.order_id = o.id)
     and public.cod_judet(o.judet) is not null
   order by o.id desc limit 1;
  select * into o1 from public.orders o
   where o.id < coalesce(o2.id, 0) and o.status <> 'anulata' and o.factura_serie is null
     and coalesce(o.factura_status, 'de_emis') = 'de_emis'
     and exists (select 1 from public.order_items i where i.order_id = o.id)
     and not exists (select 1 from public.facturi fx where fx.order_id = o.id)
     and public.cod_judet(o.judet) is not null
   order by o.id desc limit 1;
  if o1.id is null or o2.id is null then raise exception 'VERIFICARE PICATĂ: nu găsesc două comenzi potrivite.'; end if;

  select valoare into v_orig from public.settings where cheie = 'integrari';
  v_orig := coalesce(v_orig, '{}'::jsonb);
  insert into public.settings (cheie, valoare) values ('integrari', '{}'::jsonb) on conflict (cheie) do nothing;
  update public.settings set valoare = v_orig || jsonb_build_object('saga',
    coalesce(v_orig -> 'saga', '{}'::jsonb)
    || jsonb_build_object('cota_tva', '21', 'regim_tva', 'normal',
         'data_start_facturare', to_char(least((o1.created_at at time zone 'Europe/Bucharest')::date,
                                               (o2.created_at at time zone 'Europe/Bucharest')::date), 'YYYY-MM-DD'),
         'articol_implicit', 'IMPL', 'articol_implicit_denumire', 'ACCESORII AUTO'))
   where cheie = 'integrari';
  update public.facturi_serii set activa = false where activa;

  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_user::text, true);
  perform public.seteaza_serie_factura(v_serie, 1);

  -- ----------------------------------------------------------
  -- A. REFACTURAREA DOAR DUPĂ UN STORNO TRIMIS
  -- ----------------------------------------------------------
  r := public.emite_factura(o1.id);  f1 := (r ->> 'id')::bigint;  v_nr1 := (r ->> 'numar')::int;
  update public.facturi set saga_status = 'trimisa' where id = f1;
  r := public.storneaza_factura(f1, 'date greșite');  s1 := (r ->> 'id')::bigint;

  -- Stornoul încă netrimis → refuz (s-ar mai putea retrage, iar f1 ar redeveni valabilă).
  begin perform public.emite_factura(o1.id); v_err := false; exception when others then v_err := true; v_msg := sqlerrm; end;
  if not v_err or v_msg not like '%nu e încă trimis în SAGA%' then
    raise exception 'VERIFICARE PICATĂ: refacturarea cu storno netrimis trebuia refuzată (%)', coalesce(v_msg, 'fără eroare');
  end if;
  n := n + 1;

  update public.facturi set saga_status = 'trimisa' where id = s1;
  r := public.emite_factura(o1.id);  f1b := (r ->> 'id')::bigint;
  if (r ->> 'numar')::int <> 3 or (select order_id from public.facturi where id = f1b) <> o1.id then
    raise exception 'VERIFICARE PICATĂ: factura nouă după storno (număr %, aștept 3)', r ->> 'numar';
  end if;
  if (select factura_status from public.orders where id = o1.id) <> 'emisa'
     or (select factura_serie from public.orders where id = o1.id) <> v_serie || ' 3' then
    raise exception 'VERIFICARE PICATĂ: oglinda după refacturare (aștept „emisa” / % 3)', v_serie;
  end if;
  if not exists (select 1 from public.order_events where order_id = o1.id and mesaj like 'Factură NOUĂ după stornare%' || v_serie || ' 3%') then
    raise exception 'VERIFICARE PICATĂ: jurnalul comenzii nu spune „Factură NOUĂ după stornare”';
  end if;
  n := n + 3;

  -- Cât există o factură nestornată → refuz (ca în 51).
  begin perform public.emite_factura(o1.id); v_err := false; exception when others then v_err := true; v_msg := sqlerrm; end;
  if not v_err or v_msg not like '%are deja o factură (nestornată)%' then
    raise exception 'VERIFICARE PICATĂ: a doua factură nestornată trebuia refuzată (%)', coalesce(v_msg, 'fără eroare');
  end if;
  n := n + 1;

  -- ----------------------------------------------------------
  -- B. RETRAGEREA FACTURII NOI → comanda revine la „stornata” cu seria veche
  -- ----------------------------------------------------------
  perform public.retrage_factura(f1b);
  if (select factura_status from public.orders where id = o1.id) <> 'stornata'
     or (select factura_serie from public.orders where id = o1.id) <> v_serie || ' ' || v_nr1
     or (select urmator from public.facturi_serii where serie = v_serie) <> 3 then
    raise exception 'VERIFICARE PICATĂ: după retragerea facturii noi (aștept „stornata” / % %, contor 3)', v_serie, v_nr1;
  end if;
  n := n + 1;

  -- ----------------------------------------------------------
  -- C. AL DOILEA CICLU: factură → storno → factură
  -- ----------------------------------------------------------
  r := public.emite_factura(o1.id);  f1c := (r ->> 'id')::bigint;
  if (r ->> 'numar')::int <> 3 then raise exception 'VERIFICARE PICATĂ: numărul refolosit după retragere nu e 3'; end if;
  update public.facturi set saga_status = 'trimisa' where id = f1c;
  r := public.storneaza_factura(f1c, null);  s2 := (r ->> 'id')::bigint;
  -- Stornoul CONFIRMAT (pe calea reală: trimis, apoi confirmat) — acceptat la fel ca unul trimis.
  update public.facturi set saga_status = 'trimisa' where id = s2;
  update public.facturi set saga_status = 'confirmata', confirmata_la = now() where id = s2;
  r := public.emite_factura(o1.id);  f1d := (r ->> 'id')::bigint;
  if (select count(*) from public.facturi where order_id = o1.id and tip = 'factura') <> 3
     or (select count(*) from public.facturi where order_id = o1.id and tip = 'storno') <> 2
     or (select factura_status from public.orders where id = o1.id) <> 'emisa' then
    raise exception 'VERIFICARE PICATĂ: al doilea ciclu (aștept 3 facturi, 2 stornări, comanda „emisa”)';
  end if;
  n := n + 2;

  -- ----------------------------------------------------------
  -- D. CE RĂMÂNE CA ÎNAINTE (51 / 49)
  -- ----------------------------------------------------------
  -- „stornata” MANUALĂ, fără facturi din aplicație → refuz.
  update public.orders set factura_status = 'stornata' where id = o2.id;
  begin perform public.emite_factura(o2.id); v_err := false; exception when others then v_err := true; v_msg := sqlerrm; end;
  if not v_err or v_msg not like '%e deja marcată ca facturată%' then
    raise exception 'VERIFICARE PICATĂ: „stornata” manuală fără facturi din aplicație trebuia refuzată (%)', coalesce(v_msg, 'fără eroare');
  end if;
  -- Seria notată de mână (din SAGA) → refuz.
  update public.orders set factura_status = 'emisa', factura_serie = 'PAP FE 99999' where id = o2.id;
  begin perform public.emite_factura(o2.id); v_err := false; exception when others then v_err := true; end;
  if not v_err then raise exception 'VERIFICARE PICATĂ: comanda cu seria notată de mână a primit factură'; end if;
  -- Comanda obișnuită: emiterea și retragerea exact ca înainte (înapoi la „de_emis”, fără serie).
  update public.orders set factura_status = 'de_emis', factura_serie = null where id = o2.id;
  r := public.emite_factura(o2.id);  f2 := (r ->> 'id')::bigint;
  perform public.retrage_factura(f2);
  if (select factura_status from public.orders where id = o2.id) <> 'de_emis'
     or (select factura_serie from public.orders where id = o2.id) is not null then
    raise exception 'VERIFICARE PICATĂ: retragerea pe o comandă fără stornări nu mai e ca înainte';
  end if;
  n := n + 3;

  -- ----------------------------------------------------------
  -- E. DREPTURILE
  -- ----------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', '', true);
  begin perform public.emite_factura(o2.id); v_err := false; exception when others then v_err := true; end;
  if not v_err then raise exception 'VERIFICARE PICATĂ: un utilizator fără rol a emis o factură'; end if;
  if has_function_privilege('anon', 'public.emite_factura(bigint)', 'execute')
     or has_function_privilege('anon', 'public.retrage_factura(bigint)', 'execute') then
    raise exception 'VERIFICARE PICATĂ: anon poate chema emite_factura / retrage_factura';
  end if;
  n := n + 2;

  raise exception 'REZULTAT OK: toate cele % verificări au trecut (probă pe comenzile % și %, seria de probă „%”). (Apare ca eroare intenționat: așa baza anulează tot.)',
    n, o1.numar, o2.numar, v_serie;
end $$;

rollback;
