# MIGRAREA 31 — numărătoarea pe categorii

Scrisă și împinsă: **`supabase/categorii-numar-rapid.sql`**. Doar `create or replace view`,
nedistructivă. **O rulează utilizatorul.**

## 1. Confirmarea pe planul nou, pe date reale

Prima măsurătoare a ieșit greșit și merită spus de ce: am cronometrat cu `count(*)`, iar
planificatorul a eliminat exact subinterogarea pe care voiam s-o măsor — nu avea nevoie de
coloana calculată. Refăcută cu `sum(nr_piese)`, care forțează calculul:

| | rulările | medie |
|---|---|---|
| **vechi** | 1452 · 1398 · 1571 ms | **1474 ms** |
| **nou** | 21,8 · 18,7 · 18,5 ms | **19,7 ms** |

Aceeași sumă în ambele: **17.478**. De ~75 de ori mai rapid.

Rescrierea folosește `union all` peste cele două coloane de categorie și o singură grupare, cu
`count(distinct pid)` — nu `count(*)` — ca o piesă care ar avea aceeași categorie în ambele
coloane să fie numărată o dată, exact ca vechiul `OR`.

## 2. Căutarea aceluiași tipar în tot proiectul

Sunt trei view-uri în bază. Măsurate toate:

| View | Timp | Verdict |
|---|---|---|
| `categorii_cu_numar` | **1474 ms** | 🔴 vinovatul — 349 de scanări complete |
| `numar_piese_pe_masina` | 0,9 ms | 🟡 aceeași formă, dar nevinovat |
| `numar_piese_pe_model` | 25 ms | ✅ agregă o singură dată |

`numar_piese_pe_masina` merită explicat, fiindcă are **exact același tipar** — subinterogare
corelată, una per mașină. Nu doare fiindcă merge pe indexul `products_vehicul_idx`: face 23 de
*căutări în index*, nu 23 de *scanări de tabelă*. Diferența e structurală, nu de mărime — la
`categorii_cu_numar`, condiția `(categorie_id = c.id) OR (subcategorie_id = c.id)` nu poate
folosi niciun index tocmai din cauza lui `OR`. Notat în `CLAUDE.md`: dacă indexul acela dispare
vreodată, view-ul mașinilor devine aceeași problemă.

**Trei locuri care numără în stratul greșit**, din aceeași familie:

- **`/piese` face cele 5 interogări secvențial**, fiecare un drum separat Frankfurt→Irlanda.
  Interogarea principală de listare ia doar 21 ms; drumurile sunt cele care se adună.
- **`/admin/masini`** aduce toate cele 8.783 de produse (9 cereri paginate) doar ca să numere
  piesele pe mașină — deși `numar_piese_pe_masina` dă exact asta în 0,9 ms.
- **`/admin/rapoarte`** aduce tot catalogul ca să traducă `product_id` în categorie și mașină.
  Azi e necesar, dar la 30 de vânzări pe zi ar trebui mutat într-un `join` în bază.

Niciunul nu e blocant acum — sunt ecrane interne, nu pagini publice.

## 3. Ce urmează

După rularea migrării: măsurare TTFB pe `/piese` și pe prima pagină.

**Estimare: ~1,2 s** din cei 2,6 s de acum. Restul ar fi cele 5 drumuri secvențiale către
Supabase. Dacă se confirmă, paralelizarea lor e următoarea reparație ieftină — și abia după ea
Treapta 2 la imagini va conta cu adevărat.

Apoi **Partea B** — `generateMetadata` pe pagina de produs.
