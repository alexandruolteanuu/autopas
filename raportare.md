# RAPORT — 28 august 2026 · PARTEA E, încheiată

Împins pe `main`. Migrările 24, 25 și 26 rulate. Acțiunea 5 amânată, prin decizie.

---

## Cifra finală

| | început | acum |
|---|---:|---:|
| piese fără categorie | 206 | **0** |
| piese fără model | 1.912 | **117** |
| piese cu model | 78,2% | **98,7%** |
| piese legate de 2+ modele | 1.999 | 2.384 |
| modele în tabelă | 345 | 540 (537 au piese) |
| mărci în tabelă | 19 | 42 |
| mărci vizibile în filtru | 19 | 38 |

Cele **117** rămase:

| Cauză | Piese |
|---|---:|
| sursa n-are compatibilitate deloc | 107 |
| sursa însăși scrie „Altă marcă Alt model" | 8 |
| generație lipsă sau ambiguă | 2 |

Convergență confirmată: a doua trecere a scriptului nu mai schimbă nimic.

---

## Ce s-a reparat, pe scurt

**Patru defecte din aceeași familie**, toate găsite măsurând, nu citind cod:

1. `taxonomieDinUrl` ignora URL-urile cu două segmente, deși primul segment e tot categoria.
   206 piese fără categorie, 206 URL-uri scurte — corelație perfectă.
2. Dezambiguizarea generației citea anii din NUMELE modelului, cu regex care cerea paranteze.
   69 din 345 de modele îi aveau scriși. Anii au trecut în `models.an_start` / `an_final`.
3. Două generații cu același nume de bază („XC 60 (2012–2016)" și „(2017–2024)") erau declarate
   „ambigue" fără ca anii — singura informație care le desparte — să fie consultați vreodată.
4. Tabela `brands` avea 19 mărci, o listă de dealer de mașini noi. Feed-ul acoperă 44.
   1.473 de piese aveau compatibilitatea citită curat și cădeau doar fiindcă marca lipsea.

**Trei capcane evitate înainte de scriere**, fiecare prinsă la verificarea pe date:

- „Volkswagen T5" ar fi creat un model duplicat lângă „Transporter T5" — sursa scrie ambele forme
  pe aceeași piesă. 37 de piese. Rezolvat cu aliasuri legate de marcă.
- „Hyundai Matrix" apare ca linie de compatibilitate pe faruri de Audi și VW, fiindcă „Matrix" e
  tehnologia farului. Rezolvat cu verificare încrucișată pe marcă: o linie contrazisă de titlu nu
  mai poate CREA un model, dar se poate lega de unul existent — altfel ar fi căzut și
  compatibilitatea legitimă Sharan/Galaxy.
- Octavia 1 s-a fabricat până în 2010, dar i s-a pus 1996–2004: intervalul real s-ar fi suprapus
  peste „Octavia 2 (2004–2013)" și ar fi făcut ambigue **147 de piese** care azi se potrivesc
  corect.

**Șase duplicate unificate:** `A8 4N` = `A8 D5`, `Fiesta 8` = `Fiesta 7` (vânzătorii scriu ambele
numere pentru același an, nu e facelift), și patru BMW unde seed-ul inițial și importul creaseră
fiecare câte un rând — s-a păstrat codul, cu anii mutați pe el.

**Denumirile producătorului bat consecvența noastră:** `i10`, `i20`, `i30`, `i40`, `ix35`, `bZ4X`
se scriu cu literă mică. Regula din cod nu mai atinge numele care încep cu una-două litere mici
urmate de cifră. „Jumpy" rămâne cu majusculă — Citroën chiar așa îl scrie.

---

## Rămase de făcut, la coadă

- **anii pentru 4 modele** lăsate intenționat goale: `Focus C-Max` și `Logan MCV` (completarea ar
  crea ambiguitate, fiindcă sunt candidate pentru liniile altui model), `Ibiza 5` și `Espace 5`
  (prea puține date).
- **acțiunea 5** — extragerea din titlu, pentru cele 107 piese fără compatibilitate. Amânată:
  107 din 8.754 nu justifică un mecanism nou de ghicit, cu riscul lui de fals pozitiv.

## Verificări

`node scripts/verifica-import.mjs` — **110 verificări trec**, față de 82 la începutul zilei.
`npm run build` — trece.
