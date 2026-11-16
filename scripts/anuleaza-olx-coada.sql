-- ============================================================
-- ANULAREA MIGRĂRII 58 (OLX, sincronizarea automată) — DOAR LA NEVOIE. Fără `cascade`.
-- Scoate triggerele, funcțiile, view-urile, coada și trezirea. Coloana
-- `olx_anunturi.retras_la` RĂMÂNE (ține minte ce anunțuri au fost deja retrase la OLX;
-- scoaterea ei ar face ca anunțurile retrase să pară din nou vii). O scoți de mână doar dacă
-- vrei: `alter table public.olx_anunturi drop column retras_la;`
-- După anulare, anunțurile OLX se schimbă din nou doar cu mâna (caseta de pe pagina piesei).
-- ============================================================
begin;
drop trigger if exists olx_la_inserare  on public.products;
drop trigger if exists olx_la_modificare on public.products;
drop trigger if exists olx_la_stergere  on public.products;
drop function if exists public.olx_marcheaza();
drop view if exists public.olx_coada_stare;
drop view if exists public.olx_de_retras;
drop function if exists public.olx_trezeste(boolean);
drop function if exists public.olx_deblocheaza();
drop function if exists public.olx_coada_ia_lotul(int);
drop function if exists public.olx_coada_elibereaza();
drop table if exists public.olx_trezire;
drop table if exists public.olx_coada;
commit;
