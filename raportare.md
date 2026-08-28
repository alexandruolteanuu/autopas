# RAPORT — 28 august 2026 · viteza lui /piese

Ambele reparații sunt pe producție.

## Cifrele, separat pentru fiecare reparație

TTFB pe `/piese`, măsurat pe producție:

| Etapă | TTFB (mediană) | Câștig |
|---|---|---|
| la început | **2,73 s** | — |
| + migrarea 31 (view-ul) | **1,28 s** | −1,45 s |
| + paralelizarea | **0,88 s** | −0,40 s |

**De la 2,73 s la 0,88 s — de 3,1 ori mai rapid.**

Celelalte pagini:

| Pagină | înainte | acum |
|---|---|---|
| `/piese?marca=skoda` | 2,79 s | **0,79 s** |
| `/piese?pagina=7` | 2,72 s | **0,88 s** |
| prima pagină | 0,78 s | **0,60 s** |

Prima pagină a câștigat fiindcă folosea și ea `categorii_cu_numar`.

Atribuirea paralelizării s-a făcut **A/B local, pe aceeași infrastructură**, ca să nu compare
local cu producție: `/piese` 1,08 → 0,78 s, `?marca=skoda` 1,03 → 0,71 s, câte cinci rulări.
Se potrivește cu ce se vede pe producție.

---

## De ce eșuase rularea din SQL Editor

Migrarea a picat cu:

```
ERROR: 42P16: cannot change data type of view column "nr_piese"
              from bigint to integer
```

`count(*)` din view-ul vechi întorcea `bigint`, iar noua definiție avea `::int`.
`create or replace view` poate schimba CORPUL unui view, dar **nu tipul unei coloane**.

Verificarea pe `zz_test_categorii` n-avea cum s-o prindă: acolo era un view **nou**, unde
restricția nu se aplică. Se vede doar la înlocuirea propriu-zisă. Cast-ul a fost scos, iar
motivul e scris acum în fișierul migrării.

Confirmat apoi pe definiția din bază, nu doar că a mers comanda: `union all` prezent,
subinterogarea corelată dispărută, `security_invoker` păstrat, 349 de categorii, suma 17.478.

---

## Paralelizarea — două valuri, cu dependența respectată

- **valul 1**, în paralel: `categorii_cu_numar`, `brands`, `models`, `numar_piese_pe_model`;
- **valul 2**: interogarea de piese, care traduce slug-urile din adresă în id-uri folosind
  primele trei (`cats.find`, `models.find`, `brands.find`).

Cinci drumuri dus-întors în serie → două valuri.

`numar_piese_pe_model` a trecut și el prin `citesteTot`: avea 538 de rânduri azi, dar creștea
odată cu modelele și n-avea nici paginare, nici tratare de eroare.

## Erorile din valul 1 — verificate, nu presupuse

O interogare a fost ruptă intenționat (pointată spre un view inexistent) și pagina construită
așa:

```
HTTP 500
conține „piese găsite": 0
conține „Nicio piesă"  : 0
```

Pagina cade **vizibil**. Nu apare nici lista goală, nici mesajul „nicio piesă găsită", care ar
fi arătat ca un rezultat corect. `Promise.all` respinge la prima eroare și nu o prindem —
intenționat, și scris ca atare în cod. Un `?? []` pe fiecare rezultat ar fi produs exact
tiparul de la plafonul de 1.000 de rânduri și de la RLS: o operațiune care pare că a reușit,
dar n-a atins tot.

---

## Ce urmează

**Partea B** — `generateMetadata` pe pagina de produs: cele 8.739 de pagini cu același titlu și
aceeași descriere.
