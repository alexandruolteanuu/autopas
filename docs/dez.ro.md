# Anunțurile pe dez.ro — cum se pornește și cum se ține în viață

dez.ro e un site de anunțuri de piese auto. Ne-au dat o **cheie de aplicație**
(API key) și documentația API-ului (`docs/dez.ro/`). Prin ea, piesele publicate pe
site-ul nostru ajung acolo ca anunțuri, cu poze, preț și descriere; prețul se ține
la zi singur, iar anunțul unei piese vândute se retrage automat.

De ce contează retragerea automată: piesele noastre sunt **unicat**. Un anunț
rămas în aer pentru o piesă vândută înseamnă un telefon degeaba și un cumpărător
supărat — la a treia oară, oamenii nu mai sună.

---

## Ce mai lipsește ca să pornească

Codul e gata și verificat. **Un singur lucru lipsește: contul de pe dez.ro.**

Cheia API o avem, e deja salvată, catalogul lor e adus (106 mărci, 2.671 de
modele, 573 de categorii) și potrivirile automate sunt făcute. Ce trebuie
completat în
**Admin → Integrări → „dez.ro — anunțuri"**:

| Câmp | De unde |
|---|---|
| Utilizator dez.ro | contul cu care te loghezi pe dez.ro |
| Parolă dez.ro | parola aceluiași cont |

⚠️ **Județul și localitatea NU se trimit din cod.** Ei le iau din profilul
contului de pe dez.ro (așa scrie în ghidul lor: *„Location is resolved
automatically from the user's profile"*). Deci înainte de prima publicare,
verifică pe dez.ro, în profilul contului, că adresa e cea din Bistrița, com.
Alexandru cel Bun — altfel toate cele ~8.700 de anunțuri vor arăta alt județ.

Tot de acolo se ia și **telefonul afișat pe anunț**. Verifică-l în același loc.

---

## Ordinea pașilor, o singură dată

Din **Admin → Anunțuri dez.ro**, de sus în jos. Fiecare pas are nevoie de cel
dinainte.

### 1. Testează conexiunea
Se autentifică și întreabă câte anunțuri sunt pe cont. Nu scrie nimic la ei.
Dacă răspunde „Date de autentificare invalide", utilizatorul sau parola sunt
greșite — **nu apăsa de cinci ori**: ei limitează autentificările eșuate la 5 la
15 minute.

### 2. Adu catalogul dez.ro
Mărcile, modelele și categoriile lor. Durează câteva minute (măsurat: ~4 minute)
și se face în trepte, fiindcă arborele întreg într-o singură cerere pică la ei.
Se poate lăsa în fundal; dacă închizi tabul, apeși din nou și continuă de unde a
rămas.

Se reia **când ei își schimbă catalogul**. Nu e nevoie mai des de o dată la
câteva luni.

### 3. Potrivește automat
Leagă catalogul nostru de al lor. **Rulat deja pe producție, 7 septembrie 2026**:
836 de potriviri scrise, 104 rămase de confirmat de om (3 mărci, 38 de modele,
63 de categorii).

Ce înseamnă asta pentru piese: **8.209 din 8.825 sunt gata de trimis fără să mai
facă nimeni nimic.** Restul de 616: 350 au modelul nepotrivit, 163 categoria, 120
n-au niciun model de mașină, 1 n-are poză.

Cele 270 de traduceri de categorii scrise de mână în cod (`REGULI_CATEGORII` din
`lib/dezro/potrivire.mjs`) sunt cele care fac diferența — singure acoperă 98,2%
din piese.

### 4. Confirmă potrivirile rămase
Tabelul „Potriviri de confirmat" arată **doar** ce are nevoie de om. Fiecare rând
are propunerea automată cu scorul ei; alegi din listă și salvezi.

Ce confirmi rămâne confirmat: potrivirea automată nu mai calcă niciodată peste o
alegere făcută de om — nici măcar peste „nu are corespondent".

De ce contează scorul: „Range Rover Evoque" seamănă destul de mult cu „Range
Rover" ca să treacă neobservat, dar sunt două mașini. De asta tot ce e sub 88 de
puncte așteaptă un om.

### 5. Publică o piesă de probă
Trimite **o singură** piesă. Verifică-l în contul tău de pe dez.ro: titlul,
pozele, prețul, categoria, localitatea.

⚠️ **Anunțurile trimise prin API NU apar pe loc pe site — trec printr-o aprobare
la ei.** Documentația lor spune de trei ori contrariul („approved is always true
for API-created ads", „The ad is immediately visible on the site", „For
API-created ads pending should always be 0"), dar primul anunț real, trimis la
7 septembrie 2026, s-a întors cu `approved: false` și fără adresă publică, iar
`GET /ads?count` a răspuns `{total:1, approved:0, pending:1}`.

Ce înseamnă asta în practică:
- adresa publică a anunțului nu există în clipa trimiterii; apare după aprobare;
- butonul **„Actualizează starea anunțurilor"** din panou recitește lista lor și
  scrie înapoi cine e publicat și cu ce adresă. Se apasă după ce ei au aprobat.
- dacă aprobarea durează sau nu vine, e o discuție cu ei, nu ceva de reparat la
  noi.

### 6. Prima publicare mare — din terminal, nu din panou

```bash
node scripts/publica-dezro.mjs
```

Motivul e același ca la importul din pieseauto.ro: ecranul cere un lot pe HTTP,
deci recitește catalogul și mapările la fiecare lot — la ~8.700 de piese sunt
vreo 350 de loturi. Scriptul citește totul o dată și merge până la capăt.

Ecranul din panou rămâne pentru **întreținerea de zi cu zi**: piese noi, prețuri
schimbate, anunțuri de retras. Acolo sunt puține de făcut la fiecare rulare,
fiindcă ce n-are nimic schimbat nu se atinge deloc.

---

## Ce se trimite într-un anunț

| Câmpul lor | De la noi |
|---|---|
| `title` | numele piesei, tăiat la 100 de caractere la marginea unui cuvânt |
| `description` | descrierea piesei + anii + compatibilitățile + codul intern |
| `type` | mereu 0 („Piese Auto") |
| `idBrand` / `idModel` | din maparea modelului principal al piesei |
| `idPart` | din maparea categoriei (subcategoria, dacă există) |
| `price` | prețul, rotunjit la leu |
| `qty` | stocul |
| `variant` | **generația** („Passat B6") — catalogul lor e plat, doar „Passat" |
| `year` | doar dacă e neîndoielnic (vezi mai jos) |
| `oem` | dacă îl avem (azi: la nicio piesă) |
| `images[]` | pozele piesei, cel mult 10 |

**Anul trimis e PRIMUL din interval.** 8.695 din cele 8.825 de piese au în `ani`
un *interval* („2008–2011"), iar câmpul lor primește *un* an.

Prima variantă a fost să nu trimitem niciun an, ca să nu inventăm o valoare.
Moderatorul lor, verificând primul anunț, a spus: *„categoria e ok, marca ok,
modelul ok, prețul ok, titlul ok — nu avem an"*. Un an lipsă nu e neutru:
anunțul nu apare în nicio căutare filtrată pe an. Primul an al intervalului e o
valoare adevărată, luată din datele sursei, iar intervalul întreg rămâne scris
în descriere.

**De întrebat la ei**, ca să știm dacă mai e ceva de făcut: filtrul lor pe an
caută exact valoarea trimisă, sau un interval în jurul ei?

**Descrierea nu conține niciun link către site-ul nostru.** Pe orice portal de
anunțuri, un link care trimite cumpărătorul în altă parte e motiv de respingere
sau de suspendare a contului. Codul intern („AP-000123") face aceeași treabă:
clientul îl spune la telefon și piesa se găsește imediat.

---

## Ce NU se publică

O piesă e sărită, cu motivul numărat în panou, dacă:

- n-are nicio poză (azi: 1 piesă);
- n-are model de mașină (azi: 120);
- modelul sau categoria ei nu sunt potrivite cu nimic de la ei — se rezolvă la
  pasul 4.

Piesele sărite nu sunt erori. Ecranul le numără pe motive, ca să se vadă ce mai e
de completat.

---

## Sincronizarea automată (de la 9 septembrie 2026)

**Nu mai trebuie apăsat nimic pentru piesele de zi cu zi.** Baza de date anunță
singură site-ul la fiecare piesă adăugată, modificată, vândută sau ștearsă, iar
anunțul pleacă, se actualizează sau se stinge în câteva secunde.

De ce contează mai ales retragerea: piesele noastre sunt unicat. Între două
apăsări de buton, un anunț rămas în aer pentru o piesă vândută înseamnă un
telefon degeaba.

### Ce trebuie pus o singură dată

**Admin → Integrări → „dez.ro — anunțuri"**, ultimele două câmpuri:

| Câmp | Ce se pune |
|---|---|
| Sincronizare automată: adresa chemată de baza de date | `https://autopas-dezmembrari.ro/api/dezro-coada` |
| Secretul acelei adrese | un șir lung, inventat de tine (ex. din `openssl rand -hex 24`) |

Adresa TREBUIE să înceapă cu `https://` — câmpul refuză altceva. Regula vine de
la incidentul de la e-mail din 7 septembrie 2026, când în câmpul echivalent
ajunsese o adresă de e-mail și coada a rămas blocată nevăzută.

Secretul nu se pune nicăieri altundeva: ruta îl citește din aceeași setare.
Cât timp cele două câmpuri sunt goale, triggerele scriu oricum în coadă și nu se
pierde nimic — totul pleacă la prima trezire de după completare.

### Cum se vede că merge

**Admin → Anunțuri dez.ro → „4b. Sincronizarea automată"**: câte piese așteaptă,
câte s-au blocat după 5 încercări, ultima eroare. Butonul **„Sincronizează acum"**
e cârligul de recuperare — trezirea din baza de date e fire-and-forget, deci dacă
site-ul era în timpul unui deploy exact atunci, rândul rămâne în coadă și n-are
cine să-l ia.

### Ce oprește o ștergere în masă

Aceeași plasă de **20%** ca la publicarea mare, dar aici e mai importantă: la
buton omul citește un avertisment, aici nu apasă nimeni nimic. Dacă un
`update products set publicat = false` dat din greșeală ar duce la retragerea a
peste 20% dintre anunțurile active, sincronizarea **se oprește singură** și scrie
în panou de ce. Se reia doar cu butonul „Am verificat, retrage anunțurile".

Piesele ȘTERSE din bază se numără separat în plasa asta: rândul lor din
`dezro_anunturi` pleacă odată cu piesa (`on delete cascade`), deci n-ar mai apărea
în numărătoarea obișnuită. Triggerul copiază id-ul anunțului în coadă înainte de
ștergere — altfel anunțul ar rămâne pentru totdeauna la ei, fără să mai știm nici
măcar că există.

### Ce NU declanșează o resincronizare

Lista de coloane urmărite de trigger e exact ce intră în anunț, plus `publicat`.
`vizualizari` NU e în listă, și e cel mai important lucru din ea: crește la
fiecare deschidere a unei pagini de piesă, deci fără filtru fiecare vizitator ar
pune o piesă în coadă. Cine adaugă un câmp nou în anunț îl adaugă și în trigger
(`supabase/dezro-automat.sql`).

---

## Întreținerea

Sincronizarea automată acoperă ziua obișnuită. **Pornește publicarea** rămâne
pentru resincronizări complete — după ce s-au confirmat potriviri noi, după o
schimbare de reguli, sau dacă ai o îndoială. Face trei lucruri, în ordine:

1. **trimite** piesele care nu-s încă la ei;
2. **actualizează** ce s-a schimbat (preț, descriere, poze);
3. **retrage** anunțurile pieselor vândute sau depublicate.

Ce n-are nimic schimbat nu costă nicio cerere: se compară o amprentă a
câmpurilor. La a doua rulare consecutivă, fără modificări, nu pleacă absolut
nimic către ei.

### Plasa de la retragere

Dacă ar dispărea **peste 20%** din anunțurile active dintr-o dată, publicarea se
oprește și cere confirmare separată. Motivul: la ei ștergerea unui anunț **nu se
poate desface prin API**. O depublicare în masă făcută din greșeală la noi ar
stinge tot ce avem acolo, iar refacerea ar însemna 8.700 de anunțuri noi, cu alte
adrese.

Aceeași plasă ca protecția anti-fișier-trunchiat de la importul din pieseauto.ro,
și din același motiv.

---

## Când ceva nu merge

| Ce vezi | Ce înseamnă |
|---|---|
| „Date de autentificare invalide" | utilizator/parolă greșite. Nu insista: 5 încercări la 15 minute. |
| „Prea multe autentificări eșuate" | ai depășit limita. Aștepți 15 minute. |
| 500 / 504 la aducerea catalogului | hopuri de-ale lor. Se reîncearcă singur de 3 ori; dacă tot pică, mai încearcă peste o oră. |
| „Invalid part id" la publicare | o mapare arată spre o categorie care nu mai există la ei. Reia pasul 2, apoi 4. |
| Anunțuri trimise, dar `pending` la ei | normal: trec printr-o aprobare. Vezi pasul 5. |
| Anunțuri cu status „eroare" în panou | fiecare are eroarea scrisă. Reporni publicarea le reîncearcă. |

Verificarea regulilor, fără rețea și fără bază de date:

```bash
node scripts/verifica-dezro.mjs
```

Se rulează **după orice modificare în `lib/dezro/`**. 63 de verificări: invariantul
de timp al unui lot, potrivirea modelelor, traducerile aprobate, ce se trimite
într-un anunț, amprenta, diferența de poze, ce nu se publică, retragerea.

---

## Unde stau lucrurile

| Ce | Unde |
|---|---|
| Motorul (toate regulile) | `lib/dezro/` — vezi `lib/dezro/README.md` |
| Ecranul operatorului | `app/admin/dezro/page.tsx` + `components/admin/DezroPotriviri.tsx` |
| Ruta de server | `app/api/dezro/route.ts` |
| Scriptul din terminal | `scripts/publica-dezro.mjs` |
| Sincronizarea automată | `supabase/dezro-automat.sql` (migrarea 39) + `app/api/dezro-coada/route.ts` |
| Verificările | `scripts/verifica-dezro.mjs` |
| Tabelele | `supabase/dezro.sql` (migrarea 37) |
| Secretele | `settings.integrari.dezro` — cheia, contul, token-ul de sesiune |
| Documentația lor | `docs/dez.ro/` (PDF-urile primite de la ei) |
