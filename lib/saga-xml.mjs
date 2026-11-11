// ============================================================
// XML-UL FACTURILOR PENTRU SAGA (pasul 6 din docs/saga-plan.md, 10 noiembrie 2026)
//
// Funcții PURE: din datele unei facturi (rândul din `facturi` + liniile din
// `facturi_linii`, așa cum au fost COPIATE la emitere) → textul XML și numele
// fișierului, în formatul din documentația SAGA (docs/saga-api.md, secțiunea 5).
// Fără bază de date, fără rețea: se folosesc și în browser („Descarcă XML”), și pe
// server (trimiterea, pasul 8), și din `scripts/verifica-saga-xml.mjs`.
//
// DOUĂ LUCRURI NU SE ȘTIU ÎNCĂ și sunt, fiecare, o SINGURĂ funcție de aici
// (planul, A.4; întrebarea 1 pentru contabilă):
//   · cum se scrie numărul — `numarPentruSaga` („PAP FE14193” / „PAP FE 14193” / „14193”);
//   · cum se scrie data — `dataPentruSaga` („10-11-2026” / „10.11.2026” / „2026-11-10”).
// Formatul vine din setări (`format_numar`, `format_data`) și NU are valoare
// implicită: fără el, `construiesteXml` refuză. Indiciile (nu confirmări) arată
// spre „serie_spatiu” și „zi-luna-an” — se confirmă la proba manuală din SAGA.
// ============================================================

// Ordinea e cea din listele din admin: varianta cea mai probabilă întâi (ca în Integrări).
export const FORMATE_NUMAR = ["serie_spatiu", "serie_lipita", "doar_numar"];
export const FORMATE_DATA = ["zi-luna-an", "zi.luna.an", "an-luna-zi"];
export const VARIANTE_CIF_PF = ["gol", "liniuta", "treisprezece_zerouri"];

/** CIF fără spații și cu majuscule: „RO 36608590” → „RO36608590”. SAGA pune factura la
 *  Ieșiri doar dacă `FurnizorCIF` e exact CIF-ul firmei (planul, A.16). */
export function cifCurat(cif) {
  return String(cif ?? "").replace(/\s+/g, "").toUpperCase();
}

/** Numărul facturii așa cum îl cere SAGA în `FacturaNumar`. */
export function numarPentruSaga(serie, numar, format) {
  const s = String(serie ?? "").trim();
  const n = String(numar);
  if (format === "serie_lipita") return s + n;
  if (format === "serie_spatiu") return `${s} ${n}`;
  if (format === "doar_numar") return n;
  throw new Error(`Formatul numărului pentru SAGA nu e ales (format_numar: ${format ?? "nesetat"}).`);
}

/** Data (AAAA-LL-ZZ, cum vine din bază) în formatul cerut de SAGA. */
export function dataPentruSaga(data, format) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(data ?? ""));
  if (!m) throw new Error(`Data „${data}” nu e în formatul AAAA-LL-ZZ.`);
  const [, a, l, z] = m;
  if (format === "zi-luna-an") return `${z}-${l}-${a}`;
  if (format === "zi.luna.an") return `${z}.${l}.${a}`;
  if (format === "an-luna-zi") return `${a}-${l}-${z}`;
  throw new Error(`Formatul datei pentru SAGA nu e ales (format_data: ${format ?? "nesetat"}).`);
}

/** Ce se trimite la `ClientCIF` pentru o persoană fizică (fără CNP pe factura reală). */
export function cifPersoanaFizica(varianta) {
  if (varianta === "liniuta") return "-";
  if (varianta === "treisprezece_zerouri") return "0000000000000";
  return "";   // „gol” sau nesetat: ca pe factura reală
}

/** Escape XML: & < > " ' și scoaterea caracterelor de control (interzise în XML 1.0). */
export function esc(v) {
  return String(v ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** Suma cu exact `zec` zecimale și punct zecimal („165.29”). Intrarea vine din bază
 *  (numeric → număr sau text); nu se recalculează nimic aici, doar se scrie. */
export function suma(v, zec = 2) {
  const x = Number(v);
  if (!Number.isFinite(x)) throw new Error(`Valoare numerică invalidă: ${v}`);
  return x.toFixed(zec);
}

/** Cantitatea fără zerouri inutile: 1 → „1”, 1.5 → „1.5”, -1 → „-1”. */
export function cantitate(v) {
  const x = Number(v);
  if (!Number.isFinite(x)) throw new Error(`Cantitate invalidă: ${v}`);
  return String(Number(x.toFixed(3)));
}

const el = (nume, val) => `<${nume}>${esc(val)}</${nume}>`;

/**
 * Numele fișierului: „F_<cod-fiscal>_<numar-factura>_<data-factura>.xml” (docs/saga-api.md).
 * Spațiile din număr devin „_”; data e zi_luna_an, ca în exemplul din documentație
 * („F_123123_15_09_2026.xml”) — independent de formatul datei DIN XML.
 */
export function numeFisier(factura, optiuni) {
  const cif = cifCurat(factura.furnizor?.cui).replace(/[^A-Z0-9]/g, "");
  const nr = numarPentruSaga(factura.serie, factura.numar, optiuni.format_numar).replace(/[^A-Za-z0-9-]+/g, "_");
  const [a, l, z] = String(factura.data).slice(0, 10).split("-");
  return `F_${cif}_${nr}_${z}_${l}_${a}.xml`;
}

/**
 * XML-ul pentru una sau mai multe facturi (`<Facturi>` cu câte un `<Factura>`).
 * `facturi`: [{ ...rândul din `facturi`, linii: [...rândurile din `facturi_linii`] }].
 * `optiuni`: { format_numar, format_data, tva_la_incasare: "da"|"nu", cif_persoana_fizica }.
 * Aruncă eroare dacă lipsește o opțiune fără implicit — nu ghicește.
 */
export function construiesteXml(facturi, optiuni) {
  if (!FORMATE_NUMAR.includes(optiuni?.format_numar)) numarPentruSaga("", 0, optiuni?.format_numar);
  if (!FORMATE_DATA.includes(optiuni?.format_data)) dataPentruSaga("2000-01-01", optiuni?.format_data);
  if (optiuni.tva_la_incasare !== "da" && optiuni.tva_la_incasare !== "nu")
    throw new Error("„TVA la încasare” nu e ales (da / nu) — întrebare pentru contabilă.");

  const bucati = ['<?xml version="1.0" encoding="UTF-8"?>', "<Facturi>"];
  for (const f of facturi) {
    if (!f.linii || f.linii.length === 0) throw new Error(`Factura ${f.serie} ${f.numar} nu are linii.`);
    const fu = f.furnizor ?? {};
    const c = f.client ?? {};
    const eFirma = c.tip === "firma";
    const infoFactura = [f.mentiune_plata, f.observatii].filter((x) => x && String(x).trim()).join("; ");

    bucati.push("<Factura>", "<Antet>",
      el("FurnizorNume", fu.denumire), el("FurnizorCIF", cifCurat(fu.cui)), el("FurnizorNrRegCom", fu.reg_com),
      el("FurnizorCapital", fu.capital), el("FurnizorTara", fu.tara || "RO"), el("FurnizorLocalitate", fu.localitate),
      el("FurnizorJudet", fu.cod_judet), el("FurnizorAdresa", fu.adresa), el("FurnizorTelefon", fu.telefon),
      el("FurnizorMail", fu.email), el("FurnizorBanca", fu.banca), el("FurnizorIBAN", String(fu.iban ?? "").replace(/\s+/g, "")),
      el("FurnizorInformatiiSuplimentare", ""),
      el("ClientNume", eFirma ? (c.firma || c.nume) : c.nume),
      el("ClientInformatiiSuplimentare", eFirma && c.firma && c.nume ? `Persoană de contact: ${c.nume}` : ""),
      el("ClientCIF", eFirma ? cifCurat(c.cui) : cifPersoanaFizica(optiuni.cif_persoana_fizica)),
      el("ClientNrRegCom", c.nr_reg_com), el("ClientJudet", c.cod_judet), el("ClientTara", c.tara || "RO"),
      el("ClientLocalitate", c.localitate), el("ClientAdresa", c.adresa), el("ClientBanca", ""), el("ClientIBAN", ""),
      el("ClientTelefon", c.telefon), el("ClientMail", c.email),
      el("FacturaNumar", numarPentruSaga(f.serie, f.numar, optiuni.format_numar)),
      el("FacturaData", dataPentruSaga(f.data, optiuni.format_data)),
      el("FacturaScadenta", dataPentruSaga(f.scadenta || f.data, optiuni.format_data)),
      el("FacturaTaxareInversa", "Nu"),
      el("FacturaTVAIncasare", optiuni.tva_la_incasare === "da" ? "Da" : "Nu"),
      el("FacturaInformatiiSuplimentare", infoFactura),
      el("FacturaMoneda", "RON"),
      "</Antet>", "<Detalii>", "<Continut>");

    for (const l of [...f.linii].sort((a, b) => a.nr_crt - b.nr_crt)) {
      bucati.push("<Linie>",
        el("LinieNrCrt", l.nr_crt), el("Descriere", l.descriere), el("CodArticolClient", l.cod_articol_saga),
        ...(l.cod_intern ? [el("GUID_cod_articol", l.cod_intern)] : []),
        el("InformatiiSuplimentare", l.denumire_site),
        el("UM", l.um), el("Cantitate", cantitate(l.cantitate)), el("Pret", suma(l.pret_fara_tva, 4)),
        el("Valoare", suma(l.valoare)), el("ProcTVA", String(Number(l.cota_tva))), el("TVA", suma(l.tva)),
        "</Linie>");
    }
    bucati.push("</Continut>", "</Detalii>", el("GUID_factura", f.id), "</Factura>");
  }
  bucati.push("</Facturi>");
  return bucati.join("\n") + "\n";
}
