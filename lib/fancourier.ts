// ============================================================
// FAN COURIER — API-ul public v2 (api.fancourier.ro), cu contul selfAWB.
//
// DE CE NU PLUGINUL DE WOOCOMMERCE (15 septembrie 2026)
// Pluginul primit de la FAN nu vorbește cu API-ul lor, ci cu un intermediar
// (`ecommerce.fancourier.ro`) la care magazinul se înregistrează după DOMENIU,
// cu `platform: "WooCommerce"`, iar comanda e trimisă acolo la plasare. E făcut
// pentru WordPress. API-ul public folosește ACELEAȘI date (Client ID, utilizator,
// parolă din selfawb.ro) și e cel documentat pentru site-uri proprii.
// Pluginul a folosit ca listă a ce cere FAN la un AWB: colete, greutate,
// dimensiuni, ramburs, conținut, observații, destinatar.
//
// VERIFICAT PE API-UL REAL, cu contul de test din ghidul lor (7032158):
//   · POST /login (JSON) -> token valabil 24 de ore;
//   · POST /intern-awb   -> awbNumber, tariff (fără TVA), vat, trackingUrl;
//                           o localitate inexistentă => errors.locality;
//   · GET  /awb/label    -> PDF;
//   · DELETE /awb        -> „The AWB was deleted successfully.";
//   · GET  /reports/services -> serviciile contului.
// Nicio opțiune suplimentară pe AWB (`options: []`) — decizia proprietarului din
// 15 septembrie 2026: coletul NU se deschide la livrare.
// ============================================================
import { sbAdmin } from "./supabase";
import type { Integrari } from "./settings";

const BAZA = "https://api.fancourier.ro";
const TIMEOUT_MS = 30_000;

export type ConfigFan = {
  clientId: string; user: string; parola: string;
  /** Rambursul intră în contul bancar (serviciul „Cont Colector"), nu în plic („Standard"). */
  rambursInCont: boolean;
};

/** Credențialele: întâi din Admin → Integrări, apoi din variabilele Vercel. */
export async function configFan(): Promise<ConfigFan> {
  const sb = sbAdmin();
  let f: NonNullable<Integrari["fancourier"]> = {};
  if (sb) {
    const { data } = await sb.from("settings").select("valoare").eq("cheie", "integrari").maybeSingle();
    f = ((data?.valoare as Integrari | undefined)?.fancourier) ?? {};
  }
  // Bifa se salvează ca text („on" / ""); un câmp care n-a fost salvat
  // niciodată înseamnă valoarea implicită, adică „da".
  const bifa = (v: unknown) => v === undefined || v === null ? true : v === true || v === "on" || v === "da";
  return {
    clientId: String(f.client_id || process.env.FANCOURIER_CLIENT_ID || "").trim(),
    user: String(f.user || process.env.FANCOURIER_USER || "").trim(),
    parola: String(f.parola || process.env.FANCOURIER_PASS || ""),
    rambursInCont: bifa(f.ramburs_cont),
  };
}

/** Județul și localitatea FĂRĂ diacritice. Nomenclatorul FAN le scrie așa
 *  („Brosteni"), iar calculul de tarif respinge „Broșteni" ca localitate
 *  inexistentă (măsurat 15 septembrie 2026). Clienții scriu des cu diacritice. */
export const faraDiacritice = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

export class EroareFan extends Error {
  stare: number;
  constructor(mesaj: string, stare = 0) { super(mesaj); this.stare = stare; }
}

// Token-ul ține 24 de ore. Se ține în memoria funcției: la o instanță caldă nu
// ne mai autentificăm, la una rece o singură dată. Cheia include utilizatorul,
// ca schimbarea contului din Integrări să nu folosească token-ul vechi.
let tokenMemorat: { cheie: string; token: string; expira: number } | null = null;

async function login(cfg: ConfigFan): Promise<string> {
  const cheie = `${cfg.user}|${cfg.parola}`;
  if (tokenMemorat && tokenMemorat.cheie === cheie && tokenMemorat.expira > Date.now() + 60_000) return tokenMemorat.token;
  // Parola merge în corpul cererii, nu în adresă: adresele ajung în jurnalele serverelor.
  const r = await fetch(`${BAZA}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ username: cfg.user, password: cfg.parola }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const d = await r.json().catch(() => null);
  if (!r.ok || !d?.data?.token) {
    throw new EroareFan(r.status === 401
      ? "FAN Courier a refuzat utilizatorul sau parola. Verifică-le în Admin → Integrări (sunt cele de pe selfawb.ro)."
      : `FAN Courier nu răspunde la autentificare (cod ${r.status}). Încearcă din nou peste un minut.`, r.status);
  }
  // `expiresAt` e ora României, fără fus; ne ținem cu o oră sub, ca să nu depindem de el.
  tokenMemorat = { cheie, token: d.data.token, expira: Date.now() + 23 * 3600_000 };
  return d.data.token;
}

type Cerere = { metoda?: string; query?: Record<string, string | string[]>; json?: unknown; binar?: boolean };

async function cere(cfg: ConfigFan, cale: string, c: Cerere = {}, reincercare = true): Promise<any> {
  const token = await login(cfg);
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(c.query ?? {})) {
    if (Array.isArray(v)) v.forEach((x) => q.append(k, x)); else q.append(k, v);
  }
  const r = await fetch(`${BAZA}${cale}${q.toString() ? `?${q}` : ""}`, {
    method: c.metoda ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`, Accept: c.binar ? "application/pdf" : "application/json",
      ...(c.json ? { "Content-Type": "application/json" } : {}),
    },
    body: c.json ? JSON.stringify(c.json) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  // Token expirat sau invalidat de ei: ne autentificăm din nou, o singură dată.
  if (r.status === 401 && reincercare) { tokenMemorat = null; return cere(cfg, cale, c, false); }
  if (c.binar) {
    if (!r.ok) throw new EroareFan(`FAN Courier n-a dat eticheta (cod ${r.status}).`, r.status);
    return r.arrayBuffer();
  }
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new EroareFan(mesajFan(d) ?? `FAN Courier a răspuns cu eroare (cod ${r.status}).`, r.status);
  return d;
}

/** Scoate un mesaj citibil din răspunsurile lor, care au trei forme diferite. */
function mesajFan(d: any): string | null {
  if (!d) return null;
  const e = d.errors ?? d.data?.errors ?? d.message;
  if (!e) return null;
  if (typeof e === "string") return e;
  return Object.values(e).flat().map(String).join(" ");
}

// Traducerea erorilor care se pot repara din formular. Restul trec cum vin.
function traduce(erori: any, dest: Destinatar): string {
  if (erori && typeof erori === "object") {
    const campuri = Object.keys(erori);
    if (campuri.includes("locality"))
      return `Localitatea „${dest.localitate}" nu există la FAN în județul ${dest.judet}. Corecteaz-o la „Adresa destinatarului" (numele satului sau al orașului, nu al cartierului) și încearcă din nou.`;
    if (campuri.includes("county"))
      return `Județul „${dest.judet}" nu e recunoscut de FAN. Corectează-l la „Adresa destinatarului".`;
    if (campuri.some((c) => c.includes("phone")))
      return "Telefonul destinatarului lipsește sau nu e valid. Corectează-l la „Adresa destinatarului”.";
  }
  const text = typeof erori === "string" ? erori : mesajFan({ errors: erori });
  return text === "An error occurred"
    ? "FAN Courier a refuzat AWB-ul fără să spună de ce. Verifică greutatea (minim 1 kg), telefonul și adresa."
    : `FAN Courier a refuzat AWB-ul: ${text ?? "motiv necunoscut"}.`;
}

export type Destinatar = {
  nume: string; persoana_contact?: string | null; telefon: string; email?: string | null;
  judet: string; localitate: string; strada: string;
};
export type Colet = {
  colete: number; greutate: number; lungime: number; latime: number; inaltime: number;
  ramburs: number; continut: string; observatii: string; referinta: string;
};
export type AwbGenerat = { awb: string; tarif: number; tva: number; tracking: string; serviciu: string };

export async function genereazaAwb(dest: Destinatar, colet: Colet, cfg?: ConfigFan): Promise<AwbGenerat> {
  cfg = cfg ?? await configFan();
  if (!cfg.clientId || !cfg.user || !cfg.parola)
    throw new EroareFan("FAN Courier nu e configurat. Completează Client ID, utilizatorul și parola în Admin → Integrări.");

  // Cu ramburs și cont colector, banii vin în cont; fără ramburs, serviciul e Standard.
  const serviciu = colet.ramburs > 0 && cfg.rambursInCont ? "Cont Colector" : "Standard";
  const d = await cere(cfg, "/intern-awb", {
    metoda: "POST",
    json: {
      clientId: Number(cfg.clientId),
      shipments: [{
        info: {
          service: serviciu,
          packages: { parcel: colet.colete, envelope: 0 },
          weight: colet.greutate,
          cod: colet.ramburs,
          declaredValue: 0,
          // Transportul îl plătim NOI la FAN: clientul îl plătește în ramburs,
          // fiindcă totalul comenzii îl include după „Cost livrare".
          payment: "sender",
          observation: colet.observatii.slice(0, 200),
          content: colet.continut.slice(0, 200),
          dimensions: { length: colet.lungime, width: colet.latime, height: colet.inaltime },
          // Apare în borderoul de pe selfawb.ro: așa se regăsește comanda noastră.
          costCenter: colet.referinta,
          // Fără opțiuni: coletul nu se deschide la livrare (decizie 15 septembrie 2026).
          options: [],
        },
        recipient: {
          name: dest.nume,
          contactPerson: dest.persoana_contact ?? undefined,
          phone: dest.telefon,
          email: dest.email ?? undefined,
          address: { county: faraDiacritice(dest.judet), locality: faraDiacritice(dest.localitate), street: dest.strada },
        },
      }],
    },
  });
  const r = d?.response?.[0];
  if (!r?.awbNumber) throw new EroareFan(traduce(r?.errors ?? d?.errors, dest), 422);
  return {
    awb: String(r.awbNumber),
    tarif: Number(r.tariff) || 0,
    tva: Number(r.vat) || 0,
    tracking: r.trackingUrl || `https://www.fancourier.ro/awb-tracking/?tracking=${r.awbNumber}`,
    serviciu,
  };
}

export type Tarif = {
  greutate: number; kmSuplimentari: number; combustibil: number; optiuni: number; asigurare: number;
  faraTva: number; tva: number; total: number; serviciu: string;
};

/**
 * Cât costă transportul, exact cum îl calculează FAN pentru contul nostru —
 * pentru calculatorul din comandă, cu care operatorul sună clientul.
 *
 * Măsurat pe contul real (15 septembrie 2026): suma rambursului NU schimbă
 * prețul (400 sau 1.500 lei dau același total), dar serviciul, opțiunile,
 * greutatea, dimensiunile și localitatea da. Deci se trimite ACELAȘI serviciu
 * și ACELEAȘI opțiuni (niciuna) care pleacă și pe AWB — altfel prețul spus
 * clientului n-ar fi cel facturat de FAN.
 * `returnPayment` e cerut de ei când există ramburs, chiar dacă nu schimbă suma.
 */
export async function tarifTransport(
  dest: Pick<Destinatar, "judet" | "localitate">,
  colet: Pick<Colet, "colete" | "greutate" | "lungime" | "latime" | "inaltime"> & { cuRamburs: boolean },
): Promise<Tarif> {
  const cfg = await configFan();
  if (!cfg.clientId || !cfg.user || !cfg.parola)
    throw new EroareFan("FAN Courier nu e configurat. Completează contul în Admin → Integrări.");
  const serviciu = colet.cuRamburs && cfg.rambursInCont ? "Cont Colector" : "Standard";
  const query: Record<string, string | string[]> = {
    clientId: cfg.clientId,
    "info[service]": serviciu,
    "info[payment]": "sender",
    "info[packages][parcel]": String(colet.colete),
    "info[packages][envelope]": "0",
    "info[weight]": String(colet.greutate),
    "info[dimensions][length]": String(colet.lungime),
    "info[dimensions][width]": String(colet.latime),
    "info[dimensions][height]": String(colet.inaltime),
    "recipient[county]": faraDiacritice(dest.judet),
    "recipient[locality]": faraDiacritice(dest.localitate),
  };
  if (colet.cuRamburs) { query["info[cod]"] = "1"; query["info[returnPayment]"] = "sender"; }
  let d: any;
  try {
    d = await cere(cfg, "/reports/awb/internal-tariff", { query });
  } catch (e) {
    // Tariful dă 422 cu errors.recipient.locality când localitatea nu există.
    if (e instanceof EroareFan && /localit/i.test(e.message))
      throw new EroareFan(traduce({ locality: [e.message] }, { ...dest, nume: "", telefon: "", strada: "" }), 422);
    throw e;
  }
  const t = d?.data;
  if (!t || !(Number(t.total) > 0))
    throw new EroareFan("FAN n-a putut calcula tariful pentru adresa și coletul ăsta. Verifică localitatea și dimensiunile.");
  return {
    greutate: Number(t.weightCost) || 0, kmSuplimentari: Number(t.extraKmCost) || 0,
    combustibil: Number(t.fuelCost) || 0, optiuni: Number(t.optionsCost) || 0, asigurare: Number(t.insuranceCost) || 0,
    faraTva: Number(t.costNoVAT) || 0, tva: Number(t.vat) || 0, total: Number(t.total) || 0, serviciu,
  };
}

/** Eticheta AWB, ca PDF. A4 e ce scoate orice imprimantă de birou. */
export async function etichetaAwb(awb: string): Promise<ArrayBuffer> {
  const cfg = await configFan();
  return cere(cfg, "/awb/label", { query: { clientId: cfg.clientId, "awbs[]": [awb], pdf: "1" }, binar: true });
}

export async function stergeAwb(awb: string): Promise<void> {
  const cfg = await configFan();
  await cere(cfg, "/awb", { metoda: "DELETE", query: { clientId: cfg.clientId, awb } });
}

/** Butonul „Verifică conexiunea" din Integrări: autentificarea + serviciile contului. */
export async function verificaConexiunea(): Promise<{ servicii: string[]; cfg: ConfigFan }> {
  const cfg = await configFan();
  if (!cfg.clientId || !cfg.user || !cfg.parola)
    throw new EroareFan("Completează întâi Client ID, utilizatorul și parola, apoi salvează.");
  tokenMemorat = null; // verificarea trebuie să încerce chiar parola salvată acum
  const d = await cere(cfg, "/reports/services");
  return { servicii: (d?.data ?? []).map((s: { name: string }) => s.name), cfg };
}
