# RAPORT — 28 august 2026 · Partea B, șabloanele rămase

Aplicat și împins în `be339c1`.

## Ce s-a schimbat

**Toate paginile fixe și cele opt documente legale împărțeau aceeași descriere** — cea a
primei pagini, 163 de caractere, moștenită din layout. Douăzeci de pagini cu același rezumat.

**Paginile legale își iau descrierea din primul paragraf al documentului**, nu dintr-un text
scris separat. Motivul: ar fi fost al doilea loc de ținut la zi, iar metadatele ar fi ajuns să
spună altceva decât pagina — exact defectul reparat azi la politica de cookies.

**Restul paginilor fixe** au descrieri scrise pe baza conținutului lor real, citit în cod
înainte: actele cerute la predarea mașinii, platforma gratuită în zona Neamț, faptul că
transportul de retur îl suportă clientul.

**Listările poartă cifre reale**, care se schimbă odată cu catalogul:

- `/piese` → „8.739 de piese auto second-hand pe stoc…"
- `/masini` → „23 de mașini aflate la dezmembrat…"

Paginile 2+ din catalog primesc numărul paginii — altfel toate cele 365 ar fi avut aceeași
descriere.

## Două defecte reparate pe drum

**Pagina de mașină avea titlul de 85 de caractere**, cu marca de două ori:

```
Dezmembrări Vw Passat B6 2.0 TDI BMP · 2008 — piese disponibile · Autopas Dezmembrări
```

Același șablon de layout care lovise și pagina de produs. Acum 53 de caractere, prin
`title: { absolute }`.

**„Programul Rabla — predă mașina, primești certificatul pe loc"** plus sufixul dădea 82.
Titlul scurt e acum „Programul Rabla"; restul a intrat în descriere, unde are loc.

## O economie găsită pe drum

**Pagina de mașină făcea două interogări identice** pentru aceeași mașină: `generateMetadata`
și pagina și-o cereau separat. Acum trec prin `cache()`, ca la piese. La fel `/masini`, unde
cele două citiri au ajuns și în același `Promise.all`.

Numărul de piese se citește din view, nu din `piese_listate`: o descriere care promite piese
inexistente e mai rea decât una fără cifre.

## Verificarea

| | rezultat |
|---|---|
| pagini verificate | 20 |
| titluri distincte | **20** |
| descrieri distincte | **20** |
| titluri peste 65 de caractere | **0** |
| descrieri peste 165 | **0** |
| pagini fără descriere | **0** |

Un fals pozitiv prins la verificare: trei „duplicate" erau de fapt pagini 404 — slug-uri
legale inventate de mine (`/legal/garantii`, `/legal/anpc-sol`), care nu există. Cele reale
sunt opt, toate cu descrieri proprii acum.

---

## Ce urmează

**B.4 punctul 1** — rutele de marcă și categorie, unde vin și descrierile de listare cu
numărul de piese pe fiecare marcă și categorie.

Apoi punctele 2 și 3 din B.4, Partea C (date structurate), treapta 2 la imagini, Partea D
(local SEO și GEO), Partea E (analiza pentru piesele vândute) și sitemap-ul index împărțit pe
piese, mașini, categorii, mărci și statice.
