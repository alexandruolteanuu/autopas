-- PRE-VERIFICAREA MIGRĂRII 57 (supabase/olx-anunturi.sql). DOAR CITIRE. Trebuie 3 × true.
select
  to_regclass('public.olx_cont') is not null                          as are_migrarea_56,
  to_regprocedure('public.is_staff()') is not null                    as are_is_staff,
  (select data_type = 'bigint' from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'id') as products_id_bigint;
