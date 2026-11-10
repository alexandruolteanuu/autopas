-- ============================================================
-- ANULAREA MIGRĂRII 47 (supabase/saga-calcul.sql) — DOAR LA NEVOIE
--
-- Scoate exact cele patru obiecte create de migrarea 47 și nimic altceva:
-- trei funcții și tabela `judete_coduri` (cu indexul și politica ei, care pleacă
-- odată cu tabela). Nu atinge nicio piesă, comandă sau setare.
--
-- FĂRĂ `cascade`, intenționat: dacă între timp altceva a început să folosească
-- obiectele astea (migrările pașilor următori, de ex. `emite_factura`), comanda
-- se OPREȘTE cu „cannot drop … because other objects depend on it”, în loc să
-- șteargă tăcut și acele obiecte. Atunci se anulează întâi pasul care depinde.
--
-- Rulare: Supabase → SQL Editor → lipești tot → Run. E o singură tranzacție:
-- ori pleacă toate patru, ori niciunul.
-- ============================================================

begin;

drop function if exists public.calculeaza_linie_tva(numeric, numeric, numeric);
drop function if exists public.cod_judet(text);
drop function if exists public.transport_facturabil(numeric, numeric, numeric, numeric);
drop table    if exists public.judete_coduri;

commit;

-- Verificare: trebuie să întoarcă 0 rânduri.
select 'încă există: ' || x as ramas from (
  select p.proname::text as x from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('calculeaza_linie_tva', 'cod_judet', 'transport_facturabil')
  union all
  select 'judete_coduri' where to_regclass('public.judete_coduri') is not null
) t;
