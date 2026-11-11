-- ============================================================
-- ANULAREA MIGRĂRII 52 (supabase/saga-api.sql) — DOAR LA NEVOIE
--
-- Șterge cheia SAGA salvată, lacătul, jurnalul apelurilor și funcțiile lor.
-- Fără `cascade`: dacă ceva depinde de ele, se oprește cu eroare.
-- Atenție: cheia salvată se pierde — după re-rulare se salvează din nou din admin
-- (dacă SAGA a rotit-o între timp, cea din SAGA WEB e cea bună: se regenerează acolo).
-- Se rulează din Supabase → SQL Editor, de proprietar.
-- ============================================================
begin;

drop function if exists public.saga_roteste_cheia(text, text);
drop function if exists public.saga_salveaza_cheia(text, uuid);
drop function if exists public.saga_elibereaza(uuid);
drop function if exists public.saga_ia_blocarea(uuid, int);
drop policy if exists "saga_trimiteri citire facturare" on public.saga_trimiteri;
drop table if exists public.saga_trimiteri;
drop table if exists public.saga_blocare;
drop table if exists public.saga_cheie;

commit;
