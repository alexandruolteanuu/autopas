-- ============================================================
-- PRE-VERIFICAREA MIGRĂRII 60 (supabase/saga-emitere-un-buton.sql) — DOAR CITIRE.
-- Supabase → SQL Editor → Run. Trebuie: 5 × true.
--
--   emite_54   — emite_factura e versiunea din 54 (migrarea o folosește neschimbată);
--   paza_49    — facturi_pazeste e versiunea din 49 (sau deja 60, la re-rulare);
--   pg_cron    — extensia e activă. Dacă e false: Supabase → Database → Extensions →
--                caută „pg_cron” → Enable (schema implicită), apoi rulează din nou;
--   pg_net     — extensia e activă (e folosită de la migrarea 36);
--   fara_dubla — nicio comandă cu două facturi nestornate (altfel indexul unic nu se poate crea).
-- ============================================================
select
  (select md5(replace(prosrc, E'\r', '')) from pg_proc where oid = to_regprocedure('public.emite_factura(bigint)'))
    = '05f9fdfb49e73145c8004f290ed6ec42' as emite_54,
  (select md5(replace(prosrc, E'\r', '')) from pg_proc where oid = to_regprocedure('public.facturi_pazeste()'))
    in ('a2b12d08e988b102abc939e3d533fff6', 'f8bccca0f490afa7f2ccf5a96d4be32d') as paza_49,
  exists (select 1 from pg_extension where extname = 'pg_cron') as pg_cron,
  exists (select 1 from pg_extension where extname = 'pg_net') as pg_net,
  not exists (
    select f.order_id from public.facturi f
     where f.tip = 'factura' and not exists (select 1 from public.facturi s where s.storno_pentru = f.id)
     group by f.order_id having count(*) > 1) as fara_dubla;
