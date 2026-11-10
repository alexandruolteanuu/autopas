-- ============================================================
-- ANULAREA MIGRĂRII 48 (supabase/saga-export.sql) — DOAR LA NEVOIE
--
-- Scoate exact cele două funcții create de migrarea 48. Nu atinge migrarea 47,
-- nicio comandă, nicio setare.
--
-- ATENȚIE: după anulare, butonul „Export Saga (CSV)” din Admin → Facturi nu mai
-- merge (cheamă `export_saga_linii`) — până la re-rularea migrării sau până la
-- întoarcerea codului paginii la versiunea dinainte de pasul 2.
--
-- Fără `cascade`, intenționat: dacă un pas ulterior depinde de ele, se oprește.
-- ============================================================

begin;

drop function if exists public.export_saga_linii(bigint[]);
drop function if exists public.saga_cota_tva();

commit;

-- Verificare: trebuie să întoarcă 0 rânduri.
select 'încă există: ' || p.proname as ramas
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace
   and p.proname in ('export_saga_linii', 'saga_cota_tva');
