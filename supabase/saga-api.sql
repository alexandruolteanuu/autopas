-- ============================================================
-- MIGRAREA 52 — CLIENTUL API SAGA (pasul 7 din docs/saga-plan.md, 11 noiembrie 2026)
--
-- Doar obiecte NOI. Nu atinge niciun rând, nicio funcție și nicio politică existentă.
-- Depinde de 49 (`is_facturare`). Idempotentă: se poate rula de mai multe ori.
--
--   · `saga_cheie`      — cheia de acces SAGA (cea REALĂ: fără instanță de test,
--                          decizia din 11 noiembrie 2026). RLS pornit, NICIO politică
--                          → nici `anon`, nici `authenticated` (deci nici adminul din
--                          browser) n-o pot citi sau scrie. Doar `service_role`, adică
--                          rutele de server. Se scrie DOAR din admin („Salvează cheia”).
--   · `saga_blocare`    — lacătul: un singur apel spre SAGA o dată. SAGA rotește
--                          cheia uneori; două apeluri paralele ar folosi o cheie
--                          veche și ar bloca-o. Rând unic + `update … where` atomic,
--                          cu termen (90 s > limita de 60 s a unei funcții Vercel),
--                          ca o funcție omorâtă la jumătate să nu blocheze totul.
--   · `saga_trimiteri`  — jurnalul apelurilor. NICIODATĂ cheia. Citit de admin și
--                          contabil, scris doar de server.
--   · funcțiile lacătului, salvarea și rotirea cheii — doar `service_role`. Cheia
--     merge în CORPUL cererii (RPC), nu în adresă: un filtru REST `?cheie=eq.…` ar
--     lăsa cheia în jurnalele de acces ale API-ului.
--
-- Anularea: scripts/anuleaza-saga-api.sql. Verificarea: scripts/verifica-saga-api.sql.
-- ============================================================

-- ---------- cheia ----------
create table if not exists public.saga_cheie (
  unic           boolean primary key default true check (unic),
  cheie          text not null check (length(btrim(cheie)) > 0),
  salvata_la     timestamptz not null default now(),
  salvata_de     uuid,
  rotita_la      timestamptz,
  rotiri         int not null default 0,
  folosita_la    timestamptz,
  blocata_la     timestamptz,
  blocata_motiv  text
);
comment on table public.saga_cheie is
  'Cheia de acces SAGA WEB (reală). Fără politici RLS: doar service_role. Se scrie doar din admin, se rotește doar din lib/saga-api.mjs.';
alter table public.saga_cheie enable row level security;
revoke all on table public.saga_cheie from public, anon, authenticated;
grant select, insert, update, delete on table public.saga_cheie to service_role;

-- ---------- lacătul ----------
create table if not exists public.saga_blocare (
  unic       boolean primary key default true check (unic),
  detinator  uuid,
  pana       timestamptz not null default '-infinity'
);
comment on table public.saga_blocare is
  'Lacătul apelurilor SAGA: un singur apel o dată (rotirea cheii). Expiră singur după termen.';
insert into public.saga_blocare (unic) values (true) on conflict (unic) do nothing;
alter table public.saga_blocare enable row level security;
revoke all on table public.saga_blocare from public, anon, authenticated;
grant select, update on table public.saga_blocare to service_role;

-- ---------- jurnalul ----------
create table if not exists public.saga_trimiteri (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  tip           text not null check (tip in ('test', 'get_articol', 'import')),
  factura_ids   bigint[],
  fisier        text,
  xml           text,
  http_status   int,
  raspuns       text,
  durata_ms     int,
  cheie_rotita  boolean not null default false,
  eroare        text,
  de            uuid
);
comment on table public.saga_trimiteri is
  'Jurnalul apelurilor spre SAGA. Niciodată cheia. Citire: is_facturare(); scriere: doar service_role.';
create index if not exists saga_trimiteri_created_idx on public.saga_trimiteri (created_at desc);
alter table public.saga_trimiteri enable row level security;
revoke all on table public.saga_trimiteri from public, anon, authenticated;
grant select on table public.saga_trimiteri to authenticated;
grant select, insert on table public.saga_trimiteri to service_role;
drop policy if exists "saga_trimiteri citire facturare" on public.saga_trimiteri;
create policy "saga_trimiteri citire facturare" on public.saga_trimiteri
  for select to authenticated using (public.is_facturare());

-- ---------- funcțiile lacătului ----------
-- Atomic: din două cereri simultane, una singură găsește `pana < now()`.
create or replace function public.saga_ia_blocarea(p_detinator uuid, p_secunde int default 90)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  if p_detinator is null then raise exception 'Deținătorul lacătului lipsește.'; end if;
  update public.saga_blocare
     set detinator = p_detinator,
         pana = now() + make_interval(secs => greatest(1, least(coalesce(p_secunde, 90), 300)))
   where unic and pana < now();
  return found;
end $$;

-- Doar cel care a luat lacătul îl poate elibera.
create or replace function public.saga_elibereaza(p_detinator uuid)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  update public.saga_blocare set pana = '-infinity'
   where unic and detinator = p_detinator and pana >= now();
  return found;
end $$;

-- ---------- salvarea și rotirea cheii ----------
-- Salvarea din admin: pune cheia, șterge marcajul de blocare, numărătoarea de rotiri
-- repornește. Ruta o cheamă DOAR sub lacăt (altfel un apel în curs ar rota cheia veche).
create or replace function public.saga_salveaza_cheia(p_cheie text, p_de uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  if p_cheie is null or length(btrim(p_cheie)) < 10 or p_cheie ~ '\s' then
    raise exception 'Cheia SAGA pare greșită (goală, prea scurtă sau cu spații).';
  end if;
  insert into public.saga_cheie (unic, cheie, salvata_la, salvata_de, rotita_la, rotiri, folosita_la, blocata_la, blocata_motiv)
  values (true, p_cheie, now(), p_de, null, 0, null, null, null)
  on conflict (unic) do update
     set cheie = excluded.cheie, salvata_la = now(), salvata_de = excluded.salvata_de,
         rotita_la = null, rotiri = 0, folosita_la = null, blocata_la = null, blocata_motiv = null;
end $$;

-- Rotirea (antetul X-Saga-Refresh-Token): înlocuiește cheia DOAR dacă e încă cea
-- folosită la apel. Întoarce false dacă între timp s-a schimbat (nu ar trebui: totul
-- e sub lacăt) — apelantul raportează, nu ghicește.
create or replace function public.saga_roteste_cheia(p_veche text, p_noua text)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  if p_noua is null or length(btrim(p_noua)) = 0 then return false; end if;
  update public.saga_cheie
     set cheie = p_noua, rotita_la = now(), rotiri = rotiri + 1, blocata_la = null, blocata_motiv = null
   where unic and cheie = p_veche;
  return found;
end $$;

-- Drepturile: pe Supabase funcțiile noi primesc drept DIRECT pentru `anon`, deci
-- `revoke … from public` singur NU ajunge (lecția din migrarea 42).
revoke execute on function public.saga_ia_blocarea(uuid, int)     from public, anon, authenticated;
revoke execute on function public.saga_elibereaza(uuid)           from public, anon, authenticated;
revoke execute on function public.saga_salveaza_cheia(text, uuid) from public, anon, authenticated;
revoke execute on function public.saga_roteste_cheia(text, text)  from public, anon, authenticated;
grant  execute on function public.saga_ia_blocarea(uuid, int)     to service_role;
grant  execute on function public.saga_elibereaza(uuid)           to service_role;
grant  execute on function public.saga_salveaza_cheia(text, uuid) to service_role;
grant  execute on function public.saga_roteste_cheia(text, text)  to service_role;
