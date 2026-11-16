-- ============================================================
-- ANULAREA MIGRĂRII 59 (ceasul cozii OLX) — DOAR LA NEVOIE. Fără `cascade`.
-- Oprește ceasul și pune înapoi `olx_trezeste` din 58 (3 s). Extensia pg_cron RĂMÂNE
-- (poate fi folosită și de altceva). Coada merge mai departe ca înainte de 59: lanțul
-- de loturi + trezirea la fiecare schimbare de piesă.
-- ============================================================
begin;
do $$ begin
  if exists (select 1 from cron.job where jobname = 'olx-coada') then perform cron.unschedule('olx-coada'); end if;
end $$;
drop function if exists public.olx_ceas();
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
  perform net.http_post(
    url := v_url, body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-autopas-olx', v_secret),
    timeout_milliseconds := 3000);
  return true;
end $$;
revoke execute on function public.olx_trezeste(boolean) from public, anon, authenticated;
grant  execute on function public.olx_trezeste(boolean) to service_role;
commit;
