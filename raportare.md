# Raport: proiectul Autopas, pregătit pentru integrarea SAGA WEB

10 noiembrie 2026. Documentația API-ului SAGA și deciziile: `docs/saga-api.md`.

## 1. Tehnologii
- **Limbaj:** TypeScript 5.5. Câteva module partajate între scripturi și rute sunt în JavaScript `.mjs` (`lib/import/`, `lib/dezro/`).
- **Framework:** Next.js 14.2 (App Router), React 18.3, Tailwind CSS 3.4.
- **Alte dependențe:** doar `@supabase/supabase-js` 2.45 și `sharp` (conversia pozelor). Nu există ORM sau librării de UI.
- **Găzduire:** Vercel. Funcțiile rulează la Frankfurt (`vercel.json`, `fra1`). Fiecare push pe `main` declanșează un build.

## 2. Baza de date
- **Supabase (PostgreSQL)**, cu autentificarea și stocarea fișierelor tot de la Supabase.
- Conexiunea se face din `lib/supabase.ts`, care are trei clienți:
  - `sbServer()`: cheia publică, pentru paginile publice;
  - `sbBrowser()`: cheia publică, cu sesiunea utilizatorului logat;
  - `sbAdmin()`: cheia de serviciu (`SUPABASE_SERVICE_ROLE_KEY`), folosit **doar pe server**.
- Accesul e controlat de **RLS** (reguli în bază despre cine ce poate citi sau scrie).
- Modificările de schemă sunt fișiere SQL în `supabase/`, rulate în ordine. Pe producție sunt aplicate 1–45; 46 e scrisă, dar nerulată.

## 3. Structura folderelor
- `app/`: paginile publice, `app/admin/` (18 module de administrare) și `app/api/` (rutele de server: awb, awb-retur, dezro, email-coada, import etc.).
- `components/`: componente refolosibile; `components/admin/` sunt cele ale panoului.
- `lib/`: logica de business (`supabase.ts`, `settings.ts`, `fancourier.ts`, `email.ts`, `feed*.ts`, `types.ts`).
- `supabase/`: migrările SQL. `scripts/`: unelte de verificare rulate manual. `docs/`: documentație.

## 4. Produsele (piesele)
- Tabela `products`. Câmpurile principale:
  - `nume`, `slug`, `cod_intern` (generat automat, `AP-000123`), `oem` (codul piesei);
  - `pret_lei`, `stoc`, `publicat`, `poze[]`, `descriere`;
  - `greutate_kg`, `cost_lei` (intern);
  - `model_ids` (compatibilitățile), `ani`, `vehicul_id` (intern).
- **Categorii:** tabela `categories`, pe două niveluri (`parent_id`). O piesă are `categorie_id` și `subcategorie_id`.
- **Problemă:** **nu există niciun câmp pentru TVA**. Prețul e unul singur, final.

## 5. Comenzile
- Tabelele `orders` (antetul), `order_items` (`nume`, `pret`, `cantitate`, `product_id`) și `order_events` (jurnalul).
- **O comandă se creează doar prin funcția `plaseaza_comanda`**, pe server. Prețurile le calculează serverul.
- **Numărul comenzii:** `AP-2026-01000`.
- **Stări (`status`):** `noua` → `confirmata` → `expediata` → `livrata`, plus `anulata`.
- **Nu există o stare „plătită”.** Plata e doar ramburs (`plata = 'ramburs'`).
- **Transportul:** din migrarea 45 nu mai intră în `total`, fiindcă îl încasează FAN direct de la client. Două comenzi vechi îl au inclus.
- **Clientul:** `tip_client` (persoană fizică sau firmă), `nume`, `firma`, `cui`, `adresa`, `oras`, `judet`, `email`, `telefon`.
  - **Problemă:** județul e salvat ca text („Neamț”), iar SAGA cere codul („NT”). Trebuie o tabelă de traducere.

## 6. Ce există deja legat de facturi
- **Câmpuri pe `orders`:** `factura_serie` (text liber) și `factura_status`, cu valorile `de_emis`, `emisa`, `stornata`, `nu_se_emite`.
- **`/admin/facturi`:** lista comenzilor, câmp pentru seria scrisă de mână și butonul „Export Saga (CSV)”.
- **`/admin/comenzi/[id]`:** o casetă „Facturare (Saga)” unde se notează seria.
- **`settings.firma.serie_factura = "AUTP"`** și `settings.integrari.saga.serie`.
- **De corectat la implementare:**
  - Textele din admin spun peste tot că „Saga nu are API public”. Nu mai e adevărat.
  - Exportul CSV are **TVA 19% scris direct în cod**. Cota standard e 21% din august 2025, iar regimul pentru piesele second-hand (normal sau pe marjă) e încă de confirmat cu contabila.
  - Seria existentă e `AUTP`, iar `saga-api.md` propune `APD`. De decis care rămâne.
  - `docs/factura-model.xml`, la care trimite documentul, nu există încă.

## 7. Panoul de administrare
- E la `/admin`, cu login prin Supabase Auth.
- **Roluri** (coloana `role` din `profiles`): `client`, `operator`, `contabil`, `admin`. Meniul pe roluri e constanta `MENIU` din `app/admin/layout.tsx`. „Facturi” e vizibil pentru `admin` și `contabil`.
- **Protecția reală e în bază:** regulile RLS folosesc `is_staff()` și `is_admin()`.
- **Rutele din `app/api/`** nu sunt acoperite de RLS. Ele verifică token-ul sesiunii cu `esteEchipa()` din `lib/supabase.ts`.

## 8. Secretele
- **Variabile de mediu** (`.env.local` local, Vercel în producție): cheile Supabase, inclusiv cea de serviciu. Modelul e în `.env.local.example`.
- **Secretele integrărilor** (parola FAN, cheia Brevo, contul dez.ro) stau în tabela `settings`, rândul `integrari`. Acesta nu e citibil public și se completează din Admin → Integrări.
- Pentru SAGA, asta se potrivește exact cu cerința din document: cheia se rotește, deci trebuie ținută în bază, nu în `.env`.

## 9. Unde s-ar așeza integrarea SAGA și ce mecanisme de fundal există
- **Nu există cron:** nici Vercel Cron, nici `pg_cron`.
- **Există un tipar de coadă**, folosit deja de două ori (e-mailurile automate în `email_coada` și dez.ro în `dezro_coada`):
  1. un trigger scrie un rând în coadă, în aceeași tranzacție cu modificarea;
  2. baza trezește o rută `/api/...` prin `pg_net`;
  3. ruta procesează, iar butoanele din panou servesc la reluare.
- **Pentru apelurile pe rând** cerute de SAGA există un model de blocare: tabela `dezro_trezire`, cu funcțiile `dezro_trezeste` și `dezro_deblocheaza`.
- **Ce propun, urmând convențiile proiectului:**
  - `lib/saga.ts`: clientul API (rotirea cheii, construirea XML-ului, parsarea raportului 207/422), ca `lib/fancourier.ts`;
  - `app/api/saga/route.ts`, protejată cu `esteEchipa()`;
  - o migrare nouă `supabase/saga.sql`: coadă sau jurnal de facturi, potrivirea categorie → `CodArticolClient`, blocarea pentru apelurile pe rând;
  - cheia în `settings.integrari.saga`;
  - butonul „Trimite în SAGA” în `/admin/facturi` și în pagina comenzii.
- **Declanșarea:** manuală, din panou, e cea mai sigură la început. Ulterior se poate face automat, prin coadă, la trecerea comenzii în `livrata`.

---

## Rezumat (de copiat)
```
Proiect: Next.js 14.2 (App Router) + TypeScript + Tailwind, găzduit pe Vercel (fra1).
Baza de date: Supabase (PostgreSQL + Auth + Storage), securitate prin RLS; migrări SQL în supabase/.
Piese: tabela products (pret_lei, stoc, cod_intern AP-xxxxxx, oem), categorii pe 2 niveluri; FĂRĂ câmp TVA.
Comenzi: orders + order_items, create doar prin plaseaza_comanda; stări noua/confirmata/expediata/livrata/anulata;
plata doar ramburs, fără stare „plătită”; transportul îl încasează FAN, nu intră în total.
Facturi azi: factura_serie + factura_status pe orders, /admin/facturi cu export CSV Saga (TVA 19% hardcodat — de corectat).
Seria existentă AUTP vs. APD propusă — de decis. Județul e salvat ca text, SAGA cere cod (NT).
Admin: /admin cu Supabase Auth, roluri client/operator/contabil/admin; rutele /api verifică echipa cu esteEchipa().
Secrete: cheile Supabase în variabile Vercel; secretele integrărilor în settings.integrari (protejat RLS).
Cheia SAGA (care se rotește) se potrivește cu settings.integrari.saga.
Fără cron. Există tiparul de coadă: trigger → tabelă coadă → pg_net trezește o rută /api (email_coada, dezro_coada),
plus o blocare pentru apeluri pe rând (dezro_trezire).
Propunere: lib/saga.ts + app/api/saga/route.ts + migrare supabase/saga.sql + buton în /admin/facturi.
De confirmat cu contabila: regim TVA (normal/marjă, 21%), serie, coduri articole SAGA.
```
