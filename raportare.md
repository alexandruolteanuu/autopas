# RAPORT — 28 august 2026 · măsurare după migrarea 31

## Cifrele — și o problemă

TTFB pe producție, 4 rulări:

| Pagină | TTFB |
|---|---|
| `/` | 1,19 · 0,78 · 0,64 · 0,80 s |
| **`/piese`** | **2,90 · 2,73 · 3,59 · 2,67 s** |
| `/piese?pagina=7` | 2,69 · 2,72 · 3,15 · 2,81 s |
| `/piese?marca=skoda` | 2,79 · 2,77 · 2,69 · 2,82 s |
| `/masini` | 0,23 · 0,43 · 0,23 · 0,21 s |

**Neschimbat.** Cauza nu e estimarea:

```
e_versiunea_noua:      false
mai_are_subinterogare: true
```

**Migrarea 31 nu e în bază.** View-ul `categorii_cu_numar` e tot cel vechi, cu subinterogarea
corelată.

Nu e vina SQL-ului: am creat aceeași definiție sub alt nume (`zz_test_categorii`), a mers din
prima și a dat exact 349 de rânduri, sumă 17.478 — apoi am șters view-ul de test. În bază sunt
tot cele trei de dinainte.

Deci fie rularea a dat o eroare care a trecut neobservată în SQL Editor, fie s-a rulat altceva
decât conținutul fișierului. Nu se poate ști din afară care din două.

**Întrebare deschisă:** o aplic eu, prin conector? E `create or replace view`, nedistructivă,
cu echivalența deja verificată. Zece secunde, plus TTFB-ul de după.

---

## Verificarea dependențelor, cerută înainte de paralelizare

Bine că a fost cerută — **există o dependență reală**, care ar fi fost ruptă.

Interogarea principală de listare traduce slug-urile din URL în id-uri folosind rezultatele
celorlalte: `cats.find(...)` pentru categorie, `models.find(...)` pentru model,
`brands.find(...)` pentru marcă. Deci nu poate porni în același val cu ele.

Structura corectă e în **două valuri**, nu într-unul:

- **valul 1**, în paralel: `categorii_cu_numar`, `brands`, `models`, `numar_piese_pe_model` și
  căutarea mașinii (când e `?vehicul=`) — toate cinci independente între ele;
- **valul 2**: interogarea de piese, care le folosește pe primele trei.

5 drumuri secvențiale → 2 valuri. Se face imediat ce migrarea e în bază, ca să se poată atribui
corect câștigul fiecăreia.

---

## Datoria tehnică — notată în `CLAUDE.md` (`fdf5017`)

- `/admin/masini` aduce toate cele 8.783 de produse (9 cereri paginate) doar ca să numere
  piesele pe mașină — `numar_piese_pe_masina` dă aceleași cifre în 0,9 ms.
- `/admin/rapoarte` aduce tot catalogul ca să traducă `product_id` în categorie și mașină. Azi
  e singura cale; la 30 de vânzări pe zi ar trebui mutat într-un `join` în bază.

Niciuna blocantă: sunt ecrane interne, nu pagini publice. Devin dureroase când catalogul se
dublează — exact ca plafonul de 1.000 de rânduri, care n-a durut până la a 1.001-a piesă.

---

## Ce urmează

1. migrarea 31 în bază (tu sau eu), apoi măsurare TTFB;
2. paralelizarea în două valuri, apoi măsurare din nou;
3. **Partea B** — `generateMetadata` pe pagina de produs.
