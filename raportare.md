# RAPORT — 28 august 2026

Partea E, acțiunile 1–4: categoria din URL-uri scurte · mărcile lipsă · anii generației · sinonime

Împins pe `main`: `a803bd1` (4 commit-uri). Migrările 24 și 25 rulate de utilizator; completarea aplicată.

---

## Ce am făcut

### Acțiunea 1 — `taxonomieDinUrl`

Reparată (`lib/import/extragere.mjs:50`). Ramura pentru URL-uri cu două segmente lipsea; primul
segment e tot categoria. Verificat: toate cele **60** de slug-uri distincte din cele 206 URL-uri
scurte există în `taxonomie-sursa.mjs`, deci reparația acoperă 206 din 206.

### Acțiunea 2 — mărcile

Migrarea `supabase/marci-lipsa.sql` (nr. 25) adaugă **23 de mărci** și redenumește SsangYong.
Nu 25: din lista măsurată, una era „Altă marcă" — cele 24 de piese unde *sursa însăși* spune că
nu știe mașina, deci rămân goale — iar SsangYong e redenumire, nu inserare.

Regula de afișare e pusă: `marciCuPiese` din `lib/format.ts`, folosită pe prima pagină (și în
filtru, și în secțiunea „Mărci auto"), pe `/piese` și pe `/cauta-dupa-masina`. Pe ultima
**lipseau cu totul numărătorile de piese** — filtrul de acolo arăta toate mărcile, fără cifre;
acum le are.

### Acțiunea 3 — defectul structural al anilor

`supabase/ani-generatie.sql` (nr. 24) adaugă `an_start`/`an_final`, le populează din numele
existente și pune o constrângere de validitate. `interval()` din `potrivire.mjs` le citește de
acolo; citirea din nume a rămas ca plasă. `an_final` gol înseamnă „încă în producție".

Din 345 de modele, **69 se populează automat**. Restul de 276 rămân de completat cu mâna, așa că
ecranul **Admin → Mărci și modele** a primit două câmpuri de an și un marcaj „⚠ fără ani" pe
fiecare model care blochează dezambiguizarea.

O capcană evitată: la Peugeot, „2008", „3008", „308" sunt *nume de modele*. De aceea migrarea nu
caută niciodată un an singur, doar un interval sau o formă deschisă („2026 +"). Există verificare
pentru asta.

### Acțiunea 4 — SsangYong

Redenumită în `SsangYong` (slug `ssangyong`), cu „KGM" ca sinonim în `SINONIME_MARCI`.

Tabelul de sinonime are **un singur rând**, și asta e un rezultat măsurat, nu o scăpare. Am
numărat toate cele 12.410 linii de compatibilitate: sursa scrie „Mercedes …" (438) și **niciodată**
„Mercedes-Benz"; „Land Rover …" (206) și niciodată „Range Rover" ca marcă; „SsangYong …" (68) și
niciodată „KGM". „VAG" și „MB" nu apar deloc. Sinonimele care păreau evidente din memorie n-aveau
niciun rând în spate.

---

## Un al patrulea defect, din aceeași familie

Verificând ce s-ar întâmpla cu Volvo, am dat peste încă unul. `potrivesteOLinie` avea o
scurtătură: dacă găsea **mai multe modele cu exact același nume de bază**, renunța pe loc cu nota
„model ambiguu".

Dar „XC 60 (2012–2016)" și „XC 60 (2017–2024)" se deosebesc *tocmai prin ani*. Singura informație
care le desparte era și singura pe care codul n-o consulta niciodată. Acum cad în aceeași
dezambiguizare ca „Octavia 2" / „Octavia 3". Fără ani în titlu rămâne ambiguu, ca înainte, și nu
se creează un al treilea model generic.

Legat de asta, migrarea 24 conține și **6 redenumiri**: modelele noastre Volvo și MG sunt scrise
cu spațiu („XC 60", „MG 4"), iar sursa le scrie lipit („XC60", „MG4") — ca și producătorii.
Potrivirea cădea, și importul ar fi creat modele duplicate pentru **126 de piese**. Toate 6 au
zero piese legate, deci redenumirea nu atinge nimic. Dacă nu ești de acord, șterge cele 6 linii
din migrare înainte s-o rulezi.

---

## Cifrele — înainte și după

Aplicat pe 28 august 2026, cu `scripts/completeaza-taxonomia.mjs --scrie`, care folosește exact
motorul de import.

| | înainte | după |
|---|---:|---:|
| piese fără categorie | 206 | **0** |
| piese fără subcategorie | 206 | **0** |
| piese fără model | 1.912 | **263** |
| piese legate de 2+ modele | 1.999 | 2.401 |
| modele în tabelă | 345 | 534 |
| mărci în tabelă | 19 | 42 |
| mărci vizibile în filtrul de pe site | 19 | 38 |

189 de modele create la prima trecere, 60 de piese prinse la a doua (modelele create pe parcurs
n-au apucat să prindă piesele procesate înaintea lor). **A treia trecere nu mai schimbă nimic** —
convergență confirmată. Cele două piese cu `editat_manual` n-au fost atinse.

Mărcile fără nicio piesă publicată — BYD, Cherry, OMODA, JAECOO — dispar singure din filtru, fără
să fie șterse: 42 în tabelă, 38 pe site.

### Cele 263 rămase

| Cauză | Piese |
|---|---:|
| generația lipsește sau e ambiguă | 148 |
| sursa n-are compatibilitate deloc | 107 |
| sursa însăși scrie „Altă marcă Alt model" | 8 |

Primele 148 se rezolvă parțial din lista de ani de mai jos (86), restul cer generații pe care nu
le avem. Cele 107 fără compatibilitate sunt singurul teren unde extragerea din titlu (acțiunea 5)
ar mai avea ce recupera.

---

## ⛔ Punct de oprire — lista de aprobat

**~180 de modele noi**, toate confirmate de titlu, grupate pe marcă (în paranteză, câte piese):

| Marcă | Modele | Piese | Lista |
|---|---:|---:|---|
| Mercedes | 34 | 341 | C-Class W204 (55), GLK X204 (49), E-Class W212 (43), GLC X253 (32), A-Class W168 (22), A-Class W169 (20), C-Class W205 (17), Sprinter 906 (17), Citan W415 (12), Vito W639 (12), A-Class W177 (10), E-Class W213 (6), C-Class W203 (5), A-Class W176 (4), B-Class W245 (4), GLA X156 (4), + 18 cu 1–3 piese |
| Mazda | 10 | 308 | 3 (103), CX-5 (61), 6 (46), CX-30 (40), CX-3 (33), 2 (11), MPV (9), CX-60 (3), 5 (1), MX-30 (1) |
| Hyundai | 16 | 203 | i20 (47), Tucson (40), ix35 (34), i30 (21), Accent (15), Sonata (9), Santa Fe (8), Getz (7), Elantra (6), i10 (6), Kona (5), + 5 cu 1 |
| Fiat | 18 | 199 | Punto (48), Doblo (28), Panda (25), Albea (22), 500 (19), Grande Punto (13), Stilo (12), Linea (6), Bravo (5), Ducato (4), + 8 cu 1–3 |
| Land Rover | 7 | 176 | Range Rover (63), Range Rover Evoque (56), Discovery Sport (18), Discovery (17), Range Rover Sport (17), Discovery 3 (4), Range Rover Velar (1) |
| Suzuki | 7 | 104 | Vitara (30), SX4 (29), S-cross (25), Swift (8), Jimny (6), Ignis (5), XL7 (1) |
| Chevrolet | 5 | 92 | Aveo (49), Kalos (19), Captiva (14), Spark (9), Cruze (1) |
| Citroen | 14 | 89 | C3 (32), C4 (16), C1 (9), Berlingo (6), Xsara (6), C-Elysee (5), C5 (4), C4 Cactus (3), + 6 cu 1–2 |
| Volvo | 13 | 86 | XC40 (23), S90 (11), V90 (11), S60 (10), V60 (10), V70 (6), S40 (3), V40 (3), XC70 (3), EX30 (2), S80 (2), C30 (1), C70 (1) |
| SsangYong | 5 | 62 | Korando (26), Tivoli (20), Rexton (14), Musso (1), Rodius (1) |
| Kia | 8 | 47 | Sportage (28), Ceed (5), Sorento (5), Picanto (4), Xceed (2), Niro (1), Soul (1), Stonic (1) |
| Jaguar | 6 | 43 | XF (14), S-Type (13), XE (11), XJ (3), E-Pace (1), F-Pace (1) |
| Lexus | 4 | 25 | RX (13), NX (9), UX (2), LS (1) |
| Cupra | 2 | 25 | Formentor (22), Terramar (3) |
| Mini | 4 | 24 | Cooper (11), One (9), Clubman (2), Countryman (2) |
| Mitsubishi | 5 | 19 | Outlander (9), Pajero (5), ASX (3), L200 (1), Lancer (1) |
| Porsche | 3 | 13 | Cayenne (8), Macan (3), Panamera (2) |
| Jeep | 4 | 12 | Renegade (7), Cherokee (3), Compass (1), Grand Cherokee (1) |
| Honda | 3 | 12 | Civic (7), CR-V (4), Insight (1) |
| Smart · Alfa Romeo · Lancia · Subaru · Dodge · Iveco | 10 | 32 | Fortwo (11) · 147 (6), 156 (2), 159 (1), Giulietta (1) · Lybra (3), Ypsilon (1) · Forester (4) · Journey (2) · Daily 6 (1) |

**Lista e aprobată** (28 august 2026), cu trei corecturi aplicate — vezi secțiunea următoare.
`Fiat Punto` și `Fiat Grande Punto` rămân modele separate, la fel `Range Rover` și variantele:
cine are Grande Punto caută exact „Grande Punto", iar piesele chiar diferă. Dacă le-am uni, un
client cu Grande Punto ar primi piese de Punto — greșeala mai scumpă. Sursa le scrie separat, iar
sursa e chiar vânzătorul.

---

## Corecturile cerute la aprobare

### Marca din titlu poate contrazice compatibilitatea

`Hyundai Matrix` nu s-a scos de mână; s-a reparat regula. „Matrix" apare ca linie de
compatibilitate pe faruri de Audi și de VW, fiindcă acolo e tehnologia farului, nu mașina.
Cuvântul chiar e în titlu, deci confirmarea prin titlu nu ajungea — conta ce **marcă** numește
titlul.

Regula nouă: dacă titlul numește mărci cunoscute și niciuna nu e a liniei de compatibilitate,
linia se marchează în revizuire și **nu are voie să creeze un model nou**. Are voie, în schimb, să
se lege de unul existent.

Distincția e deliberată. Varianta strictă — respingerea liniei — ar fi tăiat și un caz legitim:
„Debitmetru Aer Vw Sharan" are în compatibilitate și „Ford Galaxy", iar acolo amândouă au
dreptate, Sharan și Galaxy fiind aceeași mașină. Cele două situații arată identic din afară, deci
diferența pe care ne bazăm nu e lingvistică, ci de cost: legarea de un model existent se desface
dintr-un clic, dar un model inventat în tabela care alimentează filtrul de pe site, plecând de la
o linie contrazisă de titlu, se descoperă peste trei luni. Există verificare pentru amândouă
cazurile.

**Efectul măsurat pe cele 8.754 de piese:** cade un singur model propus, `Hyundai Matrix`.
`Range Rover` (63 -> 61) și `Range Rover Evoque` (56 -> 54) rămân, cu două piese mai puțin fiecare
— faruri de Jaguar cu compatibilitate Land Rover; se leagă oricum după ce modelul e creat din
celelalte piese.

Cele cinci modele cu nume care sunt și cuvinte obișnuite au fost verificate una câte una și sunt
**curate**: `Mini One` („Armatura bara spate Mini Cooper One R56"), `Chevrolet Spark` („Airbag
pasager Chevrolet Spark"), `Honda Insight` („Stop dreapta NOU HONDA INSIGHT"), `Dodge Journey`
(„Clapeta acceleratie Dodge Journey 2.0 TDI"), `Kia Soul` („Far dreapta LED KIA Soul EV"). În
toate, titlul numește marca explicit — nu e coincidență de cuvânt.

### Majuscula inițială

`numeModelNou` din `potrivire.mjs`, aplicată la toate modelele create: „jumpy" -> „Jumpy". Se
atinge doar prima literă, restul scrierii vine de la sursă („CX-5", „S-cross", „ix35" rămân cum
sunt).

---

## Anii de completat — lista scurtă

15 modele, în 11 grupuri. Completate, deblochează **până la 86 de piese** din cele 263 rămase.
Ordonate după cât deblochează fiecare:

| Marcă | Sursa scrie | Piese | De completat cu ani |
|---|---|---:|---|
| Škoda | Fabia | 40 | **Fabia 3** |
| Ford | Focus | 17 | Focus 4 · Focus C-Max |
| Škoda | Superb | 13 | **Superb 3** |
| Ford | Fiesta | 6 | Fiesta 5 · Fiesta 7 · Fiesta 8 |
| Audi | A8 | 2 | A8 4N · A8 D4 · A8 D5 |
| Seat | Ibiza | 2 | Ibiza 5 |
| Škoda | Octavia | 2 | Octavia 4 |
| Dacia | Logan | 1 | Logan 3 · Logan MCV |
| Dacia | Sandero | 1 | Sandero 3 |
| Ford | Mondeo | 1 | Mondeo 3 · Mondeo 5 |
| Renault | Espace | 1 | Espace 5 |

Se completează din **Admin → Mărci și modele**, în cele două câmpuri noi. „Fabia 3" singur face
40 din cele 86.

**Restul de 63 de piese** din cele 149 blocate NU se rezolvă cu ani, fiindcă generația însăși
lipsește din tabela noastră: Nissan Qashqai (31 de piese, avem doar J10 2007–2013, lipsește J11),
VW Caddy (18, avem doar Caddy III), VW Touran (14, avem doar Touran 1). Alea sunt modele de
adăugat, nu ani de completat — spune-mi dacă le vrei și pe ele.

---

## Migrări de rulat, în ordine

1. **`supabase/ani-generatie.sql`** — adaugă `an_start`/`an_final`, le populează din nume (69 de
   modele), pune constrângerea de validitate, mută „MG 3" și „XC 40" de sub Volkswagen la marca
   lor, face cele 6 redenumiri Volvo/MG. Idempotentă.
2. **`supabase/marci-lipsa.sql`** — redenumește SsangYong, adaugă cele 23 de mărci. Idempotentă.

## ⚠️ Commit făcut, push oprit intenționat

Build trecut („Compiled successfully"), `verifica-import.mjs` **98 de verificări trec** (erau 82 —
am adăugat 16 pentru regulile noi).

Push-ul l-am oprit fiindcă `lib/import/depozit.mjs` cere acum `an_start,an_final` de la PostgREST,
iar ecranul de admin le scrie. **Până rulezi migrarea 24, coloanele nu există**, deci un import
sau o salvare de model pe producție ar da eroare. Rulează migrările, apoi dau push.

---

## Pentru Partea B — starea mașinilor

**22 de mașini** în `vehicles`, toate cu `status = "in_dezmembrare"`, toate cu `piese_listate = 0`,
niciuna cu `cost_achizitie`.

- **4 sunt date de probă** (id 1, 2, 4, 5): VW Golf 6, VW Passat B7, Dacia Duster, Opel Astra J.
  Au `intrare` în iulie, slug-uri scrise de mână (`vw-golf-6-2011`) și sunt singurele cu
  `vin_masca` completat. Sunt rămășița celor 5 mașini-exemplu din `seed.sql` (a cincea a fost
  ștearsă).
- **18 par reale**, adăugate pe 26 august odată cu importul: Golf 5 Plus, Passat B6 ×2, Audi A4 B7,
  Subaru Forester, BMW Seria 1 E87, Ford S-Max, Peugeot Partner Tepee, Renault Kangoo, Mercedes
  Citan, Opel Zafira B, Skoda Superb 1 și 2, Skoda Fabia 2, VW Polo 9N, Renault Fluence, Peugeot
  2008, Peugeot 301. Slug generat automat, fără VIN.

Câmpuri existente: `slug`, `nume`, `an`, `vin_masca`, `piese_listate`, `intrare`, `cost_achizitie`,
`status`. **Lipsesc toate cele cerute la B.1**: `poze`, `descriere`, `publicat`, `motorizare`,
`caroserie`, `culoare`, `cutie_viteze`, `km`. Motorizarea e azi înghesuită în `nume`
(„Vw Passat B6 2.0 TDI BMP").

Heroul arată 4 mașini ordonate după `intrare` descrescător, deci cele de pe 26 august, într-o
ordine arbitrară între ele. Cu regula cerută — doar mașini cu cel puțin o piesă legată și
publicată — **secțiunea va dispărea complet**, fiindcă `products.vehicul_id` e `null` la toate
cele 8.754 de piese. Asta e situația corectă de afișat până când operatorul leagă prima mașină.
