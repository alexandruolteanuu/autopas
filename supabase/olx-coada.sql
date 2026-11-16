-- ============================================================
-- MIGRAREA 58 — OLX: SINCRONIZAREA AUTOMATĂ (pasul 3 din docs/olx-plan.md, 16 noiembrie 2026)
--
-- CE REZOLVĂ
-- Până acum anunțurile OLX se schimbau doar cu mâna (caseta OLX de pe pagina piesei)
-- sau din terminal. O piesă nouă nu ajungea pe OLX, iar una vândută / ascunsă /
-- ștearsă își păstra anunțul. Măsurat la 16 noiembrie 2026: 47 de piese noi fără
-- anunț, 26 vândute și 20 ascunse cu anunț.
--
-- CUM — exact forma de la dez.ro (migrarea 39), cu aceleași trei reguli:
--   1. fiecare efect care trebuie să supraviețuiască singur stă în BLOCUL LUI;
--   2. pg_net e în schema `net` (`net.http_post`);
--   3. o modificare de piesă nu are voie să pice din cauza OLX: blocurile înghit excepțiile.
-- Un trigger pe `products` scrie piesa în `olx_coada` în ACEEAȘI tranzacție cu modificarea
-- și trezește ruta `/api/olx-coada`. Ce e de făcut se decide la PROCESARE (lib/olx-coada.mjs).
--
-- DIFERENȚE FAȚĂ DE dez.ro
--   · Adresa și secretul trezirii stau în `olx_trezire` (fără nicio politică RLS → doar
--     serverul), nu în `settings.integrari`: secretul se generează AICI, nu se scrie de mână.
--     `activ` pornește FALSE: triggerele strâng coada, dar nu se cheamă nimic până la
--     „Pornește sincronizarea” din Admin → Anunțuri OLX.
--   · `olx_anunturi` are `on delete set null` (nu cascade), deci rândul anunțului rămâne
--     după ștergerea piesei; coada copiază totuși `advert_id`, ca ruta să știe ce să retragă.
--   · `olx_anunturi.retras_la` (coloană NOUĂ pe tabela din 57): anunțul a fost retras de
--     aplicație. Fără ea, un anunț „limited” trecut la terminate ar arăta la fel ca unul viu.
--   · Un lacăt de lot (`lot_pana`): două loturi simultane nu lucrează pe aceeași coadă.
--
-- Doar obiecte NOI + o coloană nouă pe `olx_anunturi`. Idempotentă.
-- Depinde de 57 (`olx_anunturi`), de `is_staff()` și de pg_net (migrarea 36).
-- Pre-verificare: scripts/pre-verifica-olx-coada.sql · Test: scripts/verifica-olx-coada.sql
-- Anulare: scripts/anuleaza-olx-coada.sql
-- ============================================================

-- ------------------------------------------------------------
-- 0. COLOANA NOUĂ PE olx_anunturi
-- ------------------------------------------------------------
alter table public.olx_anunturi add column if not exists retras_la timestamptz;
comment on column public.olx_anunturi.retras_la is
  'Când a retras aplicația anunțul (piesă vândută / ascunsă / ștearsă). Null = anunț al unei piese de pe site.';

-- ------------------------------------------------------------
-- 1. COADA
-- `product_id` — piesa există; ce e de făcut se decide la procesare.
-- `advert_id`  — doar la piesă ȘTEARSĂ: anunțul de retras.
-- Fără chei străine: rândul de ștergere trebuie să supraviețuiască piesei.
-- ------------------------------------------------------------
create table if not exists public.olx_coada (
  id         bigint      generated always as identity primary key,
  product_id bigint      unique,
  advert_id  bigint      unique,
  motiv      text        not null,
  incercari  smallint    not null default 0,
  eroare     text,
  cerut_la   timestamptz not null default now(),
  constraint olx_coada_are_tinta check (product_id is not null or advert_id is not null)
);
comment on table public.olx_coada is
  'OLX: piese de resincronizat. Rândul se șterge când s-a făcut; rămân doar eșecurile, cu eroarea la vedere.';
create index if not exists olx_coada_de_facut_idx on public.olx_coada (id) where incercari < 5;

alter table public.olx_coada enable row level security;
revoke all on table public.olx_coada from public, anon, authenticated;
grant select on table public.olx_coada to authenticated;
grant select, insert, update, delete on table public.olx_coada to service_role;
drop policy if exists "olx_coada citire echipa" on public.olx_coada;
create policy "olx_coada citire echipa" on public.olx_coada for select to authenticated using (public.is_staff());

-- ------------------------------------------------------------
-- 2. TREZIREA + LACĂTUL LOTULUI (un singur rând, fără politici → doar serverul)
-- ------------------------------------------------------------
create table if not exists public.olx_trezire (
  unic           boolean     primary key default true check (unic),
  activ          boolean     not null default false,
  webhook_url    text,
  webhook_secret text        not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  ultima         timestamptz not null default '-infinity',
  lot_pana       timestamptz not null default '-infinity',
  mesaj          text,
  mesaj_la       timestamptz,
  pornit_la      timestamptz,
  pornit_de      text,
  -- Plasa de 20%: confirmarea omului ține 2 ore (loturile următoare, pornite de rută, n-o mai cer).
  prag_confirmat_la timestamptz
);
alter table public.olx_trezire add column if not exists prag_confirmat_la timestamptz;
insert into public.olx_trezire (unic) values (true) on conflict (unic) do nothing;
alter table public.olx_trezire enable row level security;
revoke all on table public.olx_trezire from public, anon, authenticated;
grant select, update on table public.olx_trezire to service_role;

-- Cheamă ruta. `fortat` = acum, indiferent de fereastra de 20 s (ruta, când se leagă singură mai departe).
create or replace function public.olx_trezeste(fortat boolean default false)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_url text; v_secret text; v_activ boolean;
begin
  -- Configurarea se citește ÎNAINTE de a consuma fereastra (lecția dez.ro).
  select activ, webhook_url, webhook_secret into v_activ, v_url, v_secret from public.olx_trezire where unic;
  if not coalesce(v_activ, false) or coalesce(v_url, '') = '' or coalesce(v_secret, '') = '' then
    return false; -- oprit: rândurile rămân în coadă și pleacă după pornire
  end if;
  update public.olx_trezire set ultima = now() where unic and (fortat or ultima < now() - interval '20 seconds');
  if not found then return false; end if;
  perform net.http_post(
    url := v_url, body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-autopas-olx', v_secret),
    timeout_milliseconds := 3000);
  return true;
end $$;

create or replace function public.olx_deblocheaza()
returns void language sql security definer set search_path = public as $$
  update public.olx_trezire set ultima = '-infinity' where unic;
$$;

-- Lacătul lotului: true = lotul e al tău (pentru `p_secunde`); false = alt lot lucrează acum.
create or replace function public.olx_coada_ia_lotul(p_secunde int default 70)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.olx_trezire set lot_pana = now() + make_interval(secs => p_secunde)
   where unic and lot_pana < now();
  return found;
end $$;

create or replace function public.olx_coada_elibereaza()
returns void language sql security definer set search_path = public as $$
  update public.olx_trezire set lot_pana = '-infinity' where unic;
$$;

revoke execute on function public.olx_trezeste(boolean)      from public, anon, authenticated;
revoke execute on function public.olx_deblocheaza()          from public, anon, authenticated;
revoke execute on function public.olx_coada_ia_lotul(int)    from public, anon, authenticated;
revoke execute on function public.olx_coada_elibereaza()     from public, anon, authenticated;
grant  execute on function public.olx_trezeste(boolean)      to service_role;
grant  execute on function public.olx_deblocheaza()          to service_role;
grant  execute on function public.olx_coada_ia_lotul(int)    to service_role;
grant  execute on function public.olx_coada_elibereaza()     to service_role;

-- ------------------------------------------------------------
-- 3. TRIGGERUL — două blocuri, fiecare cu `exception` propriu (regula 1)
-- ------------------------------------------------------------
create or replace function public.olx_marcheaza()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_ad bigint;
begin
  -- ---------- BLOCUL 1: rândul în coadă ----------
  begin
    if tg_op = 'DELETE' then
      -- BEFORE: rândul din olx_anunturi încă are product_id (on delete set null îl golește după).
      select advert_id into v_ad from public.olx_anunturi
       where product_id = old.id and advert_id is not null and retras_la is null;
      if v_ad is not null then
        insert into public.olx_coada (advert_id, motiv) values (v_ad, 'piesă ștearsă')
          on conflict (advert_id) do update set cerut_la = now(), incercari = 0, eroare = null;
      end if;
    else
      -- O modificare adevărată repornește numărătoarea: poate tocmai ea repară eroarea.
      insert into public.olx_coada (product_id, motiv)
      values (new.id, case when tg_op = 'INSERT' then 'piesă nouă' else 'piesă modificată' end)
      on conflict (product_id) do update
        set motiv = excluded.motiv, cerut_la = now(), incercari = 0, eroare = null;
    end if;
  exception when others then null; -- OLX nu are voie să oprească o modificare de piesă
  end;

  -- ---------- BLOCUL 2: trezirea ----------
  begin
    perform public.olx_trezeste(false);
  exception when others then
    begin
      if tg_op = 'DELETE' then
        update public.olx_coada set eroare = 'trezire eșuată: ' || coalesce(sqlerrm, 'necunoscut')
         where v_ad is not null and advert_id = v_ad;
      else
        update public.olx_coada set eroare = 'trezire eșuată: ' || coalesce(sqlerrm, 'necunoscut')
         where product_id = new.id;
      end if;
    exception when others then null;
    end;
  end;

  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke execute on function public.olx_marcheaza() from public, anon, authenticated;

-- INSERT: doar piesele care au ce căuta pe OLX.
drop trigger if exists olx_la_inserare on public.products;
create trigger olx_la_inserare after insert on public.products
  for each row when (new.publicat and new.stoc > 0)
  execute function public.olx_marcheaza();

-- UPDATE: exact coloanele citite de generator (COLOANE_PIESA din lib/olx.ts) — NU toate:
-- `vizualizari` crește la fiecare deschidere de pagină. Cine adaugă un câmp în anunț îl adaugă și aici.
drop trigger if exists olx_la_modificare on public.products;
create trigger olx_la_modificare after update on public.products
  for each row when (
    old.publicat        is distinct from new.publicat        or
    old.stoc            is distinct from new.stoc            or
    old.nume            is distinct from new.nume            or
    old.slug            is distinct from new.slug            or
    old.pret_lei        is distinct from new.pret_lei        or
    old.pret_sufix      is distinct from new.pret_sufix      or
    old.ani             is distinct from new.ani             or
    old.oem             is distinct from new.oem             or
    old.stare_nota      is distinct from new.stare_nota      or
    old.compat          is distinct from new.compat          or
    old.poze            is distinct from new.poze            or
    old.cod_intern      is distinct from new.cod_intern      or
    old.categorie_id    is distinct from new.categorie_id    or
    old.subcategorie_id is distinct from new.subcategorie_id
  )
  execute function public.olx_marcheaza();

-- DELETE: BEFORE, ca să mai găsim anunțul după product_id.
drop trigger if exists olx_la_stergere on public.products;
create trigger olx_la_stergere before delete on public.products
  for each row execute function public.olx_marcheaza();

-- ------------------------------------------------------------
-- 4. CE E DE RETRAS + STAREA PENTRU PANOU
-- ------------------------------------------------------------
-- Anunțuri vii ale pieselor care nu mai sunt de vânzare (vândute, ascunse, șterse).
-- Stările „vii” = STARI_VII din lib/olx-coada.mjs.
create or replace view public.olx_de_retras with (security_invoker = on) as
select a.id, a.product_id, a.advert_id, a.cod_intern, a.status,
       case when p.id is null then 'ștearsă' when not p.publicat then 'ascunsă' else 'vândută' end as motiv
  from public.olx_anunturi a
  left join public.products p on p.id = a.product_id
 where a.advert_id is not null and a.retras_la is null
   and a.status in ('new', 'active', 'limited', 'unpaid', 'unconfirmed')
   and (p.id is null or not p.publicat or p.stoc <= 0);
comment on view public.olx_de_retras is 'OLX: anunțuri vii ale pieselor care nu mai sunt de vânzare. Plasa de 20% le numără.';

create or replace view public.olx_coada_stare with (security_invoker = on) as
select
  (select count(*) from public.olx_coada)                                   as total,
  (select count(*) from public.olx_coada where incercari < 5)               as de_facut,
  (select count(*) from public.olx_coada where incercari >= 5)              as blocate,
  (select min(cerut_la) from public.olx_coada)                              as cel_mai_vechi,
  (select max(eroare) from public.olx_coada where eroare is not null)       as o_eroare,
  (select count(*) from public.olx_anunturi
    where advert_id is not null and retras_la is null
      and status in ('new', 'active', 'limited', 'unpaid', 'unconfirmed'))  as anunturi_vii,
  (select count(*) from public.olx_de_retras)                               as de_retras;
comment on view public.olx_coada_stare is 'OLX: cât așteaptă în coadă, câte s-au blocat, câte anunțuri vii și câte de retras.';

revoke all on public.olx_de_retras   from public, anon;
revoke all on public.olx_coada_stare from public, anon;
grant select on public.olx_de_retras   to authenticated, service_role;
grant select on public.olx_coada_stare to authenticated, service_role;

-- ============================================================
-- VERIFICAREA FINALĂ (doar citire): 3 triggere · coada goală · trezirea OPRITĂ
-- ============================================================
select
  (select count(*) from information_schema.triggers
    where event_object_table = 'products' and trigger_name like 'olx_la_%')  as triggere,
  (select count(*) from public.olx_coada)                                    as in_coada,
  (select activ from public.olx_trezire)                                     as trezire_activa;
