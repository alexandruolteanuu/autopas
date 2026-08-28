# Google Analytics — ghid de configurare

Scris pentru cine nu e tehnic. Durează cam 15 minute, o singură dată.

**Înainte de orice, citește secțiunea „⚠ Un pas obligatoriu înainte" de la final.
Are consecințe legale, nu tehnice.**

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

## ⚠ Un pas obligatoriu înainte de a lipi codul

**Politica de cookies de pe site spune acum, negru pe alb, că NU folosim Google
Analytics.** E scrisă onest, pe baza a ce făcea codul până acum:

> „Site-ul acesta nu te urmărește. Nu folosim Google Analytics, nu avem pixel de
> Facebook, nu afișăm reclame și nu facem profilare."

Mai sunt patru locuri în aceeași pagină care spun același lucru, plus tabelul cu
lista completă a ce se salvează în browser — tabel în care Google Analytics ar
trebui să apară cu cookie-urile lui (`_ga` și `_ga_XXXXXXXX`, valabile 2 ani).

Din clipa în care lipești codul, pagina aceea devine **falsă**. E exact genul de
lucru pe care ANPC îl verifică, iar o politică de confidențialitate care contrazice
realitatea e o problemă mai mare decât lipsa ei.

**Deci: nu lipi codul până nu e actualizată politica.** Textul se schimbă în
`lib/legal.ts`, e o modificare de vreo 20 de minute, și trebuie cerută explicit —
sunt documente legale, nu se rescriu din reflex.

Ce trebuie schimbat, pe scurt:

1. „Pe scurt" — nu mai putem spune „nu te urmărește"; se scrie că folosim GA doar
   cu acordul vizitatorului.
2. „Ce sunt cookie-urile" — afirmația „nu punem niciun cookie propriu" nu mai e
   adevărată: GA pune `_ga` și `_ga_XXXXXXXX`, care sunt cookie-uri proprii.
3. Tabelul — două rânduri noi, cu cele două cookie-uri și durata lor.
4. „Ce nu folosim" — se scoate primul punct (instrumentele de analiză).
5. „Despre bannerul de cookie-uri" — acum scrie că „Doar necesare" și „Accept
   toate" fac același lucru. De acum chiar diferă, și trebuie spus.
