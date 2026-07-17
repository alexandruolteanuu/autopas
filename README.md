# AUTOPAS — magazin de piese auto din dezmembrări

Site complet funcțional: **Next.js + Supabase + Vercel**. Produsele, comenzile și toate
formularele se salvează REAL în baza de date. Acest ghid te duce de la zero la site live,
click cu click. Timp estimat: 30–40 de minute.

---

## PASUL 1 — Creează baza de date (Supabase) · ~10 min

1. Intră pe **supabase.com** → **Start your project** → autentifică-te cu GitHub.
2. Click **New project**:
   - *Name*: `autopas`
   - *Database Password*: apasă **Generate a password** și **salveaz-o** undeva (nu o vei folosi zilnic, dar e bine s-o ai).
   - *Region*: **Central EU (Frankfurt)** — cel mai aproape de România.
   - Click **Create new project** și așteaptă ~2 minute până scrie „Project is ready".
3. În meniul din stânga, click pe **SQL Editor** (iconița cu `>_`).
4. Click **New query**. Deschide fișierul **`supabase/schema.sql`** din acest proiect,
   copiază TOT conținutul, lipește-l în editor și apasă **Run** (sau Ctrl+Enter).
   → Trebuie să vezi jos: `Success. No rows returned`.
5. Din nou **New query** → copiază TOT din **`supabase/seed.sql`** → **Run**.
   → Acesta inserează REAL în baza ta: 10 categorii, 5 vehicule, 8 piese.
6. Verificare: meniul stânga → **Table Editor** → click pe tabela `products`
   → trebuie să vezi cele 8 piese. ✔
7. Ia cheile de conectare: meniul stânga → **Project Settings** (rotița) → **API**:
   - copiază **Project URL** (ex. `https://abcdefgh.supabase.co`)
   - copiază **anon / public key** (un șir lung care începe cu `eyJ…`)
   Ține-le într-un notepad — le folosești la Pasul 3.
8. (Recomandat pentru testare ușoară) **Authentication → Providers → Email** →
   dezactivează **Confirm email** → Save. Astfel conturile create pe site intră direct,
   fără click de confirmare pe e-mail.

## PASUL 2 — Urcă proiectul pe GitHub · ~5 min

1. Intră pe **github.com** → deschide depozitul tău **`autopas`**
   (dacă nu l-ai creat: **+** dreapta-sus → **New repository** → nume `autopas` → Public →
   bifează *Add a README* → **Create repository**).
2. Click **Add file → Upload files**.
3. Deschide pe calculator folderul dezarhivat `autopas/` și **selectează TOT ce e în el**
   (fișierele ȘI folderele `app`, `components`, `lib`, `supabase`, `public`) și trage-le
   în fereastra GitHub. Așteaptă să se încarce toate (vezi lista crescând).
   - ⚠️ NU urca folderele `node_modules` sau `.next` (nu există în ZIP, dar dacă rulezi
     local vreodată, nu le urca).
   - Dacă browserul refuză folderele: folosește **github.dev** — în pagina depozitului
     apasă tasta **punct (.)** → se deschide un editor în browser → trage folderul acolo
     în panoul din stânga → stânga, iconița cu ramuri (Source Control) → scrie un mesaj →
     **Commit & Push**.
4. Jos, la *Commit changes*, scrie `site initial` → **Commit changes**.
   → Pagina depozitului trebuie să arate folderele `app/`, `components/`, `lib/`… ✔

## PASUL 3 — Publică pe Vercel · ~5 min

1. Intră pe **vercel.com** → autentificat cu GitHub (**Continue with GitHub**).
2. **Add New… → Project** → în listă apare `autopas` → **Import**.
3. NU schimba nimic la *Framework* (detectează singur Next.js). Deschide secțiunea
   **Environment Variables** și adaugă, pe rând (Name / Value):
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL de la Pasul 1.7
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = cheia anon de la Pasul 1.7
4. Click **Deploy**. În ~2 minute vezi confetti 🎉 și un buton **Visit**.
   → Linkul tău e de forma `https://autopas-....vercel.app` — acesta merge la client.
5. Verificare pe site: prima pagină arată cele 4 mașini și 8 piese (vin din baza TA de date),
   iar în subsol sunt toate paginile legale + bannerele ANPC/SOL. ✔

## PASUL 4 — Creează contul de ADMIN · ~3 min

1. Supabase → **Authentication → Users → Add user → Create new user**:
   e-mailul tău + o parolă; bifează **Auto Confirm User** → Create.
2. Supabase → **SQL Editor → New query** și rulează (înlocuiește e-mailul):
   ```sql
   update profiles set role = 'admin' where email = 'emailul-tau@exemplu.ro';
   ```
3. Pe site: intră pe **/autentificare**, loghează-te cu acest cont, apoi deschide **/admin**.
   → Vezi comenzile (cu schimbare de status) și poți **adăuga piese noi**, care apar
   instant pe site. ✔

## PASUL 5 — Testul complet (fă-l tu, apoi trimite linkul clientului)

1. Pe site: adaugă o piesă în coș → Finalizează comanda → completează datele → Plasează.
2. Vezi pagina „Comanda a fost plasată" cu numărul AP-2026-…
3. Supabase → Table Editor → `orders` → comanda ta e acolo, reală. ✔
4. Intră pe **/admin** → comanda apare în listă → schimbă statusul în „confirmata".
5. Creează-ți un cont de client pe **/autentificare** cu ACELAȘI e-mail folosit la comandă
   → în **/cont** vezi comanda ta cu statusul actualizat. ✔

---

## Cum faci modificări după lansare

- **Adaugi/editezi piese, vezi comenzi și cereri** → direct din site (**/admin**) sau din
  Supabase → Table Editor. Fără cod.
- **Modifici texte/pagini** → GitHub → deschizi fișierul → iconița creion → editezi →
  Commit. Vercel republică automat în ~1 minut.
- **Mesaje contact / cereri piese / cereri Rabla / retururi** → Supabase → Table Editor →
  tabelele `contact_messages`, `part_requests`, `car_intake_requests`, `return_requests`.

## Ce NU e încă activ (necesită contracte/chei de la furnizori — faza următoare)

- **Plata cu cardul online** (procesator de plăți — ex. Netopia/Stripe): momentan ramburs + transfer.
- **Facturare automată (Oblio/SmartBill) și e-Factura ANAF** — necesită cont + cheie API.
- **AWB automat la curier** — necesită contract FAN/Cargus/Sameday cu API.
Site-ul e pregătit pentru toate trei; le conectăm când clientul are conturile.

## Structura proiectului
```
app/            paginile (fiecare folder = o adresă pe site)
components/     bucăți de interfață refolosibile (header, footer, formulare, coș)
lib/            conexiunea Supabase, tipuri, texte legale
supabase/       schema.sql (structura DB) + seed.sql (datele inițiale)
```
