# AUTOPAS DEZMEMBRĂRI — context de proiect pentru Claude Code

Acest fișier îți dă contextul complet ca să poți continua proiectul fără explicații repetate.
Citește-l întâi, apoi lucrează.

## Ce este
Magazin online de piese auto second-hand din dezmembrări. Depozitul e pe Str. Petru Rareș nr. 181,
pe DN 15 între Piatra-Neamț și Bicaz (sat Bistrița, com. Alexandru cel Bun, jud. Neamț) — aceeași
adresă cu sediul social. Site public + cont client + panou de administrare complet.

**Stare la 7 august 2026: încă nelansat.** Nu are clienți, nu are comenzi reale. Cele 8 produse și
5 mașini din bază sunt exemple de lucru, nu marfă — trebuie înlocuite înainte de lansare.
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
- `app/` — paginile (App Router). `app/admin/` = panoul de administrare (12 module).
- `components/` — componente refolosibile; `components/admin/` = specifice adminului.
- `lib/` — `supabase.ts` (clienți: server, browser, admin cu service key), `settings.ts`
  (firmă/curieri/integrări din DB), `types.ts`, `format.ts`, `couriers.ts`, `config.ts`, `legal.ts`.
- `supabase/` — migrările SQL (vezi ordinea).

## Ordinea migrărilor SQL (rulare manuală în Supabase, o singură dată fiecare)
1. `schema.sql` -> 2. `seed.sql` -> 3. `filtru.sql` -> 4. `integrari.sql` ->
5. `admin.sql` -> 6. `sprint-bc.sql` -> 7. `upgrade.sql` (include și politicile pentru poze) ->
8. `favorite.sql` -> 9. `admin-fix.sql` -> 10. `date-firma.sql` -> 11. `comanda-server.sql` ->
12. `livrare-dupa-comanda.sql` -> 13. `coduri-reducere-private.sql` -> 14. `view-security-invoker.sql` ->
15. `cautare-fara-diacritice.sql`
Idempotente (se pot re-rula oricând): 6, 7, 9, 10, 11, 12, 13, 14, 15. NU sunt încă idempotente: 1–5, 8.
Toate cele de mai sus sunt deja aplicate pe proiectul de producție (august 2026).

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
- **Rutele din `app/api/` nu sunt protejate de RLS** — rulează pe server, cu drepturi de server.
  Cele care fac ceva în numele firmei cer token-ul sesiunii și îl verifică cu `esteEchipa()` din
  `lib/supabase.ts` (vezi `app/api/awb/route.ts`).
- Indexarea în Google e **oprită** până la lansare; se activează cu `PERMITE_INDEXARE=da` în Vercel.
  Domeniul ales: `autopas-dezmembrari.ro` (neînregistrat încă la 7 aug 2026).
- Favorite = model hibrid (localStorage pentru nelogați + tabela `favorites` pentru logați, cu sincronizare).
- Roluri: `client`, `operator`, `contabil`, `admin` (coloana `role` în `profiles`, controlată prin RLS).

## Cele 14 module de admin (toate funcționale)
Dashboard · Comenzi (+detaliu cu jurnal, cost livrare, anulare cu restoc, ștergere) ·
Cereri (inbox 4 taburi) · Produse (pagină de editare cu poze reale) · Categorii (+subcategorii) ·
Mărci și modele · Mașini la dezmembrat (profit/amortizare) · Expedieri (AWB) · Clienți ·
Facturi (export Saga) · Rapoarte · Marketing (coduri reducere) · Setări (firmă, curier, roluri) ·
Integrări.
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

**Temă definitivă: „Atelier, galben industrial" (negru + #F2B705), aleasă în august 2026.
Culorile se modifică exclusiv din blocul `:root` din `app/globals.css`.** Selectorul temporar
de teme a fost eliminat complet (13 august 2026), dar sistemul de variabile a rămas: componentele
nu scriu niciodată culori direct, ci folosesc clasele semantice din `tailwind.config.ts`
(`bg-fundal`, `text-text`, `text-textSecundar`, `bg-accent`, `text-accentText`, `border-chenar`,
`bg-imagineBg`…), care citesc variabilele. O schimbare de nuanță = o linie modificată.

Reguli care rezultă din asta:
- **Nu scrie hexa în componente.** `bg-accent`, nu `bg-[#F2B705]`.
- `--accent-contrast` e **închis** (#101010): textul de pe galben e negru. Alb pe #F2B705 dă
  1,8:1, ilizibil. Pe butoanele de accent se folosește `text-accentText`, niciodată `text-white`.
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

Verificarea contrastului: `node scripts/verifica-contrast.mjs` — calculează raporturile pe ambele
palete (site public și `/admin`) și iese cu cod 1 dacă vreo pereche obligatorie pică.

**Scriptul iese astăzi cu cod 1, și e știut.** Site-ul public trece 12 din 12. Cele 3 perechi sub
prag sunt toate din paleta clasică a panoului `/admin`: alb pe portocaliul `#FF6B1A` dă 2,85:1
(text pe buton, hover, accent pe card). Problema e veche, dinainte de trecerea pe tema întunecată,
și a fost lăsată deschis în august 2026 ca discuție separată despre paleta adminului. Până se
rezolvă, scriptul nu poate fi pus în CI ca poartă blocantă.

## Când termini o modificare
Rulează `npm run build`. Dacă trece, fă commit cu mesaj clar în română și push pe `main`.
Dacă modificarea are nevoie de SQL, amintește-i utilizatorului ce fișier să ruleze în Supabase.
