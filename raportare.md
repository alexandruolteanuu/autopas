# RAPORT — 25 august 2026

PartArt pe gri neutru · Curățenie în bucket · Documentarea uneltelor

Împins pe `main`: `fbdc475`.

---

## 2 · PartArt pe `#E9EAEA`

Aceeași valoare în **trei** locuri, ca muchia să dispară, nu să se atenueze:

- `components/PartArt.tsx` — fundalul și cercul decorativ ies din constantele `FUNDAL` / `FUNDAL_2` (`#E9EAEA` / `#E0E1E1`), nu mai sunt hexa împrăștiate în marcaj
- `--imagine-bg` pe tema întunecată: `#ECE9E2` → `#E9EAEA`
- `--imagine-bg` pe tema luminoasă: `#EFF1F3` → `#E9EAEA`

`.tema-clasica` din `/admin` n-am atins-o — am verificat că `PartArt` și `bg-imagineBg` apar exclusiv pe site-ul public (acasă, coș, `ProductCard`, `ProductGallery`, subsol), deci variabila din panou n-are niciun efect asupra lor.

În capturi se vede că bejul a dispărut: pe tema luminoasă ilustrația e acum în aceeași familie cu cardul alb și cu fundalul rece, iar pe cea întunecată nu s-a schimbat nimic perceptibil.

---

## a · Cele 3 orfane — șterse

Confirmat întâi, apoi șters. Verificarea a comparat **toate** fișierele din bucket cu `poze[]` **și** `poze_sursa[]` de la toate piesele: niciunul dintre cele 3 nu apărea nicăieri.

```
înainte: 31 fișiere · 28 legate · 3 orfane (2211 KB)
după:    28 fișiere · 28 legate · 0 orfane · 0 adrese moarte
```

---

## b · Restul bucketului și tiparul

**Nu mai există alți orfani** — 28 din 28 sunt legate de un produs. Și, în cealaltă direcție, **zero referințe fără fișier**: nicio piesă nu arată spre o poză care nu mai există.

**Tiparul e structural, nu accidental.** `components/admin/PhotoUploader.tsx` urcă poza în Storage **imediat** ce o alegi, dar adresa ei intră doar în starea formularului — rândul din `products` se scrie abia când apeși „Salvează". Deci:

> **orice formular de produs abandonat după ce s-au încărcat poze lasă fișierele în bucket, definitiv.** Închizi tabul, apeși „Renunță", pierzi sesiunea, pică salvarea — același rezultat.

Cele 3 fișiere se potrivesc exact: unul la 13:34:50 și două la 13:36:39, pe 18 august, o sesiune de încărcare care nu s-a salvat niciodată. Cel mare avea **1988 KB** — o poză direct de pe telefon, neconvertită, fiindcă `PhotoUploader` nu trece prin `lib/import/imagini.mjs`.

Și fața cealaltă a aceleiași monede, pe care ți-o semnalez fiindcă e mai gravă: butonul X **șterge fișierul din Storage pe loc**. Dacă operatorul șterge o poză și apoi nu salvează formularul, rândul din bază rămâne cu o adresă moartă — poză ruptă pe site, văzută de client. Acum sunt 0, dar mecanismul e acolo.

La 8.000 de piese ambele se adună. Nu le-am reparat — schimbă felul în care funcționează formularul de produs (încărcare într-o zonă temporară, mutare la salvare, ștergere amânată), și e o decizie de-a ta. Până atunci, plasa de siguranță e `scripts/curata-orfani.mjs`:

- implicit **nu șterge nimic**, doar raportează
- cu `--sterge` nu atinge fișiere mai noi de **24h** (`--ore=N`), tocmai fiindcă cineva poate avea chiar atunci un formular deschis cu poze urcate și nesalvate
- raportează separat adresele moarte, care sunt mai grave decât orfanii

---

## c · CLAUDE.md

Am adăugat secțiunea **„Unelte de verificare și întreținere (`scripts/`)"** — un tabel cu toate cele cinci scripturi și *când* se folosește fiecare, nu doar ce face:

| Script | Când se folosește |
|---|---|
| `verifica-contrast.mjs` | după orice atingere a paletei din `globals.css` |
| `verifica-import.mjs` | după orice modificare în `lib/import/` — 41 de verificări, fără rețea și fără bază de date |
| `scan-responsive.mjs` | după modificări de așezare; `TEMA=luminos` schimbă tema |
| `reconverteste-poze.mjs` | rar, la nevoie — trece în WebP pozele rămase JPEG |
| `curata-orfani.mjs` | periodic, mai ales după sesiuni lungi de lucru pe produse |

`reconverteste-poze.mjs` are scris explicit de ce există (pozele urcate cât timp `sharp` lipsea) și ce înseamnă dacă apar iar JPEG-uri în bucket. Dedesubt, tiparul care produce orfani, ca peste șase luni să nu pară că cineva a uitat niște fișiere acolo.

Am corectat și paragraful despre contrast, care încă spunea că tema luminoasă are 4 perechi sub prag — acum ambele teme trec 14 din 14, rămân doar cele 2 din `/admin`.

---

## Ce așteaptă de la tine

- **confirmarea migrării 23** (`rls-citire-echipa.sql`)
- **contul de echipă** pentru Etapa 2 a auditului
- **decizia pe certificatul de garanție**, ca să pot implementa textul de la C.3
