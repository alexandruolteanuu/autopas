-- ============================================================
-- MIGRAREA 44 — nomenclatorul de adrese FAN Courier (județe, localități, străzi)
--
-- DE CE (cerut de proprietar, 15 septembrie 2026)
-- La checkout, județul, localitatea și strada se aleg din liste, nu se scriu
-- liber. Motivul e AWB-ul: FAN refuză o localitate care nu e scrisă exact ca în
-- nomenclatorul lor („Locality is invalid"), iar calculul de tarif respinge chiar
-- și diacriticele („Broșteni"). O adresă aleasă din lista lor nu mai poate pica.
--
-- DE UNDE VIN DATELE
-- Din API-ul FAN (`/reports/localities`, `/reports/streets`), prin
-- `scripts/actualizeaza-nomenclator-fan.mjs`. NU din fișierele CSV primite:
-- „Streets Bucuresti.csv" are doar Bucureștiul, iar API-ul are străzi și pentru
-- celelalte orașe (Cluj-Napoca 1.226, Arad 696 — măsurat). La 15 septembrie 2026:
-- 42 de județe, 13.829 de localități (8.350 cu km suplimentari), 148.419 străzi.
-- FAN recomandă reluarea periodică; scriptul se poate rula oricând.
--
-- CINE CITEȘTE
-- Oricine (checkout-ul e public): e un nomenclator public al curierului, fără
-- nimic personal. Scrie DOAR scriptul, cu cheia de server — nicio politică de
-- scriere nu există, deci RLS refuză orice altceva.
--
-- IDEMPOTENTĂ: se poate re-rula oricând. Nu atinge nicio tabelă existentă.
-- ============================================================

create table if not exists fan_localitati (
  judet        text not null,
  localitate   text not null,
  agentie      text,
  -- Km suplimentari taxați de FAN până la localitate. 0 = în raza agenției.
  km_extra     int  not null default 0,
  -- Are nomenclator de străzi la FAN (orașele). Checkout-ul arată lista de străzi
  -- doar acolo; la sate, strada rămâne text liber. Completat de script.
  are_strazi   boolean not null default false,
  actualizat_la timestamptz not null default now(),
  primary key (judet, localitate)
);

create table if not exists fan_strazi (
  id           bigint primary key,           -- id-ul străzii la FAN
  judet        text not null,
  localitate   text not null,
  strada       text not null,                -- „1 Decembrie 1918"
  tip          text,                         -- „Bulevard", „Strada"…
  actualizat_la timestamptz not null default now()
);

-- Căutarea din checkout: strada în localitatea aleasă, după începutul
-- cuvintelor, fără diacritice. `text_cautare` e funcția din migrarea 15.
alter table fan_strazi add column if not exists cautare text
  generated always as (public.text_cautare(coalesce(tip, '') || ' ' || strada)) stored;
create index if not exists fan_strazi_localitate_idx on fan_strazi (judet, localitate);
create index if not exists fan_localitati_judet_idx on fan_localitati (judet);

-- Județele, pentru primul select. View, nu tabelă: se trag singure din localități.
create or replace view fan_judete with (security_invoker = true) as
  select judet, count(*)::int as nr_localitati from fan_localitati group by judet;

alter table fan_localitati enable row level security;
alter table fan_strazi enable row level security;

drop policy if exists "nomenclator fan citire" on fan_localitati;
create policy "nomenclator fan citire" on fan_localitati for select using (true);
drop policy if exists "nomenclator fan citire" on fan_strazi;
create policy "nomenclator fan citire" on fan_strazi for select using (true);

grant select on fan_localitati, fan_strazi, fan_judete to anon, authenticated;

comment on table fan_localitati is 'Nomenclatorul de localități FAN Courier. Se reface cu scripts/actualizeaza-nomenclator-fan.mjs.';
comment on table fan_strazi is 'Nomenclatorul de străzi FAN Courier (orașele care îl au). Se reface cu scripts/actualizeaza-nomenclator-fan.mjs.';
