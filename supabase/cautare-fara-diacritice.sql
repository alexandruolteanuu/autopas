-- ============================================================
-- CĂUTAREA PIESELOR FĂRĂ DIACRITICE
--
-- Problema: căutarea folosea `ilike` direct pe `nume`, deci „turbina" nu
-- găsea „Turbină Garrett", iar „skoda" nu găsea „Škoda Octavia". Aproape
-- nimeni nu scrie cu diacritice când caută o piesă, așa că majoritatea
-- căutărilor întorceau zero rezultate.
--
-- Soluția: o coloană calculată automat (`cautare`) care ține numele, codul OEM
-- și codul intern într-o formă normalizată — litere mici, fără diacritice.
-- Aplicația normalizează la fel textul tastat de client (lib/format.ts,
-- funcția textCautare) și compară cele două forme.
--
-- Folosim `unaccent`, care acoperă și diacriticele care nu sunt românești
-- dar apar în mărci (Škoda, Citroën). `unaccent` nu e marcat IMMUTABLE și n-ar
-- putea intra direct într-o coloană generată, dar forma cu dicționar explicit
-- (`unaccent('unaccent'::regdictionary, …)`) este stabilă, așa că o împachetăm
-- într-o funcție proprie declarată immutable.
--
-- Idempotent: se poate re-rula oricând.
-- ============================================================

create extension if not exists unaccent with schema extensions;

-- 1. Funcția de normalizare. Trebuie să dea același rezultat ca textCautare
--    din lib/format.ts — dacă modifici una, modific-o și pe cealaltă.
create or replace function public.text_cautare(t text) returns text
language sql immutable parallel safe as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, '')))
$$;

comment on function public.text_cautare(text) is
  'Text normalizat pentru căutare: litere mici, fără diacritice.';

-- 2. Coloana calculată — se actualizează singură la fiecare insert/update,
--    deci nu rămâne niciodată în urmă față de nume.
alter table products
  add column if not exists cautare text
  generated always as (
    public.text_cautare(
      coalesce(nume, '') || ' ' || coalesce(oem, '') || ' ' || coalesce(cod_intern, '')
    )
  ) stored;

-- Dacă rulezi fișierul a doua oară după ce ai schimbat funcția de normalizare,
-- linia asta recalculează valorile deja salvate (PostgreSQL 17+). Fără ea,
-- rândurile vechi ar rămâne cu forma calculată la momentul adăugării coloanei.
alter table products
  alter column cautare set expression as (
    public.text_cautare(
      coalesce(nume, '') || ' ' || coalesce(oem, '') || ' ' || coalesce(cod_intern, '')
    )
  );

comment on column products.cautare is
  'Nume + OEM + cod intern, fără diacritice. Se completează automat.';

-- 3. Index pentru căutarea cu „conține" (%text%). pg_trgm e disponibil pe
--    Supabase; dacă lipsește, căutarea merge oricum, doar mai încet.
do $$
begin
  create extension if not exists pg_trgm with schema extensions;
  execute 'create index if not exists products_cautare_idx
             on products using gin (cautare extensions.gin_trgm_ops)';
exception when others then
  raise notice 'pg_trgm indisponibil — căutarea merge fără index: %', sqlerrm;
end $$;
