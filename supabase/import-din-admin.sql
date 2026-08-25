-- ============================================================
-- MIGRAREA 22 — importul complet, pornit din panoul de administrare
--
-- CE SCHIMBĂ, PE SCURT
--   1. `import_jobs` primește tot ce trebuie ca un import de 4,5 ore să poată fi
--      întrerupt și reluat: poziția, fișierul CSV, numărătorile, jurnalul.
--   2. Se creează bucketul PRIVAT `import-csv`, unde stă feed-ul fiecărui job.
--      Fără el, un import întrerupt n-ar putea fi reluat fără reîncărcarea
--      fișierului din browser.
--   3. Se ELIMINĂ triggerul care interzicea publicarea unei piese importate fără
--      poze și fără categorie (migrarea 21). Regula nouă: piesa importată se
--      publică direct, cu ce are; ce-i lipsește se completează după aceea, din
--      ecranul „Piese de completat".
--
-- DE CE SE ELIMINĂ INTERDICȚIA
-- Interdicția a fost scrisă când publicarea era un pas separat, făcut de om, iar
-- pozele se descărcau abia atunci. Acum pozele se aduc în timpul importului, deci
-- o piesă fără poze înseamnă că descărcarea a eșuat — nu că cineva a fost neatent.
-- Un trigger care ar refuza rândul ar bloca importul întreg pentru o poză căzută.
-- Piesa intră pe site, iar motivul rămâne scris în `import_erori`, de unde îl ia
-- butonul „Reia pozele eșuate".
--
-- IDEMPOTENTĂ: se poate rula de câte ori vrei.
-- Se rulează în Supabase → SQL Editor.
-- ============================================================

-- ---------- 1. `import_jobs`, extinsă ----------
alter table import_jobs add column if not exists sursa           text        not null default 'pieseauto.ro';
alter table import_jobs add column if not exists neschimbate     integer     not null default 0;
alter table import_jobs add column if not exists pagini          integer     not null default 0;
alter table import_jobs add column if not exists poze_salvate    integer     not null default 0;
alter table import_jobs add column if not exists octeti_poze     bigint      not null default 0;
alter table import_jobs add column if not exists nr_erori        integer     not null default 0;
alter table import_jobs add column if not exists canar_total     integer     not null default 0;
alter table import_jobs add column if not exists canar_fara_poze integer     not null default 0;
alter table import_jobs add column if not exists categorii_sursa jsonb       not null default '{}'::jsonb;
alter table import_jobs add column if not exists jurnal          jsonb       not null default '[]'::jsonb;
alter table import_jobs add column if not exists optiuni         jsonb       not null default '{}'::jsonb;
alter table import_jobs add column if not exists cale_csv        text;
alter table import_jobs add column if not exists nume_fisier     text;
alter table import_jobs add column if not exists mesaj           text;
alter table import_jobs add column if not exists actualizat_la   timestamptz not null default now();

comment on column import_jobs.sursa           is 'De unde vine feed-ul. Un singur job activ per sursă.';
comment on column import_jobs.procesate       is 'Câte rânduri din CSV s-au parcurs. E ȘI poziția de reluare: lotul următor începe de aici.';
comment on column import_jobs.cale_csv        is 'Fișierul din bucketul privat `import-csv`. Fără el, un job întrerupt nu se poate relua.';
comment on column import_jobs.octeti_poze     is 'Cât s-a urcat în Storage la jobul ăsta, în octeți. Raportat la fiecare 1.000 de piese.';
comment on column import_jobs.canar_total     is 'Câte pagini s-au citit în fereastra curentă a canarului (se resetează la fiecare 50).';
comment on column import_jobs.canar_fara_poze is 'Câte dintre ele n-au dat nicio poză. Peste 20% => importul se oprește singur.';
comment on column import_jobs.categorii_sursa is 'Câte piese pe fiecare categorie-sursă. Din ea se decide ce subcategorii merită create.';
comment on column import_jobs.jurnal          is 'Linii de raport, în ordine: pornire, praguri de 1.000, oprire, încheiere.';
comment on column import_jobs.optiuni         is 'depublica (bool), confirmatTrunchiat (bool), doar_ids (listă, la reluarea eșuărilor).';

-- Statusul primește `in_pauza`: tabul închis sau butonul „Oprește" nu înseamnă
-- nici „gata", nici „eroare" — jobul așteaptă să fie continuat.
alter table import_jobs drop constraint if exists import_jobs_status_check;
alter table import_jobs
  add constraint import_jobs_status_check
  check (status in ('in_curs', 'in_pauza', 'gata', 'oprit', 'eroare'));

-- Un singur job activ per sursă (A.1.5). Două taburi deschise ar procesa
-- aceleași rânduri în paralel și ar lovi sursa de două ori mai des.
create unique index if not exists import_jobs_activ_uniq
  on import_jobs (sursa)
  where status in ('in_curs', 'in_pauza');

-- ---------- 2. Bucketul privat pentru fișierele CSV ----------
insert into storage.buckets (id, name, public)
values ('import-csv', 'import-csv', false)
on conflict (id) do nothing;

-- Fișierele se scriu și se citesc EXCLUSIV din rutele de server, cu cheia de
-- service, care ocolește RLS. Nu se adaugă nicio politică pentru `anon` sau
-- `authenticated`: un feed cu 8.000 de URL-uri n-are ce căuta în browser.
-- Politicile vechi, dacă a rulat cineva o variantă anterioară, se curăță:
drop policy if exists "import-csv echipa" on storage.objects;

-- ---------- 3. Piesele importate se publică direct ----------
-- Triggerul din migrarea 21 refuza `publicat = true` fără poze și fără categorie.
-- Regula s-a schimbat (vezi antetul), deci triggerul și funcția lui dispar.
drop trigger if exists tr_verifica_publicarea on products;
drop function if exists public.verifica_publicarea();

-- `anuleaza_comanda` republica piesele condiționat, ca să nu cadă în triggerul
-- de mai sus. Fără trigger, condiția n-are rost: revine la republicarea simplă.
create or replace function public.anuleaza_comanda(oid bigint)
returns void language plpgsql security definer as $$
begin
  if not is_staff() then raise exception 'Doar echipa poate anula comenzi.'; end if;
  if (select status from orders where id = oid) = 'anulata' then return; end if;

  update products p
     set stoc = p.stoc + i.cantitate,
         publicat = true
    from order_items i
   where i.order_id = oid and i.product_id = p.id;

  update orders set status = 'anulata' where id = oid;
  insert into order_events(order_id, tip, mesaj, autor)
  values (oid, 'anulare', 'Comandă anulată — piesele au fost republicate pe site',
          coalesce(auth.jwt()->>'email', 'sistem'));
end; $$;

revoke execute on function public.anuleaza_comanda(bigint) from public;
grant execute on function public.anuleaza_comanda(bigint) to authenticated;

-- ---------- 4. Indexul ecranului „Piese de completat" ----------
-- Ecranul nu mai caută piese nepublicate, ci piese PUBLICATE cărora le lipsește
-- ceva. Indexul vechi (sursa, publicat) where publicat = false nu mai ajută.
drop index if exists products_de_completat;
create index if not exists products_de_completat
  on products (sursa, publicat)
  where sursa is not null;

-- ---------- 5. Verificare ----------
-- a) coloanele noi există
select column_name from information_schema.columns
 where table_name = 'import_jobs'
   and column_name in ('sursa','cale_csv','octeti_poze','jurnal','optiuni','actualizat_la','canar_total')
 order by column_name;

-- b) bucketul privat există și NU e public
select id, public from storage.buckets where id = 'import-csv';

-- c) triggerul de publicare a dispărut — trebuie să întoarcă 0 rânduri
select tgname from pg_trigger
 where tgrelid = 'products'::regclass and tgname = 'tr_verifica_publicarea';
