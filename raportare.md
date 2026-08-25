# RAPORT — 25 august 2026

Import complet din admin · Tema luminoasă · Politica de retur · Auditul panoului de administrare

Commit: `f6187ac`, împins pe `main`.

---

# PARTEA A — Import complet din admin

## A.2 Cum am evitat duplicarea (arhitectura)

Un singur motor, în `lib/import/`, apelat de amândouă declanșatoarele. Scriptul din terminal și ruta din admin **nu conțin nicio regulă de import** — doar orchestrare (de unde vine fișierul, unde se scrie progresul, cum se afișează).

| Modul | Ce conține |
|---|---|
| `csv.mjs` | parser RFC 4180 + verificarea coloanelor |
| `extragere.mjs` | tot ce se citește din HTML-ul unei pagini |
| `potrivire.mjs` | marcă, model, categorie, regulile de taxonomie |
| `rand.mjs` | rândul din `products`; ce are voie să atingă un re-import |
| `aducere.mjs` | cererea politicoasă (pauze, User-Agent, „sorry", reîncercări) |
| `imagini.mjs` | conversia în WebP |
| `depozit.mjs` | singurul loc care vorbește cu Supabase |
| `motor.mjs` | planificarea și procesarea unei felii de rânduri |

**De ce `.mjs` și nu `.ts`:** scriptul rulează direct cu `node`, fără compilare. TypeScript însă *poate* importa `.mjs` (`allowJs` era deja pornit în `tsconfig.json`), deci un singur fișier per regulă, fără unelte noi. Detalii în `lib/import/README.md`.

**Arhitectura de rulare:** starea stă în `import_jobs` + bucketul privat `import-csv`, nu în browser. Browserul cere loturi; un lot se oprește la prima limită atinsă — 25s, 50 de pagini descărcate sau 500 de rânduri. Plafonul de 500 e cel care face ca un import fără piese noi să dureze secunde: rândurile fără descărcare se mătură instant.

## A.6 Verificări

| # | Verificare | Rezultat |
|---|---|---|
| 1 | Re-import pe cele 50 existente | **50/50 neschimbate, 0 rânduri noi, 0 pagini descărcate.** Zero cereri către pieseauto.ro |
| 2 | Tab închis la jumătate, reluare | **Trece** — întrerupt la 237 din 500, reluat, total 500, niciun rând sărit sau dublat |
| 3 | Piesă editată manual, intactă la reimport | **Trece** — titlul editat nu se suprascrie, prețul da; pozele/greutatea/categoria nu apar niciodată în patch |
| 4 | Protecția de 20% pe fișier trunchiat | **Trece** — fișier de 10 rânduri din 50: „ar depublica 40 din 50 (80,0%)", oprit **înainte de orice scriere** |
| 5 | `npm run build` | **Compiled successfully** |

Verificările 2–4 rulează într-un script permanent: `node scripts/verifica-import.mjs` — **41 de verificări, toate trec**, fără rețea și fără bază de date (sursă falsă + depozit fals). Include și canarul: peste 20% pagini fără poze se oprește după prima fereastră de 50, sub prag continuă.

**Un bug găsit de verificarea 4:** previzualizarea citea din bază doar `id, sursa_id, publicat, sursa_activ`, deci compara prețul cu `undefined` și raporta **toate** piesele ca „de actualizat". Reparat (`lib/import/depozit.mjs`).

## A.8 Consumul de stocare

Măsurat pe pozele reale din bucket, nu estimat:

| | valoare |
|---|---|
| poze pe piesă | 1,65 |
| WebP, medie pe poză | **97,0 KB** |
| pe piesă | ~160 KB |
| **estimare pentru 8.000 de piese** | **~1,22 GB** |

Cele 14 fișiere `.jpg` din bucket (din 28) au medie **212 KB** — au fost urcate neconvertite, când `sharp` nu era instalat. Acum e dependință și conversia merge; **nu le-am reconvertit** (sunt valide, doar mai mari).

---

# PARTEA B — Tema luminoasă

## Corecția ta, aplicată

`--accent-text` **a dispărut** din CSS, din `tailwind.config.ts` și din toate cele 60 de locuri din componente. Paleta luminoasă e integral cea nouă (griuri reci).

Mecanismul cu care am înlocuit-o, fiindcă „componenta scrie `--accent`, dar pe luminos `--accent` nu e niciodată `color`" nu se poate rezolva doar din variabile: două clase semantice în `globals.css` —

```css
.accentuat        { color: rgb(var(--accent)); }
.accentuat-hover:hover { color: rgb(var(--accent)); }
:root[data-tema="luminos"] .accentuat { color: rgb(var(--text)); }
:root[data-tema="luminos"] .accentuat-hover:hover { color: rgb(var(--text)); text-decoration: underline; }
```

Pe întunecat galben, pe luminos negru, cu subliniere la hover ca linkul să rămână link.

**Locurile unde `--accent` a rămas `color`, cum ai cerut să-ți raportez** — sunt trei, toate pe fundal negru pe **ambele** teme, deci nu ajung niciodată galben pe alb:

- `components/Header.tsx:92` și `:173` (bara de sus și intrarea „Panou de administrare" din meniul mobil)
- `components/Footer.tsx` — toate `hover:text-accent` (subsolul e negru pe ambele teme)
- `components/TrustBar.tsx:29`, doar ramura `variant === "dark"`

**Hero-ul:** era `bg-headerBg` (negru). L-am pus pe `--hero-bg` / `--hero-text`, singurele variabile pe care le-am adăugat peste lista ta — pe întunecat negru, pe luminos `#EDEFF2`. Titlul e negru integral. Celelalte benzi negre (cererea de piese, chipurile din „Despre noi", bannerul de cookie-uri) au rămas negre pe ambele teme.

## Tabelul de contrast — ambele teme

`node scripts/verifica-contrast.mjs`

**Tema ÎNTUNECATĂ: 14 din 14 trec.**

| pereche | raport | prag |
|---|---|---|
| text pe fundal / card / câmp | 19,03 · 17,58 · 15,52 | 4,5 ✓ |
| text secundar pe card | 7,66 | 4,5 ✓ |
| chenar input pe card / câmp | 3,55 · 3,13 | 3 ✓ |
| text pe buton / hover | 10,47 · 8,05 | 4,5 ✓ |
| chenar buton galben pe card / fundal | 9,67 · 10,47 | 3 ✓ |
| text pe hero · accent pe header · header · subsol | 21,00 · 11,55 · 21,00 · 9,14 | ✓ |

**Tema LUMINOASĂ: 10 din 14 trec. Patru pică — toate sunt chenare, din valorile pe care mi le-ai dat:**

| pereche | raport | prag | |
|---|---|---|---|
| text pe fundal / card / câmp | 15,62 · 17,99 · 17,99 | 4,5 | ✓ |
| text secundar pe card | 6,99 | 4,5 | ✓ |
| text pe buton / hover | 10,47 · 8,05 | 4,5 | ✓ |
| text pe hero | 15,62 | 4,5 | ✓ |
| **chenar input pe card / câmp** (`--chenar-puternic` #BFC5CC pe alb) | **1,74 · 1,74** | 3 | **PICĂ** |
| **chenar buton galben pe card / fundal** (`--accent-chenar` #C99C05) | **2,55 · 2,21** | 3 | **PICĂ** |

Butonul galben **are** chenar vizibil cu ochiul liber pe amândouă fundalurile (se vede în capturi), dar la 2,21:1 pe gri e sub pragul de 3:1 din WCAG 1.4.11 — exact pragul pentru care există variabila. **Nu ți-am schimbat valorile.** Dacă vrei să treacă:

- `--chenar-puternic: 126 136 148` (#7E8894) → 3,60 pe alb, 3,12 pe fundal
- `--accent-chenar: 163 126 4` (#A37E04) → 3,79 pe alb, 3,29 pe fundal

`/admin` rămâne cu cele 2 perechi vechi sub prag (alb pe portocaliu, 2,85 și 2,67). Paleta panoului n-am atins-o.

## Scanarea responsive — ambele teme

19 pagini × 13 lățimi = 247 combinații, pe fiecare temă:

| | întunecat | luminos |
|---|---|---|
| scroll orizontal | **0** | **0** |
| text sub 12px | 0 | 0 |
| erori de încărcare | 0 | 0 |
| ținte sub 44px | 2 | 2 |
| „suprapuneri" | 201 | 201 |

Cele 2 ținte mici sunt miniaturile din galeria de produs (51×38 la 320px, 59×44 la 360px) — preexistente, nu le-am atins. Cele 201 „suprapuneri" sunt bannerul de cookie-uri, care e strat fix peste conținut: zgomot al detectorului, nu defect.

**Comutatorul a spart headerul și a trebuit reparat:** a cincea iconiță de 44px scotea bara din ecran cu 26px la 320px, cu 40px la 360px și cu 33px la 768px (ultimele două doar pe un cont de echipă, cu butonul „Admin"). Am strâns spațierea, nu țintele — toate rămân 44px. Verificat la toate cele 13 lățimi, inclusiv cu butonul „Admin" injectat.

## B.3 — Ce am găsit vizual

**PartArt: da, se vede muchia, și acum mai rău decât cu paleta caldă.** Ilustrația are `#ECE9E2` (bej cald) scris în SVG, iar `--imagine-bg` e `#EFF1F3` (gri rece). Nu e doar o diferență de luminozitate, e de temperatură: bej pe gri-albăstrui se citește ca o pată galbenă. **N-am reparat**, cum ai cerut — decizi tu dacă se regenerează ilustrațiile pe gri.

Notă: pe `/piese` nu se vede acum, fiindcă toate cele 17 piese publicate au poze reale. Comparația din captură e randată separat, cu exact culorile din cod.

**ANPC:** rămân pe subsolul negru, care nu se schimbă cu tema — arată identic pe ambele. Containerul cu `p-3` nu e redundant: albul din jurul lor îi separă de negru.

**Logo:** e pe fundal negru în ambele teme (header și subsol) — nu ajunge niciodată pe deschis, deci nu pierde contrast. Nu e nevoie de variantă pe alb.

## Bara de căutare

Structura cerută, aplicată: zona din mijloc `flex-1 min-w-0 flex justify-center`, bara `w-full min-w-[360px] xl:max-w-[520px]`. La 1024 centrarea nu mută nimic — bara ocupă tot golul, cum ai cerut. La 1280 și 1440 e centrată.

Singura abatere: containerul nu e `gap-4` fix, ci `gap-1 sm:gap-2 md:gap-1 lg:gap-4` — cu `gap-4` peste tot headerul iese din ecran pe telefon și la 768px, din cauza comutatorului de temă.

---

# PARTEA C — Politica de retur (doar raport, nimic modificat)

## C.1 + C.2 — Aparițiile și categoria fiecăreia

**Retragerea în 14 zile e corectă peste tot.** Nu există niciun text care să limiteze rambursarea transportului inițial:

| Fișier:linie | Text | Categorie |
|---|---|---|
| `lib/legal.ts:355` | „Toate sumele primite de la tine, **inclusiv costul livrării standard**, în cel mult 14 zile…" | **Corectă** |
| `lib/legal.ts:356` | „Dacă ai ales expres o livrare mai scumpă…, diferența de cost nu se rambursează." | **Corectă** (art. 13 alin. 3) |
| `lib/legal.ts:357` | „Putem amâna rambursarea până primim piesa înapoi…" | **Corectă** |
| `lib/legal.ts:360` | „Suporți costul direct al returnării piesei." | **Corectă** (art. 14 alin. 1) |
| `lib/legal.ts:362` | „…din suma rambursată se poate reține scăderea de valoare." | **Corectă** |
| `lib/legal.ts:75` | „…te anunțăm și restituim integral orice sumă încasată." | **Corectă** |
| `lib/legal.ts:80`, `305` | „…anulezi comanda fără niciun cost." | **Corectă** |
| `lib/legal.ts:312` | „…îți restituim integral sumele plătite." (depășire termen livrare) | **Corectă** |
| `lib/legal.ts:110` | „…îți propunem o soluție sau restituim banii." (forță majoră) | **Ambiguă** — nu spune dacă include transportul |
| `app/faq/page.tsx:8` | „Îți rambursăm tot ce ai plătit, inclusiv livrarea standard…; costul direct al returnării îl suporți tu." | **Corectă** |
| `app/formular-retur/page.tsx:25` | „Costul acestui transport îl suporți tu." | **Corectă** |
| `app/formular-retur/page.tsx:26` | „**După ce primim piesa**, îți restituim toți banii, inclusiv costul livrării standard, în cel mult 14 zile." | **Ambiguă** — legea leagă cele 14 zile de *comunicarea deciziei*, nu de primirea coletului. Firma **poate** amâna plata până primește piesa (art. 13 alin. 3), dar formularea inversează regula cu excepția |
| `app/formular-retur/page.tsx:40` | „…scădere de valoare care se reține din suma rambursată." | **Corectă** |

**Problema reală nu e la retur, e la garanție** — și e mai serioasă:

| Fișier:linie | Text | Categorie |
|---|---|---|
| `lib/legal.ts:441` + lista | „Plata transportului pentru produsele trimise în vederea soluționării garanției…: de la client către firmă — plata de către client; **de la firmă către client — plata suportată de clientul destinatar**." | **Incorectă** — OUG 140/2021 art. 11 alin. (2) lit. a): aducerea în conformitate se face „fără costuri" pentru consumator, iar transportul intră acolo. Clauza mută ambele drumuri pe client |
| `lib/legal.ts:436` | „Garanția acoperă cel mult valoarea integrală a produsului reclamat." | **Incorectă prin efect** — exclude explicit orice cost peste produs, deci și transportul datorat legal |
| `lib/legal.ts:413` | „…vor fi înlocuite cu altele sau se va returna contravaloarea achitată la achiziție." | **Ambiguă** — nu spune nimic despre costuri |

Textul de garanție e reprodus din `garantie.docx`, iar în `CLAUDE.md` scrie că ai decis să rămână identic cu documentul. **De asta nu l-am atins.** Dar clauza aceea e nulă de drept în raport cu un consumator, iar ANPC o sancționează ca atare.

## C.3 — Textul propus (pentru aprobarea ta, nu implementat)

**Înlocuiește `lib/legal.ts:354–357`, secțiunea „4. Ce îți rambursăm (art. 13)":**

> **Ce îți rambursăm.** Îți returnăm **contravaloarea piesei și costul livrării standard** pe care l-ai plătit la comandă. Rambursarea se face în cel mult 14 zile de la data la care ne-ai comunicat decizia de retragere, cu aceeași metodă de plată folosită la achiziție, fără costuri suplimentare pentru tine.
>
> **Ce nu rambursăm.** Transportul de **returnare** a piesei către noi îl suporți tu — te informăm despre asta înainte de comandă, cum cere legea. Dacă ai ales expres o livrare mai scumpă decât cea standard oferită de noi, îți rambursăm doar cât ar fi costat livrarea standard; diferența rămâne în sarcina ta.
>
> **Când plătim.** Putem amâna rambursarea până primim piesa înapoi sau până ne trimiți dovada că ai expediat-o — se ia în calcul data cea mai apropiată. Termenul de 14 zile curge oricum de la comunicarea deciziei tale, nu de la primirea coletului.
>
> **Retragerea nu se confundă cu garanția.** Cele de mai sus se aplică atunci când te răzgândești. Dacă piesa e neconformă — are un defect, nu corespunde descrierii — **toate costurile aducerii în conformitate, inclusiv transportul în ambele sensuri, sunt ale noastre**, conform OUG 140/2021.

Și, ca urmare directă, `app/formular-retur/page.tsx:26` ar trebui să devină: „**Îți restituim toți banii, inclusiv costul livrării standard, în cel mult 14 zile de la anunțul tău.** Putem aștepta să primim piesa sau dovada expedierii înainte de plată."

**Ultimul paragraf intră în conflict cu clauza din certificatul de garanție** (`lib/legal.ts:441`). Nu pot scrie unul fără să-l repar pe celălalt, iar acela e text din actul firmei. **Îmi trebuie decizia ta:** modificăm clauza de transport din certificat, sau lăsăm cele două documente să se contrazică?

---

# SARCINA NOUĂ — Auditul /admin

## 1. Cauza defectului de la Setări

Am verificat toate cele patru ipoteze direct în baza de date:

| Ipoteză | Verdict |
|---|---|
| 2. rândul nu există | **Nu.** `settings` are `firma`, `curieri`, `integrari` |
| 4. se scrie într-o cheie, se citește din alta | **Nu.** `salveaza("firma", …)` scrie în `cheie='firma'`, de acolo se și citește |
| 3. cache Next.js | **Nu, nu în admin.** `/admin/setari` citește din browser, prin `sbBrowser()`, fără cache Next. (Cache-ul *există* pe site-ul public — vezi mai jos) |
| 1. **UPDATE blocat, eroare neprinsă** | **Da, mecanismul e confirmat** |

Nuanța contează, fiindcă schimbă reparația: **nu e o eroare neprinsă, e o eroare care nu există.** Am testat pe producție:

```
PATCH /rest/v1/settings?cheie=eq.firma   (cheie anon, deci fără drept)
→ HTTP 204, content-range: */*, corp gol, NICIUN mesaj de eroare
```

RLS nu ridică excepție la UPDATE — **filtrează rândurile**. Un update interzis și unul reușit arată identic pentru client: `error === null`. Iar codul spune:

```ts
// app/admin/setari/page.tsx:39
const { error } = await sb.from("settings").update({ valoare }).eq("cheie", cheie);
setMsg(error ? "Eroare: …" : "✓ Salvat — se aplică imediat pe site.");
```

Succes afișat fără ca cineva să fi întrebat vreodată **câte rânduri s-au scris**.

**Ce am confirmat că e sănătos:** politicile de pe `settings` sunt corecte (`update using(is_admin()) with check(is_admin())`), ambele conturi din `profiles` au `role='admin'`, `authenticated` are drept de UPDATE la nivel de tabelă, pe `settings` **nu există niciun trigger**, și un UPDATE rulat cu JWT-ul unui admin (în tranzacție, cu rollback) **modifică rândul**.

**Deci mecanismul prin care interfața a mințit e dovedit, dar de ce sesiunea ta n-a fost una de admin în momentul clicului nu pot spune fără să reproduc cu contul tău.** Cele două explicații rămase — sesiune expirată în tabul deschis, sau clic făcut cu alt cont — se separă într-un minut cu un cont de echipă.

**Îmi trebuie o cale de autentificare**, cum ai spus. Nu vreau să-mi generez singur sesiune pe proiectul de producție. Ce ar fi de ajuns: parola contului `test@admintest.ro`, sau acordul explicit să-i pun eu una prin Admin API.

## 2. Etapa 1 — Inventarul acțiunilor care scriu în baza de date

Marcate cu ⚠ sunt cele care au **exact** tiparul de la Setări: update/delete fără să verifice câte rânduri s-au atins. Marcate cu ⛔, cele care în plus **nu se uită deloc** la `error`.

| Modul | Acțiune | Ce ar trebui să facă | Fișier:linie | |
|---|---|---|---|---|
| Setări | Salvează datele firmei | update `settings.firma` | `setari/page.tsx:39` | ⚠ |
| Setări | Salvează curierii | update `settings.curieri` | `setari/page.tsx:39` | ⚠ |
| Setări | Schimbă rolul unui cont | update `profiles.role` | `setari/page.tsx:44` | ⚠ |
| Integrări | Salvează credențiale (FAN, Netopia, Saga, GA4) | update `settings.integrari` | `integrari/page.tsx:60` | ⚠ |
| Produse | Comutator publicat pe rând | update `products.publicat` | `produse/page.tsx:53` | ⚠ |
| Produse | Acțiune în masă publică/depublică | update `products.publicat` | `produse/page.tsx:121` | ⚠ |
| Produse | Produs nou (rapid) | insert `products` | `produse/page.tsx:64` | ok |
| Produse | Import CSV | insert `products` | `produse/page.tsx:94` | ok |
| Produse | Șterge produs | rpc `sterge_produs` | `produse/page.tsx:73` | ok |
| Produse | Ștergere în masă | rpc `sterge_produs` × n | `produse/page.tsx:114` | ⛔ ignoră rezultatul |
| Produse | Salvează formularul complet | update/insert `products` | `admin/ProductForm.tsx:64,68` | ⚠ |
| Piese de completat | Salvează greutatea reală | update `products.greutate_kg` | `piese-de-completat:126` | ⛔ |
| Piese de completat | Reia pozele eșuate | POST `/api/publica-piesa` | `piese-de-completat:146` | ok |
| Import | Previzualizare / start / lot / pauză / reluare | POST `/api/import` | `import/page.tsx:59` | ok |
| Comenzi (detaliu) | Schimbă statusul | update `orders` | `comenzi/[id]:46` | ⚠ |
| Comenzi (detaliu) | Adaugă notă în jurnal | insert `order_events` | `comenzi/[id]:48` | ⛔ |
| Comenzi (detaliu) | Setează costul livrării | rpc `seteaza_cost_livrare` | `comenzi/[id]:78` | ok |
| Comenzi (detaliu) | Anulează comanda | rpc `anuleaza_comanda` | `comenzi/[id]:55` | ok |
| Comenzi (detaliu) | Șterge comanda | rpc `sterge_comanda` | `comenzi/[id]:62` | ok |
| Comenzi (detaliu) | Generează AWB | POST `/api/awb` | `comenzi/[id]:96` | ok |
| Cereri | Schimbă statusul (4 taburi) | update `part_requests` / `car_intake_requests` / `return_requests` / `contact_messages` | `cereri/page.tsx:41` | ⛔ |
| Cereri | Salvează nota internă | update `<tabel>.nota` | `cereri/page.tsx:44` | ⛔ |
| Categorii | Adaugă / editează categorie | insert / update `categories` | `categorii/page.tsx:39,42` | ⚠ |
| Categorii | Șterge categorie (+ dezleagă produsele) | update `products` ×2, delete `categories` | `categorii/page.tsx:52,53,54` | ⛔ ⚠ |
| Mărci | Adaugă / editează marcă | insert / update `brands` | `marci/page.tsx:39,40` | ⚠ |
| Mărci | Adaugă / editează model | insert / update `models` | `marci/page.tsx:50,53` | ⚠ |
| Mărci | Șterge marcă / model | delete | `marci/page.tsx:63,70` | ⚠ |
| Mașini | Adaugă / editează mașină | insert / update `vehicles` | `masini/page.tsx:54,58` | ⚠ |
| Mașini | Șterge mașina (+ dezleagă piesele) | update `products`, delete `vehicles` | `masini/page.tsx:67,68` | ⛔ ⚠ |
| Expedieri | Marchează expediate (în masă) | update `orders.status` | `expedieri/page.tsx:64` | ⛔ |
| Expedieri | Borderou de predare | doar tipărire | — | ok |
| Facturi | Setează seria facturii | update `orders.factura_serie` | `facturi/page.tsx:31` | ⛔ |
| Facturi | Export CSV Saga | doar descărcare | — | ok |
| Marketing | Creează cod de reducere | insert `discount_codes` | `marketing/page.tsx:21` | ok |
| Marketing | Activează/dezactivează cod | update `discount_codes.activ` | `marketing/page.tsx:30` | ⛔ |
| Marketing | Șterge cod | delete `discount_codes` | `marketing/page.tsx:34` | ⛔ |
| Clienți / Rapoarte / Dashboard | doar citiri | — | — | ok |

**23 din 30 de acțiuni de scriere pot să eșueze fără ca cineva să afle** — 10 dintre ele nici măcar nu se uită la `error`, deci ratează și erorile *reale* (constrângeri, chei străine).

`insert` e singurul sigur: RLS ridică `42501` la insert, deci eroarea chiar ajunge înapoi. De asta „adaugă" merge și „salvează" minte.

## 3. Tiparul repetat și soluția comună propusă

Nu sunt 23 de defecte, e unul singur în 23 de locuri. Propun o funcție în `lib/supabase.ts`:

```ts
/** Scrie ȘI verifică. Un update/delete oprit de RLS întoarce 0 rânduri și NICIO
 *  eroare — de asta interfața putea spune „salvat" fără să fi salvat ceva. */
export async function scrieVerificat(q: any): Promise<{ ok: boolean; eroare?: string }> {
  const { data, error } = await q.select();          // Prefer: return=representation
  if (error) return { ok: false, eroare: error.message };
  if (!data?.length) return { ok: false, eroare: "Nu s-a modificat niciun rând — contul curent n-are dreptul acesta." };
  return { ok: true };
}
```

Apel: `const r = await scrieVerificat(sb.from("settings").update({ valoare }).eq("cheie", cheie));`

Un `.select()` în plus pe fiecare scriere, zero migrări, zero librării, și mesajul de succes devine imposibil de afișat pe o operațiune care n-a atins nimic. Aș adăuga în același pas și dezactivarea butonului în timpul salvării, unde lipsește.

**Nu am reparat nimic** — aștept aprobarea listei, cum ai cerut.

## 4. Ce n-am putut testa

**Etapa 2 în întregime.** Fără un cont de echipă nu pot executa acțiunile, deci nu pot face pasul 2 (verific în DB) și pasul 3 (refresh). Inventarul de mai sus e din cod și din structura bazei, nu din clicuri — l-am marcat ca atare.

Un lucru l-am găsit deja fără să apăs nimic, și ține de verificarea ta #3: **`app/layout.tsx` are `revalidate = 300`**, iar datele firmei se citesc pe server prin `getSetariServer()`. Deci chiar și după ce salvarea va funcționa, subsolul, pagina de contact și documentele legale pot arăta adresa veche **până la 5 minute**. Paginile de catalog au deja `force-no-store`; cele informative, nu. Nu există niciun `revalidatePath` în proiect. Asta e o a doua cauză, independentă, pentru „am salvat și nu se vede".

---

# De rulat în Supabase

**`supabase/import-din-admin.sql`** (migrarea 22) — extinde `import_jobs`, creează bucketul privat `import-csv`, elimină triggerul `verifica_publicarea` și readuce `anuleaza_comanda` la republicarea simplă. Idempotentă. **Până n-o rulezi, `/admin/import` nu are unde să-și scrie starea.**

# Probleme găsite și nereparate

1. **PartArt bej pe gri rece** — muchie vizibilă, ai cerut să nu repar singur
2. **4 perechi de contrast sub prag pe tema luminoasă** — valorile sunt cele cerute de tine; propunerile care trec sunt mai sus
3. **14 poze `.jpg` neconvertite** în bucket (212 KB în loc de ~97 KB) — de pe vremea când `sharp` lipsea
4. **Miniaturile din galeria de produs** au 51×38 la 320px și 59×44 la 360px, sub ținta de 44px — preexistent
5. **Clauza de transport din certificatul de garanție** contrazice OUG 140/2021 — decizie de client
6. **`.gitignore` înghițea `lib/import/`** — tiparul `import/` prindea orice folder cu numele ăsta. **Asta am reparat** (ancorat la `/import/`), altfel tot motorul de import rămânea necomis fără ca cineva să afle.

---

# Capturile de ecran

Trimise separat în conversație (nu sunt în depozit):

- `inainte-header-{1024,1280,1440}.png` / `dupa-header-{1024,1280,1440}.png` — bara de căutare, înainte/după
- `luminos-home.png`, `luminos-piese.png`, `luminos-produs.png`, `luminos-cos.png`, `luminos-footer.png` — tema luminoasă cu paleta nouă
- `partart-muchie.png` — comparația bej pe gri rece
