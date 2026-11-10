-- ============================================================
-- AUTOPAS — SAGA, PASUL 2: EXPORTUL CSV CU COTA DIN SETĂRI
-- Migrarea 48 (10 noiembrie 2026). Planul: docs/saga-plan.md, pasul 2 din C.
--
-- DOAR ADAUGĂ două funcții noi. Nu atinge nicio tabelă, niciun rând, nicio
-- politică și nicio funcție existentă. Idempotentă.
-- Depinde de migrarea 47 (`calculeaza_linie_tva`, `transport_facturabil`).
-- NU depinde de migrarea 46.
-- Testele: scripts/verifica-saga-export.sql (tranzacție anulată, merge pe
-- producție). Anularea: scripts/anuleaza-saga-export.sql.
--
-- Ce repară: exportul CSV din Admin → Facturi calcula în browser baza cu
-- `/ 1.19` — cota de 19% scrisă în cod, depășită din august 2025 — și fără
-- rotunjire. Acum calculul e cel din migrarea 47, iar cota vine din setări.
-- ============================================================


-- ------------------------------------------------------------
-- 1. COTA TVA DIN SETĂRI
--
-- Citește `settings.integrari.saga.cota_tva` și `regim_tva` (Admin → Integrări →
-- Saga). Câmp gol sau nesalvat = 21%, regim normal: valorile confirmate de pe
-- factura reală (10 noiembrie 2026). E SINGURUL loc din proiect în care stă
-- acest implicit.
--
-- O valoare greșită NU cade tăcut pe 21%: o cotă scrisă greșit („2l”) care ar
-- produce facturi cu 21% fără nicio urmă e mai rea decât un export oprit cu
-- mesajul „cota nu e un număr”.
--
-- `security invoker`: citește setările cu drepturile celui care o cheamă. Rândul
-- `integrari` e citibil doar de echipă, deci cine nu e din echipă primește
-- implicitul, nu setările.
-- ------------------------------------------------------------
create or replace function public.saga_cota_tva()
returns numeric
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_cota  text;
  v_regim text;
  v_n     numeric;
begin
  select btrim(coalesce(valoare->'saga'->>'cota_tva', '')),
         lower(btrim(coalesce(valoare->'saga'->>'regim_tva', '')))
    into v_cota, v_regim
    from public.settings where cheie = 'integrari';

  -- Regimul: gol = normal. Marja e setabilă, dar refuzată în faza 1 (planul, A.7).
  if coalesce(v_regim, '') not in ('', 'normal') then
    if v_regim in ('marja', 'marjă') then
      raise exception 'Regimul TVA „marjă” nu e implementat. Puneți „normal” în Admin → Integrări → Saga.';
    end if;
    raise exception 'Regimul TVA „%” din Admin → Integrări → Saga nu e cunoscut (normal / marja).', v_regim;
  end if;

  if coalesce(v_cota, '') = '' then
    return 21;
  end if;

  v_cota := replace(replace(v_cota, ',', '.'), '%', '');
  if v_cota !~ '^\s*[0-9]+(\.[0-9]+)?\s*$' then
    raise exception 'Cota TVA „%” din Admin → Integrări → Saga nu e un număr.', v_cota;
  end if;
  v_n := btrim(v_cota)::numeric;
  if v_n >= 100 then
    raise exception 'Cota TVA % din Admin → Integrări → Saga nu e validă (0–99).', v_n;
  end if;
  return v_n;
end;
$$;

comment on function public.saga_cota_tva() is
  'Cota TVA din settings.integrari.saga.cota_tva (gol = 21). Refuză o valoare greșită și regimul marjă. Singurul loc cu implicitul de 21%.';

revoke execute on function public.saga_cota_tva() from public;
revoke execute on function public.saga_cota_tva() from anon;
grant  execute on function public.saga_cota_tva() to authenticated, service_role;


-- ------------------------------------------------------------
-- 2. LINIILE PENTRU EXPORTUL CSV
--
-- O linie pe fiecare piesă din comenzile cerute, cu TVA-ul calculat de
-- `calculeaza_linie_tva` (migrarea 47) la cota din setări, și transportul care
-- intră pe factură (`transport_facturabil`, pe comandă — se repetă pe fiecare
-- linie, ca în CSV-ul de până acum).
--
-- Primește id-urile comenzilor, nu un interval de date: exportă EXACT lista pe
-- care operatorul o vede în pagină (interval + filtru + fără anulate). Se cheamă
-- prin POST, deci lista nu ajunge în adresă.
--
-- `security invoker`: RLS-ul de pe `orders` și `order_items` se aplică normal —
-- vede doar ce vede cel care o cheamă (echipa).
--
-- Ramura „comanda are document de factură” (liniile copiate din `facturi_linii`)
-- se adaugă la pasul 4, când există tabelele.
-- ------------------------------------------------------------
create or replace function public.export_saga_linii(p_order_ids bigint[])
returns table (
  order_id      bigint,
  item_id       bigint,
  produs        text,
  cantitate     numeric,
  pret_cu_tva   numeric,   -- prețul unitar plătit de client
  pret_fara_tva numeric,   -- unitar, 4 zecimale
  valoare       numeric,   -- baza liniei
  tva           numeric,
  total         numeric,   -- baza + TVA = ce a plătit clientul pe linie
  cota          numeric,
  transport     numeric    -- transportul facturabil al COMENZII
)
language sql
stable
security invoker
set search_path = public
as $$
  with c as (select public.saga_cota_tva() as cota)
  select i.order_id,
         i.id,
         i.nume,
         i.cantitate::numeric,
         i.pret,
         t.pret_fara_tva,
         t.valoare,
         t.tva,
         t.total,
         c.cota,
         public.transport_facturabil(o.subtotal, o.discount_valoare, o.livrare, o.total)
    from public.order_items i
    join public.orders o on o.id = i.order_id
   cross join c
   cross join lateral public.calculeaza_linie_tva(i.pret, i.cantitate, c.cota) t
   where i.order_id = any(coalesce(p_order_ids, '{}'))
   order by i.order_id, i.id;
$$;

comment on function public.export_saga_linii(bigint[]) is
  'Liniile exportului CSV pentru Saga: TVA calculat cu calculeaza_linie_tva la cota din setări, plus transportul facturabil al comenzii.';

revoke execute on function public.export_saga_linii(bigint[]) from public;
revoke execute on function public.export_saga_linii(bigint[]) from anon;
grant  execute on function public.export_saga_linii(bigint[]) to authenticated, service_role;
