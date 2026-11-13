# OLX România — planul integrării (13 noiembrie 2026)

Specificația: `docs/olx/olx-api.yaml` (OLX Partner API v2, `https://www.olx.ro/api/partner`, antet `Version: 2.0`).
Tiparul: dez.ro (coadă + trigger + pg_net + rută, panou) și SAGA (secret doar în bază, un singur loc care îl folosește).
Lucrul: ramura `olx-integrare`, fără push pe `main` până la confirmare. Trei pași, cu oprire după fiecare.

## Decizii (din cererea proprietarului)
- Se publică TOATE piesele publicate pe site cu stoc > 0, pe contul OLX business al firmei.
- **Aplicația nu cumpără nimic, niciodată.** `lib/olx-api.mjs` are o listă ÎNCHISĂ de apeluri permise; orice altă cale
  (pachete, promovări, `/paid-features`, `/packets`, comanda `extend`) aruncă eroare înainte de rețea. Un anunț
  `limited` doar se marchează și apare în panou; nu se activează niciodată un anunț `limited`.
- Fără mesaje OLX în admin (nu se folosește `/threads`).
- Tokenii și `client_secret` stau DOAR în tabela `olx_cont` (RLS fără nicio politică → doar serverul). Nu ajung în
  browser, în `settings.integrari` sau în jurnal. De aceea OLX NU are formular în cardul din Integrări (care rescrie tot
  rândul `integrari`): are propriile butoane, care merg la `/api/olx`.

## Ce aflăm din specificație (și cum tratăm)
| Fapt | Ce facem |
|---|---|
| access token 24 h; refresh token valabil o lună, emis nou o dată pe zi | se reînnoiește singur cu 1 h înainte de expirare, sub lacăt; tokenii noi se scriu în bază ÎNAINTE de folosire |
| refresh nefolosit o lună = deconectare | panoul arată „ultima reînnoire”; la `invalid_grant` contul se marchează „deconectat” și se cere „Conectează OLX” din nou |
| `external_url` e permis doar unor parteneri (eroarea „Partner is not allowed to use external URL”) | se trimite; la exact eroarea asta se reîncearcă fără el și se reține setarea |
| statusuri: new / active / limited / removed_by_user / outdated / moderated / blocked … | se salvează textul brut; motivul de respingere din `/adverts/{id}/moderation-reason` |
| ștergerea cere întâi dezactivare | vândută → `deactivate` + `is_success: true`; nepublicată/ștearsă → `deactivate` + `DELETE` |
| 429 | pauză și reîncercare (3 încercări), apoi rândul rămâne în coadă |

**De confirmat la proba reală (pasul 2)**: dacă `auto_extend_enabled = true` poate costa pe contul vostru (OLX n-o spune
în specificație) și dacă categoriile de piese cer `product_safety_regulation`.

## Ce se modifică din ce există
Nimic din bază existent nu e rescris. Doar adăugiri:
- `app/admin/integrari/page.tsx` — card nou „OLX — anunțuri” cu unealta `UneltOlx` (fără formularul comun).
- `app/admin/layout.tsx` — o intrare nouă în meniu, „Anunțuri OLX”.
- `app/admin/produse/[id]/page.tsx` — pasul 2: caseta OLX (stare, link, butoane).
- `CLAUDE.md` — migrările noi în ordine.
- Pasul 3: un trigger NOU pe `products` (nu atinge triggerele dez.ro).

## Migrările
| # | Fișier | Pas | Ce creează |
|---|---|---|---|
| 56 | `supabase/olx-conexiune.sql` | 1 | `olx_cont` (aplicația, tokenii, setările; fără politici), `olx_blocare` + `olx_ia_blocarea` / `olx_elibereaza`, `olx_consuma_starea` (state-ul OAuth, o singură folosire, 10 min), `olx_apeluri` (jurnal fără tokeni), `olx_categorii` (catalogul lor + atributele), `olx_mapari` (categoria noastră → frunza OLX + valorile atributelor obligatorii) |
| 57 | `supabase/olx-anunturi.sql` | 2 | `olx_anunturi` (piesă → anunț: id, status, url, motiv, amprentă, eroare) cu `product_id` UNIC → un anunț pe piesă |
| 58 | `supabase/olx-coada.sql` | 3 | `olx_coada`, triggerele pe `products`, trezirea `/api/olx-coada` prin pg_net |

Fiecare: pre-verificare (doar citire) → migrarea → UN test SQL esențial (tranzacție anulată, se termină cu „REZULTAT OK” /
„VERIFICARE PICATĂ”) → verificarea finală; plus fișier de anulare, fără `cascade`.

## Pasul 1 — conectarea, tokenii, categoriile
- `lib/olx-api.mjs` — SINGURUL loc care folosește tokenii: autorizare, schimbul codului, reînnoirea, `cere()` cu
  `Version: 2.0`, lista închisă de apeluri, 429, jurnal.
- `lib/olx.ts` — depozitul (tabelele din 56, cu cheia de serviciu).
- `app/api/olx/route.ts` — acțiuni: stare, salvează aplicația (client_id / secret), adresa de conectare (cu `state`),
  deconectare, testează (`/users/me` + numărul de anunțuri existente), setări (oraș, contact), caută orașul după
  coordonate, adu categoriile, atributele unei categorii, sugestia OLX după titlu.
- `app/api/olx/callback/route.ts` — primește `code` + `state`; `state` verificat și consumat în bază.
- `app/admin/olx/categorii/page.tsx` — potrivirea categorie site → frunză OLX, ca „Articole SAGA”, cu atributele
  obligatorii și buton „Propune” (sugestia OLX pe titlul unei piese din categorie).

**Verificare:** testul SQL (nimeni din browser nu citește `olx_cont`; `state`-ul merge o singură dată) + „Testează
conexiunea” pe contul real.

## Pasul 2 — generatorul și UN anunț real
- `lib/olx-anunt.mjs` — titlul (16–150), descrierea curățată (fără telefon / e-mail / www, ≤ 50% majuscule, fără 3 semne
  la rând, completată până la 80, tăiată la 9000), preț RON, `courier`, poze (≤ `photos_limit`), oraș, business,
  `external_id` = `cod_intern`, `external_url`, `auto_extend_enabled`, categoria și atributele din potrivire.
- Pe pagina piesei: „Previzualizează anunțul OLX”, „Publică pe OLX”, „Actualizează”, „Dezactivează”, „Activează”.
- **Garda de dublură**: înainte de POST se caută `olx_anunturi` pentru piesă și `GET /adverts?external_id=…`; dacă
  există, se face PUT, nu POST.
- **Verificare:** proba ta pe OLX — publicare, schimbare de preț, dezactivare, reactivare.

## Pasul 3 — automat + lista + publicarea în masă
- Coada (trigger → pg_net → `/api/olx-coada`), cu decizia luată la procesare din starea piesei de atunci:
  publicată + stoc → POST/PUT; stoc 0 → deactivate (`is_success: true`); înapoi pe stoc → activate (nu dacă `limited`);
  nepublicată / ștearsă → deactivate + delete. Plasa de 20% la retrageri, ca la dez.ro.
- „Anunțuri OLX”: filtrele active / respinse / limited / erori; „Citește anunțurile existente” (câte, câte par aceleași
  piese după titlu); „Publică tot catalogul pe OLX” în ritm controlat, cu progres și „Oprește”.
- **Verificare:** o piesă vândută de probă își retrage anunțul; lotul de 20 trimis fără dubluri.

---

## Jurnalul pasului 1 (13 noiembrie 2026) — cod scris, migrarea 56 NErulată
Commit pe ramura `olx-integrare` (fără push). `npm run build`: „Compiled successfully”. Pe OLX nu s-a rulat încă nimic.

**Ce face**
- **Tokenii** stau doar în `olx_cont` (nici adminul din browser nu-i vede). Singurul loc care îi folosește:
  `lib/olx-api.mjs`. Reînnoire singură cu o oră înainte de expirare; tokenul nou se scrie în bază ÎNAINTE de folosire.
- **Nimic nu se plătește singur**: listă închisă de apeluri — pachetele, promovările, `extend` și mesajele sunt refuzate
  înainte de rețea. Verificată pe 12 cazuri: corectă.
- **Conectarea**: Integrări → „OLX — anunțuri”: „Salvează aplicația”, „Conectează OLX”, „Testează conexiunea” (contul +
  câte anunțuri are deja), orașul (căutat după coordonate) și contactul. `state`-ul merge o singură dată, 10 minute.
- **Categoriile**: meniul „Anunțuri OLX” → `/admin/olx/categorii`, ca „Articole SAGA”: „Adu categoriile OLX”, căutare,
  „Propune (OLX)”, atributele obligatorii.

**De rulat în SQL Editor, în ordine**
1. `scripts/pre-verifica-olx-conexiune.sql` → **4 × true**.
2. `supabase/olx-conexiune.sql` (migrarea 56) → **Success**.
3. `scripts/verifica-olx-conexiune.sql` → căsuța roșie: **„REZULTAT OK: …”**.

**Verificarea pe contul real** (cere push pe ramura `olx-integrare` → preview Vercel; de confirmat de proprietar)
- „Callback URL”-ul înregistrat la OLX trebuie să fie EXACT cel afișat în card (`https://<domeniu>/api/olx/callback`);
  altfel conectarea pică cu eroare de la ei.
1. Salvezi `client_id` și `client_secret`.
2. „Conectează OLX” → „Testează conexiunea”: numele contului, „(cont business)”, numărul de anunțuri existente.
3. Cauți orașul după coordonate, completezi contactul → „Salvează setările”.
4. „Anunțuri OLX” → „Adu categoriile OLX” → potrivești câteva categorii.

**Fișiere** — noi: `supabase/olx-conexiune.sql`, `scripts/pre-verifica-olx-conexiune.sql`,
`scripts/verifica-olx-conexiune.sql`, `scripts/anuleaza-olx-conexiune.sql`, `lib/olx-api.mjs`, `lib/olx.ts`,
`app/api/olx/route.ts`, `app/api/olx/callback/route.ts`, `app/admin/olx/categorii/page.tsx`, `docs/olx/olx-api.yaml`.
Modificate: `app/admin/integrari/page.tsx`, `app/admin/layout.tsx`, `CLAUDE.md`.

**Urmează**: pasul 2 (generatorul de anunț + primul anunț real), după confirmare.

**Corectura din 13 noiembrie 2026 (testul pasului 1 a picat: „state-ul corect nu a fost acceptat”)**
Cauza: `olx_consuma_starea` făcea `update … set stare_oauth_de = null … returning stare_oauth_de` — `RETURNING` dă
valoarea DE DUPĂ `set`, deci întorcea mereu null. Rândul unic din `olx_cont` exista. Corectat în
`supabase/olx-conexiune.sql`: citire cu `for update`, apoi golire. Amprenta corectă (fără `\r`):
`3b6e1dee251e95633806cf41792c3fca`. Pași: re-rulezi migrarea 56 (idempotentă), apoi testul.
