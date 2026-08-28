# RAPORT — inventar livrare, comenzi, notificări, domeniu

Zero modificări făcute în cod. Doar citire.
Data: 18 august 2026.

---

## 1. FAN Courier — ce există în schelet

### `lib/couriers.ts` (38 de linii, tot fișierul)

| Element | Stare |
|---|---|
| `credentialeFan()` | **implementat** — citește `settings.integrari.fancourier` (client_id, user, parola); rezervă: `FANCOURIER_CLIENT_ID/_USER/_PASS` din Vercel |
| `genereazaAwbFan(c)` | **stub** — verifică credențialele, apoi returnează mereu `{ok:false, eroare:"Credențiale găsite, dar apelul către FAN nu e încă activat"}` |
| Endpoint apelat | **niciunul**. Doar 2 linii de comentariu: `POST https://api.fancourier.ro/login` → token, apoi `POST https://api.fancourier.ro/intern-awb` → `{awbNumber}`. Deci **API v2.0**, nu selfawb.ro vechi (deși peste tot în UI scrie „SelfAWB") |
| Tip `AwbCerere` | numar_comanda, nume, telefon, email, adresa, oras, judet, ramburs, greutate_kg *(opțional)* |

### `app/api/awb/route.ts` — **complet funcțional**, singurul lucru care-i lipsește e ce cheamă

`POST` → verifică `esteEchipa(req)` (token Bearer → RPC `is_staff`) → 401 dacă nu → validează `cerere.numar_comanda` → apelează `genereazaAwbFan` → întoarce răspunsul. Nu are cum să reușească azi, fiindcă funcția de dedesubt e stub.

### Admin → Integrări (`app/admin/integrari/page.tsx`)

| Aspect | Realitate |
|---|---|
| Câmpuri FAN în UI | Client ID · Utilizator · Parolă (`type=password`) · checkbox „Activă" |
| Se salvează? | **Da** — `update settings set valoare = {...conf, fancourier:{...}} where cheie='integrari'`. RLS: doar `is_admin()` |
| Unde se citesc | `credentialeFan()` din `lib/couriers.ts` (server, prin `sbAdmin`) |
| Indicator „Conectat ✓" | `GET /api/integrari` întoarce `{fan: bool}` — **doar dacă cele 3 câmpuri sunt nenule**, nu testează conexiunea reală |
| ⚠️ Neconcordanță | Fișa FAN din UI spune „Adaugi în Vercel: FANCOURIER_*", dar formularul salvează în DB. Ambele merg; textul e învechit |
| ⚠️ Câmpul `activ` | Se salvează, dar **nu e citit nicăieri** în cod |

### Ce nu există deloc

| Funcție | Stare |
|---|---|
| Calcul de tarif FAN | **NU EXISTĂ** — nicăieri, nicio linie. Căutat: `tarif`, `calcul.*livrare`, `cost_livrare` |
| Generare AWB | Doar butonul + ruta + stub. **Zero apel HTTP** |
| Urmărire AWB / tracking | **NU EXISTĂ**. `orders.awb` e doar text; nu e nici măcar link către fancourier.ro/tracking |
| Localități / județe FAN | NU EXISTĂ — `oras`/`judet` sunt text liber la checkout |

### Admin → Expedieri (AWB) — buton cu buton

| Element | Ce face |
|---|---|
| 3 taburi | „De predat" = `status='confirmata'` · „În tranzit" = `expediata` · „Livrate" = `livrata` |
| Carduri sus | numărul de comenzi din tab + câte pe fiecare curier (doar FAN) |
| Bifă pe rând / bifă în antet | selecție locală, fără efect în DB |
| **„Printează borderoul (n)"** | Deschide fereastră nouă cu HTML generat inline: logo, dată, tabel (AWB, comandă, destinatar, localitate, curier, greutate, ramburs), 2 linii de semnătură; `window.print()` la `onload`. **Nu scrie nimic în DB** |
| **„Marchează expediate"** | `for` peste selecție: `update orders set status='expediata'`. Un UPDATE pe rând, secvențial |
| Coloana AWB | afișează `o.awb` sau „negenerat". **Nu se poate genera AWB de aici** — doar din detaliul comenzii |
| ⚠️ Greutatea afișată | calculată în browser: `Σ (products.greutate_kg || 5) × cantitate`. **Fallback 5 kg** dacă piesa n-are greutate completată — apare în borderoul dat curierului |

---

## 2. Dimensiuni și greutate pe produs

| Întrebare | Răspuns |
|---|---|
| `products` are dimensiuni? | **NU.** Doar `greutate_kg numeric(6,2)` (`admin.sql:18`), nullable. Fără lungime/lățime/înălțime/volum |
| Câmpuri fizice în `ProductForm.tsx` | **Unul singur**: „Greutate (kg)", `type=number step=0.1`, placeholder „pt. AWB". Nu e obligatoriu |
| Import CSV produse | coloane `nume;oem;pret;stoc;greutate;cost;ani;categorie_slug` — tot doar greutatea |
| Cost livrare la checkout | **LIPSEȘTE, intenționat.** `plaseaza_comanda` scrie `livrare = 0`; validează doar că curierul există în `settings.curieri`, **prețul lui (19,90) nu se mai folosește**. Checkout afișează „La suma de mai sus se adaugă transportul, pe care ți-l comunicăm telefonic" |
| Unde e definit | `supabase/livrare-dupa-comanda.sql` (migrarea 12) |
| Comanda salvează greutatea/dimensiunile? | **Da, dar completate manual de echipă, după plasare**: `livrare_greutate_kg numeric(10,2)` și `livrare_dimensiuni text` (text liber, ex. „40×30×25"). Plus `livrare_baza`, `livrare_km_extra`, `livrare_alte`, `livrare_nota`, `livrare_stabilit_la` |
| Greutatea propusă automat | În formularul de cost livrare, `defaultValue` = suma din piese, cu **același fallback de 5 kg** per piesă fără greutate |

**Concluzie**: `settings.curieri[0].pret = 19.9` a rămas în DB și în `CURIERI_IMPLICITI`, dar e cod mort — nimic nu-l mai citește după migrarea 12.

---

## 3. Fluxul comenzii — cum e ACUM

### Statusuri

`orders.status text not null default 'noua'` — **fără constrângere `check`, fără enum**. Valorile folosite în cod: `noua` · `confirmata` · `expediata` · `livrata` · `anulata` (comentariu în `schema.sql:62`).

⚠️ Orice membru al echipei poate scrie orice string în `status` (politica „comenzi staff update" e `using (is_staff())`, fără `with check`).

Statusuri paralele: `factura_status` (`de_emis`/`emisa`/`stornata`/`nu_se_emite`) — acesta **are** check constraint.

| Cine schimbă statusul | Cum |
|---|---|
| Echipa, din detaliul comenzii | click pe pasul din bara de status → `update orders` direct din browser |
| Echipa, din Expedieri | „Marchează expediate" → `confirmata` → `expediata` |
| `anuleaza_comanda(oid)` | RPC, doar `is_staff()` |
| Automat | **niciodată** — nimic nu avansează singur |

### Ce se întâmplă automat

| Moment | Efect |
|---|---|
| **Plasare** (`plaseaza_comanda`, singura cale) | Prețurile citite din `products` cu `for update` (blocare anti-dublă-vânzare) · reducerea recalculată pe server · verificare `p_total_asteptat` (diferență >0,01 lei → refuz cu „reîncarcă coșul") · număr din `nr_comanda_seq` (`AP-2026-01000`) · `livrare=0`, `total = subtotal − reducere` · insert în `orders` + `order_items` într-o tranzacție · `discount_codes.folosiri++` |
| Trigger `tr_scade_stocul` (after insert on `order_items`) | `stoc = greatest(stoc − cantitate, 0)`; **`publicat = false` la stoc 0** |
| Trigger `tr_jurnal_comanda` (after insert/update on `orders`) | INSERT → eveniment „plasata" cu autor `client`; UPDATE cu status schimbat → „Status schimbat: X → Y", autor din `auth.jwt()->>'email'` |
| **Confirmare** | **NIMIC automat.** Doar schimbarea statusului + o linie în jurnal. Niciun e-mail, niciun SMS, niciun AWB |
| **Anulare** (`anuleaza_comanda`) | Piesele revin pe stoc **și `publicat = true`** · status `anulata` · jurnal |
| **Ștergere** (`sterge_comanda`, doar `is_admin()`) | Repune stocul (dacă nu era deja anulată) · `delete from orders` → `order_items` și `order_events` cad în cascadă |

⚠️ Nici `anuleaza_comanda`, nici `sterge_comanda` **nu decrementează `discount_codes.folosiri`**.

### Butoanele din Admin → Comenzi → detaliu, în ordinea de pe ecran

| # | Buton | Ce face |
|---|---|---|
| 1 | **Anulează** (sus dreapta, roșu) | `confirm()` → RPC `anuleaza_comanda`. Ascuns dacă status = `anulata` sau `livrata` |
| 2 | **Șterge** | `confirm()` → RPC `sterge_comanda` → redirect la listă. Doar admin (funcția verifică) |
| 3 | **Bara de status** — 4 butoane: Nouă / Confirmată / Expediată / Livrată | `update orders set status`. **Nesecvențial** — poți sări de la „nouă" direct la „livrată". Dezactivate dacă e anulată |
| 4 | **Trimite confirmarea / totalul pe WhatsApp** (verde) | link `wa.me` precompletat — vezi textul mai jos |
| 5 | **WhatsApp** (al doilea, verde) | mesaj scurt generic: „Vă contactăm de la Autopas Dezmembrări în legătură cu comanda AP-…" |
| 6 | **E-mail** (negru) | `mailto:` cu subiect „Comanda AP-… — Autopas Dezmembrări", **corp gol**. Deschide clientul de mail al operatorului |
| 7 | **Sună** | `tel:` |
| 8 | **Facturare (Saga)** — câmp + „Salvează" | scrie `factura_serie` + `factura_status='emisa'`, jurnal |
| 9 | **Cost livrare** — formular (greutate, dimensiuni, transport bază*, km extra, alte taxe, explicații) → „Salvează / Recalculează costul livrării" | RPC `seteaza_cost_livrare` → recalculează `total = subtotal − reducere + livrare`, setează `livrare_stabilit_la`, scrie în jurnal linia detaliată |
| 10 | **Generează AWB automat** | Ia token-ul sesiunii → `POST /api/awb` → **întoarce mereu eroarea de stub**. Vizibil **doar dacă `livrare_stabilit_la` e setat și nu există deja AWB** |
| 11 | **„…sau scrie AWB-ul manual" + OK** | scrie `awb` + `awb_generat_la`, jurnal „AWB … introdus manual". **Aceasta e singura cale funcțională azi** |
| 12 | **Notă internă** + „Salvează nota" | `nota_interna`, jurnal |

Blocaje corecte: cât timp `livrare_stabilit_la` e null → banner galben sus + secțiunea Cost livrare cu chenar galben + **butonul AWB nu apare deloc** (motivul scris în UI: rambursul de pe AWB ar diferi de suma acceptată de client).

### Textul precompletat pe WhatsApp (butonul principal)

Se trimite la `o.telefon` cu `0` înlocuit cu `4`:

```
Bună ziua, {nume}! Confirmăm comanda AP-2026-0XXXX de pe autopas.ro:
• {piesă} — {preț} lei
  (…câte o linie pentru fiecare piesă)
Reducere {cod}: −{val} lei          ← doar dacă există
```

Apoi **una din două ramuri**:

| Transport stabilit | Transport nestabilit |
|---|---|
| `Transport: X lei (colet Y kg)` + `{livrare_nota}` + `TOTAL DE PLATĂ: Z lei (ramburs la livrare / transfer bancar).` | `Total produse: Z lei. Vă comunicăm costul transportului imediat ce îl calculăm.` |

Închidere comună: `Livrare prin FAN Courier în 1–3 zile lucrătoare. Vă mulțumim!`
Eticheta butonului se schimbă corespunzător: „Trimite totalul" vs. „Trimite confirmarea".

⚠️ Textul spune **„de pe autopas.ro"** — un al treilea domeniu, diferit și de `autopas-dezmembrari.ro`, și de `.vercel.app`. Vezi secțiunea 6.

---

## 4. Notificări și e-mail

| Verificare | Rezultat |
|---|---|
| nodemailer / resend / sendgrid / smtp / mailgun / postmark / sendMail | **ZERO ocurențe** în cod. Singura potrivire e un text de UI: „E-mail automat «coș abandonat» — necesită serviciu de e-mail (Resend/Brevo)" în pagina Marketing |
| `package.json` dependencies | doar `@supabase/supabase-js`, `next`, `react`, `react-dom`. **Nicio librărie de e-mail** |
| Edge functions Supabase | niciun folder `supabase/functions` |
| Webhook-uri / triggere de notificare în SQL | niciunul |

**Confirmare comandă către client, în afara WhatsApp: NU EXISTĂ NIMIC.**
Singurele lucruri care ating clientul:

1. pagina `/comanda-plasata` (afișată o dată, în browser) — care **promite** ceva ce codul nu face: *„Primești pe e-mail (adresa) factura și numărul AWB pentru urmărirea coletului."*
2. butonul `mailto:` din admin — mail scris manual de operator, din clientul lui de mail.

⚠️ Discrepanță de raportat clientului: pagina de mulțumire promite un e-mail automat cu factura și AWB-ul. Nu există mecanismul.

### Alerta sonoră (`components/admin/NewOrderAlert.tsx`)

| Aspect | Detaliu |
|---|---|
| Funcționează? | **Da**, dar doar cu panoul deschis într-un tab |
| Interval | **30 000 ms = 30 de secunde** (`setInterval`), plus o rulare la montare |
| Interogare | `select id,numar,nume,total from orders where status='noua' order by created_at desc limit 10` |
| Prima rulare | memorează comenzile existente **fără să sune** (evită alarma la deschiderea panoului) |
| La comandă nouă | toast negru jos-dreapta cu numărul/clientul/totalul + buton „Deschide comanda"; titlul tabului devine `(n) Comandă nouă · Autopas` |
| Sunet | 2 note (880 Hz + 1175 Hz) generate cu WebAudio, fără fișier audio; comutator on/off în `localStorage` (`autopas_sunet`), documentat în politica de cookie-uri |
| Montat în | `app/admin/layout.tsx`, deci pe toate paginile de admin |
| ⚠️ Limite | (a) primele 10 comenzi noi — dacă sunt >10 nerezolvate, unele nu se semnalează niciodată; (b) `AudioContext` poate fi blocat de browser până la prima interacțiune a utilizatorului cu pagina; (c) **panou închis = zero notificări**; (d) 30 s × un query = ~2 880 de cereri pe zi de tab deschis |

---

## 5. Golurile pentru predare

### (a) Tariful FAN calculat la checkout

| # | Gol | Mărime |
|---|---|---|
| a1 | Coloane `lungime_cm`, `latime_cm`, `inaltime_cm` pe `products` + migrare SQL + câmpuri în `ProductForm` + coloane în importul CSV | **mic** |
| a2 | Completarea efectivă a greutății/dimensiunilor pe fiecare piesă (muncă de operator, nu de cod) — azi fallback-ul e 5 kg | **mediu** |
| a3 | Client HTTP FAN pentru tarif: login + `/tariff` (sau tabelă de tarife negociate) | **mediu** |
| a4 | Nomenclator localități/județe FAN + selector la checkout (azi text liber, deci destinația nu e validabilă) | **mediu** |
| a5 | Agregare colet: N piese unicat → 1 sau mai multe colete, cu greutate volumetrică | **mediu** |
| a6 | Rescris `plaseaza_comanda` să accepte iar un cost de livrare **calculat pe server** (nu trimis din browser) + revenire pe UI/legal/FAQ | **mediu** |
| a7 | ⚠️ **Decizie de business**, nu de cod: CLAUDE.md consemnează pe 7 aug 2026 decizia explicită de a NU afișa costul la checkout. Punctul (a) contrazice o decizie luată | — |

**Total (a): mare.** Și, mai important, e reversarea unei decizii, nu completarea unui gol.

### (b) AWB generat dintr-o comandă

| # | Gol | Mărime |
|---|---|---|
| b1 | Credențiale reale FAN (contract semnat) — blocaj extern, nu de cod | blocaj |
| b2 | Implementarea a ~30 de linii în `genereazaAwbFan`: `POST /login` → token, `POST /intern-awb` → `awbNumber`, maparea `AwbCerere` pe payload-ul FAN, tratarea erorilor | **mic** |
| b3 | Cache de token (FAN emite token cu durată limitată; azi n-ar exista) | **mic** |
| b4 | Trimiterea dimensiunilor în payload — `livrare_dimensiuni` e text liber „40×30×25", trebuie parsat sau înlocuit cu 3 câmpuri numerice | **mic** |
| b5 | Descărcare/printare etichetă AWB (PDF de la FAN) — azi doar borderoul propriu | **mediu** |
| b6 | Urmărire status colet (`/awb/tracking`) + afișare la client în `/cont` | **mediu** |
| b7 | Anulare AWB când se anulează comanda | **mic** |

**Total (b): mediu.** Restul lanțului (buton, rută, autorizare, blocaj pe cost livrare, salvare `awb`) e deja construit — de asta e ieftin.

### (c) Clientul primește confirmare

| # | Gol | Mărime |
|---|---|---|
| c1 | Serviciu de e-mail (Resend/Brevo) + domeniu verificat + SPF/DKIM | **mic–mediu** |
| c2 | Rută/edge function de trimitere + șabloane (confirmare comandă, cost transport stabilit, AWB expediat) | **mediu** |
| c3 | Declanșatoare: după `plaseaza_comanda`, după `seteaza_cost_livrare`, după setarea AWB-ului | **mic** |
| c4 | ⚠️ **Decizie**: CLAUDE.md consemnează că utilizatorul a **refuzat** Resend. Fără o schimbare de poziție, (c) nu se poate face | — |
| c5 | Alternativă fără e-mail: notificări push în browser (Notification API) sau Realtime Supabase în loc de polling la 30 s — rezolvă doar partea de echipă, nu clientul | **mic** |
| c6 | Corectarea textului din `/comanda-plasata`, care promite azi un e-mail inexistent | **mic** |

**Total (c): mediu**, dar blocat de o decizie, nu de efort.

**Prioritatea de predare, dacă e o singură zi:** b2+b3 (AWB real, o oră de lucru după primirea credențialelor) și c6 (promisiunea falsă din pagina de mulțumire).

---

## 6. Domeniu și configurare

### URL-uri hardcodate cu „vercel.app"

**Niciunul în cod executabil.** Singurele apariții:

| Fișier | Linie | Ce e |
|---|---|---|
| `README.md:60` | „Linkul tău e de forma `https://autopas-....vercel.app`" | documentație |
| `lib/config.ts:33,39` | comentarii care explică mecanismul | comentarii |

Căutarea `https?://…` peste `app/`, `lib/`, `components/` întoarce, în afara link-urilor externe legitime (wa.me, Google Maps, Waze, schema.org, ANPC, legislatie.just.ro), **doar** `https://autopas-dezmembrari.ro` și `http://localhost:3000` — ambele în `lib/config.ts`, ca valori de comentariu/fallback.

### Variabila de mediu

`lib/config.ts:41` — există și e corect construită, cu 3 niveluri:

```
SITE_URL = NEXT_PUBLIC_SITE_URL (fără / final)
        || https://VERCEL_PROJECT_PRODUCTION_URL   ← aici intră .vercel.app
        || http://localhost:3000
```

| Loc | Valoare | Verdict |
|---|---|---|
| `.env.local` (local) | `http://localhost:3000` | corect pentru dezvoltare |
| `.env.local.example` | **nu conține deloc `NEXT_PUBLIC_SITE_URL`** — doar cele 2 chei Supabase | gol de documentație, **mic** |
| Vercel (producție) | **NECLAR** — variabilele din Vercel nu se pot citi din cod | de verificat manual |

**Consecința dacă nu e setată în Vercel:** `SITE_URL` cade pe `https://<proiect>.vercel.app`, iar `metadataBase` (`app/layout.tsx:30`), `sitemap.xml` (toate URL-urile), `robots.txt` (`sitemap:` și `host:`) și adresele absolute Open Graph vor arăta către `.vercel.app`. Nu e un URL hardcodat — e un fallback care se activează în tăcere.

### Unde intră `SITE_URL`

| Fișier | Folosire |
|---|---|
| `app/layout.tsx:30` | `metadataBase` → face absolute canonical-ul și og:image |
| `app/sitemap.ts:35,44,65` | toate URL-urile din sitemap (pagini, legal, piese) |
| `app/robots.ts:41,42` | `sitemap:` și `host:` |

`alternates: { canonical: "/" }` e **relativ**, deci corect — se rezolvă prin `metadataBase`. `openGraph` nu declară `images:` explicit, deci imaginea de partajare vine din convenția de fișiere Next (`opengraph-image` / `public/`), tot relativ la `metadataBase`.

`INDEXARE_PERMISA` = `PERMITE_INDEXARE === "da"`; cât timp nu e setată, `robots.txt` blochează indexarea — deci un `SITE_URL` greșit nu ajunge azi în Google. Se rezolvă înainte de a porni indexarea.

### Supabase Auth — ce URL folosește codul

**Codul nu specifică niciun URL de redirect.** Verificat: zero ocurențe de `redirectTo`, `emailRedirectTo`, `window.location.origin` în tot proiectul.

| Flux | Cod | Ce URL se folosește efectiv |
|---|---|---|
| Înregistrare / confirmare cont | `app/autentificare/page.tsx:20` — `sb.auth.signUp({email, password, options:{data:{nume}}})`, **fără `emailRedirectTo`** | Supabase folosește **Site URL** din Dashboard → Authentication → URL Configuration |
| Autentificare | `signInWithPassword` | fără redirect |
| **Resetare parolă** | **NU EXISTĂ.** Zero apeluri `resetPasswordForEmail` sau `updateUser`; nicio pagină de tip „am uitat parola" | — |

Deci: **tot ce ține de redirect e configurat exclusiv din panoul Supabase**, nu din cod. De verificat manual, în ordine:

1. **Site URL** = `https://autopas-dezmembrari.ro` (nu `.vercel.app`, nu `localhost`)
2. **Redirect URLs** să includă și `http://localhost:3000/**` pentru dezvoltare, și URL-urile de preview Vercel dacă se folosesc
3. Dacă „Confirm email" e pornit în Supabase, un Site URL greșit trimite clienții noi într-un link care nu funcționează

### Gol suplimentar găsit — al treilea domeniu

`app/admin/comenzi/[id]/page.tsx` — mesajul de confirmare pe WhatsApp scrie literal **„de pe autopas.ro"**, hardcodat, nu prin `SITE_URL`. Nu e `.vercel.app`, deci n-a apărut la căutarea cerută, dar e o a treia adresă în circulație, trimisă direct clientului. Dacă `autopas.ro` nu e al firmei, mesajul indică site-ul altcuiva.

### Rezumat secțiunea 6

| Problemă | Mărime |
|---|---|
| `NEXT_PUBLIC_SITE_URL` de confirmat/setat în Vercel (altfel totul cade pe `.vercel.app`) | **mic** — o variabilă + redeploy |
| „autopas.ro" hardcodat în mesajul WhatsApp către client | **mic** |
| `.env.local.example` nu documentează `NEXT_PUBLIC_SITE_URL` și nici `PERMITE_INDEXARE` | **mic** |
| Site URL în Supabase Auth — de verificat manual în panou | **mic**, dar nu din cod |
| Domeniul `autopas-dezmembrari.ro` era neînregistrat la 7 aug 2026 | blocaj extern — **NECLAR** dacă s-a cumpărat între timp |

---

**STOP.** Nimic reparat, niciun fișier de cod atins.
