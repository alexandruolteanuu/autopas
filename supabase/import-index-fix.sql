-- ============================================================
-- MIGRAREA 20 — indexul de potrivire la re-import, refăcut ca index total
--
-- Migrarea 17 a creat indexul ca PARȚIAL:
--     create unique index products_sursa_uniq on products (sursa, sursa_id)
--       where sursa is not null and sursa_id is not null;
--
-- Ideea era să nu bage în constrângere piesele introduse manual, care au ambele
-- coloane NULL. Dar `ON CONFLICT (sursa, sursa_id)` nu poate folosi un index
-- parțial decât dacă i se repetă exact predicatul, iar PostgREST (deci `upsert`-ul
-- din scriptul de import) nu are cum să-l trimită. Rezultatul: HTTP 400, cod
-- 42P10, „there is no unique or exclusion constraint matching the ON CONFLICT
-- specification".
--
-- Indexul total face același lucru: în PostgreSQL valorile NULL sunt considerate
-- distincte între ele (comportamentul implicit, NULLS DISTINCT), așa că oricâte
-- piese introduse manual pot avea (NULL, NULL) fără să se ciocnească. Singura
-- diferență e că `ON CONFLICT` îl poate folosi.
--
-- IDEMPOTENT: se poate rula de câte ori vrei.
-- Se rulează în Supabase → SQL Editor.
-- ============================================================

drop index if exists products_sursa_uniq;

create unique index if not exists products_sursa_uniq
  on products (sursa, sursa_id);

-- ---------- Verificare ----------
-- Trebuie să apară fără clauza `WHERE`.
select indexname, indexdef from pg_indexes where indexname = 'products_sursa_uniq';
