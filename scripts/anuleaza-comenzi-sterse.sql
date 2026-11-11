-- ============================================================
-- ANULAREA MIGRĂRII 55 (supabase/comenzi-sterse.sql) — DOAR LA NEVOIE
--
-- Pune înapoi `sterge_comanda` EXACT din migrarea 9 (admin-fix.sql), scoate triggerul
-- de pază și coloanele `sters_la` / `sters_de`. Fără `cascade`.
-- REFUZĂ dacă există comenzi ascunse (s-ar pierde care sunt) — reafișează-le întâi
-- (SQL-ul de la final) — sau dacă `sterge_comanda` nu e versiunea din 55.
-- Se rulează din Supabase → SQL Editor, de proprietar.
-- ============================================================
begin;

do $$
declare v text; c int;
begin
  select md5(replace(prosrc, E'\r', '')) into v from pg_proc where oid = to_regprocedure('public.sterge_comanda(bigint)');
  if v is distinct from 'ec5319ea6dbed417d766c2fb92157410' then
    raise exception 'OPRIT: sterge_comanda din bază nu e versiunea din migrarea 55 (amprenta fără CR: %). Nu se schimbă nimic.', v;
  end if;
  select count(*) into c from public.orders where sters_la is not null;
  if c > 0 then
    raise exception 'OPRIT: % comenzi sunt ascunse. Reafișează-le întâi (SQL-ul de la finalul fișierului), altfel se pierde care sunt.', c;
  end if;
end $$;

create or replace function public.sterge_comanda(oid bigint)
returns json language plpgsql security definer set search_path = public as $$
declare nr text;
begin
  if not is_admin() then return json_build_object('ok', false, 'mesaj', 'Doar administratorul poate șterge comenzi.'); end if;
  select numar into nr from orders where id = oid;
  if nr is null then return json_build_object('ok', false, 'mesaj', 'Comanda nu există.'); end if;
  -- repunem piesele pe stoc doar dacă nu era deja anulată
  if (select status from orders where id = oid) <> 'anulata' then
    update products p set stoc = p.stoc + i.cantitate, publicat = true
      from order_items i where i.order_id = oid and i.product_id = p.id;
  end if;
  delete from orders where id = oid;   -- order_items și order_events se șterg în cascadă
  return json_build_object('ok', true, 'mesaj', 'Comanda ' || nr || ' a fost ștearsă, piesele au revenit pe stoc.');
end; $$;
grant execute on function public.sterge_comanda(bigint) to authenticated;

drop trigger if exists orders_sters_pazeste on public.orders;
drop function if exists public.orders_sters_pazeste();
alter table public.orders drop column if exists sters_de;
alter table public.orders drop column if exists sters_la;

commit;

-- ============================================================
-- REAFIȘAREA UNEI COMENZI ȘTERSE (fără anularea migrării) — rulează DOAR blocul ăsta,
-- separat, după ce înlocuiești numărul comenzii:
--
--   -- 1. vezi ce comenzi sunt ascunse
--   select id, numar, nume, total, sters_la, sters_de from public.orders where sters_la is not null order by sters_la desc;
--
--   -- 2. reafișează una (merge doar din SQL Editor; din browser e blocat)
--   update public.orders set sters_la = null, sters_de = null where numar = 'AP-2026-0XXXX' and sters_la is not null returning id, numar;
--   insert into public.order_events (order_id, tip, mesaj, autor)
--     select id, 'nota', 'Comandă reafișată în admin (din SQL)', 'proprietar' from public.orders where numar = 'AP-2026-0XXXX';
-- ============================================================
