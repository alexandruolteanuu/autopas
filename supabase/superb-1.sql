-- ============================================================
-- AUTOPAS — GENERAȚIA LIPSĂ „ŠKODA SUPERB 1" (rulează AL TREIZECI ȘI CINCILEA)
-- Supabase → SQL Editor → New query → lipește tot → Run
-- IDEMPOTENTĂ: se poate re-rula oricând.
--
-- DE CE (6 septembrie 2026)
-- În curte e un „Skoda Superb 1 1U Facelift 1.9 TDI BPZ" din 2008, iar în
-- `models` existau doar Superb 2, 3 și 4. Fără generație, pagina lui publică
-- rămâne fără nicio piesă — de la migrarea 34, `vehicles.model_id` e SINGURA
-- cheie prin care o mașină își găsește piesele.
--
-- ATENȚIE, sursa nu ajută aici: pieseauto.ro nu scrie NICIODATĂ „Skoda Superb 1".
-- Numărate la 6 septembrie 2026, etichetele de compatibilitate din tot catalogul
-- sunt „Skoda Superb 3" (97 de piese), „Skoda Superb" fără cifră (92) și
-- „Skoda Superb 2" (66). Deci un import viitor nu va lega singur nimic de
-- generația asta; legătura o punem noi, mai jos, și rămâne — `patchLaReimport`
-- din lib/import/rand.mjs atinge doar prețul, titlul și `sursa_activ`.
--
-- ȘI UN DEFECT DE DATE, GĂSIT CU OCAZIA ASTA
-- Patru piese care spun în titlu „Superb 1" sau „Superb 3U" (3U e codul de
-- caroserie al primei generații; 1U e al lui Octavia 1) erau legate de
-- „Superb 2 (2008–2015)". Nu e vina sursei: ea le-a etichetat generic „Skoda
-- Superb", iar importul a ales generația prin SUPRAPUNERE de ani — „2005–2008"
-- atinge „2008–2015" într-un singur an, 2008, și atât i-a trebuit. Un spălător
-- de far de 3U nu intră pe un 3T. Se mută pe generația corectă.
-- ============================================================


-- ============================================================
-- 1. GENERAȚIA
-- Superb I, tip 3U, 2001–2008. Slug-ul urmează convenția celorlalte
-- („skoda-fabia-1", „skoda-octavia-1").
-- ============================================================
insert into public.models (brand_id, slug, nume, an_start, an_final)
select b.id, 'skoda-superb-1', 'Superb 1', 2001, 2008
  from public.brands b
 where b.nume = 'Škoda'
   and not exists (select 1 from public.models m where m.slug = 'skoda-superb-1');


-- ============================================================
-- 2. PIESELE PUSE GREȘIT PE SUPERB 2
--
-- Cele patru cu „Superb 1" / „Superb 3U" în titlu care aveau id-ul 38
-- (Superb 2). Se scoate doar 38; restul compatibilităților rămân neatinse.
--   1250  Spălător far … Skoda Superb 3U 2005 2006 2007 2008
--   2413  Injectoare … Skoda Superb 3U 1.9 TDI BPZ 2005 2006 2007 2008
--   8656  Oglindă … Skoda Superb 1 Facelift 2006 2007 2008
--   8657  Geam ușă … Skoda Superb 1 2005 2006 2007 2008
-- ============================================================
update public.products
   set model_ids = array_remove(model_ids, (select id from public.models where slug = 'skoda-superb-2'))
 where id in (1250, 2413, 8656, 8657);


-- ============================================================
-- 3. TOATE CELE ȘASE PIESE DE SUPERB 1 PRIMESC GENERAȚIA
--
-- Pe lângă cele patru de mai sus, două erau legate DOAR de „Passat B5" — corect,
-- Superb 1 e construit pe platforma lui Passat B5.5, dar incomplet:
--   4742  Casetă direcție Skoda Superb 1 2001 … 2007
--   4776  Conductă servodirecție Vw Passat B5.5 / Skoda Superb 1 1.9 TDI
-- Legătura cu Passat B5 rămâne: piesa chiar intră pe amândouă.
-- ============================================================
update public.products
   set model_ids = model_ids || (select id from public.models where slug = 'skoda-superb-1')
 where id in (1250, 2413, 4742, 4776, 8656, 8657)
   and not (model_ids @> array[(select id from public.models where slug = 'skoda-superb-1')]);


-- ============================================================
-- 4. MAȘINA DIN CURTE PRIMEȘTE MARCA ȘI GENERAȚIA
-- Ultima dintre cele 23 fără ele. Restul s-au completat la 6 septembrie 2026.
-- ============================================================
update public.vehicles v
   set marca_id = (select id from public.brands where nume = 'Škoda'),
       model_id = (select id from public.models where slug = 'skoda-superb-1')
 where v.nume like 'Skoda Superb 1%'
   and v.model_id is null;


-- ============================================================
-- VERIFICARE
-- Prima: mașina are acum generație și piese. A doua: nicio piesă cu „Superb 1"
-- sau „3U" în titlu nu mai stă pe Superb 2.
-- ============================================================
select v.nume, b.nume as marca, m.nume as model, n.nr_piese
  from vehicles v
  left join brands b on b.id = v.marca_id
  left join models m on m.id = v.model_id
  join numar_piese_compatibile_pe_masina n on n.vehicul_id = v.id
 where v.nume like 'Skoda Superb%';

select id, nume, model_ids
  from products
 where cautare like '%superb 1%' or cautare like '%superb 3u%' or nume ilike '%superb 1%'
 order by id;
