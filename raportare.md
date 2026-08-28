# RAPORT — 28 august 2026 · Partea B, punctul 1 (propunere)

Generatorul de titlu și descriere e gata și rulat pe tot catalogul.
**NU e aplicat în cod** — exemplele de mai jos sunt pentru aprobare.

---

## Exemple pe piese reale

**Piesă obișnuită**

```
nume (57): Motoraș etrier spate Audi A4 B8 2.0 TDI — testat pe stand
TITLU (51): Motoraș etrier spate Audi A4 B8 2008–2011 | AUTOPAS
DESCR (157): Motoraș etrier spate Audi A4 B8 2.0 TDI — testat. Cod intern AP-000011.
             Piesă din dezmembrări, testată — 350 lei. Garanție 90 de zile, livrare în toată țara.
```

**Titlu foarte lung — 110 caractere, 5 modele compatibile**

```
nume (110): Supapa electromagnetica Skoda Karoq / Superb / Octavia / VW Tiguan / T-Roc / Tiguan 1.5 TSI DXD 2020 2021 2022
TITLU  (64): Supapa electromagnetica Skoda Karoq / Superb / Octavia | AUTOPAS
```

**Fără model în bază**

```
nume (78): Ecu Calculator diferential cutie viteze Vw Touareg 3.0 tdi 2006 2007 2008 2009
TITLU (64): Ecu Calculator diferential cutie viteze Vw Touareg 3.0 | AUTOPAS
```

**Fără ani**

```
nume (29): Bara fata BMW Z4 E89 Facelift
TITLU (39): Bara fata BMW Z4 E89 Facelift | AUTOPAS
```

**Fără ani, 17 modele compatibile**

```
nume (46): Balast xenon AUDI 8K0941597C Q7 A3 A4 A5 A6 A8
TITLU (56): Balast xenon AUDI 8K0941597C Q7 A3 A4 A5 A6 A8 | AUTOPAS
```

---

## Regulile la care s-a ajuns, toate din date

**Șablonul din specificație nu se poate aplica literal.** `{denumire} — {marcă} {model} {ani}`
ar da „Motoraș etrier spate Audi A4 B8 2.0 TDI — Audi A4 B8 2008–2015": numele conțin deja
marca, modelul și anii. Regula devine: **se reconstruiește doar când numele nu încape**. La
„Bara fata BMW Z4 E89 Facelift" numele intră întreg, deci se păstrează „Facelift", pe care
reconstrucția l-ar fi pierdut.

**Anii enumerați se strâng.** „2008 2009 2010 2011" din nume devine „2008–2011" din coloana
`ani` — aceeași informație, de patru ori mai scurtă.

**Piesele cu multe potriviri păstrează lista din nume.** La „Balast xenon Q7 A3 A4 A5 A6 A8",
alegerea unui singur model ar fi arbitrară, iar enumerarea prinde mai multe căutări reale.

## Trei defecte găsite doar rulând pe date reale

1. **„Škoda" nu se potrivea cu „Skoda".** Marca are diacritic în tabelă, numele piesei nu.
   Potrivirea brută o rata mereu, iar titlurile Skoda ieșeau trunchiate greșit.
2. **Trunchierea tăia exact partea utilă.** Prima variantă dădea „Ecu Calculator diferential
   cutie viteze Vw | AUTOPAS" — se oprea fix înainte de „Touareg".
3. **Prepoziții agățate:** „… — testat pe." Acum se elimină cuvintele de 1–2 litere rămase la
   coadă.

## Cifrele pe tot catalogul

| | rezultat |
|---|---|
| descrieri distincte | **8.739 din 8.739** |
| titluri distincte | 8.165 (1.023 împart un titlu) |
| titluri peste 65 caractere | **0** |
| descrieri peste 160 | **0** |

Unicitatea descrierilor vine din `cod_intern` — completat și unic pe toate cele 8.739,
**afișat deja pe pagină**, deci nu e text inventat pentru Google. E și util: clientul îl poate
cita la telefon.

**Titlurile duplicate sunt oneste:** sunt șapte „Bara fata Skoda Octavia 4" în catalog — piese
fizic diferite, cu același nume și același preț. Ar putea fi diferențiate tot cu codul intern,
dar în rezultatele Google ar arăta a spam. Propunerea e să rămână așa.

**Constatare colaterală:** `oem` e **null pe toate cele 8.739 de piese importate**. Ramura „Cod
OEM" din descriere nu se declanșează niciodată azi — rămâne pentru piesele adăugate manual.

---

## Întrebarea deschisă

Se aplică? Intră în `generateMetadata`, împărțind produsul și tabelele de modele/mărci cu
pagina prin `cache()` — **zero interogări în plus** față de acum, cerința explicită de la
punctul 1.
