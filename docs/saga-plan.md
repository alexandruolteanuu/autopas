# Plan de implementare — integrarea SAGA WEB

Ramura: `saga-integrare` · scris la 10 noiembrie 2026 · documentația API: `docs/saga-api.md` ·
raportul despre proiect: `raportare.md`.

**Stare: PLAN, fără cod.** Nicio migrare nu se rulează pe producție și nu se face push fără
aprobarea explicită a proprietarului.

**Mod de lucru**: după aprobarea planului se implementează UN SINGUR pas din secțiunea C, apoi
lucrul se oprește: raport (ce s-a făcut, ce fișiere, cum se verifică) și se așteaptă
confirmarea proprietarului înainte de pasul următor.

## Date confirmate de pe ultima factură reală din SAGA (10 noiembrie 2026)

| ce | valoare | unde ajunge |
|---|---|---|
| Firma | PIESE AUTO PAS SRL, CIF RO36608590 | `settings.firma` (vezi A.16) |
| TVA | **regim normal, 21%** | `settings.integrari.saga` |
| Rotunjirea | 200,00 cu TVA → valoare **165,29**, TVA **34,71**, preț unitar **165,2900** | confirmă regula din A.7 |
| Articolul generic | **„ACCESORII AUTO”**, UM **BUC** — articolul implicit; codul vine de la contabilă | A.5 |
| Persoane fizice | **fără CNP** pe factură | `ClientCIF` configurabil (A.17) |
| Mențiunea de plată | **„ramburs in cont”** | configurabilă (A.17) |
| Seria actuală din SAGA | **„PAP FE”** (cu spațiu); ultimul număr manual la 10.11.2026, după-amiaza: **14192** (facturarea manuală continuă până în ziua pornirii) | **ACEASTA e seria aplicației** — decizia din 10.11.2026 (A.4). Numărul de start se setează abia în ziua pornirii |
| Capital social, banca | **200 RON**, **BCR Piatra Neamt** | le scrie proprietarul în Admin → Setări după pasul 3 — **nu în cod** (A.16) |

---

## 0. Ce am aflat din cod și schimbă planul

Lucruri verificate în proiect, de care depind deciziile de mai jos:

1. **Rândul `settings.integrari` e citibil de TOATĂ echipa** (`is_staff()` = admin, operator,
   contabil — `supabase/admin-fix.sql`). Parola FAN e deja acolo și o poate citi și un operator.
   Pentru cheia SAGA nu repetăm asta: **cheia stă într-o tabelă proprie, fără nicio politică RLS**,
   deci accesibilă doar cu cheia de serviciu, adică doar din rutele de server. Nici adminul nu o
   poate citi din browser. În `settings.integrari.saga` rămân doar setările care NU sunt secrete
   (serie, cotă TVA, regim, adresa API-ului).
2. **Reducerea e pe comandă, nu pe linie** (`orders.discount_valoare`). Factura trebuie s-o arate
   cumva — propunere: linie separată, negativă (vezi A.6, întrebare pentru contabilă).
3. **Transportul**: pe comenzile de după 15 septembrie 2026 îl încasează FAN, deci NU intră pe
   factura noastră. Pe cele 2 comenzi vechi e inclus în total și intră. Regula există deja în
   `livrareFacturabila()` din `app/admin/facturi/page.tsx` — se mută în bază, într-un singur loc.
4. **`orders` n-are `user_id`**: clientul nu e legat de un cont. `GUID_cod_client` nu are o sursă
   naturală (vezi întrebările).
5. **`sterge_comanda` șterge comanda cu tot cu liniile** (cascadă). O comandă facturată NU mai
   are voie să poată fi ștearsă — altfel dispare documentul fiscal. Se blochează în bază.
6. **Județul**: `fan_localitati` / `fan_judete` au doar numele, fără cod. Trebuie o tabelă proprie
   cu cele 42 de coduri oficiale (ISO 3166-2:RO — date publice, nu inventate).
7. **Blocarea de tip `dezro_trezire` nu ajunge aici**: aceea e o fereastră de 20 s („nu trezi de
   două ori”), nu o excludere reciprocă. SAGA cere STRICT un apel o dată, altfel cheia rotită se
   pierde. Folosim aceeași FORMĂ (rând unic + `update … where` atomic), dar cu un deținător și cu
   termen de expirare (vezi A.4).
8. **Lacătele „advisory” din Postgres NU merg** prin Supabase: fiecare cerere REST poate ajunge
   pe altă conexiune din pool, iar lacătul de sesiune s-ar elibera (sau n-ar exista) între două
   cereri. De aici rândul-lacăt cu termen.
9. **`settings.firma` din producție** (citit la 10 noiembrie 2026) are: `denumire`
   („S.C. PIESE AUTO PAS S.R.L.”), `cui` („RO 36608590” — **cu spațiu**), `reg_com`, `adresa`
   (un singur text, cu comuna și județul în el), `iban` (completat), `telefon`, `email`,
   `whatsapp`, `serie_factura` („AUTP”). **Lipsesc** pentru XML: capitalul social, banca,
   localitatea, județul și țara ca valori separate. Vezi A.16.
10. **Seria e azi scrisă în DOUĂ locuri, iar niciunul nu e folosit**: `settings.firma.serie_factura`
    (din Admin → Setări) și `settings.integrari.saga.serie` (din Admin → Integrări). Plus „AUTP”
    ca rezervă în cod (`FIRMA_IMPLICITA`). Planul le înlocuiește cu o singură sursă (A.4).

---

## A) Schema bazei de date

**O migrare mică pe fiecare pas din C care atinge baza**, nu un singur fișier mare (46 =
`retur-fan.sql`, scrisă, nerulată):
- **47 = `supabase/saga-calcul.sql`** (pasul 1): `calculeaza_linie_tva`, `judete_coduri`,
  `cod_judet`, `transport_facturabil`. Scrisă la 10 noiembrie 2026.
- 48, 49… = pașii următori (`saga-facturi.sql` la pasul 4, `saga-articole.sql` la pasul 5,
  `saga-api.sql` la pasul 7, …), numerotate în ordinea în care se scriu.

Fiecare: idempotentă (`if not exists`, `drop policy if exists`, `on conflict`), fără `drop`
pe obiecte existente și fără `update` în masă pe date vechi. O eroare anulează doar pasul ei.
Testele SQL ale fiecărei migrări stau în `scripts/verifica-saga-*.sql` (rulate pe baza de TEST).

### A.1 Funcția de rol: `is_facturare()`

`select exists(select 1 from profiles where id = auth.uid() and role in ('admin','contabil'))`.
`security definer`, `stable`. Folosită de toate politicile de mai jos și de rutele `/api/saga*`
(prin `rpc`). `revoke execute … from public, anon`; `grant … to authenticated`.

### A.2 Tabela `facturi` — documentul

| câmp | tip | rol |
|---|---|---|
| `id` | bigint identity PK | trimis la SAGA ca `GUID_factura` |
| `tip` | text check (`factura`,`storno`) | |
| `storno_pentru` | bigint → `facturi(id)` | doar la storno; index unic parțial = **cel mult un storno** pe factură |
| `order_id` | bigint → `orders(id)` **on delete restrict** | o comandă facturată nu se mai poate șterge |
| `serie` | text not null | copiată din contor la emitere |
| `numar` | int not null | alocat atomic (A.3); `unique (serie, numar)` |
| `data` | date not null | data facturii (fusul României) |
| `scadenta` | date | implicit = `data` (ramburs) — de confirmat |
| `regim_tva` | text check (`normal`,`marja`) | copiat din setări la emitere |
| `preturi_cu_tva` | boolean | copiat din setări la emitere |
| `client` | jsonb not null | **copia** clientului: nume, firmă, CUI, nr. reg. com., adresă, localitate, județ, cod județ, țară, e-mail, telefon |
| `furnizor` | jsonb not null | **copia** datelor firmei din `settings.firma` (A.16) — o schimbare de IBAN nu rescrie facturi vechi. `emite_factura` refuză dacă lipsește denumirea, CIF-ul, nr. Reg. Com., adresa sau IBAN-ul |
| `mentiune_plata` | text | copiată din setări („ramburs in cont”), vezi A.17 |
| `total_fara_tva`, `total_tva`, `total` | numeric(12,2) | suma liniilor, calculată în bază |
| `observatii` | text | „Comanda AP-2026-01004”; intră în `FacturaInformatiiSuplimentare` după mențiunea de plată (A.17) |
| `saga_status` | text check (`de_trimis`,`in_curs`,`trimisa`,`eroare`,`confirmata`) default `de_trimis` | |
| `saga_eroare` | text | ultimul mesaj, pentru panou |
| `saga_trimisa_la`, `confirmata_la` | timestamptz | |
| `confirmata_de` | uuid | cine a bifat „confirmată în SAGA” |
| `emisa_de` | uuid | |
| `created_at`, `updated_at` | timestamptz | |

### A.3 Tabela `facturi_linii` — copia pieselor

| câmp | tip | rol |
|---|---|---|
| `id` | bigint identity PK | |
| `factura_id` | → `facturi(id)` on delete cascade | |
| `nr_crt` | int | `LinieNrCrt` |
| `tip` | text check (`piesa`,`reducere`,`transport`) | |
| `order_item_id`, `product_id` | bigint, **fără FK obligatoriu** (`on delete set null`) | doar urmă; factura nu depinde de ele |
| `cod_intern` | text | `AP-000123` → `GUID_cod_articol` |
| `denumire_site` | text | numele complet al piesei → `InformatiiSuplimentare` |
| `cod_articol_saga` | text | `CodArticolClient`, din potrivire (A.5) |
| `descriere` | text | `Descriere` (denumirea articolului din gestiune) |
| `um` | text default `BUC` | |
| `cantitate` | numeric(12,3) | negativă la storno |
| `pret_cu_tva` | numeric(12,2) | prețul unitar plătit de client — sursa calculului |
| `pret_fara_tva` | numeric(12,4) | `Pret` |
| `valoare` | numeric(12,2) | `Valoare` (fără TVA) |
| `cota_tva` | numeric(5,2) | `ProcTVA` |
| `tva` | numeric(12,2) | `TVA` |

**Nemodificabil după trimitere — garantat în bază, nu doar în interfață**: un trigger
`before update or delete` pe `facturi` și pe `facturi_linii` refuză orice schimbare a
datelor când factura e în `in_curs`, `trimisa` sau `confirmata`. La `facturi` are voie să se
schimbe doar coloanele `saga_*` și `confirmata_*`, și doar înainte (`trimisa` → `confirmata`,
nu invers).

### A.4 Numerotarea: `facturi_serii` + `emite_factura()`

**De ce nu `sequence`**: o secvență Postgres „consumă” numărul și la o tranzacție anulată, deci
lasă goluri. Factura cere numere fără goluri.

`facturi_serii (serie text PK, urmator int not null, activa boolean not null default false,
actualizat_la timestamptz, actualizat_de uuid)` + index unic parțial pe `activa` (`where activa`)
= **cel mult o serie activă**. Seria poate conține spații („PAP FE”); se salvează exact cum e
scrisă, fără spații la capete.

**Fără serie implicită.** Nu există „AUTP”, „PAP FE” sau altă serie în cod sau în migrare.
`settings.firma.serie_factura`, `settings.integrari.saga.serie` și „AUTP” din
`FIRMA_IMPLICITA` ies din uz: câmpul dispare din Admin → Setări → Date firmă (valoarea din bază
rămâne, nefolosită — nu se șterge nimic). **Singura sursă e `facturi_serii`.**

**DECIZIA PROPRIETARULUI (10 noiembrie 2026): NU se face serie separată.** Din ziua pornirii,
toate facturile se emit DOAR din aplicație, pe seria existentă din SAGA, **„PAP FE”**. Până
atunci facturarea manuală pe PAP FE continuă (la 10.11.2026, după-amiaza, ultimul număr era
14192). Recomandarea veche, o serie dedicată „PAP WEB”, a fost scoasă.
- **Numărul de start NU se setează acum**, ci în ziua pornirii: ultimul număr emis manual + 1
  (vezi „Procedura de pornire”, după secțiunea C).
- **Nicio serie și niciun număr fix în cod sau în migrări.** „PAP FE” și numerele din plan sunt
  EXEMPLE; în bază ajung doar prin `seteaza_serie_factura`, din admin.

**`emite_factura(p_order_id bigint) returns json`** — `security definer`, verifică `is_facturare()`
la început. Totul într-o singură tranzacție (o funcție = o tranzacție):

1. Refuză dacă comanda e `anulata` sau are deja o factură (nu storno) neanulată.
1b. **Data de start a facturării** (regulă obligatorie, 10 noiembrie 2026): citește
   `settings.integrari.saga.data_start_facturare`. **Fără dată setată, refuză TOT**: „Data de
   start a facturării nu e setată (Admin → Integrări → Saga). Comenzile de dinainte au fost
   facturate manual în SAGA.” Dacă `orders.created_at` e ÎNAINTEA datei (comparat în ziua
   României, `Europe/Bucharest`), refuză: „Comanda AP-… a fost plasată pe …, înainte de data de
   start a facturării (…). Comenzile de dinainte se facturează manual în SAGA, nu din aplicație.”
   Verificarea stă ÎN bază, nu doar în interfață: e singurul loc prin care nu trece nimic pe lângă.
2. Citește seria ACTIVĂ din `facturi_serii`. **Dacă nu există, refuză**: „Seria facturilor nu e
   configurată. Setați seria și numărul de start în Facturi → Setări serie, după ce le stabiliți
   cu contabila.”
3. `select urmator from facturi_serii where serie = … for update` — **blocare pe rând**:
   a doua apăsare simultană AȘTEAPTĂ aici până se termină prima, apoi primește numărul următor.
   Fără dubluri.
4. Construiește copia clientului, a furnizorului și liniile (A.6), calculează TVA-ul (A.7).
5. Inserează `facturi` + `facturi_linii`, face `urmator = urmator + 1`.
6. Actualizează compatibilitatea pe `orders` (A.9).

Dacă oricare pas pică, se anulează TOT, inclusiv incrementul: **nu rămâne gol**.

**Seria și numărul de start**: `seteaza_serie_factura(p_serie text, p_urmator int)` — doar
`is_facturare()` (deci și contabila, nu doar adminul: e domeniul ei). Creează seria dacă nu
există, o face activă (și le dezactivează pe celelalte) și pune `urmator`. Refuză un număr mai
mic sau egal cu cel mai mare număr deja emis în seria aceea (altfel ar ieși dubluri). *Exemplu:*
„PAP FE”, continuare de la 14193 (dacă ultima factură manuală ar fi 14192). Fiecare schimbare
intră într-un istoric propriu (`facturi_serii_istoric`: serie, număr următor, cine, când) — urma
zilei de pornire.

**Confirmare explicită în admin, înainte de salvare** (pagina Facturi → Setări serie): o bifă
obligatorie, cu textul calculat din ce s-a scris — „Confirm că ultima factură emisă manual în
SAGA pe {serie} are numărul {număr următor − 1} și că facturarea manuală pe {serie} s-a
oprit.” Fără bifă, butonul de salvare e inactiv. (Bifa e o protecție a interfeței; regula
„număr peste cel mai mare emis” e a bazei.)

**Formatul numărului spre SAGA — o singură funcție.** În bază, seria și numărul stau separat
(*exemplu:* `serie = 'PAP FE'`, `numar = 14193`). Cum devin ele `FacturaNumar` în XML și cum se
recunosc în `NR_DOC` din raport NU se știe încă (întrebarea 1 pentru contabilă): „PAP FE14193”,
„PAP FE 14193” sau doar „14193”, cu seria în altă parte. De aceea:

- `lib/saga-xml.ts` are EXACT două funcții care știu formatul: `numarPentruSaga(serie, numar)`
  (scrie) și `facturaDinNrDoc(nrDoc, facturi)` (recunoaște în raport). Nimic altceva din
  proiect nu lipește seria de număr spre SAGA.
- Formatul e o setare, `settings.integrari.saga.format_numar`: `serie_lipita` / `serie_spatiu` /
  `doar_numar`, **fără valoare implicită** — trimiterea refuză până e aleasă, după răspunsul
  contabilei (ideal, după XML-ul-model exportat din SAGA, vezi întrebarea 1).
- **Formatul DATEI, cu aceeași regulă** (adăugat la 10 noiembrie 2026): setarea
  `settings.integrari.saga.format_data` — `zi-luna-an` („10-11-2026”) / `zi.luna.an`
  („10.11.2026”) / `an-luna-zi` („2026-11-10”) —, **fără valoare implicită**; trimiterea refuză
  până e aleasă. O singură funcție o aplică, `dataPentruSaga(data)` din `lib/saga-xml.ts`, pentru
  `FacturaData` și `FacturaScadenta`. Data din numele FIȘIERULUI de import urmează separat
  exemplul din documentația API („F_123123_15_09_2026.xml”, cu „_”).
- **Indicii (nu confirmări), la întrebarea 1**: numărul ca „PAP FE 14188” (`serie_spatiu`) și
  data zi-lună-an sunt cele mai probabile. Nu devin implicite: se confirmă la pasul 6 (D.4).
- Recunoașterea din raport e toleranță: compară după eliminarea spațiilor și a majusculelor,
  iar dacă `NR_DOC` conține doar cifre, potrivește după număr ÎN cadrul fișierului trimis (un
  fișier conține o singură serie). Ce nu se potrivește → „raport neînțeles”, nu `trimisa`.
- Afișarea în aplicație rămâne „PAP FE 14193” (*exemplu*: serie, spațiu, număr) — oglinda din
  A.9 la fel.

**Retragerea unei facturi netrimise**: singurul caz în care un număr poate „dispărea” e o factură
emisă din greșeală, netrimisă încă. `retrage_factura(p_id)` o șterge DOAR dacă e `de_trimis` ȘI
are cel mai mare număr din serie (și atunci decrementează contorul) — deci tot fără gol. Orice
altă factură se corectează (înainte de trimitere) sau se stornează (după).

### A.5 Potrivirea cu gestiunea: `saga_articole`

`saga_articole (id, categorie_id → categories on delete cascade, cod_articol text not null,
denumire text, um text default 'BUC', verificat_la timestamptz, verificat_raspuns jsonb,
unique (categorie_id))`.

- Căutarea la emitere: **subcategoria piesei → categoria ei → articolul implicit**. Așa o
  potrivire pe o categorie-părinte acoperă toate subcategoriile, iar o subcategorie poate avea
  articol propriu.
- **Articolul implicit e „ACCESORII AUTO”, UM „BUC”** — confirmat de pe factura reală.
  Denumirea și UM-ul se pun ca valori de pornire în setări; **codul** (`articol_implicit`) îl
  dă contabila și rămâne gol până atunci. Tot în `settings.integrari.saga`: `articol_reducere`,
  `articol_transport` (pot fi tot „ACCESORII AUTO”, de confirmat). `emite_factura` refuză cu mesaj
  clar dacă articolul implicit n-are cod — mai bine decât o factură cu cod gol.
- **Consecință**: cu un singur articol generic, la început TOATE liniile ies „ACCESORII AUTO”,
  cu numele piesei în `InformatiiSuplimentare` — exact ca pe factura reală. Tabela de potrivire
  rămâne în plan (contabila poate vrea articole pe categorii mai târziu), dar pasul 5 din C devine
  mic: pagina pornește goală, iar „fără potrivire” = articolul implicit.
- La linie: `cod_articol_saga` + `descriere` = articolul din gestiune; **`denumire_site`** (numele
  complet de pe site, cu codul AP-…) merge în `InformatiiSuplimentare`.

### A.6 Liniile facturii

- **Piese**: câte o linie pe `order_items`, cu cantitatea și prețul din comandă (prețul CU TVA,
  stabilit de server la plasare).
- **Reducere** (dacă `discount_valoare > 0`): o linie negativă „Reducere cod X”, cu aceeași cotă.
  Alternativă: repartizare proporțională pe linii — de ales cu contabila.
- **Transport**: o linie doar dacă `livrareFacturabila` (comenzile vechi, cu transportul în
  total). Regula se mută din browser într-o funcție SQL, `transport_facturabil(order)`, folosită
  de `emite_factura` și de exportul CSV.

### A.7 TVA și rotunjirea

Setările, în `settings.integrari.saga`: `cota_tva` (implicit **21**), `regim_tva` (implicit
`normal`), `preturi_cu_tva` (implicit **true**). Nicio cotă scrisă în cod.
**CONFIRMAT de pe factura reală: regim normal, 21%, iar regula de rotunjire de mai jos dă exact
cifrele de pe factură** (200,00 → 165,29 + 34,71, preț unitar 165,2900).

**Funcția unică de calcul**: `calculeaza_linie_tva(p_pret_cu_tva, p_cantitate, p_cota)`
`returns (pret_fara_tva, valoare, tva, total)`. Folosită de `emite_factura` ȘI de exportul CSV,
deci cele două nu pot ajunge să calculeze diferit.

**Regula (preț cu TVA inclus)**, pentru o linie cu prețul unitar P, cantitatea Q și cota r:

1. `total   = round(P × Q, 2)` — exact ce plătește clientul pe linia aceea.
2. `valoare = round(total / (1 + r/100), 2)` — baza.
3. `tva     = total − valoare` — **prin diferență, nu calculat separat**.
4. `pret_fara_tva = round(valoare / Q, 4)` — afișat cu 4 zecimale.

**De ce așa**: (a) suma `valoare + tva` e **exact** ce a plătit clientul, la ban — esențial la
ramburs, unde suma de pe AWB trebuie să bată cu factura; dacă baza și TVA-ul s-ar rotunji
independent, ar putea ieși 1 ban în plus sau în minus; (b) rotunjirea se face pe LINIE, nu pe
total, fiindcă așa o cere XML-ul SAGA (fiecare linie are valoarea și TVA-ul ei) și așa o face și
SAGA; (c) `round()` din Postgres pe `numeric` rotunjește „jumătatea în sus, departe de zero”
(2,345 → 2,35; −2,345 → −2,35), deci la storno, unde cantitatea e negativă, rezultatul e
exact opusul facturii. În JavaScript `Math.round` NU face așa la negative — încă un motiv ca
toate calculele să stea în bază.

Exemple:
- **De pe factura reală (referința)**: 200,00 lei, 21% → total 200,00 · valoare **165,29** ·
  TVA **34,71** · preț fără TVA **165,2900**.
- 350 lei, 21% → total 350,00 · valoare 289,26 · TVA 60,74 · preț fără TVA 289,2600 (prețul unitar vine din baza DEJA rotunjită — 289,26 ÷ 1 —, nu din 350 ÷ 1,21 = 289,2562; așa o face și SAGA: 165,2900, nu 165,2893).

**Regimul „marjă”** (bunuri second-hand, regim special): **nu se folosește** — firma e pe regim
normal (confirmat). Setarea `marja` rămâne configurabilă, ca să nu fie nevoie de migrare dacă se
schimbă vreodată, dar în faza 1 `emite_factura` refuză cu „Regimul marjă nu e implementat”.

### A.8 Județele: `judete_coduri`

`judete_coduri (cod text PK, nume text, cautare text generated)` — 41 de județe + București
(`B`), din ISO 3166-2:RO. `cautare` = numele fără diacritice, cu litere mici, prin
`text_cautare` (funcția care există deja). Funcția `cod_judet(text) returns text` caută după
`text_cautare(input)`, acceptă și forme cu „ş/ţ” (sedilă), „Mun. Bucuresti”, „Bucuresti” și
codul însuși („NT”). Întoarce `null` dacă nu găsește — iar `emite_factura` refuză atunci cu
„Județul «X» nu e recunoscut; corectează-l în factură”. Citire publică (sunt date publice).

### A.9 Compatibilitatea cu `orders.factura_serie` / `factura_status`

**Data de start a facturării** (regulă obligatorie, 10 noiembrie 2026). Comenzile din urmă —
488 la 10 noiembrie 2026 — **NU se facturează din aplicație**: au fost facturate manual în SAGA.
- Setarea `settings.integrari.saga.data_start_facturare` (dată, `AAAA-LL-ZZ`), **fără valoare
  implicită**. O setează adminul în Admin → Integrări → Saga, după ce o stabilește cu contabila.
- `emite_factura` refuză comenzile plasate înaintea ei și, fără dată setată, refuză tot (A.4, 1b).
- Butonul „Emite factura” NU apare pe comenzile dinaintea datei (nici în pagina comenzii, nici în
  `/admin/facturi`, nici în acțiunile în masă); acolo rămâne doar câmpul manual de serie
  („Factură emisă direct în SAGA”). Ascunderea e comoditate; refuzul din bază e garanția.
- **Oglinda nu atinge comenzile vechi**: `factura_serie` și `factura_status` ale lor rămân exact
  cum le-a scris omul. Nicio migrare nu le recalculează.

Coloanele **rămân**, dar devin o OGLINDĂ, scrisă de bază, nu de om:

- `emite_factura` pune `factura_serie = 'PAP FE 14193'` (*exemplu*; serie, spațiu, număr — forma de afișare,
  nu cea spre SAGA) și `factura_status = 'emisa'`.
- Emiterea unui storno pune `factura_status = 'stornata'`.
- `retrage_factura` le readuce la `null` / `de_emis`.

Așa lista de comenzi, filtrul din `/admin/facturi` și exportul CSV merg neschimbate.

- **Comenzile fără document** (cele facturate până acum direct în SAGA) își păstrează seria
  scrisă de mână. Câmpul manual rămâne, sub numele „Factură emisă direct în SAGA (fără document
  aici)”, și e **blocat** când comanda are un document în `facturi`.
- `nu_se_emite` rămâne setabil manual (ex. comandă de test).
- **Nu se migrează nimic** în tabelele noi din istoric: o factură emisă deja în SAGA, recreată
  aici, ar fi a doua cu același număr.

### A.10 Cheia API: `saga_cheie`

`saga_cheie (unic boolean PK default true check (unic), cheie text, schimbata_la timestamptz,
rotiri int default 0, cheie_anterioara_hash text)`. **RLS pornit, NICIO politică** → nici
`anon`, nici `authenticated` n-o pot citi sau scrie; doar `service_role` (`sbAdmin()`).
Se scrie doar din ruta `/api/saga` (acțiunea „salvează cheia”), după `is_facturare()`.
Panoul vede doar „cheie setată: da / nu, rotită ultima dată la …”.

### A.11 Blocarea: `saga_blocare` + funcții

`saga_blocare (unic boolean PK default true check (unic), detinator uuid, pana timestamptz
default '-infinity')`.

- `saga_ia_blocarea(p_detinator uuid, p_secunde int default 90) returns boolean`:
  `update … set detinator = p, pana = now() + p_secunde where unic and pana < now()` →
  `found`. Atomic: din două cereri simultane, una singură primește `true`.
- `saga_elibereaza(p_detinator uuid)`: `update … set pana = '-infinity' where detinator = p`
  (doar cel care a luat-o o poate elibera).
- **Termenul de 90 s** > limita de 60 s a unei funcții Vercel: dacă funcția e omorâtă la
  jumătate, lacătul expiră singur, iar sistemul nu rămâne blocat pentru totdeauna.
- Ambele doar pentru `service_role` (`revoke … from public, anon, authenticated`).

### A.12 Jurnalul trimiterilor: `saga_trimiteri`

`saga_trimiteri (id, created_at, factura_ids bigint[], tip text ('import','get_articol','test','serie'),
fisier text (numele XML-ului), xml text, http_status int, raspuns text (corpul: JSON sau raportul),
durata_ms int, cheie_rotita boolean, eroare text, de uuid)`.
**Niciodată cheia, nici în `xml`, nici în `raspuns`.** Citire: `is_facturare()`; scriere: doar
`service_role`.

### A.13 Exportul CSV

Funcția `export_saga_linii(p_de date, p_pana date) returns table(...)`, `is_facturare()`:
pentru comenzile cu document, întoarce liniile COPIATE din `facturi_linii` (exact ce s-a
facturat); pentru cele fără, calculează cu `calculeaza_linie_tva` și cota din setări. Browserul
doar transformă rezultatul în CSV. Coloana „TVA 19%” devine „TVA” + o coloană „Cota”.

### A.14 Siguranța comenzilor facturate

- **Schimbat la implementare (pasul 4, 10 noiembrie 2026): `sterge_comanda` NU se modifică.**
  Protecția o dă cheia străină `facturi.order_id → orders(id) ON DELETE RESTRICT`, numită
  intenționat `comanda_facturata_nu_se_poate_sterge`: o comandă CU factură nu se poate șterge
  pe nicio cale (`sterge_comanda`, SQL direct, orice cod viitor), iar numele constrângerii apare
  în mesajul de eroare. Motivul: aceeași protecție, fără a rescrie o funcție din producție.
  Verificat local: `sterge_comanda` pe o comandă facturată se oprește, iar repunerea pe stoc pe
  care o face înainte de ștergere se anulează odată cu ea (o singură tranzacție). Pagina
  comenzii traduce mesajul și ascunde butonul de ștergere pe comenzile facturate (pasul 6).
- `anuleaza_comanda` pe o comandă facturată: **avertizează, nu blochează** (anularea repune
  stocul; factura se stornează separat) — formularea exactă în pagina comenzii.
- **Modificarea funcțiilor existente** se face după regula din CLAUDE.md: copiate din PRODUCȚIE,
  comparate mecanic cu sursa din git, abia apoi rulate.

### A.15 RLS — rezumat

| obiect | select | insert / update / delete |
|---|---|---|
| `facturi`, `facturi_linii` | `is_facturare()` | doar prin funcții (`emite_factura`, `modifica_factura`, `storneaza_factura`, `retrage_factura`) și `service_role` (statusurile `saga_*`) |
| `facturi_serii` | `is_facturare()` | doar prin `seteaza_serie_factura` / `emite_factura` |
| `saga_articole` | `is_facturare()` | `is_facturare()` |
| `judete_coduri` | public | nimeni (date din migrare) |
| `saga_cheie`, `saga_blocare` | nimeni | nimeni (doar `service_role`) |
| `saga_trimiteri` | `is_facturare()` | doar `service_role` |

Fiecare funcție nouă: `revoke execute … from public` **și** `from anon` (lecția din migrarea 42:
pe Supabase, `anon` primește drept direct, nu doar prin `PUBLIC`).

Funcții noi, pe scurt: `is_facturare`, `emite_factura`, `modifica_factura` (înainte de
trimitere: datele clientului, codul articolului și descrierea pe linii — prețurile NU, ele vin
din comandă), `storneaza_factura`, `retrage_factura`, `seteaza_serie_factura`,
`calculeaza_linie_tva`, `transport_facturabil`, `cod_judet`, `export_saga_linii`,
`saga_ia_blocarea`, `saga_elibereaza`.

**Stornarea**: `storneaza_factura(p_id)` — doar pe o factură `trimisa` sau `confirmata`,
fără alt storno. Creează un document `tip = 'storno'`, cu număr nou din aceeași serie, aceleași
linii cu cantitatea negativă, `observatii = 'Stornare factura PAP FE 14193 din …'` (*exemplu*).
Merge la SAGA ca orice factură.

**Regulă (decizia din 10 noiembrie 2026): după pornire, stornările pe PAP FE se fac DOAR din
aplicație (pasul 10), niciodată manual în SAGA.** O stornare manuală ar lua un număr din PAP FE
pe care aplicația nu-l cunoaște, iar următoarea factură din aplicație l-ar dubla (riscul 7).

### A.16 Datele firmei: câmpuri noi în `settings.firma`

Nu e nevoie de migrare de schemă: `settings.valoare` e jsonb. Se adaugă câmpuri în tipul
`Firma` din `lib/settings.ts` și în formularul din Admin → Setări → Date firmă (doar adminul,
ca azi). Valorile le scrie proprietarul din formular — **nu se pun în cod și nici în migrare**.

| câmp `settings.firma` | există? | merge în XML |
|---|---|---|
| `denumire` | da — „S.C. PIESE AUTO PAS S.R.L.” | `FurnizorNume` |
| `cui` | da — „RO 36608590” | `FurnizorCIF` + numele fișierului, **fără spații** („RO36608590”), printr-o singură funcție `cifCurat()` |
| `reg_com` | da | `FurnizorNrRegCom` |
| `capital` | **NU — de adăugat** | `FurnizorCapital` |
| `banca` | **NU — de adăugat** | `FurnizorBanca` |
| `iban` | da (completat) | `FurnizorIBAN` |
| `adresa` | da, dar text întreg | `FurnizorAdresa` (cum e) |
| `localitate` | **NU — de adăugat** | `FurnizorLocalitate` |
| `judet` | **NU — de adăugat** | `FurnizorJudet` (prin `cod_judet`) |
| `tara` | **NU — de adăugat** (pornește „RO”) | `FurnizorTara` |
| `telefon`, `email` | da | `FurnizorTelefon`, `FurnizorMail` |
| `serie_factura` | da | **ieșit din uz** (A.4) |

- `adresa` NU se sparge în componente: apare deja așa în subsol, în contact și în cele 8
  documente legale. `localitate` și `judet` sunt câmpuri ÎN PLUS.
- **Denumirea**: în setări e „S.C. PIESE AUTO PAS S.R.L.”, pe factura reală „PIESE AUTO PAS
  SRL”. Firma e recunoscută de SAGA după CIF, deci nu blochează nimic, dar textul de pe factură
  vine de unde ia SAGA. De ales de proprietar dacă se schimbă în setări (atinge și site-ul).
- **CIF-ul**: SAGA pune factura la Ieșiri când `FurnizorCIF` = CIF-ul firmei. „RO 36608590” cu
  spațiu ar putea să nu se potrivească — de aceea `cifCurat()`, verificată la D.1.

### A.17 Mențiunea de plată și clientul persoană fizică

În `settings.integrari.saga`:

- `mentiune_plata` — pornește „ramburs in cont” (valoarea de pe factura reală), editabilă.
  **Câmpul din XML**: structura SAGA n-are un câmp dedicat pentru modul de plată, iar câmpurile
  `Facturaxxx` sunt toate cu altă destinație. Propunere: **`FacturaInformatiiSuplimentare`**, ca
  prim rând: „ramburs in cont”, apoi „Comanda AP-2026-01004”. Se confirmă pe XML-ul-model
  exportat din SAGA (întrebarea 1): dacă factura reală are mențiunea în alt câmp, se mută acolo —
  e o singură linie în `lib/saga-xml.ts`.
- `cif_persoana_fizica` — ce se trimite la `ClientCIF` pentru o persoană fizică: `gol` (implicit,
  ca pe factura reală, fără CNP) / `liniuta` („-”) / `treisprezece_zerouri` („0000000000000”).
  Rămâne setare până răspunde contabila (întrebarea 4).

---

## B) Fișiere

### Noi

| fișier | rol |
|---|---|
| `supabase/saga-calcul.sql` (47) + migrările pașilor următori | secțiunea A, împărțită pe pași |
| `scripts/verifica-saga-calcul.sql` | testele pasului 1; rulează pe producție, din SQL Editor, între `begin` și `rollback`, încheiate mereu cu o eroare (D.2) |
| `scripts/anuleaza-saga-*.sql` | anularea fiecărei migrări SAGA, fără `cascade` (D.2) |
| `scripts/baza-test.sh` | aplică migrările în ordine și rulează testele SQL pe o bază de TEST; refuză baza de producție. Nefolosit deocamdată (fără bază de test, D.2) |
| `lib/saga.ts` | **clientul API**, ca `lib/fancourier.ts`: `configSaga()` (adresa API-ului din setări, cu `SAGA_URL` ca rezervă), `EroareSaga`, `cere()` intern (lacăt → citește cheia → apel → salvează `X-Saga-Refresh-Token` → eliberează), `importaFacturi(xml, numeFisier)`, `getArticol(cod)`, `verificaConexiunea()`. Doar pe server. |
| `lib/saga-xml.ts` | construirea XML-ului din `facturi` + `facturi_linii` (funcție pură: date → text), escape XML, numele fișierului `F_<CIF curat>_<numar>_<data>.xml`; și **parsarea raportului** 207/422 pe facturi, după `NR_DOC`. Singurul loc care știe formatul numărului spre SAGA (`numarPentruSaga`, `facturaDinNrDoc`) și unde stă mențiunea de plată (A.4, A.17). Plus `cifCurat()`. Separat de `saga.ts` ca să poată fi testat fără rețea. |
| `app/admin/facturi/setari/page.tsx` | „Setări serie”: seria activă, numărul următor (prin `seteaza_serie_factura`), istoricul seriilor. Accesibilă pentru `admin` și `contabil` |
| `app/api/saga/route.ts` | ruta unică, cu `acțiune`: `trimite` (una sau mai multe facturi), `xml` (descarcă), `verifica-articol`, `salveaza-cheie`, `testeaza-conexiunea`. Verifică `is_facturare()` prin token, ca `esteEchipa()`. |
| `app/admin/facturi/[id]/page.tsx` | detaliul unei facturi: antet, linii, stare SAGA, jurnalul trimiterilor, butoanele |
| `app/admin/facturi/articole/page.tsx` | potrivirea categorie → articol SAGA, cu „Verifică în SAGA” (`GetArticol`) |
| `components/admin/FacturaSaga.tsx` | cardul de facturare refolosit în pagina comenzii și în detaliu |
| `scripts/verifica-saga.mjs` | verificările fără rețea: rotunjirea (cazuri limită, storno), XML-ul (structură, escape, nume fișier), parsarea raportului (exemplul din documentație + variante), județele |
| `scripts/verifica-saga-api.mjs` | verificările pe instanța de TEST SAGA (D.5) |
| `docs/saga-plan.md` | acest fișier |

### Modificate

| fișier | ce se schimbă |
|---|---|
| `lib/settings.ts` | tipul `Integrari.saga`: `cota_tva`, `regim_tva`, `preturi_cu_tva`, `url_api`, `format_numar`, `format_data`, `data_start_facturare`, `mentiune_plata`, `cif_persoana_fizica`, `articol_implicit` (+ denumire, UM), `articol_reducere`, `articol_transport`, `activ` — fără cheie și fără serie. Tipul `Firma`: `capital`, `banca`, `localitate`, `judet`, `tara`. `serie_factura: "AUTP"` scos din `FIRMA_IMPLICITA` |
| `app/admin/setari/page.tsx` | „Date firmă”: câmpurile noi (capital, bancă, localitate, județ, țară); câmpul „Serie facturi” scos |
| `lib/supabase.ts` | `esteFacturare(req)`, gemenele lui `esteEchipa()`, pe `is_facturare()` |
| `app/admin/facturi/page.tsx` | lista de documente cu filtre pe `saga_status`, acțiuni în masă („Trimite selectate”), export CSV prin `export_saga_linii`, textul despre „Saga nu are API public” rescris |
| `app/admin/comenzi/[id]/page.tsx` | caseta „Facturare (Saga)” înlocuită de `FacturaSaga` |
| `app/admin/integrari/page.tsx` | cardul „Saga — facturare”: TVA, adresa API-ului, formatul numărului și al datei, mențiunea de plată, `ClientCIF` pentru persoane fizice, articole implicite, cheia (doar câmp de scriere, niciodată afișată), „Testează conexiunea”; câmpul „Seria facturilor” scos (seria e în Facturi → Setări serie); descrierea și pașii rescriși; cardul „e-Factura ANAF” — formularea despre „import de fișiere” |
| `app/admin/layout.tsx` | `MENIU`: „Facturi” rămâne `admin` + `contabil`; sub-pagina de articole |
| `lib/types.ts` | `Factura`, `FacturaLinie`, `SagaStatus` |
| `CLAUDE.md` | migrarea 47 în ordine, decizia SAGA în blocul de decizii, `verifica-saga*.mjs` în tabelul de unelte, `facturi*` în tabelele cheie |

**Cine ce setează**: **seria și numărul de start** — adminul ȘI contabila (Facturi → Setări
serie, prin funcția din bază). **TVA-ul, formatul, mențiunea, articolele, cheia** — doar adminul
(Integrări; politica pe `settings` lasă scrierea doar lui). Intenționat: o cotă schimbată greșit
afectează toate facturile următoare. Dacă se vrea altfel, se mută și ele pe pagina de setări din
Facturi, scrise prin ruta `/api/saga`.

---

## C) Ordinea de implementare

Fiecare pas se termină cu `npm run build` trecut și cu verificarea lui (D). Commit după fiecare
pas, pe `saga-integrare`. **Niciun push și nicio migrare pe producție fără aprobare.**
**Un singur pas o dată**: după fiecare, raport (ce, ce fișiere, cum se verifică) și oprire până
la confirmarea proprietarului.

1. **Calculul TVA + județele, doar în SQL** — `calculeaza_linie_tva`, `judete_coduri`,
   `cod_judet`, `transport_facturabil`. Fără nicio tabelă de facturi încă.
2. **Exportul CSV corectat** — `export_saga_linii` (încă fără ramura „cu document”) și pagina
   `/admin/facturi` care îl folosește; cota din setări, nu 19%. *Folositor imediat, chiar
   dacă restul nu se termină.*
3. **Datele firmei** — câmpurile noi din A.16 în tipul `Firma` și în Admin → Setări; câmpul
   „Serie facturi” scos de acolo. Fără SQL. Proprietarul completează capitalul, banca, localitatea.
4. **Tabelele de facturi + numerotarea** — `facturi`, `facturi_linii`, `facturi_serii`,
   `emite_factura`, `seteaza_serie_factura`, `retrage_factura`, triggerul de nemodificare,
   oglinda pe `orders`, protecția comenzilor facturate la ștergere, RLS. Plus pagina Facturi →
   Setări serie, cu confirmarea explicită (A.4).
5. **Potrivirea articolelor** — `saga_articole` + pagina de editare (fără butonul de verificare);
   articolul implicit „ACCESORII AUTO” / „BUC” în setări.
6. **Interfața de emitere** — „Emite factura”, detaliul facturii, „Modifică” (înainte de
   trimitere), „Retrage”, „Descarcă XML” (`lib/saga-xml.ts`). „Emite factura” apare DOAR pe
   comenzile plasate la sau după `data_start_facturare` și niciunde dacă data nu e setată (A.9);
   câmpul „Data de start a facturării” intră în cardul Saga din Integrări. **Aici factura există complet,
   fără niciun apel la SAGA** — se poate importa manual în SAGA WEB, ca probă, XML-ul descărcat.
7. **Clientul API** — `saga_cheie`, `saga_blocare`, `saga_trimiteri`, `lib/saga.ts`,
   „Testează conexiunea” și „Salvează cheia” în Integrări. Prima atingere a SAGA, pe instanța de test.
8. **Trimiterea** — „Trimite în SAGA”, „Reîncearcă”, parsarea raportului, „Marchează confirmată”,
   jurnalul în detaliu, acțiunea în masă. **Blocată până sunt alese `format_numar` și `format_data`.**
9. **Verificarea articolelor** prin `GetArticol` în pagina de potrivire.
10. **Stornarea** — `storneaza_factura` + butonul.
11. **Textele** — Integrări, Facturi, pagina comenzii; `CLAUDE.md`.
12. **Proba pe contul real și pornirea** — prima factură reală, pe PAP FE, după aprobarea
    contabilei (D.6), făcută EXACT după „Procedura de pornire” de mai jos, în ziua trecerii.

### Procedura de pornire (ziua trecerii pe facturarea din aplicație)

Decizia din 10 noiembrie 2026: aplicația continuă seria **„PAP FE”**. Toate numerele de mai
jos sunt *exemple* (dacă ultima factură manuală ar fi 14192). În aceeași zi, în ordinea asta:

1. **Ultima factură manuală.** Contabila emite în SAGA ultima factură manuală pe PAP FE și
   comunică numărul ei (*exemplu*: 14192). Se verifică în SAGA, în lista Ieșiri, că nu există
   niciun număr mai mare pe PAP FE (nici ciornă, nici storno).
2. **Oprirea facturării manuale pe PAP FE.** De acum nimeni nu mai emite și nu mai stornează
   manual pe PAP FE (riscurile 4 și 7). Dacă SAGA permite blocarea seriei pentru emitere
   manuală (întrebarea 12), se face aici.
3. **Seria în aplicație.** Admin → Facturi → Setări serie: serie „PAP FE”, număr următor =
   ultimul manual + 1 (*exemplu*: 14193). Se bifează confirmarea („Confirm că ultima factură
   emisă manual în SAGA pe PAP FE are numărul 14192 și că facturarea manuală pe PAP FE s-a
   oprit.”) și se salvează. Istoricul seriei păstrează cine și când.
4. **Data de start, în aceeași zi.** Admin → Integrări → Saga: `data_start_facturare` = data de
   azi. Comenzile plasate înainte rămân facturate manual (sau deja facturate) și NU pot fi
   facturate din aplicație.
5. **Prima factură din aplicație**, pe o comandă plasată azi sau după: „Emite factura” →
   „Descarcă XML” / „Trimite în SAGA” → în SAGA WEB, la Diverse → Import date, se verifică
   seria și numărul (*exemplu*: PAP FE 14193), clientul, liniile, totalul = rambursul de pe AWB;
   apoi validarea în SAGA și „Marchează confirmată” în aplicație. Abia după asta, facturare
   obișnuită.

Dacă la pasul 5 ceva nu e în regulă, factura încă netrimisă se poate retrage (`retrage_factura`,
doar ultima din serie, deci numărul se refolosește), iar cea trimisă se stornează DIN APLICAȚIE.

### Faza 2 — declanșarea automată (doar descrisă)

Aceeași formă ca `dezro_coada` și `email_coada`:

- La trecerea comenzii în starea aleasă (de exemplu `livrata` — de decis), un trigger pe
  `orders` cheamă `emite_factura` și pune factura în `saga_coada`, în ACEEAȘI tranzacție.
- **Triggerul ignoră comenzile plasate înaintea `data_start_facturare`, chiar dacă își schimbă
  starea** (o comandă veche trecută azi în `livrata` NU se facturează), și ignoră tot dacă data
  nu e setată. Condiția stă în trigger ÎNAINTE de orice apel — nu se bazează pe refuzul din
  `emite_factura`, care ar lăsa o eroare în coadă pentru fiecare comandă veche atinsă.
- **Emiterea și trimiterea în blocuri `exception` separate** (lecția din 7 septembrie 2026):
  o eroare la facturare nu are voie să anuleze schimbarea stării comenzii.
- `pg_net` trezește `/api/saga-coada`, care trimite pe rând, sub același lacăt; se recheamă
  singură cât mai are de lucru, doar dacă lotul a închis rânduri.
- Coada vizibilă în panou: câte așteaptă, câte s-au blocat după 5 încercări, ultima eroare,
  buton de golire manuală. Cât lipsește adresa webhook-ului, rândurile așteaptă — nu se pierde nimic.
- Plasă: o comandă anulată între emitere și trimitere nu se mai trimite (se decide la
  procesare, din starea de atunci — ca la dez.ro).

---

## D) Cum testăm

### D.1 Fără rețea și fără bază — `scripts/verifica-saga.mjs`
- Rotunjirea:
  - **Cazul de referință, de pe factura reală: 200,00 lei cu TVA, 21%, cantitate 1 → valoare
    165,29, TVA 34,71, preț unitar 165,2900.** Dacă testul ăsta pică, nimic altceva nu contează.
  - Același caz ca storno (cantitate −1) → −165,29 / −34,71 / −200,00.
  - 350 lei/21%, 0,01 lei, 99,99 × 3, prețuri care dau jumătate de ban, suma
    `valoare + tva = total` pe 10.000 de prețuri aleatoare.
  - Testele rulează pe funcția SQL REALĂ, pe producție în tranzacție anulată (D.2), din
    `scripts/verifica-saga-calcul.sql`,
    nu pe o copie JS: o copie ar trece testul și ar lăsa funcția greșită.
- XML: caractere speciale în nume (`&`, `<`, ghilimele, diacritice), numele fișierului cu CIF-ul
  curățat („RO 36608590” → „RO36608590”), `GUID_factura` = id, `importAutomat` mereu `false`,
  mențiunea de plată „ramburs in cont” în câmpul ales, `ClientCIF` pentru persoană fizică în
  fiecare dintre cele trei variante.
- Formatul numărului (*exemplu*): seria „PAP FE” cu numărul 14193 în toate cele trei formate;
  fără `format_numar` ales → refuz.
- Formatul datei: 10 noiembrie 2026 → „10-11-2026”, „10.11.2026”, „2026-11-10”; o zi sub 13
  (3 noiembrie) ca să se vadă inversarea zi/lună; fără `format_data` ales → refuz.
- Raportul: exemplul din documentație, raport cu un singur succes, cu „importata … deja”, gol,
  cu CRLF, cu `NR_DOC` „PAP FE14193”, „PAP FE 14193”, „14193” — toate recunoscute pentru
  factura PAP FE 14193 (*exemplu*), niciuna pentru 14194.
- Județe: toate cele 42 cu și fără diacritice, cu sedilă, „Bucuresti”, „Sector 3”, gunoi → `null`.

### D.2 Baza de date — pe PRODUCȚIE, doar în tranzacții anulate

**Decizia proprietarului, 10 noiembrie 2026: fără bază de test separată** (nici ramură
Supabase — cere planul Pro, 25 $/lună, plus ~0,32 $/zi de rulare, în afara Spend Cap —, nici
proiectul gratuit „autopas-test”). Migrările SAGA se rulează direct pe producție, din SQL
Editor, de proprietar. Asistentul nu rulează nimic pe producție. De aici trei reguli:

1. **Fiecare migrare are, în același commit:** o interogare de pre-verificare (doar citire:
   obiectele noi nu există deja, dependențele există), fișierul de anulare
   (`scripts/anuleaza-saga-*.sql`, fără `cascade`) și testele.
2. **Testele de pe producție rulează doar în tranzacții anulate** (`scripts/verifica-saga-*.sql`):
   `begin` … `rollback`, iar blocul de test se termină ÎNTOTDEAUNA cu o eroare — „REZULTAT OK:
   …” la reușită, „VERIFICARE PICATĂ: …” la eșec. O eroare anulează tot ce a făcut tranzacția,
   deci nicio scriere a testului nu poate rămâne, chiar dacă cineva adaugă una mai târziu.
   Mesajul apare în SQL Editor în căsuța roșie, intenționat.
3. **Probele de emitere (pasul 4 și următorii) folosesc seria „TEST”**, tot în tranzacții
   anulate: `seteaza_serie_factura('TEST', 1)` → `emite_factura` pe o comandă → verificări →
   eroare finală → totul anulat, inclusiv contorul. Seria reală („PAP FE”) nu e atinsă
   niciodată de un test, deci nu se consumă numere reale. Comenzile folosite sunt cele existente; nimic nu rămâne pe ele.

**Ce NU se poate testa într-o tranzacție anulată**: concurența (două `emite_factura` simultane
cer două sesiuni separate, care ar trebui să scrie de-adevăratelea). Aceste teste rulează
local, într-un Postgres 17 din Docker, cu obiectele Supabase de care depind simulate (roluri
`anon`/`authenticated`/`service_role`, `text_cautare`, `auth.uid()`) — cum s-a verificat deja
pasul 1. `scripts/baza-test.sh` rămâne în proiect, pentru ziua în care se face totuși o bază
de test.

Ce se verifică (pe producție în tranzacții anulate, cu seria „TEST”; concurența local):
- **Concurența numerotării**: 20 de `emite_factura` simultane, pe 20 de comenzi → numerele
  1..20, fără gol și fără dublură. Plus o emitere care pică la mijloc (județ invalid) → contorul
  neatins.
- `seteaza_serie_factura` refuză un număr deja folosit; serie cu spațiu („PAP FE”, „TEST X”) salvată exact.
- Fără serie activă, `emite_factura` refuză cu mesajul despre configurare și nu atinge nimic.
- **Data de start**: fără `data_start_facturare` → refuz pentru orice comandă; o comandă plasată
  cu o zi înainte → refuz cu mesajul despre facturarea manuală; una din ziua de start (inclusiv
  la 00:30 ora României, adică 22:30 UTC în ziua dinainte) → acceptată; contorul seriei neatins
  la refuz.
- Fără cod la articolul implicit sau fără IBAN în `settings.firma` → refuz cu mesaj clar.
- Triggerul: un `update` pe o factură `trimisa` e refuzat; doar statusul trece.
- RLS: ca `operator` și ca `anon`, `facturi` întoarce 0 rânduri; `saga_cheie` nu se vede nici
  ca `admin`.
- Garda: `sterge_comanda` pe o comandă facturată refuză.
- `revoke`: `anon` nu poate chema `emite_factura` (lecția din 42).

### D.3 Interfața — pe build-ul de producție local (`next start`)
Emite → modifică → retrage → emite iar (același număr) → descarcă XML. Rolurile: operatorul nu
vede „Facturi”, contabilul vede tot în afară de Integrări.

### D.4 XML-ul importat MANUAL în SAGA WEB de test
Înainte de orice cod de API: XML-ul descărcat (pasul 6) se încarcă de mână în SAGA, din
Diverse → Import date. Așa aflăm dacă SAGA îl acceptă, cum arată numărul, ce face cu
`InformatiiSuplimentare` — fără să riscăm cheia.

### D.5 API-ul, pe instanța de TEST SAGA — `scripts/verifica-saga-api.mjs`
Cu cheia de test, în variabile de mediu (niciodată în bază):
1. `GetArticol` pe un cod existent și pe unul inexistent (200 / 400).
2. Import cu o factură bună → 200; verificat în SAGA că apare la Import date, nevalidată.
3. Aceeași factură din nou → raportul „importata … deja” → tratat ca `trimisa`.
4. O factură cu clientul gol → 422 → `eroare` cu mesajul din raport.
5. Un fișier cu una bună și una greșită → 207 → fiecare cu starea ei.
6. XML stricat → 400.
7. **Rotirea cheii**: după fiecare apel, se verifică dacă a venit `X-Saga-Refresh-Token` și că
   apelul următor folosește cheia nouă. Plus: două apeluri pornite simultan → al doilea
   așteaptă sau refuză („o trimitere e deja în curs”), niciodată paralel.
8. Funcție omorâtă la mijloc (simulat: lacătul luat, procesul oprit) → după 90 s lacătul expiră.
9. **Niciun log, niciun răspuns către browser nu conține cheia** — căutare textuală în jurnal
   și în răspunsurile rutei.

### D.6 Proba pe contul real
O singură factură, pe o comandă reală, după ce contabila a validat XML-ul de la D.4. Se verifică
în SAGA: seria, numărul, clientul, liniile, totalul = rambursul de pe AWB. Abia apoi trimiteri
obișnuite.

---

## E) Riscuri și întrebări deschise

### Riscuri tehnice

1. **Cheia rotită pierdută** — dacă SAGA trimite o cheie nouă, iar funcția e omorâtă înainte s-o
   salveze, cheia veche e blocată și trebuie generată alta manual, din SAGA. Atenuare: cheia nouă
   se salvează **imediat după antete**, înainte de citirea corpului; timeout-ul apelului lasă
   timp sigur sub 60 s; în panou, un mesaj clar: „Cheia SAGA nu mai e acceptată — generați una
   nouă din Utilizatori → Integrare API”.
2. **Duplicat la reîncercare** — o trimitere care expiră de partea noastră poate să fi ajuns
   în SAGA (aceeași lecție ca la dez.ro). Atenuare: factura rămâne în `eroare`, cu mesajul
   „rezultat necunoscut”; la reîncercare, SAGA răspunde „importata … deja” → `trimisa`. **De
   confirmat cu SAGA**: cu `importAutomat=false`, detectează ei dublura la ÎNCĂRCARE sau abia la
   validare? Dacă abia la validare, o reîncercare poate pune același fișier de două ori în lista
   de importat.
3. **Raportul text nu are format garantat** — parsarea după `NR_DOC` e făcută după un singur
   exemplu. Atenuare: raportul brut se păstrează integral în jurnal; o factură pe care parserul
   nu o găsește în raport rămâne `eroare` cu „raport neînțeles”, niciodată `trimisa` din oficiu.
4. **Numerotarea în două locuri pe „PAP FE”** — decizia (10 noiembrie 2026) e ca aplicația să
   continue seria existentă „PAP FE”, pe care până la pornire se emit facturi manual. Dacă după
   pornire s-ar mai emite o singură factură manual pe PAP FE, ea ar lua un număr pe care
   aplicația îl va aloca și ea: două facturi cu același număr (*exemplu*: „PAP FE 14193”).
   Atenuare: **din ziua pornirii, facturarea manuală pe PAP FE se oprește complet** — și
   stornările (regula de la A.15) —; numărul de start se ia în aceeași zi, după ultima factură
   manuală (Procedura de pornire); confirmarea explicită din admin (A.4).
5. **Instanța de test SAGA** — documentația o pomenește, dar adresa ei nu apare. Fără ea,
   pasul 7 (clientul API) nu poate începe.
7. **Contorul intern al SAGA pentru PAP FE** (risc nou, 10 noiembrie 2026) — NU știm dacă un
   import XML avansează contorul de numerotare din SAGA pentru seria PAP FE. Dacă nu-l
   avansează, SAGA „crede” în continuare că următorul număr e cel de la pornire, iar o factură
   emisă ulterior manual în SAGA (din greșeală sau dintr-un obicei) ar primi un număr deja folosit
   de aplicație. Atenuare: regula „după pornire, nimic manual pe PAP FE”; întrebare pentru
   contabilă (12) și pentru suportul SAGA; de verificat la proba de la pasul 6 (după importul
   manual al XML-ului de probă, ce număr propune SAGA pentru o factură nouă pe PAP FE — fără să
   o salveze).
6. **Formatul numărului necunoscut** — o factură trimisă cu `FacturaNumar` în forma greșită
   poate intra în SAGA cu alt număr decât crede aplicația, sau poate să nu fie recunoscută în
   raport. La fel o dată în alt format decât așteaptă SAGA (zi și lună inversate trec
   neobservate până pe 13 ale lunii). Atenuare: formatul numărului și al datei sunt câte o
   singură funcție + o setare fără valoare implicită; trimiterea e blocată până sunt alese
   amândouă; prima probă (D.4, pasul 6) se face manual, cu XML descărcat, importat fără validare.

   **Indicii găsite la 10 noiembrie 2026 — NU confirmări:**
   1. Numele fișierului exportat din SAGA pentru factura PAP FE 14188 e
      „f_131096_PAP_FE_14188_10-11-2026_...pdf”: SAGA ține seria și numărul împreună, cu spații
      (devenite „_” în numele fișierului), iar data e zi-lună-an, cu cratimă. (E un PDF de
      tipărire, nu fișierul de import: prefixul „131096” nu e CIF-ul firmei, deci numele lui nu se
      copiază în numele XML-ului de import, care urmează documentația API.)
   2. În exemplul oficial de raport din documentația API, `NR_DOC` apare ca „A100”, „A1002”:
      seria face parte din număr.
   3. Modulul Odoo de integrare SAGA folosește implicit, pentru XML, data `%d-%m-%Y`; pe forumul
      SAGA apare și `dd.mm.yyyy`.
   4. Manualul SAGA: articolele se identifică după codul de bare sau după codul propriu, dacă
      apar în XML (relevant și pentru întrebarea 3).

   **Concluzie provizorie**: `format_numar` cel mai probabil = `serie_spatiu` („PAP FE 14188”),
   iar data = zi-lună-an. **Amândouă rămân NESETATE implicit**; se confirmă la proba manuală de
   la pasul 6 (XML descărcat, importat în SAGA WEB fără validare — D.4), sau din XML-ul-model.

### Întrebări pentru contabilă

Rezolvate la 10 noiembrie 2026, de pe factura reală: regimul TVA (normal, 21%), rotunjirea,
articolul generic („ACCESORII AUTO”, BUC), mențiunea de plată („ramburs in cont”), seria
actuală („PAP FE”, ultimul număr 14190), capitalul social (200 RON) și banca (BCR Piatra Neamt).

1. **PRIORITAR — formatul numărului.** Pentru o serie cu spațiu, cum se completează
   `FacturaNumar` în XML: „PAP FE14193”, „PAP FE 14193” sau doar „14193” (*exemplu*), cu seria în alt câmp?
   Și cum apare `NR_DOC` în raportul de import? **Cel mai sigur răspuns: XML-ul-model al facturii
   PAP FE 14192** (sau a ultimei facturi manuale), exportat din SAGA (Ieșiri → tipărire → „Formular PDF” → fișierul din
   `TEMP\Facturi`). Din el aflăm deodată și formatul numărului, și câmpul în care stă mențiunea de
   plată, și cum e scris clientul persoană fizică. Se salvează ca `docs/factura-model.xml`.
   Aceeași întrebare pentru **formatul datei** (`FacturaData`, `FacturaScadenta`).

   **Indicii găsite la 10 noiembrie 2026 — NU confirmări:**
   1. Numele fișierului exportat din SAGA pentru factura PAP FE 14188 e
      „f_131096_PAP_FE_14188_10-11-2026_...pdf”: SAGA ține seria și numărul împreună, cu spații
      (devenite „_” în numele fișierului), iar data e zi-lună-an, cu cratimă. (E un PDF de
      tipărire, nu fișierul de import: prefixul „131096” nu e CIF-ul firmei, deci numele lui nu se
      copiază în numele XML-ului de import, care urmează documentația API.)
   2. În exemplul oficial de raport din documentația API, `NR_DOC` apare ca „A100”, „A1002”:
      seria face parte din număr.
   3. Modulul Odoo de integrare SAGA folosește implicit, pentru XML, data `%d-%m-%Y`; pe forumul
      SAGA apare și `dd.mm.yyyy`.
   4. Manualul SAGA: articolele se identifică după codul de bare sau după codul propriu, dacă
      apar în XML (relevant și pentru întrebarea 3).

   **Concluzie provizorie**: `format_numar` cel mai probabil = `serie_spatiu` („PAP FE 14188”),
   iar data = zi-lună-an. **Amândouă rămân NESETATE implicit**; se confirmă la proba manuală de
   la pasul 6 (XML descărcat, importat în SAGA WEB fără validare — D.4), sau din XML-ul-model.
2. **Seria — DECISĂ de proprietar (10 noiembrie 2026): „PAP FE”, fără serie separată.** De
   confirmat cu contabila doar: (a) ziua pornirii și cine emite ultima factură manuală; (b) că
   din acea zi nimeni nu mai emite și nu mai stornează manual pe PAP FE (riscurile 4 și 7).
3. **Codul articolului „ACCESORII AUTO”** din gestiune. Și: reducerea și transportul tot pe
   „ACCESORII AUTO” sau pe alte articole (cu ce coduri)? Vor fi vreodată articole pe categorii
   (piese de motor, caroserie…), sau rămâne unul singur? Indiciu (manualul SAGA, vezi indiciul 4
   la întrebarea 1): articolele se recunosc după codul de bare sau codul propriu din XML — de
   confirmat dacă `CodArticolClient` e „codul propriu” al articolului „ACCESORII AUTO”.
4. **Persoanele fizice**: la `ClientCIF` trimitem gol (ca pe factura reală), „-” sau
   „0000000000000” (forma cerută de e-Factura pentru PF fără CNP)? Le identificăm cu
   `GUID_cod_client` sau lăsăm SAGA să le recunoască după nume?
5. **Evidență cantitativ-valorică?** Dacă da, ce cod de `Gestiune` se pune pe linii.
6. **Reducerea**: linie separată negativă sau repartizată proporțional pe piese?
7. **Data facturii**: data comenzii, data expedierii sau data emiterii din aplicație? Scadența:
   aceeași zi?
8. **Momentul facturării** (pentru faza 2): la confirmare, la expediere sau la livrare
   (încasarea rambursului)?
9. **Storno**: decis că, după pornire, se face DOAR din aplicație, pe PAP FE, cu număr nou (A.15).
   De confirmat cu contabila că e forma acceptată de ea (aceeași serie, număr nou, cantități
   negative, cu trimitere la factura stornată).
10. **Transportul de pe comenzile vechi** (cele 2 cu transportul inclus în total): cu ce articol
    și ce cotă?
11. **e-Factura**: confirmăm că transmiterea în SPV o face SAGA, după validare — deci aplicația nu
    trimite nimic la ANAF?
12. **Contorul SAGA pentru PAP FE** (riscul 7): după ce o factură intră în SAGA prin import XML,
    avansează SAGA contorul seriei PAP FE? Dacă nu, ce număr ar propune SAGA unei facturi noi
    emise manual după pornire — și se poate bloca în SAGA emiterea manuală pe PAP FE?

### Întrebări pentru SAGA (suport)
- Adresa instanței de test și cum primim o cheie pentru ea.
- Dublura la reîncărcare cu `importAutomat=false` (riscul 2).
- Formatul garantat al raportului 207/422.
- Cât timp poate dura un import (pentru timeout-uri, sub limita de 60 s a funcțiilor).
- **Contorul seriei** (riscul 7): importul XML (cu `importAutomat=false`, apoi validat manual)
  actualizează numărul următor al seriei PAP FE în SAGA? Se poate dezactiva emiterea manuală pe
  o serie folosită prin import?

---

## F) Jurnalul pașilor

Fiecare pas din C se încheie cu o intrare aici: ce s-a făcut, ce fișiere, cum se verifică și
ce rezultat trebuie văzut. Pasul următor începe doar după confirmarea proprietarului.

### Pasul 1 — calculul TVA, codurile de județ, transportul facturabil

**Stare: ÎNCHIS. Migrarea 47 e RULATĂ pe producție la 10 noiembrie 2026**, de proprietar, din
SQL Editor:
- `supabase/saga-calcul.sql` → „Success. No rows returned.”
- `scripts/verifica-saga-calcul.sql` → „REZULTAT OK: toate cele 33 de verificări au trecut.”
- **Pre-verificarea NU a fost rulată înainte.** Nu schimbă rezultatul: niciun obiect existent nu
  purta numele noi (verificat în cod), iar testele trec doar dacă tabela are exact cele 42 de
  județe și funcțiile se comportă exact ca în fișier — deci nu s-a înlocuit nimic străin. La
  pașii următori, pre-verificarea se rulează ÎNAINTE.
- Codul: commit pe `saga-integrare`, fără push. Pasul 2 a început după confirmarea proprietarului.

#### Ce s-a făcut

**Migrarea 47, `supabase/saga-calcul.sql`.** Nu atinge niciun rând și nicio politică
existentă; se poate rula de mai multe ori.
- `calculeaza_linie_tva(preț cu TVA, cantitate, cotă)` → total, valoare fără TVA, TVA (prin
  diferență), preț unitar fără TVA cu 4 zecimale, calculat din baza deja rotunjită. Cota vine
  ca parametru, nu e scrisă în cod. Refuză cantitatea 0 și o cotă lipsă sau în afara 0–99.
- `judete_coduri`: cele 42 de coduri oficiale (ISO 3166-2:RO).
- `cod_judet(text)`: recunoaște numele cu sau fără diacritice, cu sedilă (ş/ţ), cu cratimă sau
  spațiu, codul însuși, prefixele („Jud.”, „Județul”, „Municipiul”) și sectoarele
  Bucureștiului. Ce nu recunoaște → NULL; nu ghicește.
- `transport_facturabil(subtotal, reducere, livrare, total)`: regula din
  `livrareFacturabila()` (transportul intră pe factură doar la comenzile vechi), mutată în bază.
  Copia din browser se scoate la pasul 2.
- Vizitatorii anonimi (`anon`) nu pot chema niciuna dintre funcții.

**Testele, `scripts/verifica-saga-calcul.sql`** — 33 de verificări pe funcțiile REALE:
- cazul de pe factura reală: 200,00 → 165,29 + 34,71, preț unitar „165.2900” (verificat și ca
  text), plus stornarea lui (−165,29 / −34,71 / −200,00, unitar tot 165,2900);
- 10.000 de prețuri: valoare + TVA = total la ban, stornarea = exact opusul, zecimalele corecte;
- jumătatea de ban rotunjită departe de zero, în ambele sensuri; cota 0; intrările greșite;
- toate cele 42 de județe în cinci forme, 30 de forme reale, 8 intrări care trebuie să dea NULL;
- 6 cazuri de transport facturabil;
- drepturile: `anon` nu poate chema funcțiile.

Testul rulează între `begin` și `rollback` și se încheie mereu cu o eroare („REZULTAT OK …” /
„VERIFICARE PICATĂ …”), deci nu lasă nimic în bază — adaptat la 10 noiembrie 2026, când s-a
hotărât rularea pe producție (prima variantă își scria rezultatul într-un tabel temporar).

**`scripts/anuleaza-saga-calcul.sql`** — anularea migrării 47, fără `cascade`.

Verificat și invers, pe un Postgres 17 local: funcția stricată intenționat în trei feluri
(preț unitar din preț, TVA rotunjit separat, drept dat lui `anon`) — testele le-au prins pe
toate trei; după refacere au trecut iar.

**`scripts/baza-test.sh`** — aplică migrările în ordine (`migrari`, cu `--de-la=N` pentru
reluare) și rulează testele (`teste`) pe proiectul de TEST. Citește adresa producției din
`.env.local` și refuză orice `DB_TEST_URL` care o conține (verificat: refuză, cod 3).

**Corecturi aduse planului odată cu pasul 1:**
- trimiterile la pașii renumerotați (D.4 → pasul 6, riscul 5 → pasul 7, A.5 → pasul 5);
  întrebarea 12 scoasă, capitalul (200 RON) și banca (BCR Piatra Neamt) notate ca rezolvate;
- ultimul număr din SAGA pe „PAP FE” e **14190** (nu 14188), deci continuarea ar fi de la 14191;
- **exemplul de la 350 lei era greșit în plan**: preț unitar **289,2600**, nu 289,2562 — prețul
  unitar vine din baza rotunjită, cum confirmă factura reală (165,2900, nu 165,2893). Funcția
  era corectă; doar exemplul;
- **o migrare pe fiecare pas** (47 acum, 48+ la pașii următori), nu un singur `saga.sql`.

**`CLAUDE.md`**: migrarea 47 în ordine (scrisă, nerulată pe producție), cele două unelte noi
în tabelul de scripturi.

#### Fișiere

- create: `supabase/saga-calcul.sql`, `scripts/verifica-saga-calcul.sql`, `scripts/baza-test.sh`,
  `scripts/anuleaza-saga-calcul.sql`
- modificate: `docs/saga-plan.md`, `CLAUDE.md`
- intrate în același commit (erau nesalvate în git): `docs/saga-api.md`, `raportare.md`
- `npm run build`: „Compiled successfully”

#### Cum se aplică — pe PRODUCȚIE, din SQL Editor (decizia din 10 noiembrie 2026)

Rulează proprietarul, din Supabase → proiectul de producție → SQL Editor. Patru pași, fiecare
lipit și rulat separat.

**1. Pre-verificarea (doar citire).** Trebuie să întoarcă un singur rând cu toate coloanele
`true`:
```sql
select
  to_regclass('public.judete_coduri') is null                                   as tabela_noua_nu_exista,
  not exists (select 1 from pg_proc
               where pronamespace = 'public'::regnamespace
                 and proname in ('calculeaza_linie_tva','cod_judet','transport_facturabil')) as functiile_noi_nu_exista,
  to_regprocedure('public.text_cautare(text)') is not null                      as text_cautare_exista,
  exists (select 1 from pg_extension where extname = 'unaccent')                as unaccent_exista,
  public.text_cautare('Neamţ Iaşi') = 'neamt iasi'                              as unaccent_trateaza_sedila;
```
Dacă vreo coloană e `false`, NU se rulează migrarea; se trimite rezultatul.

**2. Migrarea.** Conținutul lui `supabase/saga-calcul.sql`, lipit întreg → Run. Rezultat
așteptat: „Success. No rows returned”. Rulată de două ori, dă același rezultat.

**3. Testele.** Conținutul lui `scripts/verifica-saga-calcul.sql`, lipit întreg → Run.
Rezultat așteptat — **în căsuța roșie de eroare, intenționat**:
> REZULTAT OK: toate cele 33 de verificări au trecut. (Apare ca eroare intenționat: așa baza
> anulează tot ce a făcut testul.)

Orice mesaj care începe cu „VERIFICARE PICATĂ” = defect; se trimite textul întreg. „function …
does not exist” = migrarea de la pasul 2 n-a rulat. Testul nu lasă nimic în bază: nu scrie, stă
între `begin` și `rollback`, și se termină mereu cu o eroare care anulează tranzacția
(verificat local: după rulare nu rămâne niciun obiect).

**4. Doar la nevoie — anularea.** Conținutul lui `scripts/anuleaza-saga-calcul.sql` → Run.
Scoate cele trei funcții și tabela `judete_coduri`, nimic altceva; fără `cascade`, deci se
oprește singur dacă un pas ulterior ajunsese să depindă de ele. Rezultat așteptat: 0 rânduri
în verificarea de la final. Verificat local: anulare → re-rulare migrare → testele trec iar.

**Nu depinde de migrarea 46** (`retur-fan.sql`, nerulată): migrarea 47 folosește doar
`text_cautare` și `unaccent` (migrarea 15) și rolurile Supabase (`anon`, `authenticated`,
`service_role`).

#### Confirmări cerute înainte de rularea pe producție (10 noiembrie 2026)

Proprietarul a hotărât să ruleze pasul 1 direct pe producție, din SQL Editor, fără bază de
test. Ultimul număr de factură confirmat pe seria PAP FE: **14190**. Înainte de rulare a cerut
patru confirmări; răspunsurile, verificate în cod și pe un Postgres 17 local:

**1. Migrarea 47 doar adaugă obiecte noi, nu modifică nimic existent, nu depinde de 46.**
- Creează exact patru obiecte: trei funcții (`calculeaza_linie_tva`, `cod_judet`,
  `transport_facturabil`) și tabela `judete_coduri` (cu indexul și politica ei de citire).
  Niciuna dintre migrările existente și niciun fișier din `app/`, `lib/`, `components/` nu
  folosește aceste nume — deci `create or replace` nu poate înlocui nimic existent.
- Nu atinge niciun rând existent, nicio politică existentă, nu șterge nimic. Singura politică
  creată (`drop policy if exists` + `create policy`) e pe tabela ei nouă.
- Depinde doar de `text_cautare` și extensia `unaccent` (migrarea 15) și de rolurile Supabase
  (`anon`, `authenticated`, `service_role`). NU de migrarea 46. Antetul migrării o spune acum
  explicit.
- Pre-verificarea (doar citire, pasul 1 din „Cum se aplică”) confirmă asta pe baza reală
  înainte de rulare: toate coloanele trebuie să fie `true`. Probată local pe o bază curată.

**2. Testul nu lasă nimic în bază — adaptat.** Prima variantă își scria rezultatul într-un tabel
temporar (`rezultat_saga_calcul`): dispărea la închiderea sesiunii, dar tot era o scriere. Acum:
- nu scrie nimic — doar citește `judete_coduri` și cheamă funcțiile de calcul;
- stă între `BEGIN` și `ROLLBACK`;
- se termină ÎNTOTDEAUNA cu o eroare, iar o eroare anulează tot ce a făcut tranzacția — chiar
  dacă cineva ar adăuga mai târziu o scriere în test;
- verificarea drepturilor lui `anon` s-a mutat în blocul de test, deci face parte din cele 33.

**Cum arată rezultatul în SQL Editor** — mereu în căsuța roșie de eroare:
- reușita: „**REZULTAT OK: toate cele 33 de verificări au trecut.** (Apare ca eroare intenționat:
  așa baza anulează tot ce a făcut testul.)”;
- orice mesaj care începe cu „VERIFICARE PICATĂ” = defect;
- „function … does not exist” = migrarea nu a rulat.

Verificat local: după rulare nu rămâne niciun obiect, iar un defect introdus intenționat (drept
dat lui `anon` pe `cod_judet`) e prins. `scripts/baza-test.sh teste` citește acum reușita din
mesaj, nu din codul de ieșire.

**3. SQL-ul de anulare** — salvat în `scripts/anuleaza-saga-calcul.sql`:
```sql
begin;
drop function if exists public.calculeaza_linie_tva(numeric, numeric, numeric);
drop function if exists public.cod_judet(text);
drop function if exists public.transport_facturabil(numeric, numeric, numeric, numeric);
drop table    if exists public.judete_coduri;
commit;
```
Urmat, în fișier, de o verificare care trebuie să întoarcă 0 rânduri. Fără `cascade`,
intenționat: dacă un pas ulterior ajunge să depindă de aceste obiecte, anularea se oprește cu
„cannot drop … because other objects depend on it”, în loc să șteargă tăcut și ce depinde de ele.
Verificat local: anulare → migrarea rulată din nou → testele trec iar; iar cu un view dependent
creat intenționat, anularea refuză.

**4. Planul și CLAUDE.md actualizate.**
- D.2 rescris: fără bază de test; testele pe producție doar în tranzacții anulate; probele de
  emitere de la pasul 4 încolo folosesc seria **„TEST”**, tot în tranzacții anulate, ca să nu
  consume numere reale (seria reală, PAP FE, ultimul număr 14190, nu e atinsă de niciun test);
  concurența (două emiteri simultane cer sesiuni separate) se testează local, în Postgres din
  Docker.
- CLAUDE.md, „Reguli de lucru”: regula testelor pe producție în tranzacții anulate, seria
  „TEST”, iar fiecare migrare nouă vine cu pre-verificare (doar citire) și fișier de anulare fără
  `cascade`. Asistentul nu rulează nimic pe producție; rulează proprietarul.
- Commit `c4b362e` pe `saga-integrare`, fără push. `npm run build`: „Compiled successfully”.

**Ordinea de rulare în SQL Editor** (fiecare separat):
1. pre-verificarea → toate coloanele `true`;
2. `supabase/saga-calcul.sql` → „Success. No rows returned”;
3. `scripts/verifica-saga-calcul.sql` → „REZULTAT OK: toate cele 33 de verificări au trecut.”
   (în căsuța roșie);
4. doar la nevoie: `scripts/anuleaza-saga-calcul.sql` → 0 rânduri în verificarea finală.

Proprietarul trimite rezultatele pașilor 1–3; pasul 2 din C începe doar după confirmarea lui.

#### Următorul

Pasul 2 — exportul CSV cu cota din setări, nu 19%. **Confirmat de proprietar la 10 noiembrie
2026; vezi intrarea pasului 2.**

### Pasul 2 — exportul CSV cu cota din setări, nu 19%

**Stare: ÎNCHIS. Migrarea 48 e RULATĂ pe producție la 10 noiembrie 2026**, de proprietar, din
SQL Editor:
- `supabase/saga-export.sql` → „Success. No rows returned.”
- `scripts/verifica-saga-export.sql` → „REZULTAT OK: toate cele 15 verificări au trecut (488
  comenzi, 496 linii de export verificate).”
- proba din `/admin/facturi`, pe serverul local (`npm start`, citind din producție): CSV descărcat
  corect, coloana „TVA”, ultima „Cota TVA” = 21, sumele corecte (200 → 165,29 + 34,71;
  350 → 289,26 + 60,74).
- **Pre-verificarea NU a fost rulată înainte** (a doua oară). Fără efect asupra rezultatului:
  testele trec doar dacă funcțiile noi se comportă exact ca în fișier, iar cele din 47 pe care se
  sprijină există. Codul: commit pe `saga-integrare`, fără push.

#### Adaugă sau modifică ceva existent pe producție? (răspuns dat înainte de cod)

- **În bază: doar ADAUGĂ.** Migrarea 48 creează două funcții noi (`saga_cota_tva`,
  `export_saga_linii`). Nu modifică nicio tabelă, niciun rând, nicio politică, nicio funcție
  existentă. Depinde de 47 (rulată), nu de 46.
- **În cod: MODIFICĂ două pagini existente din admin** — Facturi (butonul „Export Saga (CSV)”)
  și cardul „Saga — facturare” din Integrări. Pe site ajung doar după unirea ramurii în `main`
  și push, adică doar cu aprobarea proprietarului.
- **Setări**: nu se scrie nimic automat. Câmpurile noi (cotă, regim) sunt opționale; goale =
  21%, regim normal.
- **Formatul CSV-ului**: coloanele rămân în ACEEAȘI ordine (contabila poate avea un import
  configurat în SAGA). Doar antetul „TVA 19%” devine „TVA”, iar „Cota TVA” se adaugă ultima.

#### Ce s-a făcut

**Migrarea 48, `supabase/saga-export.sql`** — idempotentă:
- `saga_cota_tva()`: citește `settings.integrari.saga.cota_tva` și `regim_tva`. Gol = 21,
  regim normal — **singurul loc din proiect cu implicitul de 21%**. Acceptă „21”, „ 21 ”,
  „21,5”, „9%”. O valoare greșită („abc”, „2l”, „150”) NU cade tăcut pe 21: oprește exportul cu
  mesajul „Cota TVA … nu e un număr”. Regimul „marjă” e refuzat (faza 1). `security invoker`:
  setările se citesc cu drepturile celui care cheamă.
- `export_saga_linii(id-urile comenzilor)`: o linie pe piesă, cu TVA-ul din
  `calculeaza_linie_tva` la cota din setări și transportul din `transport_facturabil` — aceleași
  funcții pe care le va folosi factura (pasul 4), deci CSV-ul și factura nu pot da cifre diferite.
  Primește exact lista de comenzi văzută în pagină (interval + filtru + fără anulate), prin POST.
  `security invoker`: RLS-ul pe comenzi se aplică normal.
- Ambele: `anon` nu le poate chema.

**`app/admin/facturi/page.tsx`**: exportul nu mai calculează nimic în browser (înainte:
`brut / 1.19`, fără rotunjire). Ia liniile din `export_saga_linii`, în loturi de 200 de
comenzi, fiecare paginat (o funcție care întoarce rânduri e tăiată și ea la 1.000). Dacă baza
refuză (cotă greșită, regim marjă, migrarea 48 nerulată), exportul se OPREȘTE cu „Exportul NU
s-a făcut: …” — nu pleacă un CSV calculat greșit. Copia din browser a regulii de transport
(`livrareFacturabila`) a fost scoasă, cum prevedea pasul 1.

**`app/admin/integrari/page.tsx`**: cardul „Saga — facturare” are două câmpuri noi — „Cota TVA,
în procente (gol = 21)” și „Regimul TVA” —, verificate ÎNAINTE de salvare cu aceleași reguli
ca în bază. Descrierea nu mai spune „TVA 19%”. (Restul textelor despre „Saga nu are API public”
se rescriu la pasul 11, cum prevede planul; în antetul paginii Facturi s-a scos deja.)

**Testele, `scripts/verifica-saga-export.sql`** — 15 verificări, în tranzacție anulată, rezultat
în căsuța roșie, ca la pasul 1:
- cota: gol și nesalvat → 21; „19”, „21”, „ 21 ”, „21,5”, „21.5”, „9%”, „0” citite corect;
  „abc”, „2l”, „100”, „150”, „-5”, „21.5.1” refuzate; regimurile „marja”, „Marjă”, „special”
  refuzate, „Normal” acceptat;
- exportul pe **comenzile EXISTENTE, doar citite**: exact o linie pe piesă; fiecare linie
  identică cu `calculeaza_linie_tva` la cota 21; valoare + TVA = total; transportul = regula;
- cota 19 pusă în setări ajunge în export; listă goală / NULL → zero linii; cotă greșită →
  exportul se oprește;
- `anon` nu poate chema funcțiile.
- Singura scriere e schimbarea TEMPORARĂ a setării, anulată. **Nu creează comenzi**: o comandă
  de test ar consuma un număr real din `nr_comanda_seq` (secvențele nu se anulează la rollback).

**`scripts/anuleaza-saga-export.sql`** — scoate cele două funcții, fără `cascade`.

**Verificat local** (Postgres 17 în Docker, cu tabele minimale și comenzi FICTIVE, doar în
container, șters după):
- migrarea 48 rulată de două ori fără eroare; testele 47 (33) și 48 (15) trec; setarea
  `integrari` identică după test;
- exportul dă cifrele facturii reale: 200,00 → 165,29 + 34,71, unitar 165,2900;
- trei defecte introduse intenționat, toate prinse: cotă greșită căzută tăcut pe 21 („cota „abc”
  trebuia refuzată”), cotă 19 fixă în export (diferența apare linie cu linie), drept dat lui `anon`;
- anularea scoate cele două funcții și lasă migrarea 47 neatinsă; re-rularea merge;
- **apelul din pagină, prin PostgREST real** (v12) și biblioteca proiectului (`postgrest-js`),
  cu plafonul de rânduri forțat la 2: paginarea a adus toate cele 5 linii, în ordine. (O primă
  probă cu antetul `Range` a dat de două ori aceeași pagină — greșeala era a probei: la POST,
  `supabase-js` paginează prin `offset`/`limit` în adresă, nu prin antet. Refăcută cu biblioteca.)
- `npm run build`: „Compiled successfully”.

**Lipsă știută, NErezolvată la pasul ăsta** (exista și înainte): reducerea (`discount_valoare`)
nu apare în CSV — liniile au prețurile întregi. Se rezolvă odată cu întrebarea 6 pentru contabilă
(linie negativă sau repartizare), la factură (pasul 4).

#### Fișiere

- create: `supabase/saga-export.sql`, `scripts/verifica-saga-export.sql`,
  `scripts/anuleaza-saga-export.sql`
- modificate: `app/admin/facturi/page.tsx`, `app/admin/integrari/page.tsx`, `scripts/baza-test.sh`
  (lista migrărilor), `CLAUDE.md`, `docs/saga-plan.md`

#### Cum se aplică — pe PRODUCȚIE, din SQL Editor

**ORDINEA CONTEAZĂ: migrarea 48 se rulează ÎNAINTE ca ramura să ajungă pe `main`.** Codul nou
al paginii Facturi cheamă `export_saga_linii`; fără ea, exportul ar spune „Exportul NU s-a
făcut”. Invers nu strică nimic: funcțiile noi, nefolosite de codul vechi, stau liniștite.

**1. Pre-verificarea (doar citire)** — toate coloanele `true`:
```sql
select
  not exists (select 1 from pg_proc
               where pronamespace = 'public'::regnamespace
                 and proname in ('saga_cota_tva','export_saga_linii'))                 as functiile_noi_nu_exista,
  to_regprocedure('public.calculeaza_linie_tva(numeric,numeric,numeric)') is not null as migrarea_47_calcul,
  to_regprocedure('public.transport_facturabil(numeric,numeric,numeric,numeric)') is not null as migrarea_47_transport,
  exists (select 1 from public.settings where cheie = 'integrari')                    as setarile_integrari_exista;
```

**2. Migrarea**: `supabase/saga-export.sql` → „Success. No rows returned”.

**3. Testele**: `scripts/verifica-saga-export.sql` → în căsuța roșie, intenționat:
> REZULTAT OK: toate cele 15 verificări au trecut (N comenzi, M linii de export verificate).

N și M sunt numărul comenzilor și al pieselor din comenzile reale. „VERIFICARE PICATĂ” = defect,
se trimite textul întreg.

**4. Doar la nevoie — anularea**: `scripts/anuleaza-saga-export.sql` → 0 rânduri la final.

**5. Proba exportului în pagină, ÎNAINTE de `main`** (doar citire din producție): în terminalul
Codespace, `npm run build && npm start`, apoi `http://localhost:3000/admin/facturi`, intervalul
care conține comenzile reale → „Export Saga (CSV)”. **Rezultat așteptat**: fișierul se descarcă;
coloana „TVA” (nu „TVA 19%”), „Cota TVA” ultima, cu 21; pe o piesă de 200,00 lei: „Pret cu TVA”
200.00, „Baza fara TVA” 165.29, „TVA” 34.71. Opțional: Integrări → Saga → cota „abc” → Salvează
→ apare mesajul de cotă invalidă și nu se salvează nimic.

#### Completări după predarea pasului 2 (10 noiembrie 2026)

**Indiciile despre formatul numărului și al datei** (commit `6114bce`) — trecute la întrebarea
1 pentru contabilă și la riscul 6, marcate „nu confirmări”:
- concluzia provizorie: numărul „PAP FE 14188” (`serie_spatiu`) și data zi-lună-an;
- riscul 6 cuprinde acum și data: zi și lună inversate trec neobservate până pe 13 ale lunii;
- **formatul datei a devenit setare, `format_data`** („10-11-2026” / „10.11.2026” /
  „2026-11-10”), cu aceeași regulă ca `format_numar`: fără valoare implicită, aplicat de o
  singură funcție (`dataPentruSaga`), iar trimiterea e blocată până e ales. Trecut și în lista
  de fișiere (B), la pasul 8 din C și în testele din D.1 (inclusiv o zi sub 13);
- două precizări: (a) numele PDF-ului începe cu „131096”, care NU e CIF-ul firmei, deci numele
  fișierului de import XML urmează exemplul din documentația API, nu PDF-ul; (b) indiciul 4
  (articolele recunoscute după codul de bare / codul propriu) e legat și de întrebarea 3.

**„Continuă cu PASUL 2”** — cerut de proprietar după indicii. Pasul 2 era deja gata în cod
(commit `952f578`); nu s-a refăcut nimic. Rămâne doar partea proprietarului, pe producție, din
SQL Editor, în ordine:
1. pre-verificarea (secțiunea „Cum se aplică” de mai sus) → toate coloanele `true`;
2. `supabase/saga-export.sql` → „Success. No rows returned”;
3. `scripts/verifica-saga-export.sql` → „REZULTAT OK: toate cele 15 verificări au trecut …”;
4. proba exportului în pagină (`npm run build && npm start`, `/admin/facturi`).

Pasul 3 NU a fost început: regula e un singur pas o dată, după confirmarea proprietarului. Dacă
cererea a fost de fapt „pasul 3”, începe la confirmare.

#### Următorul

Pasul 3 — datele firmei (capital, bancă, localitate, județ, țară în Admin → Setări; câmpul
„Serie facturi” scos de acolo). Fără SQL. **Confirmat de proprietar la 10 noiembrie 2026; vezi
intrarea pasului 3.**

### Pasul 3 — datele firmei

**Stare: ÎNCHIS — verificat local și salvat pe producție de proprietar, 10 noiembrie 2026.**
- formularul are cele 5 câmpuri noi, „Serie facturi” a dispărut;
- salvate în `settings.firma`: capital „200 RON”, banca „BCR Piatra Neamt”, localitatea
  „Alexandru Cel Bun”, județul „Neamț”, țara „RO”;
- verificat în SQL: valorile sunt în `settings.firma`, iar `serie_factura` = „AUTP” (păstrată);
- **problema de la verificare**: `/admin/setari` arăta întâi formularul VECHI. Cauza: un server
  vechi încă rula pe portul 3000 în timpul build-ului, iar reîmprospătarea lui automată
  (`revalidate = 300` din `app/layout.tsx`) a rescris `.next/server/app/admin/setari.html` cu
  versiunea veche, la 14:34:59, după terminarea build-ului (14:34:31). Pagina cerea un fișier
  JavaScript care nu mai exista. Rezolvat: serverul oprit, build refăcut fără niciun server
  pornit, apoi `npm start`. **Regulă de acum: serverul se oprește ÎNAINTE de orice build.**
- **Până la unirea ramurii în `main`, „Date firmă” NU se salvează din site-ul live** — codul
  vechi de pe producție construiește obiectul firmei doar din câmpurile lui și ar șterge cele 5
  câmpuri noi (trecut și în CLAUDE.md).

Codul: commit `6376bb3` pe `saga-integrare`, fără push.

Înaintea pasului, în același schimb de mesaje: migrarea 48 a fost notată ca RULATĂ pe producție
în jurnalul pasului 2 și în CLAUDE.md (commit `b87c30f`).

**Rezumatul trimis proprietarului** (detaliile în secțiunile de mai jos):
- regula `data_start_facturare` e în plan, în toate locurile cerute (A.4, A.9, pasul 6, faza 2),
  plus testele din D.2, inclusiv cazul de la miezul nopții (data se compară în ora României);
- confirmat: nimic scris până acum nu creează facturi pentru comenzile vechi;
- pasul 3 nu schimbă nimic vizibil pe site și nu are SQL; modifică doar Admin → Setări → „Date
  firmă” (5 câmpuri noi, verificate la salvare; „Serie facturi” scos) și repară capcana care ar
  fi șters „AUTP” la prima salvare;
- neverificat de asistent în browser (cere autentificare de admin, iar salvarea scrie pe
  producție) — verificarea o face proprietarul, cu pașii 1–6 de la „Cum se verifică”;
- pasul 4 începe doar după confirmare.

#### Înainte de pas: confirmările cerute de proprietar

**Regula nouă, obligatorie — `data_start_facturare`** (comenzile din urmă, 488 la 10 noiembrie
2026, au fost facturate manual în SAGA și NU se facturează din aplicație). Trecută în plan:
- A.4 (pasul 1b din `emite_factura`): fără dată setată → refuz pentru tot; comandă plasată
  înaintea datei (ziua României) → refuz cu mesaj clar; verificarea stă în bază;
- A.9: setarea `settings.integrari.saga.data_start_facturare`, fără valoare implicită; butonul
  „Emite factura” nu apare pe comenzile dinaintea datei; oglinda nu atinge comenzile vechi;
- pasul 6 din C: butonul condiționat de dată; câmpul datei în cardul Saga din Integrări;
- faza 2: triggerul ignoră comenzile dinaintea datei, chiar dacă își schimbă starea, și tot dacă
  data lipsește — condiția stă în trigger, înaintea oricărui apel;
- D.2: testele datei (fără dată, cu o zi înainte, ziua de start la 00:30 ora României).

**Confirmat: nimic scris până acum nu creează facturi pentru comenzile vechi** (verificat în
cod, 10 noiembrie 2026):
- nu există nicio tabelă de facturi și niciun apel la API-ul SAGA (nicio referință la
  `facturi`, `facturi_linii`, `web.sagasoft`, `/api/saga` în `app/`, `lib/`, `components/`,
  `supabase/`);
- migrările 47 și 48 doar calculează (`calculeaza_linie_tva`, `cod_judet`,
  `transport_facturabil`, `saga_cota_tva`, `export_saga_linii`) — niciuna nu scrie;
- exportul CSV citește și descarcă un fișier pentru contabilă; nu emite nimic și nu trimite nimic;
- singurele scrieri pe `orders.factura_serie` / `factura_status` sunt cele două câmpuri manuale
  de serie (Facturi și pagina comenzii), existente dinainte și neatinse de pașii 1–3.

#### Modifică ceva existent pe site? (răspuns dat înainte de cod)

- **Pe site: nimic vizibil.** Paginile publice (subsol, contact, documente legale, pagina
  piesei, formularul de retur) folosesc doar denumirea, CUI-ul, Reg. Com., adresa, telefonul,
  e-mailul. Câmpurile noi nu se afișează nicăieri public.
- **În bază: nicio migrare.** La următoarea salvare din Setări, rândul `settings.firma` primește
  cheile noi.
- **Modificată: pagina Admin → Setări → „Date firmă”** — 5 câmpuri noi; „Serie facturi” scos
  din formular, cu valoarea din bază („AUTP”) păstrată.
- **O capcană reparată**: salvarea rescria tot obiectul firmei doar din câmpurile formularului,
  deci scoaterea câmpului de serie ar fi șters „AUTP” la prima salvare. Acum se pornește din
  datele existente (`{ ...firma, … }`).

#### Ce s-a făcut

**`lib/settings.ts`** — tipul `Firma` are `capital`, `banca`, `localitate`, `judet`, `tara`;
`serie_factura` devine opțional și marcat „ieșit din uz”. În rezerva din cod (`FIRMA_IMPLICITA`):
cele patru câmpuri noi sunt GOALE (valorile le scrie proprietarul, nu stau în cod), `tara` =
„RO”, iar „AUTP” a fost scos.

**`app/admin/setari/page.tsx`** — „Date firmă și fiscale”:
- câmpuri noi: „Capital social”, „Banca”, „Localitatea sediului”, „Județul sediului”, „Țara (cod,
  ex. RO)”. Placeholder-ele sunt neutre („suma și moneda”, „numele băncii și sucursala”) — nu
  valorile reale, ca un câmp gol să nu pară completat;
- „Serie facturi” scos; textul de sub titlu spune că seria nu se mai setează aici și că noile
  câmpuri apar doar pe facturi;
- verificări la salvare, înainte de orice scriere: **județul** se trece prin `cod_judet` din bază
  (migrarea 47 — aceeași funcție care îl va traduce în cod pe factură); nerecunoscut → „Județul
  „…” nu e recunoscut … Nu s-a salvat nimic.”; **țara** trebuie să fie două litere;
- salvarea pornește din datele existente, deci nu pierde nicio cheie din bază.

`npm run build`: „Compiled successfully”. Serverul local pornit pentru proba pasului 2 a fost
oprit (build-ul nou i-a înlocuit fișierele).

Neverificat de asistent în browser: pagina cere autentificare de admin, iar salvarea scrie în
producție — o face proprietarul, cu pașii de mai jos.

#### Fișiere

- modificate: `lib/settings.ts`, `app/admin/setari/page.tsx`, `docs/saga-plan.md`
- create: niciunul

#### Cum se verifică

**Atenție: serverul local citește și SCRIE în baza de producție** (`.env.local`). Salvarea din
Setări e reală — exact ce trebuie, fiindcă valorile trebuie oricum puse.

1. `npm run build && npm start`, apoi `http://localhost:3000/admin/setari` (portul 3000 din
   tab-ul Ports), autentificat ca admin.
2. „Date firmă și fiscale”: **nu mai există „Serie facturi”**; există Capital social, Banca,
   Localitatea sediului, Județul sediului, Țara (cu „RO” deja pus).
3. Proba refuzului: la Județ scrii „Atlantis” → Salvează → mesajul „Județul „Atlantis” nu e
   recunoscut … Nu s-a salvat nimic.” La Țară „ROU” → mesaj despre codul de două litere.
4. Completezi valorile reale — capital „200 RON”, banca „BCR Piatra Neamt”, localitatea, județul
   „Neamț”, țara „RO” — → Salvează → „✓ Salvat — se vede imediat pe site.”
5. Verificare în SQL Editor (doar citire):
   ```sql
   select valoare->>'capital' as capital, valoare->>'banca' as banca,
          valoare->>'localitate' as localitate, valoare->>'judet' as judet,
          valoare->>'tara' as tara, valoare->>'serie_factura' as serie_veche_pastrata
     from settings where cheie = 'firma';
   ```
   **Rezultat așteptat**: valorile tale; `serie_veche_pastrata` = „AUTP” (nu NULL).
6. Site-ul public: subsolul și `/contact` arată exact ca înainte.

#### Următorul

Pasul 4 — tabelele de facturi și numerotarea (migrarea 49): `facturi`, `facturi_linii`,
`facturi_serii`, `emite_factura` (cu `data_start_facturare`), `seteaza_serie_factura`,
`retrage_factura`, triggerul de nemodificare, oglinda pe `orders`, garda din `sterge_comanda`,
RLS, pagina Facturi → Setări serie. Începe doar după confirmare.

### Pasul 4 — facturile și numerotarea (migrarea 49)

**Stare: ÎNCHIS. Migrarea 49 e RULATĂ pe producție la 10 noiembrie 2026**, de proprietar, din
SQL Editor (cod: commit `002d5b3` pe `saga-integrare`, fără push):
- **copia de siguranță manuală NU a fost făcută** — decizia proprietarului, motivată prin
  „backup zilnic Supabase și scriptul de anulare”. **De verificat**: după documentația Supabase
  (citită la 10 noiembrie 2026), copiile zilnice există DOAR pe planurile Pro, Team și
  Enterprise; pe planul Free nu există, iar Supabase recomandă export manual. Dacă proiectul e
  pe Free, singura plasă e scriptul de anulare. Se vede în Supabase → Database → Backups;
- pre-verificarea: toate cele 9 coloane `true` (inclusiv `sterge_comanda_ca_in_git`);
- `supabase/saga-facturi.sql` → „Success. No rows returned.”;
- `scripts/verifica-saga-facturi.sql` → „REZULTAT OK: toate cele 41 verificări au trecut (probă
  pe comenzile AP-2026-01795 și AP-2026-01796, seria de probă „TEST 04730F37”).”;
- verificarea finală: facturi 0, serii 0, oglinzi de probă 0;
- pagina `/admin/facturi/setari`: **ce s-a văzut NU a fost raportat** (în mesajul proprietarului
  a rămas textul-șablon „[scrie ce ai văzut]”). Nicio serie salvată.
- Serverul local a fost oprit la cererea proprietarului.

Commit-urile acestui schimb de mesaje: `ac1d140` (pasul 3 verificat și salvat; regulile din
CLAUDE.md), `a51cd1e` (seria PAP FE, procedura de pornire, riscul 7), `002d5b3` (pasul 4).

**Rezumatul trimis proprietarului** (detaliile în secțiunile de mai jos):
- **a.** Migrarea 49 nu modifică nimic din ce există: nicio funcție rescrisă (`sterge_comanda`
  rămâne cum e — în locul gărzii din plan, cheia străină `comanda_facturata_nu_se_poate_sterge`
  oprește ștergerea unei comenzi facturate pe orice cale, verificat local, stocul neatins);
  nicio coloană, niciun trigger, nicio politică nouă pe tabelele existente; niciun rând modificat
  de migrare. Funcțiile noi scriu doar oglinda pe `orders` și jurnalul comenzii, când sunt chemate.
- **b.** Pre-verificarea compară amprenta lui `sterge_comanda` din producție cu cea din git
  (`cd1d7d0cf96d2c79014e7d7749ac1b0d`); dacă diferă, textul funcției se trimite asistentului
  pentru comparare rând cu rând. Aceeași metodă la orice pas care rescrie o funcție.
- **c.** Copia de siguranță cu `pg_dump`, din Codespace, prin Docker, în `/.backup/` (ignorat
  de git — verificat), verificată cu `pg_restore --list`.
- **Pasul 4**: migrarea 49 (facturi, serii, emitere fără goluri, retragere, pază după trimitere,
  acces doar admin + contabil), pagina Facturi → Setări serie cu bifa de confirmare, 41 de teste
  pe producție în tranzacție anulată, testele locale (concurență, ora-limită, ștergere, garda
  anulării), trei defecte introduse intenționat — toate prinse. `npm run build` trece.
- **Ordinea pe producție**: copia de siguranță → pre-verificarea → migrarea → testele →
  verificarea că n-a rămas nimic → pagina (fără salvare: seria se pune în ziua pornirii).
- Pasul 5 începe doar după confirmare.

#### Înainte de pas: punctele 1 și 2 cerute de proprietar

- **Pasul 3 notat ca verificat și salvat pe producție** (vezi intrarea lui) + regula în
  CLAUDE.md: până la unirea ramurii în `main`, „Date firmă” NU se salvează din site-ul live
  (codul vechi ar șterge câmpurile noi). Tot în CLAUDE.md: serverul local se oprește ÎNAINTE
  de orice build (cauza formularului vechi de la pasul 3).
- **Decizia despre serie** (commit `a51cd1e`): fără serie separată; din ziua pornirii toate
  facturile se emit DOAR din aplicație, pe seria existentă **„PAP FE”**; la 10.11.2026,
  după-amiaza, ultimul număr manual era 14192, iar facturarea manuală continuă până în ziua
  pornirii. Actualizate: A.4 (decizia, fără serie sau număr fix în cod, confirmarea explicită
  din admin), A.15 (stornările pe PAP FE doar din aplicație după pornire), riscul 4, **riscul 7
  nou** (contorul intern al SAGA), întrebările 2, 9 și **12 nouă** pentru contabilă, o întrebare
  nouă pentru suportul SAGA, pasul 12 din C, **„Procedura de pornire”** (secțiune nouă, după C),
  exemplele (acum „continuare de la 14193”, marcate *exemplu*).

#### Răspunsurile cerute înainte de cod (a–c)

**a. Ce funcții, tabele și triggere EXISTENTE modifică migrarea 49 — niciuna.**
- Funcții existente rescrise: **niciuna**. `sterge_comanda`, `anuleaza_comanda`,
  `plaseaza_comanda`, `is_staff`, `is_admin` rămân neatinse. Planul (A.14) prevedea o gardă în
  `sterge_comanda`; s-a renunțat la ea în favoarea cheii străine (A.14, actualizat).
- Tabele existente: **nicio coloană nouă, niciun trigger nou, nicio politică nouă**, niciun rând
  modificat de migrare.
- **Singura legătură nouă cu ce există**: cheia străină `facturi.order_id → orders(id) ON DELETE
  RESTRICT` (`comanda_facturata_nu_se_poate_sterge`). Ea stă pe tabela NOUĂ, dar schimbă
  comportamentul ștergerii pe `orders`: o comandă care ARE factură nu se mai poate șterge. Azi
  nicio comandă n-are factură, deci nimic nu se schimbă până la prima emitere. La crearea ei,
  Postgres ia o blocare scurtă pe `orders` (milisecunde, tabela e mică).
- Ce SCRIU funcțiile noi în tabelele existente, doar când sunt chemate (niciodată de migrare):
  `orders.factura_serie` / `factura_status` (oglinda din A.9) și un rând în `order_events`
  (jurnalul comenzii) la emitere și la retragere. Citesc `settings`, `orders`, `order_items`,
  `products.cod_intern`, `profiles.role`.
- Obiecte noi: tabelele `facturi`, `facturi_linii`, `facturi_serii`, `facturi_serii_istoric`;
  funcțiile `is_facturare`, `seteaza_serie_factura`, `emite_factura`, `retrage_factura`,
  `facturi_pazeste`, `facturi_linii_pazeste`; triggerele `facturi_pazeste` și
  `facturi_linii_pazeste`, doar pe tabelele noi.

**b. Cum se compară funcțiile existente cu producția.** Pentru pasul 4 nu e nevoie (nu se
rescrie nimic), dar metoda e aceasta și se folosește la orice pas care rescrie o funcție:
1. Amprenta corpului funcției, în SQL Editor (doar citire):
   ```sql
   select p.oid::regprocedure as functia, md5(p.prosrc) as amprenta, length(p.prosrc) as lungime
     from pg_proc p where p.oid = 'public.sterge_comanda(bigint)'::regprocedure;
   ```
   **Rezultat așteptat** pentru `sterge_comanda`, așa cum e în `supabase/admin-fix.sql`:
   amprenta `cd1d7d0cf96d2c79014e7d7749ac1b0d`, lungime 792. Amprenta e calculată de asistent
   din fișier și verificată identic într-un Postgres 17 în care funcția a fost creată din fișier.
   Aceeași amprentă = producția are exact textul din git.
2. Dacă diferă: `select pg_get_functiondef('public.sterge_comanda(bigint)'::regprocedure);` →
   se copiază textul întreg și se trimite asistentului, care îl compară rând cu rând cu fișierul
   din git ÎNAINTE ca migrarea care o rescrie să fie rulată — altfel un `create or replace` ar
   da înapoi tăcut o modificare făcută direct în bază (regula din CLAUDE.md, migrarea 27).

**c. Copia de siguranță, chiar înainte de rulare** — completă (schema + date), cu `pg_dump`,
din terminalul Codespace. Planul Free al Supabase NU are copii descărcabile (cele zilnice sunt
pe planul Pro), deci copia se face de mână.
1. Adresa bazei: Supabase → proiectul de producție → **Connect** → **Session pooler** → copiezi
   adresa (`postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-…pooler.supabase.com:5432/postgres`)
   și pui parola bazei în locul `[YOUR-PASSWORD]`. NU „Direct connection” (doar IPv6). Parola
   uitată se resetează din Settings → Database; cheile API ale site-ului NU se schimbă la asta.
2. În terminalul Codespace (parola rămâne doar în sesiunea terminalului, nu în fișiere):
   ```bash
   cd /workspaces/autopas && mkdir -p .backup
   export DB_PROD_URL='postgresql://postgres.<ref>:PAROLA@aws-…pooler.supabase.com:5432/postgres'
   docker run --rm --network host -v "$PWD/.backup:/b" postgres:17 \
     pg_dump "$DB_PROD_URL" --format=custom --no-owner --no-privileges \
     --schema=public --file=/b/autopas-inainte-de-49-$(date +%Y%m%d-%H%M).dump
   ```
   Se salvează în **`/workspaces/autopas/.backup/`**, folder ignorat de git (`/.backup/` în
   `.gitignore`, verificat cu `git check-ignore`) — **nu se comite niciodată**: conține datele
   clienților. `--schema=public` = toate tabelele aplicației (comenzi, piese, setări…); conturile
   (`auth`) rămân la Supabase și nu sunt atinse de migrare.
3. Verificarea copiei:
   ```bash
   ls -lh .backup/
   docker run --rm -v "$PWD/.backup:/b" postgres:17 sh -c 'pg_restore --list /b/*.dump | grep -c "TABLE DATA"'
   docker run --rm -v "$PWD/.backup:/b" postgres:17 sh -c 'pg_restore --list /b/*.dump | grep "TABLE DATA" | grep -E " (orders|order_items|products|settings) "'
   ```
   **Rezultat așteptat**: fișierul are câțiva MB (nu 0); numărul de „TABLE DATA” e de ordinul
   zecilor; ultima comandă listează cele patru tabele `orders`, `order_items`, `products`,
   `settings`. Dacă pg_dump se plânge de versiune („server version mismatch”), se schimbă
   `postgres:17` cu versiunea bazei (Supabase → Settings → Infrastructure).
4. Opțional, o copie și pe calculatorul tău: în exploratorul VS Code, folderul `.backup` →
   clic dreapta pe fișier → Download.
5. Restaurarea e o operație mare, de ultim resort; pentru migrarea 49 anularea normală e
   `scripts/anuleaza-saga-facturi.sql`. Copia e plasa de sub plasă.

#### Ce s-a făcut

**Migrarea 49, `supabase/saga-facturi.sql`** (idempotentă):
- `is_facturare()` — admin sau contabil (nu operatorul).
- `facturi_serii` (cel mult una activă) + `facturi_serii_istoric` (cine, când, ce număr).
- `facturi` — copia clientului (cu codul județului), a furnizorului (din `settings.firma`,
  cu codul județului), regimul și cota, mențiunea de plată, observațiile („Comanda AP-…”),
  totalurile, starea SAGA; `unique (serie, numar)`; cel mult un storno pe factură.
- `facturi_linii` — piesele (cu `cod_intern` și numele de pe site), apoi reducerea ca linie
  NEGATIVĂ (întrebarea 6 rămâne deschisă), apoi transportul facturabil; TVA cu
  `calculeaza_linie_tva` la cota din setări; `order_item_id` / `product_id` fără cheie străină
  (o piesă ștearsă din catalog nu atinge o factură).
- Paza (triggere pe tabelele NOI): după trimitere (`in_curs`, `trimisa`, `confirmata`) se
  schimbă doar coloanele de stare, iar starea merge doar înainte (trimisa → confirmata);
  seria, numărul, comanda, tipul nu se schimbă niciodată; ștergerea doar înainte de trimitere;
  liniile urmează starea facturii.
- `seteaza_serie_factura(serie, număr următor)` — face seria activă, refuză un număr ≤ cel mai
  mare emis pe ea, scrie în istoric.
- `emite_factura(comanda)` — în ordine: rolul; comanda blocată (`for update`), neanulată, fără
  factură nestornată, cu piese; **`data_start_facturare`** (lipsă → refuz pentru tot; comandă
  dinaintea ei, în ora României → refuz cu mesaj); seria activă blocată (`for update`) — lipsă →
  refuz; cota (refuză marja); articolul implicit (cod + denumire obligatorii); datele firmei
  (denumire, CUI, Reg. Com., adresă, IBAN obligatorii); județul clientului (nerecunoscut →
  refuz); documentul, liniile, totalurile; contorul +1; oglinda pe comandă; jurnalul comenzii.
  Totul într-o tranzacție: orice refuz nu lasă nimic, nici gol în numerotare.
- `retrage_factura(factura)` — doar netrimisă și doar ULTIMA din serie; contorul dă înapoi,
  numărul se refolosește; oglinda curățată; istoric + jurnalul comenzii.
- RLS: citire doar `is_facturare()`; scriere doar prin funcții; `anon` fără niciun drept,
  `authenticated` fără insert/update/delete.

**Pagina `app/admin/facturi/setari/page.tsx`** (Facturi → „Setări serie”, admin + contabil):
seria activă și numărul următor (sau „Nicio serie activă … starea corectă până în ziua
pornirii”), formularul cu **bifa de confirmare obligatorie**, cu textul calculat din ce s-a scris
(„Confirm că ultima factură emisă manual în SAGA pe {serie} are numărul {număr − 1} și că
facturarea manuală pe {serie} s-a oprit.”) — butonul e inactiv fără bifă, iar bifa se scoate la
orice schimbare a valorilor; istoricul ultimelor 20 de setări. Link „Setări serie” în antetul
paginii Facturi.

**`lib/types.ts`**: `SagaStatus`, `Factura`, `FacturaLinie`, `FacturaSerie`, `FacturaSerieIstoric`.

**Testele pe producție, `scripts/verifica-saga-facturi.sql`** — 41 de verificări, în tranzacție
anulată, „logat” ca un profil admin/contabil ales din `profiles`, pe o serie de probă „TEST …”
cu nume UNIC la fiecare rulare (niciodată seria reală), pe cele mai recente două comenzi
potrivite: refuzurile fără utilizator, fără dată de start, cu dată invalidă, cu comanda
dinaintea datei, fără serie, cu număr 0 / serie goală, fără articol; emiterea (număr, contor,
linii = piese + reducere + transport, fiecare linie = calculul din 47, numerele de rând,
total = subtotal − reducere + transport, copiile, data în ora României, oglinda, jurnalul);
a doua factură pe aceeași comandă refuzată fără să miște contorul; numărul de start refuzat
sub cel emis; retragerea (doar ultima, numărul refolosit); nemodificabilitatea după trimitere
(9 încercări refuzate, 2 tranziții permise); comanda facturată nu se șterge; un utilizator fără
rol nu vede și nu emite; drepturile lui `anon` și `authenticated`. Singura urmă: id-uri interne
consumate din `facturi` / `facturi_serii_istoric` (secvențele nu se anulează) — nu numere de
factură.

**Testele locale, `scripts/verifica-saga-local.sh`** (+ `scripts/saga-local/`: imitația
Supabase și date FICTIVE, doar pentru container) — ce nu se poate testa pe producție. Rezultat
la 10 noiembrie 2026, ~7 s:
- migrările 47–49 rulate fiecare de două ori; testele SQL: 33 / 15 / 41, toate trec;
- **20 de `emite_factura` simultane → numerele 14193–14212, consecutive, fără goluri, contorul
  14213**;
- aceeași comandă emisă de două ori simultan → o singură factură;
- ora-limită: comanda de la 00:30 ora României (22:30 UTC în ziua dinainte) acceptată, cea de
  la 23:30 ora României din ziua dinainte refuzată;
- `sterge_comanda` pe o comandă facturată → oprită, stocul neatins; pe una nefacturată merge ca
  înainte;
- anularea migrării 49 refuză cât timp există facturi; fără facturi scoate tot și lasă 47–48
  neatinse; migrarea se poate rula din nou.

Verificate tot local, în plus: linia de reducere (−40,00 → −33,06 + −6,94) și cea de transport
(28,92 → 23,90 + 5,02), totalul facturii = totalul comenzii la ban, clientul firmă cu codul
județului (CJ) și furnizorul (NT); județ nerecunoscut („Atlantis”) refuzat fără să miște
contorul; datele firmei fără IBAN → refuz; operatorul vede 0 facturi, nu emite și nu poate scrie
direct („permission denied”).

**Trei defecte introduse intenționat, toate prinse**: fără verificarea datei de start (prins de
testul de producție), conținutul unei facturi trimise modificabil (prins), seria citită fără
blocare (16 din 20 de emiteri simultane refuzate de unicitatea serie+număr — nicio dublură
ajunsă în bază, dar și dovada că blocarea e cea care le face pe toate să reușească).

**Lecții din probă**: (1) prima variantă a testului de producție folosea seria fixă „TEST SAGA”
și pica pe o bază în care seria avea deja facturi — acum numele e unic la fiecare rulare;
(2) o dată de probă greșită (comenzi fictive înaintea datei de start) a făcut toate emiterile
simultane să fie refuzate — regula a funcționat; datele fictive au fost corectate.

`npm run build`: „Compiled successfully”, cu `/admin/facturi/setari` în listă. Serverul local
a fost oprit ÎNAINTE de build (regula nouă).

#### Fișiere

- create: `supabase/saga-facturi.sql`, `scripts/verifica-saga-facturi.sql`,
  `scripts/anuleaza-saga-facturi.sql`, `scripts/verifica-saga-local.sh`,
  `scripts/saga-local/stub-supabase.sql`, `scripts/saga-local/date-fictive.sql`,
  `app/admin/facturi/setari/page.tsx`
- modificate: `app/admin/facturi/page.tsx` (link „Setări serie”), `lib/types.ts`,
  `.gitignore` (`/.backup/`), `scripts/baza-test.sh` (lista migrărilor), `CLAUDE.md`,
  `docs/saga-plan.md` (A.14, jurnalul)

#### Cum se aplică — pe PRODUCȚIE

**0. Copia de siguranță** — pașii de la (c) de mai sus, apoi verificarea ei.

**1. Pre-verificarea (doar citire)** — toate coloanele `true`:
```sql
select
  not exists (select 1 from pg_class where relnamespace = 'public'::regnamespace
               and relname in ('facturi','facturi_linii','facturi_serii','facturi_serii_istoric')) as tabelele_noi_nu_exista,
  not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace
               and proname in ('is_facturare','seteaza_serie_factura','emite_factura','retrage_factura',
                               'facturi_pazeste','facturi_linii_pazeste'))                as functiile_noi_nu_exista,
  not exists (select 1 from pg_constraint where conname = 'comanda_facturata_nu_se_poate_sterge') as constrangerea_noua_nu_exista,
  to_regprocedure('public.calculeaza_linie_tva(numeric,numeric,numeric)') is not null    as m47,
  to_regprocedure('public.saga_cota_tva()') is not null                                  as m48,
  to_regprocedure('auth.jwt()') is not null                                              as auth_jwt,
  exists (select 1 from information_schema.columns where table_name = 'products' and column_name = 'cod_intern') as products_cod_intern,
  exists (select 1 from information_schema.columns where table_name = 'orders' and column_name = 'discount_cod') as orders_discount_cod,
  (select md5(prosrc) from pg_proc where oid = 'public.sterge_comanda(bigint)'::regprocedure)
    = 'cd1d7d0cf96d2c79014e7d7749ac1b0d'                                                as sterge_comanda_ca_in_git;
```
Ultima coloană e informativă (migrarea 49 nu rescrie `sterge_comanda`); dacă e `false`, se
trimite textul funcției înainte de orice altceva.

**2. Migrarea**: `supabase/saga-facturi.sql` → „Success. No rows returned”.

**3. Testele**: `scripts/verifica-saga-facturi.sql` → în căsuța roșie, intenționat:
> REZULTAT OK: toate cele 41 verificări au trecut (probă pe comenzile AP-… și AP-…, seria de
> probă „TEST …”).

**4. Verificare că nu a rămas nimic** (doar citire) — toate trei 0:
```sql
select (select count(*) from facturi) as facturi, (select count(*) from facturi_serii) as serii,
       (select count(*) from orders where factura_serie like 'TEST %') as oglinzi_de_proba;
```

**5. Pagina** — serverul local OPRIT, apoi `npm run build && npm start`, apoi
`/admin/facturi/setari`: „Nicio serie activă …”; butonul „Salvează seria” inactiv până la bifă;
textul bifei se schimbă după ce scrii (de ex. „PAP FE” și 14193 → „… are numărul 14192 …”).
**NU se salvează acum** — seria se setează abia în ziua pornirii („Procedura de pornire”).

**6. Doar la nevoie — anularea**: `scripts/anuleaza-saga-facturi.sql` (refuză dacă există facturi).

**Opțional, oricând (local, fără bază reală)**: `scripts/verifica-saga-local.sh` →
„TOATE VERIFICĂRILE LOCALE AU TRECUT”.

#### Următorul

Pasul 5 — potrivirea articolelor (`saga_articole`) și articolul implicit „ACCESORII AUTO” /
„BUC” în setări. Începe doar după confirmare.

