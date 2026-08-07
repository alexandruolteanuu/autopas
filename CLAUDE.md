# AUTOPAS DEZMEMBRĂRI — context de proiect pentru Claude Code

Acest fișier îți dă contextul complet ca să poți continua proiectul fără explicații repetate.
Citește-l întâi, apoi lucrează.

## Ce este
Magazin online de piese auto second-hand din dezmembrări, în Piatra-Neamț.
Site public + cont client + panou de administrare complet, toate reale (fără machete, fără date demo).

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
12. `livrare-dupa-comanda.sql` -> 13. `coduri-reducere-private.sql`
Idempotente (se pot re-rula oricând): 6, 7, 9, 10, 11, 12, 13. NU sunt încă idempotente: 1–5, 8.
Toate cele de mai sus sunt deja aplicate pe proiectul de producție (august 2026).

## Decizii deja luate (nu le schimba fără să întrebi)
- Logo = doar text (AUTOPAS / DEZMEMBRĂRI), portocaliu #FF6B1A. Font: Poppins (local, în `app/fonts/`).
- VIN abandonat; nu se folosește.
- Starea piesei A/B/C — eliminată complet (filtru, produs, admin, import).
- Cod intern piesă = generat automat, format `AP-000123`.
- Facturare prin **Saga** = export CSV (Saga nu are API public); statusul e-Factura îl gestionează Saga.
- Curier = **doar FAN Courier** (decizie 7 aug 2026). Cargus și Sameday au fost scoase complet
  din cod, din texte și din `settings.curieri`. Scheletul SelfAWB se activează la primirea
  credențialelor (Admin -> Integrări).
- Plată card = fază viitoare; butonul e vizibil, activarea vine cu procesatorul.
- Notificare comandă nouă = alertă sonoră+vizuală în `/admin` (fără e-mail; utilizatorul a refuzat Resend)
  + buton „Trimite confirmarea pe WhatsApp" precompletat.
- Favorite = model hibrid (localStorage pentru nelogați + tabela `favorites` pentru logați, cu sincronizare).
- Roluri: `client`, `operator`, `contabil`, `admin` (coloana `role` în `profiles`, controlată prin RLS).

## Cele 12 module de admin (toate funcționale)
Dashboard · Comenzi (+detaliu cu jurnal, anulare cu restoc, ștergere) · Cereri (inbox 4 taburi) ·
Produse (pagină de editare cu poze reale) · Categorii (+subcategorii) · Mărci și modele ·
Mașini la dezmembrat (profit/amortizare) · Facturi (export Saga) · Rapoarte · Marketing (coduri reducere) ·
Setări (firmă, curieri, roluri) · Integrări.

## Baza de date — tabele cheie
`categories` (+`parent_id` subcategorii, view `categorii_cu_numar`), `products` (+`poze[]`,
`cod_intern`, `originala`, `subcategorie_id`, `greutate_kg`, `cost_lei`, `vizualizari`),
`vehicles` (+`cost_achizitie`, `status`, `piese_listate` actualizat prin trigger),
`orders` + `order_items` (trigger scade stocul automat) + `order_events` (jurnal),
`brands` + `models`, `part_requests`/`car_intake_requests`/`return_requests`/`contact_messages`
(cu status), `profiles` (roluri), `discount_codes`, `settings`, `favorites`.

## Când termini o modificare
Rulează `npm run build`. Dacă trece, fă commit cu mesaj clar în română și push pe `main`.
Dacă modificarea are nevoie de SQL, amintește-i utilizatorului ce fișier să ruleze în Supabase.
