# `lib/dezro/` — un singur motor, două declanșatoare

Publicarea pieselor pe **dez.ro** poate porni din două locuri:

- **din terminal** — `node scripts/publica-dezro.mjs` (rulare lungă, fără limită de timp)
- **din admin** — `/admin/dezro`, prin ruta `app/api/dezro/route.ts` (loturi scurte, o cerere pe lot)

Amândouă fac **exact același lucru** cu fiecare piesă. Aceeași regulă ca la
`lib/import/`, și din același motiv: două implementări s-ar despărți în timp, iar
anunțurile trimise din admin ar ieși altfel decât cele trimise din terminal.

| Modul | Ce conține | Cine îl folosește |
|---|---|---|
| `api.mjs` | clientul api.dez.ro: antete, reîncercări, sesiune, toate apelurile | script, rută |
| `potrivire.mjs` | potrivirea catalogului nostru cu al lor + traducerile aprobate de om | script, rută |
| `anunt.mjs` | din piesă în anunț: câmpuri, descriere, amprentă, diferența de poze | script, rută |
| `depozit.mjs` | singurul loc care vorbește cu Supabase | script, rută |
| `motor.mjs` | ce se face, în ce ordine, și când se oprește un lot | script, rută |

## De ce `.mjs` și nu `.ts`

Același motiv ca la `lib/import/`: scriptul din terminal rulează direct cu `node`,
fără pas de compilare, iar TypeScript poate importa `.mjs` (`allowJs: true` e deja
în `tsconfig.json`). Un singur fișier per regulă, fără unelte în plus.

## Ce trebuie știut înainte să schimbi ceva

**Arborele lor întreg într-o cerere NU merge.** Ghidul lor recomandă
`GET /brands?with_models` și `GET /parts?with_children`; măsurat pe 7 septembrie
2026, amândouă răspund **504**. Catalogul se aduce mereu în trepte, o marcă / o
grupă pe cerere. Un nod cu `?with_children` merge (0,2s); tot arborele, nu.

**API-ul lor are hopuri.** 500 și 504 pe cereri perfect valide, care merg la
reîncercare peste câteva secunde. De asta există scara de reîncercări din
`api.mjs`. Un 4xx (în afară de 429) nu se reîncearcă niciodată: un 422 reîncercat
de trei ori tot 422 rămâne.

**Fără `User-Agent` propriu primești 403** de la Cloudflare-ul din fața lor. Nu e
scris nicăieri în ghid.

**Autentificările eșuate sunt limitate la 5 la 15 minute.** De aceea un 401 la
login nu se reîncearcă automat niciodată — a treia încercare ne-ar bloca contul un
sfert de oră fără ca nimeni să înțeleagă de ce. Token-ul, în schimb, ține 30 de
zile și se memorează în `settings.integrari.dezro`.

**Un lot trebuie să încapă în 60 de secunde.** `BUGET_MS + TIMEOUT_MS ≤
LIMITA_LOT_MS ≤ 55s`. Termenul absolut (`pana`) e ce garantează asta: `cere()` nu
începe o încercare care oricum n-ar apuca să se termine.
`scripts/verifica-dezro.mjs` verifică suma.

**Amprenta e ce ține traficul jos.** Fără ea, fiecare rulare ar rescrie toate cele
~8.700 de anunțuri. Cu ea, se atinge doar ce s-a schimbat — la a doua rulare
consecutivă nu pleacă nicio cerere.

**Ștergerea la ei nu se poate desface prin API.** De asta faza de retragere are un
prag (`PRAG_RETRAGERE`, 20%) și cere confirmare separată peste el, exact ca
protecția anti-fișier-trunchiat de la import.

## Regula

Orice regulă nouă despre dez.ro se scrie **aici**. Dacă te trezești copiind cod
din `scripts/` în `app/api/`, sau invers, e semn că locul lui e în modulul comun.

După orice modificare: `node scripts/verifica-dezro.mjs` (nu are nevoie nici de
rețea, nici de bază de date).
