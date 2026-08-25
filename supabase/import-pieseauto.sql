-- ============================================================
-- MIGRAREA 17 — import de produse din feed-ul pieseauto.ro
--
-- Adaugă pe `products` coloanele de proveniență și creează tabela `import_jobs`,
-- care ține evidența rulărilor de import.
--
-- IDEMPOTENT: se poate rula de câte ori vrei. Toate instrucțiunile folosesc
-- `if not exists` / `drop ... if exists`, deci a doua rulare nu schimbă nimic.
--
-- NU scrie niciun produs. Doar pregătește structura.
-- Se rulează în Supabase → SQL Editor.
--
-- ────────────────────────────────────────────────────────────
-- DE CITIT ÎNAINTE: unde se duce descrierea
--
-- `products` NU are coloană `descriere` și nu i se adaugă una aici. Textul
-- descriptiv al unei piese se ține deja în `stare_nota`, care e câmpul afișat
-- în Admin → Produse sub eticheta „Descriere" (vezi components/admin/ProductForm.tsx,
-- unde textarea „descriere" salvează în `stare_nota`). O coloană nouă ar fi însemnat
-- două locuri pentru același lucru și un formular care le arată pe rând.
-- Deci: descrierea de pe pieseauto.ro intră în `stare_nota`.
--
-- Tot așa, prețul stă în `pret_lei`, nu în `pret`, iar titlul în `nume`.
-- ────────────────────────────────────────────────────────────
-- ============================================================

-- ---------- 1. Proveniența, pe `products` ----------
alter table products add column if not exists sursa                text;
alter table products add column if not exists sursa_id             text;
alter table products add column if not exists sursa_url            text;
alter table products add column if not exists sursa_sincronizat_la timestamptz;
alter table products add column if not exists sursa_activ          boolean not null default true;
alter table products add column if not exists poze_sursa           text[]  not null default '{}';
alter table products add column if not exists poze_descarcate      boolean not null default false;
alter table products add column if not exists editat_manual        boolean not null default false;
alter table products add column if not exists import_erori         jsonb;

comment on column products.sursa                is 'De unde vine piesa: ''pieseauto.ro''. NULL = introdusă manual.';
comment on column products.sursa_id             is 'ID-ul din feed. Cheia de potrivire la re-import — stabilă, spre deosebire de URL.';
comment on column products.sursa_url            is 'URL-ul canonic final, după redirect (conține categoria, marca și modelul).';
comment on column products.sursa_sincronizat_la is 'Ultima dată când importul a atins rândul.';
comment on column products.sursa_activ          is 'false = a dispărut din feed. Piesa NU se șterge: poate avea comenzi în istoric.';
comment on column products.poze_sursa           is 'URL-urile originale de pe sursă, înainte de descărcare. NU se servesc niciodată public.';
comment on column products.poze_descarcate      is 'true după ce pozele au fost aduse în bucketul propriu și scrise în `poze`.';
comment on column products.editat_manual        is 'true la orice salvare din formularul de admin. Blochează suprascrierea titlului la re-import.';
comment on column products.import_erori         is 'Ce n-a putut fi extras sau potrivit, ca să apară în ecranul „Piese de completat".';

-- Cheia de potrivire la re-import. Parțial, fiindcă produsele introduse manual
-- au `sursa` și `sursa_id` NULL și n-au ce căuta în constrângere.
create unique index if not exists products_sursa_uniq
  on products (sursa, sursa_id)
  where sursa is not null and sursa_id is not null;

-- Ecranul „Piese de completat": piesele importate, încă nepublicate.
create index if not exists products_de_completat
  on products (sursa, publicat)
  where sursa is not null and publicat = false;

-- ---------- 2. Evidența rulărilor de import ----------
create table if not exists import_jobs (
  id           bigint generated always as identity primary key,
  status       text        not null default 'in_curs',
  total        integer     not null default 0,
  procesate    integer     not null default 0,
  noi          integer     not null default 0,
  actualizate  integer     not null default 0,
  disparute    integer     not null default 0,
  erori        jsonb       not null default '[]'::jsonb,
  inceput_la   timestamptz not null default now(),
  terminat_la  timestamptz
);

comment on table import_jobs is 'Câte o linie per rulare a scriptului de import. Sursa adevărului pentru bara de progres și raportul final.';

alter table import_jobs
  drop constraint if exists import_jobs_status_check;
alter table import_jobs
  add constraint import_jobs_status_check
  check (status in ('in_curs', 'gata', 'oprit', 'eroare'));

-- ---------- 3. RLS: numai echipa vede și scrie ----------
-- Ca peste tot în proiect: fără politică de insert pentru `anon`, iar drepturile
-- se verifică prin `is_staff()`, care citește rolul din `profiles`.
alter table import_jobs enable row level security;

drop policy if exists "import_jobs echipa select" on import_jobs;
create policy "import_jobs echipa select" on import_jobs
  for select using (is_staff());

drop policy if exists "import_jobs echipa insert" on import_jobs;
create policy "import_jobs echipa insert" on import_jobs
  for insert with check (is_staff());

drop policy if exists "import_jobs echipa update" on import_jobs;
create policy "import_jobs echipa update" on import_jobs
  for update using (is_staff()) with check (is_staff());

-- ---------- 4. Verificare ----------
-- Trebuie să întoarcă cele 9 coloane noi și tabela `import_jobs` goală.
select column_name
  from information_schema.columns
 where table_name = 'products'
   and column_name in ('sursa','sursa_id','sursa_url','sursa_sincronizat_la',
                       'sursa_activ','poze_sursa','poze_descarcate','editat_manual','import_erori')
 order by column_name;

select count(*) as randuri_import_jobs from import_jobs;
