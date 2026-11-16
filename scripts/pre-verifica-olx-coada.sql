-- PRE-VERIFICAREA MIGRĂRII 58 (supabase/olx-coada.sql). DOAR CITIRE. Trebuie 5 × true.
select
  to_regclass('public.olx_anunturi') is not null                                  as are_migrarea_57,
  to_regprocedure('public.is_staff()') is not null                                as are_is_staff,
  exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'net' and p.proname = 'http_post')                    as are_pg_net,
  to_regprocedure('public.gen_random_uuid()') is not null
    or to_regprocedure('pg_catalog.gen_random_uuid()') is not null                as are_gen_random_uuid,
  not exists (select 1 from information_schema.triggers
               where event_object_table = 'products' and trigger_name like 'olx_%') as fara_triggere_olx_inca;
