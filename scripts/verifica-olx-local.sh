#!/usr/bin/env bash
# ============================================================
# VERIFICĂRILE MIGRĂRII 58 (OLX, coada automată) CARE NU SE POT FACE PE PRODUCȚIE — local, în Docker
#
# Postgres 17 de unică folosință, imitația minimă a Supabase + a lui pg_net (net.http_post
# scrie cererea într-un tabel, nu trimite nimic), migrarea 57 și 58 (de DOUĂ ori), apoi:
#   1. pre-verificarea (5 × true înainte de 58);
#   2. testul de producție scripts/verifica-olx-coada.sql și cel al migrării 57, cu 58 activă;
#   3. INSERT: piesa publicată cu stoc intră în coadă, cea nepublicată nu;
#   4. trezirea pornită cheamă adresa cu secretul în antet; o modificare de piesă NU pică dacă
#      trezirea aruncă eroare (pg_net căzut) — și nici dacă tabela cozii lipsește;
#   5. LACĂTUL LOTULUI: 20 de cereri simultane → exact una îl primește;
#   6. anularea (fără cascade) și re-rularea; `retras_la` supraviețuiește anulării.
# Containerul se șterge la final. Nu atinge nicio bază reală.
# Folosire: scripts/verifica-olx-local.sh   (cere Docker). Iese cu cod 1 la prima picare.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")/.."

C=pg-olx-local
docker rm -f "$C" >/dev/null 2>&1
docker run -d --name "$C" -e POSTGRES_PASSWORD=local postgres:17 >/dev/null || { echo "Nu pot porni Docker."; exit 1; }
trap 'docker rm -f "$C" >/dev/null 2>&1' EXIT
for _ in $(seq 1 40); do docker exec "$C" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done; sleep 1

P() { docker exec -i "$C" psql -U postgres -q -v ON_ERROR_STOP=1 "$@"; }
Q() { docker exec "$C" psql -U postgres -tA -c "$1"; }
picat() { echo "PICAT: $*"; exit 1; }
ok()    { echo "ok   $*"; }

# ---------- imitația ----------
P >/dev/null <<'SQL' || picat "imitația Supabase"
create role anon nologin; create role authenticated nologin; create role service_role nologin;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table profiles (id uuid primary key, role text not null default 'client');
create function public.is_staff() returns boolean language sql stable security definer set search_path=public as
  $$ select exists(select 1 from profiles where id = auth.uid() and role in ('admin','operator','contabil')) $$;
create table products (id bigint generated always as identity primary key, nume text, slug text, stare_nota text, ani text,
  compat text[], oem text, cod_intern text, pret_lei numeric(10,2) default 100, pret_sufix text, poze text[], stoc int default 1,
  publicat boolean default true, categorie_id bigint, subcategorie_id bigint, vizualizari int default 0);
create table order_items (id bigint generated always as identity primary key, product_id bigint references products(id));
-- pg_net imitat: cererea se scrie, nu pleacă.
create schema net;
create table net.cereri (id bigserial primary key, url text, headers jsonb, la timestamptz default clock_timestamp());
create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000)
  returns bigint language sql as $$ insert into net.cereri (url, headers) values (url, headers) returning id $$;
insert into products (nume, cod_intern, stoc, publicat) select 'Piesa ' || g, 'AP-' || lpad(g::text, 6, '0'), 1, true from generate_series(1, 30) g;
insert into order_items (product_id) values (1);
SQL
P < supabase/olx-anunturi.sql >/dev/null 2>&1 || picat "migrarea 57"

PRE=$(P -tA < scripts/pre-verifica-olx-coada.sql)
[ "$PRE" = "t|t|t|t|t" ] && ok "pre-verificarea: 5 × true ($PRE)" || picat "pre-verificarea: $PRE"

P < supabase/olx-coada.sql >/dev/null 2>&1 || picat "migrarea 58 (prima rulare)"
P < supabase/olx-coada.sql >/dev/null 2>&1 || picat "migrarea 58 (a doua rulare — nu e idempotentă)"
ok "migrarea 58 rulează de două ori"
[ "$(Q "select (select count(*) from information_schema.triggers where event_object_table='products' and trigger_name like 'olx_la_%') || '|' || (select activ from olx_trezire)")" = "3|false" ] \
  && ok "verificarea finală: 3 triggere, trezirea oprită" || picat "verificarea finală"
Q "delete from olx_coada" >/dev/null

# ---------- testele de producție ----------
OUT=$(P < scripts/verifica-olx-coada.sql 2>&1)
echo "$OUT" | grep -q "REZULTAT OK" && ok "verifica-olx-coada.sql: REZULTAT OK" || picat "verifica-olx-coada.sql: $OUT"
OUT=$(P < scripts/verifica-olx-anunturi.sql 2>&1)
echo "$OUT" | grep -q "REZULTAT OK" && ok "verifica-olx-anunturi.sql (57) trece și cu 58 activă" || picat "testul 57: $OUT"
[ "$(Q "select count(*) from olx_coada") $(Q "select count(*) from net.cereri")" = "0 0" ] && ok "testele n-au lăsat nimic (coadă goală, nicio cerere)" || picat "testele au lăsat urme"

# ---------- 3. INSERT ----------
Q "insert into products (nume, stoc, publicat) values ('noua', 1, true), ('ascunsa', 1, false), ('fara stoc', 0, true)" >/dev/null
[ "$(Q "select string_agg(p.nume, ',') from olx_coada c join products p on p.id = c.product_id")" = "noua" ] \
  && ok "INSERT: doar piesa publicată cu stoc intră în coadă" || picat "INSERT"
[ "$(Q "select count(*) from net.cereri")" = "0" ] && ok "trezirea oprită: nicio cerere" || picat "trezirea oprită a chemat"

# ---------- 4. trezirea pornită, robustețea ----------
Q "update olx_trezire set activ = true, webhook_url = 'https://site.test/api/olx-coada', ultima = '-infinity'" >/dev/null
Q "update products set pret_lei = 120 where id = 2" >/dev/null
[ "$(Q "select count(*) from net.cereri c, olx_trezire t where c.url = 'https://site.test/api/olx-coada' and c.headers->>'x-autopas-olx' = t.webhook_secret")" = "1" ] \
  && ok "trezirea pornită: o cerere, cu secretul în antet" || picat "trezirea pornită"
Q "update products set pret_lei = 130 where id = 3" >/dev/null
[ "$(Q "select count(*) from net.cereri")" = "1" ] && ok "fereastra de 20 s: a doua modificare nu mai bate la ușă" || picat "fereastra"
[ "$(Q "select count(*) from olx_coada where product_id in (2,3)")" = "2" ] && ok "…dar amândouă piesele sunt în coadă" || picat "coada"

Q "alter function net.http_post(text, jsonb, jsonb, jsonb, int) rename to http_post_ascuns" >/dev/null
Q "update olx_trezire set ultima = '-infinity'" >/dev/null
Q "update products set pret_lei = 140 where id = 4" >/dev/null 2>&1 || picat "pg_net căzut a oprit modificarea piesei"
[ "$(Q "select pret_lei::int from products where id = 4")" = "140" ] && ok "pg_net căzut: piesa se salvează" || picat "piesa nesalvată"
[ "$(Q "select eroare like 'trezire eșuată%' from olx_coada where product_id = 4")" = "t" ] && ok "…rândul rămâne în coadă, cu „trezire eșuată” la vedere" || picat "eroarea trezirii"
Q "alter function net.http_post_ascuns(text, jsonb, jsonb, jsonb, int) rename to http_post" >/dev/null

Q "alter table olx_coada rename to olx_coada_ascunsa" >/dev/null
Q "update products set pret_lei = 150 where id = 5" >/dev/null 2>&1 || picat "coada lipsă a oprit modificarea piesei"
[ "$(Q "select pret_lei::int from products where id = 5")" = "150" ] && ok "coada lipsă: piesa se salvează" || picat "piesa nesalvată (coadă lipsă)"
Q "alter table olx_coada_ascunsa rename to olx_coada" >/dev/null

Q "update products set vizualizari = vizualizari + 1 where id = 6" >/dev/null
[ "$(Q "select count(*) from olx_coada where product_id = 6")" = "0" ] && ok "vizualizări: nu intră în coadă" || picat "vizualizări"

Q "insert into olx_anunturi (product_id, advert_id, status) values (7, 7007, 'limited')" >/dev/null
Q "delete from products where id = 7" >/dev/null
[ "$(Q "select count(*) from olx_coada where advert_id = 7007 and product_id is null")" = "1" ] && ok "DELETE: anunțul piesei șterse intră în coadă" || picat "DELETE"
[ "$(Q "select motiv from olx_de_retras where advert_id = 7007")" = "ștearsă" ] && ok "…și apare la „de retras”, ca ștearsă" || picat "olx_de_retras"
Q "delete from products where id = 8" >/dev/null
[ "$(Q "select count(*) from olx_coada where product_id is null")" = "1" ] && ok "DELETE fără anunț: nimic în coadă" || picat "DELETE fără anunț"

# ---------- 5. lacătul sub concurență ----------
Q "select olx_coada_elibereaza()" >/dev/null
for i in $(seq 1 20); do (docker exec "$C" psql -U postgres -tA -c "select olx_coada_ia_lotul(70)" > "/tmp/olx-lacat-$$-$i" 2>&1) & done; wait
LUATE=$(cat /tmp/olx-lacat-$$-* | grep -c '^t$'); rm -f /tmp/olx-lacat-$$-*
[ "$LUATE" = "1" ] && ok "lacătul: 20 de cereri simultane → exact una îl primește" || picat "lacătul: $LUATE au primit"

# ---------- 6. anularea și re-rularea ----------
Q "update olx_anunturi set retras_la = now() where advert_id = 7007" >/dev/null
P < scripts/anuleaza-olx-coada.sql >/dev/null 2>&1 || picat "anularea"
[ "$(Q "select count(*) from information_schema.triggers where trigger_name like 'olx_%'")|$(Q "select to_regclass('olx_coada') is null")" = "0|t" ] \
  && ok "anularea: triggere și coadă scoase" || picat "anularea a lăsat ceva"
[ "$(Q "select retras_la is not null from olx_anunturi where advert_id = 7007")" = "t" ] && ok "anularea: retras_la rămâne" || picat "retras_la pierdut"
Q "update products set pret_lei = 160 where id = 9" >/dev/null 2>&1 || picat "fără 58 piesa nu se mai salvează"
P < supabase/olx-coada.sql >/dev/null 2>&1 || picat "re-rularea după anulare"
OUT=$(P < scripts/verifica-olx-coada.sql 2>&1)
echo "$OUT" | grep -q "REZULTAT OK" && ok "re-rularea după anulare: testul trece" || picat "după re-rulare: $OUT"

echo; echo "REZULTAT OK: verificările locale ale migrării 58 au trecut."
