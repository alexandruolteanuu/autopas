// ============================================================
// CLIENTUL API SAGA WEB (pasul 7 din docs/saga-plan.md, 11 noiembrie 2026)
//
// SINGURUL loc care folosește și ROTEȘTE cheia SAGA (docs/saga-api.md, secțiunea 1):
// SAGA trimite uneori, în antetul `X-Saga-Refresh-Token`, o cheie nouă, care TREBUIE
// salvată și folosită de la apelul următor — altfel cheia se blochează și se
// regenerează de mână, din SAGA WEB. De aici trei reguli, toate în `cere()`:
//   1. un singur apel o dată — lacătul din bază (`saga_ia_blocarea`, cu termen);
//   2. cheia nouă se salvează IMEDIAT după antete, înainte de citirea corpului,
//      la ORICE răspuns (și la erori);
//   3. cheia nu apare nicăieri: nici în rezultat, nici în jurnal, nici în erori.
//
// Fără instanță de test (decizia din 11 noiembrie 2026): cheia e cea REALĂ și se
// introduce doar din admin. „Testează conexiunea” face DOAR citiri (`GetArticol`).
// Importul (pasul 8) are un singur drum: `importaFacturi`, singurul loc din proiect
// cu calea „/Import”, chemat doar din lib/saga-trimitere.mjs.
//
// Fără bază de date și fără rețea proprii: totul vine prin `depozit` și `fetch`,
// ca să poată fi verificat pe un SAGA simulat (scripts/verifica-saga-api.mjs).
// Pe server, `lib/saga.ts` dă depozitul real (tabelele din migrarea 52).
// ============================================================

/** Adresa din documentația oficială (versiunea citită la 10.11.2026). Setarea
 *  `url_api` din Integrări o poate înlocui, când SAGA scoate altă versiune. */
export const URL_API_IMPLICIT = "https://web.sagasoft.ro/api/v20260225";
export const ANTET_ROTIRE = "x-saga-refresh-token";
/** Termenul lacătului: peste limita de 60 s a unei funcții Vercel, ca o funcție
 *  omorâtă la jumătate să nu blocheze apelurile pentru totdeauna. */
export const LACAT_SECUNDE = 90;
/** Cât așteptăm un răspuns: sub limita de 60 s, cu loc pentru jurnal. */
export const TIMEOUT_MS = 25_000;
/** Codul folosit de „Testează conexiunea” când nu e setat articolul implicit:
 *  SAGA răspunde 400 („cod inexistent”) — și asta dovedește că cheia e acceptată. */
export const COD_PROBA_INEXISTENT = "AUTOPAS-TEST-CONEXIUNE";

export const MESAJ_CHEIE_BLOCATA =
  "SAGA nu mai acceptă cheia de acces. Generați o cheie nouă din SAGA WEB (Utilizatori → Integrare API → " +
  "Generează cheie de acces), apoi salvați-o aici, cu „Salvează cheia”. Aplicația nu face nimic singură până atunci.";
export const MESAJ_ROTIRE_PIERDUTA =
  "SAGA a trimis o cheie nouă, dar ea NU s-a putut salva în bază. Cheia veche probabil nu mai e valabilă: " +
  "generați una nouă din SAGA WEB (Utilizatori → Integrare API → Generează cheie de acces) și salvați-o aici.";

export class EroareSaga extends Error {
  constructor(mesaj, { cod = "eroare", status = null } = {}) {
    super(mesaj);
    this.name = "EroareSaga";
    this.cod = cod;
    this.status = status;
  }
}

/** Adresa API-ului: din setări, fără bară la final; doar https. */
export function adresaApi(url) {
  const u = String(url ?? "").trim().replace(/\/+$/, "");
  if (!u) return URL_API_IMPLICIT;
  // `http://` doar pe mașina proprie: simulatorul din scripts/verifica-saga-api.mjs.
  if (!/^https:\/\/[^\s]+$/i.test(u) && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/[^\s]*)?$/i.test(u)) throw new EroareSaga(`Adresa API-ului SAGA („${u}”) trebuie să înceapă cu https://.`, { cod: "config" });
  return u;
}

/** Scoate orice apariție a cheilor din text (plasă: SAGA n-ar trebui să le scrie în corp). */
export function faraChei(text, chei) {
  let t = String(text ?? "");
  for (const c of chei) if (c && c.length >= 6) t = t.split(c).join("[cheie ascunsă]");
  return t;
}

const scurt = (t, n = 300) => { const s = String(t ?? "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n) + "…" : s; };

function dezEscape(v) {
  return String(v).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

/** Articolul din răspunsul XML al lui `GetArticol` (docs/saga-api.md, secțiunea 3). */
export function parseazaArticol(xml) {
  const camp = (nume) => {
    const m = new RegExp(`<${nume}>([\\s\\S]*?)</${nume}>`).exec(String(xml ?? ""));
    return m ? dezEscape(m[1].trim()) : null;
  };
  return {
    denumire: camp("Denumire"), um: camp("UM"), tva: camp("TVA"),
    pret_vanzare: camp("Pret_Vanzare1"), pret_vanzare_cu_tva: camp("Pret_Vanzare1_cuTVA"),
    cod_bare: camp("Cod_Bare"), cod_propriu: camp("Cod_Propriu"),
    informatii: camp("Informatii_Suplimentare"),
  };
}

/**
 * Clientul. `depozit` (toate asincrone):
 *   iaBlocarea(id, secunde) → boolean      elibereaza(id)
 *   citesteCheia() → string | null          rotesteCheia(veche, noua) → boolean
 *   salveazaCheia(cheie, de)                marcheazaFolosita()      marcheazaBlocata(motiv)
 *   jurnal({ tip, http_status, raspuns, durata_ms, cheie_rotita, eroare, de })
 * `cif`: codul fiscal pentru antetul `X-Saga-Cod-Fiscal` (deja curățat).
 */
export function creeazaClientSaga({ depozit, url, cif, fetch: f = globalThis.fetch, idNou = () => globalThis.crypto.randomUUID(), timeoutMs = TIMEOUT_MS }) {
  const baza = adresaApi(url);
  const codFiscal = String(cif ?? "").trim();

  /** Rulează `lucru` sub lacăt; refuză dacă altă operație SAGA e în curs. */
  async function subLacat(lucru) {
    const id = idNou();
    if (!(await depozit.iaBlocarea(id, LACAT_SECUNDE)))
      throw new EroareSaga("O operație SAGA e deja în curs. Reîncearcă peste câteva secunde.", { cod: "ocupat" });
    try { return await lucru(); }
    finally { try { await depozit.elibereaza(id); } catch { /* expiră singur după termen */ } }
  }

  /** Un apel spre SAGA. Întoarce { status, text, contentType, rotita }.
   *  `jurnalExtra`: câmpuri în plus pentru rândul din jurnal (fișierul, XML-ul, facturile).
   *  @param {{ tip: string, cale: string, metoda?: string, corp?: any, de?: string | null, jurnalExtra?: Record<string, any> }} p */
  async function cere({ tip, cale, metoda = "GET", corp, de = null, jurnalExtra = {} }) {
    if (!codFiscal) throw new EroareSaga("Codul fiscal al firmei lipsește (Admin → Setări → Date firmă).", { cod: "config" });
    return subLacat(async () => {
      const cheie = String((await depozit.citesteCheia()) ?? "").trim();
      if (!cheie) throw new EroareSaga("Cheia SAGA nu e salvată. Salveaz-o din Admin → Integrări → Saga, cu „Salvează cheia”.", { cod: "fara_cheie" });

      const t0 = Date.now();
      const rand = { ...jurnalExtra, tip, http_status: null, raspuns: null, durata_ms: null, cheie_rotita: false, eroare: null, de };
      const chei = [cheie];
      const ctrl = new AbortController();
      const ceas = setTimeout(() => ctrl.abort(), timeoutMs);
      let r;
      try {
        r = await f(baza + cale, {
          method: metoda, body: corp, signal: ctrl.signal,
          headers: { Authorization: `Bearer ${cheie}`, "X-Saga-Cod-Fiscal": codFiscal },
        });
      } catch (e) {
        clearTimeout(ceas);
        rand.durata_ms = Date.now() - t0;
        rand.eroare = ctrl.signal.aborted ? `Fără răspuns în ${Math.round(timeoutMs / 1000)} s` : faraChei(`Rețea: ${e?.message ?? e}`, chei);
        await jurnalSigur(rand);
        throw new EroareSaga(`SAGA nu a răspuns: ${rand.eroare}.`, { cod: "retea" });
      }

      // ROTIREA — imediat după antete, înainte de corp, la orice cod de răspuns.
      let rotirePierduta = false;
      const noua = String(r.headers.get(ANTET_ROTIRE) ?? "").trim();
      if (noua && noua !== cheie) {
        chei.push(noua);
        let salvata = false;
        for (let i = 0; i < 3 && !salvata; i++) {
          try { salvata = (await depozit.rotesteCheia(cheie, noua)) === true; } catch { /* reîncearcă */ }
          if (salvata) break;
        }
        rand.cheie_rotita = salvata;
        rotirePierduta = !salvata;
      }

      let text = "";
      try { text = await r.text(); } catch (e) { rand.eroare = `Corpul răspunsului nu s-a putut citi: ${e?.message ?? e}`; }
      clearTimeout(ceas);
      rand.durata_ms = Date.now() - t0;
      rand.http_status = r.status;
      rand.raspuns = faraChei(text, chei).slice(0, 20_000);

      if (rotirePierduta) {
        rand.eroare = "Cheie nouă primită, dar NESALVATĂ";
        try { await depozit.marcheazaBlocata("rotire nesalvată"); } catch { /* mesajul de mai jos ajunge oricum */ }
        await jurnalSigur(rand);
        throw new EroareSaga(MESAJ_ROTIRE_PIERDUTA, { cod: "rotire_pierduta", status: r.status });
      }
      if (r.status === 401 || r.status === 403) {
        rand.eroare = rand.eroare ?? "Cheie respinsă";
        try { await depozit.marcheazaBlocata(`HTTP ${r.status}`); } catch { /* idem */ }
        await jurnalSigur(rand);
        throw new EroareSaga(MESAJ_CHEIE_BLOCATA, { cod: "cheie_blocata", status: r.status });
      }
      try { await depozit.marcheazaFolosita(); } catch { /* doar informativ */ }
      await jurnalSigur(rand);
      return { status: r.status, text: rand.raspuns, contentType: r.headers.get("content-type") ?? "", rotita: rand.cheie_rotita };
    });
  }

  // Jurnalul nu are voie să strice un apel reușit (cheia rotită e deja salvată).
  async function jurnalSigur(rand) { try { await depozit.jurnal(rand); } catch { /* fără jurnal, dar fără pierderi */ } }

  /** `GetArticol`: { exista: true, articol } la 200; { exista: false, mesaj } la 400.
   *  @param {string} cod  @param {{ tip?: string, de?: string | null }} [opt] */
  async function getArticol(cod, { tip = "get_articol", de = null } = {}) {
    const c = String(cod ?? "").trim();
    if (!c) throw new EroareSaga("Codul articolului lipsește.", { cod: "intrare" });
    const r = await cere({ tip, cale: `/Situatii/GetArticol?codArticol=${encodeURIComponent(c)}`, de });
    if (r.status === 200) return { exista: true, articol: parseazaArticol(r.text), status: 200, rotita: r.rotita };
    if (r.status === 400) {
      let mesaj = r.text;
      try { const j = JSON.parse(r.text); mesaj = j.error ?? j.message ?? r.text; } catch { /* text simplu */ }
      return { exista: false, mesaj: scurt(mesaj), status: 400, rotita: r.rotita };
    }
    throw new EroareSaga(`SAGA a răspuns neașteptat (HTTP ${r.status}): ${scurt(r.text) || "fără mesaj"}`, { cod: "neasteptat", status: r.status });
  }

  /** „Testează conexiunea”: DOAR o citire (`GetArticol`), niciodată Import.
   *  @param {{ cod?: string, de?: string | null }} [opt] */
  async function testeazaConexiunea({ cod, de = null } = {}) {
    const c = String(cod ?? "").trim() || COD_PROBA_INEXISTENT;
    const rez = await getArticol(c, { tip: "test", de });
    return { ...rez, cod: c };
  }

  /** Cheia nouă, din admin — sub lacăt, ca un apel în curs să nu o rotească pe cea veche peste ea.
   *  @param {string} cheie  @param {string | null} [de] */
  async function salveazaCheia(cheie, de = null) {
    const c = String(cheie ?? "").trim();
    if (c.length < 10 || /\s/.test(c)) throw new EroareSaga("Cheia pare greșită (prea scurtă sau cu spații). Copiaz-o din nou din SAGA WEB.", { cod: "intrare" });
    return subLacat(() => depozit.salveazaCheia(c, de));
  }

  /**
   * IMPORTUL (pasul 8): `POST /Import`, multipart — `file` (XML-ul, cu numele lui) și
   * `importAutomat` („true” / „false”; din setarea `import_automat`, oprită implicit).
   * Întoarce răspunsul brut ({ status, text, contentType, rotita }); ce înseamnă el
   * pentru fiecare factură decide `stareDupaImport` din lib/saga-xml.mjs.
   * @param {{ xml: string, fisier: string, automat: boolean, facturaIds: number[], de?: string | null }} p
   */
  async function importaFacturi({ xml, fisier, automat, facturaIds, de = null }) {
    if (!String(xml ?? "").trim()) throw new EroareSaga("XML-ul facturii e gol.", { cod: "intrare" });
    if (!/^F_[A-Za-z0-9_-]+\.xml$/.test(String(fisier ?? ""))) throw new EroareSaga(`Numele fișierului („${fisier}”) nu e în formatul F_<cod-fiscal>_<numar>_<data>.xml.`, { cod: "intrare" });
    const corp = new FormData();
    corp.append("file", new Blob([xml], { type: "application/xml" }), fisier);
    corp.append("importAutomat", automat === true ? "true" : "false");
    return cere({ tip: "import", cale: "/Import", metoda: "POST", corp, de,
      jurnalExtra: { factura_ids: facturaIds ?? [], fisier, xml } });
  }

  return { cere, getArticol, testeazaConexiunea, salveazaCheia, importaFacturi };
}
