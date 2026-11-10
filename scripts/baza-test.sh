#!/usr/bin/env bash
# ============================================================
# BAZA DE TEST — aplică migrările în ordine și rulează testele SQL
# pe proiectul Supabase de TEST („autopas-test”). NICIODATĂ pe producție.
#
# Folosire (din rădăcina proiectului):
#   export DB_TEST_URL='postgresql://postgres.<ref-test>:<parola>@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
#   scripts/baza-test.sh migrari            # toate migrările, 1 → ultima
#   scripts/baza-test.sh migrari --de-la=17 # reia de la a 17-a (după o eroare)
#   scripts/baza-test.sh teste              # scripts/verifica-saga-*.sql
#
# Adresa se ia din Supabase → proiectul de test → Connect → „Session pooler”.
# NU „Direct connection”: aceea e doar IPv6, iar Codespace-ul n-are IPv6.
#
# GARDA: scriptul citește adresa proiectului de PRODUCȚIE din .env.local și
# refuză orice DB_TEST_URL care o conține. Parola nu se scrie nicăieri.
#
# psql: dacă nu e instalat, se folosește cel din imaginea Docker postgres:17.
#
# ORDINEA MIGRĂRILOR e copiată din CLAUDE.md („Ordinea migrărilor SQL”).
# Cine adaugă o migrare o adaugă în AMBELE locuri.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

MIGRARI=(
  schema.sql seed.sql filtru.sql integrari.sql admin.sql sprint-bc.sql upgrade.sql
  favorite.sql admin-fix.sql date-firma.sql comanda-server.sql livrare-dupa-comanda.sql
  coduri-reducere-private.sql view-security-invoker.sql cautare-fara-diacritice.sql
  email-unic.sql import-pieseauto.sql taxonomie-import.sql greutate-estimata.sql
  import-index-fix.sql publicare-cu-poze.sql import-din-admin.sql rls-citire-echipa.sql
  ani-generatie.sql marci-lipsa.sql generatii-si-denumiri.sql mod-vacanta.sql
  pagini-masini.sql numar-piese-pe-model.sql ga4-public.sql categorii-numar-rapid.sql
  piese-marca-categorie.sql masuratori-publice.sql piese-compatibile-masini.sql
  superb-1.sql email-automat.sql dezro.sql piesa-vanduta-ramane.sql dezro-automat.sql
  senzori-auto-despartire.sql observatii-comanda.sql sugestie-clasificare.sql
  awb-fancourier.sql nomenclator-fan.sql transport-incasat-de-fan.sql retur-fan.sql
  saga-calcul.sql
)

comanda="${1:-}"
de_la=1
for a in "${@:2}"; do
  case "$a" in --de-la=*) de_la="${a#--de-la=}" ;; *) echo "Argument necunoscut: $a" >&2; exit 2 ;; esac
done

if [[ -z "${DB_TEST_URL:-}" ]]; then
  echo "Lipsește DB_TEST_URL (adresa „Session pooler” a proiectului de TEST)." >&2
  exit 2
fi

# --- Garda: niciodată producția ---------------------------------------------
if [[ -f .env.local ]]; then
  prod_url="$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | head -1 | cut -d= -f2- | tr -d '"'"'"' ')"
  prod_ref="$(sed -E 's#^https?://([^.]+)\..*#\1#' <<<"$prod_url")"
  if [[ -n "$prod_ref" && "$DB_TEST_URL" == *"$prod_ref"* ]]; then
    echo "REFUZ: DB_TEST_URL arată spre proiectul de PRODUCȚIE ($prod_ref)." >&2
    exit 3
  fi
else
  echo "REFUZ: lipsește .env.local, deci nu pot verifica că adresa NU e producția." >&2
  exit 3
fi

# Arată unde se conectează (fără parolă) și cere confirmare.
gazda="$(sed -E 's#^[a-z]+://([^:@]+)(:[^@]*)?@#\1@#' <<<"$DB_TEST_URL")"
echo "Baza țintă: $gazda"
read -r -p "E proiectul de TEST „autopas-test”? Scrie „da” ca să continui: " raspuns
[[ "$raspuns" == "da" ]] || { echo "Oprit."; exit 1; }

# --- psql local sau din Docker -------------------------------------------------
psql_cmd() {
  if command -v psql >/dev/null 2>&1; then
    psql "$DB_TEST_URL" -v ON_ERROR_STOP=1 -X -q "$@"
  else
    docker run --rm -i --network host postgres:17 psql "$DB_TEST_URL" -v ON_ERROR_STOP=1 -X -q "$@"
  fi
}

case "$comanda" in
  migrari)
    total=${#MIGRARI[@]}
    for ((i = de_la; i <= total; i++)); do
      f="supabase/${MIGRARI[$((i - 1))]}"
      printf '[%2d/%d] %s … ' "$i" "$total" "$f"
      # Fiecare fișier = o tranzacție, ca în SQL Editor: o eroare îl anulează întreg.
      if psql_cmd -1 < "$f" > /tmp/baza-test-iesire.txt 2>&1; then
        echo "ok"
      else
        echo "EROARE"
        grep -v '^NOTICE' /tmp/baza-test-iesire.txt | head -20
        echo
        echo "Oprit la migrarea $i. După ce o repari, reiei cu: scripts/baza-test.sh migrari --de-la=$i"
        exit 1
      fi
    done
    echo "Toate cele $total migrări au fost aplicate."
    ;;
  teste)
    # Testele se încheie MEREU cu o eroare (ca baza să anuleze tot), deci
    # reușita se citește din mesaj, nu din codul de ieșire al lui psql.
    picate=0
    for f in scripts/verifica-saga-*.sql; do
      echo "== $f"
      iesire="$(psql_cmd < "$f" 2>&1 || true)"
      if grep -q "REZULTAT OK" <<<"$iesire"; then
        grep -o "REZULTAT OK[^.]*" <<<"$iesire"
      else
        grep -v '^CONTEXT' <<<"$iesire"; picate=1
      fi
    done
    exit $picate
    ;;
  *)
    echo "Folosire: scripts/baza-test.sh migrari [--de-la=N] | teste" >&2
    exit 2
    ;;
esac
