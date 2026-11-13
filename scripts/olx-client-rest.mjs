// ============================================================
// CLIENTUL OLX PENTRU SCRIPTURI — același `creeazaClientOlx` din lib/olx-api.mjs
// (singurul loc care folosește tokenii), cu depozitul scris pe REST, cu cheia de
// service din .env.local. Geamănul lui `clientOlx()` din lib/olx.ts.
// Tokenii nu se afișează nicăieri: doar circulă între bază și clientul OLX.
// ============================================================
import { readFileSync, existsSync } from "node:fs";
import { creeazaClientOlx } from "../lib/olx-api.mjs";

export function citesteEnv() {
  const env = { ...process.env };
  for (const f of [".env.local", ".env"]) {
    if (!existsSync(f)) continue;
    for (const l of readFileSync(f, "utf8").split("\n")) {
      const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

export function bazaRest() {
  const env = citesteEnv();
  const url = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, ""), key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Lipsesc NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY din .env.local.");
  const antete = { apikey: key, Authorization: `Bearer ${key}` };
  /** Un apel REST; aruncă la orice cod ≠ 2xx. */
  async function rest(cale, { metoda = "GET", corp, prefer } = {}) {
    const r = await fetch(`${url}/rest/v1/${cale}`, {
      method: metoda,
      headers: { ...antete, "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) },
      body: corp === undefined ? undefined : JSON.stringify(corp),
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`REST ${metoda} ${cale.split("?")[0]}: HTTP ${r.status} ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : null;
  }
  return { url, antete, rest };
}

export function clientOlxRest() {
  const { rest } = bazaRest();
  const depozit = {
    citesteCont: async () => (await rest("olx_cont?unic=eq.true&select=client_id,client_secret,access_token,access_expira,refresh_token"))[0] ?? null,
    salveazaTokenii: async (t, conectare) => {
      const camp = { access_token: t.access_token, access_expira: t.access_expira, scope: t.scope, reinnoit_la: new Date().toISOString(),
        deconectat_la: null, deconectat_motiv: null };
      if (t.refresh_token) camp.refresh_token = t.refresh_token;
      if (conectare) { camp.conectat_la = new Date().toISOString(); camp.conectat_de = conectare.de; }
      const r = await rest("olx_cont?unic=eq.true&select=unic", { metoda: "PATCH", corp: camp, prefer: "return=representation" });
      return Array.isArray(r) && r.length === 1;
    },
    marcheazaDeconectat: async (motiv) => {
      await rest("olx_cont?unic=eq.true", { metoda: "PATCH", corp: { deconectat_la: new Date().toISOString(), deconectat_motiv: motiv, access_token: null, access_expira: null } });
    },
    marcheazaFolosit: async () => { await rest("olx_cont?unic=eq.true", { metoda: "PATCH", corp: { folosit_la: new Date().toISOString() } }); },
    iaBlocarea: async (id, secunde) => (await rest("rpc/olx_ia_blocarea", { metoda: "POST", corp: { p_detinator: id, p_secunde: secunde } })) === true,
    elibereaza: async (id) => { await rest("rpc/olx_elibereaza", { metoda: "POST", corp: { p_detinator: id } }); },
    jurnal: async (r) => { await rest("olx_apeluri", { metoda: "POST", corp: r }); },
  };
  return creeazaClientOlx({ depozit });
}
