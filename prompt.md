# SARCINĂ: tema definitivă „Atelier, galben industrial" + eliminarea selectorului de teme

## Context

Clientul s-a hotărât. A ales tema **`atelier-galben`** („Atelier, galben industrial") — negru
cu accent galben.

Două lucruri de făcut:
1. Tema aceasta devine tema unică și definitivă a site-ului.
2. Selectorul temporar de teme din header se elimină complet, cu tot ce ține de el.

Lucrăm pe branch-ul `main`.

---

## REGULA DE AUR — citește-o de două ori

**Sistemul de variabile CSS RĂMÂNE. Se elimină doar posibilitatea de a comuta între teme.**

Cu alte cuvinte: `--accent`, `--fundal`, `--suprafata` și restul variabilelor rămân exact
unde sunt și se folosesc în continuare peste tot în cod. Se șterg doar blocurile
`[data-tema="..."]` și mecanismul de comutare.

**NU înlocui variabilele cu valori hexa scrise direct în componente.** Adică nu transforma
`bg-accent` în `bg-[#F2B705]`. Dacă faci asta, pierdem posibilitatea de a schimba o culoare
dintr-un singur loc, iar dacă mâine clientul vrea galbenul cu o nuanță mai închisă, ajungem
din nou la sute de fișiere de modificat.

Dacă vreun pas de mai jos ți se pare că cere înlocuirea variabilelor cu hexa, ai înțeles
greșit — oprește-te și întreabă-mă.

**Nu se schimbă:** layoutul, textele, prețurile, logica, rutele, migrările SQL, fontul
Poppins, bannerele ANPC din `public/`.

---

## ETAPA 0 — INVENTAR (nu modifica nimic)

Caută în tot repo-ul (fără `node_modules`, `.next`) și raportează unde apare fiecare:

- `SelectorTeme` · `lib/teme` · `SELECTOR_TEME_ACTIV`
- `data-tema` · `dataset.tema` · `autopas-tema` · `setAttribute('data-tema'`
- `optgroup`
- comentariile marcate `TEMPORAR`
- blocurile `[data-tema=` din `app/globals.css`

Raportează-mi lista **și oprește-te**. Vreau să văd ce se atinge înainte să ștergi ceva.

---

## ETAPA 1 — PROMOVAREA TEMEI ÎN `:root`

În `app/globals.css`, blocul `:root` primește valorile temei `atelier-galben`.
Valorile sunt date mai jos deja convertite în canale RGB — copiază-le exact, nu recalcula.

```css
:root {
  --fundal:           16 16 16;      /* #101010 */
  --suprafata:        25 25 25;      /* #191919 */
  --suprafata-2:      36 36 36;      /* #242424 */
  --text:            255 255 255;    /* #FFFFFF */
  --text-secundar:   171 171 171;    /* #ABABAB */
  --chenar:           42 42 42;      /* #2A2A2A */
  --accent:          242 183 5;      /* #F2B705 */
  --accent-hover:    214 160 4;      /* #D6A004 */
  --accent-contrast:  16 16 16;      /* #101010 — text ÎNCHIS peste galben */
  --header-bg:         0 0 0;        /* #000000 */
  --header-text:     255 255 255;    /* #FFFFFF */
  --footer-bg:         0 0 0;        /* #000000 */
  --footer-text:     171 171 171;    /* #ABABAB */
}
```

**Atenție la `--accent-contrast`.** Este `#101010`, deci **negru pe galben**. Text alb pe
galbenul `#F2B705` are contrast 1,8:1 — practic ilizibil. Dacă găsești undeva în cod
`text-white` scris direct pe un buton de accent, înlocuiește cu `text-accentText`.

Apoi **șterge toate blocurile `[data-tema="..."]`** din `app/globals.css` — toate nouă,
inclusiv `[data-tema="atelier-galben"]`, pentru că valorile lui sunt acum în `:root`.

---

## ETAPA 2 — ELIMINAREA SELECTORULUI

1. **Șterge fișierele:**
   - `components/SelectorTeme.tsx`
   - `lib/teme.ts`

2. **`lib/config.ts`:** șterge constanta `SELECTOR_TEME_ACTIV` și comentariul de deasupra ei.
   Verifică să nu mai fie importată nicăieri.

3. **Componenta de header:** șterge importul, randarea componentei și comentariul marcat
   `TEMPORAR`. Verifică apoi că spațierea din header rămâne corectă — dacă selectorul era
   într-un `gap`, s-ar putea să rămână un gol.

4. **Fâșia de sub header de pe telefon** (adăugată pentru selector, sub 768px) se elimină
   complet, cu tot containerul ei. Verifică să nu rămână un element gol care ocupă înălțime.

5. **`app/layout.tsx`:** șterge scriptul anti-flash din `<head>` (cel cu
   `dangerouslySetInnerHTML` care citea `localStorage`). Nu mai are rost — tema e în `:root`
   de la prima pictare a paginii, deci nu mai există flash.

6. **Nivelul 20 din scara de `z-index`** era rezervat fâșiei de teme. Îl eliminăm din
   documentație, dar **nu renumerota celelalte niveluri** — ar însemna atingerea inutilă a
   multor fișiere.

7. **Despre `localStorage`:** unii vizitatori au deja cheia `autopas-tema` salvată în
   browser. **Nu e nevoie de curățare.** Odată ce scriptul care o citea a dispărut, nimeni
   nu o mai consultă, iar atributul `data-tema` nu mai ajunge niciodată pe pagină. Cheia
   rămâne acolo, inertă. Nu scrie cod de ștergere — ar fi cod în plus fără efect.

8. **`CLAUDE.md`:** șterge secțiunea „TEMPORAR — selector teme" cu instrucțiunile de
   ștergere. În locul ei scrie o linie scurtă în secțiunea de decizii:
   *„Temă definitivă: Atelier, galben industrial (negru + #F2B705). Culorile se modifică
   exclusiv din blocul `:root` din `app/globals.css`."*

---

## ETAPA 3 — CONSECINȚELE TRECERII PE TEMĂ ÎNTUNECATĂ

Site-ul era luminos. Acum e permanent întunecat. Asta scoate la iveală lucruri care înainte
nu se vedeau. Tratează-le pe toate.

### 3.1 Culori luminoase rămase în cod (prioritate — acum sar în ochi)

Caută și raportează fiecare apariție de:
`bg-white` · `bg-gray-50` · `bg-gray-100` · `bg-slate-50` · `bg-neutral-50` ·
`text-black` · `text-gray-900` · `text-gray-800` · `border-gray-100` · `border-gray-200` ·
`#FFFFFF` · `#ffffff` · `#fff` scrise direct

Pe fond alb treceau neobservate. Pe fond negru, fiecare devine un dreptunghi alb strident.
**Înlocuiește-le cu variabila semantică potrivită** (`bg-suprafata`, `text-text`,
`border-chenar` etc.), conform tabelului de conversie folosit la implementarea temelor.

**Excepții — nu le atinge:** culorile semantice (verde de succes, roșu de eroare, galben de
avertizare, badge-uri de status comandă) și bannerele ANPC.

### 3.2 `color-scheme` — obligatoriu

În `:root`, adaugă:
```css
color-scheme: dark;
```
Fără linia asta, browserul desenează în continuare barele de defilare, calendarele native și
listele de `select` în variantă luminoasă — apar ca petice albe pe un site negru. Cu ea, le
adaptează singur. E o linie și rezolvă o categorie întreagă de probleme.

### 3.3 Culoarea barei de browser pe telefon

În `app/layout.tsx`, în obiectul `metadata` (sau `viewport`, în funcție de versiunea de
Next.js din proiect — **verifică ce API folosește repo-ul, nu presupune**):
```
themeColor: '#000000'
```
Pe Android, bara de sus a browserului se colorează la fel cu headerul, în loc să rămână albă.

Dacă există `public/manifest.json` sau un fișier de manifest PWA, actualizează și acolo
`theme_color` și `background_color` la `#000000`.

### 3.4 Chenarele — reglaj de contrast

Pe fond întunecat, chenarul actual `--chenar` (`#2A2A2A`) pe suprafața `#191919` are un
contrast de **1,2:1**. Practic invizibil — aceeași problemă pe care o aveam pe tema luminoasă
cu gri-urile prea deschise, doar inversată.

Adaugă în `:root` două variabile noi:
```css
--camp-bg:          13 13 13;    /* #0D0D0D — fundalul inputurilor, mai adânc decât cardul */
--chenar-puternic: 102 102 102;  /* #666666 — chenar de input și buton secundar */
```

Am verificat: `#666666` pe `#191919` dă **3,06:1**, iar pe `#0D0D0D` dă **3,39:1** — ambele
peste pragul de 3:1 cerut de WCAG 1.4.11 pentru contururile componentelor de interfață.

Aplică `--chenar-puternic` pe: chenarele câmpurilor de formular, butoanele secundare,
`select`-uri, zonele de încărcare fișiere. Lasă `--chenar` pentru liniile decorative și
separatoare, unde nu e nevoie de 3:1.

### 3.5 Fundalul pozelor de produs — decizie, raportează-mi rezultatul

Pozele de piese sunt de obicei fotografiate pe fundal alb sau deschis. Pe un site negru,
fiecare card ajunge să aibă un dreptunghi alb luminos în partea de sus. Poate arăta bine
(contrast puternic, produsul iese în evidență) sau poate arăta agresiv, în funcție de poze.

Adaugă în `:root`:
```css
--imagine-bg: 242 242 242;   /* #F2F2F2 — fundalul zonei de imagine din card */
```
și aplic-o pe containerul de imagine din cardul de produs și din galeria paginii de produs.

**Fă-mi captură de ecran a listării `/piese` după modificare și raportează.** Dacă nu arată
bine, se schimbă o singură linie: `--imagine-bg: 25 25 25;` (imaginea se topește în card).
Nu decide singur care variantă rămâne.

### 3.6 Bannerele ANPC — ÎNTREABĂ-MĂ, nu decide

`anpc-sal.png` și `anpc-sol.png` sunt fișiere oficiale, 250×50, cu fundal deschis. Pe
footerul negru vor apărea ca două dreptunghiuri albe.

**Fișierele nu se modifică sub nicio formă** — nici dimensiune, nici culoare, nici filtre CSS.
Sunt materiale oficiale.

Spune-mi cum arată și propune-mi variante (de exemplu un container deschis cu spațiere în
jurul lor, care le face să pară intenționate). **Nu implementa nimic până nu îți răspund.**

### 3.7 Stiluri de tipărire

Dacă cineva tipărește o pagină, fondul negru înseamnă o pagină complet neagră. Adaugă în
`app/globals.css`:
```css
@media print {
  :root { --fundal: 255 255 255; --suprafata: 255 255 255; --text: 0 0 0;
          --text-secundar: 60 60 60; --header-bg: 255 255 255; --footer-bg: 255 255 255;
          --header-text: 0 0 0; --footer-text: 60 60 60; }
}
```
Verifică apoi în browser cu previzualizarea de tipărire (Ctrl+P) pe o pagină de comandă din
admin și pe o pagină legală.

---

## ETAPA 4 — VERIFICARE

1. `npm run build` trece fără erori și fără warning-uri noi.
2. Căutare în cod: **zero rezultate** pentru `SelectorTeme`, `SELECTOR_TEME_ACTIV`,
   `data-tema`, `autopas-tema`, `lib/teme`.
3. Site-ul se încarcă direct în negru + galben, **fără niciun licăr** de altă culoare.
4. Golește `localStorage` în browser (DevTools → Application → Local Storage) și
   reîncarcă — site-ul arată identic. Asta confirmă că nu mai depinde de nimic salvat local.
5. Contrast verificat (folosește scriptul de contrast dacă există deja în repo, altfel scrie
   unul mic): text pe fundal ≥ 4,5:1 · text pe accent ≥ 4,5:1 · chenare de input ≥ 3:1.
6. Fără scroll orizontal la 360px, 768px și 1280px, pe home și pe `/piese` — verifică în
   special headerul, de unde tocmai am scos un element.
7. Parcurge vizual la 360px: home · `/piese` · o pagină de produs · `/cos` · `/checkout` ·
   footer · `/admin` · `/admin/comenzi`. Caută zone rămase luminoase.

---

## RAPORT FINAL (în chat, nu într-un fișier)

1. Fișierele șterse și fișierele modificate.
2. Lista culorilor luminoase găsite la 3.1 și ce ai pus în loc.
3. Captura de la `/piese` pentru decizia de la 3.5 (fundalul pozelor).
4. Situația bannerelor ANPC de la 3.6, cu propunerile tale — **fără să implementezi**.
5. Tabelul de contrast de la punctul 5 al verificării.
6. Orice loc unde site-ul arată prost pe temă întunecată și nu ai putut repara fără să
   schimbi layoutul.
