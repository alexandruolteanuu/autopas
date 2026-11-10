-- ============================================================
-- MEDIUL LOCAL DE TEST SAGA — imitația minimă a Supabase (rolurile, auth.uid(),
-- auth.jwt(), drepturile implicite) plus tabelele EXISTENTE pe care le ating
-- migrările SAGA, doar cu coloanele folosite. Rulează DOAR în containerul Docker
-- pornit de scripts/verifica-saga-local.sh. NU se rulează niciodată pe Supabase.
-- ============================================================
create schema extensions; create extension unaccent with schema extensions;
create extension if not exists pgcrypto;
create role anon nologin; create role authenticated nologin; create role service_role nologin;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;  -- ca pe Supabase
create schema auth; grant usage on schema auth to anon, authenticated;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                         (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim', true), ''), nullif(current_setting('request.jwt.claims', true), ''))::jsonb $$;
grant execute on all functions in schema auth to anon, authenticated;
create or replace function public.text_cautare(t text) returns text language sql immutable parallel safe as $$ select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, ''))) $$;

create table profiles (id uuid primary key, email text, role text not null default 'client', created_at timestamptz default now());
create function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from profiles where id = auth.uid() and role = 'admin') $$;
create function public.is_staff() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from profiles where id = auth.uid() and role in ('admin','operator','contabil')) $$;
create table settings (cheie text primary key, valoare jsonb not null);
create table categories (id bigint generated always as identity primary key, slug text unique not null, nume text not null, parent_id bigint references categories(id));
create table products (id bigint generated always as identity primary key, cod_intern text, stoc int default 0, publicat boolean default true,
  categorie_id bigint references categories(id), subcategorie_id bigint references categories(id));
create table orders (id bigint generated always as identity primary key, numar text unique not null, tip_client text not null default 'pf',
  nume text not null, email text not null, telefon text not null, firma text, cui text, adresa text not null, oras text not null, judet text not null,
  curier text not null default 'fan', plata text not null default 'ramburs', subtotal numeric(10,2) not null, livrare numeric(10,2) not null,
  total numeric(10,2) not null, status text not null default 'noua', gdpr boolean default false, created_at timestamptz not null default now(),
  discount_cod text, discount_valoare numeric(10,2) not null default 0, factura_serie text, factura_status text not null default 'de_emis');
create table order_items (id bigint generated always as identity primary key, order_id bigint not null references orders(id) on delete cascade,
  product_id bigint references products(id), nume text not null, pret numeric(10,2) not null, cantitate int not null default 1);
create table order_events (id bigint generated always as identity primary key, order_id bigint references orders(id) on delete cascade,
  tip text not null, mesaj text, autor text, created_at timestamptz default now());
