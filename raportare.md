# RAPORT — 28 august 2026 · sufixul titlurilor + linkurile către rutele noi

Punctul 1 (sufixul) e **aplicat și împins** în `5757451`.
Punctul 2 (rutele) așteaptă o confirmare, mai jos.

---

# 1. Sufixul — făcut, toate cele patru puncte

Marca se adaugă acum **într-un singur loc**: șablonul din layout, care importă sufixul din
`lib/seo.ts`. Generatoarele nu-l mai pun, iar paginile de piesă și mașină au renunțat la
`absolute` — le trebuia doar ca să scape de dublare.

Sufixul e ` | AUTOPAS`. Bugetul titlului propriu crește de la 43 la **55** de caractere.

## Scriptul de verificare

`scripts/verifica-seo.mjs` cere paginile de la un server care rulează și verifică:

- titlul ≤ 65 de caractere;
- descrierea ≤ 165 și prezentă pe fiecare pagină;
- **marca apare exact o dată în titlu** — regula pentru care există scriptul;
- două pagini nu împart aceeași descriere;
- exact un `<link rel="canonical">` per pagină.

**126 de verificări trec, 0 pică.**

Verificarea se face pe **pagini reale**, nu pe funcțiile care compun titlurile: un generator
poate fi corect și pagina tot greșită, dacă altcineva mai adaugă ceva pe drum — exact ce s-a
întâmplat de două ori.

**Scriptul și-a găsit singur primul caz, la prima rulare:** prima pagină folosește
`title.default`, care nu trece prin șablon, deci n-are sufix — dar titlul ei conține deja
„Autopas Dezmembrări". Regula a devenit „marca apare o dată", nu „sufixul literal există". O
regulă care ar fi cerut sufixul ar fi picat pe o pagină perfect corectă.

Notat în `CLAUDE.md`, la tabelul de unelte, și decizia amânată a rutelor de model cu criteriul
de reluare: **după ce 80% din paginile de marcă sunt indexate**.

---

# 2. De unde se ajunge la fiecare din cele 337 de rute

Întrebarea a prins exact ce ar fi transformat munca asta în mutarea problemei, nu în
rezolvarea ei. Am verificat ce linkuri există azi:

| Rută | De unde se ajunge acum |
|---|---|
| **38 de mărci** | Filtrul `VehicleFilter` de pe prima pagină, `/piese` și `/cauta-dupa-masina` — dar e un `<select>`. **Google nu urmează opțiuni de `<select>`.** Zero linkuri reale. |
| **299 de categorii** | Sertarul de filtre din `/piese` are linkuri `<a>` adevărate către categorii și subcategorii. Acolo **există** linkuri. |

Deci mărcile ar rămâne orfane — exact bănuiala din întrebare.

## Propunerea

Ca fiecare rută să aibă cel puțin un link real:

1. **Secțiunea „Mărci auto" de pe prima pagină** — există deja ca text (regula din `CLAUDE.md`:
   nu reproducem logo-uri, secțiunea e doar text). Cele 38 de nume devin linkuri către
   `/piese/marca/{marca}`. Zero elemente noi, doar text care devine link.
2. **Sertarul de filtre din `/piese`** — linkurile de categorie duc la
   `/piese/categorie/{slug}` în loc de `?categorie=`. Acoperă toate cele 299.
3. **Subsolul** — un rând cu primele 8–10 mărci după numărul de piese. Acesta **chiar adaugă
   elemente vizibile**, deci e propus separat, nu se face fără acord.
4. **Legături între pagini** — pe `/piese/marca/skoda`, lista categoriilor care au piese
   Skoda; pe `/piese/categorie/faruri`, mărcile care au faruri. Se generează din date, nu e
   text nou.

Cu **1, 2 și 4**, fiecare din cele 337 de rute e la maximum **2 clicuri** de prima pagină,
fără niciun element vizibil nou. Punctul **3** e opțional.

---

## Ce aștept

Confirmarea punctelor **1, 2 și 4** — și dacă vrei și **3**, care adaugă un rând în subsol.
