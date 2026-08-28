# SARCINĂ: audit și optimizare SEO · local SEO · GEO

Site-ul nu apare în Google. Căutarea directă a domeniului întoarce:
> „No information is available for this page."

Ăsta e mesajul afișat când Google **nu are voie să citească pagina** — blocaj în
`robots.txt`, nu lipsă de conținut.

Branch `main`. Migrările SQL nu le rulezi tu. Cinci părți, **cu oprire între ele**.

---

## REGULA DE AUR — ce se poate atinge și ce nu

**Conținutul vizibil al site-ului NU se modifică.** Fără rescrierea textelor de pe pagini,
fără paragrafe noi, fără schimbarea denumirilor de produse.

**Se pot adăuga și modifica:**
- metadate: `<title>`, `meta description`, `canonical`, Open Graph
- date structurate (schema.org)
- `robots.txt`, `sitemap.xml`, redirecționări
- atribute `alt` pe imagini, generate din datele existente
- structura de linkuri interne și paginarea
- antete HTTP, statusuri, performanță

Dacă o îmbunătățire ar cere text nou vizibil pe pagină, **oprește-te și propune-mi-o
separat**. Nu o implementa.

Nu se ating: prețurile, logica de comenzi, textele legale, paleta, motorul de import.

---
---

# PARTEA 0 — DIAGNOSTIC (nu modifica nimic)

## 0.1 De ce nu indexează Google

1. **Descarcă `robots.txt` de pe producție** și dă-mi-l integral. Verifică ce condiție îl
   controlează — proiectul are `INDEXARE_PERMISA` legat de variabila `PERMITE_INDEXARE`.
   Spune-mi exact ce trebuie setat și unde.
2. **Verifică `www` vs fără `www`.** Google are indexat `https://www.autopas-dezmembrari.ro/`,
   iar `SITE_URL` din cod e fără `www`. Testează ce răspund ambele: 200 pe amândouă?
   redirecționare? care spre care? Ce spune `canonical` pe fiecare?
3. **`NEXT_PUBLIC_SITE_URL`** — e setată în producție? Verifică ce URL apare efectiv în
   `canonical`, în `sitemap.xml` și în `robots.txt` pe site-ul live, nu în cod.
4. Verifică `<meta name="robots">` pe pagini — există vreun `noindex` rămas?

## 0.2 Starea actuală, măsurată pe producție

| Ce | Cum verifici |
|---|---|
| câte URL-uri are `sitemap.xml` | descarcă-l și numără |
| `canonical` pe fiecare tip de pagină | home, `/piese`, produs, categorie, legal |
| `<title>` și `meta description` | sunt unice? au lungimea potrivită? sunt generate sau fixe? |
| `H1` | există exact unul per pagină? |
| atribute `alt` pe imagini | câte imagini au, câte nu |
| date structurate | ce tipuri există deja, unde |
| linkuri interne | câte piese sunt accesibile din navigație, câte sunt orfane |

## 0.3 Performanță

Lighthouse pe mobil, pe home, `/piese` și o pagină de produs. Dă-mi cele patru scoruri și
valorile Core Web Vitals (LCP, CLS, INP).

**Atenție la `/piese`:** are acum paginare și 24 de imagini pe pagină. Verifică `sizes`,
încărcarea leneșă și dacă prima imagine e prioritizată.

## 0.4 Raportează și OPREȘTE-TE

Tabel: ce e în regulă, ce e greșit, ce lipsește. Cu gravitate: **blocant** (împiedică
indexarea), **important**, **finisaj**.

---
---

# PARTEA A — DEBLOCAREA INDEXĂRII

Nimic altceva nu contează până nu e rezolvată.

## A.1 `robots.txt`

Trebuie să permită crawlarea site-ului public și să blocheze doar ce nu are ce căuta în
index: `/admin`, `/cont`, `/cos`, `/checkout`, rutele `/api`, paginile de confirmare comandă.

Confirmă-mi exact ce variabilă trebuie setată în Vercel și cu ce valoare. **O setez eu.**

## A.2 Un singur domeniu canonic

Alege **fără `www`** (`https://autopas-dezmembrari.ro`), consecvent cu `SITE_URL` din cod.

- versiunea cu `www` trebuie să redirecționeze permanent (301) către cea fără
- `canonical` pe fiecare pagină arată spre varianta fără `www`
- `sitemap.xml` și `robots.txt` folosesc aceeași variantă
- fără lanțuri de redirecționări: `www` → non-`www` direct, nu prin pași intermediari

Partea de DNS și domenii din Vercel o fac eu — spune-mi exact ce trebuie configurat.

## A.3 Consecvență de URL

- un singur format: cu sau fără `/` la final, nu ambele
- majuscule/minuscule consecvente
- fără parametri care creează duplicate indexabile (`?utm_`, `?ref=`)
- paginarea: `?pagina=2` cu `canonical` propriu pe fiecare pagină, nu spre pagina 1

## A.4 Verificare, apoi OPREȘTE-TE

1. `robots.txt` de pe producție permite crawlarea
2. `www` redirecționează 301 spre non-`www`
3. `canonical` corect pe toate tipurile de pagini
4. `sitemap.xml` are 8.754+ URL-uri, toate cu domeniul corect

---
---

# PARTEA B — METADATE ȘI STRUCTURĂ

## B.1 Șabloane de titlu, pe tip de pagină

Generate din date, nu scrise de mână. Maximum ~60 de caractere.

| Tip | Șablon |
|---|---|
| Home | `Piese auto second-hand din dezmembrări — AUTOPAS Neamț` |
| Produs | `{denumire} — {marcă} {model} {ani} \| AUTOPAS` |
| Categorie | `{categorie} pentru {marcă} — piese din dezmembrări \| AUTOPAS` |
| Marcă | `Piese {marcă} din dezmembrări — {n} piese în stoc \| AUTOPAS` |
| Mașină | `Dezmembrări {marcă} {model} {motorizare} {an} \| AUTOPAS` |

**Nu insera cuvinte-cheie forțat.** Titlurile trebuie să descrie exact pagina.

## B.2 Meta descriptions

Generate din datele existente: denumire, compatibilitate, preț, stare, garanție, livrare.
~150 de caractere. Fiecare unică — descrieri identice pe 8.754 de pagini sunt mai rele
decât lipsa lor.

## B.3 Atribute `alt` pe imagini

Generate din denumirea piesei. Pentru mai multe poze la același produs, diferențiază-le
(`... — imaginea 2`). Bannerele ANPC și logoul primesc `alt` descriptiv.

## B.4 Linkuri interne — problema reală la 8.754 de pagini

Google trebuie să poată **ajunge** la fiecare piesă prin linkuri, nu doar prin sitemap.

Verifică și raportează: câte piese sunt accesibile navigând din pagina principală, în
maximum 3 clicuri? Câte sunt orfane?

Propune-mi structura de legături care le acoperă pe toate — pagini de marcă, de categorie,
piese similare, paginare. **Nu o implementa înainte să o aprob**, poate cere modificări de
navigație.

## B.5 Verificare, apoi OPREȘTE-TE

Titluri și descrieri unice pe toate tipurile de pagini, zero imagini fără `alt`, raportul
de linkuri interne.

---
---

# PARTEA C — DATE STRUCTURATE

Cea mai mare valoare pentru un catalog de piese. Fără ele, Google vede text; cu ele,
înțelege că e un produs cu preț, stoc și stare.

## C.1 Ce se adaugă

| Pagină | Tip |
|---|---|
| toate | `Organization` + `AutoPartsStore` (vezi Partea D) |
| toate | `BreadcrumbList` |
| produs | `Product` cu `offers`, `priceCurrency`, `price`, `availability`, `itemCondition: UsedCondition`, `brand`, `sku` |
| produs | `isAccessoryOrSparePartFor` cu mașinile compatibile |
| listare | `ItemList` |
| `/faq` | `FAQPage` |
| mașină | `Vehicle` sau `Product`, în funcție de ce se potrivește |

**`itemCondition: UsedCondition` e obligatoriu.** Sunt piese din dezmembrări; declararea
lor ca noi ar fi informație falsă în rezultatele Google.

`availability` trebuie să reflecte stocul real și starea de publicare.

## C.2 Reguli

- generate din baza de date, niciodată scrise de mână
- validate cu testul Google pentru rezultate îmbogățite
- fără date care nu apar și pe pagină — Google penalizează nepotrivirea
- fără recenzii sau evaluări inventate

## C.3 Verificare, apoi OPREȘTE-TE

Fiecare tip de pagină trece validarea, fără erori și fără avertismente.

---
---

# PARTEA D — LOCAL SEO ȘI GEO

Termenul „GEO" are două înțelesuri, ambele relevante aici. Tratează-le pe amândouă.

## D.1 SEO local — cel mai valoros pentru afacerea asta

Cine caută „dezmembrări Piatra Neamț" sau „piese auto Neamț" e un client la 40 de km, nu la
400. Traficul local convertește mult mai bine decât cel național.

**`AutoPartsStore` cu date complete**, luate din Admin → Setări:
- denumire legală, adresă completă, telefon, e-mail
- coordonate geografice
- program de lucru, în format structurat
- zona deservită
- legături către profilurile sociale, dacă există

**Consecvența NAP** (nume, adresă, telefon) e esențială: exact aceeași formă pe site, în
datele structurate și în Google Business Profile. Diferențele slăbesc semnalul local.
Verifică și raportează dacă adresa apare diferit în locuri diferite.

**Scrie `docs/google-business-profile.md`** — ghid pentru client: cum își revendică
profilul, ce categorie alege („Auto parts store" / „Auto wrecker"), ce completează, cum
adaugă poze, cum cere recenzii. Scris pentru cineva fără cunoștințe tehnice.

## D.2 Optimizare pentru motoare generative

Din ce în ce mai mulți oameni întreabă un asistent AI unde găsesc o piesă. Ca să fii citat,
informația trebuie să fie extractibilă și neambiguă.

- **datele structurate din Partea C fac cea mai mare parte a treburii** — un asistent care
  citește `Product` cu preț, stare și compatibilitate poate răspunde precis
- compatibilitatea trebuie să fie explicită în date, nu doar în titlu
- `/faq` cu `FAQPage` — răspunsuri directe la întrebări reale
- entități clare: firma, locația, ce vinde, garanția, livrarea
- verifică dacă `robots.txt` blochează crawlerele asistenților AI. **Nu decide singur** —
  raportează-mi ce găsești și decid eu ce permitem

**Nu genera conținut pentru AI.** Fără pagini artificiale, fără text scris pentru roboți.

## D.3 Verificare, apoi OPREȘTE-TE

Datele structurate locale validate, NAP consecvent peste tot, ghidul scris.

---
---

# PARTEA E — CE SE ÎNTÂMPLĂ CÂND O PIESĂ SE VINDE

**Decizie arhitecturală, nu detaliu. Analizeaz-o și propune-mi o soluție. Nu implementa.**

Când o piesă se vinde pe pieseauto.ro, importul o depublică. La ~30 de vânzări pe zi,
în doi ani înseamnă peste **20.000 de URL-uri** care au fost indexate și nu mai există.

Ce se întâmplă acum cu URL-ul unei piese depublicate? 404? 200 cu pagină goală? Verifică.

**Analizează opțiunile și recomandă:**

| Opțiune | Consecință |
|---|---|
| 404 | corect tehnic, dar mii de erori în Search Console și utilizatori în fundătură |
| 410 | semnal mai clar de „dispărut definitiv", curăță indexul mai repede |
| redirecționare 301 spre categorie | păstrează valoarea linkurilor, dar poate fi văzută ca redirecționare irelevantă |
| pagina rămâne, marcată „vândut", cu piese similare | păstrează traficul și îl transformă în vizite utile |

**Ține cont că piesele sunt unicat.** Un far de Passat B6 vândut nu se mai întoarce, dar
altul identic poate apărea mâine, cu alt ID. Asta contează pentru alegere.

Ce recomanzi și de ce? Propune-mi și cum se afișează pagina, dacă alegem varianta cu
păstrare — fără text nou scris de mine.

---
---

# RAPORT FINAL

1. `robots.txt` de pe producție, integral, și ce variabilă trebuie setată
2. Situația `www` vs non-`www`, cu ce răspunde fiecare
3. Tabelul de diagnostic de la 0.2 și 0.4, cu gravitate
4. Lighthouse înainte / după
5. Raportul de linkuri interne: câte piese sunt orfane
6. Propunerea de structură de legături (B.4), pentru aprobare
7. Rezultatele validării datelor structurate
8. Ce crawlere de asistenți AI sunt blocate acum
9. Recomandarea pentru Partea E, cu argumente
10. Ce ai găsit și **nu** ai reparat, cu motivul