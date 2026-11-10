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
| Seria actuală din SAGA | **„PAP FE”** (cu spațiu), ultimul număr **14190** | NU e implicitul site-ului (A.4) |
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
= **cel mult o serie activă**. Seria poate conține spații („PAP WEB”); se salvează exact cum e
scrisă, fără spații la capete.

**Fără serie implicită.** Nu există „AUTP”, „PAP FE” sau altă serie în cod sau în migrare.
`settings.firma.serie_factura`, `settings.integrari.saga.serie` și „AUTP” din
`FIRMA_IMPLICITA` ies din uz: câmpul dispare din Admin → Setări → Date firmă (valoarea din bază
rămâne, nefolosită — nu se șterge nimic). **Singura sursă e `facturi_serii`.** Propunerea pentru
site: o serie dedicată, **„PAP WEB”**, stabilită cu contabila și creată în SAGA înainte de
prima trimitere.

**`emite_factura(p_order_id bigint) returns json`** — `security definer`, verifică `is_facturare()`
la început. Totul într-o singură tranzacție (o funcție = o tranzacție):

1. Refuză dacă comanda e `anulata` sau are deja o factură (nu storno) neanulată.
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
mic sau egal cu cel mai mare număr deja emis în seria aceea (altfel ar ieși dubluri). Exemple:
„PAP WEB” de la 1, sau — dacă contabila hotărăște să continue seria existentă — „PAP FE” de la
14191. Fiecare schimbare intră în jurnal (`order_events` nu se potrivește — se scrie în
`saga_trimiteri` cu `tip = 'serie'`).

**Formatul numărului spre SAGA — o singură funcție.** În bază, seria și numărul stau separat
(`serie = 'PAP WEB'`, `numar = 1`). Cum devin ele `FacturaNumar` în XML și cum se recunosc în
`NR_DOC` din raport NU se știe încă (întrebarea 1 pentru contabilă): „PAP FE14191”,
„PAP FE 14191” sau doar „14191”, cu seria în altă parte. De aceea:

- `lib/saga-xml.ts` are EXACT două funcții care știu formatul: `numarPentruSaga(serie, numar)`
  (scrie) și `facturaDinNrDoc(nrDoc, facturi)` (recunoaște în raport). Nimic altceva din
  proiect nu lipește seria de număr spre SAGA.
- Formatul e o setare, `settings.integrari.saga.format_numar`: `serie_lipita` / `serie_spatiu` /
  `doar_numar`, **fără valoare implicită** — trimiterea refuză până e aleasă, după răspunsul
  contabilei (ideal, după XML-ul-model exportat din SAGA, vezi întrebarea 1).
- Recunoașterea din raport e toleranță: compară după eliminarea spațiilor și a majusculelor,
  iar dacă `NR_DOC` conține doar cifre, potrivește după număr ÎN cadrul fișierului trimis (un
  fișier conține o singură serie). Ce nu se potrivește → „raport neînțeles”, nu `trimisa`.
- Afișarea în aplicație rămâne „PAP WEB 1” (serie, spațiu, număr) — oglinda din A.9 la fel.

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

Coloanele **rămân**, dar devin o OGLINDĂ, scrisă de bază, nu de om:

- `emite_factura` pune `factura_serie = 'PAP WEB 1'` (serie, spațiu, număr — forma de afișare,
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

- `sterge_comanda` primește o gardă: refuză dacă există `facturi` pe comandă (FK-ul `restrict`
  ar ridica oricum eroare, dar cu un mesaj de neînțeles).
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
linii cu cantitatea negativă, `observatii = 'Stornare factura PAP WEB 1 din …'`. Merge la SAGA
ca orice factură.

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
| `scripts/verifica-saga-calcul.sql` | testele pasului 1, rulate pe baza de TEST (SQL Editor sau `baza-test.sh`) |
| `scripts/baza-test.sh` | aplică migrările în ordine și rulează testele SQL pe proiectul de TEST; refuză baza de producție |
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
| `lib/settings.ts` | tipul `Integrari.saga`: `cota_tva`, `regim_tva`, `preturi_cu_tva`, `url_api`, `format_numar`, `mentiune_plata`, `cif_persoana_fizica`, `articol_implicit` (+ denumire, UM), `articol_reducere`, `articol_transport`, `activ` — fără cheie și fără serie. Tipul `Firma`: `capital`, `banca`, `localitate`, `judet`, `tara`. `serie_factura: "AUTP"` scos din `FIRMA_IMPLICITA` |
| `app/admin/setari/page.tsx` | „Date firmă”: câmpurile noi (capital, bancă, localitate, județ, țară); câmpul „Serie facturi” scos |
| `lib/supabase.ts` | `esteFacturare(req)`, gemenele lui `esteEchipa()`, pe `is_facturare()` |
| `app/admin/facturi/page.tsx` | lista de documente cu filtre pe `saga_status`, acțiuni în masă („Trimite selectate”), export CSV prin `export_saga_linii`, textul despre „Saga nu are API public” rescris |
| `app/admin/comenzi/[id]/page.tsx` | caseta „Facturare (Saga)” înlocuită de `FacturaSaga` |
| `app/admin/integrari/page.tsx` | cardul „Saga — facturare”: TVA, adresa API-ului, formatul numărului, mențiunea de plată, `ClientCIF` pentru persoane fizice, articole implicite, cheia (doar câmp de scriere, niciodată afișată), „Testează conexiunea”; câmpul „Seria facturilor” scos (seria e în Facturi → Setări serie); descrierea și pașii rescriși; cardul „e-Factura ANAF” — formularea despre „import de fișiere” |
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
   oglinda pe `orders`, garda din `sterge_comanda`, RLS. Plus pagina Facturi → Setări serie.
5. **Potrivirea articolelor** — `saga_articole` + pagina de editare (fără butonul de verificare);
   articolul implicit „ACCESORII AUTO” / „BUC” în setări.
6. **Interfața de emitere** — „Emite factura”, detaliul facturii, „Modifică” (înainte de
   trimitere), „Retrage”, „Descarcă XML” (`lib/saga-xml.ts`). **Aici factura există complet,
   fără niciun apel la SAGA** — se poate importa manual în SAGA WEB, ca probă, XML-ul descărcat.
7. **Clientul API** — `saga_cheie`, `saga_blocare`, `saga_trimiteri`, `lib/saga.ts`,
   „Testează conexiunea” și „Salvează cheia” în Integrări. Prima atingere a SAGA, pe instanța de test.
8. **Trimiterea** — „Trimite în SAGA”, „Reîncearcă”, parsarea raportului, „Marchează confirmată”,
   jurnalul în detaliu, acțiunea în masă. **Blocată până e ales `format_numar`.**
9. **Verificarea articolelor** prin `GetArticol` în pagina de potrivire.
10. **Stornarea** — `storneaza_factura` + butonul.
11. **Textele** — Integrări, Facturi, pagina comenzii; `CLAUDE.md`.
12. **Proba pe contul real**, cu o singură factură, după aprobarea contabilei (D.6).

### Faza 2 — declanșarea automată (doar descrisă)

Aceeași formă ca `dezro_coada` și `email_coada`:

- La trecerea comenzii în starea aleasă (de exemplu `livrata` — de decis), un trigger pe
  `orders` cheamă `emite_factura` și pune factura în `saga_coada`, în ACEEAȘI tranzacție.
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
  - Testele rulează pe funcția SQL REALĂ, pe baza de test (`scripts/verifica-saga-calcul.sql`),
    nu pe o copie JS: o copie ar trece testul și ar lăsa funcția greșită.
- XML: caractere speciale în nume (`&`, `<`, ghilimele, diacritice), numele fișierului cu CIF-ul
  curățat („RO 36608590” → „RO36608590”), `GUID_factura` = id, `importAutomat` mereu `false`,
  mențiunea de plată „ramburs in cont” în câmpul ales, `ClientCIF` pentru persoană fizică în
  fiecare dintre cele trei variante.
- Formatul numărului: seria „PAP WEB” / „PAP FE” cu numărul 14191 în toate cele trei formate;
  fără `format_numar` ales → refuz.
- Raportul: exemplul din documentație, raport cu un singur succes, cu „importata … deja”, gol,
  cu CRLF, cu `NR_DOC` „PAP FE14191”, „PAP FE 14191”, „14191” — toate recunoscute pentru
  factura PAP FE 14191, niciuna pentru 14192.
- Județe: toate cele 42 cu și fără diacritice, cu sedilă, „Bucuresti”, „Sector 3”, gunoi → `null`.

### D.2 Baza de date — pe o bază care NU e producția
**Nicio ramură Supabase nu se creează fără aprobarea proprietarului: are cost.** Măsurat în
documentația Supabase (10 noiembrie 2026): ramurile cer **planul Pro (25 $/lună)**; o ramură pe
calculul implicit (Micro) costă **0,01344 $/oră** (~0,32 $/zi, ~10 $/lună dacă rămâne pornită),
plus trafic și disc peste cota planului. **Nu intră sub Spend Cap** și creditele de calcul nu se
aplică. Se șterge imediat după test.

**Alternativa gratuită, recomandată: un proiect Supabase de test separat**, pe planul Free
(0 $; planul gratuit permite 2 proiecte active, se oprește singur după o săptămână fără
activitate și se repornește din panou):

1. supabase.com → New project → nume `autopas-test`, regiunea Frankfurt (`eu-central-1`, ca
   producția), o parolă nouă pentru bază. **Nu se copiază nimic din producție** — nici date, nici chei.
2. Se rulează migrările 1–46, **în ordinea din CLAUDE.md**, apoi cele noi — din SQL Editor, una
   câte una, sau toate deodată cu `scripts/baza-test.sh migrari` (pașii exacți: raportul pasului 1).
3. Authentication → Users: patru utilizatori de test (`admin`, `contabil`, `operator`, `client`),
   apoi rolul pus în `profiles`.
4. Date de test: un script `scripts/date-test-saga.mjs` creează câteva piese și comenzi FICTIVE,
   doar dacă adresa bazei NU e cea de producție (refuză altfel, verificând URL-ul). Datele
   fictive stau doar în baza de test, niciodată în cod sau în producție.
5. Un `.env.test.local` (necomis) cu cheile proiectului de test; site-ul pornit cu el pentru D.3.
6. Notă: conectorul Supabase din sesiune vede acum un singur proiect, „aer-test”, dintr-o
   organizație în care **NU** e baza Autopas. Dacă proiectul de test se creează acolo (sau
   conectorul se leagă de el), testele de la D.2 le pot rula eu direct; altfel le rulezi din SQL Editor.

Se rulează 1–47 și se verifică:
- **Concurența numerotării**: 20 de `emite_factura` simultane, pe 20 de comenzi → numerele
  1..20, fără gol și fără dublură. Plus o emitere care pică la mijloc (județ invalid) → contorul
  neatins.
- `seteaza_serie_factura` refuză un număr deja folosit; serie cu spațiu („PAP WEB”) salvată exact.
- Fără serie activă, `emite_factura` refuză cu mesajul despre configurare și nu atinge nimic.
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
4. **Numerotarea în două locuri pe „PAP FE”** — seria actuală din SAGA e „PAP FE”, ultimul număr
   14190, și pe ea se emit facturi manual. Dacă site-ul ar continua aceeași serie de la 14191,
   orice factură emisă manual între timp în SAGA ar lua un număr pe care site-ul îl va aloca și
   el: două facturi „PAP FE 14191”. Nici nu știm dacă importul din XML mută contorul intern al
   SAGA pentru seria aceea. **De aceea propunerea e o serie dedicată, „PAP WEB”**, numerotată
   doar de site. Dacă totuși se alege „PAP FE”, facturarea manuală pe ea trebuie să înceteze din
   ziua pornirii.
5. **Instanța de test SAGA** — documentația o pomenește, dar adresa ei nu apare. Fără ea,
   pasul 7 (clientul API) nu poate începe.
6. **Formatul numărului necunoscut** — o factură trimisă cu `FacturaNumar` în forma greșită
   poate intra în SAGA cu alt număr decât crede aplicația, sau poate să nu fie recunoscută în
   raport. Atenuare: formatul e o singură funcție + o setare fără valoare implicită; trimiterea
   e blocată până e aleasă; prima probă (D.4) se face manual, cu XML descărcat.

### Întrebări pentru contabilă

Rezolvate la 10 noiembrie 2026, de pe factura reală: regimul TVA (normal, 21%), rotunjirea,
articolul generic („ACCESORII AUTO”, BUC), mențiunea de plată („ramburs in cont”), seria
actuală („PAP FE”, ultimul număr 14190), capitalul social (200 RON) și banca (BCR Piatra Neamt).

1. **PRIORITAR — formatul numărului.** Pentru o serie cu spațiu, cum se completează
   `FacturaNumar` în XML: „PAP FE14191”, „PAP FE 14191” sau doar „14191”, cu seria în alt câmp?
   Și cum apare `NR_DOC` în raportul de import? **Cel mai sigur răspuns: XML-ul-model al facturii
   PAP FE 14190**, exportat din SAGA (Ieșiri → tipărire → „Formular PDF” → fișierul din
   `TEMP\Facturi`). Din el aflăm deodată și formatul numărului, și câmpul în care stă mențiunea de
   plată, și cum e scris clientul persoană fizică. Se salvează ca `docs/factura-model.xml`.
2. **Seria pentru site**: o serie nouă, dedicată, „PAP WEB” (propunerea noastră), de la 1 — sau
   continuăm „PAP FE” de la 14191, renunțând la facturarea manuală pe ea (riscul 4)? Seria nouă
   trebuie creată și în SAGA?
3. **Codul articolului „ACCESORII AUTO”** din gestiune. Și: reducerea și transportul tot pe
   „ACCESORII AUTO” sau pe alte articole (cu ce coduri)? Vor fi vreodată articole pe categorii
   (piese de motor, caroserie…), sau rămâne unul singur?
4. **Persoanele fizice**: la `ClientCIF` trimitem gol (ca pe factura reală), „-” sau
   „0000000000000” (forma cerută de e-Factura pentru PF fără CNP)? Le identificăm cu
   `GUID_cod_client` sau lăsăm SAGA să le recunoască după nume?
5. **Evidență cantitativ-valorică?** Dacă da, ce cod de `Gestiune` se pune pe linii.
6. **Reducerea**: linie separată negativă sau repartizată proporțional pe piese?
7. **Data facturii**: data comenzii, data expedierii sau data emiterii din aplicație? Scadența:
   aceeași zi?
8. **Momentul facturării** (pentru faza 2): la confirmare, la expediere sau la livrare
   (încasarea rambursului)?
9. **Storno**: aceeași serie, cu număr nou, sau serie separată? Trimis din aplicație sau făcut
   direct în SAGA?
10. **Transportul de pe comenzile vechi** (cele 2 cu transportul inclus în total): cu ce articol
    și ce cotă?
11. **e-Factura**: confirmăm că transmiterea în SPV o face SAGA, după validare — deci aplicația nu
    trimite nimic la ANAF?

### Întrebări pentru SAGA (suport)
- Adresa instanței de test și cum primim o cheie pentru ea.
- Dublura la reîncărcare cu `importAutomat=false` (riscul 2).
- Formatul garantat al raportului 207/422.
- Cât timp poate dura un import (pentru timeout-uri, sub limita de 60 s a funcțiilor).
