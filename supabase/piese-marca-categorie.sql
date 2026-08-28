-- ============================================================
-- AUTOPAS — PIESE PE PERECHEA MARCĂ × CATEGORIE (rulează AL TREIZECI ȘI DOILEA)
-- Supabase → SQL Editor → New query → lipește tot → Run
-- IDEMPOTENTĂ: se poate re-rula oricând.
--
-- LA CE FOLOSEȘTE
-- Paginile noi de marcă și de categorie au nevoie de legături între ele:
--   · pe `/piese/marca/skoda` — ce categorii au piese de Skoda;
--   · pe `/piese/categorie/faruri` — ce mărci au faruri.
--
-- Fără view, singura cale prin PostgREST ar fi să aducem în Node toate piesele
-- mărcii (3.085 de rânduri doar la Volkswagen) și să le numărăm acolo — exact
-- tiparul reparat la migrarea 31. Aici se numără o dată, în bază: **2.098 de
-- rânduri, 33 ms** pentru tot catalogul, iar o pagină cere doar felia ei.
--
-- CATEGORIA E CEA MAI PRECISĂ: `coalesce(subcategorie_id, categorie_id)`.
-- O piesă cu subcategorie completată se numără la subcategorie, nu și la grupa
-- părinte — altfel „Optică și faruri" ar apărea de două ori în aceeași listă,
-- o dată pentru ea și o dată prin subcategoriile ei.
--
-- `security_invoker = true`, ca la celelalte view-uri (migrarea 14): se aplică
-- politicile RLS ale celui care citește. Filtrul `publicat and stoc > 0` e deja
-- înăuntru, deci nu se vede nimic în plus față de catalogul public.
-- ============================================================

create or replace view public.piese_pe_marca_categorie as
  select m.brand_id                                      as marca_id,
         coalesce(p.subcategorie_id, p.categorie_id)     as categorie_id,
         count(distinct p.id)                            as nr_piese
    from products p
    cross join lateral unnest(p.model_ids) as mid
    join models m on m.id = mid
   where p.publicat
     and p.stoc > 0
     and coalesce(p.subcategorie_id, p.categorie_id) is not null
   group by m.brand_id, coalesce(p.subcategorie_id, p.categorie_id);

alter view public.piese_pe_marca_categorie set (security_invoker = true);


-- ============================================================
-- VERIFICARE
-- ============================================================
select count(*)                       as randuri,
       count(distinct marca_id)       as marci,
       count(distinct categorie_id)   as categorii,
       sum(nr_piese)                  as legaturi,
       (select reloptions::text from pg_class where relname = 'piese_pe_marca_categorie') as optiuni
  from public.piese_pe_marca_categorie;


-- ============================================================
-- ȘI TOTALUL PE MARCĂ — 38 de rânduri
--
-- Subsolul arată primele 10 mărci după numărul de piese, iar subsolul apare pe
-- FIECARE pagină, inclusiv pe cele 8.739 de piesă. Fără view-ul ăsta, fiecare
-- afișare ar aduce cele 538 de rânduri din `numar_piese_pe_model` și le-ar
-- aduna în Node — de 8.780 de ori pe zi, pentru zece nume.
-- ============================================================
create or replace view public.numar_piese_pe_marca as
  select b.id                                       as marca_id,
         b.slug,
         b.nume,
         coalesce(sum(n.nr_piese), 0)::bigint       as nr_piese
    from brands b
    left join numar_piese_pe_model n on n.brand_id = b.id
   group by b.id, b.slug, b.nume;

alter view public.numar_piese_pe_marca set (security_invoker = true);

select count(*) as marci, count(*) filter (where nr_piese > 0) as cu_piese, sum(nr_piese) as total
  from public.numar_piese_pe_marca;
