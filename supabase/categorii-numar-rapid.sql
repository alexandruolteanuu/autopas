-- ============================================================
-- AUTOPAS — NUMĂRĂTOAREA PE CATEGORII, DINTR-O SINGURĂ TRECERE
-- (rulează AL TREIZECI ȘI UNULEA)
-- Supabase → SQL Editor → New query → lipește tot → Run
-- IDEMPOTENTĂ: se poate re-rula oricând.
--
-- CE REPARĂ (măsurat pe producție, 28 august 2026)
-- View-ul `categorii_cu_numar` calcula `nr_piese` cu o subinterogare CORELATĂ:
-- pentru FIECARE categorie, o scanare completă a tabelei `products`.
--
--   Seq Scan on categories c            (rows=349)
--     SubPlan 1
--       ->  Seq Scan on products p      (loops=349)
--             Rows Removed by Filter: 8733
--   Execution Time: 1411 ms
--
-- Adică 349 × 8.783 de rânduri citite, ca să afle 349 de numere. La 50 de piese
-- nu se vedea; la 8.783 înseamnă **1,47 secunde**, măsurat de trei ori
-- (1452 · 1398 · 1571 ms).
--
-- Costul e plătit pe fiecare afișare a lui `/piese` și a primei pagini, unde e
-- peste jumătate din timpul de răspuns al serverului (TTFB 2,6–2,8 s). Cât timp
-- stă acolo, orice optimizare de imagini e limitată de el: poza nici nu poate
-- începe să se încarce înainte să sosească HTML-ul.
--
-- SOLUȚIA: aceleași numere, dintr-o singură trecere prin `products`. Cele două
-- coloane de categorie se pun una sub alta cu `union all`, apoi se grupează.
--
-- `count(distinct pid)`, nu `count(*)`: dacă o piesă ar avea aceeași categorie și
-- în `categorie_id`, și în `subcategorie_id`, `union all` ar produce două rânduri
-- pentru ea, iar numărul ar ieși umflat. Condiția veche, cu `OR`, o număra o
-- singură dată — `distinct` păstrează exact acel comportament.
--
-- REZULTATE IDENTICE, verificate rând cu rând înainte de scrierea migrării:
-- 349 de categorii, **0 diferențe**, aceeași sumă totală (17.478).
-- Timp nou, trei rulări: 21,8 · 18,7 · 18,5 ms. De ~75 de ori mai rapid.
--
-- `security_invoker = true` se păstrează, din același motiv ca la migrarea 14:
-- view-ul aplică politicile RLS ale celui care îl citește. Se redeclară pentru că
-- `create or replace view` NU păstrează opțiunile view-ului vechi.
-- ============================================================

create or replace view public.categorii_cu_numar as
  with numarate as (
    select cid, count(distinct pid)::int as nr
      from (
        select id as pid, categorie_id    as cid from products
         where publicat and stoc > 0 and categorie_id is not null
        union all
        select id,        subcategorie_id      from products
         where publicat and stoc > 0 and subcategorie_id is not null
      ) t
     group by cid
  )
  select c.id,
         c.slug,
         c.nume,
         c.parent_id,
         c.ordine,
         c.art,
         coalesce(n.nr, 0) as nr_piese
    from categories c
    left join numarate n on n.cid = c.id;

alter view public.categorii_cu_numar set (security_invoker = true);


-- ============================================================
-- VERIFICARE
--
-- 1. Suma trebuie să fie 17.478, exact ca înainte de migrare.
-- 2. `security_invoker=true` trebuie să apară în opțiuni.
-- 3. Planul nu mai trebuie să conțină „SubPlan" și „loops=349".
-- ============================================================
select count(*)        as categorii,
       sum(nr_piese)   as suma_piese,            -- așteptat: 17478
       (select reloptions::text from pg_class where relname = 'categorii_cu_numar') as optiuni
  from public.categorii_cu_numar;

-- explain analyze select sum(nr_piese) from categorii_cu_numar;
--   -> așteptat: „HashAggregate" + „Hash Right Join", sub 30 ms, fără SubPlan
