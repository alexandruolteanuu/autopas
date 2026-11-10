-- ============================================================
-- ANULAREA MIGRĂRII 49 (supabase/saga-facturi.sql) — DOAR LA NEVOIE
--
-- Scoate exact ce a creat migrarea 49: cele 4 tabele (facturi, facturi_linii,
-- facturi_serii, facturi_serii_istoric) cu triggerele, politicile și indexurile
-- lor, și funcțiile is_facturare, seteaza_serie_factura, emite_factura,
-- retrage_factura, facturi_pazeste, facturi_linii_pazeste.
-- Nu atinge migrările 47–48 și nicio comandă.
--
-- GARDĂ: dacă în `facturi` există MĂCAR UN rând, se OPREȘTE — ar însemna să
-- ștergi documente fiscale. Atunci anularea nu mai e soluția.
-- Fără `cascade`: dacă un pas ulterior depinde de aceste obiecte, se oprește.
--
-- Rulare: Supabase → SQL Editor → lipești tot → Run. O singură tranzacție.
-- ============================================================

begin;

do $$
begin
  if to_regclass('public.facturi') is not null and exists (select 1 from public.facturi) then
    raise exception 'OPRIT: există facturi emise în tabela facturi. Anularea migrării 49 le-ar șterge — nu se face.';
  end if;
end $$;

drop function if exists public.emite_factura(bigint);
drop function if exists public.retrage_factura(bigint);
drop function if exists public.seteaza_serie_factura(text, int);
drop table    if exists public.facturi_linii;
drop table    if exists public.facturi;
drop table    if exists public.facturi_serii_istoric;
drop table    if exists public.facturi_serii;
drop function if exists public.facturi_pazeste();
drop function if exists public.facturi_linii_pazeste();
drop function if exists public.is_facturare();

commit;

-- Verificare: trebuie să întoarcă 0 rânduri.
select 'încă există: ' || x as ramas from (
  select p.proname::text as x from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('is_facturare', 'seteaza_serie_factura', 'emite_factura', 'retrage_factura',
                       'facturi_pazeste', 'facturi_linii_pazeste')
  union all
  select c.relname::text from pg_class c
   where c.relnamespace = 'public'::regnamespace
     and c.relname in ('facturi', 'facturi_linii', 'facturi_serii', 'facturi_serii_istoric')
) t;
