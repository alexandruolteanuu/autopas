-- ============================================================
-- AUTOPAS — MIGRAREA 55: „ȘTERGE” PE COMENZILE CU FACTURĂ = ASCUNDERE (11 noiembrie 2026)
--
-- Cerută de proprietar: butonul „Șterge” din comandă merge și pe comenzile cu
-- factură emisă din aplicație. Acelea NU se pot șterge din bază (cheia străină
-- `comanda_facturata_nu_se_poate_sterge`, migrarea 49 — factura e document fiscal),
-- deci se ASCUND: `orders.sters_la` + `orders.sters_de`.
--
-- CE ATINGE DIN CE EXISTĂ:
--   · `orders`: DOUĂ COLOANE NOI, goale (`sters_la`, `sters_de`). Niciun rând schimbat.
--   · un trigger NOU pe `orders` (`orders_sters_pazeste`): din browser (rolurile
--     `authenticated` / `anon`) coloanele astea NU se pot scrie direct — doar prin
--     `sterge_comanda`. Reafișarea se face doar de proprietar, din SQL Editor.
--   · RESCRIE `sterge_comanda` (din migrarea 9, admin-fix.sql). Semnătura și drepturile
--     rămân. Comanda FĂRĂ factură din aplicație: corpul vechi, IDENTIC (stocul înapoi,
--     ștergere). Comanda CU factură: doar `sters_la` / `sters_de` + o notă în jurnal —
--     fără stoc, fără piese, fără dez.ro, fără AWB, fără facturi.
--     GARDĂ: amprenta fără „\r” = 9 (cd1d7d0cf96d2c79014e7d7749ac1b0d) sau 55 (ec5319ea6dbed417d766c2fb92157410, re-rulare).
--   · Politicile RLS: NESCHIMBATE, intenționat. Rapoartele, exportul pentru SAGA și
--     pagina facturii trebuie să citească în continuare comenzile ascunse; ascunderea
--     se face în paginile adminului (`sters_la is null`).
--
-- Idempotentă. Testele: scripts/verifica-comenzi-sterse.sql.
-- Anularea: scripts/anuleaza-comenzi-sterse.sql. Reafișarea unei comenzi: același fișier, la final.
-- ============================================================


-- ------------------------------------------------------------
-- 1. GARDA: sterge_comanda din bază = versiunea din git
-- ------------------------------------------------------------
do $$
declare v text;
begin
  select md5(replace(prosrc, E'\r', '')) into v from pg_proc where oid = to_regprocedure('public.sterge_comanda(bigint)');
  if v is null then raise exception 'OPRIT: sterge_comanda nu există.'; end if;
  if v not in ('cd1d7d0cf96d2c79014e7d7749ac1b0d', 'ec5319ea6dbed417d766c2fb92157410') then
    raise exception 'OPRIT: sterge_comanda din bază diferă de versiunea din git (amprenta fără CR: %). Nu se schimbă nimic. Trimite textul funcției (select pg_get_functiondef(''public.sterge_comanda(bigint)''::regprocedure)) pentru comparare.', v;
  end if;
  if to_regclass('public.facturi') is null then
    raise exception 'OPRIT: tabela facturi nu există — migrarea 49 nu e rulată.';
  end if;
end $$;


-- ------------------------------------------------------------
-- 2. COLOANELE
-- ------------------------------------------------------------
alter table public.orders add column if not exists sters_la timestamptz;
alter table public.orders add column if not exists sters_de uuid;
comment on column public.orders.sters_la is
  'Comanda e ȘTEARSĂ din admin (are factură, deci nu se poate șterge din bază). Null = vizibilă. Se pune doar prin sterge_comanda; se scoate doar din SQL Editor.';


-- ------------------------------------------------------------
-- 3. PAZA: din browser nu se ascunde și nu se reafișează nimic direct
-- ------------------------------------------------------------
-- `current_user` e rolul care rulează: din browser `authenticated`; într-o funcție
-- `security definer` (sterge_comanda) proprietarul funcției; în SQL Editor `postgres`.
create or replace function public.orders_sters_pazeste()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.sters_la, new.sters_de) is distinct from (old.sters_la, old.sters_de)
     and current_user in ('authenticated', 'anon') then
    raise exception 'Ștergerea unei comenzi se face doar cu butonul „Șterge” (sterge_comanda).';
  end if;
  return new;
end $$;
revoke execute on function public.orders_sters_pazeste() from public, anon, authenticated;

drop trigger if exists orders_sters_pazeste on public.orders;
create trigger orders_sters_pazeste before update on public.orders
  for each row execute function public.orders_sters_pazeste();


-- ------------------------------------------------------------
-- 4. sterge_comanda: fără factură — ca înainte; cu factură — ascunsă
-- ------------------------------------------------------------
create or replace function public.sterge_comanda(oid bigint)
returns json language plpgsql security definer set search_path = public as $$
declare nr text;
begin
  if not is_admin() then return json_build_object('ok', false, 'mesaj', 'Doar administratorul poate șterge comenzi.'); end if;
  select numar into nr from orders where id = oid;
  if nr is null then return json_build_object('ok', false, 'mesaj', 'Comanda nu există.'); end if;
  -- Migrarea 55: comanda cu factură din aplicație NU se șterge (factura e document
  -- fiscal și ține de comandă) — se ascunde din admin. Stocul, piesele, dez.ro și
  -- AWB-ul rămân exact cum sunt, ca la orice comandă rămasă în bază.
  if exists (select 1 from facturi f where f.order_id = oid) then
    -- Atomic: din două apăsări simultane, doar una găsește `sters_la is null`.
    update orders set sters_la = now(), sters_de = auth.uid() where id = oid and sters_la is null;
    if not found then
      return json_build_object('ok', false, 'mesaj', 'Comanda ' || nr || ' e deja ștearsă.');
    end if;
    insert into order_events(order_id, tip, mesaj, autor)
    values (oid, 'stergere', 'Comandă ștearsă din admin. Are factură emisă, deci rămâne în bază, ascunsă; factura rămâne în Facturi.',
            coalesce(auth.jwt()->>'email', 'sistem'));
    return json_build_object('ok', true, 'mesaj', 'Comanda ' || nr || ' a fost ștearsă din admin. Factura ei rămâne în Facturi.');
  end if;
  -- repunem piesele pe stoc doar dacă nu era deja anulată
  if (select status from orders where id = oid) <> 'anulata' then
    update products p set stoc = p.stoc + i.cantitate, publicat = true
      from order_items i where i.order_id = oid and i.product_id = p.id;
  end if;
  delete from orders where id = oid;   -- order_items și order_events se șterg în cascadă
  return json_build_object('ok', true, 'mesaj', 'Comanda ' || nr || ' a fost ștearsă, piesele au revenit pe stoc.');
end; $$;
grant execute on function public.sterge_comanda(bigint) to authenticated;
