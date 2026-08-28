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
