# AUTOPAS DEZMEMBRĂRI — context de proiect pentru Claude Code

Acest fișier îți dă contextul ca să poți continua proiectul fără explicații repetate. E ținut SCURT
intenționat (scurtat la 24 noiembrie 2026, depășea 150.000 de caractere). Detaliile și istoricul stau în:
- **`docs/decizii.md`** — toate deciziile, cu motivele și măsurătorile (citește secțiunea relevantă ÎNAINTE
  de a schimba ceva din zona respectivă);
- **`docs/migrari.md`** — istoricul fiecărei migrări SQL (ce face, când a rulat, amprentele, testele);
- **`docs/scripturi.md`** — tabelul complet al uneltelor din `scripts/`;
- `docs/saga-plan.md`, `docs/olx-plan.md`, `docs/dez.ro.md`, `docs/email.md`, `docs/fancourier-retur.md` —
  planurile și manualele integrărilor.

## Ce este
Magazin online de piese auto second-hand din dezmembrări. Depozitul e pe Str. Petru Rareș nr. 181,
pe DN 15 între Piatra-Neamț și Bicaz (sat Bistrița, com. Alexandru cel Bun, jud. Neamț) — aceeași
adresă cu sediul social. Site public + cont client + panou de administrare complet.
Site-ul e live pe `autopas-dezmembrari.ro`, indexat, cu comenzi reale și facturare reală prin SAGA
(din 11 noiembrie 2026). Catalogul (~8.800 de piese) a venit din pieseauto.ro — anunțurile reale ale firmei.
Codul nu trebuie să conțină date inventate.

## Stack
- **Next.js 14** (App Router) + **TypeScript** + **Tailwind CSS**
- **Supabase** (PostgreSQL + Auth + Storage) — baza de date și autentificarea
- **Vercel** — găzduire; fiecare `git push` pe `main` declanșează un build automat; funcțiile rulează la
  Frankfurt (`vercel.json`, `fra1`)
- Fără alte librării de UI; iconurile sunt SVG scrise de mână; graficele sunt SVG proprii

## Cum rulezi și verifici
```bash
npm install
npm run dev      # dezvoltare pe http://localhost:3000
npm run build    # OBLIGATORIU înainte de commit — prinde erorile de tip
```
Nu face push dacă `npm run build` nu trece cu „Compiled successfully".
**Serverul local se oprește ÎNAINTE de `npm run build`**: un `next start` rămas pornit poate rescrie în
`.next` o pagină VECHE peste build-ul nou.

## Reguli de lucru (important)
- **Răspunde în română.** Utilizatorul e începător — explică pe scurt ce faci și de ce.
- **Un singur pas o dată, la planurile aprobate** (cerut de proprietar). Când lucrul urmează un plan pe
  pași: implementezi UN SINGUR pas, apoi te oprești și spui ce ai făcut, ce fișiere ai modificat și cum se
  verifică. Pasul următor începe doar după confirmarea utilizatorului.
- **Fără bază de test: testele pe PRODUCȚIE rulează doar în tranzacții anulate.** Orice script de
  verificare care atinge baza reală stă între `begin` și `rollback` ȘI se încheie mereu cu o eroare
  („REZULTAT OK …” / „VERIFICARE PICATĂ …”). Probele de facturare folosesc seria **„TEST”**, tot în
  tranzacții anulate. Seria reală e „PAP FE”; numerele ei nu stau în cod sau în migrări. Ce nu se poate
  testa așa (concurența) se testează local, într-un Postgres din Docker. Fiecare migrare nouă vine cu
  pre-verificare (doar citire) și fișier de anulare fără `cascade`. Asistentul nu rulează nimic pe
  producție; rulează proprietarul, din SQL Editor.
- **Cod complet**, nu fragmente. Comentarii scurte în cod, în română.
- **Fără date demo hardcodate** — tot ce se afișează vine din Supabase.
- **Nu inventa** funcții, tabele sau coloane. Dacă ai nevoie de ceva nou în baza de date, scrie întâi un
  fișier SQL nou în `supabase/` — fișierul rămâne sursa adevărului.
- **Secretele** (chei API, parole curieri) stau în variabilele Vercel sau în tabela `settings`
  (protejate de RLS), niciodată în cod. Rândul `settings.integrari` NU e citibil public.
- **Nu reproduce logo-uri de mărci** (Audi, BMW, Facebook…) — doar text.
  Bannerele ANPC/SOL sunt fișiere oficiale în `public/`, nu redesenate.
- **Admin → Integrări: salvarea unui card atinge DOAR acel card** (`salveaza` recitește rândul din bază
  chiar înainte de scriere și pune peste el doar câmpurile cardului apăsat).

## Structura
- `app/` — paginile (App Router). `app/admin/` = panoul de administrare (meniul și drepturile pe rol:
  constanta `MENIU` din `app/admin/layout.tsx`). `app/feed/` = feed-urile publice de produse.
  `app/masini/` = paginile publice ale mașinilor dezmembrate. `app/api/` = rutele de server.
- `components/` — componente refolosibile; `components/admin/` = specifice adminului.
- `lib/` — `supabase.ts` (clienți: server, browser, admin cu service key; `scrieVerificat`, `citesteTot`,
  `esteEchipa`), `settings.ts`, `types.ts`, `format.ts`, `fancourier.ts`, `config.ts`, `legal.ts`, `seo.ts`,
  `analytics.ts`, `feed*.ts`, `email.ts`.
  `lib/import/` = motorul de import pieseauto.ro (`.mjs`, folosit de script și de rută — vezi README-ul lui).
  `lib/dezro/` = motorul dez.ro. `lib/olx-*.mjs` = OLX. `lib/saga-*.mjs` = SAGA.
- `supabase/` — migrările SQL. `scripts/` — verificări și întreținere (`docs/scripturi.md`).

## Migrările SQL
Rulare manuală în Supabase, o singură dată fiecare, în ordine:
1. `schema.sql` -> 2. `seed.sql` -> 3. `filtru.sql` -> 4. `integrari.sql` ->
5. `admin.sql` -> 6. `sprint-bc.sql` -> 7. `upgrade.sql` -> 8. `favorite.sql` -> 9. `admin-fix.sql` ->
10. `date-firma.sql` -> 11. `comanda-server.sql` -> 12. `livrare-dupa-comanda.sql` ->
13. `coduri-reducere-private.sql` -> 14. `view-security-invoker.sql` -> 15. `cautare-fara-diacritice.sql` ->
16. `email-unic.sql` -> 17. `import-pieseauto.sql` -> 18. `taxonomie-import.sql` -> 19. `greutate-estimata.sql` ->
20. `import-index-fix.sql` -> 21. `publicare-cu-poze.sql` -> 22. `import-din-admin.sql` ->
23. `rls-citire-echipa.sql` -> 24. `ani-generatie.sql` -> 25. `marci-lipsa.sql` -> 26. `generatii-si-denumiri.sql` ->
27. `mod-vacanta.sql` -> 28. `pagini-masini.sql` -> 29. `numar-piese-pe-model.sql` -> 30. `ga4-public.sql` ->
31. `categorii-numar-rapid.sql` -> 32. `piese-marca-categorie.sql` -> 33. `masuratori-publice.sql` ->
34. `piese-compatibile-masini.sql` -> 35. `superb-1.sql` -> 36. `email-automat.sql` -> 37. `dezro.sql` ->
38. `piesa-vanduta-ramane.sql` -> 39. `dezro-automat.sql` -> 40. `senzori-auto-despartire.sql` ->
41. `observatii-comanda.sql` -> 42. `sugestie-clasificare.sql` -> 43. `awb-fancourier.sql` ->
44. `nomenclator-fan.sql` -> 45. `transport-incasat-de-fan.sql` -> 46. `retur-fan.sql` -> 47. `saga-calcul.sql` ->
48. `saga-export.sql` -> 49. `saga-facturi.sql` -> 50. `saga-articole.sql` -> 51. `saga-emitere.sql` ->
52. `saga-api.sql` -> 53. `saga-stornare.sql` -> 54. `saga-refacturare.sql` -> 55. `comenzi-sterse.sql` ->
56. `olx-conexiune.sql` -> 57. `olx-anunturi.sql` -> 58. `olx-coada.sql` -> 59. `olx-coada-ceas.sql` ->
60. `saga-emitere-un-buton.sql`

- Idempotente (se pot re-rula oricând): 6, 7, 9–60. NU sunt idempotente: 1–5, 8.
- **Aplicate pe producție: 1–45, 47–58 și 60.** **46 e scrisă, NErulată** (AWB de retur; așteaptă
  contul ocazional FAN). **59 e scrisă, NErulată** (ceasul pg_cron al cozii OLX).
- Detaliile fiecăreia: **`docs/migrari.md`**.

Reguli pentru migrări noi:
- Supabase rulează tot scriptul ca o tranzacție. Ține migrările mici și idempotente (`if not exists`,
  `on conflict do nothing`, `drop policy if exists` înainte de `create policy`).
- **O migrare care RESCRIE o funcție existentă are gardă de amprentă**: compară
  `md5(replace(prosrc, E'\r', ''))` din bază cu versiunea din git și se oprește dacă diferă (fără `\r`:
  SQL Editor-ul de pe Windows salvează cu CRLF). Corpul se copiază din PRODUCȚIE, nu din memorie.
- **Dacă codul cere migrarea, migrarea se rulează ÎNAINTE de push pe `main`.**
- La orice funcție nouă expusă: `revoke execute ... from public` **și** `from anon` — pe Supabase
  funcțiile noi primesc drept direct pentru `anon`.
- Rularea pe producție prin conectorul Supabase (aprobat la 7 august 2026): spui înainte ce rulezi și ce
  atinge; la operații ireversibile (`drop`, `delete`, `revoke`, `update` în masă) ceri confirmare separată;
  raportezi rezultatul complet. Fără conector: utilizatorul rulează scriptul manual.

## Reguli tehnice care nu se încalcă (detalii și motive: `docs/decizii.md`)

**Baza de date și Supabase**
- **Prețurile și totalurile se calculează exclusiv pe server** (`plaseaza_comanda` = singura cale de a crea o
  comandă). Browserul trimite doar id-urile și cantitățile. Fără `insert` direct în `orders`/`order_items`.
- **Orice UPDATE sau DELETE din `/admin` trece prin `scrieVerificat()`**: un UPDATE oprit de RLS întoarce
  zero rânduri fără eroare.
- **PostgREST taie tăcut la 1.000 de rânduri.** Listele complete se citesc cu `citesteTot()` (scripturi:
  `citesteTotRest`), cu `.order()` pe o coloană UNICĂ; `.in("id", ids)` mare → `citesteDupaIduri()`.
- **Contoarele se calculează în bază, într-un view, dintr-o singură trecere** — nu în Node și nu cu
  subinterogare corelată pe fiecare rând.
- **`products` are două legături către `categories`**: `categories!products_categorie_id_fkey(*)`.
- **În PL/pgSQL, `exception when others` anulează tot blocul lui**: fiecare efect care trebuie să
  supraviețuiască singur (ex. inserarea în coadă vs. apelul pg_net) stă în blocul lui. pg_net e în schema `net`.
- **Rutele din `app/api/` nu sunt protejate de RLS**: cele care lucrează în numele firmei verifică token-ul
  cu `esteEchipa()`.
- După o salvare din Setări se cheamă `/api/revalideaza` (altfel datele firmei rămân vechi 5 minute).
- Căutarea: `text_cautare` (bază) și `textCautare` (`lib/format.ts`) se țin identice; `tipareCautare` +
  `.filter("cautare", "imatch", tipar)`; sinonimele se adaugă doar după numărare.
- Roluri: `client`, `operator`, `contabil`, `admin` (`profiles.role`, prin RLS); `is_admin`, `is_staff`.

**Catalog și pagini publice**
- `publicat` = operatorul vrea piesa pe site; `stoc` = piesa mai există. Listările și feed-urile filtrează
  `publicat AND stoc > 0`. **O piesă vândută rămâne pagină (200, „Vândută"), nu 404.**
- **Modul vacanță nu atinge niciodată `products.publicat`** — e un comutator în `settings.vacanta`, blocarea
  reală e în `plaseaza_comanda`.
- Paginile de catalog sunt `force-no-store` (stocul nu are voie să fie vechi).
- Paginile de mașină se umplu prin COMPATIBILITATE (`products.model_ids` ↔ `vehicles.model_id`), după
  generație, niciodată după an; textul spune „se potrivesc pe", niciodată „demontate de pe".
  `products.vehicul_id` e doar intern (profit pe mașină).
- Mărcile/categoriile goale se ascund la AFIȘARE (`marciCuPiese`), nu se șterg din bază.
- Anii generației stau în `models.an_start` / `an_final` (null = încă în producție), nu în nume.
- Marca se adaugă titlurilor DOAR în `SABLON_TITLU` (`lib/seo.ts`); `scripts/verifica-seo.mjs` verifică.
- Datele structurate `Product` spun exact ce spune feed-ul; fără `shippingDetails`, fără recenzii.
- **Fără `loading.tsx` pe listări** (anulează `loading="lazy"`); legăturile interne merg direct pe rute.
- Plata e EXCLUSIV ramburs. Costul livrării NU se afișează la checkout — îl calculează FAN după comandă.
- Coșul acceptă cantități, plafonate la stoc; decizia finală e a serverului. În `npm run dev` coșul se
  golește la reîncărcare (StrictMode) — nu e defect în producție.

**Măsurare și documente legale**
- Toate evenimentele pleacă prin `ev()` (`lib/analytics.ts`), care le traduce pentru GA4, Meta și Ads.
  Consimțământul are două scopuri separate (statistică / marketing). Fără date personale în evenimente.
- **Orice instrument, cookie sau furnizor nou se trece ÎNTÂI în documentele legale**, apoi se pune în
  funcțiune. Data lor: `LEGAL_ACTUALIZAT` din `lib/legal.ts`.

**Integrări** (detaliile în `docs/decizii.md` și în manualele din `docs/`)
- **pieseauto.ro**: site-ul e sursa; ei importă zilnic `/feed/pieseauto.csv` (`lib/feed-pieseauto.ts`).
  ID-ul (`sursa_id` sau 1.000.000.000.000 + `products.id`) NU se schimbă niciodată. Vândutele pleacă cu
  cantitate 0. Importul DIN ei e doar din CSV; **nu le ocolim blocarea** (fără proxy / alt IP) — ciornele se
  completează din browserul operatorului („Preia în Autopas"). Paginile lor merg doar pe HTTP/2.
- **Un singur motor pe integrare** (`lib/import/`, `lib/dezro/`, `lib/olx-*`): scriptul și ruta îl folosesc
  pe același; nicio regulă nu stă în altă parte.
- **dez.ro și OLX** se sincronizează printr-o coadă scrisă de triggere pe `products`; ce e de făcut se decide
  la procesare, din starea piesei de atunci. Plasa de 20% la retrageri. Lista de coloane a triggerului =
  exact ce citește motorul (nu `vizualizari`). OLX: niciodată DELETE; singurul loc cu tokenii e `lib/olx-api.mjs`.
- **E-mailurile** pleacă dintr-o coadă (`email_coada`) scrisă de baza de date; un e-mail nu are voie să
  strice o comandă. Furnizor: Brevo; primirea pe `contact@` = redirecționare ImprovMX → Yahoo.
- **FAN Courier** (singurul curier, `lib/fancourier.ts`): AWB din pagina comenzii; transportul îl plătește
  destinatarul (`payment: "recipient"`), **rambursul = `subtotal − reducere`** (nu `total`), conținut gol,
  fără opțiuni („Deschidere la livrare" scoasă), kg și colete scrise de operator, dimensiunile opționale,
  localitatea fără diacritice. Fără cost de livrare stabilit, AWB-ul nu se generează. Returul: alt cont
  (ocazional), `docs/fancourier-retur.md`.
- **SAGA**: facturarea se face din aplicație, prin API-ul SAGA (`lib/saga-*.mjs`; singurul loc cu cheia:
  `lib/saga-api.mjs`). „Emite factura" emite și trimite automat; greșelile se corectează prin storno.
  După o factură emisă MANUAL în SAGA se actualizează numărul următor în Facturi → Setări serie.
  Planul și starea: `docs/saga-plan.md`.

## Culorile site-ului
Identitate „Atelier, galben industrial" (#F2B705), două teme: „Luminos" (implicită) și „Întunecat".
Culorile se modifică DOAR în `app/globals.css` (`:root` = întunecat, `:root[data-tema="luminos"]` = luminos).
- Componentele folosesc clasele semantice din `tailwind.config.ts` (`bg-fundal`, `text-text`, `bg-accent`,
  `text-accentContrast`, `border-chenar`…). **Nu scrie hexa în componente.**
- Textul de pe galben e negru (`text-accentContrast`), niciodată `text-white`.
- Galbenul nu e niciodată text pe tema luminoasă: se folosesc `.accentuat` / `.accentuat-hover`.
- Chenarele care trebuie să se vadă (câmpuri, butoane secundare) folosesc `--chenar-puternic`.
- `/admin` rămâne luminos, pe paleta clasică portocalie (`.tema-clasica`, care declară și `color`).
- Culorile semantice (ok / eroare / avertizare, verdele WhatsApp) nu fac parte din temă.
- Verificare: `node scripts/verifica-contrast.mjs` (iese azi cu cod 1, știut: doar paleta `/admin`).
Detaliile (de ce `data-tema` e pus pe server etc.): `docs/decizii.md`.

## De configurat (sarcini ale utilizatorului, nu cod)
- `contact@autopas-dezmembrari.ro` — de verificat că redirecționarea ImprovMX + SPF funcționează (`docs/email.md`).
- pieseauto.ro — de întrebat ce fac cu un rând care lipsește din fișier (până atunci piesele lor nu se șterg).
- dez.ro — adresa din profilul lor diferă de cea oficială din `lib/config.ts`; de confirmat cu proprietarul.
- Contul ocazional FAN pentru retururi — necreat; apoi se rulează migrarea 46.

## Unelte de verificare (`scripts/`)
Se cheamă cu mâna, niciuna nu rulează la build. Tabelul complet: **`docs/scripturi.md`**. Cele mai folosite:
`verifica-import.mjs` (după `lib/import/`), `verifica-dezro.mjs` (după `lib/dezro/`), `verifica-olx-coada.mjs`,
`verifica-saga-xml.mjs` / `verifica-saga-api.mjs` (după SAGA), `verifica-seo.mjs` și `verifica-feed.mjs`
(cer `BASE=…`), `verifica-cantitati.mjs` (coș, pe build de producție), `verifica-contrast.mjs`,
`scan-responsive.mjs`, `curata-orfani.mjs` (citește și `vehicles.poze`), scripturile `verifica-*.sql`
(pe producție, în tranzacție anulată) și `verifica-*-local.sh` (Docker).

## Când termini o modificare
Rulează `npm run build`. Dacă trece, fă commit cu mesaj clar în română și push pe `main`.
Dacă modificarea are nevoie de SQL, amintește-i utilizatorului ce fișier să ruleze în Supabase.
