-- ============================================================
-- ANULAREA MIGRĂRII 53 (supabase/saga-stornare.sql) — DOAR LA NEVOIE
--
-- Șterge funcțiile stornării și ale ascunderii și tabela `facturi_ascunse` (facturile
-- de probă ascunse reapar în listă). NU atinge niciun document: stornările deja emise
-- rămân în `facturi` (sunt documente fiscale). Fără `cascade`.
-- Se rulează din Supabase → SQL Editor, de proprietar.
-- ============================================================
begin;

drop function if exists public.reafiseaza_factura(bigint);
drop function if exists public.ascunde_factura(bigint, text);
drop function if exists public.retrage_storno(bigint);
drop function if exists public.storneaza_factura(bigint, text);
drop policy if exists "facturi ascunse citire" on public.facturi_ascunse;
drop table if exists public.facturi_ascunse;
drop function if exists public.serie_de_proba(text);

commit;
