-- ============================================================
-- MIGRAREA 59 — OLX: CEASUL COZII (16 noiembrie 2026)
--
-- CE REZOLVĂ (măsurat în prima zi, 16 noiembrie 2026)
-- Loturile cozii OLX se leagă între ele prin pg_net: la final, ruta cere bazei să o
-- cheme din nou. pg_net așteaptă doar 3 secunde, iar Vercel a pornit funcția în
-- 14–26 de secunde între loturi. O chemare a renunțat înainte să ajungă la site, iar
-- lanțul s-a rupt la 08:35:47 cu 37 de piese noi în coadă — rămase acolo până la
-- următoarea schimbare de piesă. „Automat” nu are voie să depindă de asta.
--
-- CE FACE
--   1. Un CEAS (pg_cron), o dată pe minut: dacă sincronizarea e pornită și în coadă e
--      ceva de făcut, trezește ruta. Cu coada goală nu cheamă nimic (nicio funcție Vercel
--      degeaba). Un rând picat se reîncearcă astfel singur, cel mult 5 încercări.
--   2. `olx_trezeste` (din 58) așteaptă 10 s în loc de 3. Singura schimbare din funcție.
--      Garda de amprentă (tiparul din 50): se oprește dacă funcția din bază nu e cea din 58
--      sau cea de aici. Amprenta se calculează FĂRĂ `\r` (SQL Editor de pe Windows).
--
-- Depinde de 58. Cere extensia pg_cron (pe Supabase: Database → Extensions → pg_cron,
-- sau linia `create extension` de mai jos). Idempotentă: `cron.schedule` cu același nume
-- înlocuiește programarea.
-- Pre-verificare: scripts/pre-verifica-olx-coada-ceas.sql · Anulare: scripts/anuleaza-olx-coada-ceas.sql
-- ============================================================
create extension if not exists pg_cron;

-- ---------- 1. garda de amprentă ----------
do $$
declare v text;
begin
  select md5(replace(p.prosrc, E'\r', '')) into v
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'olx_trezeste';
  if v is null then raise exception 'Lipsește olx_trezeste — rulează întâi migrarea 58 (supabase/olx-coada.sql).'; end if;
  if v not in ('6676526a2534da97fdb765f4f198b91a', 'd73c0e77ccc4dd13682098c431c47db4') then
    raise exception 'olx_trezeste din bază (amprenta %) nu e versiunea din 58 și nici cea din 59. Oprit, ca să nu calc o modificare necunoscută.', v;
  end if;
end $$;

-- ---------- 2. olx_trezeste: 10 s în loc de 3 ----------
create or replace function public.olx_trezeste(fortat boolean default false)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_url text; v_secret text; v_activ boolean;
begin
  -- Configurarea se citește ÎNAINTE de a consuma fereastra (lecția dez.ro).
  select activ, webhook_url, webhook_secret into v_activ, v_url, v_secret from public.olx_trezire where unic;
  if not coalesce(v_activ, false) or coalesce(v_url, '') = '' or coalesce(v_secret, '') = '' then
    return false; -- oprit: rândurile rămân în coadă și pleacă după pornire
  end if;
  update public.olx_trezire set ultima = now() where unic and (fortat or ultima < now() - interval '20 seconds');
  if not found then return false; end if;
  -- 10 s (59): cu 3 s, pornirea lentă a funcției Vercel făcea ca chemarea să renunțe înainte să ajungă.
  perform net.http_post(
    url := v_url, body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-autopas-olx', v_secret),
    timeout_milliseconds := 10000);
  return true;
end $$;
revoke execute on function public.olx_trezeste(boolean) from public, anon, authenticated;
grant  execute on function public.olx_trezeste(boolean) to service_role;

-- ---------- 3. ceasul ----------
-- Trezește DOAR dacă e ceva de făcut. Un lot în lucru ține lacătul (lot_pana): atunci nu se
-- cheamă nimic — lotul acela se leagă singur mai departe, iar dacă lanțul lui se rupe, ceasul
-- îl reia la minutul următor.
create or replace function public.olx_ceas()
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.olx_trezire where unic and activ and lot_pana < now()) then return false; end if;
  if not exists (select 1 from public.olx_coada where incercari < 5) then return false; end if;
  return public.olx_trezeste(false);
end $$;
revoke execute on function public.olx_ceas() from public, anon, authenticated;
grant  execute on function public.olx_ceas() to service_role;

select cron.schedule('olx-coada', '* * * * *', 'select public.olx_ceas()');

-- ============================================================
-- VERIFICAREA FINALĂ (doar citire): true | true | true
-- ============================================================
select
  (select md5(replace(prosrc, E'\r', '')) = 'd73c0e77ccc4dd13682098c431c47db4' from pg_proc where proname = 'olx_trezeste') as trezeste_59,
  (select count(*) = 1 from cron.job where jobname = 'olx-coada' and schedule = '* * * * *' and active)              as ceas_programat,
  to_regprocedure('public.olx_ceas()') is not null                                                                   as are_olx_ceas;
