#!/usr/bin/env bash
# Plasă de siguranță pentru publicarea pe dez.ro.
#
# Publicarea celor ~8.200 de piese durează peste o oră, iar Codespace-ul se
# oprește după 30 de minute fără activitate de la un client. Scriptul ăsta
# ține publicarea pornită: dacă procesul moare (deconectare, oprirea VM-ului
# urmată de repornire), o reia de unde a rămas.
#
# Reluarea e ieftină și inofensivă: anunțurile deja trimise sunt în
# `dezro_anunturi`, iar amprenta câmpurilor face ca a doua trecere peste ele
# să nu trimită NICIO cerere către dez.ro — le raportează „neschimbate".
#
# Se pornește o singură dată, detașat:
#   setsid nohup scripts/reia-dezro.sh > /dev/null 2>&1 &
# și se oprește ștergând fișierul-semn:
#   rm /workspaces/autopas/.dezro-in-lucru
cd /workspaces/autopas || exit 1
SEMN=/workspaces/autopas/.dezro-in-lucru
LOG=/workspaces/autopas/.dezro-publicare.log
touch "$SEMN"

while [ -f "$SEMN" ]; do
  if ! pgrep -f "publica-dezro.mjs" > /dev/null; then
    echo "=== pornire/reluare $(date -u +%F' '%T) UTC ===" >> "$LOG"
    node scripts/publica-dezro.mjs --fara-retragere >> "$LOG" 2>&1
    cod=$?
    echo "" >> "$LOG"
    echo "=== s-a oprit cu codul $cod la $(date -u +%F' '%T) UTC ===" >> "$LOG"
    # Cod 0 = a terminat tot. Orice altceva înseamnă că s-a oprit din ceva
    # (un refuz de la ei, o rețea căzută) și merită reîncercat peste un minut.
    if [ $cod -eq 0 ]; then
      echo "Gata: publicarea s-a încheiat complet." >> "$LOG"
      rm -f "$SEMN"
      exit 0
    fi
    sleep 60
  fi
  sleep 30
done
