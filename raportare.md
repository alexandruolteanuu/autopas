# RAPORT — 28 august 2026 · SEO, TREAPTA 1 LA IMAGINI

Partea A e închisă complet. Verificat pe producție după setările din Vercel:
`robots.txt` permite crawlarea, `www` redirecționează **308** spre non-`www` (direcția
corectă acum), iar canonical-ul e corect pe toate tipurile de pagini.

*(308 și nu 301: Vercel folosește Permanent Redirect, echivalentul care păstrează metoda.
Google le tratează la fel.)*

---

## Treapta 1 — făcută, dar cu o veste

Defectul e reparat: prima poză din listare, imaginea mare din galeria de produs și prima
mașină din `/masini` primesc `eager` + `fetchpriority="high"`. **Doar prima** — dacă totul e
prioritar, nimic nu e.

Două lucruri aflate măsurând, care contrazic ce presupuneam:

**Pe prima pagină nu era nimic de reparat.** Elementul LCP acolo e titlul `H1`, la 828 ms.
Pozele de sub el pot rămâne leneșe; le-am lăsat așa.

**Nu am pus `width`/`height` pe poze**, deși ar fi părut firesc: nu cunoaștem dimensiunile
reale ale fiecărei imagini, containerul are deja `aspect-[4/3]`, iar CLS-ul e **0** pe toate
paginile. Niște dimensiuni inventate ar fi stricat exact ce e în regulă.

**Câștigul pe `/piese` e modest.** Mediana pe trei rulări: **3072 → 2912 ms**. Cererea pozei
pornește cu 270 ms mai devreme — dar tot abia la 2,7 s.

---

## Cauza reală a LCP-ului e altundeva

| Pagină | TTFB (3 rulări) |
|---|---|
| `/` | 0,58 s |
| **`/piese`** | **2,6 – 2,8 s** |
| `/masini` | 0,18 s |

Poza nu poate începe să se încarce înainte să sosească HTML-ul. `fetchpriority` își face
treaba în limita asta, dar plafonul e serverul.

Am căutat ce durează și am găsit: **view-ul `categorii_cu_numar` ia 1.412 ms singur.**
Numără piesele pe categorie cu o subinterogare corelată — o scanare completă peste toate
cele 8.783 de produse, **de 349 de ori**, o dată pentru fiecare categorie:

```
Seq Scan on categories c  (actual time=5.996..1409.633 rows=349)
  SubPlan 1
    ->  Seq Scan on products p  (actual time=1.252..4.020 rows=50 loops=349)
          Rows Removed by Filter: 8733
Execution Time: 1411.666 ms
```

Rescris ca o singură agregare (`union all` peste cele două coloane de categorie, apoi
`count(distinct)`), măsurat fără să modific nimic:

- **1.412 ms → 27 ms**, de **53 de ori** mai rapid;
- rezultate **identice**: 349 de categorii, **0 diferențe**, aceeași sumă totală (17.478).

E jumătate din TTFB-ul lui `/piese`, iar view-ul e folosit și pe prima pagină, și în admin.

---

## Întrebarea deschisă

**Aplic rescrierea view-ului acum?** E o migrare `create or replace view`, nedistructivă, cu
rezultate verificate identice — vreo 10 minute cu tot cu verificare.

Contează pentru ordinea de lucru: ar face ca **Treapta 2 la imagini** (varianta de 400px) să
conteze cu adevărat. Acum, oricât ai micșora pozele, LCP-ul rămâne blocat de cei 2,6 s de
server.

Dacă preferi ordinea strictă, o las pentru mai târziu și trec la **Partea B** —
`generateMetadata` pe pagina de produs.

---

*Rapoartele anterioare rămân în istoricul git; ultimul, cel al Părții A, la commitul
`7de0285`.*
