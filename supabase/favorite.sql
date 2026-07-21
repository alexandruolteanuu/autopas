-- ============================================================
-- AUTOPAS — FAVORITE (rulează AL OPTULEA)
-- Model hibrid: funcționează local pentru oricine; dacă utilizatorul
-- e autentificat, lista se salvează în cont și îl urmează pe orice dispozitiv.
-- ============================================================

create table if not exists favorites (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id bigint not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);
create index if not exists favorites_user_idx on favorites (user_id);

alter table favorites enable row level security;

drop policy if exists "favorite proprii citire" on favorites;
create policy "favorite proprii citire" on favorites for select using (auth.uid() = user_id);

drop policy if exists "favorite proprii inserare" on favorites;
create policy "favorite proprii inserare" on favorites for insert with check (auth.uid() = user_id);

drop policy if exists "favorite proprii stergere" on favorites;
create policy "favorite proprii stergere" on favorites for delete using (auth.uid() = user_id);
