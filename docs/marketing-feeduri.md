# Google Merchant Center, Google Ads și Facebook Ads — ce e gata și ce ai de făcut

Scris la 4 septembrie 2026. Partea de cod e terminată și pe producție.
Rămân pașii care se fac din conturile tale — sunt mai jos, în ordine.

---

## 1. Ce există deja în site

### Feed-uri de produse (adrese care se actualizează singure, la 3 ore)

| Adresa | Pentru cine | Ce conține |
|---|---|---|
| `/feed/google.xml` | Google Merchant Center | RSS 2.0, 8.803 piese |
| `/feed/meta.csv` | Meta (Facebook + Instagram) | CSV de catalog, aceleași piese |
| `/feed/produse.csv` | orice altă platformă | toate coloanele, nume românești |
| `/feed/produse.xml` | orice altă platformă | același conținut, în XML |

Adresele complete, cu domeniul real, se copiază din **Admin → Feed și export**.

Nu trebuie încărcat niciun fișier cu mâna: dai adresa o singură dată, iar Google și
Meta o citesc singure. O piesă vândută se depublică automat și dispare din feed la
următoarea reîmprospătare.

### Ce pleacă pentru fiecare produs

`id` (codul intern AP-000123) · titlu · descriere completă (compatibilități, ani,
nota de stare, garanție) · link · poza principală + până la 10 poze suplimentare ·
disponibilitate · preț cu TVA · stare (`used`) · marca mașinii · categoria noastră ·
categoria Google · greutatea, dacă e cântărită · cinci etichete de campanie
(marcă, categorie, prag de preț, model, ani).

### Măsurarea

- **Google Analytics 4** — deja pornit (`G-W4HEYW56VK`).
- **Google Ads** — codul e scris, așteaptă ID-ul. Conversia „comandă plasată” pleacă
  automat, cu valoarea calculată de server și cu numărul comenzii.
- **Meta Pixel** — codul e scris, așteaptă ID-ul. Trimite `ViewContent`, `AddToCart`,
  `InitiateCheckout`, `Purchase` și `Lead`.

**Id-urile de produs sunt identice** în feed-uri și în evenimentele pixelului. Fără
asta, reclamele dinamice ar arăta altă piesă decât cea privită de om. `scripts/verifica-feed.mjs`
verifică exact acest lucru.

### Consimțământ

Bannerul are acum **trei** butoane: „Doar necesare”, „Doar statistică”, „Accept toate”.
Publicitatea pornește doar la „Accept toate”. Politica de cookies, politica de
confidențialitate și pagina „Setări cookie-uri” au fost actualizate înainte de punerea
în funcțiune, cu tabelul celor trei cookie-uri (`_gcl_au`, `_fbp`, `_fbc`, 90 de zile).

---

## 2. Ce ai tu de făcut, în ordine

### Pasul 0 — obligatoriu înainte de orice (altfel nimic nu merge)

1. **Cumpără domeniul `autopas-dezmembrari.ro`** și leagă-l în Vercel.
2. În Vercel → Settings → Environment Variables adaugă:
   `NEXT_PUBLIC_SITE_URL = https://autopas-dezmembrari.ro`, apoi redeployează.

De ce contează: linkurile din feed trebuie să fie pe domeniul pe care îl revendici în
Merchant Center și în Meta. Fără asta, **toate** produsele sunt respinse. Panoul
Admin → Feed și export te avertizează dacă variabila lipsește.

3. Când vrei să apari și în căutarea Google (nu doar în reclame): adaugă
   `PERMITE_INDEXARE = da`. Feed-urile funcționează și fără asta — `/feed/` e lăsat
   explicit accesibil roboților chiar cât timp restul site-ului e închis.

### Pasul 1 — Google Merchant Center

1. Deschide cont pe `merchants.google.com`, cu datele firmei.
2. **Revendică site-ul.** Domeniul e deja verificat în Search Console (eticheta e în
   codul site-ului), deci ar trebui să fie un singur click.
3. **Livrare** (Setări → Livrare și retururi): pune un **tarif fix** — de exemplu 25 lei,
   sau gratuit peste o sumă. Google cere o valoare, iar noi nu afișăm costul livrării
   la checkout (se calculează după cântărirea coletului). Pune o valoare acoperitoare
   și explică în pagina de livrare, cum se face deja.
4. **Retururi**: completează politica (avem deja pagina „Politica de retur” — 14 zile).
5. **Produse → Feeduri → Adaugă feed**:
   - Țară: România · Limbă: română
   - Metoda: **Preluare programată**
   - Adresa: `https://autopas-dezmembrari.ro/feed/google.xml`
   - Frecvența: **zilnic**, la o oră când nu lucrezi (ex. 05:00)
6. Așteaptă prima preluare, apoi uită-te la **Diagnostic**. Trimite-mi ce scrie acolo
   dacă apar respingeri — se repară din feed, nu din contul tău.

### Pasul 2 — Google Ads

1. Cont pe `ads.google.com`.
2. **Instrumente → Conversii → Acțiune de conversie nouă → Site web**:
   - Categorie: **Achiziție**
   - Valoare: **Folosește valori diferite pentru fiecare conversie** (o trimite codul)
   - Numărare: **Una** (o comandă = o conversie)
3. Din ecranul de instalare copiază:
   - **ID-ul de conversie**, forma `AW-123456789`
   - **eticheta de conversie**, forma `AbC-D_efGh` (partea de DUPĂ bară)
4. **Admin → Integrări → Google Ads**: le lipești pe amândouă, bifezi „Activă”, salvezi.
   Atât — nu trebuie lipit niciun cod în site.
5. Leagă conturile, din Google Ads:
   - **Google Ads ↔ Merchant Center** (Instrumente → Conturi conectate) — fără asta nu
     poți face campanii Shopping / Performance Max.
   - **Google Ads ↔ GA4** — de aici vin audiențele de remarketing.
6. Prima campanie recomandată: **Performance Max cu feed de produse**, buget mic
   (50–70 lei/zi), țintire România. Lasă-o 2–3 săptămâni fără să o modifici.

### Pasul 3 — Meta (Facebook + Instagram)

1. `business.facebook.com` → Business Manager pe firmă.
2. **Setări → Domenii → Adaugă** `autopas-dezmembrari.ro`. Alege verificarea prin
   **meta tag** și copiază doar codul dinăuntru (`content="…"`).
3. **Manager de evenimente → Surse de date → Pixel nou.** Copiază ID-ul (15 cifre).
4. **Admin → Integrări → Meta**: lipești ID-ul pixelului și codul de verificare a
   domeniului, bifezi „Activă”, salvezi. Eticheta de verificare intră singură în pagină.
5. Întoarce-te în Business Manager → Domenii și apasă **Verifică**.
6. **Commerce Manager → Cataloguri → Creează catalog → Comerț electronic**:
   - Sursă de date → **Feed de date → Feed programat**
   - Adresa: `https://autopas-dezmembrari.ro/feed/meta.csv`
   - Frecvența: **la fiecare 4 ore** (Meta acceptă din oră în oră; 4 e destul)
   - Moneda: RON
7. **Leagă pixelul de catalog** (Catalog → Setări → Surse de evenimente). Fără pasul
   ăsta reclamele dinamice nu au ce potrivi.
8. Configurează **Măsurarea agregată a evenimentelor** (Manager de evenimente →
   domeniul verificat): pune `Purchase` pe primul loc.

---

## 3. Cum verifici că merge

```bash
npm run build && npx next start -p 3000
node scripts/verifica-feed.mjs
```

Scriptul cere feed-urile de la un server care rulează și verifică regulile Google
(id ≤ 50 și unic, titlu ≤ 150, descriere ≤ 5.000, link și imagine absolute, preț în
formatul `123.45 RON`, disponibilitate și stare din listele lor), antetul CSV-ului Meta,
și — cel mai important — că **cele două feed-uri conțin exact aceleași id-uri**.

Pe producție: `BASE=https://autopas-dezmembrari.ro node scripts/verifica-feed.mjs`.

În browser, după ce lipești ID-urile:
- extensia **Google Tag Assistant** — trebuie să vezi `AW-…` și evenimentul `conversion`
  pe pagina de mulțumire;
- extensia **Meta Pixel Helper** — trebuie să vezi `PageView`, apoi `ViewContent` pe o
  pagină de piesă și `AddToCart` la adăugarea în coș.

Dacă nu apare nimic: verifică întâi că ai apăsat **„Accept toate”** în banner. Cu
„Doar statistică”, publicitatea e oprită intenționat.

---

## 4. Lucruri de știut înainte de a cheltui bani

- **Fiecare piesă e unicat.** Când se vinde, se depublică automat și iese din feed la
  următoarea reîmprospătare — dar între timp reclama poate rula câteva ore pentru o
  piesă care nu mai există. E normal și inevitabil cu feed-uri; se atenuează cu o
  frecvență mai mare de reîmprospătare.
- **Costul livrării nu e afișat la checkout**, prin decizia ta. Merchant Center cere
  totuși o valoare de livrare la nivel de cont. Pune una acoperitoare.
- **8.765 din 8.803 de piese au greutatea estimată la 1 kg.** Nu trimitem greutatea
  către Google în cazul lor: ar calcula un transport greșit. Se trimite doar pentru
  piesele cântărite efectiv.
- **Nicio piesă nu are cod OEM** în catalogul importat, deci feed-ul declară corect
  `identifier_exists: no`. Dacă începi să completezi OEM-urile la piesele noi, ele
  pleacă automat ca `mpn` și produsele devin mai ușor de potrivit.
- **Piesele fără poză nu intră în reclame** — le-ar respinge Google oricum. Azi e una
  singură; se vede în Admin → Feed și export și se rezolvă din „Piese de completat”.
- **Feed-urile sunt publice.** Dacă vrei să nu-ți poată lua un concurent tot catalogul
  dintr-o singură cerere, pune `FEED_TOKEN` în Vercel; adresele devin
  `…/feed/google.xml?token=…` și panoul le afișează cu token cu tot.
