-- ============================================================
-- MIGRAREA 39 — dez.ro se actualizează SINGUR, la fiecare schimbare de piesă
--
-- CE REZOLVĂ
-- Până acum publicarea pe dez.ro pornea doar cu mâna: butonul „Pornește
-- publicarea" din Admin → Anunțuri dez.ro, sau scriptul din terminal. Între două
-- apăsări, o piesă nouă nu ajungea la ei, iar una VÂNDUTĂ rămânea la vedere.
-- Al doilea caz e cel scump: piesele noastre sunt unicat, deci un anunț rămas în
-- aer înseamnă un telefon degeaba și un cumpărător supărat. La a treia oară,
-- oamenii nu mai sună.
--
-- CUM
-- Aceeași formă ca la e-mailurile automate (migrarea 36), și din același motiv:
-- baza de date e singurul loc care ȘTIE SIGUR că s-a schimbat ceva. Un trigger
-- scrie piesa într-o coadă, în ACEEAȘI tranzacție cu modificarea, apoi trezește
-- ruta `/api/dezro-coada`. Dacă trezirea nu ajunge (deploy în curs, rețea
-- căzută), rândul rămâne în coadă și pleacă la următoarea trezire sau de la
-- butonul din panou. Ce se poate întâmpla mai rău e o întârziere, niciodată o
-- pierdere.
--
-- CELE TREI REGULI ÎNVĂȚATE LA MIGRAREA 36, respectate aici de la început:
--   1. Fiecare efect care trebuie să supraviețuiască singur stă în BLOCUL LUI.
--      Un `exception when others` nu protejează ce e ÎNAINTE de el în același
--      bloc — îl aruncă odată cu excepția.
--   2. pg_net își face schema proprie `net`. Funcția e `net.http_post`, NU
--      `extensions.net.http_post`.
--   3. O modificare de piesă nu are voie să pice din cauza dez.ro. Toate
--      blocurile înghit excepțiile; cel mult se pierde trezirea, nu piesa.
--
-- CE NU FACE
-- Nu publică nimic singură. Migrarea asta doar NOTEAZĂ ce s-a schimbat și bate
-- la ușă. Toate regulile despre ce se trimite și ce nu rămân în `lib/dezro/`,
-- unde erau (vezi `lib/dezro/README.md`), iar plasa de 20% de la retragere
-- rămâne singurul lucru care poate opri o ștergere în masă.
--
-- IDEMPOTENTĂ: se poate rula de câte ori vrei.
-- Se rulează în Supabase → SQL Editor, după migrarea 37 (`dezro.sql`).
-- ============================================================

-- pg_net e deja pornit de migrarea 36; linia rămâne ca migrarea asta să poată fi
-- rulată și pe o bază unde 36 n-a trecut încă.
create extension if not exists pg_net;

-- ------------------------------------------------------------
-- 1. COADA
--
-- Un rând = „piesa asta trebuie resincronizată cu dez.ro". Rândul se ȘTERGE când
-- treaba e făcută; ce a plecat efectiv rămâne scris în `dezro_anunturi`, care e
-- jurnalul adevărat. Aici rămân doar eșecurile, cu numărul de încercări și
-- eroarea la vedere — ca la `email_coada`, ca o coadă blocată să nu poată fi
-- invizibilă.
--
-- DE CE DOUĂ FELURI DE RÂND
--   `product_id` — piesa există în bază. Ce e de făcut cu ea se decide la
--                  procesare, din starea ei de ATUNCI: publicată și cu stoc =>
--                  se trimite sau se actualizează; altfel => i se retrage anunțul.
--                  Nu se scrie „ce e de făcut" în coadă, fiindcă între trigger și
--                  procesare piesa se mai poate schimba o dată.
--   `ad_id`      — piesa a fost ȘTEARSĂ din bază. Aici e singurul caz în care
--                  coada trebuie să țină ea informația: `dezro_anunturi` are
--                  `on delete cascade`, deci rândul cu id-ul anunțului dispare
--                  odată cu piesa. Fără copia asta, anunțul ar rămâne pentru
--                  totdeauna la ei, fără ca noi să mai știm măcar că există.
--
-- DE CE FĂRĂ CHEIE STRĂINĂ pe `product_id`: un rând pus la ștergere trebuie să
-- supraviețuiască piesei. (Rândurile de ștergere n-au oricum `product_id`, dar
-- regula rămâne: coada nu se leagă de catalog.)
--
-- `unique` pe amândouă coloanele: în PostgreSQL valorile NULL sunt distincte
-- între ele, deci pot exista oricâte rânduri de ștergere (cu `product_id` null)
-- lângă un rând unic pe piesă.
-- ------------------------------------------------------------
create table if not exists public.dezro_coada (
  id         bigint      generated always as identity primary key,
  product_id bigint      unique,
  ad_id      integer     unique,
  motiv      text        not null,
  incercari  smallint    not null default 0,
  eroare     text,
  cerut_la   timestamptz not null default now(),
  constraint dezro_coada_are_tinta check (product_id is not null or ad_id is not null)
);

comment on table  public.dezro_coada            is 'Piese de resincronizat cu dez.ro. Rândul se șterge când s-a făcut; rămân doar eșecurile, cu eroarea la vedere.';
comment on column public.dezro_coada.product_id is 'Piesa. Ce e de făcut cu ea (trimis / actualizat / retras) se decide la procesare, din starea ei de atunci.';
comment on column public.dezro_coada.ad_id      is 'Doar la piesă ȘTEARSĂ: id-ul anunțului lor. dezro_anunturi are on delete cascade, deci fără copia asta anunțul ar rămâne orfan la ei.';

create index if not exists dezro_coada_cerut_idx on public.dezro_coada (id) where incercari < 5;

alter table public.dezro_coada enable row level security;
drop policy if exists "dezro coada echipa" on public.dezro_coada;
create policy "dezro coada echipa" on public.dezro_coada for all using (is_staff()) with check (is_staff());

-- ------------------------------------------------------------
-- 2. TREZIREA, CU O SINGURĂ BĂTAIE LA UȘĂ
--
-- Problema: un import din pieseauto.ro scrie mii de rânduri. Fără nicio frână,
-- fiecare ar chema ruta o dată — mii de cereri HTTP pentru o singură treabă.
--
-- Frâna e un rând cu ora ultimei treziri. Triggerul trezește doar dacă au trecut
-- mai mult de `FEREASTRA` secunde de la ultima; ruta, când termină un lot,
-- DEBLOCHEAZĂ (pune ora în trecut) și abia apoi se cheamă din nou dacă a mai
-- rămas ceva. Ordinea asta e ce închide cursa: orice trigger care se declanșează
-- după deblocare trezește singur, iar orice trigger declanșat în timpul lotului
-- și-a lăsat oricum rândul în coadă, unde recitirea de după deblocare îl vede.
-- ------------------------------------------------------------
create table if not exists public.dezro_trezire (
  unic   boolean     primary key default true check (unic),
  ultima timestamptz not null default '-infinity'
);
insert into public.dezro_trezire (unic) values (true) on conflict (unic) do nothing;

alter table public.dezro_trezire enable row level security;
drop policy if exists "dezro trezire echipa" on public.dezro_trezire;
create policy "dezro trezire echipa" on public.dezro_trezire for all using (is_staff()) with check (is_staff());

-- Cheamă ruta. `fortat` = „acum, indiferent de fereastră" — îl folosește ruta
-- când se leagă singură mai departe, ca să golească o coadă lungă fără să
-- aștepte alt trigger.
create or replace function public.dezro_trezeste(fortat boolean default false)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url    text;
  v_secret text;
  v_ok     boolean := false;
begin
  -- Configurarea se citește ÎNAINTE de a consuma fereastra. Ordinea contează:
  -- altfel o modificare făcută cât timp adresa lipsea ar fi „cheltuit" cele 20
  -- de secunde degeaba, iar prima modificare de după configurare — exact cea pe
  -- care operatorul o face ca să vadă că merge — ar fi fost sărită.
  select valoare->'dezro'->>'webhook_url', valoare->'dezro'->>'webhook_secret'
    into v_url, v_secret
    from public.settings where cheie = 'integrari';

  -- Fără adresă sau fără secret nu se cheamă nimic. Nu e o eroare: e starea
  -- normală cât timp sincronizarea automată nu e pornită din Admin → Integrări.
  -- Rândurile rămân în coadă și pleacă la prima trezire de după configurare.
  if v_url is null or v_url = '' or v_secret is null or v_secret = '' then
    return false;
  end if;

  -- Fereastra: 20 de secunde. Îndeajuns cât să strângă un import întreg într-o
  -- singură bătaie, destul de scurtă cât o piesă adăugată cu mâna să plece
  -- practic imediat. `not found` = altcineva a trezit deja de curând.
  update public.dezro_trezire
     set ultima = now()
   where unic
     and (fortat or ultima < now() - interval '20 seconds');
  if not found then return false; end if;

  perform net.http_post(
    url     := v_url,
    body    := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-autopas-dezro', v_secret),
    timeout_milliseconds := 3000
  );
  v_ok := true;
  return v_ok;
end;
$$;

-- Pune ora ultimei treziri în trecut, ca următorul trigger să trezească pe loc.
-- O cheamă ruta când a terminat un lot — vezi comentariul de la tabelă.
create or replace function public.dezro_deblocheaza()
returns void
language sql
security definer
set search_path = public
as $$
  update public.dezro_trezire set ultima = '-infinity' where unic;
$$;

-- Ca la orice funcție nouă: `public` moștenește dreptul prin rolul PUBLIC, deci
-- nu ajunge revocarea de la `anon`. Le cheamă doar triggerul (care rulează cu
-- drepturile definitorului) și ruta de server, cu cheia de service.
revoke execute on function public.dezro_trezeste(boolean) from public;
revoke execute on function public.dezro_deblocheaza()    from public;
grant  execute on function public.dezro_trezeste(boolean) to service_role;
grant  execute on function public.dezro_deblocheaza()     to service_role;

-- ------------------------------------------------------------
-- 3. TRIGGERUL
--
-- Două blocuri, fiecare cu `exception` propriu. Vezi regula 1 din antet: la
-- migrarea 36, inserarea în coadă și apelul HTTP stăteau împreună, apelul a dat
-- eroare, iar excepția înghițită a anulat și inserarea. Comanda a intrat în bază
-- cu coada goală — fix invariantul pe care funcția trebuia să-l apere.
-- ------------------------------------------------------------
create or replace function public.dezro_marcheaza()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ad integer;
begin
  -- ---------- BLOCUL 1: rândul în coadă ----------
  begin
    if tg_op = 'DELETE' then
      -- Trigger BEFORE, tocmai ca rândul din `dezro_anunturi` să mai existe:
      -- `on delete cascade` îl ia imediat după.
      select ad_id into v_ad
        from public.dezro_anunturi
       where product_id = old.id and status = 'activ' and ad_id is not null;
      if v_ad is not null then
        insert into public.dezro_coada (ad_id, motiv) values (v_ad, 'piesă ștearsă')
          on conflict (ad_id) do nothing;
      end if;
    else
      -- O modificare adevărată repornește numărătoarea încercărilor: dacă rândul
      -- se blocase pe o eroare, poate că tocmai ce s-a schimbat o repară.
      insert into public.dezro_coada (product_id, motiv)
      values (new.id, case when tg_op = 'INSERT' then 'piesă nouă' else 'piesă modificată' end)
      on conflict (product_id) do update
        set motiv = excluded.motiv, cerut_la = now(), incercari = 0, eroare = null;
    end if;
  exception when others then
    -- Înghițit intenționat: dez.ro nu are voie să oprească o modificare de piesă.
    null;
  end;

  -- ---------- BLOCUL 2: trezirea ----------
  begin
    perform public.dezro_trezeste(false);
  exception when others then
    -- Eșecul trezirii se scrie în coadă, ca să se vadă în panou de ce a
    -- întârziat. Tăcerea de aici a costat o comandă întreagă la migrarea 36.
    -- `new` NU există într-un trigger de DELETE, de aceea ramurile sunt
    -- separate: o referire la `new.id` acolo ar ridica ea însăși o excepție,
    -- iar mesajul care explică întârzierea s-ar pierde tocmai când e nevoie.
    begin
      if tg_op = 'DELETE' then
        update public.dezro_coada
           set eroare = 'trezire eșuată: ' || coalesce(sqlerrm, 'necunoscut')
         where v_ad is not null and ad_id = v_ad;
      else
        update public.dezro_coada
           set eroare = 'trezire eșuată: ' || coalesce(sqlerrm, 'necunoscut')
         where product_id = new.id;
      end if;
    exception when others then null;
    end;
  end;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke execute on function public.dezro_marcheaza() from public;

-- ---------- INSERT ----------
-- Doar piesele care chiar au ce căuta la ei. O piesă adăugată nepublicată sau
-- fără stoc n-are ce trimite, iar un rând de coadă degeaba ar fi procesat, ar
-- ieși „nimic de făcut" și ar fi șters — muncă pentru nimic, la fiecare import.
drop trigger if exists dezro_la_inserare on public.products;
create trigger dezro_la_inserare
  after insert on public.products
  for each row
  when (new.publicat and new.stoc > 0)
  execute function public.dezro_marcheaza();

-- ---------- UPDATE ----------
-- Lista de coloane NU e „toate, ca să fim siguri". `vizualizari` crește la
-- FIECARE deschidere a unei pagini de piesă: fără filtrul ăsta, fiecare vizitator
-- ar pune o piesă în coadă și ar bate la ușa rutei. Lista de mai jos e exact ce
-- citește `pieseEligibile()` din `lib/dezro/depozit.mjs` plus `publicat` (care
-- decide dacă piesa mai e a lor). Cine adaugă un câmp în anunț îl adaugă și aici.
drop trigger if exists dezro_la_modificare on public.products;
create trigger dezro_la_modificare
  after update on public.products
  for each row
  when (
    old.publicat        is distinct from new.publicat        or
    old.stoc            is distinct from new.stoc            or
    old.nume            is distinct from new.nume            or
    old.pret_lei        is distinct from new.pret_lei        or
    old.pret_sufix      is distinct from new.pret_sufix      or
    old.ani             is distinct from new.ani             or
    old.oem             is distinct from new.oem             or
    old.stare_nota      is distinct from new.stare_nota      or
    old.compat          is distinct from new.compat          or
    old.poze            is distinct from new.poze            or
    old.cod_intern      is distinct from new.cod_intern      or
    old.model_ids       is distinct from new.model_ids       or
    old.categorie_id    is distinct from new.categorie_id    or
    old.subcategorie_id is distinct from new.subcategorie_id
  )
  execute function public.dezro_marcheaza();

-- ---------- DELETE ----------
-- BEFORE, nu AFTER: după ștergere, `on delete cascade` a luat deja rândul din
-- `dezro_anunturi`, deci n-am mai avea de unde lua id-ul anunțului.
drop trigger if exists dezro_la_stergere on public.products;
create trigger dezro_la_stergere
  before delete on public.products
  for each row
  execute function public.dezro_marcheaza();

-- ------------------------------------------------------------
-- 4. CÂT E DE FĂCUT — o singură trecere, pentru panou
-- ------------------------------------------------------------
create or replace view public.dezro_coada_stare
with (security_invoker = on) as
select
  count(*)                                        as total,
  count(*) filter (where incercari < 5)           as de_facut,
  count(*) filter (where incercari >= 5)          as blocate,
  count(*) filter (where ad_id is not null)       as de_sters,
  min(cerut_la)                                   as cel_mai_vechi,
  max(eroare) filter (where eroare is not null)   as o_eroare
from public.dezro_coada;

comment on view public.dezro_coada_stare is 'Câte piese așteaptă sincronizarea cu dez.ro și de ce s-a blocat, dacă s-a blocat.';

revoke all on public.dezro_coada_stare from anon;

-- ============================================================
-- VERIFICARE
-- ============================================================
-- a) cele trei triggere există, pe products
select trigger_name, action_timing, event_manipulation
  from information_schema.triggers
 where event_object_table = 'products' and trigger_name like 'dezro_%'
 order by trigger_name;

-- b) coada (goală la prima rulare) și rândul de trezire
select * from public.dezro_coada_stare;
select * from public.dezro_trezire;

-- c) pg_net e în schema `net`, nu în alta (regula 2 din antet)
select n.nspname as schema, p.proname
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where p.proname = 'http_post';
