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
