-- ============================================================
-- MIGRAREA 37 — publicarea pieselor pe dez.ro (api.dez.ro)
--
-- CE FACE, PE SCURT
-- dez.ro e un site de anunțuri de piese auto. Ne dau o cheie de aplicație
-- (API_KEY) și un cont de utilizator; noi le trimitem piesele din catalog ca
-- anunțuri, le ținem la zi prețul și descrierea, și le RETRAGEM când piesa se
-- vinde. Migrarea asta adaugă doar tabelele de care are nevoie legătura —
-- nu atinge `products`, `brands`, `models` sau `categories`.
--
-- DE CE PATRU TABELE ȘI NU UNA
--   `dezro_catalog`   — catalogul LOR (mărci, modele, categorii de piese), adus
--                       prin API și ținut local. Fără el n-am putea nici să
--                       potrivim, nici să arătăm operatorului din ce alege.
--   `dezro_mapari`    — puntea dintre catalogul nostru și al lor. Se completează
--                       automat, dar omul are ultimul cuvânt (`sursa = 'om'`).
--   `dezro_anunturi`  — ce piesă a devenit ce anunț, cu ce amprentă a plecat și
--                       ce poze i-am urcat. Fără rândul ăsta n-am ști niciodată
--                       ce trebuie actualizat și ce nu.
--   `dezro_jobs`      — starea unei sesiuni de publicare. 8.700 de anunțuri ×
--                       o pauză politicoasă nu încap într-o funcție de 60s, deci
--                       lucrul se face în loturi, iar poziția stă în bază.
--                       Exact tiparul de la `import_jobs` (migrarea 22).
--
-- DE CE NU SE ȘTERGE NIMIC NICIODATĂ
-- `dezro_anunturi` păstrează rândul și după retragerea anunțului
-- (`status = 'retras'`, `retras_la` completat). La ei ștergerea e „soft" și nu
-- există cale de restaurare prin API; dacă piesa reintră în stoc, se creează un
-- anunț NOU, iar `ad_id` se înlocuiește pe același rând. Deci ce rămâne pentru
-- totdeauna e că piesa A AVUT un anunț și când a fost retras — nu și lanțul
-- id-urilor. Dacă vreodată e nevoie și de el (o reclamație pe un anunț vechi),
-- se adaugă o coloană `istoric jsonb`; azi n-ar avea cine s-o citească.
--
-- CINE VEDE
-- Nimic din tabelele astea nu e public. Toate patru sunt citibile și scriibile
-- DOAR de echipă (`is_staff()`), la fel ca `import_jobs`. Rutele de server
-- lucrează cu cheia de service, deci trec oricum peste RLS; politicile există ca
-- panoul să poată citi din browser, cu sesiunea operatorului.
--
-- SECRETELE nu stau aici. Cheia API, utilizatorul, parola și token-ul de sesiune
-- stau în `settings.integrari.dezro`, ca parola FAN Courier și cheia Brevo —
-- rândul `integrari` nu e citibil public.
--
-- IDEMPOTENTĂ: se poate rula de câte ori vrei.
-- Se rulează în Supabase → SQL Editor.
-- ============================================================

-- ------------------------------------------------------------
-- 1. CATALOGUL LOR
--
-- Un singur tabel pentru toate cele trei feluri de noduri, fiindcă toate au
-- aceeași formă (id, nume, alias, părinte) și fiindcă un singur tabel se
-- reîmprospătează dintr-o singură sesiune de sincronizare.
--
-- `fel`:  marca | model | piesa
-- `tip`:  car | truck | tire  — al LOR, nu al nostru. Pe `X-MEDIUM: dezro` sunt
--         disponibile toate trei, dar noi folosim doar `car`; celelalte se aduc
--         oricum, ca să nu fie nevoie de altă migrare dacă mâine apar camioane.
-- `parinte`: pentru `model` = id-ul mărcii LOR; pentru `piesa` = id-ul categoriei
--         părinte, sau null la rădăcină.
-- `selectabil`: numai la `piesa`. 0 la ei înseamnă „categorie de grupare" — nu
--         se poate pune pe un anunț, trebuie coborât la un copil. Un anunț
--         trimis pe o categorie neselectabilă e refuzat.
--
-- Cheia primară e (fel, tip, dezro_id): id-urile lor se repetă între feluri
-- (marca 1 = Acura, piesa 1 = Elemente caroserie) și chiar între tipuri.
-- ------------------------------------------------------------
create table if not exists dezro_catalog (
  fel           text        not null check (fel in ('marca','model','piesa')),
  tip           text        not null check (tip in ('car','truck','tire')),
  dezro_id      integer     not null,
  nume          text        not null,
  alias         text,
  parinte       integer,
  selectabil    boolean,
  actualizat_la timestamptz not null default now(),
  primary key (fel, tip, dezro_id)
);

comment on table  dezro_catalog            is 'Catalogul dez.ro (mărci, modele, categorii), adus prin API. Se reîmprospătează din Admin → dez.ro.';
comment on column dezro_catalog.parinte    is 'La model = marca lor. La piesa = categoria-părinte (null la rădăcină).';
comment on column dezro_catalog.selectabil is 'Doar la piesa: false = categorie de grupare, nu se poate pune pe un anunț.';

create index if not exists dezro_catalog_parinte_idx on dezro_catalog (fel, tip, parinte);

-- ------------------------------------------------------------
-- 2. PUNTEA DINTRE CELE DOUĂ CATALOAGE
--
-- `fel`: marca | model | categorie — se referă la tabela NOASTRĂ (brands,
--        models, categories), iar `dezro_id` la nodul lor corespunzător.
--
-- `dezro_id` NULL are un înțeles precis: „s-a decis că nu are corespondent".
-- E diferit de „lipsește rândul", care înseamnă „încă nu s-a decis". Distincția
-- contează: potrivirea automată are voie să completeze un rând lipsă, dar NU
-- are voie să calce peste o decizie a omului (`sursa = 'om'`) — nici măcar peste
-- una negativă. Fără regula asta, fiecare resincronizare ar șterge munca de
-- verificare făcută cu mâna.
--
-- `scor` e cât de sigură a fost potrivirea automată (0–100). Rămâne scris și
-- după confirmarea omului, ca să se vadă în ecran de unde a pornit propunerea.
-- ------------------------------------------------------------
create table if not exists dezro_mapari (
  fel           text        not null check (fel in ('marca','model','categorie')),
  local_id      bigint      not null,
  dezro_id      integer,
  sursa         text        not null default 'auto' check (sursa in ('auto','om')),
  scor          smallint,
  nota          text,
  actualizat_la timestamptz not null default now(),
  actualizat_de text,
  primary key (fel, local_id)
);

comment on table  dezro_mapari          is 'Legătura dintre catalogul nostru și cel de pe dez.ro. Fără ea, o piesă nu se poate publica.';
comment on column dezro_mapari.dezro_id is 'NULL = s-a decis că nu are corespondent. Rând lipsă = încă nu s-a decis. Nu e același lucru.';
comment on column dezro_mapari.sursa    is 'auto = pusă de potrivirea automată; om = confirmată sau schimbată din panou. Automatul nu calcă peste om.';

-- ------------------------------------------------------------
-- 3. ANUNȚURILE
--
-- Un rând pe piesă. `amprenta` e rezumatul câmpurilor trimise (titlu,
-- descriere, ids, preț, cantitate…): dacă amprenta calculată acum e aceeași cu
-- cea salvată, piesa NU se retrimite. Fără ea, o resincronizare ar rescrie toate
-- cele 8.700 de anunțuri la fiecare rulare — ore de trafic pentru zero schimbări,
-- pe un API care ne-a răspuns deja cu 500 și 504.
--
-- Pozele se țin separat de amprentă, în două liste:
--   `poze_trimise` — adresele NOASTRE deja urcate la ei. Din diferența față de
--                    `products.poze` ies pozele de adăugat și cele de șters.
--   `poze_dezro`   — [{ id, url }] cum ni le-au întors ei. `id` e singurul mod
--                    de a șterge o poză anume (DELETE /ads/{ad}/image/{id}).
--
-- `status`:
--   nou     — rândul există, anunțul încă nu (piesă pregătită sau eșec la primul trimis)
--   activ   — anunțul e la ei
--   eroare  — ultima încercare a picat; `eroare` și `incercari` spun de ce și de câte ori
--   retras  — l-am șters la ei (piesa s-a vândut sau a fost depublicată)
-- ------------------------------------------------------------
create table if not exists dezro_anunturi (
  product_id    bigint      primary key references products(id) on delete cascade,
  ad_id         integer     unique,
  alias         text,
  url           text,
  aprobat       boolean,
  status        text        not null default 'nou' check (status in ('nou','activ','eroare','retras')),
  amprenta      text,
  poze_trimise  text[]      not null default '{}',
  poze_dezro    jsonb       not null default '[]'::jsonb,
  incercari     smallint    not null default 0,
  eroare        text,
  trimis_la     timestamptz,
  retras_la     timestamptz,
  actualizat_la timestamptz not null default now()
);

comment on table  dezro_anunturi              is 'Ce piesă a devenit ce anunț pe dez.ro. Rândul rămâne și după retragere — e singura dovadă că anunțul a existat.';
comment on column dezro_anunturi.amprenta     is 'Rezumatul câmpurilor trimise. Egal = nu se retrimite nimic.';
comment on column dezro_anunturi.poze_trimise is 'Adresele NOASTRE deja urcate la ei. Diferența față de products.poze dă ce e de adăugat și ce e de șters.';
comment on column dezro_anunturi.poze_dezro   is '[{id,url}] de la ei. id-ul e singurul mod de a șterge o poză anume.';

create index if not exists dezro_anunturi_status_idx on dezro_anunturi (status);

-- ------------------------------------------------------------
-- 4. SESIUNILE DE LUCRU
--
-- Aceeași formă și același motiv ca `import_jobs`: o funcție serverless trăiește
-- zeci de secunde, iar publicarea a 8.700 de anunțuri cu o pauză politicoasă
-- între ele ține ore. Browserul cere lot după lot; poziția și numărătorile stau
-- AICI, nu în pagină. Tabul închis nu pierde nimic.
--
-- `faza` există fiindcă lucrul are două părți care nu se pot amesteca:
--   publicare — se parcurg piesele eligibile, în ordinea id-ului
--   retragere — se parcurg anunțurile active ale pieselor care nu mai sunt eligibile
-- `pozitie` e ultimul id atins ÎN FAZA CURENTĂ. Se resetează la trecerea de fază.
--
-- DE CE POZIȚIE ȘI NU O COADĂ SALVATĂ
-- O listă de 8.700 de sarcini în `optiuni` ar fi ~180 KB citiți și rescriși la
-- fiecare lot, de vreo două mii de ori. Cu un cursor pe `products.id`, fiecare
-- lot întreabă baza doar despre feliuța lui — și, în plus, planul rămâne
-- adevărat dacă între timp o piesă se vinde sau se adaugă: coada salvată ar fi
-- rămas cu lumea de acum două ore.
-- ------------------------------------------------------------
create table if not exists dezro_jobs (
  id            bigint      generated always as identity primary key,
  actiune       text        not null default 'publicare' check (actiune in ('catalog','publicare')),
  status        text        not null default 'in_curs' check (status in ('in_curs','in_pauza','gata','oprit','eroare')),
  faza          text        not null default 'publicare' check (faza in ('catalog','publicare','retragere','gata')),
  pozitie       bigint      not null default 0,
  total         integer     not null default 0,
  procesate     integer     not null default 0,
  publicate     integer     not null default 0,
  actualizate   integer     not null default 0,
  neschimbate   integer     not null default 0,
  retrase       integer     not null default 0,
  poze_urcate   integer     not null default 0,
  nr_erori      integer     not null default 0,
  erori         jsonb       not null default '[]'::jsonb,
  jurnal        jsonb       not null default '[]'::jsonb,
  optiuni       jsonb       not null default '{}'::jsonb,
  mesaj         text,
  inceput_la    timestamptz not null default now(),
  actualizat_la timestamptz not null default now(),
  terminat_la   timestamptz
);

comment on column dezro_jobs.faza    is 'publicare = se parcurg piesele eligibile; retragere = se sting anunțurile pieselor care nu mai sunt.';
comment on column dezro_jobs.pozitie is 'Ultimul id atins în faza curentă. Se resetează la schimbarea fazei.';
comment on column dezro_jobs.optiuni is 'doar_id (o singură piesă), fara_retragere (bool), confirmat_prag (bool).';

-- Un singur job activ. Două taburi deschise ar trimite aceleași anunțuri de
-- două ori — iar la ei un anunț dublat nu se poate uni înapoi.
create unique index if not exists dezro_jobs_activ_uniq
  on dezro_jobs ((true))
  where status in ('in_curs', 'in_pauza');

-- ------------------------------------------------------------
-- 5. DREPTURILE
--
-- Nimic public. Aceleași drepturi ca `import_jobs`: echipa citește și scrie,
-- restul lumii nu vede tabelele deloc.
-- ------------------------------------------------------------
alter table dezro_catalog  enable row level security;
alter table dezro_mapari   enable row level security;
alter table dezro_anunturi enable row level security;
alter table dezro_jobs     enable row level security;

drop policy if exists "dezro catalog echipa"  on dezro_catalog;
create policy "dezro catalog echipa"  on dezro_catalog  for all using (is_staff()) with check (is_staff());

drop policy if exists "dezro mapari echipa"   on dezro_mapari;
create policy "dezro mapari echipa"   on dezro_mapari   for all using (is_staff()) with check (is_staff());

drop policy if exists "dezro anunturi echipa" on dezro_anunturi;
create policy "dezro anunturi echipa" on dezro_anunturi for all using (is_staff()) with check (is_staff());

drop policy if exists "dezro jobs echipa"     on dezro_jobs;
create policy "dezro jobs echipa"     on dezro_jobs     for all using (is_staff()) with check (is_staff());

-- ------------------------------------------------------------
-- 6. CÂTE PIESE SUNT ÎN FIECARE STARE — o singură trecere
--
-- Ecranul are nevoie de cifre („8.704 gata de publicat, 121 fără potrivire").
-- Calculate în Node ar însemna aducerea a 8.900 de rânduri prin rețea la fiecare
-- deschidere a paginii — exact greșeala reparată la 28 august 2026 (plafonul de
-- 1.000 de rânduri) și cea de la `categorii_cu_numar` (subinterogare corelată).
-- Aici se numără o dată, în bază, cu un `left join` pe fiecare mapare.
--
-- `security_invoker = on`: view-ul se supune politicilor celui care îl cheamă,
-- deci nu deschide nimic pe lângă RLS (vezi supabase/view-security-invoker.sql).
-- ------------------------------------------------------------
create or replace view dezro_stare_piese
with (security_invoker = on) as
with eligibile as (
  select p.id,
         p.model_ids[1]                                as model_local,
         coalesce(p.subcategorie_id, p.categorie_id)   as categorie_local,
         coalesce(array_length(p.poze, 1), 0)          as nr_poze
    from products p
   where p.publicat and p.stoc > 0
),
cu_mapari as (
  select e.*,
         mm.dezro_id as model_dezro,
         mc.dezro_id as categorie_dezro
    from eligibile e
    left join dezro_mapari mm on mm.fel = 'model'     and mm.local_id = e.model_local
    left join dezro_mapari mc on mc.fel = 'categorie' and mc.local_id = e.categorie_local
)
select
  count(*)                                                                          as eligibile,
  count(*) filter (where nr_poze = 0)                                               as fara_poza,
  count(*) filter (where model_local is null)                                        as fara_model,
  count(*) filter (where model_local is not null and model_dezro is null)            as model_nemapat,
  count(*) filter (where categorie_local is null)                                    as fara_categorie,
  count(*) filter (where categorie_local is not null and categorie_dezro is null)    as categorie_nemapata,
  count(*) filter (where nr_poze > 0 and model_dezro is not null and categorie_dezro is not null) as gata,
  (select count(*) from dezro_anunturi where status = 'activ')                       as anunturi_active,
  (select count(*) from dezro_anunturi where status = 'eroare')                      as anunturi_eroare,
  (select count(*) from dezro_anunturi where status = 'retras')                      as anunturi_retrase
from cu_mapari;

comment on view dezro_stare_piese is 'Cifrele ecranului Admin → dez.ro, numărate o singură dată în bază.';

revoke all on dezro_stare_piese from anon;

-- ------------------------------------------------------------
-- 6b. CÂTE ANUNȚURI AR FI RETRASE
--
-- Plasa anti-accident, geamăna lui `PRAG_DEPUBLICARE` de la import. Înainte de
-- faza de retragere se compară cifrele astea două: dacă ar dispărea peste 20%
-- din anunțurile active, motorul se oprește și cere confirmare separată.
--
-- Motivul e mai greu decât la import: la ei ștergerea unui anunț NU se poate
-- desface prin API. O depublicare în masă făcută din greșeală la noi (sau o
-- citire incompletă) ar stinge tot ce avem acolo, iar refacerea ar însemna
-- 8.700 de anunțuri noi, cu alte adrese, fără istoricul lor.
-- ------------------------------------------------------------
create or replace view dezro_de_retras
with (security_invoker = on) as
select
  (select count(*) from dezro_anunturi where status = 'activ') as active,
  count(*) as de_retras
from dezro_anunturi a
left join products p on p.id = a.product_id and p.publicat and p.stoc > 0
where a.status = 'activ' and p.id is null;

comment on view dezro_de_retras is 'Câte anunțuri active nu mai au piesă eligibilă. Se compară cu „active" înainte de faza de retragere.';

revoke all on dezro_de_retras from anon;

-- ------------------------------------------------------------
-- 7. VERIFICARE
-- ------------------------------------------------------------
-- a) cele patru tabele există
select table_name from information_schema.tables
 where table_schema = 'public'
   and table_name in ('dezro_catalog','dezro_mapari','dezro_anunturi','dezro_jobs')
 order by table_name;

-- b) toate patru au RLS pornit
select relname, relrowsecurity from pg_class
 where relname in ('dezro_catalog','dezro_mapari','dezro_anunturi','dezro_jobs')
 order by relname;

-- c) view-ul răspunde (pe o bază fără mapări, „gata" trebuie să fie 0)
select * from dezro_stare_piese;
