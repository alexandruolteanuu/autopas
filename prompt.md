# SARCINĂ: import complet din admin · temă luminoasă · corectare politică de retur

Trei părți, **cu oprire între ele**. Nu le amesteca.
Branch `main`. Site: `autopas-dezmembrari.ro`.

**Context nou:** Supabase trece pe plan Pro, deci limita de 1 GB stocare nu mai e o
constrângere. Toate pozele se descarcă la import.

---

## REGULA DE AUR

Nu se schimbă: prețurile, datele produselor, datele firmei, logica de comenzi, rutele,
fontul Poppins (max 700), bannerele ANPC, paleta `.tema-clasica` din `/admin`.

Tot ce se modifică vizual rămâne verificat la 13 lățimi:
`320, 360, 375, 390, 414, 428, 480, 640, 768, 834, 1024, 1280, 1440`.

Migrările SQL **nu le rulezi tu** — mi le dai mie, le rulez în Supabase → SQL Editor.

---
---

# PARTEA A — IMPORT COMPLET DIN ADMIN

## A.0 Schimbarea de regulă

**Piesele importate se publică direct, cu poze, indiferent ce altceva le lipsește.**

1. `publicat = true` din momentul importului
2. Greutatea: **1 kg automat**, `greutate_estimata = true`. Nu se cere nimănui completare
   în avans. Se cântărește la formarea coletului, în pasul „Cost livrare" din comandă
3. Regula din C.10 care interzicea publicarea fără poze, categorie și greutate **se
   elimină**. Nu mai blochează nimic
4. **Pozele se descarcă în timpul importului**, ca parte din procesarea fiecărei piese —
   nu la publicare, fiindcă publicarea nu mai e un pas separat
5. Dacă descărcarea pozelor eșuează pentru o piesă, piesa **se publică oricum**, fără poze,
   și se notează în `import_erori`. La final, buton „Reia pozele eșuate"

**Ecranul „Piese de completat" rămâne, dar își schimbă rolul:** nu mai e o poartă, e o listă
de lucru. Arată piesele publicate cărora le lipsește ceva (poză, categorie, greutate reală),
sortabil după ce lipsește, ca operatorul să le îmbunătățească când are timp.

**Ce NU se schimbă:** avertismentul din „Cost livrare". Dacă vreo piesă din comandă are
`greutate_estimata = true`, bandă galbenă vizibilă:
> „Greutate estimată — cântărește coletul înainte de a genera AWB."

Ăsta e singurul lucru care nu se negociază. E ce ține factura de la FAN Courier corectă.

## A.1 Importul rulează din admin, nu din Codespace

**Eu nu intru în Codespace pentru client.** Interfața trebuie să ducă și importul complet
de 8.000, și sincronizările curente.

**Constrângerea:** ~4,5 ore de descărcare nu pot sta într-un tab deschis.

### Arhitectura — starea în DB, nu în browser

1. La confirmare se creează un rând în `import_jobs` cu status `in_curs` și poziția curentă
2. Fișierul CSV se salvează în Supabase Storage, **bucket privat**, legat de job. Altfel nu
   se poate relua fără reîncărcare
3. Browserul cere loturi mici (50 de piese) printr-un endpoint. Fiecare lot:
   - se procesează în sub 30 de secunde
   - actualizează `procesate` în `import_jobs`
   - întoarce progresul
   Fiecare lot e o cerere separată, deci nu atinge limita de timp a funcțiilor serverless
4. **Dacă tabul se închide**, jobul rămâne `in_pauza`. La redeschiderea ecranului se
   detectează automat și apare butonul „Continuă importul (3.412 din 8.147)"
5. Un singur job activ per sursă. Alt job pornit → refuz cu mesaj clar
6. Ecranul arată: procesate / total, piese noi, erori, timp scurs, timp estimat rămas.
   Plus buton „Oprește" care pune jobul în pauză curat
7. Loturile eșuate se notează și se sar — importul continuă. Buton „Reia eșuările" la final

## A.2 Un singur motor, două declanșatoare

Scriptul din `scripts/import-pieseauto.mjs` și interfața din admin folosesc **același cod de
extragere și aceleași reguli**. Extrage logica într-un modul comun (`lib/import/`) apelat de
amândouă.

**Spune-mi cum propui să eviți duplicarea ÎNAINTE să scrii.** Două implementări care se
despart în timp sunt sursă clasică de bug-uri imposibil de găsit.

## A.3 Feed-ul e mereu complet

Clientul poate genera **doar** feed complet: la fiecare import vor fi cele ~8.000 plus cele
noi. Nu există feed parțial în uz normal.

**Consecințe:**

1. **Depublicarea e pornită implicit.** O piesă lipsă din feed înseamnă vândută pe
   pieseauto.ro, deci se depublică

2. **Protecție anti-fișier-trunchiat:** dacă piesele lipsă depășesc **20%** din câte sunt în
   bază cu `sursa='pieseauto.ro'`, oprește-te înainte de confirmare și cere confirmare
   suplimentară:
   > „Fișierul ar depublica X din Y piese (Z%). Pare un export incomplet. Continui?"

   Sub 20%, depublicarea se aplică fără întrebări. Un magazin de dezmembrări vinde constant,
   deci 50–200 de piese dispărute între importuri e normal. 1.600 nu e o zi bună de vânzări,
   e un export stricat

3. **Depublicarea nu șterge.** `sursa_activ = false`, `publicat = false`, rândul rămâne.
   Dacă piesa reapare în feed, `sursa_activ` redevine `true`, dar `publicat` rămâne cum l-a
   lăsat operatorul

4. **Performanța e cheia.** Din 8.000 de rânduri, doar cele noi cer descărcarea paginii.
   Restul se compară exclusiv din CSV, după `sursa_id`, fără nicio cerere HTTP. Prețul se
   ia din coloana CSV, nu din pagină. Un import fără piese noi trebuie să dureze **secunde**

5. **Previzualizarea distinge clar:**
   - „De actualizat (preț) — instant"
   - „Noi — necesită descărcare, ~X minute"

## A.4 Rămâne neschimbat

- pauza de 1,5–2s între cereri către pieseauto.ro, fără paralelizare
- `User-Agent` identificabil
- detectarea refuzurilor (HTTP 200 cu `?action=sorry`)
- canarul din C.7: peste 20% pagini fără poze → oprire
- poze **doar** din array-ul `images`, zero căutare alternativă în DOM
- model din `q-car-model`, categorie din URL, verificare încrucișată pe titlu
- nu se importă garanția, returul și textul de livrare de pe pieseauto.ro
- fără librării noi, fără scriere în DB înainte de confirmare

## A.5 Raportare

Consumul de stocare la fiecare 1.000 de piese procesate. Nu opri importul, doar raportează.

## A.6 Verificare Partea A, apoi OPREȘTE-TE

1. Import de test pe cele 50 existente: idempotent, 0 rânduri noi la a doua rulare
2. Închizi tabul la jumătate, redeschizi, „Continuă" reia corect
3. O piesă editată manual rămâne intactă la reimport
4. Protecția de 20% se declanșează pe un fișier trunchiat de probă
5. `npm run build` trece

---
---

# PARTEA B — TEMĂ LUMINOASĂ

Tema actuală devine **„Întunecat"**. Se adaugă **„Luminos"**, comutabilă din header.

**Cerința clientului:** hero alb, zonele negre păstrate, gri acceptat.

## B.0 Problema centrală — galbenul pe alb

`#F2B705` pe alb dă **1,82:1**. Ca text e ilizibil; ca fundal de buton, marginea butonului e
practic invizibilă (sub pragul de 3:1 cerut pentru contururile componentelor).

**Soluția: galbenul primește trei roluri distincte**, prin două variabile noi care se adaugă
în AMBELE teme:

| Variabilă | Rol | Întunecat | Luminos |
|---|---|---|---|
| `--accent` | umpluturi: butoane, badge-uri | `#F2B705` | `#F2B705` |
| `--accent-text` | galben folosit ca TEXT | `#F2B705` | `#8A6A08` |
| `--accent-chenar` | chenar pentru umpluturi galbene | `#F2B705` | `#A8820A` |

Valori verificate: `#8A6A08` pe alb = **5,07:1** (trece pragul de 4,5 pentru text normal).
`#A8820A` pe alb = **3,58:1** (trece pragul de 3 pentru contururi).

**Consecință obligatorie:** pe tema luminoasă, butonul galben primește
`border: 1px solid rgb(var(--accent-chenar))`. Fără el, butonul n-are margine vizibilă.

Prețurile, linkurile și starea activă din navigație folosesc `--accent-text`, nu `--accent`.
Pe tema întunecată nu se schimbă nimic — cele două variabile sunt egale cu `--accent`.

## B.1 Paleta „Luminos"

```css
--fundal:            247 247 245;   /* #F7F7F5 — alb cald, nu alb pur */
--suprafata:         255 255 255;   /* #FFFFFF — cardurile ies din fundal */
--suprafata-2:       240 239 236;   /* #F0EFEC */
--text:               18  18  18;   /* #121212 — 18,7:1 pe alb */
--text-secundar:      92  92  92;   /* #5C5C5C — 6,7:1 pe alb */
--chenar:            226 225 221;   /* #E2E1DD — decorativ */
--chenar-puternic:   138 138 133;   /* #8A8A85 — 3,45:1, inputuri și butoane */
--accent:            242 183 5;     /* #F2B705 — doar umpluturi */
--accent-hover:      214 160 4;     /* #D6A004 */
--accent-contrast:    16  16  16;   /* #101010 — text pe galben, 10,47:1 */
--accent-text:       138 106 8;     /* #8A6A08 — galben ca text, 5,07:1 */
--accent-chenar:     168 130 10;    /* #A8820A — chenar umpluturi, 3,58:1 */
--header-bg:           0   0   0;   /* negru — „zonele negre" */
--header-text:       255 255 255;
--footer-bg:           0   0   0;
--footer-text:       171 171 171;
--camp-bg:           247 247 245;   /* #F7F7F5 — scobit față de cardul alb */
--imagine-bg:        244 243 240;   /* #F4F3F0 */
--umbra:               0   0   0;
--sticla-bg:         255 255 255;
--sticla-chenar:     226 225 221;
--sticla-opacitate:  .78;
```

**De ce `#F7F7F5` și nu alb pur pentru fundal:** cardurile sunt albe. Alb pe alb = zero
separare. Fundalul ușor cald citește tot ca „alb", dar lasă cardurile să iasă. Și se
armonizează cu `--imagine-bg`, care e deja în familia caldă.

**Umbrele:** pe tema luminoasă funcționează și devin instrumentul principal de adâncime
(invers față de tema întunecată, unde adâncimea se face prin chenar mai deschis). Păstrează
scara existentă de două straturi.

## B.2 Comutatorul

- iconiță soare/lună în header, lângă grupul cont/coș, `shrink-0`, țintă 44px
- pe mobil rămâne în header — e o singură iconiță, nu lățește nimic
- alegerea se salvează în `localStorage`, cheia `autopas-tema`
- **implicit: Întunecat**, dacă nu există nimic salvat

**Script anti-flash obligatoriu**, în `<head>` din `app/layout.tsx`, înainte de `<body>`:
```html
<script>(function(){try{var t=localStorage.getItem('autopas-tema');
if(t==='luminos'){document.documentElement.setAttribute('data-tema','luminos');}
}catch(e){}})();</script>
```
Fără el, la fiecare reîncărcare pagina apare o clipă întunecată și apoi sare.

**`color-scheme`:** `dark` pe `:root`, `light` pe `[data-tema="luminos"]`. Fără asta, barele
de defilare și controalele native rămân în varianta greșită.

**`theme-color`:** `#000000` pe ambele — headerul e negru în amândouă.

**`prefers-color-scheme`:** nu îl folosi ca implicit. Clientul vrea întunecatul ca standard,
indiferent de setarea sistemului.

## B.3 Ce trebuie verificat vizual pe tema luminoasă

Ilustrațiile `PartArt` au fundalul `#ECE9E2` scris direct în SVG, cu trasee închise. Pe
`--imagine-bg` la `#F4F3F0` vor fi foarte apropiate, dar nu identice. **Uită-te la
`/piese` și spune-mi dacă se vede muchia.** Nu o repara singur.

Bannerele ANPC: pe fundal luminos ar trebui să arate mai natural decât pe negru. Containerul
cu `p-3` rămâne — verifică doar că nu arată redundant.

Logoul: e PNG cu fundal transparent, deci merge pe ambele. **Confirmă vizual** — dacă e
gândit pentru fundal întunecat, pe alb ar putea pierde contrast.

## B.4 Verificare Partea B, apoi OPREȘTE-TE

1. `node scripts/verifica-contrast.mjs` trece pe **ambele** teme, cu ambele adăugate în script
2. Comutarea e instantanee, fără flash la reîncărcare
3. Butoanele galbene au chenar vizibil pe tema luminoasă
4. Zero text galben pe fundal alb — toate au trecut pe `--accent-text`
5. Scanarea responsive trece pe ambele teme
6. `.tema-clasica` din `/admin` neafectată de comutator
7. Capturi: home, `/piese`, o pagină de produs, `/cos`, footer — pe ambele teme

---
---

# PARTEA C — POLITICA DE RETUR

## C.0 Ce trebuie știut înainte

Textele legale sunt documente cu valoare juridică. **Nu le rescrie din proprie inițiativă.**

Art. 13 alin. (1) din OUG 34/2014 prevede că profesionistul rambursează toate sumele primite,
**inclusiv costurile livrării**. Nu e opțional și nu poate fi modificat prin termeni proprii.

Ce firma **nu** suportă, legal, e transportul de **retur** — acela e în sarcina clientului,
dacă a fost informat în avans.

**Deci sarcina nu e să elimini rambursarea transportului, ci să clarifici distincția.**

## C.1 Găsește

Caută în `lib/legal.ts` (cele 8 documente), în `/faq`, în paginile de produs, în checkout, în
formularul de retur și oriunde altundeva:

- orice mențiune despre rambursare, retur, retragere, transport returnat
- termeni: „rambursăm", „restituim", „costurile de transport", „taxa de transport",
  „cheltuielile de livrare"

**Raportează fiecare apariție**, cu fișier, linie și textul exact. **Nu modifica nimic încă.**

## C.2 Pentru fiecare apariție, spune-mi în ce categorie intră

| Categorie | Ce e |
|---|---|
| **Corectă** | spune că se rambursează produsul + transportul inițial |
| **Ambiguă** | nu distinge între transportul dus și cel de retur |
| **Incorectă** | spune că nu se rambursează transportul inițial → încalcă art. 13 |

## C.3 Textul propus — pentru aprobarea mea

Propune o formulare care spune explicit, într-un singur loc:
- ce se rambursează: contravaloarea produsului **și** costul livrării standard inițiale
- ce nu se rambursează: transportul de retur, suportat de client
- excepția din art. 13 alin. (3): dacă clientul a ales o livrare mai scumpă decât cea
  standard, diferența nu se rambursează
- distincția față de garanție: la produs neconform, firma suportă toate costurile

**Nu implementa. Dă-mi propunerea, o verific cu clientul.**

## C.4 Interdicție

Nu scrie niciun text care limitează rambursarea costurilor de livrare inițiale. Dacă
instrucțiunea pe care o primești pare să ceară asta, oprește-te și întreabă.

---
---

# RAPORT FINAL

1. Arhitectura codului comun de import (A.2) — propunere, înainte de implementare
2. Rezultatele celor 5 verificări de la A.6
3. Tabelul de contrast pe ambele teme
4. Capturi pe ambele teme: home, `/piese`, pagină produs, `/cos`, footer
5. Ce ai găsit la `PartArt`, ANPC și logo pe tema luminoasă
6. Lista completă a aparițiilor din C.1, cu categoria fiecăreia
7. Propunerea de text pentru C.3
8. Consumul de stocare estimat pentru cele 8.000
9. Orice problemă găsită și **nereparată**, cu motivul