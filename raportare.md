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

---
---

# RAPORT — 28 august 2026 · PLAFONUL DE 1.000 DE RÂNDURI

Un singur defect, în 20 de locuri. În producție de trei zile, de când importul a trecut de
1.000 de piese.

---

## Cauza

PostgREST plafonează orice răspuns la 1.000 de rânduri. `.limit(5000)` nu ajută: plafonul e al
serverului, iar `limit` îl poate doar coborî. Serverul spune adevărul de fiecare dată —
`content-range: 0-999/8754` — dar nimeni nu citea antetul, iar un array de 1.000 arată exact ca
unul complet.

Capcana era **deja cunoscută și scrisă**, din luni, în `lib/import/depozit.mjs`:

> „Peste 1.000 de rânduri PostgREST taie tăcut, iar un import care crede că are 1.000 de piese
> în bază când are 8.000 ar depublica 7.000 de rânduri bune."

N-a ieșit niciodată din modulul acela. Motorul de import a fost singurul cod corect din proiect.

---

## Ce se vedea

| Loc | Arăta | Adevărul |
|---|---|---|
| `/piese` | 1.000 de piese, fără nicio paginare | 8.754 |
| filtrul de mărci | 16 mărci | 38 |
| Volkswagen | 513 piese | 3.085 |
| `sitemap.xml` | 1.000 de URL-uri | 8.754 |
| Admin → Piese de completat | „De completat: 500" | 8.625 |
| Admin → Mărci, Mașini, Rapoarte | contoare pe 11% din catalog | — |

Din filtru lipseau complet 22 de mărci, printre care **Dacia** (343 de piese), **Toyota** (471)
și **Volvo** (238). Într-un magazin de dezmembrări din Neamț.

**Cel mai grav era însă un script.** `curata-orfani.mjs` citea 1.000 de piese din 8.754, deci
pozele celorlalte 7.754 nu erau „folosite" de nimeni. Rulat cu `--sterge`, ar fi șters
**18.776 din 20.157 de fișiere — 93% din bucket, ~1,6 GB** — și ar fi raportat succes.
Măsurat, nu presupus: am reintrodus defectul pe o copie, cu ștergerea neutralizată.

---

## Ce s-a construit, în ordinea cerută

**Întâi unealta, apoi reparațiile.** Motivul e al proprietarului și e corect: 20 de reparații
scrise de mână înseamnă 20 de șanse de a greși una, plus toate locurile viitoare.

`citesteTot()` în `lib/supabase.ts`, cu geamănul `citesteTotRest()` în `lib/rest.mjs` pentru
scripturi, care nu folosesc `supabase-js`. Amândouă:
- citesc `content-range` și continuă până se termină, nu până la o limită fixă;
- **aruncă eroare dacă antetul lipsește**, în loc să presupună că răspunsul e complet;
- au un plafon de siguranță care **aruncă** la depășire, nu taie tăcut;
- poartă, în comentariu, exact fraza din `depozit.mjs`.

Plus `citesteDupaIduri()`, pentru a doua limită, independentă: `.in("order_id", ids)` pune
fiecare id în URL și crapă la câteva mii de comenzi. Sparge în loturi de 200.

**O regulă care nu era evidentă:** paginarea cere `.order()` pe o coloană UNICĂ. `created_at` nu
e unic — importul scrie sute de rânduri în aceeași secundă — iar fără departajator aceeași piesă
poate apărea pe două pagini și alta pe niciuna. Toate paginările adaugă `.order("id")`.

### Reparațiile

1. **Contoarele** — nu se mai calculează în Node deloc. Migrarea 29 aduce
   `numar_piese_pe_model` (538 de rânduri) și `numar_piese_pe_masina` (22). Corecte prin
   construcție: nu există mărime a catalogului care să le poată depăși. Ca să afli 538 de numere
   nu aduci 8.754 de rânduri prin rețea.
2. **`/piese`** — paginare clasică, 24 pe pagină, `?pagina=N`, `rel=prev/next` ca elemente
   `<link>` adevărate, canonical pe fiecare pagină, contorul din `count`.
3. **`sitemap.xml`** — în bucle, până se termină.
4. **Cele două scripturi**, cu prioritate — plus plasa de siguranță de 5% la ștergere.
5. **Adminul** — mărci, mașini, rapoarte, piese de completat, comenzi, clienți, facturi,
   expedieri, dashboard.
6. **Bombele cu ceas** — toate, nu doar cele care trecuseră pragul. Exportul CSV pentru Saga era
   cel mai grav: la a 1.001-a comandă ar fi scris un fișier incomplet care arată perfect valid.

`rel=prev/next` NU se pun prin `metadata.other` — acela emite `<meta name="link:prev">`, care nu
înseamnă nimic pentru Google.

---

## Verificat în browser, pe build de producție

| Verificare | Rezultat |
|---|---|
| `/piese`, contorul | **8.739 piese găsite · pagina 1 din 365** |
| carduri pe pagină | 24 |
| `?pagina=3` | canonical `/piese?pagina=3`, `rel=prev` → 2, `rel=next` → 4 |
| filtrul de mărci | **38** |
| Dacia · Toyota · Volkswagen | 344 · 470 · 3.081 |
| `sitemap.xml` | **8.739** piese + 22 mașini = 8.779 URL-uri |
| `scan-responsive`, 13 lățimi × 2 teme | 0 scroll orizontal · 0 ținte sub 44px · 0 text sub 12px |
| `curata-orfani.mjs` | 17 orfani reali (înainte: ar fi raportat 18.776) |
| plasa de 5% | oprește ștergerea și cere confirmare explicită |

**8.739, nu 8.754**, fiindcă între audit și verificare a rulat importul zilnic (azi 09:14: 29
piese noi, 2 actualizate, 44 depublicate). Pagina arată exact ce e în bază — asta era ideea.

## Verificări

`npm run build` — trece.
`node scripts/verifica-import.mjs` — 110 verificări trec.

---
---

# RAPORT — 28 august 2026 · PARTEA C, încheiată

Google Analytics 4 e implementat și verificat. Migrarea 30 rulată. **Nu e pornit** — și nici
n-ar trebui pornit până nu se rezolvă un lucru din Partea legală, mai jos.

---

## Ce am verificat înainte să scriu (C.2 cere asta)

**Bannerul de cookie-uri exista și era funcțional.** Salvează în `localStorage`, cheia
`autopas_cookies`, cu trei stări: lipsă / `necesare` / `toate`. Există și o pagină „Setări
cookie-uri" unde alegerea se poate schimba oricând. N-am rescris nimic din ele; le-am legat
la un modul comun (`lib/consimtamant.ts`), fiindcă `localStorage` nu anunță pe nimeni când se
schimbă în aceeași filă — fără asta, „Accept toate" n-ar fi pornit măsurarea decât la
următoarea reîncărcare, adică exact vizita pe care voiai s-o măsori s-ar fi pierdut.

---

## Cele patru condiții

Analytics-ul se încarcă **doar** dacă toate sunt adevărate. Măsurat în browser:

| Situație | Script | Cereri către Google |
|---|---|---|
| fără ID configurat, chiar cu acord | 0 | **0** |
| cu ID, vizitatorul n-a ales încă | 0 | **0** |
| cu ID, a apăsat „Doar necesare" | 0 | **0** |
| cu ID, a apăsat „Accept toate" | 1 | 2 |
| `/admin`, cu acord | 0 | **0** |

ID-ul vine prin `ga4_public()` (migrarea 30), o funcție care întoarce **exclusiv** id-ul.
Rândul `settings.integrari` nu e citibil public și trebuie să rămână așa: în el stau parola
FAN Courier și cheia privată Netopia.

---

## Trei defecte găsite la verificare, nu la citirea codului

Toate trei aveau același simptom: analytics-ul „mergea", dar pierdea tăcut evenimente.

**1. Evenimentele primei încărcări se pierdeau.** `gtag` apare după hidratare, iar efectele
React rulează înaintea lui. La navigarea din interiorul aplicației totul mergea; la
deschiderea directă a unei adrese, nimic. Cel mai grav era `purchase`: se marca drept trimis
fără să fi plecat, deci vânzarea se pierdea definitiv. Rezolvat cu o coadă golită când `gtag`
apare — **nu** prin `onReady` al lui next/script, care pentru un script inline se declanșează
la montare, înainte ca scriptul să fi rulat.

**2. `/cos` și `/checkout` nu măsurau deloc.** Sunt pagini STATICE, iar ID-ul primit pe props
de la layout rămânea prins în HTML-ul generat la build. Analytics-ul pornea pe paginile
dinamice și tăcea exact pe cele unde se întâmplă vânzarea. Rezolvat radical: componenta își
cere singură id-ul din browser, după acceptare. Nu mai există cache de golit.

**3. `view_cart` și `begin_checkout` plecau cu coșul gol.** `CartContext` citește
`localStorage` într-un efect, deci la prima randare coșul e gol, iar un efect cu dependențe
goale rula exact atunci. Legate acum de apariția coșului, o singură dată.

---

## Evenimentele, verificate în browser

| Eveniment | Rezultat |
|---|---|
| `search` | ✓ `search_term: turbina`, 131 rezultate |
| `view_item_list` | ✓ 24 de piese, cu numele listei |
| `select_item` | ✓ la click pe card |
| `view_item` | ✓ valoare 3000, `item_id: AP-008784` |
| `add_to_cart` / `remove_from_cart` | ✓ |
| `view_cart`, `begin_checkout` | ✓ și la încărcare directă |
| `purchase` | ✓ o dată; **0 la reîncărcare** |
| `generate_lead` | ✓ pe ambele formulare |

`select_item` a cerut o componentă nouă, `LinkPiesa`: `ProductCard` e componentă de SERVER și
nu poate avea `onClick`. În loc să trecem tot cardul în client — ceea ce ar trimite în browser
codul de randare al fiecărei piese din listă — am trecut doar linkul.

**Zero date personale.** Am căutat în `dataLayer` după „telefon", „email", „adresa" și „@":
niciun rezultat.

---

## ⚠ Ce blochează pornirea — decizia e a ta

**Politica de cookies spune acum, negru pe alb, că NU folosim Google Analytics:**

> „Site-ul acesta nu te urmărește. Nu folosim Google Analytics, nu avem pixel de Facebook, nu
> afișăm reclame și nu facem profilare."

Nu e o scăpare: pagina e scrisă onest, pe baza a ce făcea codul, și spune același lucru în
**cinci locuri**. Mai mult, comentariul din `lib/legal.ts` avertiza exact pentru ziua asta:
„Dacă se adaugă vreodată un instrument de statistică, tabelul de mai jos și secțiunea «Ce nu
folosim» trebuie actualizate."

Ce devine fals în clipa în care lipești ID-ul:

1. **„Pe scurt"** — „nu te urmărește", „nu folosim Google Analytics".
2. **„Ce sunt cookie-urile"** — „nu punem niciun cookie propriu". GA pune `_ga` și
   `_ga_XXXXXXXX`, care sunt cookie-uri proprii, valabile 2 ani.
3. **Tabelul „Lista completă"** — îi lipsesc cele două rânduri.
4. **„Ce nu folosim"** — primul punct e chiar „instrumente de analiză a traficului (Google
   Analytics…)".
5. **„Despre bannerul de cookie-uri"** — scrie că „Doar necesare" și „Accept toate" fac același
   lucru. De acum chiar diferă.

Sarcina spune explicit „nu o rescrie fără să-mi spui", așa că **n-am atins `lib/legal.ts`**.
Codul e inert până lipești ID-ul, deci se poate trimite pe live în siguranță așa cum e.

Avertismentul e scris și în `docs/google-analytics.md`, și în pașii cartonașului GA4 din
Admin → Integrări, ca să nu poată fi ratat.

## Verificări

`npm run build` — trece.
ID-ul de test a fost șters din bază: `ga4: { id: "", activ: false }`.
