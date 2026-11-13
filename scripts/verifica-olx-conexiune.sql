-- ============================================================
-- TESTUL ESENȚIAL AL MIGRĂRII 56 (OLX). Pe PRODUCȚIE, în tranzacție ANULATĂ.
-- Se termină MEREU cu eroare: „REZULTAT OK …” sau „VERIFICARE PICATĂ …”.
-- Verifică: (1) nimeni din browser (anon / authenticated) nu citește sau scrie
-- olx_cont și nu cheamă funcțiile ei; (2) state-ul OAuth merge O SINGURĂ dată și
-- nu merge după expirare. Tokenii reali, dacă există, revin neatinși la anulare.
-- ============================================================
begin;
do $$
declare
  t text; f text; v uuid; eu uuid := gen_random_uuid();
  s text := md5(random()::text) || md5(random()::text);
begin
  foreach t in array array['anon', 'authenticated'] loop
    if has_table_privilege(t, 'public.olx_cont', 'select') or has_table_privilege(t, 'public.olx_cont', 'update')
       or has_table_privilege(t, 'public.olx_blocare', 'update') then
      raise exception 'VERIFICARE PICATĂ: rolul % are drepturi pe olx_cont / olx_blocare', t;
    end if;
    foreach f in array array['public.olx_ia_blocarea(uuid, integer)', 'public.olx_elibereaza(uuid)', 'public.olx_consuma_starea(text)'] loop
      if has_function_privilege(t, f, 'execute') then raise exception 'VERIFICARE PICATĂ: rolul % poate executa %', t, f; end if;
    end loop;
  end loop;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename in ('olx_cont', 'olx_blocare')) then
    raise exception 'VERIFICARE PICATĂ: olx_cont / olx_blocare au politici RLS (trebuie zero)';
  end if;

  update public.olx_cont set stare_oauth = s, stare_oauth_expira = now() + interval '10 minutes', stare_oauth_de = eu where unic;
  if public.olx_consuma_starea('x' || s) is not null then raise exception 'VERIFICARE PICATĂ: un state greșit a fost acceptat'; end if;
  v := public.olx_consuma_starea(s);
  if v is distinct from eu then raise exception 'VERIFICARE PICATĂ: state-ul corect nu a fost acceptat'; end if;
  if public.olx_consuma_starea(s) is not null then raise exception 'VERIFICARE PICATĂ: state-ul a mers de DOUĂ ori'; end if;
  update public.olx_cont set stare_oauth = s, stare_oauth_expira = now() - interval '1 second', stare_oauth_de = eu where unic;
  if public.olx_consuma_starea(s) is not null then raise exception 'VERIFICARE PICATĂ: un state expirat a fost acceptat'; end if;

  if not public.olx_ia_blocarea(eu, 30) then raise exception 'VERIFICARE PICATĂ: lacătul liber nu s-a putut lua'; end if;
  if public.olx_ia_blocarea(gen_random_uuid(), 30) then raise exception 'VERIFICARE PICATĂ: lacătul a fost luat de două ori'; end if;

  raise exception 'REZULTAT OK: browserul nu vede tokenii, state-ul merge o singură dată, lacătul e exclusiv (tot a fost anulat)';
end $$;
rollback;
