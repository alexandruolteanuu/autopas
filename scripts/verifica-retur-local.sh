#!/usr/bin/env bash
# ============================================================
# RETURUL, CAP-COADĂ, LOCAL — formularul public, panoul din admin, e-mailul.
#
# Ce pornește (totul de unică folosință, șters la final):
#   · Postgres 17 + PostgREST în Docker = imitația minimă a Supabase; peste ea
#     rulează migrările REALE supabase/retur-fan.sql (46) și email-automat.sql
#     (triggerul de e-mail; pg_net imitat — cererea se scrie într-un tabel);
#   · site-ul, cu `next dev` pe portul 3100, dintr-o COPIE a codului (fișierele
#     din git, cu modificările necomise) — FĂRĂ .env.local, deci fără cheile de
#     producție. În plus, o pază preîncărcată aruncă eroare la orice cerere spre
#     supabase.co și prinde e-mailurile către Brevo într-un fișier (nu pleacă);
#   · FAN = contul lor PUBLIC de probă (clienttest@fancourier.ro), ca
#     scripts/verifica-retur-fan.mjs. AWB-urile create se șterg toate la final.
#
# Ce verifică (scripts/verifica-retur-local.mjs, ~59 de verificări): refuzurile
# formularului, AWB-ul generat pe loc, cine plătește după motiv, coletul luat din
# livrare, e-mailul cu AWB-ul, un singur AWB pe comandă; în admin: 401 fără echipă,
# PDF-ul, „Modifică” (AWB nou, vechiul șters, e-mail cu cel nou; refuzul FAN lasă
# vechiul neatins), „Șterge”, „Generează manual”.
#
# Ce NU poate verifica: anularea REALĂ a comenzii de curier — pe contul de probă
# FAN orice comandă nouă răspunde deja „already deleted”. Aia se vede doar pe
# contul nostru, la prima probă (selfawb.ro → comenzi de curier).
#
# Folosire: scripts/verifica-retur-local.sh   (cere Docker). Iese cu 1 la picare.
# Înainte: oprește `npm run dev` dacă rulează pe 3100.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")/.."
RAD=$(pwd)
T=$(mktemp -d)
PG=pg-retur-local; PR=pgrst-retur-local; NET=retur-local-net
JWT=secret-jwt-local-de-cel-putin-32-caractere-xx
PIDS=()
curata() {
  for p in "${PIDS[@]}"; do kill "$p" 2>/dev/null; done
  # `next dev` lasă un proces-copil; îl oprim după portul lui.
  for p in $(ss -ltnp 2>/dev/null | awk '/:3100 /' | grep -o 'pid=[0-9]*' | cut -d= -f2); do kill "$p" 2>/dev/null; done
  docker rm -f "$PG" "$PR" >/dev/null 2>&1; docker network rm "$NET" >/dev/null 2>&1
  rm -rf "$T"
}
trap curata EXIT
picat() { echo "PICAT: $*"; exit 1; }

# ---------- baza ----------
docker rm -f "$PG" "$PR" >/dev/null 2>&1; docker network rm "$NET" >/dev/null 2>&1
docker network create "$NET" >/dev/null || picat "Docker nu merge"
docker run -d --name "$PG" --network "$NET" -e POSTGRES_PASSWORD=local postgres:17 >/dev/null || picat "Postgres"
for _ in $(seq 1 40); do docker exec "$PG" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done; sleep 2
P() { docker exec -i "$PG" psql -U postgres -q -v ON_ERROR_STOP=1 "$@"; }
P >/dev/null <<'SQL' || picat "imitația Supabase"
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create role authenticator login password 'local' noinherit; grant anon, authenticated, service_role to authenticator;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
create schema auth; grant usage on schema auth to anon, authenticated, service_role;
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid $$;
create table profiles (id uuid primary key, email text, role text not null default 'client');
create function public.is_staff() returns boolean language sql stable security definer set search_path=public as
  $$ select exists(select 1 from profiles where id = auth.uid() and role in ('admin','operator','contabil')) $$;
grant execute on function public.is_staff() to anon, authenticated, service_role;
create schema net; grant usage on schema net to anon, authenticated, service_role;
create table net.cereri (id bigserial primary key, url text, headers jsonb, la timestamptz default clock_timestamp());
grant all on net.cereri to anon, authenticated, service_role; grant all on sequence net.cereri_id_seq to anon, authenticated, service_role;
create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000)
  returns bigint language sql as $$ insert into net.cereri (url, headers) values (url, headers) returning id $$;
-- Coloanele, ca în schema.sql + admin.sql + awb-fancourier.sql (doar cele folosite de retur).
create table orders (
  id bigint generated always as identity primary key, numar text unique not null,
  tip_client text not null default 'pf', nume text not null, email text not null, telefon text not null,
  adresa text not null, oras text not null, judet text not null, curier text not null default 'fan',
  plata text not null default 'ramburs', subtotal numeric(10,2) not null default 100, livrare numeric(10,2) not null default 0,
  total numeric(10,2) not null default 100, status text not null default 'noua', awb_date jsonb,
  created_at timestamptz not null default now());
create table return_requests (
  id bigint generated always as identity primary key, numar_comanda text not null,
  nume text not null, email text not null, telefon text, produs text not null, motiv text not null, iban text,
  created_at timestamptz not null default now(),
  status text not null default 'noua' check (status in ('noua','in_lucru','rezolvata','respinsa')), nota text);
create table part_requests (id bigint generated always as identity primary key, nume text, telefon text, email text);
create table car_intake_requests (id bigint generated always as identity primary key, nume text, telefon text, email text);
create table contact_messages (id bigint generated always as identity primary key, nume text, email text);
create table settings (cheie text primary key, valoare jsonb not null);
alter table return_requests enable row level security; alter table settings enable row level security;
alter table orders enable row level security;
SQL
P < supabase/retur-fan.sql >/dev/null || picat "migrarea 46 (retur-fan.sql)"
sed 's/^create extension if not exists pg_net.*$//' supabase/email-automat.sql | P >/dev/null 2>&1 || picat "email-automat.sql"
docker run -d --name "$PR" --network "$NET" -p 3001:3000 \
  -e PGRST_DB_URI="postgres://authenticator:local@$PG:5432/postgres" -e PGRST_DB_SCHEMAS=public \
  -e PGRST_DB_ANON_ROLE=anon -e PGRST_JWT_SECRET="$JWT" postgrest/postgrest:v12.2.3 >/dev/null || picat "PostgREST"
echo "ok   baza locală + migrarea 46 + triggerul de e-mail"

# ---------- paza, proxy-ul, site-ul ----------
cat > "$T/garda.mjs" <<'JS'
import { appendFileSync } from "node:fs";
const orig = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input?.url ?? String(input);
  if (/supabase\.co/i.test(url)) throw new Error("GARDA: cerere spre Supabase-ul de producție blocată: " + url);
  if (/api\.brevo\.com/i.test(url)) {
    appendFileSync(process.env.EMAILURI_PRINSE, JSON.stringify(JSON.parse(String(init?.body ?? "{}"))) + "\n");
    return new Response(JSON.stringify({ messageId: "local" }), { status: 201, headers: { "Content-Type": "application/json" } });
  }
  return orig(input, init);
};
JS
cat > "$T/proxy.mjs" <<'JS'
import http from "node:http";
http.createServer((req, res) => {
  const p = http.request({ host: "127.0.0.1", port: 3001, path: req.url.replace(/^\/rest\/v1/, "") || "/", method: req.method,
    headers: { ...req.headers, host: "127.0.0.1:3001" } }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
  p.on("error", (e) => { res.writeHead(502); res.end(String(e)); });
  req.pipe(p);
}).listen(54321);
JS
tok() { node -e '
  const c=require("crypto"),b=o=>Buffer.from(JSON.stringify(o)).toString("base64url");
  const h=b({alg:"HS256",typ:"JWT"}),p=b({role:process.argv[1],exp:Math.floor(Date.now()/1000)+86400});
  console.log(h+"."+p+"."+c.createHmac("sha256",process.argv[2]).update(h+"."+p).digest("base64url"))' "$1" "$JWT"; }
ANON=$(tok anon); SR=$(tok service_role)
: > "$T/emailuri.jsonl"
mkdir "$T/site"
# Fișierele din git (cu modificările necomise); .env.local e în .gitignore, deci rămâne afară.
git ls-files -co --exclude-standard -z | tar --null -T - -cf - | tar -xf - -C "$T/site"
[ -e "$T/site/.env.local" ] && picat ".env.local a ajuns în copie"
ln -s "$RAD/node_modules" "$T/site/node_modules"
node "$T/proxy.mjs" & PIDS+=($!)
( cd "$T/site" && NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON" \
  SUPABASE_SERVICE_ROLE_KEY="$SR" NEXT_PUBLIC_SITE_URL=http://localhost:3100 EMAILURI_PRINSE="$T/emailuri.jsonl" \
  NODE_OPTIONS="--import $T/garda.mjs" exec npx next dev -p 3100 > "$T/next.log" 2>&1 ) & PIDS+=($!)
curl -s --retry 40 --retry-connrefused --retry-delay 3 --max-time 300 http://localhost:3100/api/retur | grep -q '"ok":true' \
  || { tail -20 "$T/next.log"; picat "site-ul local nu pornește"; }
echo "ok   site-ul local pornit (fără .env.local, cu paza pe supabase.co)"

# ---------- testele ----------
VR_TMP="$T" VR_PG="$PG" VR_JWT="$JWT" node scripts/verifica-retur-local.mjs
COD=$?
grep -q "GARDA" "$T/next.log" && { echo "PICAT: site-ul a încercat să cheme Supabase-ul de producție"; COD=1; }
exit $COD
