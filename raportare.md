# RAPORT — 28 august 2026 · Partea B, punctul 1 (aplicat)

Aplicat și împins în `37ebcb7`.

## Cifra cerută: TTFB pe pagina de produs

Local, aceeași mașină, 6–8 rulări:

| | mediană |
|---|---|
| înainte | **0,311 s** |
| după | **0,216 s** |

**A scăzut**, nu a crescut. `cache()` din React face ce trebuie — `generateMetadata` și pagina
împart aceleași citiri, deci zero interogări în plus. Câștigul de 95 ms vine în plus: cele
două citiri secvențiale de modele și mărci au ajuns, cu ocazia asta, în același `Promise.all`.

## Al patrulea defect, prins la verificarea în browser

Titlul ieșea așa:

```
Motoraș etrier spate Audi A4 B8 2008–2011 | AUTOPAS · Autopas Dezmembrări
```

74 de caractere, cu marca de două ori — șablonul `%s · Autopas Dezmembrări` din layout se
adăuga peste al nostru. Ocolit cu `title: { absolute }`. Nu se vedea în generator, doar în
HTML-ul real.

Titlurile finale, citite din pagini:

```
(51) Motoraș etrier spate Audi A4 B8 2008–2011 | AUTOPAS
(64) Supapa electromagnetica Skoda Karoq / Superb / Octavia | AUTOPAS
(39) Bara fata BMW Z4 E89 Facelift | AUTOPAS
(56) Balast xenon AUDI 8K0941597C Q7 A3 A4 A5 A6 A8 | AUTOPAS
```

Pagina de produs primește și `og:image` cu poza reală a piesei, nu imaginea generică de
partajare a site-ului.

## Ce s-a livrat

- `lib/seo.ts` — generatorul, cu regulile explicate în comentarii;
- `generateMetadata` pe pagina de produs: titlu, descriere, canonical, Open Graph;
- citirile împărțite prin `cache()`, cu motivul scris în cod.

Verificat pe tot catalogul înainte de aplicare: **8.739 de descrieri distincte din 8.739**,
zero titluri peste 65 de caractere, zero descrieri peste 160.

---

## Ce urmează — și o decizie de luat

Restul șabloanelor: categorie, marcă, mașină, paginile legale, `/faq`, `/contact`.

Cerința ta pentru listări — **descrierea să conțină numărul de piese disponibile** — e reținută,
dar numărul acela e per marcă/categorie, iar acum nu există rute proprii pentru ele: sunt
filtre `?marca=skoda`. Descrierile de tipul „Piese Skoda — 124 în stoc" își găsesc locul abia
la **B.4 punctul 1**, când marca și categoria devin pagini adevărate.

**Propunerea:** se fac acum șabloanele care nu depind de asta (mașină, legal, `/faq`,
`/contact`, `/masini`), apoi B.4 punctul 1, iar descrierile de listare vin odată cu rutele noi.

Alternativa: toate după rute.

---
---

# DIAGNOSTIC — „Sitemap could not be read"

**Nu am implementat nimic.** Măsurători pe producție.

## Ce răspunde efectiv sitemap-ul

| Ce | Rezultat |
|---|---|
| status | **HTTP 200**, de fiecare dată |
| timp până la primul octet | 0,07 – 0,50 s (trei cereri) |
| dimensiune necomprimată | **1,95 MB** (limita Google: 50 MB) |
| dimensiune pe fir, comprimat `br` | **225 KB** |
| `content-type` | `application/xml` — corect |
| XML valid | **da**, element rădăcină `urlset` |
| URL-uri | **8.780** (limita Google: 50.000) |
| duplicate | 0 |
| caractere neescapate în adrese | 0 |
| adrese pe alt domeniu | 0 |

Sitemap-ul e sănătos din toate punctele de vedere măsurabile din afară.

## Ipoteza cu limita de timp a funcției — infirmată

Nu se confirmă, și nu doar pentru că răspunsul e rapid. Cauza structurală: `app/sitemap.ts`
are `export const revalidate = 3600`, deci Next îl servește din cache-ul de regenerare
(`x-vercel-cache: HIT` la fiecare cerere, inclusiv cu parametru aleator, care ocolește
cache-ul CDN). Regenerarea se face **în fundal**, cel mult o dată pe oră; nici Google, nici
un vizitator nu așteaptă vreodată cele 9 cereri paginate.

Deci niciuna dintre cele trei soluții propuse nu e necesară pentru eroarea asta.

**Nu am putut citi logurile Vercel** — nu există CLI instalat și niciun token în mediu.
Concluziile de mai sus vin din măsurători HTTP, nu din loguri.

## Ce cred că e, de fapt

Două cauze plauzibile, amândouă din afara codului:

**1. Nepotrivirea de gazdă între proprietatea din Search Console și sitemap.** Până azi,
`autopas-dezmembrari.ro` redirecționa spre `www`, iar Google avea indexată varianta cu `www`.
Dacă proprietatea din Search Console e cea cu `www`, sitemap-ul trebuie să fie pe ACELAȘI
host — dar:

```
https://www.autopas-dezmembrari.ro/sitemap.xml  ->  HTTP 308  ->  varianta fără www
```

Search Console tratează o redirecționare a sitemap-ului ca eroare de preluare. Iar dacă
încerci invers, adresa fără `www` nu aparține proprietății cu `www`.

**2. Eroarea e veche.** Până acum câteva ore, `robots.txt` spunea `Disallow: /` pe tot
site-ul, inclusiv pe `/sitemap.xml`. O preluare din perioada aceea eșua, iar Search Console
păstrează ultimul rezultat până la o nouă încercare.

## Ce propun să încerci, în ordinea asta

1. **Verifică ce proprietate ai în Search Console.** Dacă e `www.autopas-dezmembrari.ro`,
   adaugă una nouă de tip **Domain** (`autopas-dezmembrari.ro`) — acoperă ambele variante și
   nu mai depinde de prefix. Verificarea se face prin DNS.
2. **Trimite sitemap-ul ca `https://autopas-dezmembrari.ro/sitemap.xml`**, în proprietatea
   corectă. Adresa asta răspunde 200, fără redirecționare.
3. Dacă tot apare eroarea, folosește **Inspectare URL** pe `/sitemap.xml` și trimite-mi ce
   scrie acolo — arată exact ce a primit Googlebot, spre deosebire de mesajul generic.

## Ce rămâne valabil din propunerea ta, independent de eroare

**Sitemap index cu fișiere separate** (piese, mașini, categorii, statice) merită făcut oricum,
exact din motivul pe care l-ai dat: în Search Console vezi separat ce tip de pagină se
indexează prost. La 8.780 de URL-uri într-un singur fișier, raportul e o singură cifră.

Nu e urgent și nu rezolvă eroarea de acum. Îl propun ca pas în Partea C sau după.
