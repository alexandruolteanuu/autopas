-- ============================================================
-- AUTOPAS — ANII GENERAȚIEI CA DATE, NU CA TEXT ÎN NUME (rulează AL DOUĂZECI ȘI PATRULEA)
-- Supabase → SQL Editor → New query → lipește tot → Run
-- IDEMPOTENTĂ: se poate re-rula oricând.
--
-- DE CE:
-- Dezambiguizarea generației la import (`potriveste` din lib/import/potrivire.mjs)
-- citea intervalul de ani din NUMELE modelului, cu regexul „(2007–2014)".
-- Doar 69 din 345 de modele au anii scriși în nume, iar formatul lor e amestecat:
--   „Fabia 2 (2007–2014)"      — paranteză, linie de dialog
--   „XC 60 (2017 -2024)"       — paranteză, cratimă lipită
--   „Crafter 2E 2006 -2017"    — fără paranteză deloc
--   „XC 40 (2017 +)"           — încă în producție, fără an final
-- Un model fără interval era ELIMINAT tăcut din dezambiguizare. De aceea
-- „Skoda Fabia" (40 de piese) rămânea fără model: candidații erau „Fabia 2
-- (2007–2014)" și „Fabia 3", iar al doilea, neavând ani în nume, nu putea fi
-- ales NICIODATĂ — nici măcar când anii din titlu erau limpede ai lui.
--
-- Anii devin două coloane. Numele rămâne cum e, pentru afișare.
-- ============================================================

alter table models add column if not exists an_start int;
alter table models add column if not exists an_final int;

comment on column models.an_start is
  'Primul an de fabricație al generației. Sursa adevărului pentru dezambiguizarea la import.';
comment on column models.an_final is
  'Ultimul an de fabricație. NULL = model încă în producție (ex. „XC 40 (2017 +)").';

-- ---------- populare din numele existente ----------
-- Se completează DOAR unde e gol, ca o valoare pusă cu mâna de operator să nu fie
-- suprascrisă la o re-rulare.
--
-- ATENȚIE la Peugeot: „2008", „3008", „5008", „308", „508" sunt NUME de modele,
-- nu ani. De aceea nu se caută niciodată un an singur, ci numai un interval
-- („2006–2014") sau o formă deschisă („2026 +"). Peugeot 2008 nu se potrivește
-- cu niciuna din cele două, deci rămâne necompletat — corect.

-- 1. interval închis: două numere de 4 cifre legate prin cratimă sau linie
update models set
  an_start = (regexp_match(nume, '(\d{4})\s*[–—-]\s*(\d{4})'))[1]::int,
  an_final = (regexp_match(nume, '(\d{4})\s*[–—-]\s*(\d{4})'))[2]::int
where an_start is null and an_final is null
  and nume ~ '(\d{4})\s*[–—-]\s*(\d{4})';

-- 2. formă deschisă: „(2017 +)" sau „2026 +" — model încă în producție
update models set
  an_start = (regexp_match(nume, '(\d{4})\s*\+'))[1]::int
where an_start is null and an_final is null
  and nume ~ '(\d{4})\s*\+';

-- ---------- plasă de siguranță ----------
-- Anii aiurea („1899", „3000") ar strica dezambiguizarea mai rău decât lipsa lor.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'models_ani_valizi') then
    alter table models add constraint models_ani_valizi check (
      (an_start is null or an_start between 1950 and 2100)
      and (an_final is null or an_final between 1950 and 2100)
      and (an_start is null or an_final is null or an_final >= an_start)
    );
  end if;
end $$;

-- ---------- două modele așezate la marca greșită ----------
-- Găsite la 28 august 2026, amândouă cu ZERO piese legate, deci mutarea e fără risc:
-- „MG 3" și „XC 40 (2017 +)" au fost create sub Volkswagen (se vede și în slug).
update models set brand_id = (select id from brands where slug = 'mg'), slug = 'mg-mg-3'
where slug = 'vw-mg-3' and exists (select 1 from brands where slug = 'mg');

update models set brand_id = (select id from brands where slug = 'volvo'), slug = 'volvo-xc-40-2017'
where slug = 'vw-xc-40-2017' and exists (select 1 from brands where slug = 'volvo');

-- ---------- ce a ieșit ----------
select count(*) as modele,
       count(an_start) as cu_an_start,
       count(*) - count(an_start) as ramase_de_completat_manual
from models;
