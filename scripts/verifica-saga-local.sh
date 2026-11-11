#!/usr/bin/env bash
# ============================================================
# VERIFICĂRILE SAGA CARE NU SE POT FACE PE PRODUCȚIE — local, în Docker
#
# Pornește un Postgres 17 de unică folosință, îl îmbracă în imitația minimă a
# Supabase (scripts/saga-local/stub-supabase.sql), încarcă `sterge_comanda`
# EXACT din supabase/admin-fix.sql și date FICTIVE (scripts/saga-local/), aplică
# migrările SAGA 47–52, apoi:
#   1. rulează aceleași teste ca pe producție (verifica-saga-*.sql);
#   2. CONCURENȚA: 20 de `emite_factura` pornite simultan → 20 de numere
#      distincte și consecutive, contorul exact după ele;
#   3. aceeași comandă emisă de două ori simultan → o singură factură;
#   4. ORA-LIMITĂ: comanda de la 00:30 ora României (22:30 UTC, ziua dinainte)
#      e acceptată, cea de la 23:30 ora României din ziua dinainte e refuzată;
#   5. `sterge_comanda` pe o comandă facturată → refuzată, stocul neatins;
#   6. anularea migrării 49 refuză cât timp există facturi;
#   7. LACĂTUL SAGA (migrarea 52): 20 de `saga_ia_blocarea` simultane → exact una
#      reușește; anularea migrării 52 șterge tot, iar re-rularea o reface.
# La final containerul se șterge. Nu atinge nicio bază reală.
#
# Folosire: scripts/verifica-saga-local.sh   (cere Docker)
# Iese cu cod 1 la prima verificare picată.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")/.."

C=pg-saga-local
docker rm -f "$C" >/dev/null 2>&1
docker run -d --name "$C" -e POSTGRES_PASSWORD=local postgres:17 >/dev/null || { echo "Nu pot porni Docker."; exit 1; }
trap 'docker rm -f "$C" >/dev/null 2>&1' EXIT
for _ in $(seq 1 40); do docker exec "$C" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done; sleep 1

P()  { docker exec -i "$C" psql -U postgres -q -v ON_ERROR_STOP=1 "$@"; }
Q()  { docker exec "$C" psql -U postgres -tA -c "$1"; }
picat() { echo "PICAT: $*"; exit 1; }
ok()    { echo "ok   $*"; }

# Contabilul fictiv din date-fictive.sql emite factura comenzii cu numărul dat.
emite() {
  docker exec -i "$C" psql -U postgres -tA -q 2>&1 <<SQL | grep -v '^{"sub\|^CONTEXT'
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","email":"contabil@test.local"}', false);
select emite_factura((select id from orders where numar='$1'));
SQL
}

P < scripts/saga-local/stub-supabase.sql >/dev/null 2>&1 || picat "imitația Supabase"
python3 - <<'PY' | P >/dev/null || picat "sterge_comanda din admin-fix.sql"
s = open('supabase/admin-fix.sql', encoding='utf-8').read()
i = s.index('create or replace function public.sterge_comanda')
print(s[i:s.index('grant execute on function public.sterge_comanda', i)])
PY
P < scripts/saga-local/date-fictive.sql >/dev/null 2>&1 || picat "datele fictive"
for m in saga-calcul saga-export saga-facturi saga-articole saga-emitere saga-api; do
  P < "supabase/$m.sql" >/dev/null 2>&1 || picat "migrarea $m"
  P < "supabase/$m.sql" >/dev/null 2>&1 || picat "migrarea $m, a doua rulare (idempotență)"
done
ok "migrările 47–52 (fiecare rulată de două ori)"

# 1. Testele de producție
for t in calcul export facturi articole emitere api; do
  r="$(P < "scripts/verifica-saga-$t.sql" 2>&1)"
  grep -q "REZULTAT OK" <<<"$r" || picat "verifica-saga-$t.sql: $(grep -m1 -o 'VERIFICARE PICATĂ.*\|ERROR:.*' <<<"$r")"
  ok "verifica-saga-$t.sql — $(grep -o 'toate cele [0-9]* d*e* *verificări' <<<"$r")"
done

# Setările probei (comise — containerul e de unică folosință).
Q "update settings set valoare = valoare || '{\"saga\":{\"cota_tva\":\"21\",\"data_start_facturare\":\"2026-11-09\",\"articol_implicit\":\"ART1\",\"articol_implicit_denumire\":\"ACCESORII AUTO\",\"mentiune_plata\":\"ramburs in cont\"}}' where cheie='integrari'" >/dev/null
docker exec -i "$C" psql -U postgres -tA -q >/dev/null <<'SQL'
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', false);
select seteaza_serie_factura('PROBA', 14193);
SQL

# 2. Concurența
for g in $(seq 1 20); do emite "$(printf 'C-%04d' "$g")" > "/tmp/saga-local-$g.out" & done; wait
reusite=$(cat /tmp/saga-local-*.out | grep -c '"ok" : true'); rm -f /tmp/saga-local-*.out
[ "$reusite" = 20 ] || picat "concurență: $reusite din 20 de emiteri reușite"
r=$(Q "select count(distinct numar), min(numar), max(numar), (select urmator from facturi_serii where serie='PROBA') from facturi where serie='PROBA'")
[ "$r" = "20|14193|14212|14213" ] || picat "concurență: numerele nu sunt 14193–14212 fără goluri (am: $r)"
ok "concurență: 20 de emiteri simultane → numerele 14193–14212, fără goluri, contorul 14213"

# 3. Aceeași comandă, de două ori simultan
emite T-0001 > /tmp/saga-local-a.out & emite T-0001 > /tmp/saga-local-b.out; wait
n=$(Q "select count(*) from facturi f join orders o on o.id=f.order_id where o.numar='T-0001'"); rm -f /tmp/saga-local-[ab].out
[ "$n" = 1 ] || picat "aceeași comandă emisă simultan: $n facturi"
ok "aceeași comandă, simultan → o singură factură"

# 4. Ora-limită (data de start: 9 noiembrie 2026)
emite Z-0001 | grep -q '"ok" : true' || picat "comanda de la 00:30 ora României, pe 9 noiembrie, trebuia acceptată"
emite Z-0002 | grep -q 'înainte de data de start' || picat "comanda de la 23:30 ora României, pe 8 noiembrie, trebuia refuzată"
ok "ora-limită: 00:30 RO (22:30 UTC ziua dinainte) acceptată, 23:30 RO ziua dinainte refuzată"

# 5. sterge_comanda pe o comandă facturată
st0=$(Q "select stoc from products where id=1")
r=$(docker exec -i "$C" psql -U postgres -tA -q 2>&1 <<'SQL'
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);
select sterge_comanda((select id from orders where numar='T-0001'));
SQL
)
grep -q comanda_facturata_nu_se_poate_sterge <<<"$r" || picat "sterge_comanda pe o comandă facturată nu a fost oprită"
[ "$(Q "select stoc from products where id=1")" = "$st0" ] || picat "sterge_comanda oprită a lăsat stocul modificat"
ok "sterge_comanda pe o comandă facturată → oprită, stocul neatins"

# 6. Anularea refuză cât există facturi
r="$(P < scripts/anuleaza-saga-facturi.sql 2>&1)"   # psql iese cu eroare: refuzul e chiar rezultatul așteptat
grep -q "OPRIT: există facturi" <<<"$r" || picat "anularea migrării 49 nu a refuzat"
[ "$(Q "select to_regclass('public.facturi') is not null")" = t ] || picat "anularea a șters tabela facturi"
ok "anularea migrării 49 refuză cât timp există facturi"

# 7. Lacătul SAGA: 20 de cereri simultane, exact una îl primește
Q "update saga_blocare set detinator = null, pana = '-infinity'" >/dev/null
for g in $(seq 1 20); do Q "select saga_ia_blocarea(gen_random_uuid(), 90)" > "/tmp/saga-lacat-$g.out" & done; wait
reusite=$(cat /tmp/saga-lacat-*.out | grep -c '^t$'); rm -f /tmp/saga-lacat-*.out
[ "$reusite" = 1 ] || picat "lacătul SAGA: $reusite din 20 de cereri simultane l-au primit (trebuia exact 1)"
ok "lacătul SAGA: 20 de cereri simultane → exact una îl primește"
P < scripts/anuleaza-saga-api.sql >/dev/null 2>&1 || picat "anularea migrării 52"
[ "$(Q "select to_regclass('public.saga_cheie') is null and to_regclass('public.saga_trimiteri') is null")" = t ] || picat "anularea migrării 52 a lăsat tabele"
P < supabase/saga-api.sql >/dev/null 2>&1 || picat "re-rularea migrării 52 după anulare"
ok "anularea migrării 52 șterge tot; re-rularea o reface"

echo "TOATE VERIFICĂRILE LOCALE AU TRECUT"
