// ============================================================
// EMITEREA DINTR-UN SINGUR BUTON (pasul 13 din docs/saga-plan.md, migrarea 60)
//
// O factură în „se_trimite” e dusă până la capăt: XML, încercarea scrisă ÎNAINTE de
// POST, `/Import` cu importAutomat=true, apoi decizia din răspuns:
//   · acceptată                                   → emisă (confirmata; 207 cu avertizări: trimisa);
//   · „operata manual deja” + nicio încercare fără răspuns pe numărul ăsta
//                                                  → factură manuală: renumerotare și retrimitere (max 10);
//   · „operata manual deja” + o încercare fără răspuns pe numărul ăsta
//                                                  → e a noastră: emisă, fără renumerotare;
//   · fără răspuns / 429 / 5xx / lacăt SAGA ocupat → rămâne „se_trimite”, ACELAȘI număr,
//                                                    reîncercare din fundal (ceasul din 60);
//   · respinsă pentru date                        → eliberată (dacă e ultimul număr) sau „eroare”;
//   · cheie SAGA blocată / lipsă                  → „de_verificat”, cu mesajul legăturii;
//   · altceva                                     → „de_verificat”.
// Renumerotările rulează în aceeași cerere (SAGA răspunde în ~1 s); doar reîncercările
// după timeout pleacă în fundal. Risc acceptat de proprietar (17 noiembrie 2026): o
// încercare „fără răspuns” care de fapt n-a ajuns, iar exact atunci cineva emite manual
// același număr → factura noastră e socotită emisă.
//
// Fără bază de date proprie: totul prin `depozit` (lib/saga.ts dă varianta reală), ca să
// poată fi verificat pe un SAGA simulat (scripts/verifica-saga-emitere-un-buton.mjs).
// ============================================================
import { construiesteXml, numeFisier, numarPentruSaga, parseazaRaport, acelasiNumar, MESAJ_DUBLURA } from "./saga-xml.mjs";
import { EroareSaga } from "./saga-api.mjs";
import { optiuniDinSetari } from "./saga-trimitere.mjs";

export const TIMEOUT_IMPORT_MS = 20_000;
export const BUGET_MS = 40_000;
export const MAX_RENUMEROTARI = 10;
/** Pauzele reîncercărilor din fundal, în minute; după ultima → „de_verificat”. */
export const PAUZE_MINUTE = [1, 2, 5, 10, 30];
export const MESAJ_LEGATURA = "Legătura cu SAGA trebuie refăcută (Integrări → Saga).";
export const MESAJ_RENUMEROTARI = "Nu s-a putut emite, încearcă din nou.";

const scurt = (t, n = 400) => { const s = String(t ?? "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n) + "…" : s; };

/**
 * Ce înseamnă răspunsul SAGA pentru factura `nrDoc`.
 * → { tip: "acceptata" | "dublura" | "respinsa" | "neprimita" | "necunoscut" | "nedecis", nota, avertizari? }
 * „dublura” = textul real de la PAP FE 14210: HTTP 422, „Eroare antet: Factura a fost importata
 * sau operata manual deja.”, sub `NR_DOC: <numărul nostru>`.
 */
export function citesteRaspuns(r, nrDoc) {
  const status = Number(r?.status);
  const text = String(r?.text ?? "");
  let json = null;
  try { json = JSON.parse(text); } catch { /* raport text */ }

  if (status === 200) {
    if (json && json.success === false) return { tip: "respinsa", nota: `SAGA: ${json.message ?? scurt(text)}` };
    return { tip: "acceptata", nota: null };
  }
  if (status === 400) return { tip: "respinsa", nota: `SAGA: ${json?.message ?? json?.error ?? (scurt(text) || "fișier respins")}` };
  if (status === 207 || status === 422) {
    const ale = parseazaRaport(text).filter((b) => acelasiNumar(b.nrDoc, nrDoc));
    const mesaje = ale.flatMap((b) => b.mesaje);
    const dubla = mesaje.find((m) => MESAJ_DUBLURA.test(m));
    if (dubla) return { tip: "dublura", nota: dubla };
    if (ale.length === 0) return { tip: "nedecis", nota: `Raport SAGA neînțeles (HTTP ${status}): ${scurt(text)}` };
    if (status === 422 || mesaje.some((m) => /eroare/i.test(m))) return { tip: "respinsa", nota: `SAGA: ${mesaje.join(" · ")}` };
    return { tip: "acceptata", nota: `Importată cu avertizări: ${mesaje.join(" · ") || "fără detalii"}`, avertizari: true };
  }
  if (status === 429) return { tip: "neprimita", nota: "SAGA a atins limita de cereri." };
  if (status >= 500) return { tip: "necunoscut", nota: `SAGA a răspuns ${status}: ${scurt(text, 200)}` };
  return { tip: "nedecis", nota: `SAGA a răspuns neașteptat (HTTP ${status}): ${scurt(text)}` };
}

/**
 * Duce factura `id` cât se poate în bugetul dat. `token` = cel primit la pornire (butonul);
 * fără el (ceasul), ia doar o factură liberă și scadentă.
 * `depozit`:
 *   ia(id, token|null) → token | null
 *   citesteFactura(id) → rândul din `facturi` cu `linii` | null
 *   incepeIncercare({ factura_id, serie, numar, de }) → id   (aruncă dacă nu se poate scrie)
 *   terminaIncercare(id, { stare, http_status, raspuns, eroare })
 *   areFaraRaspuns(facturaId, serie, numar, exceptId) → boolean
 *   renumeroteaza(id, token) → { numar }
 *   elibereaza(id, token, motiv) → { eliberata }
 *   seteaza(id, token, campuri)   (doar cât lacătul e al nostru)
 * Întoarce { stare, id, serie, numar, mesaj }.
 * @param {{ id: number, token?: string | null, client: any, depozit: any, setariSaga: Record<string, any>,
 *           de?: string | null, acum?: () => number, pana?: number, dorm?: (ms: number) => Promise<void> }} p
 * @returns {Promise<{ stare: string, id: number, serie: string | null, numar: number | null, mesaj: string | null }>}
 */
export async function lucreazaFactura({ id, token = null, client, depozit, setariSaga, de = null,
  acum = () => Date.now(), pana = Date.now() + BUGET_MS, dorm = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  const tok = await depozit.ia(id, token);
  const f0 = await depozit.citesteFactura(id);
  if (!f0) return { stare: "eliberata", id, serie: null, numar: null, mesaj: null };
  if (!tok) return { stare: f0.saga_status, id, serie: f0.serie, numar: f0.numar, mesaj: f0.saga_eroare ?? null };

  const gata = async (f, campuri, stare, mesaj) => {
    await depozit.seteaza(id, tok, { ...campuri, lacat_pana: null, lacat_de: null });
    return { stare, id, serie: f.serie, numar: f.numar, mesaj };
  };
  const deVerificat = (f, mesaj) => gata(f, { saga_status: "de_verificat", saga_eroare: mesaj }, "de_verificat", mesaj);
  // Reîncercare din fundal, cu același număr.
  const programeaza = async (f, nota) => {
    const n = (Number(f.reincercari) || 0) + 1;
    if (n > PAUZE_MINUTE.length)
      return deVerificat(f, `SAGA n-a confirmat factura ${f.serie} ${f.numar} după ${PAUZE_MINUTE.length} încercări — verifică în SAGA. (${nota})`);
    const la = new Date(acum() + PAUZE_MINUTE[n - 1] * 60_000).toISOString();
    return gata(f, { saga_status: "se_trimite", saga_eroare: nota, reincercari: n, reincearca_la: la }, "se_trimite", null);
  };

  let opt;
  try { opt = optiuniDinSetari(setariSaga); } catch (e) { return deVerificat(f0, e?.message ?? String(e)); }

  for (;;) {
    const f = await depozit.citesteFactura(id);
    if (acum() + TIMEOUT_IMPORT_MS + 2_000 > pana)            // nu mai încape un apel: îl ia ceasul
      return gata(f, { reincearca_la: new Date(acum()).toISOString() }, "se_trimite", null);

    let xml, fisier, nrDoc;
    try {
      xml = construiesteXml([f], opt);
      fisier = numeFisier(f, opt);
      nrDoc = numarPentruSaga(f.serie, f.numar, opt.format_numar);
    } catch (e) {
      return deVerificat(f, `XML-ul facturii ${f.serie} ${f.numar} nu s-a putut genera: ${e?.message ?? e}`);
    }

    let inc;
    try { inc = await depozit.incepeIncercare({ factura_id: id, serie: f.serie, numar: f.numar, de }); }
    catch (e) { return programeaza(f, `Jurnalul încercărilor nu s-a putut scrie: ${e?.message ?? e}`); }

    let r;
    try {
      r = await client.importaFacturi({ xml, fisier, automat: true, facturaIds: [id], de });
    } catch (e) {
      const cod = e instanceof EroareSaga ? e.cod : "retea";
      const mesaj = e?.message ?? String(e);
      if (cod === "ocupat") {                                   // lacătul SAGA: nimic n-a plecat
        await depozit.terminaIncercare(inc, { stare: "netrimisa", eroare: mesaj });
        if (acum() + 3_000 + TIMEOUT_IMPORT_MS + 2_000 <= pana) { await dorm(3_000); continue; }
        return programeaza(f, mesaj);
      }
      if (cod === "fara_cheie" || cod === "config" || cod === "intrare") {
        await depozit.terminaIncercare(inc, { stare: "netrimisa", eroare: mesaj });
        return deVerificat(f, cod === "fara_cheie" ? MESAJ_LEGATURA : mesaj);
      }
      if (cod === "cheie_blocata") {                            // 401/403: SAGA a răspuns, n-a importat
        await depozit.terminaIncercare(inc, { stare: "raspuns", http_status: e.status ?? null, eroare: mesaj });
        return deVerificat(f, MESAJ_LEGATURA);
      }
      // rotire pierdută, timeout, rețea: nu știm dacă a ajuns
      await depozit.terminaIncercare(inc, { stare: "fara_raspuns", http_status: e?.status ?? null, eroare: mesaj });
      if (cod === "rotire_pierduta") return deVerificat(f, MESAJ_LEGATURA);
      return programeaza(f, mesaj);
    }

    const rez = citesteRaspuns(r, nrDoc);
    await depozit.terminaIncercare(inc, {
      stare: rez.tip === "necunoscut" ? "fara_raspuns" : "raspuns", http_status: r.status, raspuns: r.text,
    });
    const moment = new Date(acum()).toISOString();
    const emisa = (nota, avertizari = false) => gata(f, {
      saga_status: avertizari ? "trimisa" : "confirmata", saga_eroare: nota, saga_trimisa_la: moment,
      ...(avertizari ? {} : { confirmata_la: moment, confirmata_de: de }),
    }, avertizari ? "trimisa" : "confirmata", null);

    if (rez.tip === "acceptata") return emisa(rez.nota, !!rez.avertizari);
    if (rez.tip === "dublura") {
      if (await depozit.areFaraRaspuns(id, f.serie, f.numar, inc))
        return emisa(`SAGA o avea deja, de la o încercare fără răspuns („${rez.nota}”).`);
      if ((Number(f.renumerotari) || 0) >= MAX_RENUMEROTARI)
        return gata(f, { saga_status: "eroare", saga_eroare: MESAJ_RENUMEROTARI }, "eroare", MESAJ_RENUMEROTARI);
      await depozit.renumeroteaza(id, tok);                     // factură manuală pe numărul ăsta
      continue;
    }
    if (rez.tip === "respinsa") {
      const e = await depozit.elibereaza(id, tok, rez.nota);
      return { stare: e?.eliberata ? "eliberata" : "eroare", id, serie: f.serie, numar: f.numar, mesaj: rez.nota };
    }
    if (rez.tip === "neprimita" || rez.tip === "necunoscut") return programeaza(f, rez.nota);
    return deVerificat(f, rez.nota);
  }
}
