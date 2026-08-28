# RAPORT — 28 august 2026 · PARTEA E, încheiată

Împins pe `main`. Migrările 24, 25 și 26 rulate. Acțiunea 5 amânată, prin decizie.

---

## Cifra finală

| | început | acum |
|---|---:|---:|
| piese fără categorie | 206 | **0** |
| piese fără model | 1.912 | **117** |
| piese cu model | 78,2% | **98,7%** |
| piese legate de 2+ modele | 1.999 | 2.384 |
| modele în tabelă | 345 | 540 (537 au piese) |
| mărci în tabelă | 19 | 42 |
| mărci vizibile în filtru | 19 | 38 |

Cele **117** rămase:

| Cauză | Piese |
|---|---:|
| sursa n-are compatibilitate deloc | 107 |
| sursa însăși scrie „Altă marcă Alt model" | 8 |
| generație lipsă sau ambiguă | 2 |

Convergență confirmată: a doua trecere a scriptului nu mai schimbă nimic.

---

## Ce s-a reparat, pe scurt

**Patru defecte din aceeași familie**, toate găsite măsurând, nu citind cod:

1. `taxonomieDinUrl` ignora URL-urile cu două segmente, deși primul segment e tot categoria.
   206 piese fără categorie, 206 URL-uri scurte — corelație perfectă.
2. Dezambiguizarea generației citea anii din NUMELE modelului, cu regex care cerea paranteze.
   69 din 345 de modele îi aveau scriși. Anii au trecut în `models.an_start` / `an_final`.
3. Două generații cu același nume de bază („XC 60 (2012–2016)" și „(2017–2024)") erau declarate
   „ambigue" fără ca anii — singura informație care le desparte — să fie consultați vreodată.
4. Tabela `brands` avea 19 mărci, o listă de dealer de mașini noi. Feed-ul acoperă 44.
   1.473 de piese aveau compatibilitatea citită curat și cădeau doar fiindcă marca lipsea.

**Trei capcane evitate înainte de scriere**, fiecare prinsă la verificarea pe date:

- „Volkswagen T5" ar fi creat un model duplicat lângă „Transporter T5" — sursa scrie ambele forme
  pe aceeași piesă. 37 de piese. Rezolvat cu aliasuri legate de marcă.
- „Hyundai Matrix" apare ca linie de compatibilitate pe faruri de Audi și VW, fiindcă „Matrix" e
  tehnologia farului. Rezolvat cu verificare încrucișată pe marcă: o linie contrazisă de titlu nu
  mai poate CREA un model, dar se poate lega de unul existent — altfel ar fi căzut și
  compatibilitatea legitimă Sharan/Galaxy.
- Octavia 1 s-a fabricat până în 2010, dar i s-a pus 1996–2004: intervalul real s-ar fi suprapus
  peste „Octavia 2 (2004–2013)" și ar fi făcut ambigue **147 de piese** care azi se potrivesc
  corect.

**Șase duplicate unificate:** `A8 4N` = `A8 D5`, `Fiesta 8` = `Fiesta 7` (vânzătorii scriu ambele
numere pentru același an, nu e facelift), și patru BMW unde seed-ul inițial și importul creaseră
fiecare câte un rând — s-a păstrat codul, cu anii mutați pe el.

**Denumirile producătorului bat consecvența noastră:** `i10`, `i20`, `i30`, `i40`, `ix35`, `bZ4X`
se scriu cu literă mică. Regula din cod nu mai atinge numele care încep cu una-două litere mici
urmate de cifră. „Jumpy" rămâne cu majusculă — Citroën chiar așa îl scrie.

---

## Rămase de făcut, la coadă

- **anii pentru 4 modele** lăsate intenționat goale: `Focus C-Max` și `Logan MCV` (completarea ar
  crea ambiguitate, fiindcă sunt candidate pentru liniile altui model), `Ibiza 5` și `Espace 5`
  (prea puține date).
- **acțiunea 5** — extragerea din titlu, pentru cele 107 piese fără compatibilitate. Amânată:
  107 din 8.754 nu justifică un mecanism nou de ghicit, cu riscul lui de fals pozitiv.

## Verificări

`node scripts/verifica-import.mjs` — **110 verificări trec**, față de 82 la începutul zilei.
`npm run build` — trece.

---
---

# RAPORT — 28 august 2026 · PARTEA A, încheiată

Migrările 23 și 27 rulate pe producție. Cele 7 verificări din A.7 trec, toate măsurate.

---

## Migrările

Rulate prin conectorul Supabase, în ordine, pe baza reală.

**23 — `rls-citire-echipa.sql`.** Cinci politici de citire, toate cu `is_staff()`. Verificat
după rulare: `products` are acum `publicat = true OR is_staff()`, iar `part_requests`,
`car_intake_requests`, `return_requests` și `contact_messages` au `is_staff()`. Nimic nu s-a
lărgit spre public — `is_staff()` înseamnă exact cine avea deja drept de scriere pe aceleași
rânduri.

**27 — `mod-vacanta.sql`.** Înainte de rulare am comparat mecanic funcția `plaseaza_comanda`
din migrarea 12 cu cea din 27, cu comentariile și spațiile scoase. Diferența e exact cele 7
linii ale gărzii de vacanță, inserate imediat după `begin`. Nimic altceva. Verificarea asta
nu e ceremonie: `create or replace` pe funcția care creează comenzile ar fi dat înapoi tăcut
orice modificare făcută între timp direct în bază.

După rulare: rândul `settings.vacanta` există (`activ: false`), `vacanta_publica()` există și
e executabilă doar de `anon` și `authenticated` — `PUBLIC` nu apare în lista de drepturi, deci
`revoke` a prins. Garda e prezentă în corpul funcției de comandă.

---

## Cele 7 verificări din A.7

`node scripts/verifica-vacanta.mjs` acoperă 5 dintre ele, pe baza reală, cu un ciclu
activare/dezactivare adevărat: **12 verificări trec, 0 pică.**

| # | Verificare | Rezultat |
|---|---|---|
| 1 | după ciclu revin exact aceleași piese | ✓ amprentă identică pe 8.754 de piese |
| 2 | piesa ascunsă de operator rămâne ascunsă | ✓ |
| 3 | piesa cu stoc 0 nu reapare | ✓ |
| 4 | POST direct către `plaseaza_comanda` e refuzat | ✓ și refuzul vine ÎNAINTEA oricărei alte verificări |
| 6 | zero scrieri în `products` la activare și la dezactivare | ✓ |

Punctele 5 și 7 nu se pot verifica din script — unul trăiește în `localStorage`, celălalt e o
măsurătoare de pixeli. Le-am făcut în browser real (Chromium, playwright-core):

**7 — hello bar-ul sub 52px.** Cu un mesaj de exact 120 de caractere, cât plafonul din
interfață:

| lățime | înălțime | ≤52px | scroll orizontal | text tăiat |
|---:|---:|:---:|:---:|:---:|
| 320px | 44px | ✓ | nu | da |
| 360px | 44px | ✓ | nu | da |
| 390px | 44px | ✓ | nu | da |
| 768px | 44px | ✓ | nu | da |
| 1280px | 44px | ✓ | nu | nu |

44px pe toate lățimile, fiindcă `truncate` ține bara pe un rând, iar `min-h-[44px]` e ținta de
atingere. Mesajul întreg rămâne în `title`.

**5 — coșul supraviețuiește ciclului.** ✓ Conținutul din `localStorage` e identic la octet
înainte de activare, în timpul vacanței și după dezactivare.

---

## Două lucruri de știut pentru cine verifică a doua oară

Ambele m-au trimis pe piste false. Le scriu ca să nu se repete.

**Coșul PARE că se golește pe `npm run dev`. Nu se golește.** `CartProvider` are două efecte:
unul citește `localStorage` la montare, celălalt scrie la fiecare schimbare. În dev, React
rulează efectele de două ori (StrictMode): la a doua trecere, efectul de scriere a apucat deja
să pună `[]`, iar cel de citire îl citește pe acela. Pe build de producție coșul persistă
corect — verificat pe amândouă. Verificările de coș se fac pe `npm run build && npx next start`,
nu pe `dev`.

**Comutarea vacanței direct în bază NU e un test valid al afișării.** Site-ul public citește
starea din layout, iar `app/layout.tsx` are `revalidate = 300`. Comutatorul din admin cheamă
`golesteCachePublic()` din `lib/settings.ts` → `/api/revalideaza` imediat după o salvare
confirmată, deci în folosire reală schimbarea se vede pe loc. Un `PATCH` prin REST sare peste
pasul ăsta și lasă paginile cu starea veche până la 5 minute — arată ca un defect, dar e doar
cache. Verificat cu cache-ul gol: bara de vacanță apare pe toate paginile, banda de avertizare
pe `/piese`, `/cos`, `/checkout` și `/favorite`, butoanele de comandă dispar peste tot, iar
prima pagină rămâne cu zero carduri de piese.

---

## Starea bazei la închidere

Vacanța: **dezactivată**. Catalog: 8.754 de piese, toate publicate, zero cu stoc 0.
Comenzi: 0 — sonda care testează garda folosește coșul gol, deci n-a creat nimic și n-a scos
nicio piesă unicat din stoc.

`npm run build` — trece.

---
---

# RAPORT — 28 august 2026 · PARTEA B, încheiată

Migrarea 28 rulată. Paginile de mașină există și funcționează. Nivelul 3 din B.3 nu e
implementat, cum cere sarcina — propunerea e la final.

---

## B.0 — inventarul, și de ce a schimbat toată partea

**Cauza celor „0 piese disponibile" e curat de date. Calculul era corect.**

`products.vehicul_id` există din `schema.sql`, are index, iar triggerul `recalc_piese_vehicul`
numără corect `publicat and stoc > 0`. Era completat pe **0 din 8.754 de piese**. Cu zero
legături, 0 e răspunsul onest.

Coloana se numește `vehicul_id`, nu `vehicle_id` — prima mea căutare n-a găsit-o și era să
raportez că legătura nu există deloc.

**Mecanismul era construit în întregime, doar nefolosit:** `ProductForm` are de mult câmpul
„Mașina-sursă", `/piese?vehicul=` filtrează, pagina de produs are „alte piese de la aceeași
mașină", iar `/admin/masini` calculează profit și amortizare pe mașină. Tot lanțul aștepta o
coloană pe care nimeni n-a completat-o.

Cele 22 de mașini: 4 din `seed.sql` (iulie), 18 introduse de mână pe 26 august. Motorul de
import nu atinge niciodată `vehicles`.

### Legătura nu se poate deduce din titlu — măsurat, nu presupus

Am încercat de trei ori și am greșit de trei ori, ceea ce e chiar rezultatul:

| încercare | rezultat |
|---|---|
| potrivire pe subșir | „6" din „Golf 6" prinde în „201**6**" |
| potrivire pe cuvânt întreg | „6" prinde în „1.**6**" — **36 din 67** de „potriviri" la Golf 6 erau piese de **Golf 7** |
| plafon optimist | 246 de piese, **2,8%** din catalog, și acelea contaminate |

Cauza de fond: feed-ul nu spune NICIODATĂ de pe ce mașină s-a demontat piesa. CSV-ul are ID,
URL, Titlu, Monedă, Preț; pagina scrie „compatibilă cu", adică potrivire, nu proveniență. Iar
două Passat B6 din curte (BMP și BMR) ar fi oricum indistingibile din titlu.

**Decizia ta:** piesele importate rămân nelegate; paginile se umplu de la prima mașină
dezmembrată de noi. Marca și modelul intră ca date separate, legate de `brands`/`models`.

---

## Ce s-a construit

**Migrarea 28, `pagini-masini.sql`** — `vehicles` trece de la 9 la 19 coloane: `poze`,
`descriere`, `publicat`, `motorizare`, `caroserie`, `culoare`, `cutie_viteze`, `km`,
`marca_id`, `model_id`. Citirea publică trece din `using (true)` în
`publicat = true or is_staff()`, ca o mașină nepublicată să dea 404 **și prin REST**, nu doar
în cod.

**`/masini/[slug]`** — galerie, titlu, specificații, descriere, piesele mașinii (cu filtru pe
categorie de la 12 piese în sus), caruselul de compatibile, formular de cerere precompletat cu
mașina. Metadate, JSON-LD (`Vehicle` + `BreadcrumbList`), breadcrumb, intrare în `sitemap.xml`.

**`/masini`** — lista, împărțită intenționat în două: „Cu piese pe site" și „În dezmembrare
acum". A doua grupă nu e umplutură: clientul care caută o portieră de Passat B6 vrea exact
informația „au mașina, întreabă-i".

**Admin → Mașini la dezmembrat** — poze (`PhotoUploader`, aceeași conversie WebP), descriere,
comutator de publicare, marcă/model, cele cinci specificații, link „vezi pagina ↗" și
marcaje „⚠ fără marcă" / „⚠ fără model", ca la modelele fără ani.

**Hero (B.5)** — arată doar mașinile cu cel puțin o piesă și **dispare complet** dacă nu există
niciuna. Grila trece atunci pe o coloană; altfel titlul ar fi rămas strâns pe 1.2fr cu un gol
de 0.8fr lângă el. Numărul se calculează live, nu din `piese_listate`.

---

## Verificat în browser, pe build de producție

Ca să pot verifica și cazul „mașină cu piese", am legat **temporar** 14 piese de două mașini,
am verificat, apoi am desfăcut tot. Amprenta `md5` a coloanei `vehicul_id` pe toate cele 8.754
de rânduri e **identică** înainte și după: `fa03cbe2…`. Zero date de test rămase în bază.

| Verificare | Rezultat |
|---|---|
| mașină cu piese | 200 · 8 piese · carusel vizibil cu 6 carduri, fiecare cu „de pe …" |
| mașină fără piese | 200 · mesaj + formular de cerere, nu pagină goală |
| mașină inexistentă | **404** |
| `/masini` | ambele grupe, 22 de mașini |
| hero, starea reală | secțiunea ascunsă, zero apariții „0 piese disponibile" |
| responsive | 4 lățimi × 2 teme, fără scroll orizontal |
| `sitemap.xml` | 22 de mașini + `/masini` |
| erori de consolă / cereri căzute | niciuna |

Un defect prins la verificare: titlul ieșea „Passat B6 2.0 TDI BMP **2.0 TDI 140 CP**" —
comparam motorizarea ca text întreg cu numele. Cilindreea („2.0") e partea care se repetă
mereu, deci ea e testul bun.

---

## Două lucruri reparate pe lângă sarcină, și de ce

**`/cauta-dupa-masina` avea exact același defect ca hero-ul**: 22 de mașini cu „0 piese
listate", fiecare ducând la `/piese?vehicul=…`, adică la o listă goală. Era o cale ruptă chiar
lângă cea nouă, așa că am tratat-o la fel: „piese pe cerere" și link către pagina mașinii.

**`scripts/curata-orfani.mjs` ar fi șters toate pozele de mașini.** Compară fișierele din
bucketul `poze-piese` doar cu `products.poze`, iar `PhotoUploader` urcă pozele mașinilor în
același bucket. Cu `--sterge`, fiecare poză de mașină ar fi fost ștearsă ca orfană. Acum
citește și `vehicles.poze`.

---

## Rămase de făcut

**Nivelul 3 din B.3 — platforma comună. Cum l-aș construi.**

Un tabel `platforme (id, nume)` plus `models.platforma_id`, completat o singură dată, de om,
pentru modelele care contează. Nu se poate deduce automat: numele platformei nu apare nicăieri
în datele noastre. Sursa cea mai bună e chiar pieseauto.ro — la import s-a observat că o piesă
de Touran stă sub `vw/passat-b6`, deci **ei grupează deja pe platformă**, iar acea informație
se poate extrage din URL-urile de categorie pe care le aducem oricum. Aș măsura întâi câte
modele distincte apar sub un URL „străin" (Touran sub Passat B6), fiindcă frecvența spune dacă
merită tabelul. Recomand să aștepte: fără piese legate de mașini, nivelul 3 n-ar avea ce
ordona.

**Sitemap-ul conține doar 1.000 de piese din 8.754.** Interogarea cere `.limit(5000)`, dar
Supabase plafonează un răspuns REST la 1.000 de rânduri, tăcut. Deci **7.754 de piese nu sunt
în sitemap**. E un defect vechi, dinaintea Părții B, și se repară cu paginare. N-am atins-o:
e în afara sarcinii. Spune dacă vrei s-o rezolv.

**Paginile de mașină sunt goale până la prima mașină dezmembrată de noi.** Asta e consecința
directă a deciziei de a lăsa piesele importate nelegate, și e în regulă — dar există o cale de
a le umple imediat, fără nicio ghicitoare: o secțiune „piese care se potrivesc pe această
mașină", construită din `vehicles.model_id` față de `products.model_ids`. Legătura aia e deja
în bază, verificată în Partea E, și e despre compatibilitate — exact ce înseamnă `model_ids` —
nu despre proveniență, deci nu minte pe nimeni. Ar transforma 22 de pagini goale în 22 de
pagini utile. Nu am făcut-o: nu e în sarcină. Spune dacă o vrei.

## Verificări

`npm run build` — trece.
`node scripts/verifica-import.mjs` — 110 verificări trec (neatins de Partea B).
