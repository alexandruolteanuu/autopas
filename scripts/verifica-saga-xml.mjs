#!/usr/bin/env node
// ============================================================
// VERIFICĂRILE GENERATORULUI XML PENTRU SAGA (lib/saga-xml.mjs) — pasul 6
// Fără rețea, fără bază de date: `node scripts/verifica-saga-xml.mjs`.
// Iese cu cod 1 la prima verificare picată.
// ============================================================
import {
  cifCurat, numarPentruSaga, dataPentruSaga, cifPersoanaFizica, esc, suma, cantitate,
  numeFisier, construiesteXml,
} from "../lib/saga-xml.mjs";

let n = 0;
function eq(primit, asteptat, ce) {
  if (primit !== asteptat) { console.error(`PICAT: ${ce}\n  aștept: ${JSON.stringify(asteptat)}\n  primit: ${JSON.stringify(primit)}`); process.exit(1); }
  n++;
}
function arunca(fn, ce) {
  try { fn(); } catch { n++; return; }
  console.error(`PICAT: ${ce} — trebuia să arunce eroare`); process.exit(1);
}

// --- CIF ---
eq(cifCurat("RO 36608590"), "RO36608590", "CIF-ul firmei cu spațiu");
eq(cifCurat(" ro36608590 "), "RO36608590", "CIF cu litere mici și spații la capete");
eq(cifCurat(null), "", "CIF lipsă");

// --- Numărul (exemple: continuare de la 14193) ---
eq(numarPentruSaga("PAP FE", 14193, "serie_lipita"), "PAP FE14193", "număr: serie lipită");
eq(numarPentruSaga("PAP FE", 14193, "serie_spatiu"), "PAP FE 14193", "număr: serie, spațiu");
eq(numarPentruSaga("PAP FE", 14193, "doar_numar"), "14193", "număr: doar numărul");
eq(numarPentruSaga("  PAP FE ", 14193, "serie_spatiu"), "PAP FE 14193", "număr: spații la capetele seriei");
arunca(() => numarPentruSaga("PAP FE", 14193, undefined), "număr fără format ales");
arunca(() => numarPentruSaga("PAP FE", 14193, "altceva"), "număr cu format necunoscut");

// --- Data (zi sub 13, ca inversarea zi/lună să se vadă) ---
eq(dataPentruSaga("2026-11-03", "zi-luna-an"), "03-11-2026", "dată zi-lună-an");
eq(dataPentruSaga("2026-11-03", "zi.luna.an"), "03.11.2026", "dată zi.lună.an");
eq(dataPentruSaga("2026-11-03", "an-luna-zi"), "2026-11-03", "dată an-lună-zi");
eq(dataPentruSaga("2026-11-10T00:00:00", "zi-luna-an"), "10-11-2026", "dată cu oră după ea");
arunca(() => dataPentruSaga("2026-11-03", null), "dată fără format ales");
arunca(() => dataPentruSaga("10.11.2026", "zi-luna-an"), "dată în format greșit la intrare");

// --- Client persoană fizică ---
eq(cifPersoanaFizica("gol"), "", "PF: gol");
eq(cifPersoanaFizica(undefined), "", "PF: nesetat = gol (ca pe factura reală)");
eq(cifPersoanaFizica("liniuta"), "-", "PF: liniuță");
eq(cifPersoanaFizica("treisprezece_zerouri"), "0000000000000", "PF: 13 zerouri");

// --- Escape, sume, cantități ---
eq(esc(`Far & „stânga" <Golf> 'x'`), "Far &amp; „stânga&quot; &lt;Golf&gt; &apos;x&apos;", "escape XML");
eq(esc("a\u0001b\u001Fc\td"), "abc\td", "caracterele de control scoase, tab păstrat");
eq(suma(165.29), "165.29", "sumă cu 2 zecimale");
eq(suma("165.2900", 4), "165.2900", "preț cu 4 zecimale");
eq(suma(-34.71), "-34.71", "sumă negativă (storno / reducere)");
eq(cantitate("1.000"), "1", "cantitate 1.000 → 1");
eq(cantitate(-1), "-1", "cantitate negativă");
eq(cantitate("2.500"), "2.5", "cantitate cu zecimale");
arunca(() => suma("abc"), "sumă invalidă");

// --- Factura de referință (exemplu: 200,00 → 165,29 + 34,71, unitar 165,2900) ---
const factura = {
  id: 1234, serie: "PAP FE", numar: 14193, data: "2026-11-03", scadenta: "2026-11-03",
  mentiune_plata: "ramburs in cont", observatii: "Comanda AP-2026-01796",
  furnizor: { denumire: "PIESE AUTO PAS SRL", cui: "RO 36608590", reg_com: "J27/893/2016", capital: "200 RON",
              tara: "RO", localitate: "Alexandru Cel Bun", cod_judet: "NT", adresa: "Str. Petru Rareș nr. 181",
              telefon: "0743 627 151", email: "contact@autopas-dezmembrari.ro", banca: "BCR Piatra Neamt", iban: "RO00 TEST 0000" },
  client: { tip: "pf", nume: "Ion Popescu", cod_judet: "IS", tara: "RO", localitate: "Iași", adresa: "Str. A 1 & B",
            telefon: "0700", email: "i@t.ro" },
  linii: [
    { nr_crt: 2, descriere: "ACCESORII AUTO", cod_articol_saga: "ART1", cod_intern: null, denumire_site: "Reducere cod X",
      um: "BUC", cantitate: 1, pret_fara_tva: -8.2645, valoare: -8.26, cota_tva: 21, tva: -1.74 },
    { nr_crt: 1, descriere: "ACCESORII AUTO", cod_articol_saga: "ART1", cod_intern: "AP-000123",
      denumire_site: "Far stânga Golf 6 <xenon>", um: "BUC", cantitate: "1.000", pret_fara_tva: "165.2900",
      valoare: "165.29", cota_tva: "21.00", tva: "34.71" },
  ],
};
const opt = { format_numar: "serie_spatiu", format_data: "zi-luna-an", tva_la_incasare: "nu", cif_persoana_fizica: "gol" };
const xml = construiesteXml([factura], opt);

const are = (s, ce) => { if (!xml.includes(s)) { console.error(`PICAT: ${ce} — lipsește ${s}`); process.exit(1); } n++; };
are('<?xml version="1.0" encoding="UTF-8"?>', "antetul XML");
are("<FurnizorCIF>RO36608590</FurnizorCIF>", "CIF-ul firmei curățat");
are("<FurnizorJudet>NT</FurnizorJudet>", "codul județului firmei");
are("<FurnizorIBAN>RO00TEST0000</FurnizorIBAN>", "IBAN fără spații");
are("<ClientNume>Ion Popescu</ClientNume>", "numele clientului PF");
are("<ClientCIF></ClientCIF>", "ClientCIF gol pentru PF");
are("<ClientJudet>IS</ClientJudet>", "codul județului clientului");
are("<ClientAdresa>Str. A 1 &amp; B</ClientAdresa>", "adresa escape-uită");
are("<FacturaNumar>PAP FE 14193</FacturaNumar>", "numărul în formatul ales");
are("<FacturaData>03-11-2026</FacturaData>", "data în formatul ales");
are("<FacturaTVAIncasare>Nu</FacturaTVAIncasare>", "TVA la încasare");
are("<FacturaInformatiiSuplimentare>ramburs in cont; Comanda AP-2026-01796</FacturaInformatiiSuplimentare>", "mențiunea de plată + comanda");
are("<CodArticolClient>ART1</CodArticolClient>", "codul articolului din gestiune");
are("<GUID_cod_articol>AP-000123</GUID_cod_articol>", "codul intern al piesei");
are("<InformatiiSuplimentare>Far stânga Golf 6 &lt;xenon&gt;</InformatiiSuplimentare>", "numele piesei de pe site");
are("<Cantitate>1</Cantitate>", "cantitatea");
are("<Pret>165.2900</Pret>", "prețul unitar fără TVA, 4 zecimale (factura reală)");
are("<Valoare>165.29</Valoare>", "valoarea (factura reală)");
are("<ProcTVA>21</ProcTVA>", "cota");
are("<TVA>34.71</TVA>", "TVA-ul (factura reală)");
are("<Valoare>-8.26</Valoare>", "linia de reducere, negativă");
are("<GUID_factura>1234</GUID_factura>", "GUID_factura = id-ul intern");
eq(xml.indexOf("<LinieNrCrt>1</LinieNrCrt>") < xml.indexOf("<LinieNrCrt>2</LinieNrCrt>"), true, "liniile în ordinea nr_crt");
eq((xml.match(/<GUID_cod_articol>/g) ?? []).length, 1, "GUID_cod_articol doar pe linia cu cod intern");

// Bine format: fiecare etichetă deschisă e închisă, în ordine; niciun „&” nescăpat.
{
  const stiva = [];
  for (const m of xml.replace(/<\?xml[^>]*\?>/, "").matchAll(/<(\/?)([A-Za-z_]+)>/g)) {
    if (!m[1]) stiva.push(m[2]);
    else if (stiva.pop() !== m[2]) { console.error(`PICAT: etichete încrucișate la </${m[2]}>`); process.exit(1); }
  }
  eq(stiva.length, 0, "toate etichetele închise");
  eq(/&(?!amp;|lt;|gt;|quot;|apos;)/.test(xml), false, "niciun & nescăpat");
}

// Client firmă.
const xmlFirma = construiesteXml([{ ...factura, client: { ...factura.client, tip: "firma", firma: "CLIENT SRL", cui: "ro 999" } }], opt);
eq(xmlFirma.includes("<ClientNume>CLIENT SRL</ClientNume>"), true, "firmă: numele firmei");
eq(xmlFirma.includes("<ClientCIF>RO999</ClientCIF>"), true, "firmă: CUI-ul curățat");
eq(xmlFirma.includes("Persoană de contact: Ion Popescu"), true, "firmă: persoana de contact");

// Opțiunile fără implicit → refuz.
arunca(() => construiesteXml([factura], { ...opt, format_numar: undefined }), "XML fără format_numar");
arunca(() => construiesteXml([factura], { ...opt, format_data: "" }), "XML fără format_data");
arunca(() => construiesteXml([factura], { ...opt, tva_la_incasare: undefined }), "XML fără TVA la încasare");
arunca(() => construiesteXml([{ ...factura, linii: [] }], opt), "factură fără linii");

// Numele fișierului.
eq(numeFisier(factura, opt), "F_RO36608590_PAP_FE_14193_03_11_2026.xml", "numele fișierului");
eq(numeFisier(factura, { ...opt, format_numar: "doar_numar" }), "F_RO36608590_14193_03_11_2026.xml", "numele fișierului, doar număr");

console.log(`TOATE CELE ${n} VERIFICĂRI XML AU TRECUT`);
