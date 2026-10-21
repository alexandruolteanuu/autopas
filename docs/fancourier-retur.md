# Retururi prin FAN Courier — ce e gata și ce ai de făcut

Scris la 21 octombrie 2026, după documentația primită de la FAN
(`docs/fancourier/RO_FANCourier_API 2.0 250723 anexa1.pdf`).

**Codul e gata și verificat pe API-ul real al FAN.** Nu merge încă un singur
lucru: contul. Până îl faci, panoul din admin spune limpede că nu e configurat
și nu cheamă pe nimeni.

---

## 1. Ce face, când va fi pornit

Clientul completează formularul de retur de pe site (ca până acum). În
**Admin → Cereri → Retururi**, pe cererea lui, apare butonul **„AWB de retur
(FAN)”**. Îl deschizi și:

1. **Adresa vine singură** din comanda la care se referă cererea. Formularul de
   retur nu cere adresa — de asta cererea se leagă de comandă după numărul
   scris de client. Dacă numărul e scris greșit și comanda nu se găsește,
   panoul ți-o spune și scrii adresa de mână.
2. **Scrii coletul**: câte colete, câte kg și cele trei dimensiuni. Le afli de
   la client, pe care oricum îl suni. *Dimensiunile sunt obligatorii la retur* —
   nu pentru AWB, ci pentru comanda de curier, care fără ele e refuzată
   (verificat: HTTP 422).
3. **„Cât costă returul”** — tariful FAN, defalcat. Cine plătește ține de motiv:
   la retragerea în 14 zile îl suportă clientul (așa scrie politica noastră de
   retur), la o piesă neconformă îl suportăm noi.
4. **„Generează AWB de retur + comandă curierul”** — se fac amândouă deodată.
   Alegi ziua; intervalul e 09:00–14:00, singurul valid oriunde în țară.

**Curierul aduce eticheta printată.** Clientul care returnează o piesă n-are de
ce să aibă imprimantă — de asta numărul AWB pleacă în comanda de curier, ceea ce
face FAN să o printeze la ridicare. Eticheta se poate printa și din panou, dacă
vrea clientul s-o aibă.

---

## 2. Ce ai TU de făcut (pașii, în ordine)

### Pasul 1 — creezi contul ocazional în SelfAWB

Un cont de **client ocazional** (fără contract). E altul decât contul vostru de
livrare: contul cu contract poate trimite doar colete care pleacă de la voi, iar
la retur coletul pleacă de la client.

Se creează din interfața SelfAWB. (Se poate și prin API, cu `POST /register`,
dar n-are rost: e o singură dată, iar parola și adresa de e-mail trebuie să fie
alese de voi.)

La creare se cer: adresa de e-mail (= utilizatorul), o parolă cu majusculă,
minusculă, cifră și caracter special, și adresa firmei.

### Pasul 2 — îi scrii lui FAN

La **cristian.branzan@fancourier.ro** (sau presales@fancourier.ro), cum au cerut:

> - adresa de email folosită pentru crearea contului;
> - numele clientului cu contract de care trebuie asociată plata.

Pentru al doilea: **PIESE AUTO PAS SRL**, client ID **7108882**.

### Pasul 3 — primești de la ei două lucruri

1. **Client ID-ul** contului ocazional;
2. **valoarea pentru câmpul „payment”**.

⚠️ **Valoarea asta nu se ghicește.** Am încercat pe API-ul lor: și `sender`, și
`recipient` generează AWB-ul fără nicio eroare, cu exact același tarif. Deci
dacă pui ce crezi tu, totul pare că merge, dar plata ajunge pe cine nu trebuie
și afli din factură. Se pune **exact** ce scriu ei.

### Pasul 4 — le pui în panou

**Admin → Integrări → „FAN Courier — retururi”**: Client ID, utilizatorul
(e-mailul contului ocazional), parola, valoarea `payment`. Salvezi, apoi apeși
**„Verifică retururile”** — trebuie să apară serviciile contului și adresa la
care vor veni coletele.

Verifică adresa aceea: dacă e greșită, **toate** retururile pleacă în altă parte.
Implicit e `Str. Petru Rares nr. 181, Bistrita, jud. Neamt` — forma din
nomenclatorul FAN, verificată în `fan_localitati` (agenția Piatra-Neamț, 0 km
suplimentari). Se poate schimba din aceleași câmpuri.

### Pasul 5 — rulezi migrarea SQL

`supabase/retur-fan.sql` (migrarea 46), în Supabase. Adaugă pe
`return_requests`: legătura cu comanda, adresa de ridicare și câmpurile AWB-ului.
Nu atinge niciun rând existent și se poate re-rula oricând.

---

## 3. Ce s-a verificat deja, și cum

`node scripts/verifica-retur-fan.mjs` — rulează pe **contul de probă al FAN**
(cel din anexa lor), deci merge și acum, fără contul vostru. Cheamă funcțiile
noastre reale, nu o copie a lor, creează un AWB și o comandă de curier, apoi le
șterge pe amândouă.

La 21 octombrie 2026 a trecut 15/15:

| Ce | Rezultat |
|---|---|
| Autentificare pe cont ocazional | 15 servicii, inclusiv Standard |
| Tarif retur Cluj-Napoca → Bistrița, 2 kg, 40×30×20 | 47,18 lei cu TVA |
| AWB de retur (expeditor = clientul) | generat |
| Comandă de curier | plasată, cu id |
| Eticheta PDF pe contul ocazional | ~33 KB |
| Ștergerea AWB-ului și anularea comenzii | amândouă |

Când ai contul vostru, îl rulezi pe el:

```bash
FANCOURIER_RETUR_CLIENT_ID=… FANCOURIER_RETUR_USER=… FANCOURIER_RETUR_PASS=… \
  node scripts/verifica-retur-fan.mjs
```

Creează și la voi un AWB de probă, pe care îl șterge imediat.

---

## 4. Lucruri care te pot încurca

- **Comanda de curier e separată de AWB.** La livrările obișnuite nu comandăm
  curierul (vine zilnic la depozit); la retur, nimeni nu știe că trebuie să
  treacă pe la client. De asta se plasează automat. Dacă AWB-ul iese dar comanda
  de curier pică, panoul scrie cu roșu că trebuie comandată din selfawb.ro —
  **AWB-ul nu se anulează** în cazul ăsta, fiindcă există deja la FAN.
- **Ștergerea** scoate întâi comanda de curier, apoi AWB-ul. Dacă FAN spune că
  nu mai există, se consideră reușită: rezultatul dorit e atins.
- **Localitatea trebuie să existe la FAN.** Județul și localitatea se aleg din
  nomenclator, ca la checkout. Diacriticele se scot automat („Broșteni” →
  „Brosteni”), altfel FAN refuză adresa.
- **Data ridicării** nu poate fi în trecut (FAN răspunde 422), iar intervalul de
  ridicare trebuie să aibă minimum 2 ore.
- **Tariful depinde de dimensiuni** la retur — la 2 kg Cluj→Bistrița, 39,36 lei
  fără dimensiuni și 47,18 lei cu 40×30×20. Deci merită întrebat clientul exact.
