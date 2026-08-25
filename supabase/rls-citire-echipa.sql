-- ============================================================
-- MIGRAREA 23 — echipa poate CITI ce are voie să scrie
--
-- CE S-A GĂSIT (25 august 2026, la auditul panoului de administrare)
-- Două tabele lasă `operator` să scrie, dar nu să citească:
--
--   products               scriere: is_staff()   citire: publicat = true OR is_admin()
--   part_requests          scriere: is_staff()   citire: is_admin()
--   car_intake_requests    scriere: is_staff()   citire: is_admin()
--   return_requests        scriere: is_staff()   citire: is_admin()
--   contact_messages       scriere: is_staff()   citire: is_admin()
--
-- Consecințe reale, nu teoretice:
--   · un operator NU vede piesele nepublicate în /admin/produse — adică exact
--     piesele la care are de lucru;
--   · un operator NU vede niciun rând în /admin/cereri, deși meniul îi dă acces
--     la modul și deși are voie să schimbe statusul cererilor;
--   · verificarea nouă `scrieVerificat()` din lib/supabase.ts cere înapoi rândul
--     atins, iar rândul acela trece prin politica de CITIRE. Fără migrarea asta,
--     o depublicare făcută de un operator ar reuși în bază, dar interfața ar
--     spune că n-a mers — fix greșeala inversă față de cea reparată acum.
--
-- Nu se lărgește nimic către public: `is_staff()` înseamnă tot admin, operator
-- sau contabil, adică exact cine avea deja drept de scriere pe aceleași rânduri.
-- Politicile de SCRIERE nu se ating.
--
-- IDEMPOTENTĂ: `drop policy if exists` înainte de fiecare `create policy`.
-- Se rulează în Supabase → SQL Editor.
-- ============================================================

-- ---------- 1. Produse: echipa vede și piesele nepublicate ----------
drop policy if exists "produse publice" on products;
create policy "produse publice" on products for select
  using (publicat = true or is_staff());

-- ---------- 2. Inboxul de cereri: echipa vede ce are de rezolvat ----------
drop policy if exists "cereri admin" on part_requests;
drop policy if exists "cereri staff citire" on part_requests;
create policy "cereri staff citire" on part_requests for select using (is_staff());

drop policy if exists "predare admin" on car_intake_requests;
drop policy if exists "predare staff citire" on car_intake_requests;
create policy "predare staff citire" on car_intake_requests for select using (is_staff());

drop policy if exists "retur admin" on return_requests;
drop policy if exists "retur staff citire" on return_requests;
create policy "retur staff citire" on return_requests for select using (is_staff());

drop policy if exists "contact admin" on contact_messages;
drop policy if exists "contact staff citire" on contact_messages;
create policy "contact staff citire" on contact_messages for select using (is_staff());

-- ---------- 3. Verificare ----------
-- Toate cele cinci trebuie să apară acum cu `is_staff()` în condiția de citire.
select tablename, policyname, qual::text as conditie_citire
  from pg_policies
 where cmd = 'SELECT'
   and tablename in ('products','part_requests','car_intake_requests','return_requests','contact_messages')
 order by tablename;
