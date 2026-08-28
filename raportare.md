# RAPORT — 28 august 2026 · de ce pare lentă pagina /piese

B.4 punctul 1 e împins în `81740f4` (rutele de marcă și categorie). Mai jos e diagnosticul
cerut pentru viteza lui `/piese`.

**Măsurat, nu implementat.** Rezultatul **infirmă ipoteza cu imaginile.**

---

## Unde se duce timpul

Lighthouse, mobil, producție:

| | |
|---|---|
| Performanță | 81 |
| First Contentful Paint | 1,1 s |
| **Speed Index** | **2,4 s** |
| LCP | 4,7 s |
| **Time to Interactive** | **4,8 s** |
| Total Blocking Time | 140 ms |
| CLS | 0 |

Greutatea paginii — **736 KB, 39 de cereri**:

| | cereri | KB |
|---|---:|---:|
| **Fonturi** | 4 | **285** |
| Scripturi | 18 | 199 |
| **Imagini** | 8 | **188** |
| HTML | 1 | 36 |
| Restul | 8 | 27 |

**Imaginile sunt 188 KB, nu 1,44 MB.** Cei 1,44 MB dintr-un raport anterior erau greutatea
tuturor celor 24 de poze descărcate forțat. În realitate `loading="lazy"` face ca la prima
încărcare să se descarce doar cele **8 vizibile**. Măsurătoarea de atunci era corectă ca
număr, dar concluzia trasă din ea a fost greșită.

## Navigarea din meniu e mai RAPIDĂ, nu mai lentă

| | |
|---|---|
| navigare din meniu (client-side) | 1156 · 1165 · 1200 ms |
| încărcare directă a adresei | 1614 · 1559 · 1447 ms |

Senzația e reală, dar cauza e alta: după click, **pagina veche rămâne pe ecran ~1,2 secunde
fără niciun semn că se întâmplă ceva**. Next randează pe server înainte să arate orice, iar
`/piese` n-are `loading.tsx`.

Nu e lentoare, e lipsă de răspuns — care se simte mai rău decât e.

## Ce s-a găsit în schimb: fonturile

Cel mai greu lucru din pagină. Sunt patru fișiere **TTF**, nu WOFF2. Convertite ca să existe
cifra exactă, nu o estimare:

```
Poppins-Regular    156 KB  ->   50 KB
Poppins-Medium     154 KB  ->   49 KB
Poppins-SemiBold   153 KB  ->   50 KB
Poppins-Bold       152 KB  ->   49 KB
TOTAL              617 KB  ->  200 KB   (68% mai puțin)
```

---

## Propunerea, în ordinea câștigului

1. **`loading.tsx` pe `/piese` și pe rutele noi** — rezolvă exact senzația descrisă. Next îl
   arată instantaneu, prin Suspense, cât timp serverul randează. ~20 de minute, zero risc.
2. **Fonturile în WOFF2** — 285 KB transferați → ~110 KB. Cel mai mare câștig de greutate din
   pagină. O oră.
3. **Treapta 2 la imagini** — rămâne utilă, dar **nu pentru prima încărcare**: ajută la
   derulare și taie datele consumate pe mobil. Nu e cauza problemei de acum.

Recomandarea: **1 și 2 înaintea lui 3**, exact pe motivul pentru care treapta 2 fusese urcată
în prioritate — e pagina cea mai importantă, iar primele două o fac să pară, și să fie, rapidă
mai mult decât ar face-o imaginile.

## Ce aștept

Confirmarea schimbării de ordine.
