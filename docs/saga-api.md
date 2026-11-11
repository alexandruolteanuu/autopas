# SAGA WEB API – note pentru integrare (Autopas Dezmembrări)

Sursa: https://web.sagasoft.ro/DocumentatieAPI (citită pe 10.11.2026, versiunea API `v20260225`)
Articol oficial: https://www.sagasoftware.ro/saga-web-api-uri-pentru-dezvoltatori/

> Acest fișier este un rezumat de lucru. La orice nelămurire, sursa de adevăr este documentația oficială de mai sus.

---

## 1. Autentificare

- Cheia de acces se generează în SAGA WEB de un utilizator **Admin**: Utilizatori → Integrare API → Generează cheie de acces.
- Fiecare request trimite două headere:
  - `Authorization: Bearer <CHEIE_ACCES>`
  - `X-Saga-Cod-Fiscal: <CUI_FIRMA>`
- **Rotirea cheii (CRITIC):** uneori răspunsul conține headerul `X-Saga-Refresh-Token` cu o cheie nouă.
  Cheia nouă TREBUIE salvată și folosită la apelul următor. Dacă nu, cheia se blochează și trebuie generată alta manual.
  - Consecințe pentru implementare:
    - cheia curentă se păstrează în baza de date (nu doar în `.env`);
    - după FIECARE răspuns (inclusiv erori) se verifică headerul și se salvează cheia nouă;
    - apelurile către SAGA se fac pe rând (un singur apel simultan, cu lock), altfel două apeluri paralele pot folosi o cheie veche și o pot bloca.
- Endpoint-urile sunt unice per cod fiscal (identificat prin headerul `X-Saga-Cod-Fiscal`).

## 2. Endpoint: Import date

- `POST https://web.sagasoft.ro/api/v20260225/Import`
- Body: `multipart/form-data`
  - `file` – fișierul XML (cu numele în formatul cerut, vezi mai jos)
  - `importAutomat` – `"true"` / `"false"` (implicit `false`)
- `importAutomat = false` → fișierul doar se încarcă; importul se finalizează manual în SAGA WEB din **Diverse → Import date** (operatorul poate verifica/corecta înainte).
  **Acesta este modul dorit pentru Autopas** (clientul vrea să poată modifica denumirea produselor înainte de validare).
- `importAutomat = true` → importul se finalizează automat.

### Coduri de răspuns

| Status | Semnificație | Corp răspuns |
|---|---|---|
| 200 | import realizat integral cu succes | JSON `{ "success": true, "message": "..." }` |
| 207 | import realizat parțial / cu avertizări | **fișier text** (raport), nume în `Content-Disposition` |
| 422 | import eșuat în totalitate | **fișier text** (raport) |
| 400 | request eronat (ex: XML invalid) | JSON `{ "success": false, "message": "Fisier XML invalid." }` |

Exemplu de raport text (207/422):

```
Raport Import F_123123_15_09_2026.xml

Factura 1.
     NR_DOC: A100
     Eroare antet: Factura a fost importata sau operata manual deja.
Factura 3.
     NR_DOC: A1002
     Eroare: Completati clientul.
```

Raportul trebuie parsat pe fiecare factură (după `NR_DOC`) ca să știm care a reușit și care nu.
Mesajul „Factura a fost importata sau operata manual deja” = duplicat; se tratează ca „deja în SAGA”, nu ca eroare fatală.

## 3. Endpoint: Preluare articol (util pentru potrivirea pieselor cu gestiunea)

- `GET https://web.sagasoft.ro/api/v20260225/Situatii/GetArticol?codArticol=<COD>`
- 200 → **XML**, exemplu:

```xml
<Articol>
  <Denumire>ARTICOL</Denumire>
  <TVA>11</TVA>
  <UM>BUC</UM>
  <Pret_Vanzare1>100</Pret_Vanzare1>
  <Pret_Vanzare1_cuTVA>110</Pret_Vanzare1_cuTVA>
  <Pret_Vanzare2>1000</Pret_Vanzare2>
  <Pret_Vanzare2_cuTVA>1100</Pret_Vanzare2_cuTVA>
  <Cod_Bare>692648521232</Cod_Bare>
  <Cod_NC></Cod_NC>
  <Cod_CPV></Cod_CPV>
  <Informatii_Suplimentare>Acesta este un exemplu</Informatii_Suplimentare>
  <Cod_Propriu>0</Cod_Propriu>
</Articol>
```

- 400 → JSON `{ "success": false, "error": "Nu ati trimis un cod de articol valid" }`

## 4. Alte endpoint-uri (nefolosite deocamdată)

Toate `GET`, prefix `https://web.sagasoft.ro/api/v20260225/Situatii/`:
- `GetStocArticol` – stocul unui articol (codArticol, opțional gestiune și dată)
- situații stocuri pe perioadă, sold cont, balanță

**Nu există** endpoint pentru citirea, modificarea sau ștergerea facturilor. Corecturile se fac în SAGA WEB.

## 5. Formatul XML pentru facturi

- Numele fișierului: `F_<cod-fiscal>_<numar-factura>_<data-factura>.xml`
- Mai multe facturi într-un fișier: se repetă `<Factura>...</Factura>` în `<Facturi>`.
- Dacă `<FurnizorCIF>` = CUI-ul firmei → factura merge în **Ieșiri** (vânzări). Pentru Autopas, CUI-ul Autopas este la `FurnizorCIF`.
- Model real de XML: din SAGA, ecranul Ieșiri → tipărire → „Formular PDF” → XML-ul apare în `TEMP\Facturi`. De folosit ca referință (`docs/factura-model.xml`).

### Structură

```
<Facturi>
  <Factura>
    <Antet>
      FurnizorNume, FurnizorCIF, FurnizorNrRegCom, FurnizorCapital, FurnizorTara,
      FurnizorLocalitate, FurnizorJudet, FurnizorAdresa, FurnizorTelefon, FurnizorMail,
      FurnizorBanca, FurnizorIBAN, FurnizorInformatiiSuplimentare

      GUID_cod_client   (opț. – ID-ul clientului din aplicația noastră; SAGA reține asocierea)
      ClientNume, ClientInformatiiSuplimentare, ClientCIF, ClientNrRegCom,
      ClientJudet       (cod județ, ex: NT, doar România)
      ClientTara        (cod țară, ex: RO, FR)
      ClientLocalitate, ClientAdresa, ClientBanca, ClientIBAN, ClientTelefon, ClientMail

      FacturaNumar, FacturaData, FacturaScadenta
      FacturaTaxareInversa   (Da/Nu)
      FacturaTVAIncasare     (Da/Nu)
      FacturaTip             (opț.: " " factură, "A" aviz, "B" bon, "T" taxare inversă, "C" bon cu CF)
      FacturaInformatiiSuplimentare
      FacturaMoneda          (opț. pentru RON)
      FacturaGreutate, FacturaAgent, FacturaAccize
      FacturaIndexSPV, FacturaIndexDescarcareSPV   (opț., ID-uri e-Factura)
      Cod                    (opț., codul clientului din SAGA)
    </Antet>
    <Detalii>
      <Continut>
        <Linie>
          LinieNrCrt
          Gestiune               (opț., cod gestiune – doar evidență cantitativ-valorică)
          Activitate, Proiect    (opț.)
          Descriere
          CodArticolClient       (opț., codul articolului din SAGA pentru facturi de IEȘIRE)
          GUID_cod_articol       (opț., codul produsului din aplicația noastră; SAGA reține asocierea)
          CodBare                (opț.)
          InformatiiSuplimentare (opț. – aici punem denumirea completă a piesei de pe site)
          UM, Cantitate, Pret, Valoare
          ProcTVA                (procentul TVA)
          TVA                    (valoarea TVA)
          Cont                   (opț.)
        </Linie>
      </Continut>
    </Detalii>
    <FacturaID> sau <GUID_factura>   (opț. – ID unic din aplicația noastră; SAGA reține asocierea)
  </Factura>
</Facturi>
```

(`CodArticolFurnizor`, `TipDeducere`, `PretVanzare` sunt doar pentru facturi de intrare – nu ne interesează.)

## 6. Decizii de implementare pentru Autopas

1. Import cu `importAutomat = false` → clientul verifică și poate schimba denumirea în SAGA înainte de validare.
2. Fiecare factură primește `GUID_factura` = ID-ul intern din aplicație (identificare sigură, evită dublurile).
3. Linii: articolul din gestiunea SAGA (prin tabela de potrivire categorie site → `CodArticolClient`), iar numele complet al piesei în `InformatiiSuplimentare`.
4. ~~Serie de facturi separată~~ — decizia din 10.11.2026: aplicația continuă seria **„PAP FE”** (vezi `docs/saga-plan.md`, A.4).
5. Cheia API în baza de date, cu rotire automată și apeluri serializate (vezi secțiunea 1).
6. ~~Testare întâi pe instanța de test SAGA~~ — decizia din 11.11.2026: **fără instanță de test**, direct pe contul real; cheia doar din admin, „Testează conexiunea” doar cu `GetArticol`, probele de import pe seria PROBA cu `importAutomat = false` (vezi `docs/saga-plan.md`, D.5).

## 7. De confirmat cu contabila / clientul

- Seria de facturi pentru aplicație.
- Lista articolelor din gestiunea SAGA (coduri + denumiri) pentru tabela de potrivire.
- Regimul de TVA pentru piesele second-hand (normal sau TVA pe marjă) și cotele aplicabile.
- Dacă firma ține evidență cantitativ-valorică (contează pentru `Gestiune` și codurile de articol).
- Cine trimite factura în e-Factura (SAGA, după validare – recomandat).
