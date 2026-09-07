# E-mail: cutia `contact@` și mesajele automate

Scris la 7 septembrie 2026. Codul e gata și așteaptă; ce urmează aici se face **din afara
proiectului**, din interfețele Vercel, Zoho și Brevo.

## Ce e de rezolvat, în trei bucăți separate

Se amestecă mereu, și de-aia iese prost. Sunt trei lucruri diferite:

1. **Primirea** — ca `contact@autopas-dezmembrari.ro` să existe și mesajele să ajungă pe
   `pieseneamt@yahoo.ro`. Se face din DNS, la Zoho. Nu are nevoie de nicio linie de cod.
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

## Pasul 1 — cutia poștală, la Zoho Mail (gratuit)

De ce Zoho și nu o simplă redirecționare: la o redirecționare pură, dacă Yahoo pune mesajul la
Spam sau redirecționarea se strică, mesajul **nu mai există nicăieri**. Cu o cutie reală
rămâne o copie, ceea ce contează la un litigiu de garanție.

1. Cont pe **zoho.com/mail**, plan **Forever Free**, cu domeniu propriu.
   **Alege centrul de date EUROPA** la înregistrare — nu se poate schimba după.
2. Verifică domeniul: Zoho îți dă o valoare TXT. O adaugi în Vercel → Settings → Domains →
   `autopas-dezmembrari.ro` → Add record: tip `TXT`, nume gol (sau `@`), valoarea de la Zoho.
3. Creează utilizatorul **`contact`** → devine `contact@autopas-dezmembrari.ro`.
4. Adaugă înregistrările **MX** date de Zoho. Pentru centrul de date european arată așa:

   | Tip | Nume | Valoare | Prioritate |
   |---|---|---|---|
   | MX | `@` | `mx.zoho.eu` | 10 |
   | MX | `@` | `mx2.zoho.eu` | 20 |
   | MX | `@` | `mx3.zoho.eu` | 50 |

   **Copiază valorile exacte de pe ecranul Zoho**, nu de aici: diferă după centrul de date și
   se mai schimbă în timp.
5. **Redirecționarea către Yahoo**: Zoho Mail → Settings → Mail Accounts → contact@ →
   Email Forwarding → adaugi `pieseneamt@yahoo.ro`. Zoho trimite un cod de confirmare pe
   Yahoo; îl introduci. Bifează și **Keep a copy** (păstrează copia în Zoho) — altfel pierzi
   exact arhiva pentru care am ales Zoho.

**Verificare:** trimite-ți singur un mesaj de pe Yahoo la `contact@autopas-dezmembrari.ro`.
Trebuie să ajungă înapoi în Yahoo în mai puțin de un minut. Dacă nu ajunge în 15 minute, DNS-ul
încă nu s-a propagat; mai încearcă peste o oră.

---

## Pasul 2 — trimiterea automată, prin Brevo (gratuit)

1. Cont pe **brevo.com**.
2. Senders, Domains & Dedicated IPs → **Domains** → Add a domain →
   `autopas-dezmembrari.ro` → Authenticate.
3. Brevo îți dă înregistrările de autentificare. Le adaugi în Vercel, la fel ca mai sus:
   - o înregistrare **DKIM** (TXT, pe un nume de forma `brevo._domainkey` sau
     `mail._domainkey`);
   - o înregistrare **DMARC**, dacă ți-o propune;
   - o valoare de adăugat în **SPF**.

### ⚠ Cea mai frecventă greșeală: două înregistrări SPF

Un domeniu are voie cu **o singură** înregistrare SPF. Dacă adaugi una pentru Zoho și alta
pentru Brevo, **amândouă devin invalide** și toate mesajele ajung la Spam. Se face UNA singură,
care le conține pe amândouă:

```
Tip: TXT   Nume: @   Valoare:
v=spf1 include:zoho.eu include:spf.brevo.com ~all
```

(Confirmă cele două valori `include:` de pe ecranele Zoho și Brevo — sunt valorile de la
7 septembrie 2026.)

Și DMARC, o singură înregistrare, de pornire blândă:

```
Tip: TXT   Nume: _dmarc   Valoare:
v=DMARC1; p=none; rua=mailto:contact@autopas-dezmembrari.ro
```

`p=none` înseamnă „raportează, nu bloca". Se strânge o lună de rapoarte, apoi se poate trece la
`p=quarantine`. Pornit direct pe `quarantine`, orice greșeală de configurare ar arunca
confirmările de comandă la Spam, fără să afli.

4. Brevo → **SMTP & API** → Generate a new API key. O copiezi — se arată o singură dată.

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
Brevo și Zoho sunt trecuți la destinatarii datelor și la locul de stocare, în politica de
confidențialitate. Dacă se schimbă vreodată furnizorul, se schimbă întâi acolo.
