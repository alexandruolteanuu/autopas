# RAPORT — 28 august 2026 · SEO, PARTEA A

**Canonical-ul e reparat și împins (`0625ec3`). Se poate da drumul la indexare.**

Un singur lucru la ordine: `PERMITE_INDEXARE=da` se setează **după** ce Vercel a terminat
build-ul acestui commit. Practic se rezolvă de la sine — schimbarea variabilei declanșează
oricum un redeploy, care ia ultimul `main`, deci amândouă intră împreună.

---

## Ce s-a reparat

`alternates.canonical: "/"` a ieșit din `app/layout.tsx`. Metadatele din layout se moștenesc
de orice pagină care nu-și declară altele, așa că linia aceea nu însemna „prima pagină e
canonică pentru ea însăși", ci **„toate paginile sunt duplicate ale primei pagini"**.

Măsurat pe producție înainte de reparație: toate cele 8.739 de pagini de piese, `/contact`,
`/faq`, `/despre-noi`, `/cauta-dupa-masina`, `/preda-masina` și cele 8 documente legale
declarau `canonical: https://autopas-dezmembrari.ro`. Aveau canonical propriu doar `/`,
`/piese`, `/masini` și `/masini/[slug]`.

Fiecare pagină publică își declară acum propria adresă — verificat pe 16 tipuri de pagini,
inclusiv `?pagina=3`. `/cos` și `/checkout` rămân fără canonical, ceea ce e corect: sunt
blocate din `robots.txt` și n-au ce căuta în index.

Pagina de produs a primit `generateMetadata` doar pentru canonical, construit din slug, fără
nicio interogare în plus. Titlul și descrierea vin în Partea B.

## `robots.txt`, simulat cu variabila pornită

Ca să se știe exact ce se deblochează:

```
User-Agent: *
Allow: /
Disallow: /admin, /admin/, /cont, /autentificare, /cos, /checkout,
          /comanda-plasata, /favorite, /api/
Host: https://autopas-dezmembrari.ro
Sitemap: https://autopas-dezmembrari.ro/sitemap.xml
```

Corespunde exact cu cerința A.1. Sitemap: 8.780 URL-uri, toate pe domeniul fără `www`.

**Rămâne de configurat:** domeniul principal în Vercel → Domains. Acum
`autopas-dezmembrari.ro` redirecționează 308 spre `www`, iar canonical-ul spune invers.

---

## Imagini: `next/image` sau doar atribute?

Măsurat înainte de a alege. O poză de listare are **1024px lățime** și e afișată pe telefon la
~185px — de **5,5 ori** mai lată decât e nevoie. Cele 24 de poze de pe `/piese` cântăresc
**1,44 MB** pe mobil, 61 KB în medie. Asta e cauza LCP-ului de 4,4 s, nu lipsa atributelor.

**Doar `srcset` n-ar ajuta:** avem o singură dimensiune stocată per poză (importul o duce la
1600px și o trece în WebP), deci srcset-ul ar oferi aceeași adresă la orice lățime. N-are ce
alege.

**`next/image` are un cost real:** optimizarea Vercel se facturează pe imagine-sursă
transformată, iar catalogul are 8.739 de imagini unice. Ar depăși pragurile incluse.

Propunerea, în două trepte:

| Treaptă | Efort | Ce face |
|---|---|---|
| 1. `fetchpriority="high"` + `loading="eager"` pe prima imagine din listare și pe cea principală din galeria de produs, plus `width`/`height` | ~1 oră, gratuit | acum toate cele 25 de imagini sunt `lazy`, inclusiv elementul LCP — exact invers decât trebuie |
| 2. a doua variantă, de 400px, generată la import și stocată lângă cea mare, plus `srcset`/`sizes` | ~3 ore | taie pagina de la 1,44 MB la ~250 KB pe telefon |

Treapta 1 se vede imediat în LCP; treapta 2 e cea care mută cifra sub 2,5 s. Costul treptei 2:
spațiu în bucket (avem deja 1,7 GB) și o trecere peste pozele existente cu un script, ca la
`reconverteste-poze.mjs`.

---

## Propunerea pentru cele 8.396 de piese orfane (B.4)

**Nu se implementează nimic până la aprobare.**

Problema exactă: paginarea arată prima pagină, ultima și vecinii — **corect pentru un om**,
dar crawlerul nu poate ajunge la paginile 3–363. Măsurat prin crawl real din prima pagină:
8 piese la 1 clic, 113 la 2, **343 la 3 clicuri** din 8.739.

Trei straturi, fără niciun link nou vizibil în meniu:

1. **Pagini de marcă și de categorie ca rute proprii** (`/piese/marca/skoda`,
   `/piese/categorie/faruri`), nu ca filtre `?marca=`. Sunt 38 de mărci și ~180 de
   subcategorii cu piese — fiecare devine o pagină indexabilă, cu paginare proprie. Sparge
   catalogul în felii de 20–3.000 de piese și e, în plus, exact ce caută oamenii („piese
   Dacia", „faruri Passat").
2. **Paginare completă pe listările de nivel 2**, unde numărul de pagini e mic: la „Skoda"
   sunt 124 de piese = 6 pagini, toate afișabile. Doar `/piese` general păstrează paginarea
   prescurtată.
3. **Legături laterale între piese**: pagina de produs are deja „piese similare" și „de la
   aceeași mașină". Se adaugă „alte piese din aceeași categorie pentru același model" — 4–6
   linkuri per pagină, care leagă catalogul într-o rețea, nu într-un lanț.

Cu asta, orice piesă e la maximum 4 clicuri: acasă → marcă → model/categorie → pagina N →
piesă. Nu adaugă niciun element vizual nou în navigație; paginile de marcă și categorie există
deja ca filtre, doar capătă adrese proprii.

**Costul onest:** punctul 1 cere rute noi și redirecționări de la filtrele vechi, ca să nu
creăm duplicate. E cea mai mare bucată din tot auditul.

---

## Ce urmează

Partea B — `generateMetadata` pe pagina de produs: 8.739 de pagini cu același titlu și
aceeași descriere.

*Rapoartele anterioare (mod vacanță, pagini de mașină, plafonul de 1.000 de rânduri, Google
Analytics, diagnosticul SEO) rămân în istoricul git, până la commitul `0625ec3`.*
