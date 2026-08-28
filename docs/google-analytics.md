# Google Analytics — ghid de configurare

Scris pentru cine nu e tehnic. Durează cam 15 minute, o singură dată.

Politica de cookies și cea de confidențialitate au fost deja actualizate pentru
Google Analytics, deci nu mai ai nimic de pregătit înainte — vezi ultima secțiune.

---

## Ce vei avea la final

Vei putea vedea, în orice moment:

- câți oameni intră pe site și de unde vin (Google, Facebook, direct);
- ce piese se uită cel mai des și care se cumpără;
- câți pun o piesă în coș și câți duc comanda până la capăt;
- de pe telefon sau de pe calculator.

Nimic din toate astea nu funcționează pentru vizitatorii care refuză cookie-urile
de statistică. Așa cere legea, și așa e făcut site-ul.

---

## Pasul 1 — Faci un cont Google Analytics

1. Intri pe **https://analytics.google.com** și te autentifici cu contul Google
   al firmei (dacă n-ai unul, fă-l întâi — nu folosi contul personal).
2. Dacă e prima oară, Google te întreabă direct de numele contului. Scrie
   **Autopas Dezmembrări**.
3. Bifează căsuțele de acord pe care ți le arată și mergi mai departe.

## Pasul 2 — Creezi „proprietatea" pentru site

Google numește „proprietate" (property) locul unde se strâng datele unui site.

1. Nume proprietate: **autopas-dezmembrari.ro**
2. Fus orar: **România (GMT+2)** — important, altfel rapoartele pe zile ies decalate.
3. Monedă: **Leu românesc (RON)** — altfel toate vânzările apar în dolari.
4. La întrebările despre domeniul de activitate alege ceva apropiat
   (comerț / piese auto) și mărimea firmei. Nu contează pentru date.

## Pasul 3 — Iei ID-ul de măsurare

1. Când te întreabă „de unde colectezi date", alege **Web**.
2. Adresa site-ului: `https://autopas-dezmembrari.ro`, numele fluxului:
   **Site principal**.
3. După ce apeși „Creează", Google îți arată un cod de forma:

   ```
   G-XXXXXXXXXX
   ```

   Ăsta e tot ce ne trebuie. Începe întotdeauna cu **G-**.
   Îl găsești oricând la **Administrare → Fluxuri de date → Site principal**.

⚠ Nu confunda cu „ID-ul de urmărire" vechi, de forma `UA-12345678-1`. Acela e
Universal Analytics, oprit de Google din 2023. Dacă vezi așa ceva, ești într-un
cont vechi.

## Pasul 4 — Îl lipești în site

1. Intri în panoul de administrare, la **Integrări**.
2. Găsești cartonașul **Google Analytics 4**.
3. Lipești codul `G-XXXXXXXXXX` în câmpul **ID de măsurare**.
4. Apeși **Salvează**.

Atât. Nu trebuie schimbat nimic în cod și nu trebuie făcut niciun deploy.

**Ca să oprești măsurarea**, ștergi codul din câmp și salvezi. Din secunda aceea
site-ul nu mai încarcă nimic de la Google — nu rămâne niciun script „adormit".

## Pasul 5 — Verifici că merge

1. În Google Analytics, mergi la **Rapoarte → În timp real**.
2. Deschide site-ul **pe telefon**, pe date mobile (nu pe wi-fi-ul de la birou,
   ca să fii sigur că nu e vreo urmă veche în browser).
3. La prima vizită apare jos bannerul de cookie-uri. **Apasă „Accept toate"** —
   fără asta nu se măsoară nimic, și e normal să fie așa.
4. În 10–30 de secunde ar trebui să te vezi în raport, ca „1 utilizator activ".

Dacă nu apari:

| Ce vezi | Ce înseamnă |
|---|---|
| Nimic, deși ai apăsat „Accept toate" | Ai lipit codul greșit, sau n-ai apăsat Salvează. Verifică să înceapă cu `G-` |
| Nimic, dar n-ai văzut bannerul | Browserul ține minte o alegere veche. Intră la `/legal/setari-cookie-uri` și pornește „Statistică" |
| Apari, apoi dispari | Normal. Raportul „în timp real" arată doar ultimele 30 de minute |

**Traficul tău din panoul de administrare nu se numără niciodată** — e făcut
intenționat, ca să nu-ți strici propriile statistici lucrând la comenzi.

## Pasul 6 — Unde vezi vânzările

Datele de comerț apar după 24–48 de ore (Google le procesează, nu e instant).

- **Rapoarte → Monetizare → Achiziții de comerț electronic** — ce piese s-au
  văzut, câte au ajuns în coș, câte s-au cumpărat.
- **Rapoarte → Interacțiune → Evenimente** — lista brută, dacă vrei detalii.

Evenimentele pe care le trimite site-ul singur:

| Ce vezi în Google | Când se întâmplă |
|---|---|
| `view_item` | cineva deschide pagina unei piese |
| `view_item_list` | cineva se uită la o listă de piese |
| `select_item` | cineva apasă pe o piesă dintr-o listă |
| `add_to_cart` / `remove_from_cart` | pune sau scoate o piesă din coș |
| `view_cart` | deschide coșul |
| `begin_checkout` | începe completarea comenzii |
| `purchase` | comanda a fost înregistrată |
| `search` | a căutat ceva pe site |
| `generate_lead` | a trimis „Caut o piesă" sau „Predă mașina" |

`purchase` se trimite **o singură dată pe comandă**, chiar dacă omul reîncarcă
pagina de mulțumire. Altfel aceeași vânzare ar apărea de mai multe ori.

**Nu se trimit date personale.** Niciun nume, telefon, e-mail sau adresă nu
ajunge la Google — doar codurile pieselor, sumele și numărul comenzii.

---

## Despre politica de cookies

A fost actualizată pe 28 august 2026, odată cu implementarea, deci **nu mai ai nimic de făcut
înainte de a lipi codul**.

Ce spune acum, ca să știi ce ai promis clienților:

- Google Analytics se încarcă doar după „Accept toate”; „Doar necesare” și lipsa unei alegeri
  înseamnă că nu se încarcă nimic.
- Cele două cookie-uri (`_ga` și `_ga_` urmat de codul contului) apar în tabel, cu durata lor
  de 2 ani.
- Google e trecut în lista destinatarilor din politica de confidențialitate.
- Scrie explicit că nu trimitem nume, telefon, e-mail sau adresă.

**Dacă schimbi vreodată ceva la măsurare** — alt instrument, alt cookie, altă durată — se
actualizează întâi paginile legale și abia apoi se pune în funcțiune. Nu invers: o politică
de confidențialitate care contrazice realitatea e o problemă mai mare decât lipsa ei.
