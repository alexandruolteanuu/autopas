// ============================================================
// CLIENTUL OLX PARTNER API v2 (pasul 1 din docs/olx-plan.md, 13 noiembrie 2026)
//
// SINGURUL loc care folosește tokenii OLX (lecția SAGA: un singur loc care ține
// secretul). Reguli, toate aici:
//   1. tokenii vin din bază (`olx_cont`, fără politici RLS) și se scriu înapoi
//      ÎNAINTE de a fi folosiți; nu apar în rezultat, în jurnal sau în erori;
//   2. access token-ul (24 h) se reînnoiește singur cu o oră înainte de expirare,
//      sub lacăt — o singură reînnoire o dată;
//   3. LISTĂ ÎNCHISĂ de apeluri (`apelPermis`): aplicația nu poate cumpăra nimic —
//      pachete, promovări, `extend` — fiindcă apelul e refuzat înainte de rețea;
//   4. antetul `Version: 2.0` la fiecare apel; 429 → pauză și reîncercare.
//
// Fără bază de date proprie: totul vine prin `depozit` (lib/olx.ts pe server).
// ============================================================

export const URL_OLX = "https://www.olx.ro";
export const URL_API = `${URL_OLX}/api/partner`;
export const URL_TOKEN = `${URL_OLX}/api/open/oauth/token`;
export const URL_AUTORIZARE = `${URL_OLX}/oauth/authorize/`;
export const SCOPE = "v2 read write";
export const TIMEOUT_MS = 25_000;
/** Reînnoim cu o oră înainte de expirare. */
export const MARJA_REINNOIRE_MS = 60 * 60 * 1000;
const PAUZE_429_MS = [2_000, 5_000, 12_000];

export class EroareOlx extends Error {
  constructor(mesaj, { cod = "eroare", status = null, validare = null } = {}) {
    super(mesaj);
    this.name = "EroareOlx";
    this.cod = cod;
    this.status = status;
    this.validare = validare;
  }
}

/**
 * LISTA ÎNCHISĂ. Tot ce nu e aici e refuzat înainte de rețea — în special
 * `/packets`, `/paid-features`, `/users/me/packets`, `/adverts/{id}/packets`,
 * comanda `extend` și `/threads` (fără mesaje în admin).
 */
export function apelPermis(metoda, cale, corp) {
  const c = String(cale ?? "").split("?")[0];
  const m = String(metoda ?? "GET").toUpperCase();
  if (m === "GET") {
    return [
      /^\/users\/me$/, /^\/adverts$/, /^\/adverts\/\d+$/, /^\/adverts\/\d+\/moderation-reason$/,
      /^\/categories$/, /^\/categories\/\d+$/, /^\/categories\/\d+\/attributes$/, /^\/categories\/suggestion$/,
      /^\/locations$/, /^\/cities\/\d+$/, /^\/cities\/\d+\/districts$/,
    ].some((r) => r.test(c));
  }
  if (m === "POST" && c === "/adverts") return true;
  if (m === "PUT" && /^\/adverts\/\d+$/.test(c)) return true;
  if (m === "DELETE" && /^\/adverts\/\d+$/.test(c)) return true;
  if (m === "POST" && /^\/adverts\/\d+\/commands$/.test(c))
    return ["activate", "deactivate"].includes(corp?.command);
  return false;
}

/** Scoate orice token din text (plasă: OLX n-ar trebui să le scrie în corp). */
export function faraChei(text, chei) {
  let t = String(text ?? "");
  for (const c of chei) if (c && c.length >= 8) t = t.split(c).join("[ascuns]");
  return t;
}

const scurt = (t, n = 400) => { const s = String(t ?? "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n) + "…" : s; };

/** Mesajul de eroare dintr-un răspuns OLX (formele din specificație). */
export function mesajEroare(json, text, status) {
  const e = json?.error ?? json?.data?.error;
  if (e && typeof e === "object") {
    const val = Array.isArray(e.validation) ? e.validation.map((v) => `${v.field}: ${v.detail || v.title}`).join("; ") : "";
    return [e.detail || e.title || e.message, val].filter(Boolean).join(" — ") || `HTTP ${status}`;
  }
  if (typeof e === "string") return json.error_human_title || json.error_description || e;
  return scurt(text) || `HTTP ${status}`;
}

/** Adresa la care trimitem omul ca să conecteze contul OLX. */
export function adresaAutorizare({ client_id, state, redirect_uri }) {
  const p = new URLSearchParams({ client_id: String(client_id), response_type: "code", state, scope: SCOPE });
  if (redirect_uri) p.set("redirect_uri", redirect_uri);
  return `${URL_AUTORIZARE}?${p.toString()}`;
}

const asteapta = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * `depozit` (toate asincrone):
 *   citesteCont() → { client_id, client_secret, access_token, access_expira, refresh_token }
 *   salveazaTokenii({ access_token, access_expira, refresh_token, scope }, conectare?) → boolean
 *   marcheazaDeconectat(motiv)   marcheazaFolosit()
 *   iaBlocarea(id, secunde) → boolean   elibereaza(id)
 *   jurnal({ tip, metoda, cale, product_id, http_status, durata_ms, eroare, de })
 */
export function creeazaClientOlx({ depozit, fetch: f = globalThis.fetch, idNou = () => globalThis.crypto.randomUUID(), timeoutMs = TIMEOUT_MS }) {
  async function jurnalSigur(r) { try { await depozit.jurnal(r); } catch { /* jurnalul nu strică un apel */ } }

  async function fetchCuTimeout(url, opt) {
    const ctrl = new AbortController();
    const ceas = setTimeout(() => ctrl.abort(), timeoutMs);
    try { return await f(url, { ...opt, signal: ctrl.signal }); }
    catch (e) { throw new EroareOlx(ctrl.signal.aborted ? `OLX nu a răspuns în ${Math.round(timeoutMs / 1000)} s.` : `Rețea: ${e?.message ?? e}`, { cod: "retea" }); }
    finally { clearTimeout(ceas); }
  }

  /** Cererea la endpoint-ul de token (cod sau refresh). Tokenii nu ies în erori. */
  async function cereToken(corp, chei) {
    const t0 = Date.now();
    const r = await fetchCuTimeout(URL_TOKEN, {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(corp),
    });
    const text = await r.text().catch(() => "");
    let json = null; try { json = JSON.parse(text); } catch { /* corp ne-JSON */ }
    const ok = r.ok && json?.access_token;
    await jurnalSigur({ tip: corp.grant_type, metoda: "POST", cale: "/oauth/token", http_status: r.status, durata_ms: Date.now() - t0,
      eroare: ok ? null : faraChei(mesajEroare(json, text, r.status), chei) });
    if (!ok) {
      const cod = json?.error === "invalid_grant" ? "invalid_grant" : json?.error === "invalid_client" ? "invalid_client" : "token";
      throw new EroareOlx(`OLX a refuzat autentificarea: ${faraChei(mesajEroare(json, text, r.status), chei)}`, { cod, status: r.status });
    }
    return {
      access_token: json.access_token,
      access_expira: new Date(Date.now() + (Number(json.expires_in) || 86_400) * 1000).toISOString(),
      refresh_token: json.refresh_token || corp.refresh_token || null,
      scope: json.scope ?? null,
    };
  }

  /** Salvează tokenii; trei încercări. Dacă tot nu merge, eroare — nu folosim un token nesalvat. */
  async function salveaza(tokeni, conectare) {
    for (let i = 0; i < 3; i++) {
      try { if ((await depozit.salveazaTokenii(tokeni, conectare)) === true) return; } catch { /* reîncearcă */ }
      await asteapta(300);
    }
    throw new EroareOlx("OLX a dat tokeni noi, dar ei NU s-au putut salva în bază. Reîncearcă; dacă se repetă, apasă „Conectează OLX” din nou.", { cod: "salvare_tokeni" });
  }

  /** Schimbă codul primit la callback pe tokeni și îi salvează.
   *  @param {{ code: string, redirect_uri?: string, de: string | null }} p */
  async function schimbaCodul({ code, redirect_uri, de }) {
    const cont = await depozit.citesteCont();
    if (!cont?.client_id || !cont?.client_secret) throw new EroareOlx("Aplicația OLX (client_id / client_secret) nu e salvată.", { cod: "config" });
    const corp = { grant_type: "authorization_code", client_id: cont.client_id, client_secret: cont.client_secret, code, scope: SCOPE };
    if (redirect_uri) corp.redirect_uri = redirect_uri;
    const tokeni = await cereToken(corp, [cont.client_secret, code]);
    await salveaza(tokeni, { de });
  }

  /** Un access token valabil; îl reînnoiește dacă expiră în mai puțin de o oră.
   *  @param {{ forteaza?: boolean }} [o] @returns {Promise<string>} */
  async function tokenValid({ forteaza = false } = {}) {
    let cont = await depozit.citesteCont();
    if (!cont?.refresh_token) throw new EroareOlx("Contul OLX nu e conectat. Apasă „Conectează OLX” din Admin → Integrări.", { cod: "neconectat" });
    const expira = cont.access_expira ? Date.parse(cont.access_expira) : 0;
    if (!forteaza && cont.access_token && expira - Date.now() > MARJA_REINNOIRE_MS) return cont.access_token;

    const id = idNou();
    if (!(await depozit.iaBlocarea(id, 60))) {
      // Altcineva reînnoiește chiar acum: așteptăm tokenul lui (max. ~10 s).
      for (let i = 0; i < 20; i++) {
        await asteapta(500);
        cont = await depozit.citesteCont();
        const e = cont?.access_expira ? Date.parse(cont.access_expira) : 0;
        if (cont?.access_token && e - Date.now() > MARJA_REINNOIRE_MS) return cont.access_token;
      }
      throw new EroareOlx("Reînnoirea tokenului OLX e în curs. Reîncearcă peste câteva secunde.", { cod: "ocupat" });
    }
    try {
      cont = await depozit.citesteCont(); // poate a reînnoit altcineva între timp
      const e = cont?.access_expira ? Date.parse(cont.access_expira) : 0;
      if (!forteaza && cont?.access_token && e - Date.now() > MARJA_REINNOIRE_MS) return cont.access_token;
      let tokeni;
      try {
        tokeni = await cereToken({ grant_type: "refresh_token", client_id: cont.client_id, client_secret: cont.client_secret,
          refresh_token: cont.refresh_token }, [cont.client_secret, cont.refresh_token, cont.access_token]);
      } catch (err) {
        if (err?.cod === "invalid_grant") {
          try { await depozit.marcheazaDeconectat("Reînnoirea a fost refuzată (refresh token expirat sau revocat)"); } catch { /* mesajul ajunge oricum */ }
          throw new EroareOlx("OLX nu mai acceptă conectarea (nefolosită o lună sau revocată). Apasă „Conectează OLX” din Admin → Integrări.", { cod: "neconectat" });
        }
        throw err;
      }
      await salveaza(tokeni, null);
      return tokeni.access_token;
    } finally {
      try { await depozit.elibereaza(id); } catch { /* expiră singur */ }
    }
  }

  /**
   * Un apel spre OLX. Întoarce { status, json } la 2xx; aruncă EroareOlx altfel
   * (cu `validare` = lista câmpurilor refuzate, dacă există).
   * @param {{ metoda?: string, cale: string, corp?: any, tip?: string, product_id?: number|null, de?: string|null, pana?: number }} p
   * @returns {Promise<{ status: number, json: any }>}
   */
  async function cere({ metoda = "GET", cale, corp, tip = "api", product_id = null, de = null, pana = Infinity }) {
    if (!apelPermis(metoda, cale, corp)) throw new EroareOlx(`Apel OLX nepermis: ${metoda} ${cale}. Aplicația nu cumpără nimic și nu folosește mesajele.`, { cod: "nepermis" });
    let token = await tokenValid();
    let reinnoit = false;
    for (let incercare = 0; ; incercare++) {
      const t0 = Date.now();
      const r = await fetchCuTimeout(URL_API + cale, {
        method: metoda,
        headers: { Authorization: `Bearer ${token}`, Version: "2.0", Accept: "application/json",
                   ...(corp !== undefined ? { "Content-Type": "application/json" } : {}) },
        body: corp !== undefined ? JSON.stringify(corp) : undefined,
      });
      const text = await r.text().catch(() => "");
      let json = null; try { json = text ? JSON.parse(text) : null; } catch { /* ne-JSON */ }
      const eroare = r.ok ? null : faraChei(mesajEroare(json, text, r.status), [token]);
      await jurnalSigur({ tip, metoda, cale: cale.split("?")[0], product_id, http_status: r.status, durata_ms: Date.now() - t0, eroare, de });

      if (r.ok) { try { await depozit.marcheazaFolosit(); } catch { /* informativ */ } return { status: r.status, json }; }
      if (r.status === 401 && !reinnoit) { reinnoit = true; token = await tokenValid({ forteaza: true }); continue; }
      if (r.status === 429 && incercare < PAUZE_429_MS.length) {
        const dupa = Number(r.headers.get("retry-after")) * 1000 || PAUZE_429_MS[incercare];
        if (Date.now() + dupa < pana) { await asteapta(dupa); continue; }
      }
      const e = json?.error ?? json?.data?.error;
      throw new EroareOlx(`OLX (HTTP ${r.status}): ${eroare}`, {
        cod: r.status === 429 ? "429" : r.status === 404 ? "404" : r.status === 401 ? "neconectat" : "olx", status: r.status,
        validare: Array.isArray(e?.validation) ? e.validation : null,
      });
    }
  }

  /** Lista anunțurilor contului, pe pagini de 100 (max. `maxPagini`).
   *  @param {{ de?: string | null, maxPagini?: number }} [o] @returns {Promise<{ anunturi: any[], complet: boolean }>} */
  async function toateAnunturile({ de = null, maxPagini = 100 } = {}) {
    const tot = [];
    for (let p = 0; p < maxPagini; p++) {
      const { json } = await cere({ cale: `/adverts?offset=${p * 100}&limit=100`, tip: "lista", de });
      const lot = Array.isArray(json?.data) ? json.data : [];
      tot.push(...lot);
      if (lot.length < 100) return { anunturi: tot, complet: true };
    }
    return { anunturi: tot, complet: false };
  }

  return { schimbaCodul, tokenValid, cere, toateAnunturile };
}

/** Datele unei categorii, oricare ar fi învelișul (`{data: …}` sau direct). */
export const dinData = (json) => (json && typeof json === "object" && "data" in json ? json.data : json);
