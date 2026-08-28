# AUTOPAS DEZMEMBRĂRI — context de proiect pentru Claude Code

Acest fișier îți dă contextul complet ca să poți continua proiectul fără explicații repetate.
Citește-l întâi, apoi lucrează.

## Ce este
Magazin online de piese auto second-hand din dezmembrări. Depozitul e pe Str. Petru Rareș nr. 181,
pe DN 15 între Piatra-Neamț și Bicaz (sat Bistrița, com. Alexandru cel Bun, jud. Neamț) — aceeași
adresă cu sediul social. Site public + cont client + panou de administrare complet.

**Stare la 28 august 2026: încă nelansat.** Nu are clienți, nu are comenzi reale (`orders` e goală).
În bază sunt **8.754 de piese**, importate din pieseauto.ro — sunt anunțurile reale ale firmei, nu
exemple — și **22 de mașini** la dezmembrat, introduse de mână.
Codul nu trebuie să conțină date inventate; datele din bază sunt provizorii și e în regulă.

## Stack
- **Next.js 14** (App Router) + **TypeScript** + **Tailwind CSS**
- **Supabase** (PostgreSQL + Auth + Storage) — baza de date și autentificarea
- **Vercel** — găzduire; fiecare `git push` pe `main` declanșează un build automat
- Fără alte librării de UI; iconurile sunt SVG scrise de mână; graficele sunt SVG proprii

## Cum rulezi și verifici
```bash
npm install
npm run dev      # dezvoltare pe http://localhost:3000
npm run build    # OBLIGATORIU înainte de commit — prinde erorile de tip
```
Nu face push dacă `npm run build` nu trece cu „Compiled successfully".

## Reguli de lucru (important)
- **Răspunde în română.** Utilizatorul e începător — explică pe scurt ce faci și de ce.
- **Cod complet**, nu fragmente. Comentarii scurte în cod, în română.
- **Fără date demo hardcodate** — tot ce se afișează vine din Supabase.
- **Nu inventa** funcții, tabele sau coloane. Dacă ai nevoie de ceva nou în baza de date,
  scrie întâi un fișier SQL nou în `supabase/` — fișierul rămâne sursa adevărului, ca să
  existe urmă în git a tot ce s-a schimbat în bază.
- **Rularea migrărilor pe producție** (via conectorul Supabase, aprobat de utilizator la
  7 august 2026): se poate, cu trei condiții — (1) spui înainte ce script rulezi și ce
  atinge; (2) la operații ireversibile (`drop`, `delete`, `revoke`, `update` în masă) ceri
  confirmare separată; (3) raportezi rezultatul complet, inclusiv erorile. Fără conector
  activ, revii la varianta veche: îi spui utilizatorului să ruleze scriptul manual.
- **Migrările Supabase se rulează separat, în ordine** (vezi mai jos). Supabase rulează tot
  scriptul ca o tranzacție — o eroare anulează tot. Ține migrările mici și idempotente
  (`if not exists`, `on conflict do nothing`, `drop policy if exists` înainte de `create policy`).
- **Secretele** (chei API, parole curieri) stau în variabilele Vercel sau în tabela `settings`
  (protejate de RLS), niciodată în cod.
- **Nu reproduce logo-uri de mărci** (Audi, BMW…) — secțiunea „Mărci auto" e doar text.
  Bannerele ANPC/SOL sunt fișiere oficiale în `public/`, nu redesenate.

## Structura
- `app/` — paginile (App Router). `app/admin/` = panoul de administrare (16 module).
  `app/masini/` = paginile publice ale mașinilor dezmembrate.
- `components/` — componente refolosibile; `components/admin/` = specifice adminului.
- `lib/` — `supabase.ts` (clienți: server, browser, admin cu service key), `settings.ts`
  (firmă/curieri/integrări din DB), `types.ts`, `format.ts`, `couriers.ts`, `config.ts`, `legal.ts`,
  `imagini.ts`. `lib/import/` = motorul de import, în `.mjs`, folosit și de script, și de rută.
- `supabase/` — migrările SQL (vezi ordinea).

## Ordinea migrărilor SQL (rulare manuală în Supabase, o singură dată fiecare)
1. `schema.sql` -> 2. `seed.sql` -> 3. `filtru.sql` -> 4. `integrari.sql` ->
5. `admin.sql` -> 6. `sprint-bc.sql` -> 7. `upgrade.sql` (include și politicile pentru poze) ->
8. `favorite.sql` -> 9. `admin-fix.sql` -> 10. `date-firma.sql` -> 11. `comanda-server.sql` ->
12. `livrare-dupa-comanda.sql` -> 13. `coduri-reducere-private.sql` -> 14. `view-security-invoker.sql` ->
15. `cautare-fara-diacritice.sql` -> 16. `email-unic.sql` -> 17. `import-pieseauto.sql` ->
18. `taxonomie-import.sql` -> 19. `greutate-estimata.sql` -> 20. `import-index-fix.sql` ->
21. `publicare-cu-poze.sql` -> 22. `import-din-admin.sql` -> 23. `rls-citire-echipa.sql` ->
24. `ani-generatie.sql` -> 25. `marci-lipsa.sql` -> 26. `generatii-si-denumiri.sql` ->
27. `mod-vacanta.sql` -> 28. `pagini-masini.sql` -> 29. `numar-piese-pe-model.sql` ->
30. `ga4-public.sql` -> 31. `categorii-numar-rapid.sql`
Idempotente (se pot re-rula oricând): 6, 7, 9–31.
NU sunt încă idempotente: 1–5, 8.
**Aplicate pe producție: 1–30.** 31 e scrisă și **o rulează utilizatorul**.
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

## De configurat (nu e cod, se rezolvă din afara proiectului)

Lucruri pe care codul le presupune deja făcute, dar care încă nu sunt. Nu le implementa —
sunt sarcini ale utilizatorului. Consemnate la 24 august 2026.

- **`contact@autopas-dezmembrari.ro` — cutia poștală nu există încă.** Adresa e sursa unică
  din `settings.firma.email` și apare în toate cele 8 documente legale din `lib/legal.ts`,
  unde clientul are drept legal să scrie (retur, garanție, GDPR). Până la configurarea
  cutiei, mesajele trimise acolo **se pierd tăcut** — nimeni nu primește nimic și
  expeditorul nu află.
- **`NEXT_PUBLIC_SITE_URL` nu e setată în Vercel.** Fără ea: mesajul WhatsApp de
  confirmare a comenzii iese fără domeniu (`SITE_DOMENIU` din `lib/config.ts` întoarce
  intenționat șir gol, ca să nu scrie „de pe localhost:3000" într-un text către client),
  iar `sitemap.xml`, `robots.txt` și linkurile Open Graph trimit spre adresa `.vercel.app`.
  Valoarea corectă: `https://autopas-dezmembrari.ro`. Toate variabilele sunt documentate
  în `.env.local.example`.

## Decizii deja luate (nu le schimba fără să întrebi)
- Logo = imagine PNG (roată dințată + siluetă de mașină + „AUTOPAS DEZMEMBRĂRI", metalic cu
  portocaliu #FF6B1A), pusă din 10 august 2026 în locul vechiului logo scris cu text. Se afișează
  prin `components/Logo.tsx` — singura sursă; îi dai înălțimea din `className`. Originalul netăiat
  stă în `design/logo-original.png` (nu e servit public), iar `design/genereaza-imagini.py` reface
  din el `public/logo.png` + iconițele + imaginea de partajare. Logo-ul e gândit pentru fundal
  închis (header, subsol, sidebar-ul de admin — toate temele le au închise). Font: Poppins
  (local, în `app/fonts/`).
- VIN = **se folosește, dar niciodată complet**. Pe mașinile la dezmembrat există `vin_masca`
  (serie parțială, ex. `WVWZZZ1KZ…8452`), afișată public în `/cauta-dupa-masina` și editabilă în
  `/admin/masini`. Formularul de predare a mașinii cere VIN-ul complet, opțional
  (`car_intake_requests.vin`), vizibil doar echipei. Ce s-a abandonat e căutarea pieselor după VIN.
- Starea piesei A/B/C — scoasă din interfață (filtru, pagina de produs, admin, import).
  Coloana `products.stare` încă există în bază, dar e `nullable` și nu se mai completează;
  a rămas doar ca să nu strice datele vechi. `stare_nota` (text liber) se folosește în continuare.
- Cod intern piesă = generat automat, format `AP-000123`.
- Număr comandă = generat pe server, din contorul `nr_comanda_seq`, format `AP-2026-01000`.
- Facturare prin **Saga** = export CSV (Saga nu are API public); statusul e-Factura îl gestionează Saga.
- Curier = **doar FAN Courier** (decizie 7 aug 2026). Cargus și Sameday au fost scoase complet
  din cod, din texte și din `settings.curieri`. Scheletul SelfAWB se activează la primirea
  credențialelor (Admin -> Integrări).
- Plată card = fază viitoare; butonul e vizibil, activarea vine cu procesatorul.
- Notificare comandă nouă = alertă sonoră+vizuală în `/admin` (fără e-mail; utilizatorul a refuzat Resend)
  + buton „Trimite confirmarea pe WhatsApp" precompletat.
- **Costul livrării NU se afișează la checkout** (decizie 7 aug 2026). Piesele diferă prea mult ca
  greutate și gabarit ca să existe un tarif fix. Clientul comandă doar produsele; echipa completează
  în `/admin/comenzi/[id]` greutatea, dimensiunile, transportul de bază, km suplimentari și alte taxe,
  iar funcția `seteaza_cost_livrare` recalculează totalul. Generarea AWB e blocată până atunci.
  Costul se comunică telefonic + pe WhatsApp. E-mail automat: refuzat deocamdată.
- **Prețurile și totalurile se calculează exclusiv pe server** (`plaseaza_comanda`). Browserul trimite
  doar id-urile pieselor. Nu adăuga niciodată `insert` direct în `orders`/`order_items` — politicile
  RLS de insert au fost șterse intenționat.
- **Paginile de catalog nu se pun în cache** (`fetch-cache = "force-no-store"` în `app/page.tsx`,
  `app/piese/page.tsx`, `app/piese/[slug]/page.tsx`, `app/cauta-dupa-masina/page.tsx`). `revalidate = 300`
  din `app/layout.tsx` se aplică întregului arbore de rute și ținea stocul vechi 5 minute — inacceptabil
  când fiecare piesă e unicat. Paginile informative păstrează cei 300 de secunde.
- **Căutarea merge fără diacritice**, prin coloana calculată `products.cautare`. Funcția de normalizare
  există în două locuri care trebuie ținute la fel: `text_cautare` în bază și `textCautare` din
  `lib/format.ts`. Cuvintele din căutare se caută separat (toate trebuie să apară).
- **`products` are două legături către `categories`** (`categorie_id` și `subcategorie_id`), deci orice
  `select` cu `categories(*)` trebuie să numească cheia: `categories!products_categorie_id_fkey(*)`.
  Altfel Supabase respinge cererea ca ambiguă (PGRST201) și pagina rămâne goală.
- **Orice UPDATE sau DELETE din `/admin` trece prin `scrieVerificat()`** din `lib/supabase.ts`.
  Motivul e defectul din 25 august 2026: un UPDATE oprit de RLS întoarce 204, **zero rânduri
  și NICIO eroare**, deci codul care se uită doar la `error` afișa „✓ Salvat" peste o
  operațiune care n-a atins nimic. Funcția cere înapoi rândurile atinse (`.select()`) și
  tratează zero rânduri ca eșec. La `insert` nu e nevoie: acolo RLS chiar ridică eroare (42501).
  Excepție conștientă: dezlegările în masă („scoate categoria de pe toate piesele ei"), unde
  zero rânduri e un rezultat legitim — sunt marcate cu comentariu în cod.
- **După o salvare din Setări se cheamă `/api/revalideaza`**, care face
  `revalidatePath("/", "layout")`. Fără el, `revalidate = 300` din `app/layout.tsx` ține datele
  firmei vechi până la 5 minute în subsol, la contact și în documentele legale — exact simptomul
  „am salvat și nu se vede".
- **Rutele din `app/api/` nu sunt protejate de RLS** — rulează pe server, cu drepturi de server.
  Cele care fac ceva în numele firmei cer token-ul sesiunii și îl verifică cu `esteEchipa()` din
  `lib/supabase.ts` (vezi `app/api/awb/route.ts`).
- **Funcțiile rulează la Frankfurt** (`vercel.json`, `"regions": ["fra1"]`, 25 august 2026). Implicit
  Vercel le pune la Washington (`iad1`), ceea ce e absurd pentru un magazin din Neamț: fiecare pagină
  randată pe server făcea drumul peste Atlantic. Motivul imediat a fost însă altul — pieseauto.ro
  refuzase IP-ul de pe care rula importul, iar Frankfurt e alt bazin de adrese. `vercel.json` nu
  acceptă comentarii, de asta explicația stă aici.
- Indexarea în Google e **oprită** până la lansare; se activează cu `PERMITE_INDEXARE=da` în Vercel.
  Domeniul ales: `autopas-dezmembrari.ro` (neînregistrat încă la 7 aug 2026).
- **Importul din pieseauto.ro rulează din `/admin/import`**, în loturi cerute de browser, cu starea
  în `import_jobs` și fișierul CSV într-un bucket privat. Scriptul `scripts/import-pieseauto.mjs`
  rămâne, pentru rulări fără browser. AMÂNDOUĂ folosesc același motor, din `lib/import/` — nicio
  regulă de import nu are voie să existe în altă parte (vezi `lib/import/README.md`).
- **Paginile se aduc pe HTTP/2, cu `node:http2`** (constatat 25 august 2026). pieseauto.ro refuză
  cererile HTTP/1.1: `fetch` din Node ȘI `node:https` primesc pagina „sorry" cu HTTP 200, chiar cu
  antetele curățate. Nu antetele erau vinovate (nici `sec-fetch-mode`), ci versiunea de protocol —
  `curl` negocia h2 și de asta mergea doar el. Cu h2 nativ, importul merge la fel din Codespace și
  din funcția serverless de pe Vercel, deci **clientul poate încărca CSV-ul direct din site**.
  `curl` a rămas doar ca plasă, dacă h2 nu se poate deschide. Un singur drum în ambele medii —
  diferența dintre ele era chiar cauza defectului de mai jos.
- **Un refuz care ține după toate reîncercările oprește lotul** (`fatal` în `aducere.mjs`,
  `oprit = "refuz"` în motor). Înainte, fiecare piesă nouă intra în scara de reîncercări
  (5+15+45 = 65s), funcția era tăiată la 60s cu **504**, iar cum progresul se scria doar la finalul
  lotului, `procesate` rămânea 0 și „Continuă importul" relua la infinit aceleași rânduri. Azi lotul
  se oprește în ~1s, jobul trece în `in_pauza` cu motivul scris, și poate fi continuat.
- **Progresul unui lot se salvează din mers**, la fiecare 4 secunde (`SALVARE_LA_MS` în
  `app/api/import/route.ts`), nu doar la final. Fără asta, orice cerere tăiată pierdea tot lotul.
- **Un lot întreabă baza doar despre rândurile pe care le poate atinge** (`randuri.slice(0, maxRanduri)`
  în motor). Înainte întreba despre toată coada feed-ului: la 8.500 de rânduri însemna 85 de cereri
  REST — 3,4 secunde măsurate — înainte de a procesa 4 piese, la fiecare lot. Nu accelerează nimic
  spre pieseauto.ro (pauza politicoasă e neatinsă); doar nu mai irosește bugetul lotului.
- **Invariantul unui lot**: `BUGET_MS + TIMEOUT_PAGINA_MS + BUGET_POZE_MS ≤ 55s`, adică 15 + 20 + 15 = 50,
  sub limita de 60s a funcției. Bugetul se verifică înainte de fiecare rând, deci lotul mai poate începe
  unul chiar la limită. Pozele unei piese au buget propriu (`BUGET_POZE_MS`) pe lângă timeout-ul fiecăreia:
  opt poze lente s-ar înmulți, iar un rând neterminat nu avansează poziția — importul s-ar bloca pe el.
  Cine schimbă una dintre cele trei valori reface suma; `verifica-import.mjs` o verifică.
- **Pentru primul import mare (mii de piese) se folosește scriptul din terminal**, nu ecranul din admin.
  `scripts/import-pieseauto.mjs` face o singură trecere: citește CSV-ul o dată, taxonomia o dată,
  existența o dată. Ecranul din admin cere un lot pe HTTP, deci reciteste CSV-ul la fiecare lot —
  la 8.500 de rânduri sunt ~2.000 de loturi × ~1 MB. Adminul e gândit pentru feed-ul zilnic
  (mai ales actualizări de preț, care nu cer nicio pagină de la sursă).
- **Nicio piesă importată nu mai rămâne fără categorie** (decizie 25 august 2026, care înlocuiește
  regula veche „ambiguu sau inexistent => se lasă gol"). Ce lipsește din arborele nostru se creează
  automat, cu numele luat din catalogul pieseauto.ro (`lib/import/taxonomie-sursa.mjs`, 742 categorii
  în 33 de grupe, regenerat cu `scripts/actualizeaza-taxonomie-sursa.mjs`). Ordinea deciziei:
  (1) `REGULI_CATEGORII` — traducerile aprobate de om au întâietate, fiindcă sunt mai bune decât
  automatismul („Răcitor gaze" merge la „EGR și Clapetă acceleratie", unde îl caută un mecanic);
  (2) părintele vine din grupa lor, prin `GRUPE_LA_PARINTE`; (3) o grupă nemapată devine ea însăși
  categorie-părinte. Taxonomia LOR e plată în breadcrumb — grupa se poate afla doar din `/categorii/`.
- **O piesă se leagă de TOATE mașinile compatibile** (`products.model_ids`, corectat 25 august 2026).
  Pagina sursei scrie „Piesă auto compatibilă cu:" și enumeră mai multe mașini, dar **doar prima e
  link** — restul sunt text simplu în `<span class="q-car-model">`. Regexul vechi cerea `<a>` înăuntru
  și pierdea tăcut celelalte linii, așa că „Debitmetru Aer Vw Sharan" apărea legat doar de Ford
  Galaxy. Nu era o greșeală a sursei: Sharan și Galaxy sunt aceeași mașină, Caddy e pe platforma lui
  Golf 5. Un radiator de Passat B6 se leagă legitim de 7 modele.
- **Modelul „principal"** (`model_id`, pentru afișare) e primul recunoscut pe care îl confirmă și
  titlul — titlul descrie mașina de pe care s-a demontat piesa. Semnalarea „⚠ nu apare în titlu" se
  face doar dacă NICIUNA dintre compatibilități nu apare acolo; una singură care lipsește e a doua
  mașină compatibilă, nu o eroare.
- **Crearea unui model lipsă are două reguli diferite**: dacă piesa n-are niciun model, se creează
  doar linia pe care titlul o confirmă (altfel am lega o piesă de Golf 5 la un „Jetta" nou-nouț);
  dacă piesa are deja un model, restul liniilor sunt compatibilități în plus și se creează fără altă
  condiție. Nu se creează NICIODATĂ un model generic când există deja generații pentru numele acela
  („Octavia" lângă „Octavia 2" și „Octavia 3" ar rupe filtrul în două).
- **Generația se deduce din anii din titlu**, întâi strict (anii încap în interval), apoi prin
  suprapunere — dar numai dacă o singură generație se suprapune. „Caddy 2003 2004 2005" iese cu un an
  din „Caddy III (2004–2015)" și tot se nimerește; „Golf 2008" prinde și Golf 5, și Golf 6, deci
  rămâne ambiguu și nu se alege niciuna.
- **Greutatea NU poate veni de la pieseauto.ro** (verificat 25 august 2026): nu e nici în CSV
  (ID, URL, Titlu, Moneda, Pret), nici pe pagina produsului — n-au tabel de specificații. Rămâne
  1 kg cu `greutate_estimata = true`, cântărit la formarea coletului.
- **Piesele importate se publică direct**, cu pozele descărcate în timpul importului, chiar dacă le
  lipsește categoria sau modelul (decizie 25 august 2026). Greutatea primește 1 kg cu
  `greutate_estimata = true`; se cântărește la formarea coletului. Triggerul `verifica_publicarea`,
  care interzicea publicarea fără poze, a fost eliminat de migrarea 22. Ecranul „Piese de completat"
  nu mai e o poartă, ci o listă de lucru cu ce lipsește, sortată după gravitate.
- **Feed-ul pieseauto.ro e mereu complet**, deci o piesă lipsă din el înseamnă vândută: se depublică
  automat (`sursa_activ = false`, `publicat = false`, rândul rămâne). Peste 20% piese lipsă,
  importul cere confirmare separată — un export trunchiat ar stinge tot catalogul.
- Favorite = model hibrid (localStorage pentru nelogați + tabela `favorites` pentru logați, cu sincronizare).
- **Anii generației stau în `models.an_start` / `models.an_final`, nu în nume** (migrarea 24,
  28 august 2026). Înainte, `interval()` din `lib/import/potrivire.mjs` îi citea din numele
  modelului, cu un regex care cerea paranteze: „Fabia 2 (2007–2014)". Doar 69 din 345 de modele
  îi aveau scriși, și în formate amestecate („Crafter 2E 2006 -2017", fără paranteze). Un model
  fără interval era eliminat TĂCUT din dezambiguizare, deci „Fabia 3" nu putea fi ales niciodată
  — cele 40 de piese de „Skoda Fabia" rămâneau fără model din cauza asta. `an_final` null
  înseamnă „încă în producție", nu „necunoscut". Numele rămâne doar pentru afișare, iar citirea
  din nume a rămas ca plasă pentru modelele create înainte de migrare. Anii se completează din
  Admin → Mărci și modele; un model fără ani e marcat acolo cu „⚠ fără ani".
  Atenție la Peugeot: „2008", „3008", „308" sunt NUME de modele. De aceea nu se caută niciodată
  un an singur, ci doar un interval („2006–2014") sau o formă deschisă („2026 +").
- **Tabela `brands` e completă intenționat; curățenia se face la AFIȘARE** (decizie 28 august
  2026). Filtrul de pe site arată doar mărcile cu cel puțin o piesă publicată — `marciCuPiese`
  din `lib/format.ts`, folosită în `app/page.tsx`, `app/piese/page.tsx` și
  `app/cauta-dupa-masina/page.tsx`. Așa mărcile rămase din lista de dealer (BYD, Cherry, OMODA,
  JAECOO) dispar singure din meniu fără să ștergem un rând, iar una care primește prima piesă
  apare singură, fără migrare. La mărci NU există prag pe număr de piese, spre deosebire de
  subcategorii: cine caută Alfa Romeo caută exact asta, iar 8 piese invizibile sunt 8 piese
  pierdute.
- **Sinonimele de marcă sunt măsurate, nu presupuse** (`SINONIME_MARCI` din `potrivire.mjs`).
  La 28 august 2026 s-au numărat toate cele 12.410 linii de compatibilitate din bază: sursa
  scrie „Mercedes …" și niciodată „Mercedes-Benz", „Land Rover …" și niciodată „Range Rover",
  „SsangYong …" și niciodată „KGM"; „VAG" și „MB" nu apar deloc. A rămas un singur sinonim,
  KGM -> SsangYong, și acela pentru viitor: marca se numește azi oficial KGM, dar clientul care
  vrea o piesă de Rexton scrie „SsangYong".
- **Modul vacanță NU atinge niciodată `products.publicat`** (28 august 2026, `supabase/mod-vacanta.sql`).
  Implementarea evidentă — „la activare `update products set publicat=false`, la dezactivare
  invers" — ar distruge catalogul: a doua comandă ar republica piesele ascunse de operator, cele
  cu stoc 0 depublicate de trigger, cele dispărute din feed și cele nepublicate fiindcă le lipsea
  ceva. După dezactivare n-ar mai exista nicio cale de a distinge, iar informația s-ar pierde
  ireversibil. E doar un comutator global în `settings.vacanta`, citit la AFIȘARE.
  · Blocarea reală a comenzilor e în `plaseaza_comanda`, prima verificare din funcție, înaintea
    oricărei scrieri. Restul (liste goale, butoane ascunse) e cosmetică: cine are checkout-ul
    deschis tot nu poate comanda.
  · Rândul din `settings` NU e citibil public — `activat_de` e adresa unui om din echipă. Site-ul
    primește doar `activ` și `mesaj`, prin `vacanta_publica()`.
  · **Paginile de produs rămân accesibile, cu HTTP 200, iar `sitemap.xml` nu se schimbă.** Dacă ar
    întoarce 404, Google le-ar scoate din index, iar poziționarea s-ar recâștiga în săptămâni, nu
    în ore. Se schimbă doar butonul de comandă.
  · Verificarea „nu atinge catalogul" nu se poate face citind codul, fiindcă defectul ar fi
    invizibil până la dezactivare: `scripts/verifica-vacanta.mjs` ia o amprentă a catalogului,
    face un ciclu activare/dezactivare și o compară.
  · Ascunderea butonului de coș stă în `AddToCart`, nu în `ProductCard`: e singurul loc prin care
    o piesă ajunge în coș, deci acoperă dintr-o dată și favoritele, și piesele similare, și orice
    listă adăugată pe viitor. (`ProductCard` e componentă de server, n-are acces la context.)
- **Paginile de mașină dezmembrată** (`/masini`, `/masini/[slug]`, 28 august 2026). Se umplu din
  `products.vehicul_id`, adică din câmpul „Mașina-sursă" al editorului de produs. Legătura o pune
  OMUL, la listare.
  · **Cele 8.754 de piese importate rămân NELEGATE**, prin decizie a proprietarului. Feed-ul
    pieseauto.ro nu spune niciodată de pe ce mașină s-a demontat piesa: CSV-ul are ID, URL, Titlu,
    Monedă, Preț, iar pagina scrie „compatibilă cu", adică potrivire, nu proveniență.
  · **Nu încerca să deduci legătura din titlu.** S-a măsurat pe 28 august 2026 și e greșită: la
    „VW Golf 6 1.6 TDI", 36 din 67 de potriviri erau piese de Golf 7, fiindcă „6" se regăsește în
    „1.6". Cu potrivire pe subșir era și mai rău („6" prinde în „2016"). Plafonul optimist era 246
    de piese, 2,8% din catalog, și acelea contaminate. Două Passat B6 din curte (BMP și BMR) ar fi
    oricum indistingibile din titlu.
  · Deci o mașină fără piese NU e un defect, ci starea normală până la prima mașină dezmembrată de
    noi. Pagina ei rămâne la HTTP 200, cu specificațiile și formularul de cerere precompletat.
  · **Nicăieri nu se mai scrie „0 piese".** Hero-ul arată doar mașinile cu cel puțin o piesă și
    dispare complet dacă nu există niciuna (grila trece atunci pe o coloană); `/masini` le împarte în
    „Cu piese pe site" și „În dezmembrare acum"; `/cauta-dupa-masina` scrie „piese pe cerere" și duce
    la pagina mașinii, nu la `/piese?vehicul=…`, care pentru o mașină nelegată e drum înfundat.
  · Numărul de piese se calculează **live**, nu se ia din `vehicles.piese_listate`. Coloana e corectă
    (o ține triggerul `recalc_piese_vehicul`), dar e o valoare memorată, iar o desincronizare s-ar
    vedea exact ca defectul pe care tocmai l-am reparat.
  · Caruselul „piese de la mașini compatibile" are 3 niveluri din cele 4 din sarcină: același model,
    același model altă generație (prin `bazaModel` din `lib/format.ts`), aceeași marcă. **Nivelul 3,
    platforma comună, NU e implementat** — cere un tabel de platforme pe care nu-l avem. Sub 4
    rezultate caruselul se ascunde complet.
- **Pozele mașinilor stau în același bucket ca ale pieselor** (`poze-piese`) — e aceeași componentă,
  `PhotoUploader`. De aceea `scripts/curata-orfani.mjs` citește ȘI `vehicles.poze`: fără asta ar
  raporta fiecare poză de mașină drept orfană, iar `--sterge` le-ar șterge pe toate. Orice tabelă
  nouă cu coloană `poze` se adaugă acolo, în același loc.
- **PostgREST taie tăcut la 1.000 de rânduri. Nicio interogare nu are voie să presupună
  că a primit tot** (defect găsit la 28 august 2026, în producție de trei zile).
  · `.limit(5000)` NU ajută: plafonul e al serverului, iar `limit` îl poate doar coborî.
    Serverul spune adevărul în antetul `content-range: 0-999/8754`, dar nimeni nu-l citea, iar
    un array de 1.000 arată exact ca unul complet.
  · Ce s-a văzut: `/piese` arăta 1.000 de piese din 8.754 și n-avea nicio paginare; filtrul
    arăta 16 mărci din 38 (fără Dacia, Toyota, Volvo — `marciCuPiese` judeca după același
    eșantion); `sitemap.xml` avea 1.000 de URL-uri; contoarele din admin se calculau pe 11% din
    catalog; iar `curata-orfani.mjs --sterge` ar fi șters **18.776 din 20.157 de fișiere (93%)**,
    raportând succes.
  · **Unealta e `citesteTot()` din `lib/supabase.ts`** (geamăn pentru scripturi: `citesteTotRest`
    din `lib/rest.mjs`). Cere `{ count: "exact" }` în `.select()` — de acolo vine totalul din
    `content-range` — și ARUNCĂ eroare dacă lipsește, în loc să presupună. Plafonul de siguranță
    ARUNCĂ la depășire, nu taie.
  · **`.order()` pe o coloană UNICĂ (de regulă `id`) e obligatoriu la orice paginare.** Fără
    ordine stabilă, aceeași piesă poate apărea pe două pagini iar alta pe niciuna. `created_at`
    NU e unic: importul scrie sute de rânduri în aceeași secundă.
  · A doua limită, independentă: `.in("id", ids)` pune fiecare id în URL și crapă la câteva mii.
    Pentru asta există `citesteDupaIduri()`, care sparge în loturi de 200.
  · Contoarele NU se calculează în Node. `numar_piese_pe_model` și `numar_piese_pe_masina`
    (migrarea 29) întorc câte un rând pe model/mașină — corecte prin construcție, indiferent cât
    crește catalogul. Ca să afli 538 de numere nu aduci 8.754 de rânduri prin rețea.
  · Capcana era deja scrisă, din luni, în `lib/import/depozit.mjs` (helperul `tot()`), și n-a
    ieșit niciodată din modulul acela. Motorul de import a fost singurul cod corect.
- **Google Analytics 4 se încarcă doar dacă patru condiții sunt adevărate deodată**
  (28 august 2026): există un ID în Admin → Integrări, vizitatorul a apăsat „Accept toate",
  nu suntem în `/admin`, nu suntem în dezvoltare. Dacă una cade, în pagină nu ajunge niciun
  script și nu pleacă nicio cerere către Google. „Încă n-a ales" se tratează ca refuz.
  · ID-ul vine prin `ga4_public()` (migrarea 30), nu dintr-o citire a rândului `integrari`:
    acolo stau parola FAN Courier și cheia privată Netopia.
  · **`Analytics` își cere singur ID-ul, din browser, nu îl primește pe props.** Motivul e
    măsurat: `/cos`, `/checkout` și `/favorite` sunt pagini STATICE, iar orice valoare pe care
    layout-ul o randează pentru ele rămâne prinsă în HTML-ul de la build. Analytics-ul pornea
    pe paginile dinamice și tăcea exact pe cele unde se întâmplă vânzarea. Cererea pleacă doar
    după acceptare.
  · **Evenimentele trec printr-o coadă** (`ev()` din `lib/analytics.ts`). `gtag` apare după
    hidratare, iar efectele React rulează înaintea lui: fără coadă se pierdea tăcut fiecare
    eveniment de la PRIMA încărcare a unei pagini, inclusiv `purchase`. Coada se golește când
    `gtag` apare — NU prin `onReady` al lui next/script, care pentru un script inline se
    declanșează la montare, înainte ca scriptul să fi rulat.
  · **Evenimentele care depind de coș se leagă de `items`, nu de montare.** `CartContext`
    citește `localStorage` într-un efect, deci la prima randare coșul e gol; un efect cu
    dependențe goale trimitea `view_cart` cu zero piese, adică deloc.
  · `purchase` pleacă o singură dată: checkout-ul lasă conținutul comenzii în `sessionStorage`
    (valoarea calculată de SERVER), iar pagina de mulțumire îl trimite și lasă un semn legat de
    numărul comenzii. Reîncărcarea nu îl retrimite.
  · **Niciun dat personal în evenimente.** Fără nume, telefon, e-mail, adresă.
  · **Documentele legale sunt aliniate** (28 august 2026). Politica de cookies are acum o
    secțiune proprie pentru GA, cu tabelul celor două cookie-uri (`_ga` și `_ga_` + codul
    contului, 2 ani); „Setări cookie-uri" spune ce adaugă „Accept toate"; iar Google e trecut
    în lista destinatarilor din politica de confidențialitate. Dacă se schimbă vreodată ceva
    la măsurare — alt instrument, alt cookie, altă durată — se actualizează ÎNTÂI acolo, în
    ambele tabele, și abia apoi se pune în funcțiune.
- **Nu număra cu subinterogare corelată peste o tabelă mare** (28 august 2026). `categorii_cu_numar`
  calcula `nr_piese` cu un `select count(*) from products where … = c.id` pe FIECARE categorie:
  349 de scanări complete peste 8.783 de produse, **1,47 s**, plătiți la fiecare afișare a lui
  `/piese` și a primei pagini. Migrarea 31 le adună dintr-o singură trecere: **19,7 ms**, aceleași
  cifre. Tiparul e din aceeași familie ca plafonul de 1.000 de rânduri: nu se vede la 50 de piese
  și doare la 8.783.
  · `numar_piese_pe_masina` are aceeași FORMĂ, dar e nevinovat: merge pe indexul
    `products_vehicul_idx`, deci face 23 de căutări în index, nu 23 de scanări — 0,9 ms. Dacă
    indexul acela dispare vreodată, devine exact aceeași problemă.
  · Contoarele nu se calculează nici în Node, nici cu o subinterogare pe rând. Se calculează o
    dată, în bază, într-un view (vezi și `numar_piese_pe_model`).
- **Datorie tehnică știută, de reparat înainte ca al catalogul să se dubleze** (28 august 2026):
  · `/admin/masini` aduce toate cele 8.783 de produse (9 cereri paginate) doar ca să numere
    piesele pe mașină — `numar_piese_pe_masina` dă exact aceleași cifre în 0,9 ms. Se
    înlocuiește cu view-ul.
  · `/admin/rapoarte` aduce tot catalogul ca să traducă `product_id` în categorie și mașină.
    Azi e singura cale, dar la 30 de vânzări pe zi ar trebui mutat într-un `join` în bază.
  · `/piese` își face interogările de căutare în două valuri (vezi mai jos). Ecranele de admin
    n-au fost încă trecute prin aceeași verificare.
  Niciuna nu e blocantă: sunt ecrane interne, nu pagini publice. Devin dureroase când catalogul
  crește — exact ca plafonul de 1.000 de rânduri, care n-a durut până la a 1.001-a piesă.
- **Marca se adaugă titlurilor într-un SINGUR loc** (28 august 2026): șablonul
  `SABLON_TITLU` din `app/layout.tsx`, care îl importă din `lib/seo.ts`. Generatoarele de
  titlu NU pun sufixul, iar paginile nu folosesc `absolute`.
  · Motivul e un defect apărut de două ori în aceeași lună: marca se adăuga și în șablon, și
    în generator, dând „… | AUTOPAS · Autopas Dezmembrări" — 74 de caractere pe pagina de
    piesă, 85 pe cea de mașină. De fiecare dată invizibil în generator, vizibil doar în HTML.
  · Sufixul e ` | AUTOPAS`, forma scurtă: o foloseau deja 8.739 din cele ~8.780 de pagini, iar
    contextul mărcii vine oricum din domeniul afișat deasupra titlului în rezultate.
  · `scripts/verifica-seo.mjs` verifică pe pagini reale că marca apare **exact o dată**.
- **Amânat, cu criteriu de reluare: rutele de model** (`/piese/marca/{marca}/{model}`).
  Ar fi încă 538 de pagini, iar „piese Golf 5" e o căutare foarte bună. Se reia **după ce cel
  puțin 80% din cele 38 de pagini de marcă apar indexate în Search Console** — până atunci
  n-avem cum ști dacă nivelul al doilea funcționează, iar 538 de pagini neindexate ar dilua
  semnalul în loc să-l întărească.
- **Un schelet de încărcare pe o listare ANULEAZĂ `loading="lazy"`** (28 august 2026, măsurat
  A/B pe același build). Cu `loading.tsx` pe `/piese`, toate cele 24 de imagini se descărcau la
  prima încărcare: **1.475 KB pe telefon, în loc de 338**. Fără el, 6 imagini.
  · Cauza pare a fi momentul înlocuirii: cele 24 de elemente intră în pagină deodată și ajung
    toate în zona pe care browserul o consideră vizibilă înainte de așezarea finală.
    Dimensiunile explicite (`width`/`height`) NU repară — încercat și măsurat.
  · E un efect contraintuitiv: scheletul rezervă spațiu tocmai ca să nu sară pagina, dar exact
    asta îl face să pară că totul e pe ecran. Cine adaugă la loc un `loading.tsx` pe o listare
    trebuie să măsoare câte imagini se descarcă, nu doar cum arată.
  · Scheletele RĂMÂN pe paginile cu puține imagini — piesă, mașină, `/masini` — unde verificarea
    arată zero efect. Pe listări, răspunsul la click îl dă `components/BaraProgres.tsx`: e
    `fixed`, nu ocupă spațiu în flux, deci nu poate muta niciun card.
- Roluri: `client`, `operator`, `contabil`, `admin` (coloana `role` în `profiles`, controlată prin RLS).

## Cele 16 module de admin
Dashboard · Comenzi (+detaliu cu jurnal, cost livrare, anulare cu restoc, ștergere) ·
Cereri (inbox 4 taburi) · Produse (pagină de editare cu poze reale) · Piese de completat ·
Import pieseauto.ro · Categorii (+subcategorii) · Mărci și modele · Mașini la dezmembrat
(profit/amortizare) · Expedieri (AWB) · Clienți · Facturi (export Saga) · Rapoarte ·
Marketing (coduri reducere) · Setări (firmă, curier, roluri) · Integrări.
„Mașini la dezmembrat" ține și pagina publică a fiecărei mașini: poze, descriere, comutator de
publicare, marcă/model și specificații. Mașinile cărora le lipsește ceva sunt marcate acolo cu
„⚠ fără marcă" / „⚠ fără model", ca la modelele fără ani.
Meniul și drepturile pe rol sunt definite în `app/admin/layout.tsx` (constanta `MENIU`).

## Baza de date — tabele cheie
`categories` (+`parent_id` subcategorii, view `categorii_cu_numar`), `products` (+`poze[]`,
`cod_intern`, `originala`, `subcategorie_id`, `greutate_kg`, `cost_lei`, `vizualizari`),
`vehicles` (+`cost_achizitie`, `status`, `piese_listate` actualizat prin trigger),
`orders` (+`livrare_baza`, `livrare_km_extra`, `livrare_alte`, `livrare_greutate_kg`,
`livrare_dimensiuni`, `livrare_nota`, `livrare_stabilit_la` — `null` = transport necalculat)
+ `order_items` (trigger scade stocul automat) + `order_events` (jurnal),
`brands` + `models`, `part_requests`/`car_intake_requests`/`return_requests`/`contact_messages`
(cu status), `profiles` (roluri), `discount_codes`, `settings`, `favorites`.

## Funcții de bază de date (toate `security definer`, verifică rolul în interior)
`plaseaza_comanda` (singura cale de a crea o comandă) · `seteaza_cost_livrare` (doar echipa) ·
`valideaza_cod` (publică) · `anuleaza_comanda`, `sterge_comanda`, `sterge_produs` (doar echipa/admin) ·
`is_admin`, `is_staff` · triggere: `scade_stocul`, `jurnal_comanda`, `recalc_piese_vehicul`,
`set_cod_intern`, `handle_new_user`.
La orice funcție nouă expusă public: `revoke execute ... from public` — nu doar de la `anon`,
fiindcă `anon` moștenește dreptul prin rolul `PUBLIC`.

## Culorile site-ului

**Identitate: „Atelier, galben industrial" (#F2B705). DOUĂ teme, din 25 august 2026:
„Întunecat" (implicită, negru) și „Luminos" (griuri reci). Culorile se modifică exclusiv din
`app/globals.css`: blocul `:root` pentru întunecat, `:root[data-tema="luminos"]` pentru luminos.**
Componentele nu scriu niciodată culori direct, ci folosesc clasele semantice din
`tailwind.config.ts` (`bg-fundal`, `text-text`, `text-textSecundar`, `bg-accent`,
`text-accentContrast`, `border-chenar`, `bg-imagineBg`, `bg-heroBg`…), care citesc variabilele.
O schimbare de nuanță = o linie modificată.

Comutatorul e o iconiță soare/lună în header (`components/ComutatorTema.tsx`). Alegerea stă în
`localStorage`, cheia `autopas-tema`, iar scriptul anti-flash din `<head>`-ul lui
`app/layout.tsx` o aplică înainte de prima desenare. Implicit rămâne întunecatul, indiferent
de `prefers-color-scheme`.

Reguli care rezultă din asta:
- **Nu scrie hexa în componente.** `bg-accent`, nu `bg-[#F2B705]`.
- `--accent-contrast` e **închis** (#101010): textul de pe galben e negru. Alb pe #F2B705 dă
  1,8:1, ilizibil. Pe butoanele de accent se folosește `text-accentContrast`, niciodată `text-white`.
- **Galbenul NU e niciodată text pe tema luminoasă** (dă 1,82:1 pe alb). Locurile care îl vor pe
  tema întunecată — prețuri, săgeți, pictograme, cuvinte scoase în față — folosesc clasele
  `.accentuat` / `.accentuat-hover` din `globals.css`, care pe tema luminoasă devin culoarea
  obișnuită a textului. Singurele excepții care scriu `text-accent` direct sunt headerul, subsolul
  și varianta întunecată a `TrustBar`: sunt negre pe ambele teme.
- Butonul galben are `border: 1px solid rgb(var(--accent-chenar))`. Pe tema întunecată variabila
  e egală cu `--accent`, deci regula nu schimbă nimic acolo; pe cea luminoasă e singurul lucru
  care îi dă butonului o margine vizibilă.
- `--chenar` (#2A2A2A) e doar pentru linii decorative și separatoare. Pentru chenarele care trebuie
  să se vadă — câmpuri de formular, butoane secundare, `select`, zone de încărcare — se folosește
  `--chenar-puternic` (#707070), care trece pragul de 3:1 din WCAG 1.4.11.
- `--imagine-bg` e fundalul zonei de imagine din cardul de produs și din galerie (pozele de piese
  sunt fotografiate pe fundal deschis).
- `color-scheme: dark` în `:root` face ca barele de defilare și controalele native să fie desenate
  întunecat. `.tema-clasica` declară invers, `color-scheme: light`.
- `@media print` răstoarnă variabilele pe alb și ascunde `header`, `nav` și `[data-strat-fix]`
  (bannerul de cookie-uri, butonul de WhatsApp, sertarul de filtre), ca pagina tipărită să nu iasă
  neagră și să nu care meniuri pe hârtie.

Panoul `/admin` **rămâne luminos**, pe paleta clasică portocalie: containerele lui poartă clasa
`tema-clasica` din `app/globals.css`, care redeclară toate variabilele. E unealta de lucru a
operatorului, iar diferența față de site-ul public arată dintr-o privire unde te afli.

⚠️ `.tema-clasica` trebuie să declare și `color: rgb(var(--text))`, nu doar variabilele. `body` are
`text-text`, iar regula aceea se calculează **pe body**, unde `--text` e alb; culoarea se moștenește
apoi ca valoare gata calculată, nu ca formulă. Fără linia aceea, tot ce n-are clasă proprie de
culoare în `/admin` iese alb pe alb. Aceeași grijă la orice clasă nouă care redeclară paleta.

Culorile semantice (verdele `ok`, roșu de eroare, galben de avertizare, badge-urile de status,
verdele WhatsApp `#25D366`) NU fac parte din temă și nu se ating. La fel bannerele ANPC din `public/`.

Verificarea contrastului: `node scripts/verifica-contrast.mjs` — calculează raporturile pe cele
**trei** palete (întunecat, luminos, `/admin`) și iese cu cod 1 dacă vreo pereche obligatorie pică.

**Scriptul iese astăzi cu cod 1, și e știut.** Ambele teme ale site-ului trec 14 din 14. Cele 2
perechi sub prag sunt din paleta clasică a panoului `/admin`: alb pe portocaliul `#FF6B1A` dă
2,85:1 pe buton și 2,67:1 pe hover. Problema e veche, dinainte de temele noi, și a rămas discuție
separată despre paleta panoului. Până se rezolvă, scriptul nu poate fi pus în CI ca poartă blocantă.

## Unelte de verificare și întreținere (`scripts/`)

Niciuna nu e dependință a site-ului și niciuna nu rulează la build. Se cheamă cu mâna, când e cazul.

| Script | Când se folosește |
|---|---|
| `verifica-contrast.mjs` | după orice atingere a paletei din `globals.css`. Calculează raporturile pe cele trei palete și iese cu cod 1 dacă o pereche obligatorie pică |
| `actualizeaza-taxonomie-sursa.mjs` | când catalogul pieseauto.ro se schimbă. Reface `lib/import/taxonomie-sursa.mjs` din pagina lor `/categorii/`. Are `--uscat`; refuză să scrie dacă extrage sub 300 de categorii (semn că pagina lor s-a schimbat) |
| `completeaza-taxonomia.mjs` | o singură dată după schimbarea regulilor de taxonomie. Completează categoria și modelul pieselor importate ÎNAINTE de reguli — un re-import nu le repară, fiindcă `patchLaReimport` nu atinge categoria. Doar raportează; scrie cu `--scrie`. Cu `--reciteste` cere din nou pagina fiecărei piese, când extragerea s-a schimbat. Nu atinge piesele cu `editat_manual` |
| `verifica-vacanta.mjs` | după orice atingere a modului vacanță. **Rulează pe baza reală** și comută vacanța câteva secunde, apoi o lasă dezactivată. Verifică cele 7 puncte din sarcină: amprenta catalogului înainte/după ciclu, refuzul lui `plaseaza_comanda`, ordinea gărzii. Nu creează nicio comandă |
| `verifica-seo.mjs` | **după orice modificare a metadatelor sau a șabloanelor de titlu.** Cere paginile de la un server care rulează (`BASE=…`) și verifică: titlu ≤ 65, descriere ≤ 165 și prezentă, **marca apare exact o dată în titlu**, descrieri unice, un singur `canonical`. Iese cu cod 1 dacă pică ceva |
| `verifica-import.mjs` | după orice modificare în `lib/import/`. 78 de verificări pe regulile importului — protecția de 20%, reluarea din poziția salvată, canarul, ce are voie să atingă un re-import. Fără rețea și fără bază de date: sursa și depozitul sunt false, deci se poate rula oricând |
| `scan-responsive.mjs` | după modificări de așezare. 19 pagini × 13 lățimi; `TEMA=luminos` schimbă tema. Cere `playwright-core` legat în `node_modules` — vezi antetul fișierului |
| `reconverteste-poze.mjs` | **rar, la nevoie.** Trece în WebP pozele rămase JPEG în bucket. A fost scris fiindcă primele piese importate au ajuns JPEG, când `sharp` nu era încă instalat, iar `lib/import/imagini.mjs` urcă originalul dacă lipsește codecul. Dacă apar iar JPEG-uri în bucket, ori a picat `sharp`, ori conversia a preferat originalul (poză deja bine comprimată) — scriptul spune care din două. Idempotent, cu `--uscat` |
| `curata-orfani.mjs` | **periodic**, mai ales după sesiuni lungi de lucru pe produse. Găsește fișierele din `poze-piese` spre care nu mai arată niciun rând din `products` SAU din `vehicles`. Implicit doar raportează; șterge numai cu `--sterge` și numai fișiere mai vechi de 24h (`--ore=N`). Peste 5% orfani refuză să șteargă și cere `--confirm-stergere-mare`: atâția deodată înseamnă de obicei o citire incompletă, nu formulare abandonate. Raportează și cazul invers, mai grav: adrese din bază fără fișier în stocare |

**De ce apar orfani** (tipar structural, găsit la 25 august 2026): `components/admin/PhotoUploader.tsx`
urcă poza în Storage **imediat** ce e aleasă, dar adresa ei intră doar în starea formularului —
rândul din `products` se scrie abia la „Salvează". Cine închide tabul, apasă „Renunță" sau dă peste
o eroare de salvare lasă fișierele în bucket, fără ca nimic să mai arate spre ele. Aceeași
componentă șterge fișierul din Storage pe loc când apeși pe X, deci un formular nesalvat după o
ștergere lasă în bază o adresă moartă. Ambele sunt deschise; până se rezolvă, `curata-orfani.mjs`
e plasa de siguranță.

## Când termini o modificare
Rulează `npm run build`. Dacă trece, fă commit cu mesaj clar în română și push pe `main`.
Dacă modificarea are nevoie de SQL, amintește-i utilizatorului ce fișier să ruleze în Supabase.
