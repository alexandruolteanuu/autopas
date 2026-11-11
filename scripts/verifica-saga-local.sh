#!/usr/bin/env bash
# ============================================================
# VERIFICĂRILE SAGA CARE NU SE POT FACE PE PRODUCȚIE — local, în Docker
#
# Pornește un Postgres 17 de unică folosință, îl îmbracă în imitația minimă a
# Supabase (scripts/saga-local/stub-supabase.sql), încarcă `sterge_comanda`
# EXACT din supabase/admin-fix.sql și date FICTIVE (scripts/saga-local/), aplică
# migrările SAGA 47–54, apoi:
#   1. rulează aceleași teste ca pe producție (verifica-saga-*.sql);
#   2. CONCURENȚA: 20 de `emite_factura` pornite simultan → 20 de numere
#      distincte și consecutive, contorul exact după ele;
#   3. aceeași comandă emisă de două ori simultan → o singură factură;
#   4. ORA-LIMITĂ: comanda de la 00:30 ora României (22:30 UTC, ziua dinainte)
#      e acceptată, cea de la 23:30 ora României din ziua dinainte e refuzată;
#   5. `sterge_comanda` pe o comandă facturată → refuzată, stocul neatins;
#   6. anularea migrării 49 refuză cât timp există facturi;
#   7. LACĂTUL SAGA (migrarea 52): 20 de `saga_ia_blocarea` simultane → exact una
#      reușește; anularea migrării 52 șterge tot, iar re-rularea o reface;
#   8. trecerile de stare folosite de trimitere (pasul 8), pe triggerul real;
#   9. STORNAREA (migrarea 53): aceeași factură stornată de două ori simultan → un
#      singur storno; anularea 53 lasă documentele, re-rularea o reface;
#  10. REFACTURAREA (migrarea 54): două refacturări simultane pe aceeași comandă
#      stornată → o singură factură nouă; anularea 54 refuză cât există o refacturare,
#      iar pe o bază fără refacturări pune înapoi exact versiunile din 51 și 49;
#  11. „ȘTERGE” PE COMENZILE CU FACTURĂ (migrarea 55): testele de producție, două
#      apăsări simultane, anularea (refuză cu comenzi ascunse) și re-rularea.
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
for m in saga-calcul saga-export saga-facturi saga-articole saga-emitere saga-api saga-stornare saga-refacturare; do
  P < "supabase/$m.sql" >/dev/null 2>&1 || picat "migrarea $m"
  P < "supabase/$m.sql" >/dev/null 2>&1 || picat "migrarea $m, a doua rulare (idempotență)"
done
ok "migrările 47–54 (fiecare rulată de două ori)"

# 1. Testele de producție
for t in calcul export facturi articole emitere api stornare refacturare; do
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

# 8. Trecerile de stare folosite de trimitere (pasul 8), pe triggerul REAL din 49
r=$(docker exec -i "$C" psql -U postgres -tA -q -v ON_ERROR_STOP=1 2>&1 <<'SQL'
do $$
declare v bigint; e boolean; t timestamptz;
begin
  select id into v from facturi where saga_status = 'de_trimis' order by id limit 1;
  update facturi set saga_status = 'in_curs' where id = v and saga_status = 'de_trimis';          -- revendicare
  update facturi set saga_status = 'de_trimis', saga_eroare = 'lacat ocupat' where id = v;        -- revenire
  update facturi set saga_status = 'in_curs' where id = v;
  update facturi set saga_status = 'eroare', saga_eroare = 'Rezultat necunoscut' where id = v;    -- timeout
  update facturi set saga_status = 'in_curs' where id = v and saga_status = 'eroare';
  begin update facturi set mentiune_plata = 'alta' where id = v; e := false; exception when others then e := true; end;
  if not e then raise exception 'PICAT: conținutul s-a schimbat cât factura e in_curs'; end if;
  select updated_at into t from facturi where id = v;
  update facturi set saga_status = 'in_curs' where id = v and saga_status = 'in_curs' and updated_at = t;  -- „in_curs” uitat, CAS
  if not found then raise exception 'PICAT: revendicarea unui in_curs după updated_at'; end if;
  update facturi set saga_status = 'trimisa', saga_eroare = null, saga_trimisa_la = now() where id = v;
  begin update facturi set saga_status = 'eroare' where id = v; e := false; exception when others then e := true; end;
  if not e then raise exception 'PICAT: o factură trimisă a putut trece în eroare'; end if;
  begin update facturi set saga_status = 'in_curs' where id = v; e := false; exception when others then e := true; end;
  if not e then raise exception 'PICAT: o factură trimisă a putut fi revendicată din nou'; end if;
  update facturi set saga_status = 'confirmata', confirmata_la = now() where id = v and saga_status = 'trimisa';
  begin update facturi set saga_status = 'trimisa' where id = v; e := false; exception when others then e := true; end;
  if not e then raise exception 'PICAT: o factură confirmată a dat înapoi'; end if;
  raise notice 'TRECERI OK';
end $$;
SQL
)
grep -q "TRECERI OK" <<<"$r" || picat "trecerile de stare ale trimiterii: $r"
ok "trimiterea (pasul 8): de_trimis/eroare ⇄ in_curs → trimisă → confirmată permise; trimisă → eroare / in_curs și confirmată → înapoi refuzate"

# 9. Stornarea (pasul 10): aceeași factură stornată de două ori SIMULTAN → un singur storno
fid=$(Q "select id from facturi where tip = 'factura' and saga_status in ('trimisa','confirmata') and not exists (select 1 from facturi s where s.storno_pentru = facturi.id) order by id limit 1")
[ -n "$fid" ] || picat "stornarea: nu găsesc o factură trimisă"
urm0=$(Q "select urmator from facturi_serii where serie = (select serie from facturi where id = $fid)")
storno() {
  docker exec -i "$C" psql -U postgres -tA -q 2>&1 <<SQL | grep -v '^{"sub\|^CONTEXT'
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', false);
select storneaza_factura($fid, 'simultan');
SQL
}
storno > /tmp/saga-storno-a.out & storno > /tmp/saga-storno-b.out; wait
ns=$(Q "select count(*) from facturi where storno_pentru = $fid"); rm -f /tmp/saga-storno-[ab].out
urm1=$(Q "select urmator from facturi_serii where serie = (select serie from facturi where id = $fid)")
[ "$ns" = 1 ] || picat "stornare simultană: $ns stornări pe aceeași factură"
[ "$urm1" = "$((urm0 + 1))" ] || picat "stornare simultană: contorul a sărit de la $urm0 la $urm1"
ok "stornare simultană pe aceeași factură → un singur storno, contorul +1"
P < scripts/anuleaza-saga-stornare.sql >/dev/null 2>&1 || picat "anularea migrării 53"
[ "$(Q "select to_regclass('public.facturi_ascunse') is null and to_regprocedure('public.storneaza_factura(bigint,text)') is null and (select count(*) from facturi where tip='storno') > 0")" = t ] \
  || picat "anularea migrării 53: trebuia să șteargă funcțiile și tabela, dar să lase stornările emise"
P < supabase/saga-stornare.sql >/dev/null 2>&1 || picat "re-rularea migrării 53 după anulare"
ok "anularea migrării 53 șterge funcțiile și tabela, lasă documentele; re-rularea o reface"

# 10. Refacturarea (pasul 10b): două emiteri simultane pe aceeași comandă stornată (storno trimis)
oid=$(Q "select f.order_id from facturi s join facturi f on f.id = s.storno_pentru join orders o on o.id = f.order_id where o.status <> 'anulata' order by s.id limit 1")
[ -n "$oid" ] || picat "refacturarea: nu găsesc o comandă stornată"
Q "update facturi set saga_status = 'trimisa' where tip = 'storno' and order_id = $oid and saga_status = 'de_trimis'" >/dev/null
Q "update facturi_serii set activa = (serie = (select serie from facturi where order_id = $oid order by id limit 1))" >/dev/null
nf0=$(Q "select count(*) from facturi where order_id = $oid and tip = 'factura'")
refact() {
  docker exec -i "$C" psql -U postgres -tA -q 2>&1 <<SQL | grep -v '^{"sub\|^CONTEXT'
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', false);
select emite_factura($oid);
SQL
}
refact > /tmp/saga-refact-a.out & refact > /tmp/saga-refact-b.out; wait
ra=$(cat /tmp/saga-refact-a.out /tmp/saga-refact-b.out | grep -c '"ok" : true'); rm -f /tmp/saga-refact-[ab].out
nf1=$(Q "select count(*) from facturi where order_id = $oid and tip = 'factura'")
[ "$ra" = 1 ] && [ "$nf1" = "$((nf0 + 1))" ] || picat "refacturare simultană: $ra reușite, facturi $nf0 → $nf1 (aștept exact una nouă)"
ok "refacturare simultană pe aceeași comandă stornată → o singură factură nouă"
r="$(P < scripts/anuleaza-saga-refacturare.sql 2>&1)"   # trebuie să refuze: există o refacturare
grep -q "au deja o factură nouă emisă după stornare" <<<"$r" || picat "anularea 54 nu a refuzat cu o refacturare existentă: $r"
[ "$(Q "select md5(replace(prosrc, E'\r', '')) from pg_proc where proname = 'emite_factura'")" = 05f9fdfb49e73145c8004f290ed6ec42 ] || picat "anularea refuzată a schimbat totuși emite_factura"
ok "anularea migrării 54 refuză cât există o refacturare (nimic schimbat)"

# 11. „ȘTERGE” PE COMENZILE CU FACTURĂ (migrarea 55)
P < supabase/comenzi-sterse.sql >/dev/null 2>&1 || picat "migrarea 55"
P < supabase/comenzi-sterse.sql >/dev/null 2>&1 || picat "migrarea 55, a doua rulare (idempotență)"
ok "migrarea 55 (rulată de două ori)"
r="$(P < scripts/verifica-comenzi-sterse.sql 2>&1)"
grep -q "REZULTAT OK" <<<"$r" || picat "verifica-comenzi-sterse.sql: $(grep -m1 -o 'VERIFICARE PICATĂ.*\|ERROR:.*' <<<"$r")"
ok "verifica-comenzi-sterse.sql — $(grep -o 'toate cele [0-9]* d*e* *verificări' <<<"$r")"
oc=$(Q "select o.id from orders o where exists (select 1 from facturi f where f.order_id = o.id) order by o.id limit 1")
sterge() {
  docker exec -i "$C" psql -U postgres -tA -q 2>&1 <<SQL | grep -v '^{"sub\|^CONTEXT'
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","email":"admin@test.local"}', false);
select sterge_comanda($oc);
SQL
}
sterge > /tmp/sterge-a.out & sterge > /tmp/sterge-b.out; wait
sa=$(cat /tmp/sterge-a.out /tmp/sterge-b.out | grep -c '"ok" : true'); rm -f /tmp/sterge-[ab].out
ne=$(Q "select count(*) from order_events where order_id = $oc and tip = 'stergere'")
[ "$(Q "select sters_la is not null from orders where id = $oc")" = t ] || picat "comanda cu factură nu e ascunsă după „Șterge”"
[ "$sa" = 1 ] && [ "$ne" = 1 ] || picat "„Șterge” simultan: $sa reușite, $ne note"
ok "„Șterge” apăsat de două ori simultan pe o comandă cu factură → ascunsă o singură dată (o notă în jurnal)"
r="$(P < scripts/anuleaza-comenzi-sterse.sql 2>&1)"   # trebuie să refuze: există o comandă ascunsă
grep -q "comenzi sunt ascunse" <<<"$r" || picat "anularea 55 nu a refuzat cu o comandă ascunsă: $r"
Q "update orders set sters_la = null, sters_de = null where id = $oc" >/dev/null
P < scripts/anuleaza-comenzi-sterse.sql >/dev/null 2>&1 || picat "anularea migrării 55"
[ "$(Q "select md5(replace(prosrc, E'\r', '')) from pg_proc where proname = 'sterge_comanda'")" = cd1d7d0cf96d2c79014e7d7749ac1b0d ] || picat "anularea 55 nu a pus înapoi sterge_comanda din 9"
[ "$(Q "select count(*) from information_schema.columns where table_name = 'orders' and column_name like 'sters_%'")" = 0 ] || picat "anularea 55 a lăsat coloanele"
P < supabase/comenzi-sterse.sql >/dev/null 2>&1 || picat "re-rularea migrării 55 după anulare"
ok "anularea 55: refuză cu comenzi ascunse; altfel pune înapoi exact versiunea din 9; re-rularea merge"

echo "TOATE VERIFICĂRILE LOCALE AU TRECUT"
