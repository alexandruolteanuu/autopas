-- ============================================================
-- AUTOPAS — SCHEMA BAZEI DE DATE (rulează PRIMUL, o singură dată)
-- Supabase → SQL Editor → New query → lipește tot → Run
-- ============================================================

-- CATEGORII de piese
create table categories (
  id bigint generated always as identity primary key,
  slug text unique not null,
  nume text not null,
  display_count int not null default 0,   -- numărul afișat pe card (ex. 1.240 piese)
  art text not null default 'engine',      -- ce ilustrație SVG folosește cardul
  ordine int not null default 0
);

-- VEHICULE-SURSĂ (mașinile intrate la dezmembrat)
create table vehicles (
  id bigint generated always as identity primary key,
  slug text unique not null,
  nume text not null,                       -- ex. "VW Passat B7 2.0 TDI"
  an int,
  vin_masca text,                           -- ex. "WVWZZZ3CZ…9917" (nu VIN complet, public)
  piese_listate int not null default 0,
  intrare date not null default now()
);

-- PRODUSE (piesele)
create table products (
  id bigint generated always as identity primary key,
  slug text unique not null,
  nume text not null,
  oem text not null,
  stare char(1) not null check (stare in ('A','B','C')),
  stare_nota text,
  pret_lei numeric(10,2) not null,
  pret_sufix text,                          -- ex. "/ set"
  ani text,                                 -- ex. "2009–2013"
  art text not null default 'engine',       -- ilustrația SVG
  categorie_id bigint references categories(id),
  vehicul_id bigint references vehicles(id),
  compat text[] not null default '{}',      -- lista de compatibilitate
  stoc int not null default 1,
  publicat boolean not null default true,
  created_at timestamptz not null default now()
);

-- COMENZI
create table orders (
  id bigint generated always as identity primary key,
  numar text unique not null,               -- ex. AP-2026-01847
  tip_client text not null default 'pf' check (tip_client in ('pf','firma')),
  nume text not null,
  email text not null,
  telefon text not null,
  firma text, cui text,
  adresa text not null, oras text not null, judet text not null,
  curier text not null,                     -- fan / cargus / sameday
  plata text not null,                      -- ramburs / transfer
  subtotal numeric(10,2) not null,
  livrare numeric(10,2) not null,
  total numeric(10,2) not null,
  status text not null default 'noua',      -- noua / confirmata / expediata / livrata / anulata
  gdpr boolean not null default false,
  created_at timestamptz not null default now()
);

create table order_items (
  id bigint generated always as identity primary key,
  order_id bigint not null references orders(id) on delete cascade,
  product_id bigint references products(id),
  nume text not null,
  pret numeric(10,2) not null,
  cantitate int not null default 1
);

-- CERERI "CAUT O PIESĂ" (home, contact, caută după mașină)
create table part_requests (
  id bigint generated always as identity primary key,
  nume text not null, telefon text not null, email text,
  masina text not null, piesa text not null, mesaj text,
  sursa text not null default 'contact',
  created_at timestamptz not null default now()
);

-- MESAJE DE CONTACT
create table contact_messages (
  id bigint generated always as identity primary key,
  nume text not null, email text not null, telefon text, mesaj text not null,
  created_at timestamptz not null default now()
);

-- CERERI PREDARE MAȘINĂ / PROGRAMUL RABLA
create table car_intake_requests (
  id bigint generated always as identity primary key,
  tip text not null default 'predare' check (tip in ('predare','rabla')),
  nume text not null, telefon text not null, email text,
  masina text not null, an text, vin text, mesaj text,
  created_at timestamptz not null default now()
);

-- CERERI DE RETUR (formularul de retur)
create table return_requests (
  id bigint generated always as identity primary key,
  numar_comanda text not null,
  nume text not null, email text not null, telefon text,
  produs text not null, motiv text not null, iban text,
  created_at timestamptz not null default now()
);

-- PROFILE UTILIZATORI (legat de Supabase Auth) — pentru cont client + rol admin
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nume text,
  role text not null default 'client' check (role in ('client','admin')),
  created_at timestamptz not null default now()
);

-- creare automată de profil la înregistrare
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, nume)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nume',''));
  return new;
end; $$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- funcție: utilizatorul curent este admin?
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- ============================================================
-- SECURITATE (RLS) — cine ce are voie
-- ============================================================
alter table categories enable row level security;
alter table vehicles enable row level security;
alter table products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table part_requests enable row level security;
alter table contact_messages enable row level security;
alter table car_intake_requests enable row level security;
alter table return_requests enable row level security;
alter table profiles enable row level security;

-- catalogul e public la citire
create policy "catalog public" on categories for select using (true);
create policy "vehicule publice" on vehicles for select using (true);
create policy "produse publice" on products for select using (publicat = true or is_admin());

-- oricine poate plasa comenzi și trimite formulare (doar INSERT, fără citire publică)
create policy "comenzi insert" on orders for insert with check (true);
create policy "items insert" on order_items for insert with check (true);
create policy "cereri piese insert" on part_requests for insert with check (true);
create policy "contact insert" on contact_messages for insert with check (true);
create policy "predare insert" on car_intake_requests for insert with check (true);
create policy "retur insert" on return_requests for insert with check (true);

-- clientul autentificat își vede comenzile lui (după email); adminul le vede pe toate
create policy "comenzi citire" on orders for select
  using (is_admin() or (auth.jwt()->>'email') = email);
create policy "items citire" on order_items for select
  using (is_admin() or exists(
    select 1 from orders o where o.id = order_id and (auth.jwt()->>'email') = o.email));

-- doar adminul administrează catalogul, statusurile și vede formularele
create policy "produse admin" on products for all using (is_admin()) with check (is_admin());
create policy "vehicule admin" on vehicles for all using (is_admin()) with check (is_admin());
create policy "categorii admin" on categories for all using (is_admin()) with check (is_admin());
create policy "comenzi admin update" on orders for update using (is_admin());
create policy "cereri admin" on part_requests for select using (is_admin());
create policy "contact admin" on contact_messages for select using (is_admin());
create policy "predare admin" on car_intake_requests for select using (is_admin());
create policy "retur admin" on return_requests for select using (is_admin());

-- profilul: fiecare își vede propriul profil
create policy "profil propriu" on profiles for select using (auth.uid() = id);
