-- ============================================================
-- MIGRAREA 19 — greutate estimată vs. greutate cântărită
--
-- Piesele importate din pieseauto.ro nu au greutate: sursa n-o publică nicăieri
-- (verificat la analiza paginii de produs și pe ambele eșantioane). Ca importul
-- să nu blocheze publicarea, fiecare piesă fără greutate primește 1 kg — dar
-- atunci `greutate_estimata` devine `true`, ca să nu confundăm niciodată o
-- valoare presupusă cu una cântărită.
--
-- Cine citește `greutate_kg` fără să se uite și la steagul ăsta poate genera un
-- AWB cu greutate greșită, iar diferența o plătește firma la curier.
--
-- IDEMPOTENT: `add column if not exists`.
-- Se rulează în Supabase → SQL Editor.
-- ============================================================

alter table products add column if not exists greutate_estimata boolean not null default false;

comment on column products.greutate_estimata is
  'true = greutatea din `greutate_kg` e presupusă (1 kg pus automat la import), nu cântărită. Devine false când operatorul salvează o greutate reală din formularul de produs. Detaliul comenzii avertizează vizibil dacă vreo piesă din comandă o are pe true.';

-- Piesele existente au greutăți introduse de om, deci rămân pe `false`
-- (valoarea implicită). Nu se atinge niciun rând existent.

-- ---------- Verificare ----------
select column_name, data_type, column_default, is_nullable
  from information_schema.columns
 where table_name = 'products' and column_name = 'greutate_estimata';

select count(*) filter (where greutate_estimata) as cu_greutate_estimata,
       count(*) filter (where not greutate_estimata) as cu_greutate_reala,
       count(*) as total
  from products;
