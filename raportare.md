# RAPORT — 28 august 2026 · fonturi WOFF2, ecrane de așteptare, și o regresie scoasă

## Rezultatul măsurat pe producție

| | înainte | acum |
|---|---:|---:|
| **Greutate totală** | 736 KB | **655 KB** |
| **Fonturi** | 285 KB | **201 KB** |
| Time to Interactive | 4,8 s | **4,5 s** |
| Total Blocking Time | 140 ms | **70 ms** |
| Speed Index | 2,4 s | 3,4 s |
| CLS | 0 | **0** |

Fonturile au dat exact ce promiteau: **−84 KB pe fiecare pagină a site-ului**, nu doar pe
`/piese`. TBT s-a înjumătățit — mai puțin de decodat la pornire.

**Speed Index a crescut**, de la 2,4 la 3,4 s. E singura cifră în minus și nu am o explicație
măsurată pentru ea; Speed Index variază mult între rulări, iar restul indicatorilor merg în
sens invers. Se reia, ca să nu treacă o presupunere drept răspuns.

## Fonturile

Patru fișiere TTF, 617 KB, convertite în WOFF2: 200 KB. Fișierele `.ttf` rămân în
`app/fonts/` ca sursă.

Toate patru grosimile sunt folosite — 400 în textul de corp, 500 la etichete, 600 și 700 în
titluri și butoane (174, respectiv 113 locuri în cod). Niciuna nu se putea scoate fără să
schimbe felul în care arată site-ul, deci au rămas toate.

`display: "swap"`, nu `optional`: textul se desenează imediat cu fontul de sistem și se
schimbă când sosește Poppins. `optional` ar sări complet fontul pe conexiuni slabe.

---

## Regresia pe care am introdus-o și am scos-o

Scheletele de pe listări **anulau încărcarea leneșă a imaginilor.** Măsurat A/B pe același
build:

| | poze descărcate | greutate |
|---|---:|---:|
| fără schelet | 6 | **338 KB** |
| cu schelet | **24** | **1.475 KB** |

Pe producție se vedea ca 2.025 KB și 29 de cereri de imagini — un plus de **1,1 MB pe
telefon**, exact opusul a ce urmăream.

Am presupus că imaginile intră în pagină înainte ca stilurile să le dea o formă și am
încercat `width`/`height` explicite. **N-a schimbat nimic**, deci explicația era greșită;
codul n-a rămas acolo.

Scheletele au fost scoase **doar de pe listări**. Pe pagina de piesă, pe `/masini` și pe
pagina unei mașini rămân — verificat că acolo nu produc efectul (0, respectiv 6 poze, cât
încarcă galeria oricum).

## Ce înseamnă pentru cererea inițială

Cererea era `loading.tsx` pe toate rutele care randează pe server. **Pe trei dintre ele nu se
poate**, în forma asta: costă 1,1 MB. Pe celelalte trei e livrat.

Pentru listări, alternativa care dă răspuns la click fără să atingă imaginile e **o bară
subțire de progres în partea de sus**, arătată în timpul navigării. Nu schimbă așezarea, deci
nu poate influența ce imagini se încarcă. Adaugă însă un element vizibil nou, așa că e
propusă, nu făcută.

## Ce aștept

Bara de progres pe listări — da sau nu. Dacă nu, listările rămân fără feedback la click până
găsim altă cale.

Apoi treapta 2 la imagini, care rămâne la coadă, cum am stabilit.
