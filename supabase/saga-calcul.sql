-- ============================================================
-- AUTOPAS — SAGA, PASUL 1: CALCULUL TVA, JUDEȚELE, TRANSPORTUL FACTURABIL
-- Migrarea 47 (10 noiembrie 2026). Planul: docs/saga-plan.md, pasul 1 din C.
--
-- Doar unelte de calcul, fără nicio tabelă de facturi. Nu atinge niciun rând
-- existent și nicio politică existentă. Idempotentă: se poate rula de oricâte ori.
-- Depinde DOAR de `text_cautare` și extensia `unaccent` (migrarea 15) și de
-- rolurile Supabase. NU depinde de migrarea 46 (`retur-fan.sql`).
-- Testele: scripts/verifica-saga-calcul.sql (în tranzacție anulată, merge și pe
-- producție). Anularea: scripts/anuleaza-saga-calcul.sql.
-- ============================================================


-- ------------------------------------------------------------
-- 1. CALCULUL TVA PE O LINIE
--
-- Prețurile din site sunt CU TVA inclus. Regula (confirmată de factura reală
-- din SAGA: 200,00 → valoare 165,29, TVA 34,71, preț unitar 165,2900):
--   total   = round(preț × cantitate, 2)        ce plătește clientul pe linie
--   valoare = round(total / (1 + cotă/100), 2)  baza fără TVA
--   tva     = total − valoare                   PRIN DIFERENȚĂ
--   pret_fara_tva = round(valoare / cantitate, 4)
--
-- De ce TVA prin diferență: valoare + tva = EXACT suma încasată, la ban. Rotunjite
-- separat, baza și TVA-ul ar putea da un ban în plus sau în minus față de
-- rambursul de pe AWB.
--
-- `round()` pe `numeric` rotunjește jumătatea DEPARTE DE ZERO (0,125 → 0,13;
-- −0,125 → −0,13), deci un storno (cantitate negativă) dă exact opusul facturii.
-- `Math.round` din JavaScript NU face așa la numere negative — de aceea calculul
-- stă aici, într-un singur loc, și nu se copiază în browser.
--
-- Cota vine ca PARAMETRU, nu e scrisă aici: o citește cine cheamă funcția, din
-- `settings.integrari.saga.cota_tva`.
-- ------------------------------------------------------------
create or replace function public.calculeaza_linie_tva(
  p_pret_cu_tva numeric,
  p_cantitate   numeric,
  p_cota        numeric
)
returns table (pret_fara_tva numeric, valoare numeric, tva numeric, total numeric)
language plpgsql
immutable
set search_path = public
as $$
declare
  v_total   numeric;
  v_valoare numeric;
begin
  if p_pret_cu_tva is null or p_cantitate is null or p_cota is null then
    raise exception 'calculeaza_linie_tva: prețul, cantitatea și cota sunt obligatorii.';
  end if;
  if p_cantitate = 0 then
    raise exception 'calculeaza_linie_tva: cantitatea nu poate fi 0.';
  end if;
  if p_cota < 0 or p_cota >= 100 then
    raise exception 'calculeaza_linie_tva: cota TVA % nu e validă (0–99).', p_cota;
  end if;

  v_total   := round(p_pret_cu_tva * p_cantitate, 2);
  v_valoare := round(v_total / (1 + p_cota / 100), 2);

  -- Prețul unitar rămâne POZITIV la storno: cantitatea poartă semnul.
  pret_fara_tva := round(v_valoare / p_cantitate, 4);
  valoare       := v_valoare;
  tva           := v_total - v_valoare;
  total         := v_total;
  return next;
end;
$$;

comment on function public.calculeaza_linie_tva(numeric, numeric, numeric) is
  'Calculul TVA pe o linie de factură, din prețul CU TVA: total, valoare (bază), TVA prin diferență, preț unitar fără TVA cu 4 zecimale. Regula: docs/saga-plan.md, A.7.';

revoke execute on function public.calculeaza_linie_tva(numeric, numeric, numeric) from public;
revoke execute on function public.calculeaza_linie_tva(numeric, numeric, numeric) from anon;
grant  execute on function public.calculeaza_linie_tva(numeric, numeric, numeric) to authenticated, service_role;


-- ------------------------------------------------------------
-- 2. JUDEȚELE ȘI CODURILE LOR
--
-- SAGA cere codul județului (`ClientJudet` = „NT”), iar comenzile au numele
-- („Neamț”, din nomenclatorul FAN). Codurile sunt cele oficiale, ISO 3166-2:RO —
-- 41 de județe + București.
--
-- `cheie` = numele fără diacritice, cu litere mici, fără spații și cratime. Așa
-- „Bistrița-Năsăud”, „Bistrita Nasaud” și „BISTRITA-NASAUD” dau aceeași cheie, iar
-- formele cu sedilă („Constanţa”, „Iaşi”) se potrivesc și ele: `unaccent` le
-- tratează la fel ca virgula de dedesubt.
-- ------------------------------------------------------------
create table if not exists public.judete_coduri (
  cod   text primary key,
  nume  text not null,
  cheie text generated always as (
    regexp_replace(public.text_cautare(nume), '[^a-z0-9]', '', 'g')
  ) stored
);

create unique index if not exists judete_coduri_cheie_idx on public.judete_coduri (cheie);

insert into public.judete_coduri (cod, nume) values
  ('AB', 'Alba'),            ('AR', 'Arad'),           ('AG', 'Argeș'),
  ('BC', 'Bacău'),           ('BH', 'Bihor'),          ('BN', 'Bistrița-Năsăud'),
  ('BT', 'Botoșani'),        ('BV', 'Brașov'),         ('BR', 'Brăila'),
  ('B',  'București'),       ('BZ', 'Buzău'),          ('CS', 'Caraș-Severin'),
  ('CL', 'Călărași'),        ('CJ', 'Cluj'),           ('CT', 'Constanța'),
  ('CV', 'Covasna'),         ('DB', 'Dâmbovița'),      ('DJ', 'Dolj'),
  ('GL', 'Galați'),          ('GR', 'Giurgiu'),        ('GJ', 'Gorj'),
  ('HR', 'Harghita'),        ('HD', 'Hunedoara'),      ('IL', 'Ialomița'),
  ('IS', 'Iași'),            ('IF', 'Ilfov'),          ('MM', 'Maramureș'),
  ('MH', 'Mehedinți'),       ('MS', 'Mureș'),          ('NT', 'Neamț'),
  ('OT', 'Olt'),             ('PH', 'Prahova'),        ('SM', 'Satu Mare'),
  ('SJ', 'Sălaj'),           ('SB', 'Sibiu'),          ('SV', 'Suceava'),
  ('TR', 'Teleorman'),       ('TM', 'Timiș'),          ('TL', 'Tulcea'),
  ('VS', 'Vaslui'),          ('VL', 'Vâlcea'),         ('VN', 'Vrancea')
on conflict (cod) do update set nume = excluded.nume;

alter table public.judete_coduri enable row level security;
drop policy if exists "judete citire" on public.judete_coduri;
create policy "judete citire" on public.judete_coduri for select using (true);
grant select on public.judete_coduri to anon, authenticated;

comment on table public.judete_coduri is
  'Cele 42 de coduri de județ (ISO 3166-2:RO), pentru ClientJudet/FurnizorJudet din XML-ul SAGA. Date publice, scrise doar de migrare.';


-- ------------------------------------------------------------
-- 3. NUMELE JUDEȚULUI → COD
--
-- Acceptă: numele cu sau fără diacritice, cu sedilă, cu cratimă sau spațiu,
-- codul însuși („NT”, „nt”), prefixe („Jud. Neamț”, „Județul Neamț”,
-- „Municipiul București”) și sectoarele Bucureștiului („Sector 3” → B).
-- Întoarce NULL dacă nu recunoaște — cine o cheamă refuză atunci cu mesaj clar;
-- nu ghicește un județ.
-- ------------------------------------------------------------
create or replace function public.cod_judet(p_judet text)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v text;
  c text;
begin
  if p_judet is null or btrim(p_judet) = '' then
    return null;
  end if;

  -- Codul scris direct.
  select j.cod into c from public.judete_coduri j where j.cod = upper(btrim(p_judet));
  if found then
    return c;
  end if;

  v := public.text_cautare(btrim(p_judet));
  -- Prefixele administrative. Niciun județ nu începe cu „jud” sau „mun”.
  v := regexp_replace(v, '^(judetul|judet|jud|municipiul|mun)\.?\s*', '');

  -- Sectoarele: o adresă din București poate avea „Sector 3” în loc de județ.
  if v ~ '^sector(ul)?\s*[1-6]$' then
    return 'B';
  end if;

  v := regexp_replace(v, '[^a-z0-9]', '', 'g');
  select j.cod into c from public.judete_coduri j where j.cheie = v;
  return c;
end;
$$;

comment on function public.cod_judet(text) is
  'Codul județului (NT, B…) din numele scris oricum (cu/fără diacritice, cu sedilă, cu prefix). NULL dacă nu îl recunoaște.';

revoke execute on function public.cod_judet(text) from public;
revoke execute on function public.cod_judet(text) from anon;
grant  execute on function public.cod_judet(text) to authenticated, service_role;


-- ------------------------------------------------------------
-- 4. TRANSPORTUL FACTURABIL
--
-- Transportul intră pe factura NOASTRĂ doar dacă l-am încasat noi, adică dacă e
-- inclus în totalul comenzii. Din 15 septembrie 2026 (migrarea 45) îl încasează
-- FAN direct de la client, deci pe comenzile noi e 0; comenzile mai vechi îl au
-- inclus și rămân așa.
--
-- Aceeași regulă ca `livrareFacturabila()` din app/admin/facturi/page.tsx, mutată
-- aici ca factura și exportul CSV să nu poată ajunge la răspunsuri diferite. Pasul
-- 2 din plan scoate copia din browser.
--
-- Primește coloanele, nu rândul `orders`: se cheamă la fel din `select … from
-- orders` și din teste, fără o comandă reală.
-- ------------------------------------------------------------
create or replace function public.transport_facturabil(
  p_subtotal numeric,
  p_reducere numeric,
  p_livrare  numeric,
  p_total    numeric
)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case
    -- 0,009 = toleranța pentru rotunjiri, aceeași ca în browser.
    when coalesce(p_total, 0) > coalesce(p_subtotal, 0) - coalesce(p_reducere, 0) + 0.009
      then coalesce(p_livrare, 0)
    else 0::numeric
  end;
$$;

comment on function public.transport_facturabil(numeric, numeric, numeric, numeric) is
  'Transportul care intră pe factură: livrarea dacă e inclusă în total (comenzile de dinainte de 15.09.2026), altfel 0. Argumente: subtotal, discount_valoare, livrare, total.';

revoke execute on function public.transport_facturabil(numeric, numeric, numeric, numeric) from public;
revoke execute on function public.transport_facturabil(numeric, numeric, numeric, numeric) from anon;
grant  execute on function public.transport_facturabil(numeric, numeric, numeric, numeric) to authenticated, service_role;
