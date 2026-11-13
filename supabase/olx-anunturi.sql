-- ============================================================
-- MIGRAREA 57 — OLX: ANUNȚURILE (pasul 2 din docs/olx-plan.md)
--
-- Doar obiecte NOI. Depinde de 56 (olx_*) și de `products`, `is_staff()`. Idempotentă.
--
-- `olx_anunturi`: o piesă → cel mult UN anunț (`product_id` UNIC). Rândul se
-- REVENDICĂ înainte de a cere OLX-ului un anunț nou (status „in_curs”), deci două
-- apăsări / două procese nu pot crea două anunțuri pentru aceeași piesă. A doua
-- plasă e în cod: înainte de POST se caută anunțul pe OLX după `external_id`.
--
-- `on delete set null` pe piesă, NU cascade (lecția dez.ro): dacă piesa se șterge,
-- rândul cu `advert_id` rămâne, ca anunțul să poată fi retras la OLX.
-- Scriere: doar serverul (`service_role`). Citire: echipa.
-- Anularea: scripts/anuleaza-olx-anunturi.sql. Testul: scripts/verifica-olx-anunturi.sql.
-- ============================================================
create table if not exists public.olx_anunturi (
  id              bigint generated always as identity primary key,
  product_id      bigint unique references public.products(id) on delete set null,
  cod_intern      text,
  advert_id       bigint unique,
  status          text not null default 'in_curs',
  url             text,
  valid_to        timestamptz,
  motiv_moderare  text,
  amprenta        text,
  eroare          text,
  publicat_la     timestamptz,
  actualizat_la   timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
comment on table public.olx_anunturi is
  'OLX: piesă → anunț (unul singur pe piesă). Scris doar de server (lib/olx-publicare.mjs).';
create index if not exists olx_anunturi_status_idx on public.olx_anunturi (status);
alter table public.olx_anunturi enable row level security;
revoke all on table public.olx_anunturi from public, anon, authenticated;
grant select on table public.olx_anunturi to authenticated;
grant select, insert, update, delete on table public.olx_anunturi to service_role;
drop policy if exists "olx_anunturi citire echipa" on public.olx_anunturi;
create policy "olx_anunturi citire echipa" on public.olx_anunturi
  for select to authenticated using (public.is_staff());
