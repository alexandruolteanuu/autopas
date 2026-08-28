# SARCINĂ: completare automată · mod vacanță · pagini de mașină · Google Analytics · e-mail

Cinci părți, **cu oprire între ele**. Branch `main`. Migrările SQL nu le rulezi tu.

**Ordinea recomandată: E, apoi A–D.** Partea E îmbunătățește datele celor ~8.000 de piese
deja importate, iar Partea B (paginile de mașină) depinde direct de calitatea acelor date.

---

## REGULA DE AUR

Nu se schimbă: prețurile, datele produselor, logica de comenzi, textele legale, paleta
`.tema-clasica`, motorul de import din `lib/import/`.

Tot ce se adaugă vizual se verifică pe **ambele teme** și la 13 lățimi.

Fiecare scriere în baza de date folosește `scrieVerificat()` din `lib/supabase.ts`.

---
---

# PARTEA A — MOD VACANȚĂ

## A.0 Arhitectura — citește asta înainte de orice

**Implementarea evidentă e greșită și ar distruge catalogul.**

Tentația e: la activare, `update products set publicat = false`; la dezactivare,
`update products set publicat = true`.

**A doua comandă ar republica:**
- piesele ascunse intenționat de operator
- piesele cu `stoc = 0`, depublicate automat de triggerul de stoc la vânzare
- piesele cu `sursa_activ = false`, dispărute din feed-ul pieseauto.ro
- piesele nepublicate fiindcă le lipsește ceva

Nu există nicio cale de a distinge, după dezactivare, care piesă era ascunsă din vacanță și
care din alt motiv. Informația s-ar pierde ireversibil.

**Soluția: modul vacanță NU atinge niciodată coloana `publicat`.**

E un comutator global, citit la afișare. Piesele își păstrează starea exactă; site-ul public
pur și simplu nu le arată cât timp e activ. La dezactivare, totul revine automat la starea
reală, fără nicio scriere.

## A.1 Structura

În tabela `settings`, cheie nouă `vacanta`:

```json
{
  "activ": false,
  "mesaj": "",
  "data_activarii": null,
  "activat_de": null
}
```

Mesajul e text liber, scris de proprietar. Exemplu: „În perioada 15–30 august suntem în
concediu. Comenzile se reiau pe 31 august."

Migrare idempotentă, mi-o dai mie.

## A.2 Unde se aplică — verifică FIECARE punct

Nu e suficient să ascunzi grila de produse. Găsește **toate** locurile care afișează sau
permit comandarea unui produs și tratează-le pe fiecare:

| Loc | Comportament în vacanță |
|---|---|
| `/piese` (listare + filtre) | listă goală, cu mesajul de vacanță în locul stării goale obișnuite |
| homepage — piese recente / recomandate | secțiunea dispare complet, nu rămâne titlu cu gol dedesubt |
| căutarea din header | zero rezultate + mesaj |
| `/piese/[slug]` acces direct pe URL | **vezi A.3, e caz special** |
| `/favorite` | piesele rămân în listă, dar marcate „indisponibil temporar", fără buton de coș |
| `/cos` | coșul NU se golește. Banner de avertizare, butonul „Continuă" dezactivat |
| `/checkout` | blocat, cu mesaj clar |
| `/cauta-dupa-masina` | selectoarele rămân, rezultatele sunt goale + mesaj |
| paginile de mașină (Partea B) | piesele nu se afișează, mesaj de vacanță |
| `sitemap.xml` | **nu îl modifica** — vezi A.4 |
| `/admin` | **funcționează normal**, complet neafectat |

## A.3 Blocarea comenzilor — partea critică

**Ascunderea din interfață NU e suficientă.** Cineva cu pagina de checkout deja deschisă,
sau cu un URL de produs salvat, poate plasa comandă în continuare.

**Blocarea trebuie să fie pe server, în `plaseaza_comanda`:**
- funcția citește `settings.vacanta.activ` la începutul execuției
- dacă e activ, **refuză** cu un mesaj clar, înainte de orice scriere
- e singura garanție reală; restul e cosmetică

Migrarea trebuie să modifice funcția RPC. Scrie-o idempotent
(`create or replace function`).

**Pagina de produs pe URL direct:** afișează produsul (poze, descriere, preț), dar cu
butonul „Adaugă în coș" înlocuit de mesajul de vacanță. **Nu întoarce 404** — vezi A.4.

## A.4 SEO — motivul pentru care nu ascundem paginile complet

Dacă paginile de produs întorc 404 sau dispar din sitemap în timpul vacanței, Google le
scoate din index. La reluare, poziționarea se recâștigă în săptămâni, nu în ore.

**Regula:** paginile de produs rămân accesibile, cu status HTTP 200, doar fără posibilitatea
de a comanda. Sitemap-ul rămâne neschimbat. Listările sunt goale, dar paginile individuale
trăiesc.

Asta e practica standard pentru magazinele care intră în pauză, și e diferența dintre o
vacanță de două săptămâni și o recuperare de două luni.

**Dacă preferi ascunderea totală**, spune-mi — dar vreau să știi ce coste.

## A.5 Mesajul din hello bar

- înlocuiește conținutul obișnuit din hello bar (telefon + program) cât timp e activ
- fundal de avertizare (galben pe întunecat, sau `--suprafata-2` cu chenar accent), nu
  fundalul normal
- pe toate paginile publice, nu doar pe home
- **respectă plafonul de 52px pe mobil** — dacă mesajul e lung, se taie cu „…" la o linie,
  nu împinge conținutul în jos
- limitează câmpul din admin la **120 de caractere**, cu numărător vizibil
- dacă e activ dar mesajul e gol, afișează un text implicit: „Magazin în pauză temporară."
- sanitizează textul — e introdus de utilizator și ajunge în HTML

## A.6 Interfața din admin

Secțiune nouă: **Setări → Mod vacanță**

- comutator mare, cu stare vizibilă („ACTIV" / „inactiv")
- câmp de mesaj, cu previzualizare live a hello bar-ului
- la activare, **confirmare explicită**: „Toate piesele vor dispărea de pe site și nu se vor
  putea plasa comenzi. Continui?"
- afișează de când e activ și cine l-a activat

**Bandă permanentă de avertizare în tot `/admin`**, cât timp e activ:
> „MOD VACANȚĂ ACTIV — site-ul nu primește comenzi. Dezactivează din Setări."

Motivul e practic: cineva îl activează, pleacă în concediu, se întoarce și uită. O lună fără
comenzi, fără ca nimeni să înțeleagă de ce. Banda trebuie să fie imposibil de ratat.

## A.7 Verificări obligatorii

1. Activezi → nicio piesă pe site → dezactivezi → **exact aceleași piese revin**, nici una
   în plus, nici una în minus
2. Înainte de activare, ascunzi manual o piesă. După ciclu activare/dezactivare, **rămâne
   ascunsă**
3. O piesă cu `stoc = 0` **nu reapare** după dezactivare
4. Cu vacanța activă, un POST direct către `plaseaza_comanda` **e refuzat**
5. Coșul cu produse supraviețuiește ciclului
6. Zero scrieri în `products` la activare sau dezactivare — confirmă în DB
7. Hello bar-ul rămâne sub 52px la 320px cu un mesaj de 120 de caractere

**Oprește-te după Partea A cu raportul.**

---
---

# PARTEA B — PAGINI DE MAȘINĂ DEZMEMBRATĂ

## B.0 Verifică întâi ce există

Raportează, fără să modifici:
- structura completă a tabelei `vehicles`
- **cum sunt legate piesele de mașini** — există `products.vehicle_id`? Câte din cele ~8.000
  de piese importate au legătura completată?
- cum funcționează `piese_listate` (triggerul menționat în CLAUDE.md)
- **de ce toate cele 4 mașini din hero arată „0 piese disponibile"** — problemă de date sau
  de calcul?

Ultimul punct e important: dacă piesele importate din feed nu se leagă de mașini, toată
Partea B rămâne goală. **Oprește-te și spune-mi ce ai găsit.**

## B.1 Ruta și structura

`/masini/[slug]` — slug generat din marcă + model + motorizare + an, ex.
`vw-passat-b7-2-0-tdi-2012`.

Coloane noi pe `vehicles` (migrare idempotentă, mi-o dai mie):
```
slug          text unique
poze          text[]
descriere     text
publicat      boolean default true
```
Plus, dacă lipsesc: `motorizare`, `caroserie`, `culoare`, `cutie_viteze`, `km`, `an`.

## B.2 Conținutul paginii, în ordine

1. **Galerie foto** — mașina întreagă, aceleași reguli ca la produse (raport fix, WebP,
   `--imagine-bg`)
2. **Titlu** — „VW Passat B7 2.0 TDI · 2012"
3. **Specificații** — marcă, model, an, motorizare, caroserie, cutie, culoare, km
4. **Descriere** liberă, scrisă de operator
5. **Piesele acestei mașini** — grilă, aceleași carduri ca în `/piese`, cu filtrare pe
   categorie dacă sunt multe
6. **Carusel: piese de la mașini compatibile** — vezi B.3
7. Buton „Cauți altă piesă de la această mașină? Scrie-ne" → formularul de cerere,
   precompletat cu mașina

## B.3 Logica pieselor compatibile — raționamentul

Ordinea de relevanță, de la cea mai puternică la cea mai slabă:

| Nivel | Criteriu | De ce |
|---|---|---|
| 1 | **același model + aceeași generație**, altă mașină | piesele sunt interschimbabile aproape sigur |
| 2 | **același model, generație diferită** | multe piese trec între generații apropiate |
| 3 | **aceeași marcă + platformă comună** | vezi mai jos |
| 4 | aceeași marcă, model diferit | slab, folosește doar dacă nu ai altceva |

**Nivelul 3 merită atenție specială.** Am descoperit deja, la import, că pieseauto.ro
grupează piesele pe platformă: o piesă de Touran stă sub `vw/passat-b6`. Asta e o informație
utilă, nu un defect — mașinile din grupul VAG chiar împart piese.

**Nu implementa nivelul 3 acum.** Cere un tabel de platforme pe care nu-l avem. Propune-mi
cum l-ai construi, la finalul raportului.

**Reguli pentru carusel:**
- maximum 12 piese, ordonate după nivelul de relevanță
- doar piese publicate, cu stoc, de la alte mașini
- dacă sunt sub 4 rezultate, **ascunde caruselul complet** — o secțiune cu două carduri
  arată a defect
- fiecare card arată de la ce mașină provine

## B.4 Administrare

**Mașini la dezmembrat** primește:
- încărcare poze (refolosește `PhotoUploader`, cu aceeași conversie WebP)
- câmp de descriere
- comutator publicat
- **legarea pieselor de mașină** — cum se face acum? Dacă nu există o cale bună, propune-mi
  una: căutare de piese + atribuire în masă ar fi cea mai utilă la 8.000 de piese

## B.5 Hero — reparația celor „0 piese"

- afișează doar mașinile **cu cel puțin o piesă publicată**
- dacă nicio mașină nu are piese, ascunde secțiunea complet
- contorul arată numărul real de piese publicate, calculat live sau prin trigger corect
- cardurile duc la `/masini/[slug]`

## B.6 SEO

Paginile de mașină sunt valoroase: cineva caută „dezmembrari passat b7 2012" mult mai des
decât un cod OEM.

- titlu: „Dezmembrări VW Passat B7 2.0 TDI 2012 — piese disponibile | AUTOPAS"
- descriere generată din specificații și numărul de piese
- date structurate corespunzătoare
- incluse în `sitemap.xml`
- breadcrumb: Acasă / Mașini dezmembrate / [mașina]

## B.7 Stări limită

- mașină fără poze → imagine de rezervă, nu spațiu gol
- mașină fără piese publicate → mesaj + buton de cerere piesă, nu pagină goală
- mașină nepublicată accesată pe URL → 404
- toate piesele vândute → pagina rămâne (SEO), cu mesaj „Toate piesele au fost vândute" și
  legătură către mașini similare

**Oprește-te după Partea B cu raportul.**

---
---

# PARTEA C — GOOGLE ANALYTICS

## C.1 Implementarea

Google Analytics 4, prin `gtag.js`, încărcat cu `next/script` și strategia `afterInteractive`.

- ID-ul (`G-XXXXXXXXXX`) se citește din **Admin → Integrări**, unde există deja câmp pentru
  GA4. Dacă e gol, scriptul **nu se încarcă deloc** — zero cod inutil
- nu se încarcă în `/admin` (nu vrem traficul intern în statistici)
- nu se încarcă în dezvoltare

## C.2 Consimțământ — obligatoriu, nu opțional

Există deja banner de cookie-uri în proiect. **Analytics nu are voie să pornească înainte de
acceptare.** GDPR, și e exact genul de lucru pe care ANPC îl verifică.

- verifică ce face bannerul acum și cum stochează alegerea
- dacă utilizatorul refuză, GA nu se încarcă
- dacă nu a ales încă, GA nu se încarcă
- respectă alegerea la reîncărcare
- politica de cookie-uri trebuie să menționeze GA — **verifică dacă o face deja**, nu o
  rescrie fără să-mi spui

Foloseşte modul de consimțământ (`consent mode`) cu `denied` implicit, apoi `update` la
acceptare.

## C.3 Evenimente de comerț electronic

Implementează evenimentele standard GA4, ca rapoartele din Analytics să funcționeze:

| Eveniment | Când |
|---|---|
| `view_item` | pagina de produs |
| `view_item_list` | listarea `/piese`, rezultatele de căutare |
| `select_item` | click pe un card de produs |
| `add_to_cart` / `remove_from_cart` | coș |
| `view_cart` | `/cos` |
| `begin_checkout` | `/checkout` |
| `purchase` | **doar după confirmarea comenzii**, cu `transaction_id` = numărul comenzii |
| `search` | căutarea din header |
| `generate_lead` | trimiterea formularelor de cerere piesă și predare mașină |

**Atenție la `purchase`:** trebuie trimis o singură dată per comandă. Dacă utilizatorul dă
refresh pe pagina de mulțumire, evenimentul nu se retrimite — altfel vânzările apar dublate.
Folosește un marcaj în `sessionStorage`, legat de numărul comenzii.

**Nu trimite date personale** în evenimente: fără nume, telefon, e-mail, adresă. Doar ID-uri
și valori.

## C.4 Ce NU face

- nu instala librării de analytics
- nu adăuga alte instrumente de urmărire
- nu trimite evenimente din `/admin`

## C.5 Ghid de configurare

Scrie `docs/google-analytics.md` cu pașii pe care îi face proprietarul: creare cont și
proprietate GA4, obținerea ID-ului, unde se lipește în Admin → Integrări, cum verifică în
raportul „Timp real" că funcționează, unde vede rapoartele de comerț electronic.

Scris pentru cineva fără cunoștințe tehnice.

---
---

# PARTEA D — E-MAIL (doar verificări de cod)

Configurarea DNS și redirecționarea le fac eu. Tu verifici doar partea din site:

1. `contact@autopas-dezmembrari.ro` apare **peste tot** din `settings`, nu hardcodat.
   Confirmă și listează locurile
2. Formularele de contact și de cerere **unde trimit acum**? Scriu doar în baza de date, sau
   încearcă și un e-mail? Raportează
3. Adaugă în `CLAUDE.md`, la „De configurat": redirecționarea
   `contact@autopas-dezmembrari.ro` → `pieseneamt@yahoo.ro`, plus înregistrările SPF și DMARC
   necesare
4. **Nu implementa trimitere de e-mail.** Nu e în sarcină

---
---

# PARTEA E — COMPLETARE AUTOMATĂ DIN TITLU ȘI DESCRIERE

## E.0 Situația

Pe pieseauto.ro, unele anunțuri **nu au setate** marca, categoria sau subcategoria. Vânzătorul
a scris doar un titlu, iar acolo se află toată informația:

```
"Motoras Etrier Spate Audi A4 B8 2.0 Tdi 2008 2009 2010 2011"
 └─ piesă ────────┘ └─ marcă+model ┘ └─motor┘ └─ ani ──────┘
```

Când datele structurate lipsesc, se extrag din **titlu**, iar dacă nu ajunge, din
**descriere**.

**Important: cele ~8.000 de piese sunt deja importate.** Deci nu e doar o regulă pentru
importurile viitoare — e nevoie și de o trecere retroactivă peste ce e deja în bază.

Titlul (`nume`) și descrierea (`stare_nota`) sunt deja salvate, deci completarea se face
**fără nicio cerere către pieseauto.ro**. Rulează în secunde, nu în ore.

## E.1 Măsoară întâi golurile — nu modifica nimic

```sql
select
  count(*)                                          as total,
  count(*) filter (where marca_id is null)          as fara_marca,
  count(*) filter (where model_id is null)          as fara_model,
  count(*) filter (where categorie_id is null)      as fara_categorie,
  count(*) filter (where subcategorie_id is null)   as fara_subcategorie,
  count(*) filter (where an_min is null)            as fara_ani
from products where sursa = 'pieseauto.ro';
```

(adaptează numele coloanelor la schema reală — verific-o, nu presupune)

**Raportează cifrele și oprește-te.** De ele depinde dacă merită efortul și pe ce ne
concentrăm.

## E.2 Ordinea surselor — nu se inversează niciodată

Pentru fiecare câmp, prima sursă disponibilă câștigă. Sursele de mai jos **nu suprascriu**
niciodată una de deasupra lor.

| Prioritate | Sursă | Observație |
|---|---|---|
| 1 | valoarea existentă în bază, dacă `editat_manual = true` | munca operatorului, intangibilă |
| 2 | date structurate de pe pagină (`q-car-model`, breadcrumb, URL canonic) | ce folosim deja |
| 3 | **titlul produsului** | noul nivel |
| 4 | **descrierea** (`stare_nota`) | ultimul nivel |
| 5 | gol + marcat pentru revizuire | **niciodată ghicit** |

**Regula absolută: dacă nu se poate determina cu certitudine, câmpul rămâne gol.** O piesă
fără marcă e o problemă mică; o piesă cu marca greșită e o vânzare pierdută și un client
nemulțumit. Am învățat asta deja: URL-ul canonic părea o sursă bună și a greșit modelul în
25 din 25 de cazuri verificate.

## E.3 Extragerea mărcii

Potrivire cu tabela `brands`, pe cuvinte întregi, cu:

- **normalizare fără diacritice și fără majuscule** — titlurile de pe pieseauto.ro sunt
  scrise „Vw Golf 5", „SKODA OCTAVIA", inconsecvent
- **tabel de sinonime**, fiindcă titlurile folosesc prescurtări: `Vw` → Volkswagen,
  `Mercedes` / `MB` → Mercedes-Benz, `Bmw` → BMW, `Vag` → *nu e marcă, ignoră*

**Construiește tabelul de sinonime pe date măsurate, nu din memorie.** Extrage primele două
cuvinte din toate cele 8.000 de titluri, numără frecvențele, și dă-mi lista celor care nu se
potrivesc cu nicio marcă din `brands`. Aprob eu ce intră în tabel.

Nu inventa mărci noi în `brands`. Dacă apare una care lipsește, raporteaz-o.

## E.4 Extragerea modelului

Doar **în cadrul mărcii deja găsite**. Fără marcă, nu se caută model.

- potrivire cu `models`, normalizat
- dacă titlul conține ani, folosește-i pentru a alege generația — mecanismul funcționează
  deja și a rezolvat 14 cazuri la eșantionul de 50
- **coduri de platformă**: titlurile scriu frecvent „Passat 3c B6", „Golf 1K". Codul e o a
  doua denumire a aceluiași model
  - construiește tabelul de coduri **pe date măsurate**: numără ce coduri apar efectiv în
    cele 8.000 de titluri și în câte
  - dă-mi lista, o aprob, abia apoi o folosești
  - la eșantionul de 50, singurul cod „străin" era `3c` pentru Passat B6

**Ambiguitate — cazul important:** un titlu ca „Far Stanga Bmw Seria 3 E90 E91" menționează
două generații. Verifică ce permite schema: dacă produsul are un singur `model_id`, alege-l
pe primul menționat **și marchează pentru revizuire**. Nu alege aleatoriu, nu alege ultimul.

Dacă apar două mărci diferite în același titlu, lasă gol și marchează — e mai probabil o
piesă compatibilă cu mai multe mașini decât o potrivire clară.

## E.5 Extragerea categoriei

Denumirea piesei stă aproape întotdeauna **la începutul titlului**, înainte de marcă:
`Motoras Etrier Spate | Audi A4 B8...`

- taie titlul la primul cuvânt care e o marcă recunoscută; ce rămâne în față e denumirea
- potrivește cu tabelul de reguli existent (`etriere` → Sistem de frânare / Etriere)
- **extinde tabelul pe date măsurate**: extrage denumirile din toate cele 8.000 de titluri,
  grupează-le, numără, și dă-mi lista celor fără potrivire, ordonată descrescător
- **eu aprob** fiecare regulă nouă, ca la importul inițial

**Pragul de creare a subcategoriilor:** acum vorbim de volumul final, nu de un eșantion.
Sub **10 piese**, pui categoria părinte și marchezi; peste, se poate crea subcategorie.

## E.6 Extragerea din descriere — ultimul nivel

Se folosește **doar** dacă titlul n-a dat nimic pentru un câmp.

Descrierea (`stare_nota`) e text liber, deci mai riscantă. Reguli:
- aceleași tabele de potrivire ca la titlu
- **doar potriviri neechivoce** — o singură marcă menționată, un singur model
- dacă descrierea menționează mai multe mașini (frecvent la piese compatibile), **nu extrage
  nimic** din ea
- tot ce vine din descriere se marchează pentru revizuire, fără excepție

## E.7 Marcarea a ce s-a dedus — obligatoriu

Coloană nouă pe `products` (migrare idempotentă, mi-o dai mie):

```
date_deduse jsonb
```

Exemplu de conținut: `{"marca":"titlu","model":"titlu","categorie":"regula:etriere"}`

**De ce contează:** peste trei luni, nimeni nu va mai ști ce a fost citit de pe pagină și ce
a fost dedus dintr-un șir de caractere. Dacă apare o piesă listată greșit, coloana asta spune
imediat dacă vina e la sursă sau la algoritm. Fără ea, orice corecție e o vânătoare oarbă.

Ecranul „Piese de completat" primește un filtru nou: **„cu date deduse"**, ca operatorul să
poată verifica prin eșantionare.

## E.8 Rularea retroactivă

Buton nou în admin, lângă import: **„Completează datele lipsă"**

- rulează **doar** pe piesele cu `sursa = 'pieseauto.ro'` și cel puțin un câmp gol
- **sare peste** piesele cu `editat_manual = true`
- **nu suprascrie niciodată** un câmp deja completat
- **nu face nicio cerere de rețea** — folosește doar ce e în bază
- previzualizare înainte de scriere: câte piese primesc marcă, câte model, câte categorie,
  plus **primele 30 de exemple cu titlul și ce s-ar extrage** din el
- confirmare explicită înainte de orice scriere
- reversibil: `date_deduse` permite anularea completărilor automate cu o singură comandă,
  dacă rezultatul e prost

## E.9 Integrarea în importul viitor

Aceleași reguli intră în `lib/import/potrivire.mjs`, ca lanț de rezervă, **după** sursele
structurate. Un singur motor — nu scrie logica de două ori.

Importurile viitoare vor completa automat, la sosire.

## E.10 Verificări

1. Rulare pe un eșantion de **50 de piese cu câmpuri goale**, cu tabelul complet
   titlu → ce s-a extras, pentru verificare manuală. **Oprire.**
2. Rulare de două ori: a doua nu schimbă nimic (idempotență)
3. O piesă cu `editat_manual = true` rămâne neatinsă
4. Un câmp deja completat nu se suprascrie niciodată
5. Zero cereri de rețea, confirmat
6. Cifrele înainte/după pentru fiecare câmp

**Oprește-te după E.10 cu raportul.**

---
---

# RAPORT FINAL

1. Cifrele de la E.1, înainte și după
2. Lista sinonimelor de marcă, a codurilor de platformă și a regulilor de categorie —
   toate pe date măsurate, pentru aprobarea mea
3. Tabelul de verificare manuală de la E.10, punctul 1
4. Rezultatele celor 7 verificări de la A.7
5. Ce ai găsit la B.0 — legătura piese ↔ mașini și cauza celor „0 piese"
6. Propunerea pentru tabelul de platforme (B.3, nivelul 3)
7. Propunerea pentru legarea pieselor de mașini în admin (B.4)
8. Ce face bannerul de cookie-uri acum și cum ai legat GA de el
9. Locurile unde apare adresa de e-mail
10. Migrările SQL, de rulat de mine
11. Capturi pe ambele teme: hello bar în vacanță, pagină de mașină, carusel
12. Orice problemă găsită și **nereparată**, cu motivul