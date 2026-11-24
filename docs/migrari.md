# Istoricul migrărilor SQL

Mutat din CLAUDE.md la 24 noiembrie 2026 (fișierul depășea 150.000 de caractere). Detaliile fiecărei migrări: ce face, când a rulat, amprentele, testele, anularea.

1. `schema.sql` -> 2. `seed.sql` -> 3. `filtru.sql` -> 4. `integrari.sql` ->
5. `admin.sql` -> 6. `sprint-bc.sql` -> 7. `upgrade.sql` (include și politicile pentru poze) ->
8. `favorite.sql` -> 9. `admin-fix.sql` -> 10. `date-firma.sql` -> 11. `comanda-server.sql` ->
12. `livrare-dupa-comanda.sql` -> 13. `coduri-reducere-private.sql` -> 14. `view-security-invoker.sql` ->
15. `cautare-fara-diacritice.sql` -> 16. `email-unic.sql` -> 17. `import-pieseauto.sql` ->
18. `taxonomie-import.sql` -> 19. `greutate-estimata.sql` -> 20. `import-index-fix.sql` ->
21. `publicare-cu-poze.sql` -> 22. `import-din-admin.sql` -> 23. `rls-citire-echipa.sql` ->
24. `ani-generatie.sql` -> 25. `marci-lipsa.sql` -> 26. `generatii-si-denumiri.sql` ->
27. `mod-vacanta.sql` -> 28. `pagini-masini.sql` -> 29. `numar-piese-pe-model.sql` ->
30. `ga4-public.sql` -> 31. `categorii-numar-rapid.sql` -> 32. `piese-marca-categorie.sql` ->
33. `masuratori-publice.sql` -> 34. `piese-compatibile-masini.sql` -> 35. `superb-1.sql` ->
36. `email-automat.sql` -> 37. `dezro.sql` -> 38. `piesa-vanduta-ramane.sql` ->
39. `dezro-automat.sql` -> 40. `senzori-auto-despartire.sql` -> 41. `observatii-comanda.sql` ->
42. `sugestie-clasificare.sql` -> 43. `awb-fancourier.sql` -> 44. `nomenclator-fan.sql` ->
45. `transport-incasat-de-fan.sql` -> 46. `retur-fan.sql` -> 47. `saga-calcul.sql` -> 48. `saga-export.sql` -> 49. `saga-facturi.sql` -> 50. `saga-articole.sql` -> 51. `saga-emitere.sql` -> 52. `saga-api.sql` -> 53. `saga-stornare.sql` -> 54. `saga-refacturare.sql` -> 55. `comenzi-sterse.sql` -> 56. `olx-conexiune.sql` -> 57. `olx-anunturi.sql` -> 58. `olx-coada.sql` -> 59. `olx-coada-ceas.sql` -> 60. `saga-emitere-un-buton.sql`
Idempotente (se pot re-rula oricând): 6, 7, 9–60.
NU sunt încă idempotente: 1–5, 8.
**Aplicate pe producție: 1–45 și 47–55. 46 e scrisă, NErulată** (așteaptă contul ocazional FAN).
**56 (OLX, pasul 1 din `docs/olx-plan.md`) e RULATĂ pe producție la 13 noiembrie 2026** (pre-verificarea 4 × true; prima rulare a picat testul — `olx_consuma_starea` întorcea null, corectat și re-rulat; `verifica-olx-conexiune.sql` REZULTAT OK; amprenta funcției `3b6e1dee251e95633806cf41792c3fca`). Pasul 1 unit în `main` la 13 noiembrie 2026; callback-ul înregistrat la OLX: `https://autopas-dezmembrari.ro/api/olx/callback` (aplicația OLX așteaptă confirmarea lor): `olx_cont` (aplicația + tokenii, fără politici RLS), lacătul, `olx_consuma_starea`, `olx_apeluri`, `olx_categorii`, `olx_mapari`. Doar obiecte noi. Pre-verificare: `scripts/pre-verifica-olx-conexiune.sql`; test: `scripts/verifica-olx-conexiune.sql`; anulare: `scripts/anuleaza-olx-conexiune.sql`. Singurul loc care folosește tokenii OLX: `lib/olx-api.mjs` (listă închisă de apeluri — nu cumpără nimic).
**57 (OLX, pasul 2) e RULATĂ pe producție la 13 noiembrie 2026** (3 × true, Success, `verifica-olx-anunturi.sql` REZULTAT OK; unită în `main`). Anunțurile VECHI de pe contul OLX (peste 2.000, manuale, inactive) nu se ating și nu contează la garda de dublură — decizia proprietarului: `olx_anunturi` — piesă → cel mult UN anunț (`product_id` unic, revendicat înainte de POST; `advert_id` unic; `on delete set null`, ca anunțul unei piese șterse să poată fi retras). Codul ramurii cere migrarea ÎNAINTE de push pe `main`. Logica publicării: `lib/olx-publicare.mjs`. Pre-verificare / test / anulare: `scripts/*olx-anunturi.sql`.
**58 (OLX, pasul 3 — sincronizarea automată) e RULATĂ pe producție la 16 noiembrie 2026** (pre-verificarea 5 × true, testul REZULTAT OK; sincronizarea pornită din admin la 08:30, prima zi: 46 de anunțuri retrase — 26 vândute, 20 ascunse —, 26 actualizate, 10 publicate, apoi lanțul de loturi s-a rupt, vezi 59): `olx_coada`, `olx_trezire` (adresa,
secretul generat de migrare, `activ` = false la început, lacătul lotului; fără politici RLS), trei triggere `olx_la_*` pe
`products` (aceeași formă ca dez.ro, migrarea 39), view-urile `olx_de_retras` și `olx_coada_stare`, plus coloana nouă
`olx_anunturi.retras_la`. Motorul: `lib/olx-coada.mjs`; ruta: `app/api/olx-coada/`; panoul: Admin → Anunțuri OLX →
„Sincronizarea automată” (Pornește / Adu OLX la zi / Trimite acum). Anunțul unei piese vândute → `deactivate` cu
`is_success: true`; ascunse / șterse → `is_success: false`; anunț NEPLĂTIT („limited”) → comanda `finish` (adăugată în lista
închisă din `lib/olx-api.mjs` la 16 noiembrie 2026; `deactivate` e refuzat de OLX pe el). Niciodată DELETE. Plasa de 20%.
Codul tolerează lipsa migrării (cardul spune „rulează migrarea 58”). Pre-verificare: `scripts/pre-verifica-olx-coada.sql`
(5 × true); test: `scripts/verifica-olx-coada.sql`; anulare: `scripts/anuleaza-olx-coada.sql`. Verificate: motorul
(`scripts/verifica-olx-coada.mjs`, 45) și SQL-ul local în Docker (`scripts/verifica-olx-local.sh`, 22). NETESTAT pe OLX real:
`finish` pe un anunț „limited” — prima probă e chiar retragerea pieselor vândute / ascunse după „Adu OLX la zi”.
**59 (OLX, ceasul cozii) e SCRISĂ, NErulată** (16 noiembrie 2026): pg_cron, o dată pe minut, `olx_ceas()` trezește ruta DOAR
dacă sincronizarea e pornită, nu e un lot în lucru și coada are ceva de făcut; `olx_trezeste` rescrisă cu garda de amprentă
(58: `6676526a2534da97fdb765f4f198b91a` → 59: `d73c0e77ccc4dd13682098c431c47db4`), cu 10 s în loc de 3. Motivul, măsurat: pg_net
renunța după 3 s, Vercel pornea funcția în 14–26 s, iar lanțul de loturi s-a rupt cu 37 de piese în coadă. Fără 59 coada tot
merge, dar o ruptură așteaptă următoarea schimbare de piesă. Pre-verificare: `scripts/pre-verifica-olx-coada-ceas.sql` (3 × true);
anulare: `scripts/anuleaza-olx-coada-ceas.sql` (pune înapoi exact 58). Testat local: `scripts/verifica-olx-local.sh`.
**60 (SAGA, pasul 13 — „Emite factura” dintr-un buton) e RULATĂ pe producție la 17 noiembrie 2026** (pre-verificarea 5 × true, verificarea finală true | true | true, testul REZULTAT OK; codul unit apoi în `main`): butonul face totul
pe server — validare înainte de număr, numărul, `/Import` cu importAutomat=true, verificarea. Răspunsul real „deja” (PAP FE
14210, HTTP 422, „Factura a fost importata sau operata manual deja”) → renumerotare (max 10), DOAR dacă nu există o
încercare fără răspuns pe acel număr; altfel factura e a noastră. Timeout / 429 → același număr, reîncercare din fundal
(pg_cron „saga-coada”, NU depinde de 59). Rescrie `facturi_pazeste` (49 `a2b12d08…` → 60 `f8bccca0…`); `emite_factura`
(54) neschimbată. **Codul cere migrarea: 60 se rulează ÎNAINTE de push pe `main`.** Pre-verificare:
`scripts/pre-verifica-saga-emitere-un-buton.sql` (5 × true; pg_cron: Database → Extensions → pg_cron → Enable); test:
`scripts/verifica-saga-emitere-un-buton.sql`; anulare: `scripts/anuleaza-saga-emitere-un-buton.sql`; motorul:
`lib/saga-emitere.mjs`, testat cu `scripts/verifica-saga-emitere-un-buton.mjs` (3 teste). Risc acceptat de proprietar: o
încercare „fără răspuns” care n-a ajuns, exact când cineva emite manual același număr. PAP FE 14210 și facturile de dinainte
NU se ating din aplicație; ultimul număr îl pune proprietarul în Facturi → Setări serie.
**55 e RULATĂ pe producție la 11 noiembrie 2026** (pre-verificarea 4 × true, Success, `verifica-comenzi-sterse.sql` 19/19, verificarea finală 0 | true) — „Șterge” pe comenzile cu factură: `orders.sters_la` / `sters_de`
(ascundere, nu ștergere), triggerul `orders_sters_pazeste` (din browser coloanele nu se scriu direct), `sterge_comanda`
rescrisă cu gardă de amprentă (9: `cd1d7d0cf96d2c79014e7d7749ac1b0d` → 55: `ec5319ea6dbed417d766c2fb92157410`). Fără
factură din aplicație: corpul vechi, identic. Cu factură: doar ascunsă + notă în jurnal (stoc, piese, dez.ro, AWB, facturi
neatinse). RLS NESCHIMBAT: ascunderea e în paginile adminului (`.is("sters_la", null)`); rapoartele, cifrele de vânzări de
pe Dashboard, profitul pe mașină, Facturi, pagina facturii și exportul SAGA includ comenzile ascunse. **Codul cere
coloana: migrarea 55 se rulează ÎNAINTE de push pe `main`**, altfel listele din admin rămân goale. Testele:
`scripts/verifica-comenzi-sterse.sql`; anularea și SQL-ul de reafișare: `scripts/anuleaza-comenzi-sterse.sql`.
**52 e RULATĂ pe producție la 11 noiembrie 2026**, de proprietar, din SQL Editor (pre-verificarea 5 × true,
`scripts/verifica-saga-api.sql` „REZULTAT OK” 33/33, verificarea finală 0 | 0 | 1 | true; pasul 7 din `docs/saga-plan.md`).
**53 e RULATĂ pe producție la 11 noiembrie 2026** (pre-verificarea 5 × true, Success, `verifica-saga-stornare.sql` 27/27,
verificarea finală 0 | 0; pasul 10): `storneaza_factura` (storno în aceeași serie, liniile
cu semn schimbat, comanda „stornata”), `retrage_storno`, `serie_de_proba`, tabela `facturi_ascunse` cu
`ascunde_factura` / `reafiseaza_factura` (DOAR seriile „PROBA…” / „TEST…”). Doar obiecte noi; nicio funcție
existentă rescrisă. Limită știută: o comandă stornată nu mai primește factură nouă din aplicație
(`emite_factura` din 51 refuză „stornata”) — **refacturarea după storno e DECISĂ (11 noiembrie 2026)** și vine ca
pasul 10b (migrarea 54: `emite_factura` + `retrage_factura` rescrise cu gărzi de amprentă; refacturare doar după ce
stornoul e TRIMIS), abia după proba pasului 10.
**Proba pasului 10 pe contul REAL a REUȘIT la 11 noiembrie 2026** (comanda de probă AP-2026-01811): PROBA 2 (50 lei →
41,32 + 8,68) și stornoul PROBA 3 (−41,32 / −8,68 / −50,00) importate, **același client în SAGA** (cod 18086,
fără GUID). Diacriticele: fișierul e citit corect, SAGA le scoate singur, ca la clienții manuali — riscul 8
închis. Numerotarea manuală PAP FE: 14206 la 11.11.2026, ~11:45.
**54 e RULATĂ pe producție la 11 noiembrie 2026** (pre-verificarea 3 × true, Success, testele refacturare 14,
emitere 16, articole 13, stornare 27, verificarea finală true | true; pasul 10b — refacturarea după storno): RESCRIE `emite_factura` (din 51,
`a1a45bbd…` → `05f9fdfb49e73145c8004f290ed6ec42`) și `retrage_factura` (din 49, `f9f982f0…` →
`8ea9759db0a900c3043eff58663ea1fb`), cu gărzi de amprentă. O comandă „stornata” primește factură nouă DOAR dacă
stornarea e din aplicație și fiecare storno e deja trimis în SAGA; retragerea facturii noi readuce comanda la
„stornata”. `verifica-saga-emitere.sql` / `verifica-saga-articole.sql` acceptă și amprenta 54;
`anuleaza-saga-emitere.sql` refuză cât e activă 54. Pașii: jurnalul pasului 10b; anularea:
`scripts/anuleaza-saga-refacturare.sql` (pune înapoi exact 51 și 49; refuză dacă există o refacturare).
**Pasul 11 (după pornire)**: curățarea zonei SAGA / facturare din admin pentru folosirea zilnică — fără mesajele de
lucru și trimiterile la pași / riscuri, setările fixe într-o secțiune „Setări avansate” restrânsă (cu „Descarcă XML”),
drum scurt comandă → „Emite factura” → „Trimite în SAGA”, limbaj simplu (`docs/saga-plan.md`, lista de sus).
**PORNIREA pe PAP FE: 11 noiembrie 2026** (`data_start_facturare` = 2026-11-11; pașii: `docs/saga-plan.md`,
„Procedura de pornire — 11 noiembrie 2026”). **Facturarea manuală pe PAP FE CONTINUĂ după pornire** (decizia
proprietarului; o singură persoană facturează): înainte de o factură manuală se verifică în SAGA că numărul propus
e cel de după ultima factură din aplicație; imediat după, se actualizează numărul următor în Facturi → Setări serie
și se notează seria pe comandă. Comenzile de azi facturate manual (PAP FE 14195–14206) se notează ÎNAINTE de a
seta data de start. **PORNIREA A REUȘIT la 11 noiembrie 2026**: prima factură reală din aplicație, **PAP FE 14207** (comanda
AP-2026-01812, 200,00 lei = 165,29 + 34,71), importată, validată în SAGA, trimisă în e-Factura, confirmată.
**Riscul 7 ÎNCHIS**: după validarea PAP FE 14207, SAGA a propus 14208 pentru o factură manuală nouă — contorul
SAGA vede facturile importate. Obligatoriu rămâne pasul de DUPĂ o factură manuală (numărul următor în Facturi →
Setări serie + seria pe comandă): aplicația nu vede facturile emise direct în SAGA.
**Trimiterea AUTOMATĂ în SAGA (16 noiembrie 2026, cerut de proprietar, fără migrare)**: „Emite factura” (și „Emite
factura nouă”) trimite factura în SAGA imediat după emitere, iar „Stornează” trimite stornoul — al doilea clic a dispărut
(`lib/saga-browser.ts`, folosit în `components/admin/FacturaSaga.tsx` și `app/admin/facturi/[id]/page.tsx`). Consecință:
fereastra „Modifică” / „Retrage” dinainte de trimitere practic nu mai există — datele clientului se verifică în comandă
ÎNAINTE de emitere; greșelile se corectează prin storno. Dacă trimiterea pică, factura rămâne „de trimis” / „eroare” și se
trimite din pagina ei sau cu „Trimite selectate”. Validarea în SAGA fără import manual = `import_automat` = **da** în
Integrări → Saga → Setări avansate (setarea proprietarului). NETESTAT pe contul real cu `importAutomat=true`: prima factură
după schimbare e proba — de văzut în SAGA că e validată și că pleacă în e-Factura; un răspuns 207 (avertizări, de ex.
„preț de vânzare sub cel de achiziție”, care a apărut la PROBA 1) lasă factura „trimisă — de verificat”, nu „confirmată”.
**Potrivirile categorie → articol SAGA (16 noiembrie 2026)**: `scripts/saga-articole-potriviri.sql`, RULAT de proprietar
(86 de categorii, 36 de articole). Facturile emise înainte își păstrează articolul copiat la emitere.
**Pasul 11 (11 noiembrie 2026) — curățarea zonei de facturare**: doar texte și aranjare. În Integrări → Saga,
câmpurile marcate `avansat` stau într-o secțiune „Setări avansate” restrânsă (rămân în formular, deci se salvează);
pe pagina facturii, istoricul trimiterilor și „Descarcă fișierul” stau în „Setări avansate”, la final. Textele
vizibile nu mai trimit la pași / riscuri / migrări / contabilă. Pașii: jurnalul pasului 10; anularea: `scripts/anuleaza-saga-stornare.sql`.
**Pasul 7 verificat pe contul REAL SAGA la 11 noiembrie 2026**, din preview: cheia salvată din admin,
„Testează conexiunea” trecut, SAGA a rotit cheia la primul apel și cea nouă s-a salvat singură;
`X-Saga-Cod-Fiscal` = „RO36608590” acceptat. Articolul implicit: **1457070043 „ACCESORII AUTO”, BUC** —
în fișa lui din SAGA are **TVA 19** (factura reală a ieșit cu 21) și stoc: la prima probă de import pe
seria PROBA se verifică OBLIGATORIU cota TVA pe factura importată și dacă SAGA cere `Gestiune` pe linii
(`docs/saga-plan.md`, riscul 10, întrebarea 5).
**Pasul 8 (trimiterea în SAGA) — cod scris la 11 noiembrie 2026, FĂRĂ migrare nouă.** O factură = un
fișier = un apel (`lib/saga-trimitere.mjs`); singurul loc cu calea „/Import” e `importaFacturi` din
`lib/saga-api.mjs`. Setări în Integrări → Saga: `format_numar` = serie_spatiu, `format_data` = zi-luna-an
(decizia proprietarului, de confirmat la prima probă), `tva_la_incasare` = **nu** (decis la 11 noiembrie
2026: firma nu aplică TVA la încasare), `import_automat` = text da / nu, **gol = nu, rămâne „nu” la primele facturi reale** (nu bifă:
bifele din Integrări pornesc bifate când lipsește valoarea). Probele de import: DOAR pe seria PROBA, cu
contabila, care șterge importul nevalidat. Prima probă: pe o comandă de PROBĂ a proprietarului, anulată apoi —
`anuleaza_comanda` NU verifică facturile (permite anularea, fără avertisment, stocul revine); factura PROBA
trimisă rămâne legată de comanda anulată până la pasul 10 (ascundere / stornare).
**Prima probă de import pe contul REAL a REUȘIT la 11 noiembrie 2026** (comanda de probă AP-2026-01809,
factura PROBA 1, 40 lei): HTTP 207 doar cu avertizarea „preț de vânzare sub cel de achiziție” → „trimisă”;
în SAGA: „PROBA 1”, 11.11.2026, 33,06 + 6,94 = 40,00 (cota 21% din XML, NU 19 din fișa articolului),
mențiunea „ramburs in cont; Comanda …”; fără `Gestiune`. Închise: formatul numărului / datei, cota TVA.
**Deschise**: diacriticele (neconfirmate), contorul PAP FE după import (riscul 7), clienții creați automat
de SAGA (întrebarea 16, de discutat). Numerotarea manuală PAP FE: 14202 la 11.11.2026, ~11:00.
**Pasul 9 (verificarea articolelor) — cod scris la 11 noiembrie 2026, fără migrare**: Facturi → Articole
SAGA → „Verifică în SAGA” / „Verifică toate” (DOAR `GetArticol`, prin ruta `/api/saga`, acțiunea
`verifica-articol`); cota TVA din fișa SAGA e doar informativă (factura poartă cota din XML).: clientul API SAGA —
`saga_cheie` (cheia REALĂ, fără instanță de test; RLS fără nicio politică, doar `service_role`; se
scrie doar din admin, cu „Salvează cheia”), `saga_blocare` (lacătul de 90 s), `saga_trimiteri`
(jurnalul, fără cheie) și patru funcții doar pentru `service_role`. Doar obiecte noi. Singurul loc care
folosește și rotește cheia e `lib/saga-api.mjs`. Pre-verificarea și pașii: jurnalul pasului 7; anularea:
`scripts/anuleaza-saga-api.sql`.
**47 e RULATĂ pe producție la 10 noiembrie 2026**, de proprietar, din SQL Editor; testele
(`scripts/verifica-saga-calcul.sql`) au dat „REZULTAT OK: toate cele 33 de verificări au trecut”
(scrisă în aceeași zi, ramura `saga-integrare`, pasul 1 din
`docs/saga-plan.md`): `calculeaza_linie_tva`, tabela `judete_coduri` + `cod_judet`,
`transport_facturabil`. Doar unelte de calcul — nu atinge niciun rând și nicio politică existentă.
Nu depinde de 46 — de aceea a putut rula înaintea ei. Pașii: `docs/saga-plan.md`, jurnalul
pasului 1; anularea: `scripts/anuleaza-saga-calcul.sql`.
**48 e RULATĂ pe producție la 10 noiembrie 2026**, de proprietar, din SQL Editor; testele au dat
„REZULTAT OK: toate cele 15 verificări au trecut (488 comenzi, 496 linii de export verificate)”, iar
exportul CSV probat local dă 200 → 165,29 + 34,71 și 350 → 289,26 + 60,74 (pasul 2): `saga_cota_tva()` (cota din
`settings.integrari.saga.cota_tva`, gol = 21 — singurul loc cu implicitul) și `export_saga_linii(bigint[])`,
folosită de exportul CSV din Admin → Facturi. Doar adaugă două funcții; depinde de 47, nu de 46.
Codul paginii Facturi din pasul 2 cheamă `export_saga_linii` — de aceea 48 a trebuit rulată ÎNAINTE
ca ramura să ajungă pe `main` (condiție îndeplinită).
**49 e RULATĂ pe producție la 10 noiembrie 2026** (pre-verificarea: 9 × true; testele: 41 OK, pe
seria de probă „TEST 04730F37”; după ele: 0 facturi, 0 serii). Nicio serie salvată încă. Pasul 4:
facturile și numerotarea —
`facturi`, `facturi_linii`, `facturi_serii`, `facturi_serii_istoric`, `is_facturare`, `emite_factura`,
`seteaza_serie_factura`, `retrage_factura` și două triggere de pază pe tabelele NOI. **Nu înlocuiește
nicio funcție existentă și nu pune nimic pe tabelele existente**; singura legătură nouă e cheia străină
`facturi.order_id → orders` cu `ON DELETE RESTRICT` (`comanda_facturata_nu_se_poate_sterge`): o comandă
CU factură nu se mai poate șterge, pe nicio cale, inclusiv `sterge_comanda`. Nicio serie și niciun număr
fix: seria („PAP FE”) și numărul de start se pun abia în ziua pornirii, din Facturi → Setări serie.
`emite_factura` refuză tot fără `settings.integrari.saga.data_start_facturare` și refuză comenzile
plasate înaintea ei (ora României). Anularea: `scripts/anuleaza-saga-facturi.sql` (refuză dacă există facturi).
Copia de siguranță cu `pg_dump`, în `/.backup/` (ignorat de git), NU a fost făcută (decizia proprietarului);
pașii ei rămân în jurnalul pasului 4. Proiectul e pe un plan cu backup zilnic Supabase (verificat de proprietar
în Database → Backups, 10 noiembrie 2026).
**50 e RULATĂ pe producție la 10 noiembrie 2026** (pre-verificarea fără `\r`: 5 × true; testele: 13 și 41
OK; după ele: 0 potriviri, 0 facturi, 0 serii). Pasul 5: tabela `saga_articole` (categorie /
subcategorie → articol SAGA, `ON DELETE CASCADE` din `categories`) și **rescrierea lui `emite_factura`**
(din 49): linia piesei ia articolul subcategoriei → al categoriei → implicitul. Migrarea are o GARDĂ:
compară amprenta (`md5(prosrc)`) lui `emite_factura` din bază cu versiunea din git (49:
`5b89a9154101aacc8d72d4d864b01356`, 50: `8eefb50d4c81c4ea93701317e9ac67ed`) și se OPREȘTE dacă diferă —
**tiparul de folosit la orice migrare care rescrie o funcție existentă**. **Amprenta se calculează
FĂRĂ `\r`: `md5(replace(prosrc, E'\r', ''))`** — SQL Editor-ul Supabase folosit de pe Windows salvează
funcțiile cu sfârșituri CRLF; `emite_factura` din producție avea `23e4b6f3…` = textul din git cu CRLF,
iar comparația brută a dat „diferă” la o funcție identică (10 noiembrie 2026). Anularea pune înapoi exact
versiunea din 49: `scripts/anuleaza-saga-articole.sql`.
**51 e RULATĂ pe producție la 10 noiembrie 2026** (pre-verificarea 5 × true; testele 16 / 13 / 41 OK;
verificarea finală 0/0/0; paginile corecte). Pasul 6: rescrie `emite_factura` (din 50) cu o
singură regulă în plus — refuză o comandă marcată deja ca facturată (`factura_serie` completat sau
`factura_status` ≠ „de_emis”: factură notată manual din SAGA, „nu se emite”, stornată); adaugă
`modifica_factura` (client + articolul pe linii, doar înainte de trimitere) și `opreste_emiterea` (nicio
serie activă); lărgește `facturi_serii_istoric.actiune` cu „oprire”. Garda: amprenta fără `\r` a lui
`emite_factura` = 50 (`8eefb50d…`) sau 51 (`a1a45bbd8ce6ad03eae408ee9d2f113e`). Anularea:
`scripts/anuleaza-saga-emitere.sql` (pune înapoi versiunea din 50).
46 (21 octombrie 2026) pregătește AWB-ul de RETUR: adaugă pe `return_requests` legătura cu
comanda (`order_id`), adresa de ridicare (`ridicare` jsonb) și câmpurile AWB-ului
(`awb`, `awb_curier_id`, `awb_generat_la`, `awb_date`). Nu atinge niciun rând și nicio politică. 45 a fost rulată la 15 septembrie 2026 abia DUPĂ ce codul din
același commit (c45162c) a apărut pe site — rulată mai devreme, codul vechi, cu `payment: "sender"`,
ar fi generat AWB-uri cu transportul plătit de firmă și nerecuperat.
45 (15 septembrie 2026) înlocuiește `seteaza_cost_livrare` (copiată din producție): transportul se
salvează în `orders.livrare`, dar NU mai intră în `orders.total` — îl încasează FAN direct de la
client. Nu atinge comenzile vechi (2 au transportul inclus în total și rămân așa).
44 (15 septembrie 2026) creează `fan_localitati`, `fan_strazi` și view-ul `fan_judete` — nomenclatorul de adrese FAN, citibil public, scris doar de `scripts/actualizeaza-nomenclator-fan.mjs`.
43 (15 septembrie 2026) adaugă `orders.awb_date` (jsonb): ce s-a declarat la FAN la AWB și ce a răspuns.
42 (15 septembrie 2026) creează `sugestie_clasificare(text[])`: numără categoriile pieselor
care se potrivesc pe tiparele de căutare, pentru completarea automată din „Adaugă piesă".
Doar echipa: revocată de la PUBLIC ȘI de la `anon` — pe Supabase funcțiile noi primesc drept
DIRECT pentru `anon`, deci `revoke ... from public` singur NU ajunge (verificat la rulare).
41 (15 septembrie 2026) adaugă `orders.observatii` (≤ 1.000 de caractere) și înlocuiește
`plaseaza_comanda`, copiată din PRODUCȚIE (identică cu 27, în afara unui comentariu) plus
observațiile, primite în `p_client`. Semnătura nu s-a schimbat. De acum sursa funcției e 41.
40 e o migrare de DATE, nu de schemă (10 septembrie 2026): desparte categoria-sac
„Senzori auto" (id 196) în opt subcategorii — radar distronic, impact pietoni, unghi
mort, impact airbag, unghi volan, nivel faruri, nivel suspensie, deschidere haion —
plus câteva piese mutate în categorii care existau deja (parcare, ploaie, presiune
gaze, ESP). Motivul: pe dez.ro fiecare dintre ele e o categorie diferită, deci 84 de
piese nu se puteau publica. Mută după titlu, într-o ordine care e regula însăși
(„Radar / Senzor blind spot" e unghi mort, nu radar), nu atinge `editat_manual`, și
lasă categoria 196 goală, dar existentă. Piesele mutate au plecat singure la dez.ro:
triggerul din 39 urmărește și `categorie_id`, și `subcategorie_id`.
39 face publicarea pe dez.ro automată: `dezro_coada`, `dezro_trezire`, trei
funcții și trei triggere pe `products` (insert / update filtrat pe coloane /
before delete), plus view-ul `dezro_coada_stare`. Nu atinge nimic existent:
niciun `drop` în afara propriilor obiecte, niciun `update` pe date vechi.
38 scoate `publicat = false` din triggerul de vânzare (și perechea lui din
`anuleaza_comanda`). Vezi blocul de decizii; pe scurt, `publicat` înseamnă de acum
„operatorul vrea piesa pe site", iar `stoc` înseamnă „piesa mai există".
37 adaugă cele patru tabele ale legăturii cu dez.ro (`dezro_catalog`, `dezro_mapari`,
`dezro_anunturi`, `dezro_jobs`) și două view-uri de numărat (`dezro_stare_piese`,
`dezro_de_retras`). Nu atinge nimic existent: niciun `drop`, niciun `update` pe date
vechi. Toate patru sunt citibile și scriibile doar de echipă.
36 activează `pg_net`, creează tabela `email_coada` (citibilă doar de echipă) și pune un
trigger `after insert` pe `orders` și pe cele patru tabele de cereri.
35 adaugă generația „Škoda Superb 1" (2001–2008), care lipsea din `models`, și mută pe ea
cele 4 piese cu „Superb 1"/„Superb 3U" în titlu care stăteau greșit pe Superb 2 — importul
alesese generația prin suprapunere de ani, iar „2005–2008" atinge „2008–2015" într-un singur
an. Sursa nu scrie NICIODATĂ „Skoda Superb 1" (numărat: „Superb 3" 97 de piese, „Superb"
fără cifră 92, „Superb 2" 66), deci un import viitor nu va lega singur nimic de ea.
34 e migrarea care face paginile de mașină să se umple singure: adaugă coloana
calculată `products.nr_modele` (câte modele are piesa în `model_ids` — cheia de
ordonare după relevanță) și view-ul `numar_piese_compatibile_pe_masina`. Nu
șterge și nu modifică niciun rând.
33 deschide public, printr-o singură funcție, id-urile de măsurare (GA4, Google Ads +
eticheta de conversie, Meta Pixel, codul de verificare a domeniului Meta). Același motiv
ca la 30: rândul `settings.integrari` NU e citibil public, fiindcă acolo stau parola FAN
Courier și cheia privată Netopia. `ga4_public()` din 30 rămâne, neatinsă.
27 înlocuiește `plaseaza_comanda`, copiată integral din 12 cu o gardă adăugată la început;
dacă modifici vreodată funcția în 12, o modifici și acolo. Înainte de a o rula s-a comparat
mecanic funcția din 12 cu cea din 27: identice, în afară de cele 7 linii ale gărzii. Fă la fel
înainte de orice re-rulare, altfel un `create or replace` poate da înapoi tăcut o modificare
făcută între timp direct în bază.
23 dă rolului `operator` dreptul de CITIRE pe piese și pe cele patru tabele de cereri — fără el
scria fără să poată citi, iar `scrieVerificat()` (care cere înapoi rândul atins) ar fi raportat
eșec la o scriere reușită.
28 face din `vehicles` o pagină publică: adaugă `poze`, `descriere`, `publicat`, `motorizare`,
`caroserie`, `culoare`, `cutie_viteze`, `km`, plus `marca_id`/`model_id` (marca și modelul ca DATE,
nu ca text în `nume`), și schimbă citirea publică din `using (true)` în `publicat = true or is_staff()`,
ca o mașină nepublicată să dea 404 și prin REST, nu doar în cod.
24 adaugă coloanele de ani pe `models` și mută două modele așezate greșit („MG 3" și „XC 40"
stăteau sub Volkswagen); 25 adaugă mărcile lipsă și redenumește „KGM Ssangyong" în „SsangYong".
Sunt independente între ele, dar codul din `lib/import/` le presupune pe amândouă rulate.

