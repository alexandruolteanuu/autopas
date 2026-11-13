-- PRE-VERIFICAREA MIGRĂRII 56 (supabase/olx-conexiune.sql). DOAR CITIRE.
-- Trebuie 4 × true. Dacă ceva e false, NU rula migrarea — trimite rezultatul.
select
  to_regprocedure('public.is_admin()') is not null                     as are_is_admin,
  to_regprocedure('public.is_staff()') is not null                     as are_is_staff,
  (select data_type = 'bigint' from information_schema.columns
    where table_schema = 'public' and table_name = 'categories' and column_name = 'id') as categories_id_bigint,
  (to_regclass('public.olx_cont') is null
   or not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'olx_cont')) as olx_cont_fara_politici;
