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
- **Anunțurile vechi de pe cont (peste 2.000, puse manual, inactive) NU se ating** (decizia proprietarului,
  13 noiembrie 2026): nici activare, nici ștergere, nici preluare, și nu contează la garda de dublură. Tot catalogul
  se publică ca anunțuri NOI. Garda preia doar un anunț creat de aplicație (după revendicarea rândului piesei).
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
| ștergerea cere întâi dezactivare | vândută → `deactivate` + `is_success: true`; nepublicată/ștearsă → DOAR `deactivate` (`is_success: false`), niciodată `DELETE` (13 noiembrie 2026, cerut de OLX) |
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
  nepublicată / ștearsă de pe site → DOAR deactivate (`is_success: false`), niciodată DELETE — OLX a spus că ștergerea
  dă eroare (13 noiembrie 2026); `DELETE` e scos din lista de apeluri permise. Plasa de 20% la retrageri, ca la dez.ro.
- „Anunțuri OLX”: filtrele active / respinse / limited / erori; „Publică tot catalogul pe OLX” în ritm controlat, cu
  progres și „Oprește”. (Pasul „Citește anunțurile existente” a fost SCOS — vezi decizia din 13 noiembrie 2026.)
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

**Corectura din 13 noiembrie 2026 — testul pasului 1 a picat**
Rezultatul la prima rulare: pre-verificarea 4 × true, migrarea 56 Success, dar `scripts/verifica-olx-conexiune.sql` a dat
„VERIFICARE PICATĂ: state-ul corect nu a fost acceptat”.

*Cauza.* Rândul unic din `olx_cont` EXISTĂ (migrarea îl creează cu `insert … on conflict do nothing`). Defectul era în
`olx_consuma_starea`:
```sql
update public.olx_cont
   set stare_oauth = null, stare_oauth_expira = null, stare_oauth_de = null
 where … stare_oauth = p_stare …
returning stare_oauth_de into v_de;
```
`RETURNING` întoarce valorile DE DUPĂ `SET`. `stare_oauth_de` tocmai fusese pus pe null, deci funcția întorcea mereu
null, chiar la un state corect. Fără corectură, „Conectează OLX” ar fi răspuns mereu „cererea nu e recunoscută”.
Testul a prins exact defectul ăsta.

*Corectura* (direct în `supabase/olx-conexiune.sql`, fără migrare nouă — funcția e nouă și n-o folosește nimic încă):
citește întâi cine a cerut conectarea, blocând rândul cu `for update`, apoi golește câmpurile. Blocarea păstrează și
garanția „o singură folosire” la două cereri simultane. Migrarea se poate re-rula fără efecte: tabelele și rândul există,
politicile se refac la fel, funcțiile se înlocuiesc. Amprenta corectă (fără `\r`): `3b6e1dee251e95633806cf41792c3fca`.
Commit `89aa803` pe `olx-integrare`, nimic pe `main`.

*SQL doar de citire, pentru confirmare:*
```sql
select
  (select count(*) from public.olx_cont where unic)                                    as randuri_olx_cont,      -- așteptat: 1
  pg_get_functiondef('public.olx_consuma_starea(text)'::regprocedure)
    ~ 'returning stare_oauth_de'                                                        as are_returning_gresit,  -- înainte de corectură: true
  md5(replace((select prosrc from pg_proc where oid = 'public.olx_consuma_starea(text)'::regprocedure), E'\r', ''))
                                                                                         as amprenta;
```

*Ce rulezi, în ordine, din SQL Editor:*
1. SQL-ul de mai sus → `1 | true | <altă amprentă>` (cauza confirmată).
2. `supabase/olx-conexiune.sql`, tot, din nou → **Success**.
3. SQL-ul de mai sus, din nou → `1 | false | 3b6e1dee251e95633806cf41792c3fca`.
4. `scripts/verifica-olx-conexiune.sql` → căsuța roșie: **„REZULTAT OK: browserul nu vede tokenii, state-ul merge o
   singură dată, lacătul e exclusiv …”**.

Dacă la pasul 3 amprenta iese altfel, rezultatul se trimite înainte de test.

**Rezultat (13 noiembrie 2026):** migrarea 56 corectată, re-rulată Success; `verifica-olx-conexiune.sql` REZULTAT OK.
Pasul 1 unit în `main` și trimis pe producție. Callback-ul înregistrat la OLX: `https://autopas-dezmembrari.ro/api/olx/callback`
(aplicația e în așteptarea confirmării OLX).

**Deploy (13 noiembrie 2026):** pasul 1 unit în `main` (fast-forward, `bad2fbf`), push, deploy gata în ~75 s.
`https://autopas-dezmembrari.ro/api/olx/callback` răspunde 303 → Integrări („Lipsesc code sau state” — corect, fără OLX).

---

## Jurnalul pasului 2, partea fără OLX (13 noiembrie 2026) — ramura `olx-integrare`, fără push
Publicarea reală (POST / PUT / dezactivare / reactivare) se face după aprobarea aplicației de către OLX.

**Ce s-a făcut**
- `lib/olx-anunt.mjs` — generatorul (fără bază, fără rețea): titlu 16–150, descriere 80–9000, scoate telefon / e-mail /
  www, reduce majusculele, taie semnele repetate (≥ 3 → 2), completează descrierea prea scurtă cu o frază adevărată
  („Piesă auto second-hand, din dezmembrări. Se poate livra prin curier în toată țara.”), preț RON, poze prin conversia
  JPEG (`/feed/poze/…jpg`, ca la pieseauto.ro) până la `photos_limit` (implicit 8), oraș + contact din setări,
  `business`, `external_id` = `cod_intern`, `external_url` = pagina piesei, `courier`, `auto_extend_enabled`,
  categoria (subcategorie → categorie) + atributele din potrivire. După curățare, textul e verificat din nou: dacă tot
  încalcă o regulă, piesa NU pleacă. Plus amprenta corpului (pentru actualizări doar la schimbare, pasul 3).
- Pagina piesei (`/admin/produse/[id]`): caseta „OLX” → „Previzualizează anunțul OLX” (anunțul exact, ce s-a corectat,
  de ce nu s-ar putea publica). Doar citire.
- `/admin/olx` („Anunțuri OLX” în meniu, admin + operator): „Raport pe tot catalogul”.
- Ruta `/api/olx`: acțiunile `previzualizeaza` și `raport` (toată echipa, NU cheamă OLX). `lib/olx.ts`: `contextAnunt()`.

**Decizie: majusculele se numără ca la OLX — din tot textul, nu doar din litere.** Măsurat: raportat la litere, 204
titluri ar fi picat („Supapa EGR Vw Caddy 1.9 TDI BKC BXE…”) și ar fi ieșit stâlcite („Injectoare bmw…”). Varianta pe
litere rămâne RISC raportat; se lămurește la proba reală, cu un titlu din lista aceea.

**Raportul pe catalogul real** (8.744 de piese publicate cu stoc, citire din bază, fără potriviri de categorii încă):
| | piese |
|---|---|
| text brut care ar fi fost REFUZAT de OLX | **33** |
| · descriere cu 3 semne la rând („!!!”) | 31 |
| · titlu cu peste 50% majuscule | 1 (AP-001831) |
| · descriere sub 80 de caractere | 1 (AP-008861) |
| după curățarea automată, încă refuzate de regulile de text | **0** |
| risc: titlu cu peste 50% majuscule dacă OLX numără doar literele | 203 |
| risc: cod de 10 cifre care începe cu 0, poate fi luat drept telefon (coduri Bosch: 0445110743, 0280751016) — păstrat | 118 |
| poze peste limita de 8 (se trimit primele 8) | 6 |
| fără nicio poză (AP-004042) | 1 |
Singurul motiv de nepublicare rămas: categoriile fără potrivire OLX (toate, până se fac potrivirile).

**Cum se verifică (după push pe ramură / preview):** Admin → o piesă → „Previzualizează anunțul OLX”; Admin →
Anunțuri OLX → „Raport pe tot catalogul” — cifrele de mai sus, plus „nu se pot publica: categoria piesei n-are potrivire
OLX” până se fac potrivirile.

**De lămurit la proba reală**: majusculele (un titlu din cele 203), un cod Bosch în descriere, `auto_extend_enabled`
(cost?), `product_safety_regulation`, `external_url` permis sau nu.

**Deploy (13 noiembrie 2026):** pasul 2 fără OLX unit în `main` (fast-forward, `51c22b5`), push, deploy gata în ~75 s:
`/admin/olx` răspunde 200; `/api/olx` fără sesiune → 401 (corect). **În așteptare**: aprobarea aplicației de către OLX.
După ea, proprietarul pune client_id / client_secret în Integrări → „OLX — anunțuri”, se conectează, testează conexiunea;
apoi: potrivirea categoriilor și primul anunț real (restul pasului 2).

---

## Pasul 2, partea cu OLX (13 noiembrie 2026) — ramura `olx-integrare`, fără push
**Starea contului** (citită din bază, fără tokeni): aplicația 201031 aprobată; conectat ca „AutoPas”, cont business;
scope `v2 read write`; setări: Bistrița, Neamț (`city_id` 42861), contact „Autopas Dezmembrari”, 0743627151.
⚠ „Testează conexiunea” a citit 21 de pagini de câte 100 → **contul are deja peste 2.000 de anunțuri pe OLX**. Înainte
de publicarea în masă (pasul 3) se lămurește de unde vin (manual? altă sincronizare, de ex. pieseauto.ro?) — altfel se
dublează catalogul pe OLX. Pentru proba pe O piesă nu contează.

**Ce s-a făcut**
- Migrarea 57 `supabase/olx-anunturi.sql`: `olx_anunturi` — un singur rând pe piesă (`product_id` unic), `advert_id`
  unic, `on delete set null` (anunțul unei piese șterse rămâne cunoscut, ca să poată fi retras). Scrie doar serverul.
- `lib/olx-publicare.mjs` — `publica`, `actualizeaza` (PUT), `improspateaza` (stare + motivul de moderare),
  `comanda` (deactivate cu `is_success` / activate). **Un singur anunț pe piesă**: rândul se revendică înainte de POST,
  iar înainte de POST se caută la OLX un anunț cu același `external_id` (cod_intern) și, dacă există, se preia.
  **Nimic plătit**: `activate` e refuzat pe un anunț „limited”. `external_url` refuzat de OLX → se renunță la el
  automat și definitiv (setarea `external_url: false`).
- Ruta `/api/olx`: `publica`, `actualizeaza`, `dezactiveaza` (`vanduta`), `activeaza`, `improspateaza` — doar admin.
- Pagina piesei, caseta „OLX”: starea anunțului, link „vezi pe OLX”, motivul respingerii, ultima eroare; butoanele
  Publică / Actualizează / Reîmprospătează / Dezactivează / Dezactivează — vândută / Activează (dezactivat pe „limited”).

**Ce rulezi (SQL Editor), în ordine**
1. `scripts/pre-verifica-olx-anunturi.sql` → **3 × true**.
2. `supabase/olx-anunturi.sql` → **Success**.
3. `scripts/verifica-olx-anunturi.sql` → căsuța roșie: **„REZULTAT OK: un singur anunț pe piesă, advert_id unic,
   browserul nu scrie, anunțul supraviețuiește piesei …”**.
Apoi confirmi, iar ramura se unește în `main` (codul cere tabela — de aceea migrarea întâi).

**Proba pe un anunț real (după deploy)**
1. Anunțuri OLX → Potrivirea categoriilor → „Adu categoriile OLX”; potrivești categoria piesei de probă (ex. „Faruri”)
   cu categoria finală OLX și atributele cerute (starea: folosit).
2. Pe pagina piesei: „Previzualizează anunțul OLX” → fără motive de blocare → „Publică pe OLX”. Stare: „nou — în
   moderare”; după câteva secunde „Reîmprospătează starea” → „activ”, cu link. Verifici anunțul pe OLX.
3. Schimbi prețul piesei, salvezi → „Actualizează pe OLX” → prețul nou pe OLX.
4. „Dezactivează” → stare „dezactivat”; „Activează” → „activ” din nou.
5. Îmi trimiți ce s-a văzut, plus: textul la majuscule / cod Bosch (dacă piesa are), poze, `auto_extend`, orice eroare.

**Rezultat (13 noiembrie 2026):** migrarea 57 rulată — pre-verificarea 3 × true, Success, `verifica-olx-anunturi.sql`
REZULTAT OK. **Decizie**: cele peste 2.000 de anunțuri vechi de pe cont sunt puse manual, inactive, și nu se reactivează —
nu se ating (activare / ștergere / preluare) și nu contează la garda de dublură; catalogul se publică ca anunțuri noi.
Pasul „Citește anunțurile existente / câte par aceleași piese” a fost scos din plan. Garda din `lib/olx-publicare.mjs`
preia acum doar un anunț cu același `external_id` creat DUPĂ revendicarea rândului (marjă de 6 h pentru fusul orar).
Pasul 2 (partea cu OLX) unit în `main`.

**Potrivirea categoriilor — făcută automat (13 noiembrie 2026), `scripts/olx-potriveste-categorii.mjs`.**
Catalogul OLX adus întreg dintr-o cerere (`GET /categories` = 2.502 categorii; 280 de frunze sub „Piese auto”) în
`olx_categorii`, cu căile. Cheia = categoria pe care o folosește generatorul (subcategoria piesei, altfel categoria):
**291 de chei, 8.746 de piese**. Pentru fiecare: `/categories/suggestion` pe 5 titluri reale + pe numele categoriei.
202 au ieșit sigure (≥ 60% + numele, sau ≥ 80% din ≥ 3); 89 se contraziceau și au fost alese după nume, din lista
frunzelor; plus 9 corecturi la cele „sigure” care nimeriseră greșit (Planșă bord → Airbag-uri, Volantă → Ambreiaje,
Spoilere → Bare…). Toate deciziile după nume: `scripts/olx-corectii-categorii.json` (`--corectii=`).
**Atributele**: nicio frunză aleasă nu cere un atribut obligatoriu; se trimite peste tot `state = used`
(„Second Hand”), opțional. „Marca”, „Model”, „Codul piesei”, „Poziție” există ca opționale — neatinse deocamdată.
**De verificat de om** (scrise, dar alese cu îndoială): „EGR și Clapetă accelerație” (amestec, → Clapete),
„Radiatoare și Ventilatoare” (amestec, → Radiatoare), „Alternator” (OLX n-are frunză, → Electromotoare și piese),
cele patru categorii-sac („Alte piese de caroserie”, „Alte piese Electrică & Electronică”, „Diverse”, „Diverse
accesorii auto”), „Calculator ABS” și „Senzor MAP” (alese după nume; piesele din ele par puse greșit la noi).
**Limită măsurată**: OLX (CloudFront) a blocat IP-ul cu 403 „Request blocked” după ~700 de sugestii la rând; s-a
ridicat singur în câteva minute. Scriptul are pauză de 1,5 s între sugestii și cache (`--cache=`).
**Raportul pe catalog după potrivire**: 8.746 / 8.746 gata de publicat, 0 blocate. Riscuri (doar raportate):
203 titluri cu > 50% majuscule numărate pe litere, 118 coduri care pot părea telefon, 1 piesă fără poze.
Corecturi automate: 31 de descrieri cu semne repetate, 1 titlu la majuscule, 1 descriere completată.

### Potrivirile scrise în olx_mapari (13 noiembrie 2026) — lista completă
291 de categorii, 8.746 de piese publicate cu stoc. Toate căile OLX încep cu „Piese și accesorii ›”. Atributul trimis peste tot: `state = used` („Second Hand”). Coloana „Cum” spune de unde vine alegerea: **sugestii** = majoritatea sugestiilor OLX pe titluri (+ nume); **nume** = sugestiile se contraziceau, ales după numele categoriei; **corectat** = sugestiile nimeriseră greșit, ales după nume; ⚠ = de verificat de om (tabelul de mai jos).

| # | Categoria noastră | Categoria OLX | Piese | Cum |
|---|---|---|---|---|
| 1 | Optică și faruri › Faruri | Piese auto › Iluminare › Faruri și elemente de iluminat | 360 | sugestii |
| 2 | Caroserie și exterior › Grile și ornamente | Piese auto › Piese de caroserie › Ornamente caroserie | 347 | sugestii |
| 3 | Motor și anexe › EGR și Clapetă acceleratie | Piese auto › Motoare și accesorii › Clapete de accelerație | 324 | ⚠ nume |
| 4 | Caroserie și exterior › Bară spate | Piese auto › Piese de caroserie › Bare de protecție | 290 | sugestii |
| 5 | Optică și faruri › Stopuri | Piese auto › Iluminare › Lămpi spate și elemente | 257 | sugestii |
| 6 | Caroserie și exterior › Bară față | Piese auto › Piese de caroserie › Bare de protecție | 253 | sugestii |
| 7 | Motor și anexe › Radiatoare și Ventilatoare | Piese auto › Sistem de răcire a motorului › Radiatoare | 229 | ⚠ nume |
| 8 | Caroserie și exterior › Oglinzi complete | Piese auto › Piese de caroserie › Oglinzi exterioare | 224 | sugestii |
| 9 | Motor și anexe › Electromotor | Piese auto › Sistem electric, aprindere › Electromotoare și piese | 190 | sugestii |
| 10 | Electrice și senzori › Airbag-uri și centuri | Piese auto › Echipament interior › Airbag-uri | 189 | sugestii |
| 11 | Caroserie și exterior › Ușă spate | Piese auto › Piese de caroserie › Uși | 150 | sugestii |
| 12 | Electrice și senzori › Alternator | Piese auto › Sistem electric, aprindere › Electromotoare și piese | 144 | ⚠ nume |
| 13 | Cutie de viteze și transmisie › Cutie de viteze | Piese auto › Sistem de transmisie › Cutii de viteze | 140 | sugestii |
| 14 | Caroserie și exterior › Grilă radiator | Piese auto › Piese de caroserie › Grile radiator | 140 | sugestii |
| 15 | Cutie de viteze și transmisie › Planetare și cardan | Piese auto › Sistem de transmisie › Planetare, articulații arbori | 138 | sugestii |
| 16 | Motor și anexe › Injectoare și rampă | Piese auto › Sistem de alimentare cu combustibil › Injectoare | 136 | sugestii |
| 17 | Climatizare (AC) și încălzire › Compresor AC | Piese auto › Sistem de climatizare › Compresoare de aer condiționat | 133 | sugestii |
| 18 | Caroserie și exterior › Ușă față | Piese auto › Piese de caroserie › Uși | 126 | sugestii |
| 19 | Motor și anexe › Turbine | Piese auto › Motoare și accesorii › Turbocompresoare | 124 | sugestii |
| 20 | Caroserie și exterior › Ștergătoare și spălare parbriz | Piese auto › Ștergătoare și pulverizatoare › Mecanisme ștergătoare | 122 | sugestii |
| 21 | Motor și anexe › Intercooler | Piese auto › Sistem de răcire a motorului › Intercoolere | 120 | sugestii |
| 22 | Electrice și senzori › Calculator ECU | Piese auto › Sistem electric, aprindere › Unități de control motor | 111 | sugestii |
| 23 | Caroserie și exterior › Capotă | Piese auto › Piese de caroserie › Capote | 105 | sugestii |
| 24 | Caroserie și exterior › Aripă față | Piese auto › Piese de caroserie › Aripi | 101 | sugestii |
| 25 | Motor și anexe › Motor complet | Piese auto › Motoare și accesorii › Motoare complete | 98 | sugestii |
| 26 | Sistem de frânare › Pompă ABS | Piese auto › Sistem de frânare › Sistem ABS și ESP | 97 | sugestii |
| 27 | Optică și faruri › Bloc xenon și balast | Piese auto › Iluminare › Controlere lumini | 91 | sugestii |
| 28 | Caroserie și exterior › Haion | Piese auto › Piese de caroserie › Capace de portbagaj | 89 | sugestii |
| 29 | Suspensie și direcție › Fuzete și rulmenți | Piese auto › Sistem de suspensie › Fuzete | 84 | sugestii |
| 30 | Suspensie și direcție › Pompă servodirecție | Piese auto › Sistem de direcție › Pompe de servo | 82 | sugestii |
| 31 | Caroserie și exterior › Aripă spate | Piese auto › Piese de caroserie › Aripi | 81 | sugestii |
| 32 | Filtre auto › Carcasă filtru aer | Piese auto › Motoare și accesorii › Carcase filtre aer | 80 | sugestii |
| 33 | Caroserie și exterior › Alte piese de caroserie | Piese auto › Piese de caroserie › Elemente de caroserie | 78 | ⚠ nume |
| 34 | Motor și anexe › Pompă injecție | Piese auto › Sistem de alimentare cu combustibil › Pompe de injecție | 74 | sugestii |
| 35 | Caroserie și exterior › Trager | Piese auto › Piese de caroserie › Panouri față și spate | 74 | nume |
| 36 | Caroserie și exterior › Vas lichid parbriz | Piese auto › Ștergătoare și pulverizatoare › Rezervoare lichid de parbriz | 74 | sugestii |
| 37 | Electrice și senzori › Calculator lumini | Piese auto › Iluminare › Controlere lumini | 73 | nume |
| 38 | Caroserie și exterior › Spoilere | Piese auto › Piese de caroserie › Spoilere | 71 | corectat |
| 39 | Climatizare (AC) și încălzire › Radiator AC (condensator) | Piese auto › Sistem de climatizare › Radiator de climatizare | 70 | sugestii |
| 40 | Suspensie și direcție › Casetă direcție | Piese auto › Sistem de direcție › Casete de direcție | 68 | sugestii |
| 41 | Roți, jante și anvelope › Jante | Anvelope și jante › Jante › Pentru mașini | 64 | sugestii |
| 42 | Motor și anexe › Capac motor | Piese auto › Motoare și accesorii › Capace motor | 63 | sugestii |
| 43 | Caroserie și exterior › Praguri | Piese auto › Piese de caroserie › Praguri | 62 | sugestii |
| 44 | Electrice și senzori › Senzori motor | Piese auto › Motoare și accesorii › Debitmetre | 60 | sugestii |
| 45 | Climatizare (AC) și încălzire › Aerotermă | Piese auto › Sistem de ventilație › Motoare ventilatoare | 59 | sugestii |
| 46 | Caroserie și exterior › Armatură bară față | Piese auto › Piese de caroserie › Bare de protecție | 59 | sugestii |
| 47 | Caroserie și exterior › Carenaj roată | Piese auto › Piese de caroserie › Aripi interioare | 56 | sugestii |
| 48 | Caroserie și exterior › Broaște și încuietori | Piese auto › Piese de caroserie › Încuietoare uși | 54 | sugestii |
| 49 | Climatizare (AC) și încălzire › Conducte și furtunuri AC | Piese auto › Sistem de climatizare › Conducte de climatizare | 53 | sugestii |
| 50 | Motor și anexe › Pompă vacuum | Piese auto › Motoare și accesorii › Pompe de vid | 52 | sugestii |
| 51 | Accesorii auto › Senzori parcare | Piese auto › Sistem electric, aprindere › Senzori | 52 | sugestii |
| 52 | Motor și anexe › Rampă injectoare | Piese auto › Sistem de alimentare cu combustibil › Rampe de injecție | 47 | sugestii |
| 53 | Caroserie și exterior › Grilă bară | Piese auto › Piese de caroserie › Grile radiator | 46 | sugestii |
| 54 | Interior și tapițerie › Ceasuri bord | Piese auto › Echipament interior › Instrumente de bord, ceasuri | 45 | sugestii |
| 55 | Electrice și senzori › Alte piese Electrică & Electronică | Piese auto › Sistem electric, aprindere › Echipament electric | 44 | ⚠ nume |
| 56 | Optică și faruri › Proiectoare auto | Piese auto › Iluminare › Faruri și elemente de iluminat | 44 | sugestii |
| 57 | Electrice și senzori › Calculator confort | Piese auto › Sistem electric, aprindere › Echipament electric | 43 | nume |
| 58 | Motor și anexe › Pompă motorină din rezervor | Piese auto › Sistem de alimentare cu combustibil › Pompe de combustibil | 43 | sugestii |
| 59 | Motor și anexe › Pompă apă | Piese auto › Sistem de răcire a motorului › Pompe de apă | 42 | sugestii |
| 60 | Caroserie și exterior › Grilă proiector | Piese auto › Piese de caroserie › Grile radiator | 41 | sugestii |
| 61 | Caroserie și exterior › Armatură bară spate | Piese auto › Piese de caroserie › Bare de protecție | 40 | sugestii |
| 62 | Cutie de viteze și transmisie › Volantă | Piese auto › Sistem de transmisie › Volante de inerție | 40 | corectat |
| 63 | Electrice și senzori › Bloc lumini | Piese auto › Iluminare › Controlere lumini | 39 | sugestii |
| 64 | Interior și tapițerie › Guri ventilație | Piese auto › Echipament interior › Grile de ventilație | 39 | sugestii |
| 65 | Electrice și senzori › Motoraș ștergătoare | Piese auto › Ștergătoare și pulverizatoare › Motoare ștergătoare | 38 | sugestii |
| 66 | Interior și tapițerie › Display | Piese auto › Echipament interior › Echipament audio de fabrică | 36 | nume |
| 67 | Caroserie și exterior › Difuzor bara spate | Piese auto › Piese de caroserie › Bare de protecție | 35 | sugestii |
| 68 | Suspensie și direcție › Brațe și bascule | Piese auto › Sistem de suspensie › Brațe de suspensie și elemente | 33 | sugestii |
| 69 | Optică și faruri › Lumini de zi | Piese auto › Iluminare › Faruri și elemente de iluminat | 33 | nume |
| 70 | Motor și anexe › Baie ulei | Piese auto › Motoare și accesorii › Ungere motor | 32 | sugestii |
| 71 | Motor și anexe › Galerie admisie | Piese auto › Motoare și accesorii › Galerii de admisie | 32 | sugestii |
| 72 | Sistem de frânare › Tulumbă frână | Piese auto › Sistem de frânare › Asistență la frânare | 30 | sugestii |
| 73 | Electrice și senzori › Panou de siguranțe | Piese auto › Sistem electric, aprindere › Cutii de siguranțe | 29 | sugestii |
| 74 | Suspensie și direcție › Punte spate | Piese auto › Sistem de suspensie › Grinzi de suspensie | 29 | sugestii |
| 75 | Electrice și senzori › Radar distronic (ACC) | Piese auto › Sistem electric, aprindere › Senzori | 29 | sugestii |
| 76 | Caroserie și exterior › Suport far | Piese auto › Piese de caroserie › Suporturi, prinderi | 29 | sugestii |
| 77 | Interior și tapițerie › Plansa bord | Piese auto › Echipament interior › Planșe de bord, console | 28 | corectat |
| 78 | Motor și anexe › Suporți motor | Piese auto › Motoare și accesorii › Suspensie motor | 28 | sugestii |
| 79 | Sistem de frânare › Etriere | Piese auto › Sistem de frânare › Frâne cu disc | 27 | nume |
| 80 | Interior și tapițerie › Volane | Piese auto › Echipament interior › Volane | 26 | sugestii |
| 81 | Caroserie și exterior › Cadru motor | Piese auto › Sistem de suspensie › Grinzi de suspensie | 25 | sugestii |
| 82 | Caroserie și exterior › Capotă portbagaj | Piese auto › Piese de caroserie › Capote | 25 | sugestii |
| 83 | Caroserie și exterior › Broască haion | Piese auto › Piese de caroserie › Încuietoare uși | 24 | sugestii |
| 84 | Interior și tapițerie › Ornamente | Piese auto › Piese de caroserie › Ornamente caroserie | 24 | sugestii |
| 85 | Motor și anexe › Ornament tobă | Piese auto › Sistem de evacuare › Capete de eșapament | 23 | nume |
| 86 | Accesorii auto › Cameră video auto | Accesorii auto › Electronică auto › Senzori și camere de marșarier | 22 | nume |
| 87 | Interior și tapițerie › Centuri de siguranță | Piese auto › Echipament interior › Centuri de siguranță | 22 | sugestii |
| 88 | Electrice și senzori › Contact și cheie | Piese auto › Sistem electric, aprindere › Contacte și chei | 22 | sugestii |
| 89 | Caroserie și exterior › Braț ștergător | Piese auto › Ștergătoare și pulverizatoare › Brațe ștergătoare | 21 | sugestii |
| 90 | Interior și tapițerie › Torpedou | Piese auto › Echipament interior › Compartimente, rafturi | 21 | sugestii |
| 91 | Caroserie și exterior › Balamale | Piese auto › Piese de caroserie › Piese de montaj | 20 | nume |
| 92 | Caroserie și exterior › Flaps bară | Piese auto › Piese de caroserie › Bare de protecție | 20 | sugestii |
| 93 | Electrice și senzori › Senzor presiune gaze evacuare | Piese auto › Sistem de evacuare › Senzori de presiune gaze de eșapament | 20 | sugestii |
| 94 | Caroserie și exterior › Emblemă | Accesorii auto › Embleme | 18 | nume |
| 95 | Motor și anexe › Bobină inducție | Piese auto › Sistem electric, aprindere › Bobine de inducție | 17 | sugestii |
| 96 | Cutie de viteze și transmisie › Cutie de transfer | Piese auto › Sistem de transmisie › Cutii de viteze | 17 | sugestii |
| 97 | Cutie de viteze și transmisie › Cardan | Piese auto › Sistem de transmisie › Cardane și arbori de transmisie | 16 | sugestii |
| 98 | Interior și tapițerie › Poliță portbagaj | Piese auto › Echipament interior › Rafturi spate | 16 | sugestii |
| 99 | Motor și anexe › Vas expansiune | Piese auto › Sistem de răcire a motorului › Rezervoare de expansiune | 16 | sugestii |
| 100 | Interior și tapițerie › Butoane geamuri electrice | Piese auto › Echipament interior › Intrerupatoare, panouri de control | 15 | sugestii |
| 101 | Electrice și senzori › Calculator parcare | Piese auto › Sistem electric, aprindere › Senzori | 15 | sugestii |
| 102 | Motor și anexe › Capac chiulasă | Piese auto › Motoare și accesorii › Capace motor | 15 | sugestii |
| 103 | Motor și anexe › Furtun intercooler turbo | Piese auto › Motoare și accesorii › Conducte aer | 15 | nume |
| 104 | Climatizare (AC) și încălzire › Panou comandă AC climă | Piese auto › Sistem de climatizare › Unități de control climatizare | 15 | sugestii |
| 105 | Electrice și senzori › Senzor impact pietoni | Piese auto › Echipament interior › Airbag-uri | 15 | sugestii |
| 106 | Caroserie și exterior › Spălător faruri | Piese auto › Ștergătoare și pulverizatoare › Duze faruri | 15 | sugestii |
| 107 | Suspensie și direcție › Ansamblu amortizor arc | Piese auto › Sistem de suspensie › Amortizoare și elemente | 13 | sugestii |
| 108 | Motor și anexe › Carcasă filtru ulei | Piese auto › Motoare și accesorii › Ungere motor | 13 | sugestii |
| 109 | Car audio › CD player auto | Piese auto › Echipament interior › Echipament audio de fabrică | 13 | sugestii |
| 110 | Motor și anexe › Fulie vibrochen | Piese auto › Motoare și accesorii › Sistem curea accesorii | 13 | sugestii |
| 111 | Electrice și senzori › Macara geam electric | Piese auto › Echipament interior › Manivele geamuri | 13 | nume |
| 112 | Caroserie și exterior › Scut motor plastic | Piese auto › Piese de caroserie › Scuturi și protecții | 13 | sugestii |
| 113 | Caroserie și exterior › Scut sub bară | Piese auto › Piese de caroserie › Scuturi și protecții | 13 | sugestii |
| 114 | Electrice și senzori › Senzor unghi mort | Piese auto › Sistem electric, aprindere › Senzori | 13 | sugestii |
| 115 | Motor și anexe › Tubulatură intercooler | Piese auto › Motoare și accesorii › Conducte aer | 13 | sugestii |
| 116 | Suspensie și direcție › Amortizoare | Piese auto › Sistem de suspensie › Amortizoare și elemente | 12 | sugestii |
| 117 | Suspensie și direcție › Coloană direcție | Piese auto › Sistem de direcție › Coloane de direcție | 12 | sugestii |
| 118 | Electrice și senzori › Motoraș macara geam | Piese auto › Echipament interior › Manivele geamuri | 12 | corectat |
| 119 | Navigație GPS › Navigație originală | Piese auto › Echipament interior › Echipament audio de fabrică | 12 | sugestii |
| 120 | Electrice și senzori › Senzor NOx | Piese auto › Sistem de evacuare › Sonde lambda | 12 | nume |
| 121 | Cutie de viteze și transmisie › Suport cutie viteze | Piese auto › Sistem de transmisie › Piese cutie de viteze | 12 | sugestii |
| 122 | Car audio › Boxe auto | Piese auto › Echipament interior › Echipament audio de fabrică | 11 | sugestii |
| 123 | Motor și anexe › Chiulasă | Piese auto › Motoare și accesorii › Chiulase cilindri | 11 | sugestii |
| 124 | Tuning › Eleron | Piese auto › Piese de caroserie › Spoilere | 11 | nume |
| 125 | Motor și anexe › Pompă rezervor | Piese auto › Sistem de alimentare cu combustibil › Pompe de combustibil | 11 | sugestii |
| 126 | Electrice și senzori › Calculator airbag | Piese auto › Echipament interior › Airbag-uri | 10 | sugestii |
| 127 | Accesorii auto › Cameră marșarier | Accesorii auto › Electronică auto › Senzori și camere de marșarier | 10 | sugestii |
| 128 | Interior și tapițerie › Oglindă retrovizoare | Piese auto › Piese de caroserie › Oglinzi exterioare | 10 | nume |
| 129 | Motor și anexe › Rampă retur injectoare | Piese auto › Sistem de alimentare cu combustibil › Rampe de injecție | 10 | sugestii |
| 130 | Caroserie și exterior › Suporți prindere bară | Piese auto › Piese de caroserie › Suporturi, prinderi | 10 | sugestii |
| 131 | Motor și anexe › Alte piese răcire | Piese auto › Sistem de răcire a motorului › Altele | 9 | nume |
| 132 | Electrice și senzori › Baterie și borne | Piese auto › Sistem electric, aprindere › Carcase baterii | 9 | corectat |
| 133 | Climatizare (AC) și încălzire › Climatronic | Piese auto › Sistem de climatizare › Unități de control climatizare | 9 | sugestii |
| 134 | Motor și anexe › Curele și distribuție | Piese auto › Motoare și accesorii › Distribuție | 9 | sugestii |
| 135 | Motor și anexe › Electrovalvă | Piese auto › Motoare și accesorii › Supape de vacuum | 9 | sugestii |
| 136 | Caroserie și exterior › Mâner haion | Piese auto › Piese de caroserie › Încuietoare uși | 9 | nume |
| 137 | Motor și anexe › Pistoane | Piese auto › Motoare și accesorii › Pistoane, segmenți și biele | 9 | sugestii |
| 138 | Caroserie și exterior › Suport baterie auto | Piese auto › Piese de caroserie › Suporturi, prinderi | 9 | sugestii |
| 139 | Interior și tapițerie › Alte butoane | Piese auto › Echipament interior › Intrerupatoare, panouri de control | 8 | sugestii |
| 140 | Electrice și senzori › Calculator frână mână | Piese auto › Sistem de frânare › Frâne de parcare | 8 | sugestii |
| 141 | Cutie de viteze și transmisie › Diferențiale | Piese auto › Sistem de transmisie › Diferențiale | 8 | sugestii |
| 142 | Electrice și senzori › Manetă tempomat | Piese auto › Echipament interior › Intrerupatoare, panouri de control | 8 | sugestii |
| 143 | Electrice și senzori › Pedală accelerație | Piese auto › Echipament interior › Pedale | 8 | sugestii |
| 144 | Motor și anexe › Pompă ulei | Piese auto › Motoare și accesorii › Ungere motor | 8 | nume |
| 145 | Motor și anexe › Radiator ulei termoflot | Piese auto › Motoare și accesorii › Ungere motor | 8 | sugestii |
| 146 | Electrice și senzori › Senzor impact airbag | Piese auto › Echipament interior › Airbag-uri | 8 | sugestii |
| 147 | Electrice și senzori › Senzor nivel faruri | Piese auto › Iluminare › Senzori | 8 | sugestii |
| 148 | Filtre auto › Tubulatură admisie | Piese auto › Motoare și accesorii › Conducte aer | 8 | sugestii |
| 149 | Car audio › Antenă radio | Piese auto › Echipament interior › Echipament audio de fabrică | 7 | sugestii |
| 150 | Suspensie și direcție › Arcuri auto | Piese auto › Sistem de suspensie › Arcuri de suspensie | 7 | sugestii |
| 151 | Interior și tapițerie › Buton frână de mână | Piese auto › Sistem de frânare › Frâne de parcare | 7 | sugestii |
| 152 | Electrice și senzori › Claxon | Piese auto › Sistem electric, aprindere › Claxoane | 7 | sugestii |
| 153 | Caroserie și exterior › Difuzor bară față | Piese auto › Piese de caroserie › Bare de protecție | 7 | sugestii |
| 154 | Caroserie și exterior › Grilă ștergătoare | Piese auto › Piese de caroserie › Apărători ștergătoare | 7 | sugestii |
| 155 | Motor și anexe › Pompă benzină | Piese auto › Sistem de alimentare cu combustibil › Pompe de combustibil | 7 | sugestii |
| 156 | Motor și anexe › Releu bujii | Piese auto › Sistem electric, aprindere › Relee | 7 | sugestii |
| 157 | Interior și tapițerie › Rulou portbagaj | Piese auto › Echipament interior › Rulouri portbagaj | 7 | sugestii |
| 158 | Motor și anexe › Tobă eșapament | Piese auto › Sistem de evacuare › Tobe de eșapament | 7 | sugestii |
| 159 | Caroserie și exterior › Ușă culisantă | Piese auto › Piese de caroserie › Uși | 7 | sugestii |
| 160 | Accesorii auto › Cârlig remorcare | Accesorii auto › Cricuri și transportoare › Cârlige de remorcare și accesorii | 6 | sugestii |
| 161 | Cutie de viteze și transmisie › Cutie viteze automată | Piese auto › Sistem de transmisie › Cutii de viteze | 6 | sugestii |
| 162 | Diverse › Diverse | Piese auto › Altele | 6 | ⚠ nume |
| 163 | Interior și tapițerie › Fețe uși | Piese auto › Echipament interior › Panouri laterale uși | 6 | nume |
| 164 | Caroserie și exterior › Geamuri | Piese auto › Piese de caroserie › Geamuri uși | 6 | sugestii |
| 165 | Electrice și senzori › Instalație electrică | Piese auto › Sistem electric, aprindere › Cablaje auto | 6 | nume |
| 166 | Sistem de frânare › Motoraș etrier | Piese auto › Sistem de frânare › Altele | 6 | sugestii |
| 167 | Suspensie și direcție › Punte față | Piese auto › Sistem de suspensie › Grinzi de suspensie | 6 | sugestii |
| 168 | Motor și anexe › Sondă lambda | Piese auto › Sistem de evacuare › Sonde lambda | 6 | sugestii |
| 169 | Electrice și senzori › Alarme auto | Piese auto › Sistem electric, aprindere › Claxoane | 5 | nume |
| 170 | Electrice și senzori › Calculator cutie automată | Piese auto › Sistem de transmisie › Piese cutie de viteze | 5 | sugestii |
| 171 | Electrice și senzori › Calculator injecție | Piese auto › Sistem de alimentare cu combustibil › Unități de control și controlere | 5 | nume |
| 172 | Motor și anexe › Pompă amorsare | Piese auto › Sistem de alimentare cu combustibil › Pompe de combustibil | 5 | nume |
| 173 | Electrice și senzori › Rezistență aerotermă | Piese auto › Sistem de ventilație › Rezistențe ventilatoare | 5 | sugestii |
| 174 | Motor și anexe › Suport alternator | Piese auto › Motoare și accesorii › Sistem curea accesorii | 5 | nume |
| 175 | Motor și anexe › Alte piese evacuare | Piese auto › Sistem de evacuare › Clapete de evacuare | 4 | nume |
| 176 | Motor și anexe › Axe came | Piese auto › Motoare și accesorii › Distribuție | 4 | nume |
| 177 | Interior și tapițerie › Buton Start Stop | Piese auto › Echipament interior › Intrerupatoare, panouri de control | 4 | sugestii |
| 178 | Motor și anexe › Catalizator auto | Piese auto › Sistem de evacuare › Catalizatoare | 4 | sugestii |
| 179 | Interior și tapițerie › Consolă centrală | Piese auto › Echipament interior › Planșe de bord, console | 4 | nume |
| 180 | Interior și tapițerie › Cotieră auto | Piese auto › Echipament interior › Cotiere | 4 | sugestii |
| 181 | Electrice și senzori › Manetă semnalizare | Piese auto › Echipament interior › Intrerupatoare, panouri de control | 4 | sugestii |
| 182 | Sistem de frânare › Pompă servofrână | Piese auto › Sistem de frânare › Asistență la frânare | 4 | sugestii |
| 183 | Electrice și senzori › Relee | Piese auto › Sistem electric, aprindere › Relee | 4 | sugestii |
| 184 | Motor și anexe › Rezervor AdBlue | Piese auto › Sistem de evacuare › Altele | 4 | nume |
| 185 | Electrice și senzori › Senzori ploaie | Piese auto › Ștergătoare și pulverizatoare › Senzori de ploaie | 4 | nume |
| 186 | Caroserie și exterior › Sticlă oglindă | Piese auto › Piese de caroserie › Oglinzi exterioare | 4 | sugestii |
| 187 | Motor și anexe › Suport filtru ulei | Piese auto › Motoare și accesorii › Ungere motor | 4 | sugestii |
| 188 | Motor și anexe › Suport rolă accesorii | Piese auto › Motoare și accesorii › Sistem curea accesorii | 4 | corectat |
| 189 | Suspensie și direcție › Vas lichid servodirecție | Piese auto › Sistem de direcție › Rezervoare lichid servo | 4 | sugestii |
| 190 | Car audio › Alte componente car audio | Piese auto › Echipament interior › Echipament audio de fabrică | 3 | sugestii |
| 191 | Sistem de frânare › Alte elemente frână | Piese auto › Sistem de frânare › Altele | 3 | nume |
| 192 | Suspensie și direcție › Bare stabilizatoare | Piese auto › Sistem de suspensie › Stabilizatoare și elemente | 3 | sugestii |
| 193 | Electrice și senzori › Borne baterie | Piese auto › Sistem electric, aprindere › Materiale de instalare | 3 | nume |
| 194 | Caroserie și exterior › Broască capotă | Piese auto › Piese de caroserie › Capote | 3 | nume |
| 195 | Filtre auto › Canistră carbon | Piese auto › Sistem de alimentare cu combustibil › Altele | 3 | sugestii |
| 196 | Climatizare (AC) și încălzire › Electroventilator climă AC | Piese auto › Sistem de climatizare › Ventilatoare A/C | 3 | corectat |
| 197 | Filtre auto › Filtru epurator | Piese auto › Filtre › Alte filtre | 3 | sugestii |
| 198 | Electrice și senzori › Kit pornire | Piese auto › Sistem electric, aprindere › Unități de control motor | 3 | sugestii |
| 199 | Caroserie și exterior › Lunetă | Piese auto › Piese de caroserie › Geamuri spate | 3 | sugestii |
| 200 | Electrice și senzori › Manetă ștergătoare | Piese auto › Echipament interior › Intrerupatoare, panouri de control | 3 | sugestii |
| 201 | Caroserie și exterior › Mâner ușă | Piese auto › Piese de caroserie › Încuietoare uși | 3 | sugestii |
| 202 | Interior și tapițerie › Nucă schimbător | Piese auto › Echipament interior › Mânere și manșoane | 3 | sugestii |
| 203 | Suspensie și direcție › Perne aer | Piese auto › Sistem de suspensie › Altele | 3 | sugestii |
| 204 | Tuning › Prelungire bara spate | Piese auto › Piese de caroserie › Bare de protecție | 3 | sugestii |
| 205 | Tuning › Prelungire bară față | Piese auto › Piese de caroserie › Spoilere | 3 | nume |
| 206 | Electrice și senzori › Releu pompă combustibil | Piese auto › Sistem electric, aprindere › Relee | 3 | corectat |
| 207 | Electrice și senzori › Releu ventilator | Piese auto › Sistem electric, aprindere › Relee | 3 | nume |
| 208 | Optică și faruri › Semnalizatoare | Piese auto › Iluminare › Semnalizatoare | 3 | sugestii |
| 209 | Electrice și senzori › Senzor ESP | Piese auto › Sistem de frânare › Sistem ABS și ESP | 3 | sugestii |
| 210 | Motor și anexe › Simeringuri | Piese auto › Motoare și accesorii › Garnituri și seturi de garnituri | 3 | nume |
| 211 | Cutie de viteze și transmisie › Timonerie | Piese auto › Sistem de transmisie › Piese cutie de viteze | 3 | sugestii |
| 212 | Motor și anexe › Vascocuplaj | Piese auto › Sistem de răcire a motorului › Ventilatoare radiator | 3 | sugestii |
| 213 | Motor și anexe › Vibrochen | Piese auto › Motoare și accesorii › Pistoane, segmenți și biele | 3 | nume |
| 214 | Motor și anexe › Actuator turbo | Piese auto › Motoare și accesorii › Turbocompresoare | 2 | sugestii |
| 215 | Climatizare (AC) și încălzire › Alte piese climă auto | Piese auto › Sistem de climatizare › Altele | 2 | nume |
| 216 | Interior și tapițerie › Alte piese interior | Piese auto › Echipament interior › Altele | 2 | nume |
| 217 | Suspensie și direcție › Alte piese suspensie | Piese auto › Sistem de suspensie › Altele | 2 | nume |
| 218 | Cutie de viteze și transmisie › Alte piese transmisie | Piese auto › Sistem de transmisie › Altele | 2 | nume |
| 219 | Caroserie și exterior › Amortizoare haion | Piese auto › Echipament interior › Amortizoare cu gaz | 2 | sugestii |
| 220 | Caroserie și exterior › Broască portbagaj | Piese auto › Piese de caroserie › Încuietoare uși | 2 | nume |
| 221 | Interior și tapițerie › Buton reglaj oglinzi | Piese auto › Echipament interior › Intrerupatoare, panouri de control | 2 | sugestii |
| 222 | Electrice și senzori › Calculator ABS | Piese auto › Sistem de frânare › Sistem ABS și ESP | 2 | ⚠ nume |
| 223 | Caroserie și exterior › Capac oglindă | Piese auto › Piese de caroserie › Oglinzi exterioare | 2 | sugestii |
| 224 | Roți, jante și anvelope › Capace roți | Anvelope și jante › Accesorii și unelte pentru roți | 2 | nume |
| 225 | Filtre auto › Carcasă filtru motorină | Piese auto › Sistem de alimentare cu combustibil › Carcase filtre combustibil | 2 | nume |
| 226 | Motor și anexe › Conducte alimentare | Piese auto › Sistem de alimentare cu combustibil › Conducte de combustibil | 2 | nume |
| 227 | Suspensie și direcție › Conducte servodirecție | Piese auto › Sistem de direcție › Conducte sistem servo | 2 | sugestii |
| 228 | Motor și anexe › Filtru de particule | Piese auto › Sistem de evacuare › Filtre DPF/FAP | 2 | nume |
| 229 | Suspensie și direcție › Foi de arc | Piese auto › Sistem de suspensie › Arcuri de suspensie | 2 | sugestii |
| 230 | Motor și anexe › Furtun admisie | Piese auto › Motoare și accesorii › Conducte aer | 2 | sugestii |
| 231 | Motor și anexe › Galerie evacuare | Piese auto › Sistem de evacuare › Galerii de evacuare | 2 | sugestii |
| 232 | Motor și anexe › Litrometru | Piese auto › Sistem de alimentare cu combustibil › Pompe de combustibil | 2 | sugestii |
| 233 | Electrice și senzori › Motoraș deschidere portbagaj | Piese auto › Piese de caroserie › Capace de portbagaj | 2 | nume |
| 234 | Caroserie și exterior › Ornament far | Piese auto › Piese de caroserie › Ornamente caroserie | 2 | nume |
| 235 | Motor și anexe › Pompă AdBlue | Piese auto › Sistem de evacuare › Altele | 2 | nume |
| 236 | Motor și anexe › Regulator presiune | Piese auto › Sistem de alimentare cu combustibil › Regulatoare de presiune combustibil | 2 | nume |
| 237 | Electrice și senzori › Senzor ax came | Piese auto › Sistem electric, aprindere › Senzori | 2 | sugestii |
| 238 | Electrice și senzori › Senzor MAP | Piese auto › Motoare și accesorii › Senzori MAP | 2 | ⚠ nume |
| 239 | Electrice și senzori › Senzor nivel suspensie | Piese auto › Sistem de suspensie › Suspensie hidraulică și pneumatică | 2 | nume |
| 240 | Electrice și senzori › Senzor temperatură gaze evacuare | Piese auto › Sistem de evacuare › Senzori de temperatură gaze de eșapament | 2 | sugestii |
| 241 | Caroserie și exterior › Suport număr înmatriculare | Piese auto › Piese de caroserie › Suporturi, prinderi | 2 | sugestii |
| 242 | Motor și anexe › Alte piese aprindere | Piese auto › Sistem electric, aprindere › Altele | 1 | nume |
| 243 | Suspensie și direcție › Alte piese direcție | Piese auto › Sistem de direcție › Altele | 1 | nume |
| 244 | Optică și faruri › Alte piese lumini auto | Piese auto › Iluminare › Altele | 1 | nume |
| 245 | Car audio › Amplificator audio | Piese auto › Echipament interior › Echipament audio de fabrică | 1 | nume |
| 246 | Optică și faruri › Angel eyes | Piese auto › Iluminare › Faruri și elemente de iluminat | 1 | nume |
| 247 | Roți, jante și anvelope › Apăratori noroi | Piese auto › Piese de caroserie › Apărători de noroi | 1 | nume |
| 248 | Caroserie și exterior › Aripă | Piese auto › Piese de caroserie › Aripi | 1 | sugestii |
| 249 | Accesorii auto › Bare longitudinale | Accesorii auto › Portbagaje | 1 | nume |
| 250 | Optică și faruri › Becuri Xenon | Piese auto › Iluminare › Becuri | 1 | nume |
| 251 | Cutie de viteze și transmisie › Bloc valve cutie | Piese auto › Sistem de transmisie › Piese cutie de viteze | 1 | sugestii |
| 252 | Suspensie și direcție › Blocaj volan | Piese auto › Sistem de direcție › Coloane de direcție | 1 | nume |
| 253 | Caroserie și exterior › Braț oglindă | Piese auto › Piese de caroserie › Oglinzi exterioare | 1 | sugestii |
| 254 | Caroserie și exterior › Capac bară | Piese auto › Piese de caroserie › Bare de protecție | 1 | nume |
| 255 | Motor și anexe › Carcasă termostat | Piese auto › Sistem de răcire a motorului › Termostate | 1 | sugestii |
| 256 | Caroserie și exterior › Catadioptru | Piese auto › Iluminare › Reflectoare | 1 | nume |
| 257 | Caroserie și exterior › Chedere | Piese auto › Piese de caroserie › Piese de montaj | 1 | nume |
| 258 | Scule auto › Chei | Piese auto › Sistem electric, aprindere › Contacte și chei | 1 | sugestii |
| 259 | Interior și tapițerie › Comenzi volan | Piese auto › Echipament interior › Intrerupatoare, panouri de control | 1 | nume |
| 260 | Cutie de viteze și transmisie › Convertizor | Piese auto › Sistem de transmisie › Piese cutie de viteze | 1 | sugestii |
| 261 | Roți, jante și anvelope › Cric | Anvelope și jante › Accesorii și unelte pentru roți | 1 | nume |
| 262 | Accesorii auto › Cui tractare | Accesorii auto › Cricuri și transportoare › Cârlige de remorcare și accesorii | 1 | nume |
| 263 | Accesorii auto › Deflector capotă | Piese auto › Piese de caroserie › Ornamente caroserie | 1 | nume |
| 264 | Accesorii auto › Diverse accesorii auto | Piese auto › Altele | 1 | ⚠ nume |
| 265 | Suspensie și direcție › Flanșe amortizor | Piese auto › Sistem de suspensie › Amortizoare și elemente | 1 | sugestii |
| 266 | Motor și anexe › Fulie ax came | Piese auto › Motoare și accesorii › Distribuție | 1 | nume |
| 267 | Motor și anexe › Fulie pompa servo | Piese auto › Sistem de direcție › Pompe de servo | 1 | sugestii |
| 268 | Motor și anexe › Fulie pompă apă | Piese auto › Motoare și accesorii › Sistem curea accesorii | 1 | nume |
| 269 | Caroserie și exterior › Grilă | Piese auto › Piese de caroserie › Grile radiator | 1 | nume |
| 270 | Cutie de viteze și transmisie › Kit ambreiaj | Piese auto › Sistem de transmisie › Ambreiaje | 1 | sugestii |
| 271 | Suspensie și direcție › Kit brațe | Piese auto › Sistem de suspensie › Brațe de suspensie și elemente | 1 | sugestii |
| 272 | Car audio › Magazie CD | Piese auto › Echipament interior › Echipament audio de fabrică | 1 | sugestii |
| 273 | Caroserie și exterior › Mâner deschidere capotă | Piese auto › Piese de caroserie › Capote | 1 | nume |
| 274 | Interior și tapițerie › Mâner frână mână | Piese auto › Sistem de frânare › Frâne de parcare | 1 | sugestii |
| 275 | Car audio › Modulator FM | Piese auto › Echipament interior › Echipament audio de fabrică | 1 | nume |
| 276 | Navigație GPS › Navigație auto | Accesorii auto › Electronică auto › Navigație și accesorii GPS | 1 | nume |
| 277 | Caroserie și exterior › Opritor ușă | Piese auto › Piese de caroserie › Piese de montaj | 1 | nume |
| 278 | Interior și tapițerie › Pedale | Piese auto › Echipament interior › Pedale | 1 | sugestii |
| 279 | Caroserie și exterior › Perie geam | Piese auto › Piese de caroserie › Piese de montaj | 1 | nume |
| 280 | Interior și tapițerie › Plafonieră | Piese auto › Echipament interior › Iluminare cabină | 1 | sugestii |
| 281 | Roți, jante și anvelope › Roată de rezervă | Anvelope și jante › Roți (jante cu anvelope) › Roți de rezervă | 1 | nume |
| 282 | Motor și anexe › Rolă întinzătoare accesorii | Piese auto › Motoare și accesorii › Sistem curea accesorii | 1 | sugestii |
| 283 | Roți, jante și anvelope | Anvelope și jante › Accesorii și unelte pentru roți | 1 | nume |
| 284 | Interior și tapițerie › Scrumieră | Piese auto › Echipament interior › Scrumiere | 1 | sugestii |
| 285 | Optică și faruri › Semnalizare oglindă | Piese auto › Iluminare › Semnalizatoare | 1 | nume |
| 286 | Electrice și senzori › Senzor deschidere haion | Piese auto › Sistem electric, aprindere › Senzori | 1 | nume |
| 287 | Electrice și senzori › Senzor nivel ulei | Piese auto › Motoare și accesorii › Ungere motor | 1 | sugestii |
| 288 | Electrice și senzori › Senzor unghi volan | Piese auto › Sistem de direcție › Senzori de unghi de viraj | 1 | nume |
| 289 | Electrice și senzori › Senzori ABS și parcare | Piese auto › Sistem electric, aprindere › Senzori | 1 | nume |
| 290 | Motor și anexe › Set curea transmisie | Piese auto › Motoare și accesorii › Sistem curea accesorii | 1 | nume |
| 291 | Climatizare (AC) și încălzire › Webasto | Piese auto › Încălzire staționară și răcire › Încălzire auxiliară | 1 | sugestii |

### De verificat de om (scrise, dar alese cu îndoială)

| Categoria | Ales | Piese | De ce |
|---|---|---|---|
| EGR și Clapetă acceleratie | Piese auto › Motoare și accesorii › Clapete de accelerație | 324 | categorie amestecată: supape EGR + clapete de accelerație; OLX are frunze separate („Recirculare gaze EGR”) |
| Radiatoare și Ventilatoare | Piese auto › Sistem de răcire a motorului › Radiatoare | 229 | categorie amestecată: radiatoare + electroventilatoare; OLX are și „Ventilatoare radiator” |
| Alternator | Piese auto › Sistem electric, aprindere › Electromotoare și piese | 144 | OLX n-are frunză de alternatoare; clasificatorul lor a ales „Electromotoare și piese” la 3 din 5 titluri |
| Alte piese de caroserie | Piese auto › Piese de caroserie › Elemente de caroserie | 78 | categorie-sac („Alte piese de caroserie”) |
| Alte piese Electrică & Electronică | Piese auto › Sistem electric, aprindere › Echipament electric | 44 | categorie-sac („Alte piese Electrică & Electronică”): calculatoare, siguranțe, module diverse |
| Diverse | Piese auto › Altele | 6 | categoria „Diverse” — piese de tot felul |
| Calculator ABS | Piese auto › Sistem de frânare › Sistem ABS și ESP | 2 | ales după nume, dar piesele din ea sunt calculatoare de frână de mână (par puse greșit la noi) |
| Senzor MAP | Piese auto › Motoare și accesorii › Senzori MAP | 2 | ales după nume, dar piesele din ea sunt senzori de presiune diferențială DPF (par puse greșit la noi) |
| Diverse accesorii auto | Piese auto › Altele | 1 | categorie-sac („Diverse accesorii auto”) |

Se schimbă din Admin → Anunțuri OLX → Potrivirea categoriilor; o potrivire pusă de om nu mai e suprascrisă de script (`--scrie` sare rândurile cu `actualizat_de` completat).

### Raportul pe catalog după potrivire (13 noiembrie 2026)

| | Piese |
|---|---|
| Publicate cu stoc (verificate) | 8.746 |
| **Gata de publicat** | **8.746** |
| Blocate | 0 |

Riscuri — doar raportate, nu blochează: 203 titluri cu peste 50% majuscule dacă se numără doar literele; 118 coduri care pot fi luate drept telefon; 1 piesă fără poze. Corecturi automate: 31 de descrieri cu semne repetate, 1 titlu la majuscule, 1 descriere completată (prea scurtă). Setările anunțurilor (oraș, contact) sunt complete.

**Urmează**: proba pe UN anunț real (de preferat o piesă dintr-o categorie sigură, ex. un far, care are și cod de piesă — ca să vedem dacă OLX îl ia drept telefon). Fără publicare în masă până la pasul 3.

### Regula după titlu pentru cele două categorii amestecate (13 noiembrie 2026, decizia proprietarului)
Peste potrivirea pe categorie, DOAR pentru acestea două (`REGULI_TITLU` / `categorieDinTitlu` în `lib/olx-anunt.mjs`;
titlul comparat fără diacritice, cu litere mici). Restul celor „de verificat” rămân cum au fost alese.

| Categoria noastră | Titlul conține | → Frunza OLX | Piese | Altfel → | Piese |
|---|---|---|---|---|---|
| 18 EGR și Clapetă accelerație | „EGR”, „răcitor (de) gaze” | Motoare și accesorii › Recirculare gaze EGR (3630) | 164 | Clapete de accelerație (3629) | 160 |
| 20 Radiatoare și Ventilatoare | „ventilator(oare)”, „electroventilator(oare)”, „GMV” / „GMW” | Sistem de răcire a motorului › Ventilatoare radiator (3587) | 109 | Radiatoare (3578) | 120 |

Față de regula cerută („EGR”; „ventilator / electroventilator / GMV”) s-au adăugat, după măsurare: pluralul
(„Ventilatoare”, „Panou electroventilatoare” — ~15 piese ar fi rămas la Radiatoare), forma „GMW” (scrisă așa în
titluri) și „răcitor gaze” (~40 de răcitoare EGR fără cuvântul „EGR” ar fi ajuns la Clapete). `contextAnunt()`
încarcă și frunzele regulilor. Raportul după regulă: tot 8.746 / 8.746 gata.

### Proba pe UN anunț real — piesa aleasă: AP-001983 (id 1983)
„Injectoare BMW F31 F10 F07 F20 X1 F48 X3 F25 X4 F26 F32 F36 F11 2.0 d B47D20A 2015 2016”, 500 lei, stoc 1, 2 poze.
Categoria: Piese auto › Sistem de alimentare cu combustibil › Injectoare (sigură, din sugestii). Lămurește ambele riscuri:
titlul are 67% majuscule numărate pe litere (sub 50% pe tot textul, deci pleacă neschimbat) și descrierea conține
„COD: 0445110743” (cod Bosch de 10 cifre care începe cu 0). Nicio piesă-far nu le avea pe amândouă.

**De corectat înainte de probă**: descrierea piesei spune „Pretul afisat este pe bucata !”, dar titlul e la plural
(„Injectoare”) și stocul e 1 — se lămurește dacă 500 lei e pe bucată sau pe set, ca anunțul să nu inducă în eroare.

**Admin**: https://autopas-dezmembrari.ro/admin/produse/1983 — caseta „OLX”. Pașii probei:
1. „Previzualizează anunțul OLX” → fără motive de blocare; se verifică titlul, descrierea, categoria, cele 2 poze.
2. „Publică pe OLX” → stare „nou — în moderare”.
3. După 1–2 minute, „Reîmprospătează starea” → „activ”, cu linkul „vezi pe OLX”. Dacă iese „respins”, se notează
   motivul afișat (lămurește riscul codului luat drept telefon / al majusculelor).
4. Pe OLX: titlul, descrierea (codul 0445110743 întreg?), pozele, categoria, „Livrare prin curier”.
5. Prețul piesei schimbat (ex. 510), salvat → „Actualizează pe OLX” → prețul nou pe OLX; apoi înapoi la 500 și din nou
   „Actualizează pe OLX”.
6. „Dezactivează” → „dezactivat”; „Activează” → „activ”.
7. Se notează și dacă reînnoirea automată (`auto_extend_enabled`) apare pe OLX ca plătită.
**Rezultatul probei (13 noiembrie 2026)** — anunțul OLX 311922114, creat la 12:47 (ora lor):
- **Închise**: titlul cu multe majuscule a fost acceptat neschimbat; codul 0445110743 din descriere a rămas și NU a fost
  luat drept telefon. Categoria (Injectoare, 3525), 500 lei, „Second Hand”, livrare prin curier, Bistrița, Neamț — corecte.
- `external_url`: primul POST a răspuns 400 „Partner is not allowed to use external URL”; al doilea a plecat fără el
  (plasa din `lib/olx-publicare.mjs` a mers cum trebuia).
- **Starea: `limited`** — după specificația lor, „advert exceeded limit of free adverts in selected category”: anunțul NU
  e vizibil public până nu se cumpără un pachet (pe anunț sau pe categorie) și se activează. Butonul „Activează” din lista
  OLX e exact pasul acela (plătit). Aplicația nu cumpără și nu activează un anunț `limited` (decizia din pasul 1).
  Proprietarul confirmă: anunțul nu e plătit încă. **Consecință pentru pasul 3**: publicarea în masă ar produce anunțuri
  `limited` — înainte de ea trebuie decis și cumpărat pachetul de pe OLX (de om, nu din aplicație).
- **Pozele**: adresele trimise (`https://autopas-dezmembrari.ro/feed/poze/2026/…webp.jpg`) răspund 200, `image/jpeg`, fără
  redirect, 1024×485 și 485×1024, ~90 KB. POST-ul a fost ACCEPTAT (OLX verifică adresele la creare și refuză cu
  „Image error: Remote file not exists”; nu a refuzat) și lista OLX arată miniatura — deci OLX are pozele. Totuși
  `GET /adverts/311922114` întoarce `images: []`, iar „Editează” pe OLX nu arată poze. Cel mai probabil e legat de starea
  `limited` (anunț neactivat); NU s-a refăcut nimic (un PUT n-ar schimba starea). Se verifică din nou după activare:
  dacă anunțul activ tot n-are poze, se face un PUT cu aceleași poze și se compară.
- Pagina publică OLX răspunde 403 la cererile din Codespace (CloudFront) — nu se ocolește; se verifică din browser.

### Retragerea și prelungirea (13 noiembrie 2026, cerut de proprietar după discuția cu OLX)
- **Un anunț nu se șterge niciodată de pe OLX** — OLX a spus că ștergerea dă eroare. Piesa vândută → `deactivate` cu
  `is_success: true`; piesa ascunsă / ștearsă de pe site → `deactivate` cu `is_success: false`. `DELETE` a fost scos din
  lista închisă de apeluri (`apelPermis` din `lib/olx-api.mjs`): orice ștergere e refuzată înainte de rețea.
- **Prelungirea după 30 de zile**: fiecare anunț pleacă deja cu `auto_extend_enabled: true` („Should the advert be
  automatically extended when it expires”) — verificat pe 311922114: `auto_extend_enabled: true`, `valid_to` 13.12.2026.
  Deci OLX prelungește singur anunțurile active la expirare, fără niciun apel de la noi. Comanda `extend` (prelungire
  manuală, prin API) rămâne refuzată. DE CONFIRMAT cu OLX: prelungirea automată costă ceva / consumă din pachet?

### Curățarea paginii „Anunțuri OLX” (13 noiembrie 2026)
- Textul „Publicarea începe după aprobarea aplicației de către OLX” scos (aplicația e aprobată și conectată).
- Sus: anunțurile create din aplicație (`olx_anunturi`, ultimele 100 + totalul), cu starea, valabilitatea, linkul OLX și
  avertismentul pentru cele neplătite (`limited` / `unpaid`). Lista completă, cu filtre, rămâne la pasul 3.
- Raportul: fără tabelul „textul brut ar fi fost refuzat” (dubla tabelul „Corectat automat”); „De urmărit” arată doar
  piesele fără poze — riscurile „cod luat drept telefon” și „majuscule pe litere” au fost scoase din generator, fiindcă
  proba reală le-a închis.
- Potrivirea categoriilor: link discret la final; pagina ei explică excepția după titlu (EGR / ventilatoare).
- Starea `limited` se scrie „neplătit — se activează din contul OLX, după plată” (nu „LIMITED — nu se plătește nimic”).
