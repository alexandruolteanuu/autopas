-- ============================================================
-- MIGRAREA 56 — OLX: CONECTAREA, TOKENII, CATEGORIILE (pasul 1 din docs/olx-plan.md)
--
-- Doar obiecte NOI. Nu atinge niciun rând, nicio funcție și nicio politică existentă.
-- Depinde de: `categories`, `is_admin()`, `is_staff()`. Idempotentă.
--
--   · olx_cont      — aplicația (client_id / client_secret), tokenii OAuth și setările
--                     anunțurilor. RLS pornit, NICIO politică: doar `service_role`
--                     (rutele de server). Nici adminul din browser nu-l citește.
--   · olx_blocare   — lacătul reînnoirii tokenului (o singură reînnoire o dată).
--   · olx_apeluri   — jurnalul apelurilor spre OLX. Niciodată tokenii.
--   · olx_categorii — catalogul de categorii OLX + atributele lor (scris de server).
--   · olx_mapari    — categoria noastră → frunza OLX + valorile atributelor obligatorii.
--
-- Anularea: scripts/anuleaza-olx-conexiune.sql. Testul: scripts/verifica-olx-conexiune.sql.
-- ============================================================

-- ---------- contul (secretul, tokenii, setările) ----------
create table if not exists public.olx_cont (
  unic                boolean primary key default true check (unic),
  client_id           text,
  client_secret       text,
  access_token        text,
  access_expira       timestamptz,
  refresh_token       text,
  reinnoit_la         timestamptz,
  scope               text,
  conectat_la         timestamptz,
  conectat_de         uuid,
  utilizator          jsonb,
  stare_oauth         text,
  stare_oauth_expira  timestamptz,
  stare_oauth_de      uuid,
  folosit_la          timestamptz,
  deconectat_la       timestamptz,
  deconectat_motiv    text,
  setari              jsonb not null default '{}'::jsonb
);
comment on table public.olx_cont is
  'OLX: aplicația, tokenii OAuth și setările. Fără politici RLS: doar service_role. Tokenii îi folosește doar lib/olx-api.mjs.';
insert into public.olx_cont (unic) values (true) on conflict (unic) do nothing;
alter table public.olx_cont enable row level security;
revoke all on table public.olx_cont from public, anon, authenticated;
grant select, insert, update on table public.olx_cont to service_role;

-- ---------- lacătul reînnoirii ----------
create table if not exists public.olx_blocare (
  unic       boolean primary key default true check (unic),
  detinator  uuid,
  pana       timestamptz not null default '-infinity'
);
insert into public.olx_blocare (unic) values (true) on conflict (unic) do nothing;
alter table public.olx_blocare enable row level security;
revoke all on table public.olx_blocare from public, anon, authenticated;
grant select, update on table public.olx_blocare to service_role;

create or replace function public.olx_ia_blocarea(p_detinator uuid, p_secunde int default 60)
returns boolean language plpgsql set search_path = public as $$
begin
  if p_detinator is null then raise exception 'Deținătorul lacătului lipsește.'; end if;
  update public.olx_blocare
     set detinator = p_detinator,
         pana = now() + make_interval(secs => greatest(1, least(coalesce(p_secunde, 60), 300)))
   where unic and pana < now();
  return found;
end $$;

create or replace function public.olx_elibereaza(p_detinator uuid)
returns boolean language plpgsql set search_path = public as $$
begin
  update public.olx_blocare set pana = '-infinity'
   where unic and detinator = p_detinator and pana >= now();
  return found;
end $$;

-- ---------- state-ul OAuth: o singură folosire, 10 minute ----------
-- Întoarce cine a cerut conectarea, sau null dacă state-ul e greșit / expirat / folosit.
-- State-ul merge în CORPUL cererii (RPC), nu într-un filtru din adresă.
create or replace function public.olx_consuma_starea(p_stare text)
returns uuid language plpgsql set search_path = public as $$
declare v_de uuid;
begin
  if p_stare is null or length(p_stare) < 32 then return null; end if;
  update public.olx_cont
     set stare_oauth = null, stare_oauth_expira = null, stare_oauth_de = null
   where unic and stare_oauth = p_stare and stare_oauth_expira > now()
  returning stare_oauth_de into v_de;
  return v_de;
end $$;

revoke execute on function public.olx_ia_blocarea(uuid, int)  from public, anon, authenticated;
revoke execute on function public.olx_elibereaza(uuid)         from public, anon, authenticated;
revoke execute on function public.olx_consuma_starea(text)     from public, anon, authenticated;
grant  execute on function public.olx_ia_blocarea(uuid, int)  to service_role;
grant  execute on function public.olx_elibereaza(uuid)         to service_role;
grant  execute on function public.olx_consuma_starea(text)     to service_role;

-- ---------- jurnalul apelurilor ----------
create table if not exists public.olx_apeluri (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  tip         text not null,
  metoda      text,
  cale        text,
  product_id  bigint,
  http_status int,
  durata_ms   int,
  eroare      text,
  de          uuid
);
create index if not exists olx_apeluri_created_idx on public.olx_apeluri (created_at desc);
alter table public.olx_apeluri enable row level security;
revoke all on table public.olx_apeluri from public, anon, authenticated;
grant select on table public.olx_apeluri to authenticated;
grant select, insert, delete on table public.olx_apeluri to service_role;
drop policy if exists "olx_apeluri citire echipa" on public.olx_apeluri;
create policy "olx_apeluri citire echipa" on public.olx_apeluri
  for select to authenticated using (public.is_staff());

-- ---------- catalogul de categorii OLX ----------
create table if not exists public.olx_categorii (
  id            int primary key,
  nume          text not null,
  parent_id     int,
  is_leaf       boolean not null default false,
  photos_limit  int,
  cale          text,
  atribute      jsonb,
  atribute_la   timestamptz,
  adus_la       timestamptz not null default now()
);
create index if not exists olx_categorii_parent_idx on public.olx_categorii (parent_id);
alter table public.olx_categorii enable row level security;
revoke all on table public.olx_categorii from public, anon, authenticated;
grant select on table public.olx_categorii to authenticated;
grant select, insert, update, delete on table public.olx_categorii to service_role;
drop policy if exists "olx_categorii citire echipa" on public.olx_categorii;
create policy "olx_categorii citire echipa" on public.olx_categorii
  for select to authenticated using (public.is_staff());

-- ---------- potrivirea categoriilor ----------
-- Ordinea folosită de generator (pasul 2): subcategoria piesei → categoria ei → fără (nu se publică).
-- `atribute`: [{ "code": "...", "value": "..." }] — valorile atributelor cerute de frunza OLX.
create table if not exists public.olx_mapari (
  categorie_id      bigint primary key references public.categories(id) on delete cascade,
  olx_categorie_id  int not null,
  atribute          jsonb not null default '[]'::jsonb check (jsonb_typeof(atribute) = 'array'),
  actualizat_la     timestamptz not null default now(),
  actualizat_de     uuid default auth.uid()
);
alter table public.olx_mapari enable row level security;
revoke all on table public.olx_mapari from public, anon;
grant select, insert, update, delete on table public.olx_mapari to authenticated;
grant select, insert, update, delete on table public.olx_mapari to service_role;
drop policy if exists "olx_mapari citire echipa" on public.olx_mapari;
create policy "olx_mapari citire echipa" on public.olx_mapari
  for select to authenticated using (public.is_staff());
drop policy if exists "olx_mapari scriere admin" on public.olx_mapari;
create policy "olx_mapari scriere admin" on public.olx_mapari
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
