-- PRE-VERIFICAREA MIGRĂRII 59 (supabase/olx-coada-ceas.sql). DOAR CITIRE. Trebuie 3 × true.
select
  to_regclass('public.olx_trezire') is not null                                        as are_migrarea_58,
  exists (select 1 from pg_available_extensions where name = 'pg_cron')               as pg_cron_disponibil,
  (select md5(replace(prosrc, E'\r', '')) in ('6676526a2534da97fdb765f4f198b91a', 'd73c0e77ccc4dd13682098c431c47db4')
     from pg_proc where proname = 'olx_trezeste')                                      as olx_trezeste_cunoscuta;
