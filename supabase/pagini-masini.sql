-- ============================================================
-- AUTOPAS — PAGINI DE MAȘINĂ DEZMEMBRATĂ (rulează AL DOUĂZECI ȘI OPTULEA)
-- Supabase → SQL Editor → New query → lipește tot → Run
-- IDEMPOTENTĂ: se poate re-rula oricând.
--
-- CE ADAUGĂ
-- `vehicles` avea 9 coloane și era doar o fișă internă de amortizare: nume, an,
-- cost, status. Ca să devină pagină publică îi trebuie poze, descriere, un
-- comutator de publicare și specificațiile pe care le caută un client.
--
-- CE NU ADAUGĂ, INTENȚIONAT
-- Nicio legătură piesă → mașină nu se completează aici. Coloana
-- `products.vehicul_id` există din `schema.sql` și e goală pe toate cele 8.754
-- de piese importate, fiindcă feed-ul pieseauto.ro nu spune NICIODATĂ de pe ce
-- mașină s-a demontat piesa: CSV-ul are ID, URL, Titlu, Monedă, Preț, iar pagina
-- scrie „compatibilă cu", adică potrivire, nu proveniență.
--
-- Deducerea din titlu a fost măsurată pe 28 august 2026 și respinsă: la mașina
-- „VW Golf 6 1.6 TDI", 36 din 67 de potriviri erau piese de Golf 7, fiindcă „6"
-- se regăsește în „1.6". Două Passat B6 2.0 TDI din curte (aici chiar sunt două,
-- BMP și BMR) ar fi oricum indistingibile din titlu.
--
-- Deci legătura se pune de om, la listare, din câmpul „Mașina-sursă" care există
-- deja în editorul de produs. Piesele importate rămân nelegate (decizie a
-- proprietarului, 28 august 2026).
-- ============================================================


-- ============================================================
-- 1. COLOANELE NOI PE `vehicles`
--
-- `slug` există deja și e `unique` din `schema.sql` — nu se atinge.
-- `an` există deja. Restul sunt noi.
-- ============================================================
alter table vehicles add column if not exists poze          text[] not null default '{}';
alter table vehicles add column if not exists descriere     text;
alter table vehicles add column if not exists publicat      boolean not null default true;
alter table vehicles add column if not exists motorizare    text;
alter table vehicles add column if not exists caroserie     text;
alter table vehicles add column if not exists culoare       text;
alter table vehicles add column if not exists cutie_viteze  text;
alter table vehicles add column if not exists km            integer;

-- Marca și modelul ca DATE, nu ca text în `nume` (decizie 28 august 2026).
-- Fără ele, „piese de la mașini compatibile" n-are de unde ști ce mașini sunt
-- înrudite: `nume` e text liber scris de operator („VW Golf 6 1.6 TDI"), iar
-- comparat cu el însuși ar lega „Golf 6" de „Golf 60" la fel de bine.
-- Rămân NULL pe cele 22 de rânduri existente; se completează din admin, unde
-- mașinile fără marcă sunt marcate cu „⚠ fără marcă". NU se ghicesc aici:
-- vezi mai sus de ce nu ne încredem în potrivirea pe text.
alter table vehicles add column if not exists marca_id  bigint references brands(id) on delete set null;
alter table vehicles add column if not exists model_id  bigint references models(id) on delete set null;

create index if not exists vehicles_marca_idx    on vehicles (marca_id);
create index if not exists vehicles_model_idx    on vehicles (model_id);
create index if not exists vehicles_publicat_idx on vehicles (publicat);


-- ============================================================
-- 2. CITIREA PUBLICĂ RESPECTĂ `publicat`
--
-- Politica veche era `using (true)`: oricine citea orice mașină. Acum o mașină
-- nepublicată trebuie să dea 404, iar 404-ul nu se poate garanta din cod dacă
-- baza o servește oricum — cine cere direct prin REST ar primi-o.
--
-- Aceeași formă ca la `products` după migrarea 23. Cele 22 de rânduri existente
-- au `publicat = true` din `default`, deci nu dispare nimic.
-- ============================================================
drop policy if exists "vehicule publice" on vehicles;
create policy "vehicule publice" on vehicles for select
  using (publicat = true or is_staff());


-- ============================================================
-- 3. CE A IEȘIT
-- ============================================================
select column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public' and table_name = 'vehicles'
 order by ordinal_position;
