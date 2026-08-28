-- ============================================================
-- AUTOPAS — NUMĂRĂTORILE PENTRU FILTRU, ÎN BAZĂ (rulează AL DOUĂZECI ȘI NOUĂLEA)
-- Supabase → SQL Editor → New query → lipește tot → Run
-- IDEMPOTENTĂ: se poate re-rula oricând.
--
-- DEFECTUL PE CARE ÎL REPARĂ (28 august 2026)
-- Filtrul de mărci și contoarele „Audi · 457 de piese" se calculau trăgând
-- TOATE piesele publicate în browser/Node și numărându-le acolo:
--
--   sb.from("products").select("model_ids").eq("publicat", true)
--
-- PostgREST taie tăcut la 1.000 de rânduri. Din 8.754 de piese ajungeau 1.000,
-- deci numărătoarea se făcea pe 11% din catalog. Consecința nu era o cifră puțin
-- greșită, ci mărci DISPĂRUTE: regula „arătăm doar mărcile cu cel puțin o piesă"
-- (`marciCuPiese`) le judeca după același eșantion, așa că din 38 de mărci cu
-- piese se vedeau 16. Lipseau, printre altele, Dacia (343 de piese), Toyota (471)
-- și Volvo (238) — într-un magazin de dezmembrări din Neamț.
--
-- SOLUȚIA nu e paginarea, deși ar fi mers. Numărătoarea n-are ce căuta în Node:
-- ca să afli 540 de numere nu aduci 8.754 de rânduri prin rețea. View-ul de mai
-- jos întoarce cel mult un rând pe model — azi 537 — și e corect prin
-- construcție, nu prin noroc: nu există nicio mărime care să-l poată depăși pe
-- măsură ce catalogul crește.
--
-- `security_invoker = true` din aceleași motive ca la `categorii_cu_numar`
-- (migrarea 14): view-ul aplică politicile RLS ale celui care îl citește.
-- Rezultatele nu se schimbă — filtrul `publicat = true` e deja înăuntru.
-- ============================================================

create or replace view public.numar_piese_pe_model as
  select m.id        as model_id,
         m.brand_id  as brand_id,
         count(*)::int as nr_piese
    from products p
    cross join lateral unnest(p.model_ids) as mid
    join models m on m.id = mid
   where p.publicat = true
   group by m.id, m.brand_id;

alter view public.numar_piese_pe_model set (security_invoker = true);



-- ============================================================
-- ACELAȘI RAȚIONAMENT, PENTRU MAȘINI
--
-- Hero-ul, `/masini` și `/cauta-dupa-masina` aveau nevoie de „câte piese are
-- fiecare mașină" și îl calculau aducând un rând pentru FIECARE piesă legată —
-- adică până la 8.754 de rânduri ca să afle 22 de numere, și tot cu plafonul de
-- 1.000 deasupra.
--
-- Nu se folosește `vehicles.piese_listate` (ținut de triggerul
-- `recalc_piese_vehicul`) fiindcă e o valoare memorată: dacă se desincronizează
-- vreodată, se vede exact ca defectul „0 piese disponibile" pe care tocmai l-am
-- reparat. View-ul numără la citire, deci nu poate rămâne în urmă.
-- ============================================================
create or replace view public.numar_piese_pe_masina as
  select v.id as vehicul_id,
         (select count(*)::int from products p
           where p.vehicul_id = v.id and p.publicat = true and p.stoc > 0) as nr_piese
    from vehicles v;

alter view public.numar_piese_pe_masina set (security_invoker = true);


-- ============================================================
-- VERIFICARE
-- Numărul de rânduri trebuie să fie mic (un rând pe model cu piese), iar suma
-- să dea toate legăturile marcă–piesă din catalog.
-- ============================================================
select count(*) as randuri_view,
       sum(nr_piese) as legaturi_total,
       count(distinct brand_id) as marci_cu_piese
  from public.numar_piese_pe_model;
