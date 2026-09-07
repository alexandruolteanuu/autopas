# E-mail: cutia `contact@` și mesajele automate

Scris la 7 septembrie 2026. Codul e gata și așteaptă; ce urmează aici se face **din afara
proiectului**, din interfețele Vercel, ImprovMX și Brevo.

## Ce e de rezolvat, în trei bucăți separate

Se amestecă mereu, și de-aia iese prost. Sunt trei lucruri diferite:

1. **Primirea** — ca `contact@autopas-dezmembrari.ro` să existe și mesajele să ajungă pe
   `pieseneamt@yahoo.ro`. Se face din DNS, la ImprovMX. Nu are nevoie de nicio linie de cod.
2. **Trimiterea automată** — confirmarea de comandă, anunțul de comandă nouă. Se face prin
   Brevo, plus trei înregistrări DNS. Codul există deja.
3. **Răspunsul** — se dă direct din Yahoo, ca `pieseneamt@yahoo.ro`. Decizie luată la
   7 septembrie 2026: clientul vede adresa de Yahoo la răspuns, și e în regulă.

## Starea de la care pornim (verificată la 7 septembrie 2026)

| | |
|---|---|
| Domeniul | înregistrat, activ |
| DNS | gestionat de **Vercel** (`ns1.vercel-dns.com`, `ns2.vercel-dns.com`) — toate înregistrările de mai jos se adaugă din Vercel → Settings → Domains |
| MX | **niciunul** |
| SPF, DKIM, DMARC | **niciunul** |

Consecința, azi: un mesaj trimis la `contact@autopas-dezmembrari.ro` **se întoarce la
expeditor**. Neexistând MX, serverul expeditorului încearcă adresa A a domeniului, care e
Vercel; Vercel nu vorbește SMTP, deci livrarea eșuează după câteva ore de reîncercări.

Adresa apare în toate cele 8 documente legale, unde clientul are drept să scrie pentru retur,
garanție și GDPR, iar site-ul e deja indexabil. Deci nu e o sarcină de pregătire, e una restantă.

---

## Pasul 1 — redirecționarea, la ImprovMX (gratuit)

**De ce nu Zoho, cum era planul inițial:** planul „Forever Free" al lor mai există, dar e
restricționat pe regiuni (nu apare pentru toate țările) și, mai important, pe pagina lor de
prețuri redirecționarea nu e listată ca funcție a planului gratuit, iar IMAP/POP/SMTP sunt
excluse explicit. Adică exact lucrul de care avem nevoie nu e garantat. Verificat la
7 septembrie 2026.

**Ce pierdem față de o cutie adevărată:** copia de pe server. Mesajele ajung în Yahoo și
rămân acolo, deci arhiva e Yahoo. Ce nu mai avem e rezerva pentru cazul în care
redirecționarea însăși se strică. ImprovMX întoarce mesajul la expeditor când nu poate livra
(nu îl înghite tăcut) și ține un jurnal de 7 zile, deci ai cum să afli.

Dacă vrei totuși cutie reală cu arhivă, varianta scurtă e **Zoho Mail Lite**, în jur de
5 lei pe lună: aceleași setări, doar că MX-urile sunt ale lor.

### Pașii

1. Cont pe **improvmx.com**, plan gratuit (1 domeniu, 25 de adrese, 500 de mesaje
   redirecționate pe zi — mult peste ce vei primi).
2. Adaugi domeniul `autopas-dezmembrari.ro` și aliasul:
   `contact@autopas-dezmembrari.ro` → `pieseneamt@yahoo.ro`.
3. Adaugi înregistrările în **Vercel → Settings → Domains → `autopas-dezmembrari.ro` →
   Add record**:

   | Tip | Nume | Valoare | Prioritate |
   |---|---|---|---|
   | MX | `@` | `mx1.improvmx.com` | 10 |
   | MX | `@` | `mx2.improvmx.com` | 20 |

   Dacă găsești acolo vreo înregistrare MX veche, o ștergi întâi — domeniul nu are azi
   niciuna, deci n-ar trebui să fie cazul.
4. SPF-ul se adaugă la **Pasul 2**, într-o singură linie împreună cu Brevo. Nu-l pune acum
   separat, citește avertismentul de acolo.

**Verificare:** trimite-ți singur un mesaj de pe Yahoo la `contact@autopas-dezmembrari.ro`.
Trebuie să ajungă înapoi în Yahoo în mai puțin de un minut. Dacă nu ajunge, DNS-ul încă nu
s-a propagat — poate dura până la câteva ore, uneori 24. Panoul ImprovMX îți arată singur
când vede înregistrările.

---

## Pasul 2 — trimiterea automată, prin Brevo (gratuit)

1. Cont pe **brevo.com**.
2. **Autentifici domeniul.** Click pe numele tău, sus-dreapta → **Senders & IP** →
   **Domains** → adaugi `autopas-dezmembrari.ro` → **Verify**.
   Brevo îți dă două înregistrări TXT: **Brevo code** și **DKIM** (gazda e de forma
   `mail._domainkey`). Le adaugi în Vercel, ca la Pasul 1. Verificarea poate dura
   până la 48 de ore, dar de obicei merge în câteva minute.
3. **Adaugi expeditorul**: `contact@autopas-dezmembrari.ro`. Brevo trimite un cod de
   confirmare pe adresa aceea — și îl vei primi în Yahoo, prin redirecționarea ImprovMX
   făcută la Pasul 1. E prima dovadă că redirecționarea chiar funcționează.

### ⚠ Cea mai frecventă greșeală: două înregistrări SPF

Un domeniu are voie cu **o singură** înregistrare SPF. Dacă adaugi una pentru ImprovMX și alta
pentru Brevo, **amândouă devin invalide** și toate mesajele ajung la Spam. Se face UNA singură,
care le conține pe amândouă:

```
Tip: TXT   Nume: @   Valoare:
v=spf1 include:spf.improvmx.com include:spf.brevo.com ~all
```

(Cele două valori `include:` sunt cele din documentația ImprovMX și Brevo la 7 septembrie
2026. Confirmă-le pe ecranele lor — se mai schimbă.)

Și DMARC, o singură înregistrare, de pornire blândă:

```
Tip: TXT   Nume: _dmarc   Valoare:
v=DMARC1; p=none; rua=mailto:contact@autopas-dezmembrari.ro
```

`p=none` înseamnă „raportează, nu bloca". Se strânge o lună de rapoarte, apoi se poate trece la
`p=quarantine`. Pornit direct pe `quarantine`, orice greșeală de configurare ar arunca
confirmările de comandă la Spam, fără să afli.

4. **Cheia.** Numele tău, sus-dreapta → **Settings** → **SMTP & API** → fila **API keys**
   → *Generate a new API key*. O copiezi imediat: se arată o singură dată.

   ⚠ **Cheie API, nu cheie SMTP.** Pe aceeași pagină Brevo are două file, iar cele două
   chei nu sunt interschimbabile. Codul nostru (`lib/email.ts`) folosește API-ul REST, deci
   are nevoie de cea din fila **API keys**. Cu o cheie SMTP, testul din panou întoarce
   „Brevo a răspuns 401" și pare că nu merge nimic.

---

## Pasul 3 — configurarea din panou

**Admin → Integrări → E-mail automat (Brevo)**:

| Câmp | Valoare |
|---|---|
| Cheie API Brevo | cea generată la pasul 2.4 |
| Adresa „De la” | `contact@autopas-dezmembrari.ro` |
| Numele afișat | `AUTOPAS Dezmembrări` |
| Unde primești anunțul de comandă nouă | `pieseneamt@yahoo.ro` |
| Adresa pe care o cheamă baza de date | `https://autopas-dezmembrari.ro/api/email-coada` |
| Secretul acelei adrese | un șir lung, aleatoriu (vezi mai jos) |

Secretul îl generezi cu o comandă în terminal, sau îl inventezi — orice șir lung și
imprevizibil merge:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Bifezi **Activă**, salvezi, apoi apeși **Trimite un test**.

**Verifică inclusiv folderul Spam.** Dacă mesajul a ajuns acolo, mai lipsește o înregistrare
DNS — cel mai probabil SPF-ul e dublu (vezi avertismentul de mai sus) sau DKIM-ul încă nu s-a
propagat.

---

## Cum funcționează, pe scurt, ca să știi ce să cauți când se strică

Când intră o comandă, un trigger din baza de date scrie **în aceeași tranzacție** două rânduri
în tabela `email_coada` (unul pentru client, unul pentru tine) și cheamă
`/api/email-coada`, care le trimite prin Brevo.

Ce înseamnă asta practic:

- **Dacă există comanda, există și e-mailul de trimis.** Un client care închide tabul imediat
  după „Trimite comanda" nu te mai lasă neanunțat — greșeala tipică a implementărilor care
  trimit din browser.
- **Un e-mail nu poate strica o comandă.** Tot ce face triggerul e învelit într-un
  `exception when others then null`. Dacă Brevo cade sau site-ul e în timpul unui deploy,
  comanda se salvează oricum, iar rândul așteaptă în coadă.
- **Nimic nu se pierde, se poate doar întârzia.** Dacă trezirea a picat, apeși
  **Trimite ce a rămas în coadă**, din același panou.
- Fiecare încercare se scrie în `email_coada`: către cine, când, ce eroare. După 5 eșecuri
  rândul se lasă în pace, cu eroarea la vedere — o adresă greșită nu se repară singură.

## Ce NU scrie niciodată în confirmarea de comandă

**Costul livrării.** Rămâne decizia din 7 august 2026: transportul se stabilește după
cântărire și se comunică telefonic. Confirmarea spune exact ce spune mesajul de WhatsApp —
piesele, totalul lor, și că urmează un telefon. Un e-mail automat care ar inventa un cost ar
contrazice prima ta convorbire cu clientul, iar clientul l-ar crede pe el, nu pe tine.

## Documentele legale

Au fost actualizate **înainte** de punerea în funcțiune, ca la Google Analytics și la Meta:
Brevo și ImprovMX sunt trecuți la destinatarii datelor și la locul de stocare, în politica de
confidențialitate. Dacă se schimbă vreodată furnizorul, se schimbă întâi acolo — s-a și
întâmplat o dată, la 7 septembrie 2026, când Zoho a fost înlocuit cu ImprovMX.
