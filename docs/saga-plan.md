# Plan de implementare — integrarea SAGA WEB

Ramura: `saga-integrare` · scris la 10 noiembrie 2026 · documentația API: `docs/saga-api.md` ·
raportul despre proiect: `raportare.md`.

**Stare la 11 noiembrie 2026: pașii 1–6 sunt făcuți** (migrările 47–51 rulate pe producție).
Nicio migrare nu se rulează pe producție și nu se face push fără aprobarea explicită a
proprietarului.

## Ce a rămas de făcut (la 11 noiembrie 2026)

**Acum — la proprietar:**
1. ~~Mențiunea de plată~~ — **setată „ramburs in cont”** (11 noiembrie 2026).
2. ~~Importul în SAGA~~ — **făcut la 11 noiembrie 2026, prin API, cap-coadă** (jurnalul pasului 8):
   formatul numărului și al datei confirmate (riscul 6 închis), cota 21% aplicată (riscul 10 închis),
   fără `Gestiune` (întrebarea 5). **Rămân deschise**: diacriticele (riscul 8 — în raport a rămas
   „[corecte / de verificat]”) și ce număr propune SAGA pe PAP FE după un import (riscul 7).
3. ~~Cheia API REALĂ~~ — **salvată din admin și verificată pe contul real** (11 noiembrie 2026).
   Rămâne regula: cheia nu se dă în chat, nu se pune în variabile de mediu sau în fișiere.
3b. **„TVA la încasare” = Nu** (decis la 11 noiembrie 2026).
3c. ~~Verificările obligatorii la prima probă de import~~ — **făcute la 11 noiembrie 2026**: „PROBA 1”,
   11.11.2026, cota 21% (33,06 + 6,94 = 40,00), fără `Gestiune`.
3d. ~~Diacriticele~~ — **ÎNCHIS la 11 noiembrie 2026**: fișierul e citit corect; SAGA însuși scoate diacriticele,
   ca la clienții introduși manual (riscul 8).
3e. ~~„Testează conexiunea” cu 1457070043~~ — **reportat la 11 noiembrie 2026**: „Conectat la SAGA. Articolul
   „1457070043” există: ACCESORII AUTO (BUC, TVA 19%). SAGA a rotit cheia; cea nouă e salvată.”
3f. **Clienții (întrebarea 16)** — DECIS: câte un client separat în SAGA pentru fiecare persoană; propunerea
   (cum nu se dublează un client care revine + proba pe seria PROBA) vine în raportul pasului 10.

Făcut la 11 noiembrie 2026: push-ul ramurii `saga-integrare` pe GitHub, CU preview Vercel (fără
unire în `main`). De acum, tot ce ține de SAGA, date firmă și facturi se face doar din preview
sau local (regula din CLAUDE.md).

**De aflat (blochează pașii următori):**
4. De la **contabilă** — întrebările deschise din E: 1 (formatul numărului și al datei; ideal
   2 (ziua pornirii, oprirea facturării manuale), 4 (persoane fizice), 6 (reducerea), 7 (data facturii și scadența), 8 (momentul facturării), 9 (forma
   stornării), 10 (transportul comenzilor vechi), 11 (e-Factura prin SAGA), 12 (contorul PAP FE),
   15 (Nr. Reg. Com. al clienților firmă), 16 (clienții — rămâne cazul cu nume / adresă ușor diferite).
5. De la **suportul SAGA** (nu mai blochează pasul 7) — dubla încărcare la reîncercare, formatul
   raportului, durata unui import, contorul seriei.

**Pașii de cod rămași** (din C, câte unul, după confirmare):
6. ~~Pasul 7~~ — **GATA (11 noiembrie 2026)**: migrarea 52 rulată, cheia reală salvată, „Testează
   conexiunea” trecut pe contul real, rotirea cheii probată pe viu.

7. ~~Pasul 8~~ — **GATA (11 noiembrie 2026)**: trimiterea în SAGA, probată cap-coadă pe contul real, pe
   seria PROBA (comanda de probă AP-2026-01809, anulată). Factura PROBA 1 rămâne „trimisă” în aplicație
   până la pasul 10 (ascundere / stornare).
   Lipsește încă rezultatul celui de-al doilea „Testează conexiunea” (cu 1457070043).
8. Pasul 9 — verificarea articolelor prin `GetArticol`: **COD SCRIS (11 noiembrie 2026), fără migrare,
   împins pe ramură la 11 noiembrie 2026.** Rămâne: verificarea proprietarului din preview („Verifică în
   SAGA” pe articolul implicit).
9. ~~Pasul 10~~ — **GATA (11 noiembrie 2026)**: migrarea 53 rulată, proba pe contul real reușită (PROBA 2 cu
   diacritice → storno PROBA 3, același client în SAGA); riscul 8 închis.
9b. ~~Pasul 10b~~ — **GATA (11 noiembrie 2026)**: migrarea 54 rulată, testele 14 / 16 / 13 / 27 pe producție.
   Proba din preview SĂRITĂ (decizia proprietarului: acoperită de cele 14 teste pe producție).
9c. **PORNIREA pe PAP FE — AZI, 11 noiembrie 2026** (`data_start_facturare` = 2026-11-11): pas cu pas în
   „Procedura de pornire — 11 noiembrie 2026” (secțiunea C). Înainte: verificările pentru unirea ramurii în
   `main` (secțiunea „Înainte de unire”, în jurnalul pasului 10b). **Ramura UNITĂ în `main` și pusă pe producție
   la 11 noiembrie 2026** (`e0f512f`) — procedura se face din adminul live.
10. ~~Pasul 11~~ — textele: **GATA și pus pe site la 11 noiembrie 2026** (push confirmat, deploy reușit ~11:09 UTC);
   de verificat de proprietar pe ecran — vezi „Raportul trimis proprietarului” de la finalul planului. Jurnalul pasului 11 la finalul planului. **Cerut de proprietar (11 noiembrie 2026) — DUPĂ PORNIRE**: curățarea și organizarea zonei SAGA / facturare
   din admin pentru folosirea zilnică:
   - scoase mesajele de lucru: „de verificat cu contabila”, „valoare de PROBĂ”, trimiterile la pași / riscuri /
     întrebări, notele tehnice;
   - setările care nu se mai schimbă (formatele, TVA la încasare, CIF-ul persoanelor fizice, adresa API-ului)
     mutate într-o secțiune „Setări avansate”, restrânsă;
   - drum scurt și clar: comandă → „Emite factura” → „Trimite în SAGA”, cu stări ușor de înțeles;
   - limbaj simplu, fără XML / API / GUID unde nu e nevoie;
   - butoanele de probă (de ex. „Descarcă XML”) mutate la setările avansate.
11. ~~Unirea ramurii în `main`~~ — **FĂCUTĂ la 11 noiembrie 2026** (`e0f512f`, deploy de producție reușit);
    regulile „până la unire” scoase din `CLAUDE.md`.
12. ~~Pasul 12~~ — **GATA: PORNIREA a reușit la 11 noiembrie 2026.** Prima factură reală din aplicație:
    **PAP FE 14207** (comanda AP-2026-01812, 200,00 lei) — importată, validată în SAGA, trimisă în e-Factura,
    confirmată. Riscul 7 închis (SAGA a propus 14208 după import).

**Mai târziu:**
- faza 2 — facturarea automată la schimbarea stării comenzii (descrisă în C);
- **un formular în admin pentru o comandă introdusă MANUAL** (vânzare la sediu / la telefon), ca să poată fi
  facturată tot din aplicație (idee a proprietarului, 11 noiembrie 2026 — NU acum).

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
| Seria actuală din SAGA | **„PAP FE”** (cu spațiu); ultimul număr manual la 10.11.2026, după-amiaza: **14192**; la **11.11.2026, ~11:00: 14202**; la **11.11.2026, ~11:45: 14206** (continuarea ar fi 14207; facturarea manuală continuă până în ziua pornirii) | **ACEASTA e seria aplicației** — decizia din 10.11.2026 (A.4). Numărul de start se setează abia în ziua pornirii |
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

**Decizia din 11 noiembrie 2026 — cheia e cea REALĂ, fără instanță de test:**
- cheia se introduce DOAR din admin („Salvează cheia”) și ajunge DOAR în `saga_cheie`. Nu trece
  prin chat, prin variabile de mediu (Vercel sau `.env.local`) sau prin fișiere; asistentul n-o vede;
- **un singur loc o citește, o folosește și o rotește**: `cere()` din `lib/saga.ts`, sub lacătul
  din A.11. Niciun script nu are copia lui de cheie — un al doilea deținător al cheii ar rata o
  rotire și ar bloca-o (docs/saga-api.md, secțiunea 1);
- **cheia blocată** (401/403 de la SAGA) se regenerează din SAGA WEB (Utilizatori → Integrare
  API → Generează cheie de acces) și se salvează din nou în admin. Mesajul din panou spune exact
  asta; aplicația nu încearcă nimic singură.

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
| `scripts/verifica-saga-api.mjs` | verificările clientului API pe un SAGA SIMULAT local, fără cheia reală și fără rețea (D.5) |
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
   „Testează conexiunea” și „Salvează cheia” în Integrări. Prima atingere a SAGA, **direct pe
   contul REAL** (decizia din 11 noiembrie 2026, fără instanță de test): cheia doar din admin;
   „Testează conexiunea” face doar citiri (`GetArticol`), niciodată Import.
8. **Trimiterea** — „Trimite în SAGA”, „Reîncearcă”, parsarea raportului, „Marchează confirmată”,
   jurnalul în detaliu, acțiunea în masă. **Blocată până sunt alese `format_numar` și `format_data`.**
   Probele: pe seria **PROBA**, cu `importAutomat=false`, împreună cu contabila, care șterge
   importul nevalidat din Diverse → Import date. **PAP FE nu se folosește la probe.**
9. **Verificarea articolelor** prin `GetArticol` în pagina de potrivire.
10. **Stornarea** — `storneaza_factura` + butonul. **Plus (cerut la 11 noiembrie 2026): facturile pe
    seria PROBA trimise în SAGA trebuie să poată fi ascunse din listă sau stornate** — după proba de la
    pasul 8 rămâne cel puțin una „trimisă”, care nu se mai poate retrage.
11. **Textele** — Integrări, Facturi, pagina comenzii; `CLAUDE.md`. **Cerut de proprietar (11 noiembrie 2026) — DUPĂ PORNIRE**: curățarea și organizarea zonei SAGA / facturare
    din admin pentru folosirea zilnică:
    - scoase mesajele de lucru: „de verificat cu contabila”, „valoare de PROBĂ”, trimiterile la pași / riscuri /
      întrebări, notele tehnice;
    - setările care nu se mai schimbă (formatele, TVA la încasare, CIF-ul persoanelor fizice, adresa API-ului)
      mutate într-o secțiune „Setări avansate”, restrânsă;
    - drum scurt și clar: comandă → „Emite factura” → „Trimite în SAGA”, cu stări ușor de înțeles;
    - limbaj simplu, fără XML / API / GUID unde nu e nevoie;
    - butoanele de probă (de ex. „Descarcă XML”) mutate la setările avansate.
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

### Procedura de pornire — 11 noiembrie 2026 (AZI)

Decizia proprietarului: pornirea pe **PAP FE** azi, `data_start_facturare` = **2026-11-11**. Totul se face din
PREVIEW sau local (regula din CLAUDE.md) cât ramura nu e unită în `main`; după unire, din adminul live.
Rezumatul de mai sus („Procedura de pornire”) rămâne principiul; aici sunt valorile și ordinea de azi.

**Starea la ~12:25**: ultima factură manuală pe PAP FE = **14206**; azi s-au facturat manual în SAGA comenzi de
azi: **PAP FE 14195–14206**. Numărul de start = ultimul manual + 1 (acum **14207**) — îl pune proprietarul în
momentul pornirii; dacă se mai emit manual până atunci, se ia numărul final.

**1. Notarea seriei pe comenzile de azi deja facturate manual** — ÎNAINTE de data de start (până atunci câmpul
manual se vede pe toate comenzile). SQL, DOAR CITIRE, în SQL Editor:
```sql
-- Comenzile plasate AZI (ora României), neanulate, fără serie notată.
select o.numar,
       to_char(o.created_at at time zone 'Europe/Bucharest', 'HH24:MI') as ora,
       coalesce(nullif(btrim(o.firma), ''), o.nume) as client,
       o.cui,
       o.subtotal - coalesce(o.discount_valoare, 0) as valoare_piese,   -- ce apare pe factură
       o.total,                                                        -- pe comenzile noi = piesele (transportul îl încasează FAN)
       o.status, o.factura_status
  from public.orders o
 where (o.created_at at time zone 'Europe/Bucharest')::date = date '2026-11-11'
   and o.status <> 'anulata'
   and o.factura_serie is null
 order by o.created_at;
```
Se compară cu facturile PAP FE 14195–14206 din SAGA; pe fiecare comandă deja facturată: pagina comenzii →
cardul „Facturare (Saga)” → câmpul cu seria → „PAP FE 142xx” → Salvează (pune `factura_serie` și „emisa”). Se
rulează din nou SQL-ul: ce rămâne sunt comenzile de azi NEfacturate — pe ele se poate factura din aplicație.
**`emite_factura` refuză o comandă cu `factura_serie` completat** (verificat în cod: ramura `elsif` din 54,
identică cu 51; testat în `verifica-saga-emitere.sql` și `verifica-saga-refacturare.sql`, partea D).
După pornire, o factură manuală se notează din același card: „Facturată deja manual în SAGA? Notează seria”
(adăugat azi sub „Emite factura”), sau din lista din Facturi.

**2. Ultimul număr manual**: în SAGA, Ieșiri, seria PAP FE — ultimul număr (azi 14206) și că nu există niciun
număr mai mare (nici ciornă, nici storno).

**3. Facturi → Setări serie**: seria **PAP FE**, numărul următor = ultimul + 1 (**14207**); bifa „Confirm că
ultima factură pe PAP FE — din aplicație sau emisă manual în SAGA — are numărul 14206, deci următoarea primește
14207.” → Salvează. Istoricul seriei păstrează cine și când.

**4. Integrări → Saga** (REÎNCARCĂ pagina întâi), exact:

| câmp | valoare |
|---|---|
| `format_numar` | `serie_spatiu` |
| `format_data` | `zi-luna-an` |
| `tva_la_incasare` | `nu` |
| `cif_persoana_fizica` | `gol` |
| `mentiune_plata` | `ramburs in cont` |
| `articol_implicit` / `_denumire` / `_um` | `1457070043` / `ACCESORII AUTO` / `BUC` |
| `import_automat` | gol |
| `data_start_facturare` | `2026-11-11` |

Salvează. Opțional: Facturi → Articole SAGA → „Verifică în SAGA” pe implicit (✓ ACCESORII AUTO · BUC).

**5. Prima factură reală** — pe o comandă de azi, nefacturată:
- **în aplicație, înainte de trimitere** (pagina facturii): numărul **PAP FE 14207**, data 11.11.2026 (și
  scadența), clientul (nume / firmă, CUI, adresă, județ), linia: articol 1457070043 · ACCESORII AUTO · BUC, numele
  piesei, sumele (valoare + TVA = total), **cota 21%**, mențiunea „ramburs in cont”, totalul = valoarea pieselor
  (= rambursul de pe AWB, fără transport). O greșeală acum: „Modifică” (client / articol) sau „Retrage”;
- „Trimite în SAGA” → raportul (o avertizare „preț de vânzare sub cel de achiziție” e normală);
- **în SAGA, Diverse → Import date, ÎNAINTE de validare**: seria și numărul PAP FE 14207, data, scadența,
  clientul (nou sau unul existent), articolul, cantitatea, sumele și **cota 21%**, mențiunea „ramburs in cont;
  Comanda AP-…”. Corecturi mici — în SAGA, înainte de validare. **Dacă e greșită de tot: NU se validează; se
  oprește și se discută** (nu se șterge importul fără o notă);
- validarea în SAGA, apoi **e-Factura din SAGA** (aplicația nu trimite nimic la ANAF);
- în aplicație: „Marchează confirmată”.

**6. Riscul 7 — după prima factură din aplicație importată ȘI validată**: în SAGA se începe o factură manuală
nouă pe PAP FE și se UITĂ ce număr propune — **fără salvare**. Așteptat: 14208 (după factura din aplicație).
Dacă propune 14207 sau mai puțin, contorul SAGA nu avansează la import: la facturile manuale, numărul se scrie
de mână, după Setări serie. Rezultatul se notează în plan (riscul 7).

**7. De azi înainte — facturarea manuală pe PAP FE** (o singură persoană, și din aplicație, și din SAGA):
înainte de o factură manuală, verifici în SAGA că numărul propus e cel de după ultima factură din aplicație;
imediat după, actualizezi numărul următor în Facturi → Setări serie și notezi seria pe comandă.

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

### D.4 XML-ul importat MANUAL în SAGA WEB (contul real, fără validare)
Înainte de orice cod de API: XML-ul descărcat (pasul 6) se încarcă de mână în SAGA, din
Diverse → Import date. Așa aflăm dacă SAGA îl acceptă, cum arată numărul, ce face cu
`InformatiiSuplimentare` — fără să riscăm cheia.

### D.5 API-ul — fără instanță de test (decizia din 11 noiembrie 2026)

**Nu există instanță de test**: se lucrează direct pe contul REAL, cu cheia reală, pe care o ține
proprietarul și o introduce doar din admin (A.10). De aici trei niveluri:

**1. `scripts/verifica-saga-api.mjs` — pe un SAGA SIMULAT, fără cheie reală și fără rețea.**
Pornește un server HTTP local care imită SAGA (răspunsuri 200 / 207 / 400 / 401 / 422, antetul
`X-Saga-Refresh-Token`, întârzieri) și cheamă funcțiile REALE din `lib/saga.ts`, cu depozitul de
cheie și lacătul înlocuite de imitații în memorie. Verifică:
1. antetele trimise (`Authorization: Bearer …`, `X-Saga-Cod-Fiscal` cu CIF-ul curățat);
2. **rotirea**: cheia nouă din antet se salvează ÎNAINTE de citirea corpului, inclusiv la răspunsuri
   de eroare, iar apelul următor o folosește;
3. două apeluri simultane → al doilea refuză („o operație SAGA e deja în curs”), niciodată paralel;
4. lacătul se eliberează și la eroare, și la timeout;
5. 401 / 403 → mesajul „cheie blocată: regenerați din SAGA WEB și salvați-o din nou în admin”;
6. `GetArticol`: 200 XML → articolul citit; 400 JSON → „cod inexistent”;
7. **cheia nu apare nicăieri**: nici în rezultatele întoarse, nici în rândurile de jurnal, nici în
   mesajele de eroare (căutare textuală).

**2. „Testează conexiunea” din admin, pe contul real — DOAR citiri.** Face un singur `GetArticol`
(codul articolului implicit, dacă e setat; altfel un cod care nu există → 400, care tot dovedește
că cheia e acceptată). **Niciodată `Import`**: nu există cale de import în pasul 7.

**3. Trimiterile (pasul 8), pe contul real — doar pe seria PROBA**, cu `importAutomat=false`,
împreună cu contabila, care șterge importul nevalidat din Diverse → Import date. PAP FE nu se
folosește la probe. Cazurile de probat atunci: o factură bună (200), aceeași din nou (dublură),
una cu clientul gol (422), un fișier cu una bună și una greșită (207).

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
   Atenuare inițială: din ziua pornirii, facturarea manuală pe PAP FE se oprește complet.
   **ÎNLOCUITĂ la 11 noiembrie 2026 (decizia proprietarului)**: o singură persoană emite facturi, și din
   aplicație, și manual din SAGA, deci facturarea manuală pe PAP FE **poate continua** după pornire, cu
   regula: (1) ÎNAINTE de o factură manuală, verifică în SAGA că numărul propus e cel de după ultima factură
   din aplicație; (2) IMEDIAT DUPĂ, actualizează numărul următor în Facturi → Setări serie (numărul manual + 1)
   și notează seria pe comandă („Facturată deja manual în SAGA? Notează seria”). Regula e scrisă și pe pagina
   Setări serie. `seteaza_serie_factura` refuză oricum un număr deja folosit de o factură din aplicație.
   Stornările pe PAP FE: din aplicație (A.15).
5. **Fără instanță de test — totul pe contul REAL** (decizia din 11 noiembrie 2026; înlocuiește
   riscul vechi „adresa instanței de test lipsește”). Riscul: o probă greșită ajunge în SAGA-ul
   real, iar o cheie rotită și pierdută blochează contul real. Atenuare: cheia doar din admin, un
   singur loc care o rotește (A.10, A.11); „Testează conexiunea” doar cu `GetArticol`; nicio cale de
   Import în pasul 7; probele de trimitere doar pe seria PROBA, cu `importAutomat=false`, șterse
   nevalidate de contabilă; testele automate ale clientului pe un SAGA simulat (D.5).
7. ~~**Contorul intern al SAGA pentru PAP FE**~~ — **ÎNCHIS la 11 noiembrie 2026**: după validarea PAP FE 14207
   (prima factură din aplicație, importată), SAGA a propus pentru o factură manuală nouă pe PAP FE **14208** —
   contorul SAGA VEDE facturile importate. Consecința pentru regula facturilor manuale (riscul 4): SAGA propune
   singur numărul corect după facturile din aplicație (verificarea dinainte rămâne doar o plasă); pasul care
   rămâne OBLIGATORIU e cel de după: aplicația NU vede facturile manuale, deci după fiecare factură manuală se
   actualizează numărul următor în Facturi → Setări serie și se notează seria pe comandă. Textul inițial (risc nou, 10 noiembrie 2026) — NU știm dacă un
   import XML avansează contorul de numerotare din SAGA pentru seria PAP FE. Dacă nu-l
   avansează, SAGA „crede” în continuare că următorul număr e cel de la pornire, iar o factură
   emisă ulterior manual în SAGA (din greșeală sau dintr-un obicei) ar primi un număr deja folosit
   de aplicație. Atenuare: regula „după pornire, nimic manual pe PAP FE”; întrebare pentru
   contabilă (12) și pentru suportul SAGA; de verificat la proba de la pasul 6 (după importul
   manual al XML-ului de probă, ce număr propune SAGA pentru o factură nouă pe PAP FE — fără să
   o salveze).
10. ~~**Cota TVA din fișa articolului vs. `ProcTVA` din XML**~~ — **ÎNCHIS la 11 noiembrie 2026**: la
    prima probă de import, SAGA a aplicat cota din XML (21%: 33,06 + 6,94 = 40,00), nu 19 din fișă.
    Textul inițial (risc nou, 11 noiembrie 2026) — în
    nomenclatorul SAGA, articolul 1457070043 „ACCESORII AUTO” are **TVA 19**, tip Mărfuri, stoc 516,
    deși factura reală PAP FE 14188 a ieșit cu 21%. La import, SAGA ar putea aplica cota din fișa
    articolului (19) în locul lui `ProcTVA` din XML (21) — factură cu TVA greșit. Atenuare:
    **verificare OBLIGATORIE la prima probă de import pe seria PROBA**: cota și valoarea TVA pe
    factura importată (de ex. 500 → 413,22 + 86,78, nu 420,17 + 79,83). Dacă SAGA ia cota din fișă,
    fișa articolului se corectează în SAGA (contabila) înainte de orice factură reală.
9. ~~**Codul fiscal din antetul `X-Saga-Cod-Fiscal`**~~ — **ÎNCHIS la 11 noiembrie 2026**: „RO36608590”
   e acceptat (testul de conexiune de pe contul real a trecut). Nota inițială: documentația
   scrie doar „<CUI_FIRMA>”. Trimitem forma curățată din Date firmă, „RO36608590”, aceeași ca în
   `FurnizorCIF` și în numele fișierului. Dacă SAGA o vrea fără „RO”, primul „Testează conexiunea”
   va eșua cu un mesaj de-al lor; atunci se schimbă într-un singur loc (`cif` în `lib/saga.ts`).
8. ~~**Codificarea XML-ului**~~ — **ÎNCHIS la 11 noiembrie 2026** (proba pasului 10): XML-ul UTF-8 e citit
   corect, fără caractere stricate; SAGA scoate singur diacriticele („TEST COMANDA”, „PIATRA-NEAMT”, „Str.
   Marasesti, 1”), la fel ca la clienții introduși manual. Întrebarea 14 închisă. Nota din 11 noiembrie 2026: la prima probă de import,
   rezultatul pentru diacritice a rămas necompletat în raport („[corecte / de verificat]”). Clientul
   probei („ALEX OLTEANU TEST”) n-avea diacritice; de verificat pe o factură cu „ă/î/ș/ț” în nume sau
   adresă. Textul inițial: fișierul e UTF-8, cu declarația în antet; diacriticele
   din nume și adrese ies corect doar dacă SAGA WEB citește UTF-8. Nedocumentat. Atenuare: proba
   manuală de la pasul 6 (D.4), pe o factură cu diacritice; întrebarea 14.
6. ~~**Formatul numărului necunoscut**~~ — **ÎNCHIS la 11 noiembrie 2026**: la prima probă de import,
   `serie_spatiu` a dat `NR_DOC` „PROBA 1” în raportul SAGA și factura „PROBA 1” la Ieșiri, iar data
   zi-lună-an a ieșit 11.11.2026 (scadența la fel). Textul inițial: o factură trimisă cu `FacturaNumar` în forma greșită
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

1. ~~**PRIORITAR — formatul numărului.**~~ **ÎNCHISĂ la 11 noiembrie 2026** de prima probă de import
   (`serie_spatiu`, zi-lună-an — riscul 6). Textul inițial: Pentru o serie cu spațiu, cum se completează
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
3. ~~**Codul articolului „ACCESORII AUTO”**~~ — **ÎNCHISĂ la 11 noiembrie 2026**: codul e
   **1457070043**, „ACCESORII AUTO”, UM BUC (pus în Integrări → articolul implicit). În SAGA are TVA 19,
   tip Mărfuri, stoc 516 — vezi riscul 10 și întrebarea 5. Textul inițial: din gestiune. Și: reducerea și transportul tot pe
   „ACCESORII AUTO” sau pe alte articole (cu ce coduri)? Vor fi vreodată articole pe categorii
   (piese de motor, caroserie…), sau rămâne unul singur? Indiciu (manualul SAGA, vezi indiciul 4
   la întrebarea 1): articolele se recunosc după codul de bare sau codul propriu din XML — de
   confirmat dacă `CodArticolClient` e „codul propriu” al articolului „ACCESORII AUTO”.
4. **Persoanele fizice**: la `ClientCIF` trimitem gol (ca pe factura reală), „-” sau
   „0000000000000” (forma cerută de e-Factura pentru PF fără CNP)? Le identificăm cu
   `GUID_cod_client` sau lăsăm SAGA să le recunoască după nume?
5. ~~**Evidență cantitativ-valorică?**~~ **ÎNCHISĂ PENTRU ACUM (11 noiembrie 2026)**: la prima probă de
   import SAGA NU a cerut `Gestiune` pe linii (doar avertizarea „prețul de vânzare e mai mic decât cel de
   achiziție”, din costul mediu al articolului cu stoc). Se redeschide dacă apare o eroare de gestiune.
   Textul inițial: dacă da, ce cod de `Gestiune` se pune pe linii.
   **Indiciu (11 noiembrie 2026)**: articolul 1457070043 are stoc (516), deci firma pare să țină
   evidență cantitativ-valorică. La prima probă de import pe seria PROBA se verifică dacă SAGA cere
   `Gestiune` pe linii.
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
13. ~~**TVA la încasare**~~ — **ÎNCHISĂ la 11 noiembrie 2026: Nu** (decizia proprietarului; mențiunea nu
    apare pe factura PAP FE 14188). Textul inițial (pasul 6): firma aplică sistemul TVA la încasare? Câmpul `FacturaTVAIncasare`
    din XML e „Da” sau „Nu” — setarea `tva_la_incasare` nu are valoare implicită.
14. **Codificarea fișierului** (riscul 8): SAGA WEB acceptă XML în UTF-8 (cu diacritice), sau cere
    altă codificare? Se vede la proba manuală de la pasul 6.
12. **Contorul SAGA pentru PAP FE** (riscul 7): după ce o factură intră în SAGA prin import XML,
    avansează SAGA contorul seriei PAP FE? Dacă nu, ce număr ar propune SAGA unei facturi noi
    emise manual după pornire — și se poate bloca în SAGA emiterea manuală pe PAP FE?
16. **Clienții creați automat de SAGA la import** — **PROBA pasului 10 (11 noiembrie 2026): SAGA refolosește
    clientul cu date identice, fără GUID (PROBA 2 și stornoul PROBA 3 → același cod 18086). Rămâne de testat
    cazul cu nume / adresă ușor diferite, după pornire; propunerea cu GUID e acceptată.** DECIZIA proprietarului (11 noiembrie 2026): câte un
    client separat în SAGA pentru fiecare persoană, ca la facturarea manuală** (clienții noi primesc coduri
    consecutive, cei care revin își păstrează codul vechi). Rămâne de propus (în raportul pasului 10, fără
    implementare): cum nu se creează din nou un client care revine și proba pe seria PROBA. Textul inițial
    (de discutat, 11 noiembrie 2026 — NU de implementat încă). La prima probă, SAGA a creat singur clientul „ALEX OLTEANU TEST” (cod 18086). Întrebările:
    - același client care cumpără de mai multe ori: SAGA îl recunoaște (după ce? — nume, CIF), sau
      creează de fiecare dată unul nou? Și clienții existenți deja în SAGA, din facturarea manuală?
    - pentru persoane fizice fără CNP, recunoașterea după nume poate și DUBLA (același om, scris altfel),
      și AMESTECA (doi „Ion Popescu”);
    - `GUID_cod_client` (opțional în XML; „SAGA reține asocierea”) ar da o cheie stabilă. Comenzile n-au
      `user_id`, deci cheia ar veni din: **CUI** pentru firme; **telefonul normalizat** pentru persoane
      fizice (obligatoriu la checkout, cel mai stabil); e-mailul e a doua variantă. Ca text, nu telefonul
      brut, ci o formă derivată (de ex. `AP-` + un rezumat al telefonului), ca SAGA să nu primească
      încă o copie a lui în alt câmp;
    - necunoscute: dacă SAGA cere un GUID în formatul standard (8-4-4-4-12), ce face când același GUID
      vine cu nume / adresă schimbate, și cum se leagă un GUID de un client creat deja manual;
    - alternativa contabilă: un singur client generic pentru persoanele fizice (unele firme așa lucrează)
      — de întrebat contabila ce vrea să vadă în SAGA.
    Propunere: întâi răspunsul contabilei (client per persoană sau generic) și un test pe seria PROBA cu
    același client trimis de două ori (cu și fără `GUID_cod_client`); apoi decizia.
15. **Nr. Reg. Com. al clienților firmă** (găsit la proba din 11 noiembrie 2026): `ClientNrRegCom`
    iese GOL, fiindcă checkout-ul cere doar firma și CUI-ul, nu și numărul de la Registrul
    Comerțului. E acceptabil așa (SAGA / e-Factura îl cer?), îl completează contabila în SAGA,
    sau trebuie cerut la checkout (câmp nou, opțional sau obligatoriu)? Până la răspuns, nu se
    schimbă nimic; se poate completa de mână pe factură, prin „Modifică”, înainte de trimitere.

### Întrebări pentru SAGA (suport)
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
- **copia de siguranță manuală NU a fost făcută** — decizia proprietarului: există backup
  zilnic Supabase și scriptul de anulare. **Verificat de proprietar** (10 noiembrie 2026, la
  pasul 5): proiectul e pe un plan cu backup zilnic, vizibil în Database → Backups;
- pre-verificarea: toate cele 9 coloane `true` (inclusiv `sterge_comanda_ca_in_git`);
- `supabase/saga-facturi.sql` → „Success. No rows returned.”;
- `scripts/verifica-saga-facturi.sql` → „REZULTAT OK: toate cele 41 verificări au trecut (probă
  pe comenzile AP-2026-01795 și AP-2026-01796, seria de probă „TEST 04730F37”).”;
- verificarea finală: facturi 0, serii 0, oglinzi de probă 0;
- pagina `/admin/facturi/setari` (precizat de proprietar la pasul 5): arăta corect — „Nicio
  serie activă”, butonul inactiv fără bifă. Nicio serie salvată.
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
   select p.oid::regprocedure as functia, md5(replace(p.prosrc, E'\r', '')) as amprenta,
          length(replace(p.prosrc, E'\r', '')) as lungime
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
  (select md5(replace(prosrc, E'\r', '')) from pg_proc where oid = 'public.sterge_comanda(bigint)'::regprocedure)
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
„BUC” în setări. **Confirmat de proprietar la 10 noiembrie 2026; vezi intrarea pasului 5.**

### Pasul 5 — potrivirea pieselor cu articolele din gestiunea SAGA (migrarea 50)

**Stare: ÎNCHIS. Migrarea 50 e RULATĂ pe producție la 10 noiembrie 2026**, de proprietar, din
SQL Editor (cod: commit `e0f8913` + corectura gărzilor `aeee4dc`, pe `saga-integrare`, fără push):
- pre-verificarea, versiunea nouă (fără `\r`): toate cele 5 coloane `true`;
- `supabase/saga-articole.sql` → „Success. No rows returned.”;
- `scripts/verifica-saga-articole.sql` → „REZULTAT OK: toate cele 13 verificări au trecut
  (comanda AP-2026-01796, seria de probă „TEST 91CE688B”)”;
- `scripts/verifica-saga-facturi.sql` → „REZULTAT OK: toate cele 41 verificări au trecut
  (comenzile AP-2026-01795 și AP-2026-01796, seria de probă „TEST 2823BC73”)”;
- verificarea finală: potriviri 0, facturi 0, serii 0;
- paginile `/admin/facturi/articole` și `/admin/integrari` arată corect. Nimic salvat.

**Cardul „Saga — facturare” salvat din site-ul LIVE (cod vechi, `main`) NU șterge câmpurile
noi** (verificat în codul de pe `main`, 10 noiembrie 2026): codul vechi pornește din
configurarea existentă (`{ ...conf.saga }`) și suprascrie doar `serie` și `activ`. Riscul real e
altul, valabil și pe live, și pe ramură: orice salvare din Integrări rescrie TOT rândul
`integrari` cu instantaneul încărcat la deschiderea paginii — o pagină deschisă înaintea unei
schimbări, salvată apoi pe orice card, readuce valorile vechi. Regula e în CLAUDE.md.

Înainte de pas, în același schimb de mesaje: serverul local oprit la cererea proprietarului;
migrarea 49 notată ca rulată în jurnalul pasului 4 și în CLAUDE.md (commit `1b932bd`), cu două
observații: pagina `/admin/facturi/setari` nu a fost raportată (în mesaj a rămas textul-șablon
„[scrie ce ai văzut]”), iar copiile zilnice Supabase există doar pe planurile plătite — de
verificat în Database → Backups; pe Free, singura plasă e scriptul de anulare.

**Rezumatul trimis proprietarului** (detaliile în secțiunile de mai jos):
- pasul 5 rescrie o singură funcție existentă, `emite_factura` (de la pasul 4), cu gardă pe
  amprentă — verificată local; adaugă tabela `saga_articole` (cascadă la ștergerea categoriei);
  în cod: cardul Saga din Integrări, un link în Facturi, pagina nouă „Articole SAGA”;
- teste: 13 noi pe producție (tranzacție anulată), testul pasului 4 golește potrivirile în
  tranzacția lui; local trec toate (33 / 15 / 41 / 13), iar un defect introdus intenționat e prins;
- anularea pune înapoi exact funcția din 49; verificată local, cu re-rulare;
- pe producție: pre-verificarea (mai ales `emite_factura_ca_in_49`), migrarea, ambele teste,
  verificarea că n-a rămas nimic, paginile; nicio potrivire nu e obligatorie dacă toate piesele
  merg pe „ACCESORII AUTO”; codul articolului implicit se completează când îl dă contabila;
- pasul 6 începe doar după confirmare.

#### Modifică ceva existent? (răspuns dat înainte de cod)

- **În bază — DA, o funcție: `emite_factura`**, creată de migrarea 49 și rulată pe producție
  la 10 noiembrie 2026. Se rescrie ca linia piesei să ia articolul din potrivire. Restul funcției
  e IDENTIC cu 49 (singurele diferențe: bucla liniilor de piese și un comentariu).
  - **Garda din migrare**: compară `md5(prosrc)` al funcției din bază cu versiunea din git (49:
    `5b89a9154101aacc8d72d4d864b01356`; 50, la re-rulare: `8eefb50d4c81c4ea93701317e9ac67ed`)
    și se OPREȘTE dacă diferă, fără să atingă nimic. Verificat local: cu funcția modificată
    direct în bază, migrarea s-a oprit („OPRIT: emite_factura din bază diferă …”) și nu a creat
    nici tabela.
  - Riscul azi e nul: nu există nicio serie activă, deci funcția nu emite nimic.
- **Tabelă NOUĂ `saga_articole`**, cu cheie străină spre `categories` `ON DELETE CASCADE`:
  ștergerea unei categorii îi șterge și potrivirea (verificat local); categoria nu e blocată.
- **Neatinse**: nicio altă funcție, tabelă, politică sau rând existent.
- **În cod**: cardul Saga din Integrări (câmpurile articolelor; câmpul vechi „Seria
  facturilor” scos — valoarea din bază rămâne, salvarea pornește din configurarea existentă),
  un link nou în Facturi, pagina nouă „Articole SAGA”.

#### Ce s-a făcut

**Migrarea 50, `supabase/saga-articole.sql`** (idempotentă):
- garda amprentei (de mai sus);
- `saga_articole` — un rând pe categorie (`unique`): `cod_articol` (fără spații la capete,
  nevid), `denumire`, `um` (implicit BUC), `verificat_la` / `verificat_raspuns` (pentru pasul 9,
  GetArticol), cine și când. RLS: citire și scriere doar `is_facturare()` (admin + contabil);
  `anon` fără niciun drept;
- `emite_factura` rescrisă: articolul fiecărei piese = potrivirea SUBCATEGORIEI ei, apoi a
  CATEGORIEI, apoi articolul implicit din setări; o piesă ștearsă din catalog primește
  implicitul. Reducerea și transportul rămân pe articolele lor (implicit, dacă nu au cod propriu).
  Factura emisă își păstrează articolul copiat: o potrivire schimbată nu o atinge.

**Anularea, `scripts/anuleaza-saga-articole.sql`**: pune înapoi `emite_factura` EXACT din 49
(textul copiat automat din fișierul migrării 49, nu rescris de mână) și șterge `saga_articole`.
Se oprește dacă funcția din bază nu e versiunea din 50. Verificat local: după anulare,
amprenta e cea din 49, tabela lipsește, iar re-rularea migrării 50 merge.

**Interfața:**
- **`app/admin/facturi/articole/page.tsx`** (Facturi → „Articole SAGA”, admin + contabil):
  articolul implicit (citit din setări; dacă lipsește: „Nesetat. Fără el nu se emite nicio
  factură …”), apoi arborele categoriilor — părinții cu cele mai multe piese întâi, fiecare cu
  subcategoriile ei —, cu articolul pe care îl primesc ACUM piesele (propriu / „ca la categorie”
  / „implicit”), „Articol propriu” / „Modifică” / „Scoate”, căutare după nume. Scrierile trec
  prin `scrieVerificat` (RLS).
- **Admin → Integrări → Saga**: codul, denumirea și UM-ul articolului implicit; codul și
  denumirea articolelor pentru reducere și transport (goale = implicitul). Nicio valoare scrisă
  în cod: eticheta doar amintește ce scrie pe factura reală („ACCESORII AUTO”). „Seria
  facturilor” scos de aici.
- **Facturi**: link „Articole SAGA” lângă „Setări serie”.

**Testele pe producție, `scripts/verifica-saga-articole.sql`** — 13 verificări, tranzacție
anulată, seria de probă „TEST …” unică: amprenta funcției; admin/contabil scrie și modifică
potriviri, un utilizator fără rol nu vede și nu scrie, `anon` fără drepturi; cod gol, cod cu
spații la capete și a doua potrivire pe aceeași categorie refuzate; pe o comandă EXISTENTĂ cu o
piesă care are categorie ȘI subcategorie: fără potrivire → implicitul, cu potrivire pe categorie
→ articolul categoriei, și pe subcategorie → subcategoria câștigă (între încercări factura se
retrage, iar numărul 1 se refolosește); reducerea și transportul nu iau articolul piesei;
factura emisă nu se schimbă când se schimbă potrivirea.
- `scripts/verifica-saga-facturi.sql` (pasul 4) golește acum potrivirile în propria tranzacție
  (anulată), fiindcă verifică articolul IMPLICIT pe toate liniile.

**Verificat local** (`scripts/verifica-saga-local.sh`, extins cu migrarea 50 și categorii
fictive): migrările 47–50 rulate de două ori; testele 33 / 15 / 41 / 13 trec; concurența,
ora-limită, ștergerea, garda anulării — toate ok. În plus, separat: garda amprentei oprește
migrarea; cascada pe categorie; anularea și re-rularea; **un defect introdus intenționat
(categoria câștigă în fața subcategoriei) e prins de test** („cu potrivire și pe subcategorie,
aștept SUB; am CAT”). (Prima probă a defectului a fost prinsă de garda amprentei, înainte ca
testul ordinii să ruleze; a fost repetată ocolind garda, ca să se vadă că și testul ordinii îl
prinde singur.)

`npm run build`: „Compiled successfully”, cu `/admin/facturi/articole` în listă. Serverul local
era oprit înainte de build.

#### Fișiere

- create: `supabase/saga-articole.sql`, `scripts/verifica-saga-articole.sql`,
  `scripts/anuleaza-saga-articole.sql`, `app/admin/facturi/articole/page.tsx`
- modificate: `app/admin/integrari/page.tsx`, `app/admin/facturi/page.tsx`,
  `scripts/verifica-saga-facturi.sql`, `scripts/verifica-saga-local.sh`,
  `scripts/saga-local/stub-supabase.sql`, `scripts/saga-local/date-fictive.sql`,
  `scripts/baza-test.sh`, `CLAUDE.md`, `docs/saga-plan.md`

#### Cum se aplică — pe PRODUCȚIE, din SQL Editor

**1. Pre-verificarea (doar citire)** — toate coloanele `true`:
```sql
select
  to_regclass('public.saga_articole') is null                                          as tabela_noua_nu_exista,
  (select md5(replace(prosrc, E'\r', '')) from pg_proc where oid = 'public.emite_factura(bigint)'::regprocedure)
    = '5b89a9154101aacc8d72d4d864b01356'                                              as emite_factura_ca_in_49,
  to_regprocedure('public.is_facturare()') is not null                                  as m49,
  exists (select 1 from information_schema.columns where table_name = 'products' and column_name = 'subcategorie_id') as products_subcategorie,
  (select count(*) from public.facturi) = 0                                             as nicio_factura_emisa;
```
Dacă `emite_factura_ca_in_49` e `false`, NU se rulează migrarea (s-ar opri oricum singură);
se trimite `select pg_get_functiondef('public.emite_factura(bigint)'::regprocedure);`.

**2. Migrarea**: `supabase/saga-articole.sql` → „Success. No rows returned”.

**3. Testele** — amândouă, fiecare în căsuța roșie, intenționat:
- `scripts/verifica-saga-articole.sql` → „REZULTAT OK: toate cele 13 verificări au trecut …”
- `scripts/verifica-saga-facturi.sql` (din nou, fiindcă `emite_factura` s-a schimbat) →
  „REZULTAT OK: toate cele 41 verificări au trecut …”

**4. Verificare că n-a rămas nimic** — toate 0:
```sql
select (select count(*) from saga_articole) as potriviri, (select count(*) from facturi) as facturi,
       (select count(*) from facturi_serii) as serii;
```

**5. Paginile** — serverul local OPRIT, apoi `npm run build && npm start`:
- `/admin/facturi/articole`: caseta „Articolul implicit” cu „Nesetat …” (codul nu e dat încă);
  arborele categoriilor, fiecare cu „→ implicit (nesetat)”; „Articol propriu” deschide
  formularul. **Nu e nevoie de nicio potrivire** dacă toate piesele merg pe „ACCESORII AUTO”.
- `/admin/integrari`, cardul „Saga — facturare”: câmpurile articolelor; „Seria facturilor” nu
  mai apare. Codul articolului implicit se completează când îl dă contabila (întrebarea 3).

**6. Doar la nevoie — anularea**: `scripts/anuleaza-saga-articole.sql` → la final
`emite_factura_ca_in_49 = true`, `saga_articole_stearsa = true`.

#### Pre-verificarea pe producție a dat `emite_factura_ca_in_49 = false` (10 noiembrie 2026)

Proprietarul a rulat pre-verificarea: 4 coloane `true`, `emite_factura_ca_in_49` = **`false`**.
**Migrarea 50 NU a fost rulată.** Din producție: `md5(prosrc)` = `23e4b6f3c6b5ba59dc8126c83936c65c`,
lungimea 9257 (în git: `5b89a9154101aacc8d72d4d864b01356`, 9083), plus definiția întreagă
(`pg_get_functiondef`).

**1. Diferența exactă și de unde vine: sfârșiturile de rând.** Corpul funcției din git are 174 de
rânduri; 9083 + 174 = 9257. Amprenta versiunii din git cu fiecare `LF` transformat în `CRLF`
(sfârșit de rând Windows) e EXACT `23e4b6f3c6b5ba59dc8126c83936c65c` — calculată de asistent din
fișier. Deci funcția din producție e textul din git, caracter cu caracter, plus câte un `\r` la
fiecare sfârșit de rând. Vine din lipirea în SQL Editor-ul Supabase dintr-un browser pe Windows,
care trimite textul cu CRLF. **Fișierul NU a fost modificat după rulare**: `supabase/saga-facturi.sql`
are un singur commit (`002d5b3`), identic cu versiunea curentă (verificat cu `cmp`). Definiția
lipită de proprietar are aceleași rânduri ca fișierul (clipboard-ul nu păstrează `\r`).
Reprodus local: migrarea 49 rulată cu CRLF dă exact amprenta `23e4b6f3…` și lungimea 9257.

**2. Versiunea din producție e corectă și sigură.** Un `\r` e spațiu alb pentru PL/pgSQL, iar
niciun șir de caractere din corpul funcției nu trece peste un sfârșit de rând (verificat: 0
rânduri în interiorul unui șir), deci niciun mesaj și nicio valoare nu primesc `\r`. Testele
pasului 4 au trecut pe producție (41) chiar cu această versiune.

**3. Ce s-a făcut: gărzile ignoră acum `\r`, în loc să se schimbe amprentele.** Amprenta
corectă rămâne cea a textului din git; ce se compară e `md5(replace(prosrc, E'\r', ''))`.
Așa garda trece și pentru o funcție lipită de pe Windows, și pentru una rulată din terminal, dar
se oprește în continuare la orice altă diferență. Schimbate: garda din `supabase/saga-articole.sql`,
garda și verificarea finală din `scripts/anuleaza-saga-articole.sql`, prima verificare din
`scripts/verifica-saga-articole.sql`, pre-verificările din jurnalul pașilor 4 și 5 și metoda de
comparare (b) de la pasul 4. **Nu trebuie rulat nimic înainte**: se reia de la pre-verificarea
pasului 5, care acum dă `true`.

Verificat local, cu toate fișierele lipite cu CRLF (ca din SQL Editor pe Windows): migrările
47–49 → `emite_factura` cu amprenta `23e4b6f3…` (ca în producție); pre-verificarea normalizată
→ `true`; migrarea 50 → trece, și a doua oară; testele 13 și 41 → „REZULTAT OK”; anularea →
`emite_factura_ca_in_49 = true`. Scriptul local complet (fără CRLF) trece și el.

Commit: `aeee4dc` pe `saga-integrare`, fără push. Nimic rulat pe producție de asistent.

**Rezumatul trimis proprietarului:**
- **Cauza**: doar sfârșiturile de rând — 174 de rânduri, 9083 + 174 = 9257; textul din git cu
  CRLF are exact amprenta din producție; vine din lipirea în SQL Editor dintr-un browser pe
  Windows; fișierul NU a fost modificat după rulare (un singur commit, `002d5b3`); definiția lipită
  are aceleași rânduri ca fișierul; reprodus local.
- **Siguranța**: `\r` e spațiu alb pentru Postgres, niciun text din funcție nu trece peste un
  rând nou, iar testele pasului 4 au trecut pe producție cu această versiune.
- **Ce facem**: nimic de rulat înainte. Gărzile compară acum `md5(replace(prosrc, E'\r', ''))`
  — amprenta corectă rămâne cea din git. Schimbate: garda din migrarea 50, anularea (garda +
  verificarea finală), prima verificare din `verifica-saga-articole.sql`, pre-verificările din
  plan (pașii 4 și 5), regula din CLAUDE.md. Verificat local cu fișierele lipite cu CRLF: totul
  trece; scriptul local complet trece și el.
- **Pașii următori pe producție**: (1) pre-verificarea din nou, versiunea nouă din jurnalul
  pasului 5 → toate 5 coloanele `true`; (2) `supabase/saga-articole.sql`, versiunea nouă a
  fișierului; (3) testele `verifica-saga-articole.sql` (13) și `verifica-saga-facturi.sql` (41);
  apoi restul pașilor din „Cum se aplică”. Pasul 6 doar după confirmare.

**Lecție, trecută și în CLAUDE.md**: orice amprentă de funcție se compară FĂRĂ `\r`.
`sterge_comanda` a dat `true` la pasul 4 fiindcă fusese creată pe altă cale; la funcțiile lipite
din browser pe Windows, comparația brută pică fără ca funcția să fie diferită.

#### Următorul

Pasul 6 — interfața de emitere: „Emite factura” (doar pe comenzile de la `data_start_facturare`
încolo), detaliul facturii, „Modifică” (înainte de trimitere), „Retrage”, „Descarcă XML”
(`lib/saga-xml.ts`), câmpul „Data de start a facturării” în Integrări. **Confirmat de proprietar
la 10 noiembrie 2026; vezi intrarea pasului 6.**

### Pasul 6 — interfața de emitere și „Descarcă XML” (migrarea 51)

**Stare: migrarea 51 e RULATĂ pe producție la 10 noiembrie 2026**, de proprietar, din SQL
Editor (cod: commit `c49241a` pe `saga-integrare`, fără push):
- pre-verificarea: 5 × `true`;
- `supabase/saga-emitere.sql` → „Success. No rows returned.”;
- testele: `verifica-saga-emitere.sql` 16/16, `verifica-saga-articole.sql` 13/13,
  `verifica-saga-facturi.sql` 41/41;
- verificarea finală: facturi 0, serii 0, potriviri 0;
- paginile arată corect.

**Proba de emitere prin interfață, cu seria „PROBA” (varianta 2), făcută de proprietar
(raportată la 11 noiembrie 2026):**
- factura **PROBA 1** emisă pe comanda **AP-2026-01794**; XML descărcat:
  `F_RO36608590_PROBA1_10_11_2026.xml` (nu e pus în git: are datele unui client real);
- curățenia: factura retrasă, emiterea oprită, data de start și articolul de probă golite în
  Integrări; verificarea SQL: facturi 0, serii active 0, comenzi marcate 0;
- **corect în XML**: CIF-ul fără spațiu, județele NT / CT, 500 → 413.22 + 86.78, preț unitar
  413.2200, articolul ACCESORII AUTO, numele piesei la `InformatiiSuplimentare`, ghilimelele
  escapate;
- **`FacturaNumar` = „PROBA1”**, fără spațiu. Cauza: la descărcare s-a folosit `serie_lipita`, nu
  `serie_spatiu` — numele fișierului o dovedește (`serie_spatiu` ar fi dat `…_PROBA_1_…`).
  `numarPentruSaga` și `numeFisier` sunt corecte; teste noi în `verifica-saga-xml.mjs` (73/73):
  `serie_spatiu` → „PROBA 1” / „PAP FE 14193” și fișierele lor, `serie_lipita` → exact fișierul
  primit la probă. Ca să nu se mai aleagă orbește: pagina facturii arată acum, înainte de
  descărcare, ce va scrie în `<FacturaNumar>` și numele fișierului, iar `serie_spatiu` e prima în
  listă (ca în Integrări);
- **`FacturaInformatiiSuplimentare` = doar „Comanda AP-2026-01794”**, fără mențiunea de plată:
  `mentiune_plata` era goală în Integrări. Mențiunea se COPIAZĂ în factură la emitere și
  `modifica_factura` n-o poate schimba. Acum: avertisment pe cardul de emitere din comandă și în
  confirmarea „Emiți factura?”, plus avertisment pe pagina facturii (cu reparația: retrage și
  emite din nou, cât e ultima din serie și netrimisă) și lângă „Descarcă XML”;
- **`ClientNrRegCom` gol** pentru clienții firmă: site-ul nu-l cere — întrebarea 15 pentru contabilă;
- **NEFĂCUT încă: importul manual al XML-ului în SAGA WEB** (D.4), deci riscurile 6, 7 și 8 rămân
  deschise.

**Pasul 7 NU a început** la data probei — cerut explicit de proprietar. (Adresa instanței de test
nu mai e necesară: decizia din 11 noiembrie 2026, riscul 5.)

#### După probă: ce s-a schimbat (11 noiembrie 2026, commit `e91aca0`)

1. **„PROBA1” fără spațiu — generatorul nu are nicio greșeală.** Numele fișierului primit,
   `…_PROBA1_…`, iese numai cu `serie_lipita`. Cu `serie_spatiu` ar fi fost `…_PROBA_1_…`, iar în
   XML „PROBA 1”. Deci la descărcare s-a ales `serie_lipita`, pe care lista îl punea primul.
   - 10 teste noi; `verifica-saga-xml.mjs` trece 73 din 73. Confirmă „PROBA 1” și „PAP FE 14193”
     cu numele fișierelor lor, plus faptul că `serie_lipita` dă exact fișierul primit la probă.
   - Pe pagina facturii se vede acum, înainte de „Descarcă XML”, ce va scrie în `<FacturaNumar>`
     și cum se va numi fișierul. `serie_spatiu` e primul în listă (`FORMATE_NUMAR`).
2. **Avertismente când lipsește mențiunea de plată:**
   - pe cardul „Emite factura” din comandă și în fereastra de confirmare de dinaintea emiterii;
   - pe pagina facturii, plus o notă lângă „Descarcă XML”.

   Mențiunea se copiază în factură în momentul emiterii, iar „Modifică” nu o poate schimba. Pe o
   factură deja emisă, singura reparație e retragerea și emiterea din nou. Avertismentul spune asta.
3. **Nr. Reg. Com. gol la clienții firmă** — întrebarea 15 pentru contabilă.
4. Jurnalul pasului 6 are proba; lista „Ce a rămas” are completarea mențiunii de plată („ramburs
   in cont”) înaintea oricărei facturi reale și importul manual în SAGA, încă nefăcut.
5. Build-ul a trecut. Serverul local a fost oprit pentru build. Primul `pkill -f "next start"` nu
   l-a oprit (procesul se numește `next-server`), deci primul build a rulat cu serverul pornit;
   s-a oprit după PID și build-ul s-a refăcut curat. **De reținut: serverul se oprește după PID
   (`pgrep -a next-server`), nu cu `pkill -f "next start"`.**

Fișiere: `lib/saga-xml.mjs`, `scripts/verifica-saga-xml.mjs`, `app/admin/facturi/[id]/page.tsx`,
`components/admin/FacturaSaga.tsx`, `docs/saga-plan.md`, `CLAUDE.md`.
Verificare: `node scripts/verifica-saga-xml.mjs` → 73 de verificări trecute.

#### Înainte de push: verificarea istoricului (11 noiembrie 2026) — curată

- **Fișiere**: niciun `.env`, `.backup/`, CSV sau XML n-a intrat vreodată în git (căutat în tot
  istoricul, pe toate ramurile). Singurul fișier de configurare e `.env.local.example`, un șablon
  fără valori. PDF-urile, CSV-urile și arhivele FAN din rădăcină nu sunt urmărite de git, deci nu
  pleacă. XML-ul probei nu e în proiect.
- **Conținutul celor 26 de commit-uri** față de `main`: nicio cheie, token sau parolă — doar
  exemple ca `PAROLA` / `[YOUR-PASSWORD]` și nume de roluri (`service_role`). Niciun CNP. E-mailuri
  doar fictive (`@t.ro`, `@test.local`) și `contact@autopas-dezmembrari.ro`; singurul telefon e cel
  public al firmei. Datele de test locale (`scripts/saga-local/`) sunt „Ion Test”, „Ana Test”,
  „Firma Client”. `docs/saga-api.md` are doar `<CHEIE_ACCES>` ca exemplu.

#### Înainte de push: Vercel și ramura

- **Va face un preview, aproape sigur.** Vercel construiește implicit orice ramură împinsă pe
  GitHub, iar `vercel.json` (doar `regions`) nu oprește asta. Preview-ul primește o adresă
  `….vercel.app`, nu domeniul. Site-ul live rămâne pe `main`, neatins.
- **Variabilele**: cele marcate pentru mediul „Preview” în Vercel. Vercel le bifează implicit pe
  toate trei mediile, iar proiectul are o singură bază Supabase — deci preview-ul **lucrează cel
  mai probabil pe baza REALĂ, cu cheia de serviciu**, exact ca serverul local. NEVERIFICAT (fără
  acces la Vercel din Codespace): se vede în Vercel → proiect → Settings → Environment Variables,
  coloana „Environments”, mai ales la `SUPABASE_SERVICE_ROLE_KEY`.
- **Build-ul preview-ului doar citește din bază.** Scrierile apar numai dacă cineva intră în
  adminul preview-ului și salvează, ca local. Codul preview-ului e cel nou, deci „Date firmă”
  salvat de acolo NU strică nimic; regula „reîncarcă Integrări înainte de a salva” rămâne.
- **Fără preview**: înainte de push, Vercel → Settings → Git → „Ignored Build Step”, sau o linie
  în `vercel.json` care oprește build-ul pentru `saga-integrare` — un commit în plus, care ar
  ajunge în `main` la unire; inofensiv.
- **Decizia proprietarului (11 noiembrie 2026)**: push CU preview, fără unire. Făcut:
  `origin/saga-integrare`; Vercel a pornit build-ul preview-ului.

Commit-urile acestui schimb de mesaje: `39daacf` (pasul 5 notat ca rulat, precizările despre
pasul 4 și backup, regula paginii Integrări deschise), `c49241a` (pasul 6).

**Rezumatul trimis proprietarului** (detaliile în secțiunile de mai jos):
- cardul Saga salvat din site-ul live NU șterge câmpurile noi; riscul real e pagina Integrări
  rămasă deschisă și salvată pe orice card — regula „reîncarcă înainte de a salva” e în CLAUDE.md;
- pasul 6 rescrie `emite_factura` (gardă de amprentă; refuză comenzile marcate deja ca facturate
  manual), adaugă `modifica_factura` și `opreste_emiterea`; în cod: cardul de facturare din
  pagina comenzii, „Șterge” ascuns pe comenzile facturate, lista documentelor în Facturi,
  câmpurile noi din Integrări, „Oprește emiterea” în Setări serie;
- pagina facturii (Modifică, Retrage, Descarcă XML cu formate de PROBĂ alese pe loc);
  generatorul XML cu formatul numărului și al datei fiecare într-o singură funcție, fără
  implicit; „TVA la încasare” devine setare fără implicit (întrebarea 13); riscul 8, UTF-8
  (întrebarea 14);
- teste: 16 pe producție, 63 pentru XML, suita locală completă, migrările cu CRLF, o factură
  reală trecută prin generator; interfața în browser NEverificată de asistent;
- pe producție: pre-verificarea (5 × true), migrarea, cele trei teste (16 / 13 / 41),
  verificarea 0/0/0, paginile;
- proba emiterii fără să se consume un număr de pe PAP FE: testele SQL (serii „TEST …” anulate),
  sau prin interfață, cu seria „PROBA” de la 1 — emite, verifică, descarcă XML, opțional proba
  manuală în SAGA fără validare (cu contabila), retrage, oprește emiterea, golește data de
  start, verificarea SQL; PAP FE nu e atinsă;
- pasul 7 (clientul API) doar după confirmare și cu adresa instanței de test SAGA.

#### Înainte de pas

- **Pasul 5 notat ca rulat** (commit `39daacf`): pre-verificarea fără `\r` (5 × true),
  migrarea 50, testele 13 și 41, verificarea finală 0/0/0, paginile corecte. Precizările
  proprietarului: la pasul 4, `/admin/facturi/setari` arăta corect; proiectul are backup zilnic
  Supabase (verificat în Database → Backups) — jurnalul pasului 4 și CLAUDE.md corectate.
- **Cardul „Saga — facturare” salvat din site-ul LIVE NU șterge câmpurile noi** (verificat în
  codul de pe `main`: pornește din `{ ...conf.saga }`, suprascrie doar `serie` și `activ`).
  Riscul real, valabil și pe live, și pe ramură: orice card salvat dintr-o pagină Integrări
  deschisă ÎNAINTEA unei schimbări rescrie tot rândul `integrari` cu instantaneul vechi. Regula
  „reîncarcă pagina înainte de a salva” e în CLAUDE.md.

#### Ce modifică din ce există (răspuns dat înainte de cod)

- **În bază (migrarea 51), doar obiecte SAGA:**
  - `emite_factura` rescrisă a treia oară, cu aceeași gardă (amprenta fără `\r` = 50
    `8eefb50d…` sau 51 `a1a45bbd8ce6ad03eae408ee9d2f113e`). O singură regulă în plus: refuză o
    comandă marcată deja ca facturată — `factura_serie` completat sau `factura_status` ≠
    „de_emis” (factură notată manual din SAGA, „nu se emite”, stornată). Fără ea, o probă pe o
    comandă facturată manual i-ar fi suprascris nota, iar o retragere ar fi șters-o;
  - constrângerea `facturi_serii_istoric.actiune` primește și „oprire”;
  - funcții noi: `modifica_factura`, `opreste_emiterea`.
- **În cod:** cardul „Facturare (Saga)” din pagina comenzii înlocuit de `FacturaSaga`; butonul
  „Șterge” ascuns pe comenzile cu factură (iar eroarea bazei, tradusă); în Facturi, lista
  documentelor cu filtre și câmpul manual de serie blocat pe comenzile cu factură; în
  Integrări, câmpurile noi ale cardului Saga; în Setări serie, „Oprește emiterea”; pagini și
  fișiere noi.

#### Ce s-a făcut

**Migrarea 51, `supabase/saga-emitere.sql`** (idempotentă):
- garda amprentei;
- `opreste_emiterea()` — dezactivează seria activă (rândul rămâne, cu numărul următor), scrie
  „oprire” în istoric; după ea `emite_factura` refuză („Seria facturilor nu e configurată”);
- `modifica_factura(factura, client, linii)` — doar cât factura e `de_trimis` / `eroare`:
  datele clientului (doar cheile permise: nume, firmă, CUI, nr. Reg. Com., adresă, localitate,
  județ, e-mail, telefon, țară; restul se ignoră), codul județului recalculat (nerecunoscut →
  refuz), articolul pe linii (cod, denumire, UM; liniile altei facturi → refuz). Prețurile,
  cantitățile, TVA-ul, seria și numărul NU. Jurnalul comenzii;
- `emite_factura` cu paza comenzilor marcate deja ca facturate.

**Anularea, `scripts/anuleaza-saga-emitere.sql`**: pune înapoi `emite_factura` EXACT din 50
(copiat automat din fișierul migrării 50) și șterge cele două funcții noi; constrângerea din
istoric rămâne lărgită (un rând „oprire” existent ar face îngustarea imposibilă).

**Generatorul XML, `lib/saga-xml.mjs`** — funcții pure (fără bază, fără rețea), folosite în
browser acum și pe server la pasul 8:
- structura din `docs/saga-api.md` (Antet, Detalii/Continut/Linie, `GUID_factura` = id-ul);
- **singurele două locuri care știu formatul**: `numarPentruSaga` și `dataPentruSaga`, după
  `format_numar` / `format_data` — fără valoare implicită: fără ele, refuz;
- `FurnizorCIF` / `ClientCIF` curățate de spații (`cifCurat`); PF → `ClientCIF` după
  `cif_persoana_fizica` (gol / „-” / 13 zerouri); firmă → numele firmei, persoana de contact în
  `ClientInformatiiSuplimentare`;
- `FacturaInformatiiSuplimentare` = mențiunea de plată + „Comanda AP-…”;
- linia: `Descriere` = articolul din gestiune, `CodArticolClient`, `GUID_cod_articol` = codul
  intern (AP-…), `InformatiiSuplimentare` = numele piesei de pe site, `Pret` cu 4 zecimale,
  `Valoare` / `TVA` cu 2, `Cantitate` fără zerouri inutile, negative la reducere/storno;
- `FacturaTVAIncasare` din setarea nouă `tva_la_incasare` (da / nu) — **fără valoare implicită**,
  întrebarea 13 pentru contabilă; `FacturaTaxareInversa` = „Nu”; `FacturaMoneda` = „RON”;
- escape XML complet și caracterele de control scoase; UTF-8 (riscul 8, întrebarea 14);
- numele fișierului: `F_<CIF>_<număr cu _>_<zi_luna_an>.xml`, după exemplul din documentație.

**Interfața:**
- **`components/admin/FacturaSaga.tsx`** (pagina comenzii): factura existentă (serie, număr,
  total, stare, „Deschide factura”, „Retrage” cât e netrimisă); altfel „Emite factura” — DOAR
  pentru admin/contabil, cu data de start setată, comanda plasată în ziua de start sau după (ora
  României), nemarcată ca facturată, neanulată; altfel câmpul manual de serie, ca până acum, cu
  motivul pentru care emiterea din aplicație nu e disponibilă. Baza refuză oricum tot ce nu are voie.
- **Pagina comenzii**: „Șterge” nu mai apare pe comenzile cu factură; dacă baza refuză ștergerea,
  mesajul e tradus („Comanda are o factură emisă și nu se mai poate șterge …”).
- **`app/admin/facturi/[id]/page.tsx`** (pagina facturii): antetul cu starea, clientul și
  furnizorul din copie, liniile cu totalurile; „Modifică” (client + articol pe linii) și
  „Retrage” doar înainte de trimitere; **„Descarcă XML”**: formatele din Integrări, iar cele
  nesetate se aleg pe loc, marcate „valoare de PROBĂ, doar pentru descărcarea asta”, fără să se
  salveze; butonul e inactiv până sunt alese.
- **Facturi**: secțiunea „Facturi emise din aplicație”, cu filtre pe stare (de trimis, se
  trimite, trimisă, eroare, confirmată); câmpul manual de serie blocat pe comenzile cu factură.
- **Setări serie**: „Oprește emiterea (nicio serie activă)”, cu confirmare.
- **Integrări → Saga**: data de start (câmp de dată), `format_numar`, `format_data`,
  `tva_la_incasare`, `cif_persoana_fizica`, `mentiune_plata` — toate fără valoare implicită,
  verificate la salvare pe listele închise.

**Teste:**
- **`scripts/verifica-saga-emitere.sql`** — 16 verificări pe producție, în tranzacție anulată,
  serie „TEST …” unică: amprenta; comanda marcată manual („PAP FE 99999”, „nu_se_emite”) refuzată
  fără să miște contorul sau nota; corecturile (nume tăiat la capete, județ → IS, CUI, cheie
  nepermisă ignorată, articolul pe linie, totalurile și numărul neatinse); refuzurile (județ
  „Atlantis”, linia altei facturi, cod gol, factură trimisă); oprirea emiterii (seria inactivă,
  istoric, emiterea refuzată); drepturile.
- **`scripts/verifica-saga-xml.mjs`** — 63 de verificări ale generatorului, fără bază (73 după proba din 11 noiembrie 2026).
- Testele pașilor 4 și 5 aleg acum doar comenzi nemarcate ca facturate; testul pasului 5
  acceptă amprenta lui `emite_factura` din 50 SAU 51.
- **Local** (`scripts/verifica-saga-local.sh`, extins cu 51): migrările 47–51 rulate de două
  ori; testele 33 / 15 / 41 / 13 / 16; concurența, ora-limită, ștergerea, garda anulării — toate ok.
  Separat: toate migrările lipite cu CRLF (ca din SQL Editor pe Windows) → ok, inclusiv a doua
  rulare a lui 51; o factură emisă în baza locală, scoasă ca JSON (forma pe care o primește
  pagina) și trecută prin generator → XML corect („PAP FE 14193”, „10-11-2026”, 289.2600 /
  289.26 / 60.74, articolul, codul intern, firma cu persoana de contact); anularea lui 51 →
  `emite_factura_ca_in_50 = true`.
- Lecții din probă: (1) testul pasului 5 cerea strict amprenta din 50 — acum acceptă 50 sau 51;
  (2) prima variantă a testului nou încerca emiterea după oprire pe o comandă care avea deja
  factură, deci refuzul venea din alt motiv — corectat (se retrage întâi factura comenzii).

**Neverificat de asistent**: interfața în browser (cere autentificare, iar emiterea scrie pe
producție). Verifică proprietarul, cu procedura de mai jos.

`npm run build`: „Compiled successfully”, cu `/admin/facturi/[id]` în listă. Serverul local
era oprit înainte de build.

#### Fișiere

- create: `supabase/saga-emitere.sql`, `scripts/verifica-saga-emitere.sql`,
  `scripts/anuleaza-saga-emitere.sql`, `lib/saga-xml.mjs`, `scripts/verifica-saga-xml.mjs`,
  `components/admin/FacturaSaga.tsx`, `app/admin/facturi/[id]/page.tsx`
- modificate: `app/admin/comenzi/[id]/page.tsx`, `app/admin/facturi/page.tsx`,
  `app/admin/facturi/setari/page.tsx`, `app/admin/integrari/page.tsx`, `lib/settings.ts`,
  `scripts/verifica-saga-facturi.sql`, `scripts/verifica-saga-articole.sql`,
  `scripts/verifica-saga-local.sh`, `scripts/baza-test.sh`, `CLAUDE.md`, `docs/saga-plan.md`

#### Cum se aplică — pe PRODUCȚIE, din SQL Editor

**1. Pre-verificarea (doar citire)** — toate coloanele `true`:
```sql
select
  (select md5(replace(prosrc, E'\r', '')) from pg_proc where oid = 'public.emite_factura(bigint)'::regprocedure)
    = '8eefb50d4c81c4ea93701317e9ac67ed'                                  as emite_factura_ca_in_50,
  to_regprocedure('public.modifica_factura(bigint, jsonb, jsonb)') is null  as modifica_nu_exista,
  to_regprocedure('public.opreste_emiterea()') is null                       as opreste_nu_exista,
  (select count(*) from public.facturi) = 0                                  as nicio_factura_emisa,
  not exists (select 1 from public.facturi_serii where activa)               as nicio_serie_activa;
```

**2. Migrarea**: `supabase/saga-emitere.sql` → „Success. No rows returned”.

**3. Testele** — fiecare cu „REZULTAT OK” în căsuța roșie:
`scripts/verifica-saga-emitere.sql` (16), `scripts/verifica-saga-articole.sql` (13),
`scripts/verifica-saga-facturi.sql` (41).

**4. Verificarea că n-a rămas nimic** — toate 0:
```sql
select (select count(*) from facturi) as facturi, (select count(*) from facturi_serii) as serii,
       (select count(*) from saga_articole) as potriviri;
```

**5. Paginile** (serverul local OPRIT, apoi `npm run build && npm start`): pagina unei comenzi
→ cardul „Facturare (Saga)” arată câmpul manual și motivul („Data de start a facturării din
aplicație nu e setată …”); Facturi → secțiunea „Facturi emise din aplicație” goală; Integrări →
cardul Saga cu câmpurile noi; Setări serie fără butonul de oprire (nicio serie activă).

**6. Doar la nevoie — anularea**: `scripts/anuleaza-saga-emitere.sql`.

#### Cum se testează emiterea unei facturi FĂRĂ să se consume un număr real de pe PAP FE

**Varianta 1 — fără interfață, deja făcută**: testele SQL de la pașii 4–6 emit, corectează,
retrag și opresc pe o serie „TEST …” unică, totul anulat. Seria PAP FE nu e atinsă.

**Varianta 2 — prin interfață, cap-coadă, cu serie de PROBĂ** (pe serverul local, care scrie în
producție; durează câteva minute; în acest interval nimeni altcineva nu emite):
1. **Facturi → Setări serie**: seria **„PROBA”** (NU „PAP FE”), numărul următor **1**. Bifa va
   spune „… ultima factură emisă manual în SAGA pe PROBA are numărul 0 …” — e corect pentru o
   serie de probă. Salvează.
2. **Integrări → Saga** (reîncarcă pagina întâi): data de start = data unei comenzi recente,
   NEFACTURATE manual (de ex. una de azi); codul și denumirea articolului implicit (dacă
   contabila n-a dat încă codul: „PROBA” / „ACCESORII AUTO”). Salvează.
3. Pagina comenzii alese → **„Emite factura”** → „Factura PROBA 1 a fost emisă”.
4. **„Deschide factura”**: verifici clientul, liniile, totalul (= totalul comenzii, fără
   transportul încasat de FAN); încerci **„Modifică”**; **„Descarcă XML”** cu formatele de
   probă alese pe loc (`serie_spatiu`, `zi-luna-an`, TVA la încasare după contabilă).
5. Opțional, **proba din SAGA (D.4)**: XML-ul se încarcă MANUAL în SAGA WEB, la Diverse →
   Import date, **FĂRĂ validare** — vezi cum apar numărul, data, diacriticele, articolul — apoi
   **se șterge din lista de import, nevalidat**. Seria „PROBA” nu există în SAGA, deci nu
   atinge numerotarea PAP FE. Fă proba doar împreună cu contabila.
6. **„Retrage”** (pe pagina facturii) → factura dispare, comanda revine la „De emis”, contorul
   seriei PROBA revine la 1.
7. **Setări serie → „Oprește emiterea”** → nicio serie activă.
8. **Integrări → Saga**: golești data de start (și articolul de probă, dacă l-ai pus). Salvează.
9. Verificare în SQL Editor (doar citire) — toate 0, cu excepția rândurilor PROBA din serii și
   istoric, care rămân ca urmă a probei:
   ```sql
   select (select count(*) from facturi) as facturi,
          (select count(*) from facturi_serii where activa) as serii_active,
          (select count(*) from orders where factura_serie like 'PROBA%') as comenzi_marcate;
   ```
PAP FE nu e atinsă în niciun pas: numerele ei se setează abia în ziua pornirii.

#### Următorul

Pasul 7 — clientul API SAGA (`saga_cheie`, `saga_blocare`, `saga_trimiteri`, `lib/saga.ts`,
„Testează conexiunea” și „Salvează cheia”). Direct pe contul real, fără instanță de test (riscul 5).
Începe doar după confirmare. **Confirmat la 11 noiembrie 2026 — vezi pasul 7.**

### Pasul 7 — clientul API SAGA, pe contul REAL (migrarea 52)

**Stare: migrarea 52 e RULATĂ pe producție la 11 noiembrie 2026**, de proprietar, din SQL Editor:
- pre-verificarea: 5 × `true`;
- `supabase/saga-api.sql` → „Success. No rows returned.”;
- `scripts/verifica-saga-api.sql` → „REZULTAT OK: toate cele 33 verificări au trecut”;
- verificarea finală: `0 | 0 | 1 | true` (nicio cheie, niciun apel, lacătul liber).

Codul pasului 7 împins pe ramura `saga-integrare` în aceeași zi (commit `8aff9e8`, nu pe `main`).
Preview-ul s-a reconstruit („Deployment has completed”):
**https://autopas-xjkco6200-alexandruolteanuus-projects.vercel.app**
- e protejat de Vercel Authentication: din afară redirecționează spre login-ul Vercel (pagina 302,
  ruta 401), deci asistentul NU a putut verifica în el pasul 7. Proprietarul intră logat în Vercel,
  apoi în adminul site-ului, ca de obicei;
- adresa se schimbă la fiecare push: cea nouă e în Vercel → `autopas` → Deployments → filtrul
  `saga-integrare` → **Visit**. Adresa fixă a ramurii (arată mereu ultimul deployment): Vercel →
  Deployments → deployment-ul → „Domains”.

**Urmează, la proprietar** (din preview sau local, nu din adminul live):
1. Integrări → **reîncarcă pagina** → cardul „Saga — facturare” → „Cheia SAGA”;
2. lipește cheia → „Salvează cheia” → „Testează conexiunea” → așteptat „✓ Conectat la SAGA …”;
3. un mesaj despre codul fiscal = riscul 9 (SAGA vrea probabil codul fără „RO”).

**Pasul 8 NU a început.**

#### Verificarea pe contul REAL, din preview (11 noiembrie 2026, raportată de proprietar)

- cheia reală salvată din admin; „Testează conexiunea” → conectat, cheia acceptată;
- **SAGA a rotit cheia la primul apel, iar cea nouă s-a salvat automat** — rotirea, probată pe viu;
- **riscul 9 închis**: `X-Saga-Cod-Fiscal` = „RO36608590” e acceptat;
- primul test a avertizat că articolul „PROBA” nu există (rămăsese de la proba pasului 6); codul real
  pus în Integrări: **1457070043**, „ACCESORII AUTO”, BUC. Rezultatul celui de-al doilea test: **nereportat**
  (în mesaj a rămas „[rezultat]”);
- `mentiune_plata` = „ramburs in cont”, setată;
- **din nomenclatorul SAGA**: articolul 1457070043 are TVA 19, tip Mărfuri, stoc curent 516 —
  riscul nou 10 (cota din fișă vs. `ProcTVA`) și indiciul la întrebarea 5 (gestiune). Amândouă sunt
  verificări obligatorii la prima probă de import pe seria PROBA.

#### Înainte de pas (11 noiembrie 2026)

- **Push-ul ramurii `saga-integrare` pe GitHub, CU preview Vercel**, fără unire în `main` (decizia
  proprietarului). Preview-ul s-a construit („Deployment has completed”). Regula nouă în CLAUDE.md:
  până la unire, tot ce ține de SAGA, date firmă și facturi se face DOAR din preview sau local.
- **Decizia: fără instanță de test SAGA.** Cheia REALĂ (generată de proprietar, păstrată de el) se
  introduce doar din admin; planul actualizat la riscul 5, A.10, D.5, pașii 7–8 din C și în lista de sus.

#### Ce modifică din ce există (răspuns dat înainte de cod)

- **În bază (migrarea 52, `supabase/saga-api.sql`), doar obiecte NOI**: `saga_cheie` (RLS, nicio
  politică), `saga_blocare` (un rând, lacătul), `saga_trimiteri` (jurnalul; citire `is_facturare()`),
  funcțiile `saga_ia_blocarea`, `saga_elibereaza`, `saga_salveaza_cheia`, `saga_roteste_cheia` — doar
  `service_role`. Nu înlocuiește nicio funcție, nu atinge niciun rând și nicio politică existentă.
- **În cod, doar adăugiri**: `lib/supabase.ts` — `esteFacturare` / `esteAdmin` lângă `esteEchipa`
  (neatinsă); `lib/settings.ts` — câmpul `url_api`; Integrări → cardul Saga — câmpul „Adresa
  API-ului SAGA” (verificat https la salvare) și caseta „Cheia SAGA”. Celelalte carduri, neschimbate.
- **Nicio cale de Import** în pasul 7.

#### Ce s-a făcut

- **`lib/saga-api.mjs` — SINGURUL loc care folosește și rotește cheia** (`cere()`):
  - lacătul din bază înainte de orice apel; al doilea apel simultan e refuzat („o operație SAGA e
    deja în curs”), nu pus în paralel; lacătul se eliberează în `finally`, iar termenul de 90 s îl
    eliberează și dacă funcția e omorâtă;
  - antetele `Authorization: Bearer <cheie>` și `X-Saga-Cod-Fiscal` (CIF-ul curățat din Date firmă);
  - **rotirea**: `X-Saga-Refresh-Token` se citește imediat după antete și se salvează ÎNAINTE de corp,
    la orice cod de răspuns, condiționat de cheia veche (`saga_roteste_cheia`), cu 3 încercări. Dacă
    tot nu se salvează: eroare „cheie nouă primită, dar nesalvată”, cheia marcată, mesaj de regenerare;
  - **401 / 403** → cheia marcată blocată; mesajul: „Generați o cheie nouă din SAGA WEB (Utilizatori →
    Integrare API → Generează cheie de acces), apoi salvați-o aici, cu „Salvează cheia”.” Aplicația nu
    încearcă nimic singură;
  - timeout 25 s; fiecare apel scris în `saga_trimiteri` (tip, HTTP, durată, rotire, eroare, corpul
    răspunsului cu orice apariție a cheii înlocuită cu „[cheie ascunsă]”); jurnalul căzut nu strică apelul;
  - `getArticol(cod)`: 200 → articolul (denumire, UM, TVA, coduri); 400 → „cod inexistent”, nu eroare;
  - `testeazaConexiunea()`: DOAR `GetArticol` — pe articolul implicit, sau, dacă nu e setat, pe un cod
    inexistent („AUTOPAS-TEST-CONEXIUNE”), al cărui 400 tot dovedește că cheia e acceptată;
  - `salveazaCheia()`: validare (≥ 10 caractere, fără spații) și scriere SUB LACĂT, ca un apel în curs
    să nu rotească cheia veche peste cea nouă.
- **`lib/saga.ts`** — doar depozitul real (RPC-urile și tabelele din 52) și starea pentru panou (fără cheie).
  Cheia se trimite la bază în CORPUL cererii (RPC), nu în adresă, ca să nu rămână în jurnalele de acces.
- **`app/api/saga/route.ts`** — `stare` (admin, contabil), `salveaza-cheie` (doar admin),
  `testeaza-conexiunea` (admin, contabil). Niciun răspuns nu conține cheia.
- **Integrări → Saga**: caseta „Cheia SAGA” — starea (salvată / rotită de câte ori / folosită ultima dată
  / blocată, cu mesajul de regenerare), câmpul parolă care nu se precompletează niciodată, „Salvează
  cheia” (cu confirmare dacă înlocuiește una), „Testează conexiunea”, ultimele 5 apeluri.
- **Teste:**
  - `scripts/verifica-saga-api.mjs` — **59/59**, pe un SAGA SIMULAT pe 127.0.0.1, fără cheia reală:
    antetele, calea, 200 / 400 / 401 / 403 / 422, rotirea înainte de corp (măsurat pe un corp întârziat)
    și pe erori, cheia nouă folosită la apelul următor, rotirea nesalvată, două apeluri simultane (unul
    singur ajunge la SAGA), lacăt expirat, timeout, port închis, fără cheie / fără CIF (niciun apel),
    „Testează conexiunea” fără Import, salvarea sub lacăt, cheia absentă din jurnal și din erori, plus
    verificări statice (nicio cale „/Import”, nicio cheie SAGA din variabile de mediu, rotirea doar în
    `lib/saga-api.mjs`). Verificat că pică dacă rotirea se mută după corp sau dacă se scoate lacătul;
  - `scripts/verifica-saga-api.sql` — 33 de verificări pe PRODUCȚIE, în tranzacție anulată: RLS, zero
    politici pe cheie / lacăt, drepturile `anon` / `authenticated` pe tabele și funcții, lacătul (luat,
    refuzat, eliberat doar de deținător, expirat, ~90 s), salvarea și rotirea condiționată cu o cheie de
    PROBĂ, cheile greșite, adminul din browser NU citește cheia și NU scrie în jurnal, dar vede jurnalul;
    un utilizator fără rol nu-l vede;
  - `scripts/verifica-saga-local.sh` (Docker): 52 aplicată de două ori, testul SQL 33/33, **20 de
    `saga_ia_blocarea` simultane → exact una reușește**, anularea 52 șterge tot și re-rularea o reface;
    toate testele 47–51 trec în continuare;
  - build-ul trece; ruta, pe build-ul local, refuză fără sesiune (401) toate cele trei acțiuni.
  - **NEverificat**: interfața în browser și apelul real la SAGA — cer migrarea 52 și cheia reală.

#### Fișiere

Noi: `supabase/saga-api.sql`, `lib/saga-api.mjs`, `lib/saga.ts`, `app/api/saga/route.ts`,
`scripts/verifica-saga-api.mjs`, `scripts/verifica-saga-api.sql`, `scripts/anuleaza-saga-api.sql`.
Modificate: `lib/supabase.ts`, `lib/settings.ts`, `app/admin/integrari/page.tsx`,
`scripts/verifica-saga-local.sh`, `CLAUDE.md`, `docs/saga-plan.md`.

#### Cum se aplică — pe PRODUCȚIE, din SQL Editor (proprietarul)

1. **Pre-verificarea** (doar citire) — 5 × `true`:
   ```sql
   select to_regprocedure('public.is_facturare()') is not null as are_is_facturare,
          to_regclass('public.saga_cheie')     is null as fara_saga_cheie,
          to_regclass('public.saga_blocare')   is null as fara_saga_blocare,
          to_regclass('public.saga_trimiteri') is null as fara_saga_trimiteri,
          not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace
                       and proname in ('saga_ia_blocarea', 'saga_elibereaza', 'saga_salveaza_cheia', 'saga_roteste_cheia')) as fara_functii;
   ```
2. **Migrarea**: `supabase/saga-api.sql` → „Success. No rows returned.”
3. **Testele**: `scripts/verifica-saga-api.sql` → căsuța roșie „REZULTAT OK: toate cele 33 verificări
   au trecut”.
4. **Verificarea finală** (doar citire) — `0 | 0 | 1 | true`:
   ```sql
   select (select count(*) from saga_cheie) as chei, (select count(*) from saga_trimiteri) as apeluri,
          (select count(*) from saga_blocare) as lacate, (select pana < now() from saga_blocare) as lacat_liber;
   ```
5. **Cheia** — din PREVIEW sau din serverul local (nu din adminul live), ca administrator:
   Integrări → **reîncarcă pagina** → cardul „Saga — facturare” → „Cheia SAGA” → lipești cheia →
   „Salvează cheia” → „Testează conexiunea”. Așteptat: „✓ Conectat la SAGA …”. Dacă articolul implicit
   e completat, mesajul spune și dacă există în gestiunea SAGA. Un eșec cu un mesaj despre codul fiscal
   → riscul 9. Un 401 / 403 → cheia se regenerează din SAGA WEB și se salvează din nou.
6. **Doar la nevoie — anularea**: `scripts/anuleaza-saga-api.sql`.

#### Adresa preview-ului (11 noiembrie 2026)

Vercel → proiectul `autopas` → **Deployments** → filtrul de ramură `saga-integrare` → ultimul
deployment → **Visit**. Sau pe GitHub, la commit-ul de pe ramură: bifa / linkul „Vercel” de lângă el.
Preview-ul scrie în baza REALĂ (o singură bază Supabase) — regula din CLAUDE.md: până la unire, tot ce
ține de SAGA, date firmă și facturi se face doar din preview sau local.

#### Raportul trimis proprietarului (11 noiembrie 2026)

- push-ul ramurii făcut, preview construit; `main` neatins; regula „doar din preview sau local” în CLAUDE.md;
- decizia „fără instanță de test” trecută în riscul 5, A.10, D.5, pașii 7–8 și lista de sus; în
  `docs/saga-api.md` corectate „testare pe instanța de test” și „serie separată”;
- pasul 7 scris: un singur loc care folosește și rotește cheia (`lib/saga-api.mjs`), lacăt, rotirea
  înainte de corp, 401 / 403 → mesajul de regenerare; cheia doar prin „Salvează cheia”, invizibilă din
  browser; „Testează conexiunea” doar `GetArticol`;
- teste: 59/59 pe SAGA simulat (care pică dacă rotirea se mută după corp sau dacă dispare lacătul),
  33 SQL pentru producție, Docker (lacătul sub 20 de cereri simultane; 47–51 trec în continuare),
  build-ul, ruta refuză fără sesiune; NEverificate: interfața în browser și primul apel real;
- riscul 9: codul fiscal din antet („RO36608590”), nedovedit;
- **migrarea 52 NErulată; pasul 7 doar local (`58aa002`)** — de ales: push pe ramură sau întâi proba locală.
- Incident mărunt la proba rutei: `pgrep -f "next-server"` a găsit chiar comanda care îl căuta și a
  oprit-o, iar serverul de probă a rămas pornit; oprit apoi după PID. **Regula: `pgrep -a next-server`
  (fără `-f`), apoi `kill <PID>`.**

#### Următorul

Pasul 8 — trimiterea („Trimite în SAGA”), probată pe seria PROBA cu `importAutomat=false`, împreună cu
contabila. Începe doar după confirmare, după ce „Testează conexiunea” a trecut pe contul real și după
ce sunt alese `format_numar` și `format_data`. **Confirmat la 11 noiembrie 2026 — vezi pasul 8.**

### Pasul 8 — trimiterea în SAGA (fără migrare nouă)

**Stare: cod scris și testat local (11 noiembrie 2026); fără migrare; commit local, NEîmpins.** Prima
probă de import pe contul real NU s-a făcut. Pasul 9 NU a început.

#### Deciziile proprietarului (11 noiembrie 2026)

- `format_numar` = **serie_spatiu**, `format_data` = **zi-luna-an** — se confirmă la prima probă de import
  pe seria PROBA;
- `tva_la_incasare` = **NEDECIS** (în mesaj a rămas „[Nu / Da]”). Fără el, trimiterea e blocată;
- setarea nouă **`import_automat`** (oprită implicit): pornită, trimiterea folosește `importAutomat=true`.
  Rămâne oprită la primele facturi reale.

#### Ce modifică din ce există (răspuns dat înainte de cod)

- **Baza: nimic.** Folosește coloanele existente (`saga_status`, `saga_eroare`, `saga_trimisa_la`,
  `confirmata_*`) și jurnalul `saga_trimiteri` (tipul „import” exista). Starea o scrie doar serverul;
  triggerul `facturi_pazeste` din 49, neatins, decide în continuare ce trecere e permisă.
- `lib/saga-api.mjs`: `importaFacturi` — singurul loc cu calea „/Import”, prin același `cere()` (lacăt,
  rotire). `lib/saga-xml.mjs`: `parseazaRaport`, `stareDupaImport`, `acelasiNumar` — cele vechi neschimbate.
- Nou: `lib/saga-trimitere.mjs`; ruta `/api/saga` — acțiunile `trimite` și `confirma`.
- Pagina facturii: „Trimite în SAGA” / „Reîncearcă”, „Marchează confirmată”, jurnalul trimiterilor.
  Lista din Facturi: bife + „Trimite selectate” (pe rând, câte una).
- Integrări → Saga: câmpul `import_automat` ca TEXT da / nu (gol = nu), nu bifă — bifele de acolo
  pornesc BIFATE când valoarea lipsește, iar importul automat s-ar fi pornit singur la prima salvare.

#### Ce s-a făcut

- **O factură = un fișier = un apel.** „Trimite selectate” cheamă ruta de mai multe ori, din browser:
  fiecare apel încape în 60 s, iar un răspuns privește o singură factură. Se oprește singur la cheie
  respinsă, setări lipsă sau cheie lipsă.
- **`trimiteFactura`** (`lib/saga-trimitere.mjs`), în ordinea care dă siguranța:
  1. setările obligatorii (`format_numar`, `format_data`, `tva_la_incasare`; `import_automat` doar da / nu /
     gol) — lipsă = nimic atins, niciun apel;
  2. XML-ul și numele fișierului construite ÎNAINTE de a atinge factura (o factură fără linii nu pleacă);
  3. **revendicarea atomică**: `in_curs` doar dacă starea e încă cea citită (pentru un `in_curs` uitat —
     peste 3 minute, peste termenul lacătului — și `updated_at` neschimbat). Două tab-uri sau un tab
     rămas în urmă nu pot trimite aceeași factură de două ori;
  4. importul (`importAutomat` din setare);
  5. starea: lacăt ocupat / fără cheie / cheie respinsă (401/403) → factura REVINE unde era, cu motivul
     scris; timeout / rețea / rotire pierdută → „eroare”, „Rezultat necunoscut … La «Reîncearcă», SAGA
     spune singur dacă o are deja”; altfel `stareDupaImport`.
- **`stareDupaImport`** (o factură pe fișier; regula riscului 3 — niciodată „trimisă” din oficiu):
  200 → „trimisă” (cu `import_automat` → „confirmată”, cu cine și când); 400 → „eroare” cu mesajul SAGA;
  422 → „eroare” cu mesajele facturii, DAR „importata sau operata manual deja” → „trimisă” (SAGA o are);
  207 → „trimisă” cu avertizările scrise, doar dacă raportul numește factura și fără „Eroare” — și cu import
  automat rămâne „trimisă”, ca un om să vadă avertizările; raport care nu numește factura → „eroare”.
  `NR_DOC` se compară fără spații („PROBA1” = „PROBA 1”).
- **„Marchează confirmată”** — doar din „trimisă” (`update … where saga_status = 'trimisa'`), cu întrebarea
  „ai validat în SAGA și arată corect — seria, numărul, clientul, liniile, cota și TVA-ul, totalul?”.
- Pagina facturii: nota SAGA pe „trimisă” apare galbenă (avertizare), nu roșie; „in_curs” explică ce faci
  dacă rămâne așa peste 3 minute; jurnalul cu raportul SAGA întreg.
- **Teste:**
  - `verifica-saga-xml.mjs` — **95/95** (+22): raportul din documentație, CRLF, potrivirea numerelor,
    fiecare cod de răspuns (200, 200 fără succes, 400, 422, dubluri, 207 cu avertizare / cu eroare / fără
    factura noastră / gol, 500). Testul a prins o greșeală reală: expresia pentru „importata … deja” nu
    recunoștea „importata” — corectată;
  - `verifica-saga-api.mjs` — **99/99** (+40), cap-coadă pe SAGA-ul simulat: setările lipsă (niciun apel),
    multipart-ul (`file` cu numele F_RO36608590_PROBA_1_10_11_2026.xml, `importAutomat` false / true),
    XML-ul („PROBA 1”, „10-11-2026”, „Nu”, 1457070043, cota 21), cheia doar în antet, 200 / import automat /
    422 / reîncercare cu dublură / timeout / 401 și lacăt ocupat (revenire) / „in_curs” recent și uitat /
    două trimiteri simultane / tab rămas în urmă / fără linii, jurnalul (fișier, factura, XML, fără cheie),
    „/Import” o singură dată în tot codul. Verificat că pică fără revendicare și fără revenirea stării;
  - `verifica-saga-local.sh` (Docker): trecerile folosite de trimitere, pe triggerul REAL din 49 — de_trimis /
    eroare ⇄ in_curs → trimisă → confirmată permise; conținutul nu se schimbă în `in_curs`; trimisă → eroare /
    in_curs și confirmată → înapoi refuzate; toate verificările mai vechi trec;
  - build-ul trece; ruta, pe build-ul local, refuză `trimite` și `confirma` fără sesiune.
  - **NEverificat**: interfața în browser și primul import real.

#### Fișiere

Nou: `lib/saga-trimitere.mjs`. Modificate: `lib/saga-api.mjs`, `lib/saga-xml.mjs`, `lib/saga.ts`,
`app/api/saga/route.ts`, `app/admin/facturi/[id]/page.tsx`, `app/admin/facturi/page.tsx`,
`app/admin/integrari/page.tsx`, `lib/settings.ts`, `scripts/verifica-saga-xml.mjs`,
`scripts/verifica-saga-api.mjs`, `scripts/verifica-saga-local.sh`, `CLAUDE.md`, `docs/saga-plan.md`.

#### Cum se verifică — prima probă de import pe contul REAL (cu contabila)

Nicio migrare. După push-ul pe ramură, din PREVIEW (nu din adminul live), în câteva minute în care
nimeni altcineva nu emite:
1. **Integrări → Saga** (reîncarcă întâi): `format_numar` = serie_spatiu, `format_data` = zi-luna-an,
   `tva_la_incasare` = da / nu (de la contabilă), `import_automat` gol. Salvează.
2. **Facturi → Setări serie**: seria **„PROBA”**, numărul următor **1** (NU „PAP FE”). Integrări → Saga:
   data de start = data comenzii alese.
   **⚠ DECIZIE ÎNAINTEA PROBEI — ce comandă:** spre deosebire de proba de la pasul 6, o factură PROBA
   TRIMISĂ nu se mai retrage (triggerul din 49). Ea rămâne legată definitiv de comanda pe care a fost
   emisă: comanda nu se mai poate șterge, nu mai poate primi altă factură din aplicație, iar câmpul manual
   de serie e blocat pe ea — adică factura ei reală, emisă manual în SAGA, nu se mai poate nota în
   aplicație. Variante: (a) o comandă de probă a proprietarului (fără client real); (b) o comandă reală
   deja rezolvată, acceptând că nota manuală nu se mai poate scrie pe ea; (c) o schimbare de cod înainte
   de probă (de exemplu stornarea / ascunderea facturilor PROBA la pasul 10). De ales de proprietar.
3. Pagina comenzii → „Emite factura” → „Deschide factura” → **„Trimite în SAGA”**. Așteptat: „Încărcată în
   SAGA — valideaz-o în SAGA WEB …”. Jurnalul trimiterilor arată HTTP-ul și raportul.
4. **În SAGA WEB, Diverse → Import date, FĂRĂ validare**, cu contabila — verificările OBLIGATORII (3c):
   numărul „PROBA 1” și data zi-lună-an; **cota 21% și TVA-ul** pe factura importată (nu 19 din fișa
   articolului — riscul 10); dacă SAGA cere `Gestiune` pe linii (întrebarea 5); diacriticele; ce număr
   propune SAGA apoi pentru PAP FE (riscul 7). Apoi contabila **șterge importul nevalidat**.
5. Opțional, a doua apăsare (după ce factura e „trimisă” nu se mai poate; se probează pe altă factură
   PROBA): dacă SAGA răspunde „importata … deja” la o retrimitere (riscul 2).
6. Curățenie: factura PROBA rămâne în aplicație „trimisă” (nu se mai retrage — e corect: a plecat). Ea NU
   se marchează „confirmată” (n-a fost validată). Setări serie → „Oprește emiterea”; golești data de start.
   **O factură PROBA trimisă rămâne în listă ca urmă a probei** — de discutat dacă se ascund sau se
   stornează la pasul 10.

#### Raportul trimis proprietarului (11 noiembrie 2026)

- **Înainte de pas**: verificarea de pe contul real notată în jurnalul pasului 7 și în CLAUDE.md (cheia
  acceptată, rotirea pe viu, riscul 9 închis, articolul 1457070043, mențiunea de plată); riscul 10 deschis
  (TVA 19 în fișa articolului) și verificările obligatorii la prima probă (cota și TVA-ul, `Gestiune`); pe
  ramură, commit `dd29e2a`. Două valori lipseau din mesaj: rezultatul celui de-al doilea test („[rezultat]”)
  și „TVA la încasare” („[Nu / Da]”) — fără al doilea, trimiterea rămâne blocată.
- **Pasul 8**: fără migrare; starea facturii o scrie doar serverul, triggerul din 49 decide trecerile.
  „Trimite în SAGA” / „Reîncearcă”, „Trimite selectate” (pe rând, câte una pe fișier), blocate până sunt
  salvate formatele și „TVA la încasare”. Aceeași factură nu pleacă de două ori (nici din două tab-uri, nici
  dintr-un tab rămas în urmă); cheie refuzată sau lacăt ocupat → factura revine unde era; timeout → „eroare /
  rezultat necunoscut”, iar la reîncercare SAGA spune „importata … deja”. „Trimisă” doar când răspunsul o
  spune limpede. „Marchează confirmată” după validarea în SAGA; jurnalul cu raportul întreg pe pagina
  facturii. `import_automat` = text da / nu, gol = nu.
- **Teste**: 95 XML (au prins o greșeală reală: „importata … deja” nu era recunoscut — corectată); 99 cap-coadă
  pe SAGA simulat, care pică fără revendicare sau fără revenirea stării (prima variantă nu prindea lipsa
  revendicării — s-a adăugat cazul „tab rămas în urmă”, care o prinde); în Docker, trecerile pe triggerul
  real; build-ul; ruta refuză fără sesiune. NEverificate: interfața în browser și primul import real.
- **De decis înaintea primei probe**: o factură PROBA trimisă nu se mai retrage (spre deosebire de proba de
  la pasul 6) și rămâne legată definitiv de comanda ei — pe acea comandă nu se mai poate nota în aplicație
  factura manuală din SAGA. Variante (a) / (b) / (c) — la „Cum se verifică”, pasul 2.
- **Așteptat de la proprietar**: „TVA la încasare”; comanda pentru probă; push-ul pasului 8 pe ramură
  (`a3a71ee`), ca preview-ul să-l aibă.

#### Prima probă de import pe contul REAL — REUȘITĂ (11 noiembrie 2026, din preview)

- **Comanda de probă AP-2026-01809** (Alex Olteanu Test, 40 lei); factura **PROBA 1** emisă și trimisă cu
  „Trimite în SAGA”, `import_automat` gol. În aplicație: „Trimisă — așteaptă validarea în SAGA”.
- **Raportul SAGA: HTTP 207** — „NR_DOC: PROBA 1 — Avertizare detaliu 1: Pretul de vanzare este mai mic
  decat cel de achizitie.” Doar avertizare, din costul mediu al articolului ACCESORII AUTO (cu stoc).
  `stareDupaImport` a tratat-o exact cum trebuia: „trimisă”, cu avertizarea scrisă.
- **În SAGA, Ieșiri, factura importată (nevalidată)**: PROBA 1, data 11.11.2026, scadența 11.11.2026,
  clientul ALEX OLTEANU TEST (creat de SAGA, cod 18086), **33,06 + 6,94 = 40,00 → cota 21%** (riscul 10
  închis), mențiunea „ramburs in cont; Comanda AP-2026-01809”.
- **Confirmate**: `format_numar` = serie_spatiu (NR_DOC „PROBA 1”), `format_data` = zi-luna-an (riscul 6
  închis, întrebarea 1 închisă); SAGA NU a cerut `Gestiune` (întrebarea 5 închisă pentru acum).
- **Diacriticele: NEconfirmate** — în raport a rămas „[corecte / de verificat]”; riscul 8 rămâne deschis.
- **Curățenia**: importul anulat în SAGA, clientul de test șters, comanda anulată (stocul repus), emiterea
  oprită, data de start golită. În aplicație, factura PROBA 1 rămâne „trimisă” (nu se mai retrage) —
  ascunderea / stornarea, la pasul 10.
- **Numerotarea manuală pe PAP FE**: 14202 (11.11.2026, ~11:00); continuarea ar fi 14203.
- **„Testează conexiunea” cu 1457070043**: rezultatul tot nereportat („[rezultat]”).
- **De discutat**: SAGA a creat automat clientul — întrebarea 16 (dubluri, `GUID_cod_client`).

#### Răspunsurile proprietarului (11 noiembrie 2026)

1. **„TVA la încasare” = Nu** — firma nu aplică sistemul (mențiunea nu apare pe factura PAP FE 14188).
   Întrebarea 13 închisă. Se pune în Integrări → Saga, din preview: `tva_la_incasare` = `nu`.
2. **Comanda pentru prima probă de import = varianta (a)**: proprietarul plasează pe site o comandă de
   probă pe numele lui (fără client real), emite pe ea PROBA 1, o trimite în SAGA, apoi ANULEAZĂ comanda.
   Fără AWB.
   **Verificat în cod (11 noiembrie 2026) — anularea:** `anuleaza_comanda` (sursa actuală: migrarea 38,
   `piesa-vanduta-ramane.sql`; migrările SAGA 47–52 nu o ating) **nu se uită deloc la facturi**: anularea
   e PERMISĂ, fără niciun avertisment (nici în bază, nici în pagina comenzii), iar **stocul revine** —
   fiecare piesă primește înapoi `cantitate`. Cheia străină din 49 blochează doar ȘTERGEREA comenzii, nu
   anularea. După anulare, factura PROBA rămâne „trimisă”, legată de comanda anulată (până la pasul 10).
   Efecte secundare ale comenzii de probă, de știut înainte:
   - **dez.ro**: vânzarea pune piesa pe stoc 0 → coada automată (migrarea 39) RETRAGE anunțul la ei
     (ștergerea la ei nu se desface); anularea îl RECREEAZĂ ca anunț NOU, care trece din nou prin aprobarea
     lor. De preferat o piesă care NU e publicată pe dez.ro;
   - **pieseauto.ro**: dacă importul lor de noapte cade între plasare și anulare, piesa apare acolo cu
     cantitate 0 până la importul următor;
   - **e-mailurile automate** pleacă (confirmarea la adresa proprietarului, notificarea internă) — inofensiv;
   - **GA4 / Meta**: cu „Accept toate” în browser, `purchase` pleacă la mulțumire — o vânzare falsă în
     rapoarte; de evitat cu „Doar necesare” sau într-o fereastră privată.
3. **Al doilea „Testează conexiunea”, cu articolul 1457070043**: rezultatul **încă nereportat** (în mesaj a
   rămas „[scrie rezultatul]”).
4. **Push-ul pasului 8 pe ramură** — făcut (commit `08141f8`, nu pe `main`); preview-ul s-a reconstruit
   („Deployment has completed”): https://autopas-r1a65j3l0-alexandruolteanuus-projects.vercel.app
   (protejat de Vercel Authentication; adresa se schimbă la fiecare push).
5. **Pasul 10** — notat: facturile PROBA trimise trebuie să poată fi ascunse din listă sau stornate.

**Raportul trimis proprietarului (11 noiembrie 2026), pe scurt:**
- „TVA la încasare” = Nu — în plan (întrebarea 13 închisă) și în CLAUDE.md; în aplicație îl pune
  proprietarul, din preview (Integrări → Saga → `tva_la_incasare` = `nu`);
- anularea comenzii de probă: permisă, stocul revine; factura blochează doar ȘTERGEREA. **Nu apare niciun
  avertisment** la anularea unei comenzi cu factură — dacă se vrea unul, e o modificare separată
  (nedecisă); factura PROBA rămâne „trimisă”, legată de comanda anulată, până la pasul 10;
- efectele secundare ale comenzii de probă (dez.ro, pieseauto.ro, analytics, e-mailuri) — mai sus, la 2;
  pentru analytics: comanda se plasează cu „Doar necesare” sau dintr-o fereastră privată;
- rezultatul celui de-al doilea „Testează conexiunea” — încă lipsă;
- push făcut (`08141f8`), preview reconstruit; adresa notată aici printr-un commit local (`5367701`),
  neîmpins, ca adresa preview-ului să nu se schimbe din nou doar pentru o notă;
- pasul 10: cererea de ascundere / stornare a facturilor PROBA trimise — în lista de sus și în C.
- Pasul 9 NU a început.

#### Următorul

Pasul 9 — verificarea articolelor prin `GetArticol` în pagina de potrivire. Începe doar după confirmare
(și, de preferat, după prima probă de import).

### Pasul 9 — verificarea articolelor în SAGA (fără migrare)

**Stare: cod scris și testat local (11 noiembrie 2026); fără migrare; commit local, NEîmpins.** Pasul 10
NU a început.

#### Ce modifică din ce există (răspuns dat înainte de cod)

- **Baza: nimic.** Fiecare verificare se scrie singură în jurnalul existent `saga_trimiteri` (tip „get_articol”).
- `lib/saga-api.mjs`: funcția pură nouă `comparaArticol` (cod / denumire / UM de la noi vs. fișa din
  SAGA); `getArticol` neschimbat — același lacăt, aceeași rotire a cheii.
- Ruta `/api/saga`: acțiunea nouă `verifica-articol` (admin, contabil) — DOAR citire.
- Facturi → Articole SAGA: „Verifică în SAGA” pe implicit și pe fiecare categorie cu articol propriu,
  „Verifică toate” (pe rând, câte unul — lacătul), iar în formular „Verifică codul în SAGA” cu „Preia
  denumirea și UM din SAGA” (nimic nu se salvează fără „Salvează”). Salvarea, ștergerea și ordinea
  potrivirilor (subcategorie → categorie → implicit) — neatinse.

#### Ce s-a făcut

- **`comparaArticol`**: denumirea și UM comparate fără diacritice, spații multiple și majuscule; UM goală la
  noi = BUC; denumire goală (formular nou) nu e diferență. **Cota TVA din fișa SAGA e doar INFORMATIVĂ**
  („TVA în fișa din SAGA: 19% (factura poartă cota ei în XML)”) — la prima probă de import SAGA a aplicat
  cota din XML (riscul 10, închis).
- **`verifica-articol`** în rută: cere rolul de facturare, cheamă doar `getArticol`; răspunsul: există /
  nu există (cu mesajul SAGA) și, dacă există, denumirea, UM, TVA din fișă, diferențele.
- **Pagina**: ✓ (verde) potrivit; ⚠ (galben) diferă — cu ce diferă; ✗ (roșu) „codul NU există în
  gestiunea SAGA … verifică-l cu contabila”. „Verifică toate” ia implicitul plus fiecare cod propriu, o
  singură dată pe cod, și se oprește la o problemă de cheie. „Preia denumirea și UM din SAGA” apare când
  diferă sau când denumirea e încă goală.
- **Teste**: `verifica-saga-api.mjs` — **109/109** (+10: compararea — identic, majuscule / spații,
  diacritice, denumire diferită, UM diferită, UM goală, denumire goală, TVA doar informativ; ruta: rolul de
  facturare și doar `getArticol`); `verifica-saga-xml.mjs` 95/95; build-ul trece; pe build-ul local ruta
  refuză `verifica-articol` fără sesiune, iar pagina răspunde 200.
- **NEverificat**: interfața în browser și apelul real (cere preview-ul și contul real).

#### Fișiere

Modificate: `lib/saga-api.mjs`, `app/api/saga/route.ts`, `app/admin/facturi/articole/page.tsx`,
`scripts/verifica-saga-api.mjs`, `CLAUDE.md`, `docs/saga-plan.md`.

#### Cum se verifică (din preview, după push)

1. Facturi → **Articole SAGA** → la „Articolul implicit”, **„Verifică în SAGA”**. Așteptat: „✓ În SAGA:
   ACCESORII AUTO · BUC (TVA în fișa din SAGA: 19% …)”.
2. **„Verifică toate în SAGA”** — azi verifică doar implicitul (nicio categorie cu articol propriu).
3. Opțional: „Articol propriu” pe o categorie → scrii un cod greșit → „Verifică codul în SAGA” → „✗ … NU
   există”; apoi „Închide”, fără „Salvează” (nu rămâne nimic).
4. Jurnalul: fiecare verificare apare ca „get_articol” în Integrări → Saga → „Ultimele apeluri spre SAGA”.

#### Raportul trimis proprietarului (11 noiembrie 2026)

- **Proba de import, notată** în jurnalul pasului 8, în CLAUDE.md și în lista de sus; commit și push pe ramură
  (`ca141e0`). Închise: riscurile 6 (formatul numărului / datei) și 10 (cota 21% din XML), întrebările 1 și 5
  (pentru acum). Notate: ultimul număr manual PAP FE 14202 (continuarea 14203) și curățenia.
- **Riscul 8 (diacriticele) rămâne deschis**: în mesaj a rămas „[corecte / de verificat]”, iar clientul probei
  n-avea diacritice în nume — se verifică pe o factură cu „ă/î/ș/ț” în nume sau adresă.
- **„Testează conexiunea” cu 1457070043**: rezultatul tot lipsește („[rezultat]”).
- **Clienții creați automat de SAGA** (întrebarea 16, de discutat, neimplementat): nu știm dacă SAGA
  recunoaște singur clientul la a doua cumpărare (probabil după CUI la firme; la persoane fizice fără CNP,
  poate doar după nume — dubluri pentru același om scris altfel, amestec pentru doi „Ion Popescu”).
  `GUID_cod_client` ar da o cheie stabilă: din CUI la firme, dintr-o formă derivată din telefon la persoane
  fizice. Necunoscute: formatul cerut, ce face SAGA la același GUID cu alt nume / adresă, legătura cu
  clienții existenți din facturarea manuală. Propunere: întâi contabila (client per persoană sau generic),
  apoi o probă pe seria PROBA cu același client trimis de două ori (cu și fără GUID), apoi decizia.
- **Pasul 9**: baza neatinsă; patru fișiere de cod cu adăugiri (compararea, acțiunea din rută, butoanele din
  „Articole SAGA”, testele). „Verifică în SAGA” (implicit + fiecare articol propriu), „Verifică toate în
  SAGA” (pe rând), în formular „Verifică codul” + „Preia denumirea și UM din SAGA” (fără salvare automată).
  ✓ potrivit / ⚠ diferă / ✗ nu există; TVA din fișă doar informativ; doar citire, intră în jurnal.
  Teste: 109 pe SAGA simulat (+10), 95 XML, build-ul; ruta refuză fără sesiune, pagina se încarcă.
  NEverificate: interfața în browser și apelul real.
- **Întrebarea către proprietar**: push-ul pasului 9 pe ramură (commit `f94c80d`, local), ca să se poată
  verifica din preview.

#### Răspunsurile proprietarului (11 noiembrie 2026)

1. **Push-ul pasului 9** pe ramură — DA; făcut. Proprietarul verifică din preview „Verifică în SAGA” pe
   articolul implicit.
2. **„Testează conexiunea” cu 1457070043**: „Conectat la SAGA. Articolul „1457070043” există: ACCESORII AUTO
   (BUC, TVA 19%). SAGA a rotit cheia; cea nouă e salvată.” TVA 19% e doar în fișa articolului; la proba
   de import s-a aplicat 21% din XML.
3. **Diacriticele**: prima probă de import (pasul 8) nu le-a testat; se testează la proba pasului 10, cu un client cu
   ș/ț/ă/î în nume și adresă.
4. **Întrebarea 16**: câte un client separat în SAGA pentru fiecare persoană, ca la facturarea manuală.
   Propunerea (cum nu se dublează un client care revine — CUI la firme, `GUID_cod_client` din telefon la
   persoane fizice? — și proba pe seria PROBA, cu și fără GUID) vine în raportul pasului 10. NU se
   implementează încă.

#### Următorul

Pasul 10 — stornarea (`storneaza_factura` + butonul) și, cerut de proprietar, ascunderea / stornarea
facturilor PROBA trimise. Începe doar după confirmare.

### Pasul 10 — stornarea și ascunderea facturilor de probă (migrarea 53)

**Stare: migrarea 53 e RULATĂ pe producție la 11 noiembrie 2026**, de proprietar, din SQL Editor:
- pre-verificarea: 5 × `true`;
- `supabase/saga-stornare.sql` → „Success”;
- `scripts/verifica-saga-stornare.sql` → „REZULTAT OK”, 27/27;
- verificarea finală: `0 | 0` (nicio factură ascunsă, nicio stornare).

Codul pasului 10 împins pe ramura `saga-integrare` în aceeași zi (commit `a929a79`, nu pe `main`); preview
reconstruit („Deployment has completed”): https://autopas-k5ohacys3-alexandruolteanuus-projects.vercel.app
Urmează proba pasului 10 din preview, cu contabila. **Pasul 10b (refacturarea) și pasul 11 NU au început.**

#### Ce modifică din ce există (răspuns dat înainte de cod)

- **În bază (migrarea 53, `supabase/saga-stornare.sql`), doar obiecte NOI**: `storneaza_factura(id, motiv)`,
  `retrage_storno(id)`, `serie_de_proba(serie)`, tabela `facturi_ascunse` cu `ascunde_factura` /
  `reafiseaza_factura`. **Nu înlocuiește nicio funcție existentă și nu adaugă coloane** pe tabelele
  existente; triggerul de pază din 49 rămâne neatins și se aplică și stornărilor.
- **În cod**: pagina facturii („Stornează” cu motiv, legăturile factură ↔ storno, „Retrage” pe un storno →
  `retrage_storno`, „Ascunde / Arată din nou” pe seriile de probă); cardul din comandă (pe un storno,
  „Retrage” → `retrage_storno`, fiindcă `retrage_factura` îl refuză); lista din Facturi (ascunsele lipsesc
  implicit, bifa „Arată și facturile de probă ascunse”).
- **Limită semnalată, NEschimbată**: după stornare comanda e „stornata”, iar `emite_factura` (51) refuză
  comenzile care nu sunt „de_emis” — o comandă stornată NU primește o factură nouă din aplicație.
  Refacturarea ar cere rescrierea lui `emite_factura` (cu gardă de amprentă) — decizie separată.

#### Ce s-a făcut

- **`storneaza_factura`**: doar pe o factură „trimisă” sau „confirmată”, care nu e storno și n-are deja unul
  (factura blocată `for update`); numărul din ACEEAȘI serie (blocată, fără goluri — merge și pe o serie
  inactivă, cum e PROBA); liniile copiate cu cantitatea și sumele cu semn schimbat, prețul unitar neschimbat
  (totalul = exact opusul); clientul, furnizorul și mențiunea copiate de pe factură; observațiile „Stornare
  factura <serie> <număr> din <data>. Motiv: …”; comanda → „stornata”; rând în jurnalul comenzii. Stornoul
  pleacă în SAGA prin „Trimite în SAGA” (pasul 8), ca orice factură.
- **`retrage_storno`**: un storno NETRIMIS și ULTIMUL din serie se șterge, contorul dă înapoi, comanda revine
  la „emisă” cu seria facturii stornate.
- **Ascunderea**: doar pe seriile al căror nume începe cu „PROBA” sau „TEST” (`serie_de_proba`) — un document
  fiscal real nu poate dispărea din listă (se stornează). Nu se șterge nimic.
- **Teste:**
  - `scripts/verifica-saga-stornare.sql` — **27 de verificări pe PRODUCȚIE**, în tranzacție anulată, pe două
    serii cu nume unic (una „TEST …”, una „Z…” = serie „reală”): refuzul pe o factură netrimisă, antetul și
    numărul stornoului, contorul, totalurile opuse, copia clientului / furnizorului / mențiunii, observațiile,
    fiecare linie = opusul, comanda „stornata”, jurnalul comenzii, al doilea storno refuzat, `retrage_factura`
    refuză un storno, `retrage_storno` refuză o factură, retragerea stornoului (contor, comanda „emisă”),
    numărul refolosit, stornoul trimis nu se retrage / nu se stornează / nu se modifică, ascunderea pe probă
    (idempotentă) și reafișarea, refuzul ascunderii pe o serie reală, stornarea unei facturi confirmate,
    drepturile (utilizator fără rol, `anon`, citirea tabelei);
  - `verifica-saga-local.sh` (Docker): 53 aplicată de două ori, testul SQL 27/27, **aceeași factură
    stornată de două ori SIMULTAN → un singur storno, contorul +1**, anularea 53 șterge funcțiile și tabela
    dar lasă documentele, re-rularea o reface; toate testele mai vechi trec;
  - `verifica-saga-xml.mjs` — **102/102** (+7: XML-ul unui storno — număr nou, cantitate negativă, preț unitar
    pozitiv, valoare / TVA negative, reducerea pozitivă, trimiterea la factura stornată, numele fișierului);
    `verifica-saga-api.mjs` 109/109; build-ul trece.
  - **NEverificat**: interfața în browser și stornoul importat în SAGA.

#### Fișiere

Noi: `supabase/saga-stornare.sql`, `scripts/verifica-saga-stornare.sql`, `scripts/anuleaza-saga-stornare.sql`.
Modificate: `app/admin/facturi/[id]/page.tsx`, `app/admin/facturi/page.tsx`, `components/admin/FacturaSaga.tsx`,
`scripts/verifica-saga-xml.mjs`, `scripts/verifica-saga-local.sh`, `CLAUDE.md`, `docs/saga-plan.md`.

#### Cum se aplică — pe PRODUCȚIE, din SQL Editor (proprietarul)

1. **Pre-verificarea** (doar citire) — 5 × `true`:
   ```sql
   select to_regprocedure('public.is_facturare()') is not null           as are_is_facturare,
          to_regclass('public.facturi') is not null                      as are_facturi,
          to_regclass('public.facturi_ascunse') is null                  as fara_facturi_ascunse,
          to_regprocedure('public.storneaza_factura(bigint,text)') is null as fara_storneaza,
          to_regprocedure('public.retrage_storno(bigint)') is null        as fara_retrage_storno;
   ```
2. **Migrarea**: `supabase/saga-stornare.sql` → „Success. No rows returned.”
3. **Testele**: `scripts/verifica-saga-stornare.sql` → „REZULTAT OK: toate cele 27 verificări au trecut …”.
4. **Verificarea finală** (doar citire) — `0 | 0`:
   ```sql
   select (select count(*) from facturi_ascunse) as ascunse, (select count(*) from facturi where tip = 'storno') as stornari;
   ```
5. Apoi push pe ramură (la confirmare) — codul paginilor cheamă funcțiile din 53.
6. **Doar la nevoie — anularea**: `scripts/anuleaza-saga-stornare.sql` (lasă documentele emise).

#### Cum se verifică — proba pasului 10 pe contul REAL (cu contabila), din preview

Acoperă stornarea ȘI diacriticele (riscul 8).
1. O comandă de PROBĂ a proprietarului, cu **diacritice în nume și adresă** (de ex. „Ștefan Țăranu Test”,
   „Str. Mărășești nr. 1”, o localitate cu diacritice din listă); plasată cu „Doar necesare” sau dintr-o
   fereastră privată, pe o piesă care NU e pe dez.ro.
2. Facturi → Setări serie: seria **PROBA**, numărul următor **2** (1 e deja folosit — NU 1). Integrări →
   Saga: data de start = azi.
3. „Emite factura” → **PROBA 2** → „Trimite în SAGA”. În SAGA (Diverse → Import date, fără validare):
   **diacriticele** în numele clientului, adresă, localitate.
4. Pe PROBA 2 (acum „trimisă”): **„Stornează”** (motiv: „proba pasului 10”) → **PROBA 3** (storno) →
   „Trimite în SAGA”. În SAGA: PROBA 3 cu sumele negative, trimiterea „Stornare factura PROBA 2 din …”,
   același client (nu unul nou!).
5. Curățenia: contabila șterge importurile nevalidate și clientul de test; comanda se anulează; Setări serie →
   „Oprește emiterea”; data de start golită; PROBA 1, 2, 3 → „Ascunde din listă (probă)”.

#### Propunerea pentru clienții din SAGA (întrebarea 16) — NEIMPLEMENTATĂ

**Decizia proprietarului**: câte un client separat în SAGA pentru fiecare persoană, ca la facturarea manuală
(cei noi primesc coduri consecutive, cei care revin își păstrează codul).

**Ce știm**: la import, SAGA a creat singur clientul (cod 18086). Nu știm după ce îl recunoaște la a doua
factură. XML-ul are două câmpuri pentru asta: `GUID_cod_client` (cheia NOASTRĂ, „SAGA reține asocierea”) și
`Cod` (codul clientului DIN SAGA — îl știm doar pentru clienții pe care i-am văzut deja în SAGA).

**Propunerea:**
1. **Firme**: CUI-ul e cheia naturală — SAGA îl are în fișa clientului și, cel mai probabil, recunoaște firma
   după el. În plus, `GUID_cod_client` derivat din CUI-ul curățat (vezi 3), ca regula să fie una singură.
2. **Persoane fizice**: `GUID_cod_client` derivat din **telefonul normalizat** — cifrele, cu „+40” / „0040”
   aduse la „0”, ultimele 10 cifre („07xxxxxxxx”). Telefonul e obligatoriu la checkout și e mai stabil decât
   e-mailul (care lipsește uneori) sau numele (scris diferit de la o comandă la alta). Fără telefon valid →
   fără GUID (SAGA decide singur).
3. **Forma**: un GUID determinist (UUID versiunea 5) din „tel:07xxxxxxxx” / „cui:RO36608590”, cu un spațiu de
   nume fix al aplicației. Același telefon dă mereu același GUID; formatul e cel standard (8-4-4-4-12), deci
   merge și dacă SAGA cere un GUID adevărat; iar telefonul nu apare încă o dată, în clar, în alt câmp (e
   oricum în `ClientTelefon`). Un singur loc în cod (`lib/saga-xml.mjs`), testat ca restul.
4. **Ce nu rezolvă** (de spus contabilei): doi oameni pe același telefon (familie) → un singur client;
   același om cu alt telefon → doi clienți; **clienții existenți din facturarea manuală** nu au GUID-ul nostru,
   deci prima lor factură din aplicație poate crea un client nou — întrebare pentru suportul SAGA: cum se leagă
   un GUID de un client existent (sau trimitem `Cod`-ul lor, dacă contabila ni-l dă).
5. **Comenzile n-au cont de client** (`orders` fără `user_id`), deci cheia trebuie dedusă din comandă — de aici
   telefonul / CUI-ul, nu un id de utilizator.

**Proba, pe seria PROBA, ÎNAINTE de orice cod** — cu XML-uri descărcate („Descarcă XML”) și editate de mână,
importate MANUAL în SAGA WEB (Diverse → Import date), FĂRĂ validare, cu contabila; numere PROBA 101, 102…
(nu ating contorul aplicației), apoi importurile și clienții de test se șterg:
1. același client persoană fizică, **fără GUID**, de două ori (al doilea cu numele scris ușor diferit) → SAGA
   refolosește clientul sau creează unul nou? (comportamentul de azi);
2. același client **cu GUID** (calculat de noi), de două ori, al doilea cu numele scris diferit → același cod?
3. același GUID cu **adresa schimbată** → SAGA actualizează fișa sau păstrează datele vechi?
4. o **firmă** fără GUID, de două ori → recunoscută după CUI?
5. un client **existent** în SAGA (din facturarea manuală) cu `Cod`-ul lui → legat de cel existent?
Abia după rezultate: implementarea (un pas separat), cu testele ei.

#### Raportul trimis proprietarului (11 noiembrie 2026)

- Pasul 9 împins (`37fc01f`); preview: https://autopas-3qd8qn4kl-alexandruolteanuus-projects.vercel.app
- Răspunsurile din 11 noiembrie notate (testul de conexiune, diacriticele la pasul 10, decizia la întrebarea 16).
- Pasul 10: ce modifică (doar obiecte noi), ce face, testele (27 SQL pe producție, Docker cu stornarea
  simultană, 102 XML, 109 API, build), limita refacturării după storno, pașii de aplicare și proba.
- Propunerea pentru clienți și proba ei — mai sus.
- Neverificate: interfața în browser și stornoul importat în SAGA.
- **Așteptat**: rularea migrării 53; push-ul pasului 10 (după migrare); decizia despre refacturarea după storno.

#### Deciziile proprietarului după pasul 10 (11 noiembrie 2026)

- **Refacturarea după storno: DA.** După stornarea facturii unei comenzi, comanda trebuie să poată primi o
  factură NOUĂ din aplicație (cazul tipic: date greșite pe factura trimisă → storno → factură corectă). Se
  propune ca pas separat, **10b**, cu testele lui; **nu se implementează înainte de proba pasului 10**.
- **Clienții (întrebarea 16)**: propunerea cu `GUID_cod_client` din telefon / CUI e bună. Proba pasului 10
  (PROBA 2 + stornoul PROBA 3, același client) arată deja dacă SAGA refolosește clientul FĂRĂ GUID; rezultatul
  se notează după probă. Restul probelor manuale (cu XML-uri editate) — după.

#### Propunerea pentru pasul 10b — refacturarea după storno (NEIMPLEMENTATĂ)

**Ce blochează azi**: `emite_factura` (51) refuză orice comandă cu `factura_status` ≠ „de_emis” sau cu
`factura_serie` completat — regulă pusă ca să nu se dubleze o factură emisă MANUAL în SAGA. Stornarea din
aplicație (53) pune comanda pe „stornata”, deci și ea e refuzată.

**Modificarea propusă — migrarea 54 (`supabase/saga-refacturare.sql`)**, care rescrie DOUĂ funcții existente,
fiecare cu gardă de amprentă (tiparul din 50/51: `md5(replace(prosrc, E'\r', ''))` comparat cu versiunea din
git; se OPREȘTE dacă diferă; amprentele exacte se calculează din git la implementare):
1. **`emite_factura`** (din 51) — o singură regulă în plus, în locul refuzului de azi pentru „stornata”:
   comanda se poate factura din nou DACĂ, toate deodată:
   - `factura_status = 'stornata'` ȘI există cel puțin o factură DIN APLICAȚIE pe comandă, iar fiecare
     factură a ei are storno (adică „stornata” vine din aplicație, nu dintr-o notă manuală — o comandă
     marcată „stornata” de mână, fără facturi din aplicație, rămâne refuzată, ca azi);
   - **fiecare storno al comenzii e deja TRIMIS sau CONFIRMAT în SAGA**. Motivul: un storno netrimis se mai
     poate retrage (`retrage_storno`), iar atunci factura veche ar redeveni valabilă lângă cea nouă — două
     facturi pentru aceeași vânzare. Cu stornoul trimis, retragerea e deja refuzată;
   - restul verificărilor rămân EXACT ca azi (comanda neanulată, cu piese, data de start, seria activă,
     articolul implicit, datele firmei, județul). Data de start se aplică la data PLASĂRII comenzii, ca azi.
   Factura nouă primește număr din seria ACTIVĂ (ca orice factură); oglinda devine „emisa” + noul număr;
   jurnalul comenzii: „Factură nouă după stornarea <serie număr>”.
2. **`retrage_factura`** (din 49) — dacă se retrage factura NOUĂ (netrimisă, ultima din serie), comanda nu mai
   revine la „de_emis” / gol, ci la **„stornata” + seria ultimei facturi stornate** (azi ar pierde urma
   stornării). Pentru o comandă fără stornări — exact ca azi.
3. **`retrage_storno`** (53) — rămâne neatinsă: stornoul trimis nu se retrage oricum, iar cu regula de la 1
   refacturarea cere stornoul trimis.
4. **Interfața**: în cardul de facturare din comandă, când toate facturile sunt stornate și stornările
   trimise → „Emite factura nouă” (cu explicația), altfel motivul („stornoul … trebuie întâi trimis în SAGA”).

**Testele propuse** (ca la pașii anteriori):
- `scripts/verifica-saga-refacturare.sql` — pe PRODUCȚIE, tranzacție anulată: refacturarea după storno
  trimis (număr, oglindă, jurnal); refuz cu storno netrimis; refuz pe „stornata” manuală fără facturi din
  aplicație; refuz cât există o factură nestornată; al doilea ciclu (factură → storno → factură → storno →
  factură); retragerea facturii noi → oglinda „stornata” cu seria veche; amprentele; drepturile. Plus
  re-rularea testelor 49/50/51/53 (comportamentul vechi neschimbat).
- `verifica-saga-local.sh` (Docker): două refacturări SIMULTANE pe aceeași comandă stornată → o singură
  factură nouă; anularea 54 pune înapoi exact versiunile din 51 și 49.
- `scripts/anuleaza-saga-refacturare.sql` — pune înapoi `emite_factura` din 51 și `retrage_factura` din 49,
  cu gardă (se oprește dacă funcțiile din bază nu sunt versiunile din 54); refuză dacă există deja o factură
  emisă prin refacturare (ar rămâne o comandă cu două facturi, fără regula care le explică).

#### Proba pasului 10 pe contul REAL — REUȘITĂ (11 noiembrie 2026, din preview)

- **Comanda de probă AP-2026-01811**, client cu diacritice „TEȘT COMANDA”, „Str. Mărășești 1”, Piatra-Neamț;
  factura **PROBA 2** (50 lei) trimisă → în SAGA: **41,32 + 8,68 = 50,00**, client cod 18086.
- **Diacriticele (riscul 8) — ÎNCHIS**: fișierul e citit corect, fără caractere stricate; SAGA însuși scoate
  diacriticele — „TEST COMANDA”, „PIATRA-NEAMT”, „Str. Marasesti, 1” — la fel ca la clienții introduși manual.
- Fișa clientului creată corect: RO, NT, cont 4111.18086.
- **„Stornează” pe PROBA 2 → PROBA 3**, trimisă → în SAGA: **−41,32 / −8,68 / −50,00**, mențiunea „ramburs in
  cont; Stornare factura PROBA 2 din …”, **ACELAȘI client 18086**.
- **Întrebarea 16**: SAGA refolosește clientul cu date IDENTICE, fără GUID. Rămâne de testat doar cazul cu
  nume / adresă ușor diferite — după pornire.
- **Curățenia**: importuri anulate în SAGA, clientul de test șters, comanda anulată, emiterea oprită, data de
  start golită, PROBA 1–3 ascunse din listă.
- **Numerotarea manuală PAP FE**: 14206 (11.11.2026, ~11:45).

#### Raportul trimis proprietarului (11 noiembrie 2026, după rularea migrării 53)

- Migrarea 53 notată ca rulată (5 × true, Success, 27/27, 0 | 0) în jurnalul pasului 10 și în CLAUDE.md;
  migrările aplicate pe producție: 1–45 și 47–53.
- Push-ul pasului 10 pe `saga-integrare` (`a929a79`, nu pe `main`); preview reconstruit:
  https://autopas-k5ohacys3-alexandruolteanuus-projects.vercel.app — protejat de login-ul Vercel. Adresa e
  notată aici printr-un commit local (`93d2bb0`), neîmpins, ca adresa preview-ului să nu se schimbe din nou.
- Decizia despre clienți notată: propunerea cu GUID e acceptată; proba PROBA 2 + PROBA 3 arată deja dacă SAGA
  refolosește clientul fără GUID.
- Propunerea pentru pasul 10b (refacturarea după storno), neimplementată — secțiunea de mai sus: migrarea 54
  rescrie `emite_factura` și `retrage_factura` cu gărzi de amprentă; factură nouă doar dacă „stornata” vine din
  aplicație, fiecare factură are storno și fiecare storno e deja trimis în SAGA; retragerea facturii noi readuce
  comanda la „stornata” cu seria veche; „Emite factura nouă” în cardul din comandă; testele (SQL pe producție,
  două refacturări simultane în Docker, anularea la versiunile din 51 și 49).
- Urmează proba pasului 10 din preview, cu contabila; pasul 10b abia după probă și după confirmare; pasul 11
  NU a început.

#### Următorul

Pasul 10b (refacturarea) — mai jos; apoi pasul 11 — textele (Integrări, Facturi, pagina comenzii) și
`CLAUDE.md`. Fiecare doar după confirmare.

### Pasul 10b — refacturarea după storno (migrarea 54)

**Stare: migrarea 54 e RULATĂ pe producție la 11 noiembrie 2026**, de proprietar, din SQL Editor:
- pre-verificarea: 3 × `true`;
- `supabase/saga-refacturare.sql` → „Success”;
- testele: `verifica-saga-refacturare.sql` 14/14, `verifica-saga-emitere.sql` 16/16,
  `verifica-saga-articole.sql` 13/13, `verifica-saga-stornare.sql` 27/27;
- verificarea finală: `true | true` (amprentele 54).

Codul pasului 10b împins pe ramura `saga-integrare` în aceeași zi (commit `19c6507`, nu pe `main`); preview
reconstruit („Deployment has completed”): https://autopas-ri6q5ikt5-alexandruolteanuus-projects.vercel.app Urmează proba
scurtă din preview. **Pasul 11 NU a început.**

#### Ce modifică din ce există (confirmat înainte de cod)

- **În bază (migrarea 54, `supabase/saga-refacturare.sql`) — RESCRIE două funcții existente**, fiecare cu
  gardă de amprentă (fără „\r”; se oprește dacă versiunea din bază nu e cea din git):
  - `emite_factura` (din 51, `a1a45bbd8ce6ad03eae408ee9d2f113e` → 54 `05f9fdfb49e73145c8004f290ed6ec42`);
  - `retrage_factura` (din 49, `f9f982f093a2a5fb92cbc3b34ec49ccd` → 54 `8ea9759db0a900c3043eff58663ea1fb`).
  Nicio tabelă, nicio politică, niciun rând; `retrage_storno` (53) neatinsă.
- **Scripturile existente care verifică amprenta lui `emite_factura`**: `verifica-saga-emitere.sql` și
  `verifica-saga-articole.sql` acceptă și 54; `anuleaza-saga-emitere.sql` refuză cât e activă 54 („anulați
  întâi 54”).
- **În cod**: cardul de facturare din comandă — „Emite factura nouă” când refacturarea e permisă, altfel motivul.

#### Ce s-a făcut

- **Funcțiile generate din textul din git** (nu rescrise de mână), apoi comparate mecanic: față de 51, în
  `emite_factura` dispar exact două linii (refuzul „stornata” și mesajul din jurnal), înlocuite de regula nouă;
  față de 49, în `retrage_factura` dispare exact o linie (oglinda „de_emis”), înlocuită de ramura „stornata”.
- **`emite_factura` (54)**: o comandă „stornata” primește o factură nouă DOAR dacă are facturi din aplicație —
  toate stornate (garantat de verificarea „are deja o factură nestornată”, păstrată) — și fiecare storno e deja
  „trimis” / „confirmat”. Altfel: „Stornoul … nu e încă trimis în SAGA … un storno netrimis se mai poate retrage,
  iar factura veche ar redeveni valabilă.” O comandă „stornata” de mână, fără facturi din aplicație → refuz, ca
  în 51. Restul — identic. Jurnalul comenzii: „Factură NOUĂ după stornare, emisă din aplicație: …”.
- **`retrage_factura` (54)**: retragerea facturii noi readuce comanda la „stornata” + seria ultimei facturi
  stornate; fără stornări — exact ca în 49 („de_emis”, fără serie).
- **Cardul din comandă**: sub lista documentelor, când toate facturile au storno — „Emite factura nouă” (cu
  confirmare: datele de ACUM ale comenzii; corectează-le înainte) sau „Stornoul … trebuie întâi trimis în SAGA”.
- **Teste:**
  - `scripts/verifica-saga-refacturare.sql` — **14 verificări pe PRODUCȚIE**, tranzacție anulată, pe o serie
    „TEST …” unică: amprentele 54; refuz cu storno netrimis; factura nouă (număr, oglindă, jurnal); refuz cât
    există o factură nestornată; retragerea facturii noi → „stornata” cu seria veche și contorul înapoi; al doilea
    ciclu (3 facturi, 2 stornări, cu stornoul confirmat); „stornata” manuală refuzată; seria notată de mână
    refuzată; comanda obișnuită — emitere și retragere ca înainte; drepturile;
  - `verifica-saga-local.sh` (Docker): 54 aplicată de două ori; toate testele SQL trec pe 54 (inclusiv 49 / 50 /
    51 / 53 — comportamentul vechi neschimbat); **două refacturări SIMULTANE pe aceeași comandă stornată → o
    singură factură nouă**; anularea 54 refuză cât există o refacturare (nimic schimbat);
  - separat, în Docker: pe o bază fără refacturări, **anularea 54 pune înapoi EXACT** `emite_factura` din 51
    (`a1a45bbd…`) și `retrage_factura` din 49 (`f9f982f0…`); re-rularea 54 după anulare merge; anularea lui 51
    refuză cât e activă 54;
  - `verifica-saga-xml.mjs` 102/102, `verifica-saga-api.mjs` 109/109, build-ul trece.
  - **NEverificat**: interfața în browser și o refacturare reală în SAGA.

#### Fișiere

Noi: `supabase/saga-refacturare.sql`, `scripts/verifica-saga-refacturare.sql`, `scripts/anuleaza-saga-refacturare.sql`.
Modificate: `components/admin/FacturaSaga.tsx`, `scripts/verifica-saga-emitere.sql`, `scripts/verifica-saga-articole.sql`,
`scripts/anuleaza-saga-emitere.sql`, `scripts/verifica-saga-local.sh`, `CLAUDE.md`, `docs/saga-plan.md`.

#### Cum se aplică — pe PRODUCȚIE, din SQL Editor (proprietarul)

1. **Pre-verificarea** (doar citire) — 3 × `true`:
   ```sql
   select md5(replace(prosrc, E'\r', '')) = 'a1a45bbd8ce6ad03eae408ee9d2f113e' as emite_ca_in_51
     from pg_proc where oid = to_regprocedure('public.emite_factura(bigint)');
   select md5(replace(prosrc, E'\r', '')) = 'f9f982f093a2a5fb92cbc3b34ec49ccd' as retrage_ca_in_49
     from pg_proc where oid = to_regprocedure('public.retrage_factura(bigint)');
   select to_regprocedure('public.storneaza_factura(bigint,text)') is not null as are_53;
   ```
   Dacă una dă `false`: NU se rulează migrarea; se trimite textul funcției (`pg_get_functiondef`) pentru comparare.
2. **Migrarea**: `supabase/saga-refacturare.sql` → „Success. No rows returned.” (garda oprește tot dacă ceva diferă).
3. **Testele**: `scripts/verifica-saga-refacturare.sql` → „REZULTAT OK: toate cele 14 verificări au trecut …”;
   apoi, ca plasă, `verifica-saga-emitere.sql` (16), `verifica-saga-articole.sql` (13), `verifica-saga-stornare.sql` (27).
4. **Verificarea finală** (doar citire) — `true | true`:
   ```sql
   select (select md5(replace(prosrc, E'\r', '')) from pg_proc where oid = to_regprocedure('public.emite_factura(bigint)')) = '05f9fdfb49e73145c8004f290ed6ec42' as emite_54,
          (select md5(replace(prosrc, E'\r', '')) from pg_proc where oid = to_regprocedure('public.retrage_factura(bigint)')) = '8ea9759db0a900c3043eff58663ea1fb' as retrage_54;
   ```
5. Apoi push pe ramură (la confirmare).
6. **Doar la nevoie — anularea**: `scripts/anuleaza-saga-refacturare.sql` (refuză dacă există deja o refacturare).

#### Cum se verifică din preview (după push) — o probă scurtă pe seria PROBA

O comandă de probă (ca la pasul 10) → PROBA n → „Trimite în SAGA” → „Stornează” → PROBA n+1 → în cardul din comandă:
„Stornoul … trebuie întâi trimis” → „Trimite în SAGA” pe storno → în cardul din comandă: **„Emite factura nouă”** →
PROBA n+2 → (opțional) „Retrage” → comanda revine la „stornata”. Curățenia ca la pasul 10 (importuri anulate în SAGA,
comanda anulată, emiterea oprită, data de start golită, PROBA ascunse).

#### Raportul trimis proprietarului (11 noiembrie 2026)

- **Proba pasului 10 notată** (jurnalul pasului 10, CLAUDE.md, commit `34a5a9e`): PROBA 2 și stornoul PROBA 3 în
  SAGA, același client (18086) fără GUID; riscul 8 închis; din întrebarea 16 rămâne doar cazul cu nume / adresă
  ușor diferite; curățenia; numerotarea manuală PAP FE la 14206.
- **Pasul 10b — ce modifică**: migrarea 54 rescrie `emite_factura` (51) și `retrage_factura` (49), cu gărzi de
  amprentă; nicio tabelă, politică sau rând. Funcțiile generate din textul din git și comparate mecanic — dispar
  exact cele trei linii înlocuite intenționat. Trei scripturi existente actualizate (două teste acceptă amprenta
  54; anularea lui 51 refuză cât e activă 54). În cod: doar cardul de facturare din comandă.
- **Ce face**: comanda stornată primește factură nouă doar dacă stornarea e din aplicație și stornoul e deja
  trimis în SAGA (altfel cardul spune „Stornoul … trebuie întâi trimis în SAGA”); retragerea facturii noi
  readuce comanda la „stornată” cu seria veche; restul exact ca înainte („stornată” de mână sau serie notată din
  SAGA → refuz).
- **Teste**: 14 SQL pe producție (tranzacție anulată); în Docker toate testele vechi trec pe 54, două
  refacturări simultane → o singură factură nouă, anularea pune înapoi exact 51 și 49 și refuză dacă există o
  refacturare, anularea lui 51 refuză cât e activă 54; 102 XML, 109 API, build-ul. NEverificate: interfața în
  browser și o refacturare reală în SAGA.
- **Așteptat de la proprietar**: pre-verificarea (3 × true — dacă una dă false, NU se rulează migrarea, se
  trimite textul funcției), migrarea 54, testele (14/14 + plasa: emitere 16, articole 13, stornare 27),
  verificarea finală (true | true), apoi confirmarea push-ului (4 commit-uri locale pe ramură). Apoi proba scurtă
  din preview pe seria PROBA (factură → trimisă → storno → „trebuie întâi trimis” → storno trimis → „Emite factura
  nouă” → opțional „Retrage” → curățenia).
- Pasul 11 NU a început.

#### Proba din preview — SĂRITĂ (11 noiembrie 2026)

Decizia proprietarului: proba scurtă a refacturării din preview nu se mai face — e acoperită de cele 14
verificări pe producție (`verifica-saga-refacturare.sql`).

#### Înainte de unire în `main` — verificările (11 noiembrie 2026)

1. **`main` nu s-a schimbat de când s-a creat ramura** (tot `937562e`, baza ramurii); `main` e strămoș al
   ramurii → unirea e o AVANSARE (fast-forward), **fără conflicte posibile**. Ramura: 53+ commit-uri, 51 de
   fișiere (+11.777 / −122).
2. **Dependențe de migrări**: codul ramurii folosește din bază doar obiecte din **47–54**, toate rulate —
   `cod_judet` (47), `export_saga_linii` (48), `facturi`, `facturi_linii`, `facturi_serii`,
   `facturi_serii_istoric`, `is_facturare`, `seteaza_serie_factura`, `emite_factura`, `retrage_factura` (49),
   `saga_articole` (50), `modifica_factura`, `opreste_emiterea` (51), `saga_cheie`, `saga_trimiteri`,
   `saga_ia_blocarea`, `saga_elibereaza`, `saga_salveaza_cheia`, `saga_roteste_cheia` (52), `storneaza_factura`,
   `retrage_storno`, `ascunde_factura`, `reafiseaza_factura`, `facturi_ascunse` (53), refacturarea (54) — plus
   obiecte vechi (`orders`, `settings`, `categorii_cu_numar`…). **Nicio referință la migrarea 46** (retururile
   FAN: `return_requests.order_id`, `ridicare`, `awb_*`) în modificările ramurii.
3. **Build-ul trece** pe arborele care rezultă din unire (identic cu ramura, fiindcă `main` n-are nimic nou).
4. **Ce se schimbă vizibil**: pentru clienții site-ului public — **nimic**: niciun fișier public atins (în afara
   adminului / API / `lib` / scripturi / documente s-au schimbat doar `.gitignore`, `CLAUDE.md`, `raportare.md`);
   în `lib/settings.ts` s-au adăugat câmpuri de firmă (capital, bancă, localitate, județ, țară) folosite doar în
   admin și pe factură, iar `serie_factura: "AUTP"` a ieșit din rezervă. Pentru admin: Facturi (lista
   documentelor, trimiterea, „Trimite selectate”, filtrele, facturile ascunse), Facturi → Setări serie / Articole
   SAGA / pagina facturii, cardul „Facturare (Saga)” din comandă, Integrări → Saga (câmpurile noi, cheia,
   „Testează conexiunea”), Setări → Date firmă (câmpurile noi, fără „Serie facturi”), ruta `/api/saga`.
5. **Fără data de start, nicio factură nu se emite**: `emite_factura` (54) refuză tot când
   `data_start_facturare` lipsește („Data de start a facturării nu e setată…”) — în bază, deci pe orice site; iar
   cardul nu arată „Emite factura”. Atenție: baza e COMUNĂ — odată setată data de start azi, se poate emite din
   preview, local și (după unire) din live.

După răspuns: **unirea și push-ul pe `main` doar după confirmarea proprietarului.**

#### Modificări mici de cod pentru pornire (11 noiembrie 2026)

- **Facturi → Setări serie**: caseta „Factură manuală în SAGA pe aceeași serie?” (înainte: verifici numărul
  propus de SAGA; imediat după: actualizezi numărul următor); bifa de confirmare spune acum „ultima factură pe
  <serie> — din aplicație sau emisă manual în SAGA — are numărul N−1” (nu mai pretinde că facturarea manuală s-a
  oprit); textul de sus scurtat.
- **Cardul „Facturare (Saga)” din comandă**: sub „Emite factura”, restrâns, „Facturată deja manual în SAGA?
  Notează seria” — cu data de start setată, câmpul manual nu mai apărea pe comenzile eligibile, iar facturile
  manuale de după pornire n-ar fi avut unde să fie notate din comandă.
- Build-ul trece. Fără SQL.

#### Raportul trimis proprietarului (11 noiembrie 2026, înaintea pornirii)

- **Push pe ramură** (`9ef54ab`, nu pe `main`), ca modificările pentru pornire să fie în preview azi — făcut fără
  cerere explicită (proprietarul interzisese doar unirea în `main`). Preview:
  https://autopas-umhqd7kfe-alexandruolteanuus-projects.vercel.app (cere login-ul Vercel).
- **Datele** din plan și din CLAUDE.md corectate: tot ce era „12 noiembrie” e „11 noiembrie 2026”. Proba din preview
  pentru 10b — notată ca sărită (acoperită de cele 14 teste pe producție).
- **Pornirea azi**: SQL-ul (doar citire) cu comenzile de azi fără serie notată — în „Procedura de pornire — 11
  noiembrie 2026”, pasul 1; seria pe comenzile facturate manual se notează ÎNAINTE de data de start (până atunci
  câmpul manual apare pe toate comenzile); `valoare_piese` = suma de pe factură. Confirmat: `emite_factura` refuză
  o comandă cu seria notată (neschimbat în 54, testat în două locuri).
- **Două modificări mici de cod** pentru regula facturilor manuale (Setări serie: caseta cu regula și bifa
  corectată; cardul din comandă: „Facturată deja manual în SAGA? Notează seria”) — build-ul trece, fără SQL.
- **Înainte de unire** — cele cinci verificări, mai sus: `main` neschimbat → avansare fără conflicte; doar 47–54,
  nicio dependență de 46; build-ul trece; public — nimic, admin — Facturi, cardul din comandă, Integrări → Saga,
  Setări → Date firmă; fără data de start nu se emite nimic, pe niciun site (baza e comună: după setarea datei de
  start se poate emite din preview, local și, după unire, din live).
- **Procedura de pornire** de azi — în secțiunea C, pas cu pas (inclusiv riscul 7: numărul propus de SAGA după
  prima factură din aplicație validată, așteptat 14208, fără salvare).
- **Mai târziu**: formularul pentru comenzi introduse manual (vânzare la sediu / telefon).
- **Așteptat**: confirmarea proprietarului pentru unirea ramurii în `main` și push.
- **Confirmat (11 noiembrie 2026)**: unirea în `main` și push — vezi „Unirea în `main`” mai jos.

#### Raportul trimis proprietarului (11 noiembrie 2026, după rularea migrării 54)

- Migrarea 54 notată ca rulată (3 × true, Success, testele 14 / 16 / 13 / 27, verificarea finală true | true) în
  jurnalul pasului 10b și în CLAUDE.md; migrările aplicate pe producție: 1–45 și 47–54.
- Commit și push pe `saga-integrare` (`19c6507`, nu pe `main`); preview reconstruit:
  https://autopas-ri6q5ikt5-alexandruolteanuus-projects.vercel.app — cere login-ul Vercel. Adresa e notată aici
  printr-un commit local (`717192f`), neîmpins, ca adresa preview-ului să nu se schimbe din nou.
- Cererea pentru pasul 11 (după pornire) — mesajele de lucru și trimiterile la pași / riscuri scoase, setările
  fixe și „Descarcă XML” în „Setări avansate” restrânsă, drumul scurt comandă → „Emite factura” → „Trimite în
  SAGA”, limbaj simplu — trecută în lista de sus, în secțiunea C și, pe scurt, în CLAUDE.md.
- Urmează proba scurtă a refacturării, din preview. Pasul 11 NU a început.

#### Următorul

Pasul 11 — textele și organizarea zonei SAGA / facturare pentru folosirea zilnică (cererea din 11 noiembrie
2026, în lista de sus, la pasul 11 — DUPĂ PORNIRE). Începe doar după confirmare.

### Unirea în `main` (11 noiembrie 2026)

Confirmată de proprietar. Unire prin avansare (fast-forward) a ramurii `saga-integrare` în `main`, apoi push;
Vercel construiește producția. Regulile „doar din preview sau local” și „Date firmă nu din live” au fost scoase
din CLAUDE.md în același commit (valabile până la terminarea deploy-ului de producție).

**Făcut (11 noiembrie 2026)**: `main` avansat `937562e` → `e0f512f`, push. Deploy-ul de producție Vercel s-a
terminat cu succes (deployment `7707928645`, ~10:41 UTC). Verificat pe domeniu: `POST /api/saga` (ruta nouă)
răspunde 401 „Nu ai dreptul…” — adminul live rulează codul nou; prima pagină și `/piese` răspund 200. De acum,
procedura de pornire se poate face și din adminul live (autopas-dezmembrari.ro).

**Raportul trimis proprietarului (11 noiembrie 2026, după unire):**
- unirea fără conflicte (`937562e` → `e0f512f`), build-ul trecut înainte, push pe `main`;
- deploy-ul de producție Vercel terminat cu succes; verificat pe domeniu: `/api/saga` răspunde (refuză corect
  fără sesiune), prima pagină și `/piese` se încarcă normal;
- din CLAUDE.md scoase regulile „Date firmă nu din live” și „SAGA doar din preview sau local”, înlocuite cu nota
  despre unire — procedura de pornire se face de acum direct din adminul live;
- nota despre unire și deploy e în plan printr-un commit local pe `main` (`aa1e4d2`), neîmpins, ca să nu pornească
  încă un deploy de producție doar pentru documentație — se împinge odată cu următoarea modificare sau la cerere;
- urmează procedura de pornire de azi: SQL-ul cu comenzile de azi și notarea seriilor facturate manual → ultimul
  număr pe PAP FE → Setări serie PAP FE 14207 → Integrări → Saga → prima factură reală.

## Pornirea — 11 noiembrie 2026: REUȘITĂ (pasul 12)

- **Setări serie**: PAP FE, numărul următor 14207. **Integrări → Saga**: exact după „Procedura de pornire — 11
  noiembrie 2026”; data de start 2026-11-11.
- **Prima factură reală din aplicație: PAP FE 14207**, comanda **AP-2026-01812**, client SIMA ION (SAGA a creat
  clientul **18092**), **165,29 + 34,71 = 200,00 (21%)**, mențiunea „ramburs in cont; Comanda AP-2026-01812”, data
  și scadența 11.11.2026. Importată, verificată, **validată în SAGA, trimisă în e-Factura**, marcată confirmată în
  aplicație.
- **Riscul 7**: numărul propus de SAGA pentru o factură manuală nouă pe PAP FE după validare — **nereportat** (în
  mesaj a rămas „[14208 / alt număr]”). Riscul rămâne deschis; regula facturilor manuale (verificarea numărului
  propus de SAGA înainte de fiecare factură manuală) rămâne în vigoare.
- **Pasul 11** (curățarea zonei de facturare) — început în aceeași zi, după confirmare (mai jos).

### Pasul 11 — curățarea zonei SAGA / facturare pentru folosirea zilnică (11 noiembrie 2026)

**Stare: cod scris, build-ul trece; commit LOCAL pe `main`, NEîmpins** — se împinge doar după confirmarea
proprietarului. Nimic schimbat în bază și nicio logică de facturare: doar texte, aranjare și ce e vizibil.

#### Lista dată înainte de cod (pagină cu pagină)

1. **Integrări** (`app/admin/integrari/page.tsx`): cardul „Saga — facturare” cu descrierea și pașii fluxului de azi
   (Emite factura → Trimite în SAGA → validare și e-Factura în SAGA → Marchează confirmată), fără „API în lucru” și
   fără CSV ca flux principal; vizibile doar mențiunea de plată și articolul pentru piese (cod / denumire / UM);
   în **„Setări avansate”** restrânsă: cota și regimul TVA, data de start, formatele numărului și datei, TVA la
   încasare, codul fiscal pentru persoane fizice, articolele pentru reducere / transport, adresa SAGA, importul
   automat; fără „se confirmă la proba manuală” / „întrebare pentru contabilă” / „îl dă contabila”; caseta cheii
   fără „API” / „GetArticol”; cardul e-Factura devine „activ”, cu „se trimite din SAGA, după validare”.
2. **Facturi** (`app/admin/facturi/page.tsx`): „Saga nu are API public…” → fluxul real; exportul CSV explicat ca
   fiind pentru comenzile facturate direct în SAGA.
3. **Pagina facturii** (`app/admin/facturi/[id]/page.tsx`): „Descarcă XML” și jurnalul tehnic → o secțiune
   „Setări avansate” restrânsă, la final; fără „(planul, D.4)”, „valoare de PROBĂ” și numele tehnice ale setărilor.
4. **Setări serie**: fără „ziua pornirii”, `docs/saga-plan.md`, „migrarea 49”; regula facturilor manuale rămâne.
5. **Articole SAGA**: fără „migrarea 50”, „îl dă contabila”, „(GetArticol)”.
6. **Setări → Date firmă**: „Seria facturilor se setează în Facturi → Setări serie”.
7. Cardul din comandă și exportul din Comenzi — deja simple, neatinse.

#### Ce s-a făcut

- **Integrări**: câmpurile primesc un semn `avansat`; formularul le arată pe cele obișnuite, iar pe cele avansate
  într-un `details` „Setări avansate (nu se schimbă de obicei)”. Câmpurile restrânse **rămân în formular**, deci
  se salvează și nu se golesc (formularul citește toate câmpurile listei). Caseta „Legătura cu SAGA”: „Conectat.
  Cheia e salvată (…); folosită ultima dată: …”; schimbarea cheii restrânsă când cheia e salvată (deschisă dacă
  lipsește sau e blocată); mesajul despre codul fiscal apare doar dacă lipsește.
- **Facturi**: textul de sus și un titlu peste lista comenzilor („Toate comenzile, cu seria facturii”); coloana
  „Seria facturii”.
- **Pagina facturii**: cardul „Trimiterea în SAGA” rămâne drumul de zi cu zi (Trimite / Reîncearcă / Marchează
  confirmată), cu texte simple; la final, „Setări avansate” restrânsă: „Istoricul trimiterilor în SAGA” și
  „Fișierul facturii pentru SAGA” (pentru import de mână, dacă butonul nu merge) — „Descarcă fișierul”.
- **Ruta `/api/saga`** — doar trei mesaje: fără „TVA 19%” (cota din fișă, care încurca), fără „verifică cu
  contabila”, fără „proba cu un cod inexistent”.
- **Teste**: `verifica-saga-xml.mjs` 102/102, `verifica-saga-api.mjs` 109/109, build-ul trece. NEverificat în
  browser (paginile cer contul de admin).

#### Fișiere

`app/admin/integrari/page.tsx`, `app/admin/facturi/page.tsx`, `app/admin/facturi/[id]/page.tsx`,
`app/admin/facturi/setari/page.tsx`, `app/admin/facturi/articole/page.tsx`, `app/admin/setari/page.tsx`,
`app/api/saga/route.ts`, `CLAUDE.md`, `docs/saga-plan.md`.

#### Cum se verifică (după push, pe site)

Integrări → „Saga — facturare”: doar mențiunea și articolul la vedere, restul în „Setări avansate”; salvezi cardul
o dată și verifici că valorile din „Setări avansate” au rămas. Facturi → o factură: drumul Trimite / Marchează
confirmată sus, „Setări avansate” jos, restrânsă. Facturi → Setări serie / Articole SAGA: fără trimiteri la
migrări sau la contabilă.

#### Raportul trimis proprietarului (11 noiembrie 2026)

- **Pornirea, notată**: pasul 12 GATA în plan; CLAUDE.md actualizat — prima factură reală din aplicație PAP FE
  14207 (comanda AP-2026-01812, 200,00 lei), validată în SAGA, trimisă în e-Factura, confirmată.
- **Riscul 7 rămâne deschis**: în mesaj a rămas „[14208 / alt număr]” — se închide când proprietarul spune ce număr
  a propus SAGA. Până atunci, regula „verifici numărul propus de SAGA înainte de o factură manuală” rămâne valabilă.
- **Pasul 11**: doar texte și aranjare (lista pagină cu pagină — mai sus); câmpurile restrânse din Integrări se
  salvează și nu se golesc; „Testează conexiunea” nu mai afișează TVA-ul din fișa articolului (încurca) și nici
  „verifică cu contabila”. Teste 102 XML / 109 API, build-ul trece; NEvăzut pe ecran (paginile cer contul de admin).
- **Pe `main`: 4 commit-uri locale, neîmpinse** — `aa1e4d2`, `116f32f` (notele despre unire), `8a0a758` (pornirea),
  `aeee48d` (pasul 11); un push le duce pe toate pe site, într-un singur deploy.
- **După push, de verificat**: Integrări — salvezi o dată cardul Saga și verifici că valorile din „Setări avansate”
  au rămas; pagina unei facturi — drumul de zi cu zi sus, „Setări avansate” jos, restrânsă.
- **Așteptat**: confirmarea push-ului pe `main` și numărul propus de SAGA (riscul 7).

#### Push-ul pasului 11 și riscul 7 (11 noiembrie 2026)

- **Push pe `main` confirmat de proprietar** — au plecat 5 commit-uri (cele 4 anunțate plus raportul din plan,
  `69018b4`, doar documentație). Deploy-ul de producție Vercel s-a terminat cu succes (deployment `7708487882`,
  ~11:09 UTC); site-ul răspunde (prima pagină 200, `/api/saga` refuză corect fără sesiune).
- **Riscul 7 ÎNCHIS**: după validarea PAP FE 14207, SAGA a propus 14208 pentru o factură manuală nouă — contorul SAGA
  vede facturile importate. Rămâne obligatoriu doar pasul de după o factură manuală (numărul următor în Setări serie
  + seria pe comandă), fiindcă aplicația nu vede facturile manuale.

#### Raportul trimis proprietarului (11 noiembrie 2026, după push)

- Deploy-ul pe producție terminat cu succes (~11:09 UTC); site-ul răspunde normal, ruta de facturare refuză corect
  cererile fără autentificare.
- Push: 5 commit-uri, nu 4 — al cincilea e raportul din plan, doar documentație. Pasul 11 e live.
- Riscul 7 închis: SAGA a propus 14208 după validarea PAP FE 14207 → vede facturile trimise din admin. Notat în plan
  și în CLAUDE.md.
- La o factură manuală: ÎNAINTE — SAGA propune singur numărul corect, verificarea rămâne doar o plasă; DUPĂ —
  obligatoriu: numărul următor în Facturi → Setări serie și seria pe comandă (adminul nu vede facturile din SAGA).
- Nota despre riscul 7 e într-un commit local pe `main` (`cd3d3ab`), neîmpins — pleacă la următorul push, ca să nu
  pornească un deploy doar pentru o notă.
- De verificat pe site de proprietar: Integrări — salvezi o dată cardul Saga și verifici că valorile din „Setări
  avansate” au rămas; pagina unei facturi — „Setări avansate” jos, restrânsă.

## Ce a rămas (la 11 noiembrie 2026, după pornire)

- verificarea pe ecran a pasului 11 (mai sus);
- întrebările deschise pentru contabilă: 2 (doar ce ține de oprirea manualului — înlocuită de regula facturilor
  manuale), 4 (persoane fizice), 6 (reducerea), 7 (data facturii), 8 (momentul facturării — pentru faza 2),
  9 (forma stornării), 10 (transportul comenzilor vechi), 11 (e-Factura prin SAGA — confirmat în practică), 15 (Nr.
  Reg. Com. al firmelor), 16 (clienții cu nume / adresă ușor diferite — după pornire);
- întrebările pentru suportul SAGA (dubla încărcare la reîncercare, formatul raportului, durata unui import);
- mai târziu: faza 2 (facturarea automată), formularul pentru comenzi introduse manual, `GUID_cod_client` (după
  proba cu nume diferite).

## Ștergerea comenzilor de probă (11 noiembrie 2026)

Cerută de proprietar: AP-2026-01809 (PROBA 1) și AP-2026-01811 (PROBA 2 + stornoul PROBA 3) să nu mai
apară în admin. Varianta aleasă: **ștergere definitivă**, nu ascundere. Scriptul `scripts/sterge-comenzi-proba.sql`
(rulat de proprietar din SQL Editor) oprește paza facturilor DOAR în tranzacția lui, șterge facturile de probă
și cele două comenzi și repune pe stoc piesele comenzilor neanulate. Se oprește fără să șteargă nimic dacă vreo
factură a lor e pe o serie reală. Nu atinge SAGA: dacă PROBA 1–3 mai sunt acolo, le șterge contabila.

## „Șterge” pe comenzile cu factură — migrarea 55 (11 noiembrie 2026, scrisă, NErulată)

Cererea clientului: „Șterge” merge și pe comenzile cu factură din aplicație, iar comanda nu mai apare nicăieri în admin.
Fără factură: neschimbat. Cu factură: comanda se ASCUNDE (`orders.sters_la` / `sters_de`). Facturile, liniile și legătura
factură–comandă rămân neatinse. Excepții (intenționate): Facturi și pagina facturii („comandă ștearsă”, fără link),
rapoartele, cifrele de vânzări de pe Dashboard, profitul pe mașină și exportul SAGA. Detaliile: `CLAUDE.md`, migrarea 55.
Ordinea: pre-verificarea → `supabase/comenzi-sterse.sql` → `scripts/verifica-comenzi-sterse.sql` → verificarea finală →
abia apoi push pe `main`. Local (Docker): `scripts/verifica-saga-local.sh` trece, inclusiv două apăsări simultane.

### Raportul trimis proprietarului (migrarea 55, înainte de rulare)

**1. Ce face „Șterge” azi și ce face ștergerea logică**

| Privința | Azi (`sterge_comanda`, comandă fără factură) | Cu factură (după 55) |
|---|---|---|
| Stoc | piesele revin pe stoc + `publicat = true` (dacă nu era anulată) | neatins — ca la orice comandă rămasă în bază |
| Piesele comenzii (`order_items`) | șterse, în cascadă | rămân |
| dez.ro | piesele repuse pe stoc pleacă singure înapoi (trigger, migrarea 39) | nimic nu pleacă |
| AWB | NU se anulează la FAN; dispare doar din admin | rămâne exact cum e |
| Jurnal (`order_events`) | șters, în cascadă | rămâne + notă „Comandă ștearsă din admin” (tip `stergere`) |
| Facturi | comanda cu factură e refuzată de cheia străină (49) | facturile, liniile și legătura rămân neatinse |

Comanda FĂRĂ factură din aplicație: corpul vechi al funcției, identic.

**2. Ce se modifică din ce există**
- `orders`: coloane noi, goale — `sters_la` (când), `sters_de` (cine).
- trigger nou `orders_sters_pazeste`: din browser (`authenticated` / `anon`) cele două coloane nu se scriu direct;
  se pun doar prin `sterge_comanda`, se scot doar din SQL Editor.
- `sterge_comanda` rescrisă, cu gardă de amprentă: 9 = `cd1d7d0cf96d2c79014e7d7749ac1b0d` → 55 =
  `ec5319ea6dbed417d766c2fb92157410`. Ascunderea e atomică (`update … where sters_la is null`): două apăsări
  simultane → o singură ascundere, o singură notă.
- RLS: NESCHIMBAT, intenționat — rapoartele (`order_items` + `orders!inner`) și `export_saga_linii` citesc comenzile
  direct; ascunse prin RLS, ar dispărea și din ele. Ascunderea e în pagini (`.is("sters_la", null)`).
- Dispare din: lista de comenzi + contoarele taburilor; căutarea din antet; contorul „comenzi noi” din meniu; alerta de
  comandă nouă (`NewOrderAlert`); Dashboard (contoarele noi / confirmate, ultimele comenzi); Expedieri; Clienți; ruta
  `/api/awb` (o tratează ca inexistentă); pagina comenzii deschisă din adresă scrie „Comanda a fost ștearsă.”
- Rămâne în: Facturi (lista comenzilor, cu „(comandă ștearsă)”, fără link); pagina facturii („comandă ștearsă”, fără
  link; după retragerea facturii trimite la Facturi); Rapoarte; cifrele de vânzări de pe Dashboard; profitul pe mașină;
  exportul SAGA.
- Neatinse: AWB-ul de retur (`/api/awb-retur`, ia doar adresa); „Contul meu” al clientului.
- Butonul „Șterge” apare acum și pe comenzile cu factură; confirmarea e aceeași. DE DISCUTAT: textul ei („piesele
  revin pe stoc, jurnalul se pierde”) nu e adevărat pentru comenzile cu factură.

**3. Rularea (Supabase → SQL Editor)**
- a) pre-verificarea, doar citire — **true × 4**:
  ```sql
  select md5(replace(prosrc, E'\r', '')) = 'cd1d7d0cf96d2c79014e7d7749ac1b0d' from pg_proc where oid = to_regprocedure('public.sterge_comanda(bigint)');
  select to_regclass('public.facturi') is not null;
  select count(*) = 0 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name in ('sters_la', 'sters_de');
  select not exists (select 1 from pg_trigger where tgname = 'orders_sters_pazeste');
  ```
- b) migrarea `supabase/comenzi-sterse.sql` → „Success”;
- c) `scripts/verifica-comenzi-sterse.sql` → căsuța roșie „REZULTAT OK: toate cele 19 verificări” (nu lasă nimic);
- d) verificarea finală — **0 | true**:
  ```sql
  select (select count(*) from orders where sters_la is not null),
         (select md5(replace(prosrc, E'\r', '')) = 'ec5319ea6dbed417d766c2fb92157410' from pg_proc where oid = to_regprocedure('public.sterge_comanda(bigint)'));
  ```
- e) abia apoi push pe `main` (codul cere coloana; fără ea listele din admin ies goale).
- Reafișarea unei comenzi: SQL-ul de la finalul `scripts/anuleaza-comenzi-sterse.sql`. Anularea migrării: același
  fișier (refuză cât există comenzi ascunse; pune înapoi exact `sterge_comanda` din 9).

**Fișiere**: noi — `supabase/comenzi-sterse.sql`, `scripts/verifica-comenzi-sterse.sql`,
`scripts/anuleaza-comenzi-sterse.sql`; modificate — `app/admin/comenzi/page.tsx`, `app/admin/comenzi/[id]/page.tsx`,
`app/admin/page.tsx`, `app/admin/layout.tsx`, `app/admin/clienti/page.tsx`, `app/admin/expedieri/page.tsx`,
`app/admin/facturi/page.tsx`, `app/admin/facturi/[id]/page.tsx`, `components/admin/NewOrderAlert.tsx`,
`app/api/awb/route.ts`, `lib/types.ts`, `scripts/verifica-saga-local.sh`, `CLAUDE.md`.
**Verificat**: `npm run build` „Compiled successfully”; `scripts/verifica-saga-local.sh` — toate trec (55 de două ori,
cele 19 teste, două apăsări simultane, anularea refuzată cu o comandă ascunsă, apoi anularea și re-rularea).
**Comenzile de probă AP-2026-01809 / 01811**: dacă `scripts/sterge-comenzi-proba.sql` nu s-a rulat încă, după 55 se pot
doar ascunde cu „Șterge” (facturile PROBA rămân în Facturi) — varianta mai sigură.
**Stare**: commit local `bd39a36` (+ cele 3 de documentație de dinainte), FĂRĂ push — se așteaptă rularea și confirmarea.
