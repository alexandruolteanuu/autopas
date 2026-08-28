# RAPORT — 28 august 2026 · audit titluri + structura de rute (propuneri)

**Nu s-a implementat nimic.** Ambele secțiuni așteaptă aprobare.

---

# 1. Auditul titlurilor

**Niciun titlu nu depășește azi 65 de caractere.** Măsurate toate cele 22 de tipuri de
pagini, pe build local.

Dar tiparul se va repeta, și se vede exact unde:

| Pagină | Total | Titlul propriu | Rezervă |
|---|---:|---:|---:|
| `/legal/anpc-si-sol` | **62** | 40 | **3** |
| `/legal/politica-de-confidentialitate` | 58 | 36 | 7 |
| `/masini` | 56 | 34 | 9 |

Sufixul `· Autopas Dezmembrări` are **22 de caractere** — o treime din buget. Pragul real
pentru titlul propriu al unei pagini e **43**, iar cel mai lung de azi are 40. Următoarea
pagină cu un titlu ceva mai descriptiv îl depășește tăcut.

Doar `/piese/[slug]` și `/masini/[slug]` folosesc `absolute` — și numai fiindcă au fost
reparate după ce s-au stricat.

## Propunerea structurală

Cauza nu e că cineva a uitat `absolute`. Cauza e că **marca se adaugă în două locuri**:
șablonul din layout și, la piese și mașini, generatorul din `lib/seo.ts`. Cât timp sunt două,
se pot ciocni.

**Un singur loc care adaugă marca, și un sufix scurt:**

1. sufixul devine ` | AUTOPAS` — 10 caractere în loc de 22, și e chiar cel folosit deja pe
   cele 8.739 de pagini de piesă;
2. `lib/seo.ts` devine sursa unică: exportă sufixul, iar `app/layout.tsx` îl importă pentru
   șablon;
3. **pagina de piesă și cea de mașină nu mai adaugă sufixul și renunță la `absolute`** — îl
   pune șablonul. Devine imposibil să se dubleze;
4. `scripts/verifica-seo.mjs`, chemat cu mâna ca `verifica-contrast.mjs`: parcurge toate
   tipurile de pagini și iese cu cod 1 dacă vreun titlu trece de 65, vreo descriere de 165,
   sau dacă două pagini împart o descriere.

Efectul: bugetul pentru titlul propriu crește de la 43 la **55**. `/legal/anpc-si-sol` coboară
de la 62 la 50.

**Costul, ca să fie știut:** în rezultatele Google, sufixul devine „| AUTOPAS" în loc de
„· Autopas Dezmembrări" pe toate paginile. E mai scurt și consecvent cu paginile de piesă, dar
mai puțin descriptiv pentru cine vede marca prima oară.

**Alternativa:** păstrăm sufixul lung și facem doar punctele 2–4. Atunci bugetul rămâne 43,
iar scriptul e cel care prinde depășirile.

**Recomandarea:** varianta scurtă — 8.739 din cele ~8.780 de pagini o folosesc deja.

---

# 2. B.4 punctul 1 — structura de rute

Slug-urile sunt curate: 349 de categorii cu slug-uri distincte, 42 de mărci, **zero coliziuni**
între cele două spații. Rutele sunt neambigue.

## Rutele noi

| Rută | Câte | Exemplu |
|---|---:|---|
| `/piese/marca/{marca}` | **38** | `/piese/marca/skoda` |
| `/piese/categorie/{categorie}` | **299** | `/piese/categorie/faruri` |

La categorii intră și cele 17 grupe principale, și cele 282 de subcategorii — un singur spațiu
de rute, fiindcă stau în aceeași tabelă și slug-urile nu se ciocnesc.

**La mărci nu se pune prag**, consecvent cu regula din `CLAUDE.md`: cine caută Alfa Romeo caută
exact asta. **La categorii sunt 111 cu sub 5 piese** — pagini subțiri. Propunerea: să existe ca
rute (sunt legitime și se umplu singure), dar să nu intre în sitemap până nu au cel puțin 3
piese.

**Nu se propune acum** `/piese/marca/{marca}/{model}` — ar fi încă 538 de pagini. „Piese Golf
5" e o căutare foarte bună, dar merită așteptat să vedem cum se indexează primele două
niveluri. E o decizie separată.

## Redirecționările 301

| De la | Către |
|---|---|
| `/piese?marca=skoda` | `/piese/marca/skoda` |
| `/piese?categorie=faruri` | `/piese/categorie/faruri` |
| `/piese?subcategorie=X` | `/piese/categorie/X` |
| `/piese?vehicul=X` | `/masini/X` |

Toate **301**, permanente. Parametrii rămași se păstrează:
`/piese?marca=skoda&pagina=2` → `/piese/marca/skoda?pagina=2`.

Se fac în `middleware.ts`, nu în `next.config.mjs`: redirecționarea depinde de CE parametri
există și de CÂȚI sunt, iar `redirects()` din config nu poate decide asta.

## Ce rămâne filtru, cu `noindex`

Orice combinație de **două sau mai multe** filtre: `?marca=skoda&categorie=faruri`,
`?marca=X&model=Y`, orice cu `q=` sau `oem=` (căutare), orice cu `sort=`. Sunt aceleași piese
rearanjate — exact conținutul duplicat pe care îl evită și sitemap-ul azi.

**O corectură la cerință:** filtrul după **an nu există** în cod. Parametrii de azi sunt
`q, oem, categorie, subcategorie, vehicul, sort, marca, model, pagina`. Combinația „marcă +
categorie + an" nu se poate produce. Regula rămâne valabilă pentru celelalte.

---

## Ce aștept

1. aprobarea structurii de rute și a listei de redirecționări;
2. alegerea sufixului: **scurt** (` | AUTOPAS`, recomandat) sau **lung** (păstrăm
   `· Autopas Dezmembrări` și facem doar punctele 2–4).
