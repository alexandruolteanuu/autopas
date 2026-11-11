// ============================================================
// TRIMITEREA UNEI FACTURI ÎN SAGA (pasul 8 din docs/saga-plan.md, 11 noiembrie 2026)
//
// O factură = un fișier = un apel. „Trimite selectate” din Facturi cheamă ruta de
// câteva ori la rând, din browser — fiecare apel încape așa în 60 s, iar un răspuns
// privește o singură factură (fără ghicit care din fișier a reușit).
//
// Ordinea, de care depinde siguranța:
//   1. setările obligatorii (formatul numărului, al datei, TVA la încasare) — înainte
//      de orice: lipsă = nimic atins;
//   2. XML-ul și numele fișierului se construiesc ÎNAINTE de a atinge factura;
//   3. factura se REVENDICĂ atomic (`de_trimis` / `eroare` / `in_curs` uitat → `in_curs`):
//      două tab-uri nu pot trimite aceeași factură;
//   4. apelul — prin `importaFacturi`, adică prin lacătul și rotirea cheii din
//      lib/saga-api.mjs;
//   5. starea după răspuns (`stareDupaImport`). Dacă apelul n-a ajuns la SAGA sau SAGA
//      a refuzat cheia, factura revine unde era. Dacă nu știm ce s-a întâmplat (timeout,
//      rețea), trece în „eroare” cu „rezultat necunoscut”: la reîncercare, SAGA spune
//      singur dacă o are deja.
//
// Fără bază de date proprie: totul prin `depozit` (lib/saga.ts dă varianta reală),
// ca să poată fi verificat pe un SAGA simulat (scripts/verifica-saga-api.mjs).
// ============================================================
import { construiesteXml, numeFisier, numarPentruSaga, stareDupaImport } from "./saga-xml.mjs";
import { EroareSaga } from "./saga-api.mjs";

/** După cât timp un „in_curs” e socotit uitat (funcție omorâtă la jumătate). Peste
 *  termenul lacătului (90 s), ca un apel încă viu să nu fie niciodată luat drept uitat. */
export const MINUTE_IN_CURS_UITAT = 3;

/** Erorile la care apelul SIGUR n-a importat nimic: factura revine în starea de dinainte. */
const NIMIC_IMPORTAT = new Set(["ocupat", "fara_cheie", "config", "cheie_blocata", "intrare"]);

/** Opțiunile XML-ului din setările SAGA (Integrări). Refuză dacă lipsește ceva obligatoriu. */
export function optiuniDinSetari(saga) {
  const s = saga ?? {};
  const v = (k) => String(s[k] ?? "").trim();
  const lipsa = [];
  if (!v("format_numar")) lipsa.push("formatul numărului");
  if (!v("format_data")) lipsa.push("formatul datei");
  if (!["da", "nu"].includes(v("tva_la_incasare"))) lipsa.push("„TVA la încasare” (da / nu)");
  if (lipsa.length)
    throw new EroareSaga(`Trimiterea e blocată până se aleg în Integrări → Saga: ${lipsa.join(", ")}.`, { cod: "config" });
  const automat = v("import_automat").toLowerCase();
  if (automat !== "" && automat !== "da" && automat !== "nu")
    throw new EroareSaga(`„import_automat” are o valoare necunoscută („${automat}”): da / nu, gol = nu.`, { cod: "config" });
  return {
    format_numar: v("format_numar"), format_data: v("format_data"), tva_la_incasare: v("tva_la_incasare"),
    cif_persoana_fizica: v("cif_persoana_fizica") || "gol",
    automat: automat === "da",
  };
}

/**
 * Trimite factura `id`. `depozit`:
 *   citesteFactura(id) → rândul din `facturi` cu `linii` (ordonate) | null
 *   revendica(id, stareaVazuta) → boolean   (atomic: doar dacă starea e încă cea văzută)
 *   seteazaStare(id, campuri)
 * Întoarce { stare, nota, fisier, status }. Aruncă EroareSaga când factura n-a plecat.
 * @param {{ id: number, client: any, depozit: any, setariSaga: Record<string, any>, de?: string | null, acum?: () => number }} p
 * @returns {Promise<{ stare: string, nota: string | null, fisier: string, status: number | null }>}
 */
export async function trimiteFactura({ id, client, depozit, setariSaga, de = null, acum = () => Date.now() }) {
  const opt = optiuniDinSetari(setariSaga);
  const f = await depozit.citesteFactura(id);
  if (!f) throw new EroareSaga(`Factura ${id} nu există.`, { cod: "intrare" });

  const eUitata = f.saga_status === "in_curs" && acum() - new Date(f.updated_at).getTime() > MINUTE_IN_CURS_UITAT * 60_000;
  if (f.saga_status === "in_curs" && !eUitata)
    throw new EroareSaga(`Factura ${f.serie} ${f.numar} se trimite chiar acum. Reîncarcă pagina peste un minut.`, { cod: "ocupat" });
  if (!["de_trimis", "eroare", "in_curs"].includes(f.saga_status))
    throw new EroareSaga(`Factura ${f.serie} ${f.numar} e deja „${f.saga_status}” — nu se mai trimite.`, { cod: "stare" });

  let xml, fisier, nrDoc;
  try {
    xml = construiesteXml([f], opt);
    fisier = numeFisier(f, opt);
    nrDoc = numarPentruSaga(f.serie, f.numar, opt.format_numar);
  } catch (e) {
    throw new EroareSaga(`XML-ul facturii ${f.serie} ${f.numar} nu s-a putut genera: ${e?.message ?? e}`, { cod: "xml" });
  }

  if (!(await depozit.revendica(id, f.saga_status)))
    throw new EroareSaga(`Factura ${f.serie} ${f.numar} a fost luată între timp de altă trimitere. Reîncarcă pagina.`, { cod: "ocupat" });
  // O factură „in_curs” uitată revine, la nevoie, în „eroare” (nu știm ce s-a întâmplat cu ea).
  const inainte = f.saga_status === "in_curs" ? "eroare" : f.saga_status;

  let r;
  try {
    r = await client.importaFacturi({ xml, fisier, automat: opt.automat, facturaIds: [id], de });
  } catch (e) {
    if (e instanceof EroareSaga && NIMIC_IMPORTAT.has(e.cod)) {
      await depozit.seteazaStare(id, { saga_status: inainte, saga_eroare: e.message });
      throw e;
    }
    const nota = `Rezultat necunoscut — ${e?.message ?? e} La „Reîncearcă”, SAGA spune singur dacă o are deja.`;
    await depozit.seteazaStare(id, { saga_status: "eroare", saga_eroare: nota });
    return { stare: "eroare", nota, fisier, status: null };
  }

  const { stare, nota } = stareDupaImport(r, nrDoc, { automat: opt.automat });
  const moment = new Date(acum()).toISOString();
  const campuri = { saga_status: stare, saga_eroare: nota };
  if (stare !== "eroare") campuri.saga_trimisa_la = moment;
  if (stare === "confirmata") { campuri.confirmata_la = moment; campuri.confirmata_de = de; }
  await depozit.seteazaStare(id, campuri);
  return { stare, nota, fisier, status: r.status };
}
