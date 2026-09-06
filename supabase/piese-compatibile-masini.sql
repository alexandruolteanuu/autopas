-- ============================================================
-- AUTOPAS — PIESELE UNEI MAȘINI SE ALEG PRIN COMPATIBILITATE (rulează AL TREIZECI ȘI PATRULEA)
-- Supabase → SQL Editor → New query → lipește tot → Run
-- IDEMPOTENTĂ: se poate re-rula oricând.
--
-- CE SE SCHIMBĂ (6 septembrie 2026)
-- Până azi, pagina unei mașini dezmembrate arăta DOAR piesele legate manual prin
-- `products.vehicul_id`, adică prin câmpul „Mașina-sursă" din editorul de produs.
-- Legătura o punea omul, piesă cu piesă. Rezultatul, măsurat pe baza reală chiar
-- înainte de această migrare: 0 din 8.895 de piese aveau `vehicul_id` completat,
-- deci TOATE cele 23 de pagini de mașină erau goale.
--
-- De acum pagina se umple singură, din compatibilitatea pe care o avem deja în
-- `products.model_ids` — 8.684 din 8.804 piese publicate (98,6%) o au completată,
-- extrasă la import din „Piesă auto compatibilă cu:".
--
-- REGULA: se potrivește GENERAȚIA (`vehicles.model_id`), niciodată anul.
-- Anul mașinii se folosește o singură dată, în admin, ca să ALEAGĂ generația;
-- după aceea dispare din filtru. Măsurat pe „Audi A4, 2014" → generația A4 B8
-- (2008–2015):
--
--     doar generația ............................ 221 de piese
--     generația ȘI anul 2014 în `products.ani` ...  90 de piese
--
-- Filtrul pe an ar arunca 131 de piese bune, fiindcă `products.ani` conține anii
-- MAȘINII DE PE CARE S-A DEMONTAT piesa, nu intervalul ei de compatibilitate.
-- „Brațe suspensie față Audi A4 B8 2008 2009 2010 2011" e o piesă de B8 care
-- intră și pe un B8 din 2014, dar anii ei spun 2008–2011. Invers, „Display MMI
-- Audi A6 4F 2005–2008" e trecut de sursă ca fiind compatibil și cu A4 B8, deși
-- anii lui sunt dinaintea generației. Cele două coloane răspund la întrebări
-- diferite; numai `model_ids` răspunde la a noastră.
--
-- CE NU SE ATINGE
-- `products.vehicul_id` RĂMÂNE în bază și rămâne în editorul de produs, dar
-- devine strict INTERNĂ: nu mai are niciun efect pe site. O alimentează în
-- continuare profitul și amortizarea pe mașină din /admin/masini — singura cifră
-- care nu se poate deduce din compatibilitate, fiindcă „cât am încasat din
-- Passat-ul ăla" cere să știi de pe ce mașină a plecat fiecare piesă.
-- Coloana nu se șterge: e goală azi, nu deranjează pe nimeni, iar un `drop
-- column` e ireversibil. Aceeași soluție ca la `products.stare`.
-- ============================================================


-- ============================================================
-- 1. CÂT DE SPECIFICĂ E O PIESĂ — coloană calculată, pentru ordonare
--
-- O piesă trecută de sursă la un singur model („Audi A4 B8") e aproape sigur o
-- piesă de B8. Una trecută la 31 de modele e generică — un display, un senzor,
-- o șurubărie care intră peste tot. Prima merită să apară prima pe pagina
-- mașinii; a doua e umplutură dacă stă în capul listei.
--
-- Media pe catalog e 1,44 modele pe piesă (1,46 dacă numeri doar piesele care
-- au măcar una), maximul 31, iar 120 de piese din 8.895 n-au nicio compatibilitate.
--
-- De ce coloană calculată și nu sortare în Node: PostgREST nu poate ordona după
-- `array_length(...)`, iar aducerea tuturor piesele unui model doar ca să le
-- sortăm în Node e exact tiparul de care ne-am ferit peste tot (vezi plafonul de
-- 1.000 de rânduri). Așa ordonarea și paginarea rămân în bază.
--
-- `generated always as (...) stored` cere o expresie IMMUTABLE; `array_length`
-- și `coalesce` sunt. Coloana se rescrie singură la orice modificare a lui
-- `model_ids`, deci nu se poate desincroniza — spre deosebire de
-- `vehicles.piese_listate`, ținut de trigger.
-- ============================================================
alter table public.products
  add column if not exists nr_modele int
  generated always as (coalesce(array_length(model_ids, 1), 0)) stored;

comment on column public.products.nr_modele is
  'Câte modele sunt trecute în model_ids. Se calculează singură. Folosită ca semnal de relevanță: cu cât mai puține, cu atât piesa e mai specific a modelului respectiv.';


-- ============================================================
-- 2. CÂTE PIESE COMPATIBILE ARE FIECARE MAȘINĂ
--
-- Contorul afișat pe /masini, în hero-ul primei pagini și în /cauta-dupa-masina.
-- Un rând pe mașină — azi 23 — nu un rând pe piesă. Motivul e cel din migrarea
-- 29: ca să afli 23 de numere nu aduci 8.895 de rânduri prin rețea.
--
-- Forma e o subinterogare corelată, adică exact ce interzice regula scrisă la
-- migrarea 31 („nu număra cu subinterogare corelată peste o tabelă mare").
-- Excepția e aceeași ca la `numar_piese_pe_masina` și e condiționată de un
-- index: `model_ids @> array[...]` intră pe `products_model_ids_idx` (GIN), deci
-- sunt 23 de căutări în index, nu 23 de scanări complete. Dacă indexul acela
-- dispare vreodată, view-ul ăsta devine instantaneu problema de la migrarea 31.
--
-- Filtrul e `publicat and stoc > 0`, la fel ca lista de pe pagina mașinii:
-- contorul și lista TREBUIE să spună același lucru. La dezmembrări fiecare piesă
-- e unicat, deci una vândută n-are ce căuta nici în cifră, nici în grilă.
--
-- O mașină fără `model_id` (marca sau generația necompletate în admin) dă 0,
-- nu eroare. Adminul o marchează acolo cu „⚠ fără model".
-- ============================================================
create or replace view public.numar_piese_compatibile_pe_masina as
  select v.id as vehicul_id,
         v.model_id,
         (select count(*)::int
            from products p
           where v.model_id is not null
             and p.model_ids @> array[v.model_id]
             and p.publicat = true
             and p.stoc > 0) as nr_piese
    from vehicles v;

alter view public.numar_piese_compatibile_pe_masina set (security_invoker = true);

comment on view public.numar_piese_compatibile_pe_masina is
  'Câte piese COMPATIBILE cu generația fiecărei mașini sunt publicate și pe stoc. Nu e provenienta: vezi numar_piese_pe_masina pentru piesele chiar demontate de pe mașină.';


-- ============================================================
-- VERIFICARE
--
-- Prima interogare: numărul de piese compatibile pe fiecare mașină publicată.
-- Mașinile fără marcă/model ies cu 0 — se completează din Admin → Mașini.
-- ============================================================
select v.nume,
       v.an,
       b.nume  as marca,
       m.nume  as model,
       n.nr_piese
  from vehicles v
  left join brands b on b.id = v.marca_id
  left join models m on m.id = v.model_id
  join numar_piese_compatibile_pe_masina n on n.vehicul_id = v.id
 where v.publicat = true
 order by n.nr_piese desc, v.nume;

-- A doua: coloana calculată există și are valori plauzibile (azi: medie 1,44,
-- maxim 31, 120 de piese fără nicio compatibilitate).
select min(nr_modele) as minim,
       round(avg(nr_modele), 2) as medie,
       max(nr_modele) as maxim,
       count(*) filter (where nr_modele = 0) as fara_compatibilitati
  from products;
