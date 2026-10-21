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
//   · DELETE /awb        -> „The AWB was deleted successfully.”;
//   · GET  /reports/services -> serviciile contului.
// Nicio opțiune suplimentară pe AWB (`options: []`) — decizia proprietarului din
// 15 septembrie 2026: coletul NU se deschide la livrare.
// ============================================================
import { sbAdmin } from "./supabase";
import type { Integrari } from "./settings";
import { telefonNational } from "./format";

const BAZA = "https://api.fancourier.ro";
const TIMEOUT_MS = 30_000;

export type ConfigFan = {
  clientId: string; user: string; parola: string;
  /** Rambursul intră în contul bancar (serviciul „Cont Colector”), nu în plic („Standard”). */
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
  // Bifa se salvează ca text („on” / ""); un câmp care n-a fost salvat
  // niciodată înseamnă valoarea implicită, adică „da”.
  const bifa = (v: unknown) => v === undefined || v === null ? true : v === true || v === "on" || v === "da";
  return {
    clientId: String(f.client_id || process.env.FANCOURIER_CLIENT_ID || "").trim(),
    user: String(f.user || process.env.FANCOURIER_USER || "").trim(),
    parola: String(f.parola || process.env.FANCOURIER_PASS || ""),
    rambursInCont: bifa(f.ramburs_cont),
  };
}

/** Județul și localitatea FĂRĂ diacritice. Nomenclatorul FAN le scrie așa
 *  („Brosteni”), iar calculul de tarif respinge „Broșteni” ca localitate
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
      return `Localitatea „${dest.localitate}” nu există la FAN în județul ${dest.judet}. Corecteaz-o la „Adresa destinatarului” (numele satului sau al orașului, nu al cartierului) și încearcă din nou.`;
    if (campuri.includes("county"))
      return `Județul „${dest.judet}” nu e recunoscut de FAN. Corectează-l la „Adresa destinatarului”.`;
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
/** Dimensiunile sunt OPȚIONALE (cerut de proprietar, 16 septembrie 2026 — așa lucrează și în
 *  selfAWB): `null` = nu se trimit la FAN. Verificat pe API: AWB-ul și tariful merg fără ele,
 *  iar la un colet de 5 kg prețul a ieșit identic cu și fără 40×30×20. */
export type Colet = {
  colete: number; greutate: number; lungime: number | null; latime: number | null; inaltime: number | null;
  ramburs: number; continut: string; observatii: string; referinta: string;
};
/** Toate trei dimensiunile completate (≥ 1 cm). Altfel coletul pleacă fără dimensiuni. */
export const areDimensiuni = (c: { lungime: number | null; latime: number | null; inaltime: number | null }) =>
  !!(c.lungime && c.latime && c.inaltime && c.lungime >= 1 && c.latime >= 1 && c.inaltime >= 1);

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
          // Rambursul = DOAR valoarea pieselor: firma încasează numai piesa livrată.
          cod: colet.ramburs,
          declaredValue: 0,
          // Transportul îl plătește DESTINATARUL, direct la FAN (decizia proprietarului,
          // 15 septembrie 2026 — așa lucrează și din eAWB). Nu trece prin ramburs.
          payment: "recipient",
          observation: colet.observatii.slice(0, 200),
          // Rubrica „Conținut” de pe AWB rămâne goală, la cererea proprietarului.
          content: "",
          // Doar dacă operatorul le-a scris pe toate trei; altfel câmpul nu pleacă deloc.
          ...(areDimensiuni(colet) ? { dimensions: { length: colet.lungime, width: colet.latime, height: colet.inaltime } } : {}),
          // Apare în borderoul de pe selfawb.ro: așa se regăsește comanda noastră.
          costCenter: colet.referinta,
          // Fără opțiuni: coletul nu se deschide la livrare (decizie 15 septembrie 2026).
          options: [],
        },
        recipient: {
          name: dest.nume,
          contactPerson: dest.persoana_contact ?? undefined,
          // „+40734…” ar ieși pe AWB „40734…”: FAN scoate doar „+”.
          phone: telefonNational(dest.telefon),
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
    // Același plătitor ca pe AWB: destinatarul plătește transportul la FAN.
    "info[payment]": "recipient",
    "info[packages][parcel]": String(colet.colete),
    "info[packages][envelope]": "0",
    "info[weight]": String(colet.greutate),
    "recipient[county]": faraDiacritice(dest.judet),
    "recipient[locality]": faraDiacritice(dest.localitate),
  };
  if (areDimensiuni(colet)) {
    query["info[dimensions][length]"] = String(colet.lungime);
    query["info[dimensions][width]"] = String(colet.latime);
    query["info[dimensions][height]"] = String(colet.inaltime);
  }
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
    throw new EroareFan("FAN n-a putut calcula tariful pentru adresa și coletul ăsta. Verifică localitatea, greutatea și dimensiunile (dacă le-ai scris).");
  return {
    greutate: Number(t.weightCost) || 0, kmSuplimentari: Number(t.extraKmCost) || 0,
    combustibil: Number(t.fuelCost) || 0, optiuni: Number(t.optionsCost) || 0, asigurare: Number(t.insuranceCost) || 0,
    faraTva: Number(t.costNoVAT) || 0, tva: Number(t.vat) || 0, total: Number(t.total) || 0, serviciu,
  };
}

/** Eticheta AWB, ca PDF. A4 e ce scoate orice imprimantă de birou. */
export async function etichetaAwb(awb: string, cfg?: ConfigFan): Promise<ArrayBuffer> {
  cfg = cfg ?? await configFan();
  return cere(cfg, "/awb/label", { query: { clientId: cfg.clientId, "awbs[]": [awb], pdf: "1" }, binar: true });
}

/**
 * Șterge AWB-ul la FAN. Întoarce:
 *   · "sters"        — FAN a confirmat ștergerea („The AWB was deleted successfully.”);
 *   · "nu_exista"    — FAN spune că AWB-ul nu (mai) există în cont: șters deja din
 *                      selfawb.ro, scris greșit de mână, sau de pe alt cont. Rezultatul dorit
 *                      e oricum atins, deci comanda se poate curăța.
 * Orice alt refuz (AWB deja ridicat de curier, sesiune, rețea) aruncă eroarea, cu mesajul lor.
 */
export async function stergeAwb(awb: string, cfg?: ConfigFan): Promise<"sters" | "nu_exista"> {
  cfg = cfg ?? await configFan();
  const nuExista = (m: string) => /not\s*found|nu\s*exist|does\s*not\s*exist|invalid|inexistent|already|deja|deleted|sters|șters/i.test(m);
  try {
    const d = await cere(cfg, "/awb", { metoda: "DELETE", query: { clientId: cfg.clientId, awb } });
    // Un 200 cu `status: "fail"` e tot un refuz, nu o ștergere.
    if (d?.status && d.status !== "success") {
      const m = mesajFan(d) ?? String(d?.data ?? "");
      if (nuExista(m)) return "nu_exista";
      throw new EroareFan(`FAN Courier n-a șters AWB-ul: ${m || "motiv necunoscut"}.`, 422);
    }
    return "sters";
  } catch (e) {
    if (e instanceof EroareFan && (e.stare === 404 || nuExista(e.message))) return "nu_exista";
    throw e;
  }
}

/** Butonul „Verifică conexiunea” din Integrări: autentificarea + serviciile contului. */
export async function verificaConexiunea(): Promise<{ servicii: string[]; cfg: ConfigFan }> {
  const cfg = await configFan();
  if (!cfg.clientId || !cfg.user || !cfg.parola)
    throw new EroareFan("Completează întâi Client ID, utilizatorul și parola, apoi salvează.");
  tokenMemorat = null; // verificarea trebuie să încerce chiar parola salvată acum
  const d = await cere(cfg, "/reports/services");
  return { servicii: (d?.data ?? []).map((s: { name: string }) => s.name), cfg };
}

// ============================================================
// RETURURI — AWB de la CLIENT către depozit, pe cont selfAWB OCAZIONAL
//
// DE CE ALT CONT (21 octombrie 2026, documentația primită de la FAN)
// Contul nostru cu contract poate genera doar expediții care PLEACĂ de la noi.
// Pentru ridicarea unui colet de la adresa clientului, FAN cere un cont selfAWB
// „Ocazional” (client fără contract), mapat de ei la contul cu contract, de
// care se asociază plata. Deci: alt `clientId`, alt utilizator, altă parolă —
// de asta toate funcțiile de aici iau `ConfigFan` ca parametru, iar `cere()` și
// `login()` memorează token-ul după utilizator, nu global.
//
// CE E DIFERIT FAȚĂ DE UN AWB OBIȘNUIT
//   · `sender` = CLIENTUL care returnează; `recipient` = depozitul nostru.
//     La AWB-ul de livrare `sender` nu se trimite deloc: expeditorul e contul.
//   · `payment` NU e hardcodat. FAN transmite valoarea corectă după ce
//     configurează contul ocazional („va voi transmite clientId-ul si valoarea
//     corecta pentru campul «payment»"). Până atunci rămâne „sender”, valoarea
//     din exemplul lor. Verificat pe contul lor de test: și „sender”, și
//     „recipient” generează AWB, cu același tarif — deci API-ul NU ne apără de
//     o valoare greșită, iar singura sursă e ce spune FAN. De aceea e un câmp
//     în Admin → Integrări, nu o constantă.
//   · Fiecare AWB de retur are nevoie de o COMANDĂ DE CURIER (`POST /order`),
//     altfel nimeni nu se duce să ridice coletul. La livrări nu e nevoie:
//     curierul vine zilnic la depozit (decizia din 15 septembrie 2026).
//
// VERIFICAT PE API-UL REAL, cu contul lor de test de client ocazional
// (clienttest@fancourier.ro / testareFAN / clientId 323245), 21 octombrie 2026:
//   · POST /intern-awb cu sender+recipient  -> awbNumber, tariff 32,53 lei;
//   · POST /order                           -> HTTP 201, { data: { id } };
//   · GET  /awb/label                       -> PDF de ~33 KB;
//   · GET  /reports/awb/tracking            -> „registered by sender”;
//   · GET  /reports/awb/internal-tariff cu sender[] -> 39,36 lei cu TVA.
// Toate AWB-urile de probă au fost șterse după.
// ============================================================

/** Contul OCAZIONAL, din Admin → Integrări. Separat de `configFan()`, care e
 *  contul cu contract — cele două nu se amestecă niciodată. */
export type ConfigFanRetur = {
  clientId: string; user: string; parola: string;
  /** Valoarea pentru câmpul `payment`, transmisă de FAN după configurarea contului. */
  payment: string;
};

export async function configFanRetur(): Promise<ConfigFanRetur> {
  const sb = sbAdmin();
  let f: NonNullable<Integrari["fancourier_retur"]> = {};
  if (sb) {
    const { data } = await sb.from("settings").select("valoare").eq("cheie", "integrari").maybeSingle();
    f = ((data?.valoare as Integrari | undefined)?.fancourier_retur) ?? {};
  }
  // Variabilele de mediu sunt rezerva, exact ca la `configFan()`. Tot ele fac
  // posibilă verificarea pe contul de probă al FAN fără să atingem baza de
  // producție — vezi scripts/verifica-retur-fan.mjs.
  return {
    clientId: String(f.client_id || process.env.FANCOURIER_RETUR_CLIENT_ID || "").trim(),
    user: String(f.user || process.env.FANCOURIER_RETUR_USER || "").trim(),
    parola: String(f.parola || process.env.FANCOURIER_RETUR_PASS || ""),
    // Valoarea din exemplul FAN. Se schimbă cu ce transmit ei pentru contul nostru.
    payment: String(f.payment || process.env.FANCOURIER_RETUR_PAYMENT || "sender").trim(),
  };
}

/** `ConfigFanRetur` în forma pe care o cer funcțiile interne (`cere`, `login`). */
const caCfg = (r: ConfigFanRetur): ConfigFan =>
  ({ clientId: r.clientId, user: r.user, parola: r.parola, rambursInCont: false });

export const returConfigurat = (r: ConfigFanRetur) => !!(r.clientId && r.user && r.parola);

/**
 * DEPOZITUL, ca destinatar al returului.
 *
 * Județul și localitatea sunt scrise în forma din nomenclatorul FAN, verificată
 * în `fan_localitati`: județul „Neamt”, localitatea „Bistrita” (agenția
 * Piatra-Neamt, 0 km suplimentari). NU e o adresă inventată — e aceeași cu
 * `ADRESA` din lib/config.ts și cu sediul din Admin → Setări, scrisă doar în
 * forma pe care o acceptă FAN. Se poate suprascrie din Integrări, pentru cazul
 * în care recepția retururilor se mută în altă parte.
 */
export type DepozitRetur = { nume: string; telefon: string; persoanaContact: string;
  judet: string; localitate: string; strada: string };

export async function depozitRetur(): Promise<DepozitRetur> {
  const sb = sbAdmin();
  let f: NonNullable<Integrari["fancourier_retur"]> = {};
  let firma: { denumire?: string; telefon?: string } = {};
  if (sb) {
    const { data } = await sb.from("settings").select("cheie,valoare").in("cheie", ["integrari", "firma"]);
    for (const r of (data ?? []) as { cheie: string; valoare: unknown }[]) {
      if (r.cheie === "integrari") f = ((r.valoare as Integrari)?.fancourier_retur) ?? {};
      else firma = (r.valoare as typeof firma) ?? {};
    }
  }
  return {
    nume: String(f.depozit_nume || firma.denumire || "PIESE AUTO PAS SRL").trim(),
    telefon: telefonNational(String(f.depozit_telefon || firma.telefon || "0743627151")),
    persoanaContact: String(f.depozit_contact || "Receptie retururi").trim(),
    judet: faraDiacritice(String(f.depozit_judet || "Neamt")),
    localitate: faraDiacritice(String(f.depozit_localitate || "Bistrita")),
    strada: String(f.depozit_strada || "Str. Petru Rares nr. 181").trim(),
  };
}

/** De unde se ridică coletul: clientul care returnează. */
export type Expeditor = {
  nume: string; telefon: string; email?: string | null;
  judet: string; localitate: string; strada: string;
};

/** Coletul returnat. Dimensiunile sunt OBLIGATORII aici — nu la AWB (unde FAN le
 *  acceptă lipsă), ci la COMANDA DE CURIER, care le cere explicit: măsurat pe
 *  API, `/order` fără ele răspunde 422 „The info.dimensions.width field is
 *  required." Operatorul le află de la client, pe care oricum îl sună. */
export type ColetRetur = {
  colete: number; greutate: number; lungime: number; latime: number; inaltime: number;
  observatii: string; referinta: string;
};

export type AwbReturGenerat = {
  awb: string; tarif: number; tva: number; tracking: string; comandaCurierId: string | null;
};

function traduceRetur(erori: unknown, exp: Expeditor): string {
  if (erori && typeof erori === "object") {
    const campuri = Object.keys(erori as Record<string, unknown>).join(" ");
    if (/locality/i.test(campuri))
      return `Localitatea „${exp.localitate}” nu există la FAN în județul ${exp.judet}. Corecteaz-o la „Adresa de ridicare” (numele satului sau al orașului, nu al cartierului).`;
    if (/county/i.test(campuri))
      return `Județul „${exp.judet}” nu e recunoscut de FAN. Corectează-l la „Adresa de ridicare”.`;
    if (/phone/i.test(campuri))
      return "Telefonul clientului lipsește sau nu e valid. Corectează-l la „Adresa de ridicare”.";
  }
  const text = typeof erori === "string" ? erori : mesajFan({ errors: erori });
  return `FAN Courier a refuzat AWB-ul de retur: ${text ?? "motiv necunoscut"}.`;
}

/**
 * AWB de retur: coletul pleacă de la client și vine la depozit.
 *
 * Comanda de curier se plasează imediat după, în aceeași funcție, fiindcă un
 * AWB de retur fără ea nu produce nimic — nimeni nu trece pe la client. Dacă
 * AWB-ul iese dar comanda de curier pică, AWB-ul NU se anulează: există la FAN,
 * trebuie să ajungă în baza noastră, iar curierul se poate comanda separat.
 * De asta `comandaCurierId` poate fi null, cu eroarea raportată de rută.
 */
export async function genereazaAwbRetur(
  exp: Expeditor, colet: ColetRetur, dataRidicare: string,
  cfgR?: ConfigFanRetur, dep?: DepozitRetur,
): Promise<AwbReturGenerat & { eroareCurier: string | null }> {
  cfgR = cfgR ?? await configFanRetur();
  if (!returConfigurat(cfgR))
    throw new EroareFan("Contul FAN de retur nu e configurat. Completează Client ID, utilizatorul și parola contului OCAZIONAL în Admin → Integrări (sunt altele decât cele de livrare).");
  dep = dep ?? await depozitRetur();
  const cfg = caCfg(cfgR);

  const d = await cere(cfg, "/intern-awb", {
    metoda: "POST",
    json: {
      clientId: Number(cfgR.clientId),
      shipments: [{
        info: {
          service: "Standard",
          packages: { parcel: colet.colete, envelope: 0 },
          weight: colet.greutate,
          // Returul nu are ramburs: clientul nu încasează nimic de la curier.
          cod: 0,
          declaredValue: 0,
          // Valoarea transmisă de FAN pentru contul nostru ocazional.
          payment: cfgR.payment,
          observation: colet.observatii.slice(0, 200),
          content: "",
          dimensions: { length: colet.lungime, width: colet.latime, height: colet.inaltime },
          // Numărul comenzii, ca returul să se regăsească în borderoul de pe selfawb.ro.
          costCenter: colet.referinta,
          options: [],
        },
        // EXPEDITOR = clientul. Aici e toată diferența față de un AWB de livrare.
        sender: {
          name: exp.nume,
          phone: telefonNational(exp.telefon),
          email: exp.email ?? undefined,
          address: {
            county: faraDiacritice(exp.judet), locality: faraDiacritice(exp.localitate),
            street: exp.strada,
          },
        },
        recipient: {
          name: dep.nume,
          contactPerson: dep.persoanaContact,
          phone: dep.telefon,
          address: { county: dep.judet, locality: dep.localitate, street: dep.strada },
        },
      }],
    },
  });
  const r = d?.response?.[0];
  if (!r?.awbNumber) throw new EroareFan(traduceRetur(r?.errors ?? d?.errors, exp), 422);
  const awb = String(r.awbNumber);

  // COMANDA DE CURIER. Eșecul ei NU anulează AWB-ul: vezi comentariul funcției.
  let comandaCurierId: string | null = null;
  let eroareCurier: string | null = null;
  try {
    comandaCurierId = await comandaCurier(exp, colet, dataRidicare, awb, cfgR);
  } catch (e) {
    eroareCurier = e instanceof Error ? e.message : "Comanda de curier n-a putut fi plasată.";
  }

  return {
    awb, tarif: Number(r.tariff) || 0, tva: Number(r.vat) || 0,
    tracking: r.trackingUrl || `https://www.fancourier.ro/awb-tracking/?tracking=${awb}`,
    comandaCurierId, eroareCurier,
  };
}

/** Intervalul de ridicare trimis la FAN.
 *
 *  09:00–14:00 e singura fereastră validă ORIUNDE: documentația lor dă patru
 *  intervale diferite, după localitate (București L–V 09–19, restul 09–17,
 *  localitate exterioară fără km 09–15, cu km taxabili 09–14), iar noi nu știm
 *  dinainte în care cade clientul. FAN cere minimum 2 ore între capete —
 *  verificat: un interval de o oră întoarce 422. */
export const INTERVAL_RIDICARE = { first: "09:00", second: "14:00" };

/**
 * Comandă de curier pentru ridicarea coletului de la client.
 *
 * `awbNumber` se trimite INTENȚIONAT: cu el, eticheta o printează și o aduce
 * curierul. Clientul care returnează o piesă n-are de ce să aibă imprimantă —
 * fără asta, returul s-ar bloca exact la ultimul pas.
 */
export async function comandaCurier(
  exp: Expeditor, colet: ColetRetur, dataRidicare: string, awb: string | null,
  cfgR?: ConfigFanRetur,
): Promise<string> {
  cfgR = cfgR ?? await configFanRetur();
  const d = await cere(caCfg(cfgR), "/order", {
    metoda: "POST",
    json: {
      clientId: Number(cfgR.clientId),
      info: {
        awbNumber: awb,
        packages: { parcel: colet.colete, envelope: 0 },
        weight: colet.greutate,
        // Obligatorii la /order, spre deosebire de /intern-awb (măsurat: 422 fără ele).
        dimensions: { width: colet.latime, length: colet.lungime, height: colet.inaltime },
        orderType: "Standard",
        pickupDate: dataRidicare,
        pickupHours: INTERVAL_RIDICARE,
        observations: colet.observatii.slice(0, 200),
      },
      // Fără `sender`, FAN ar trimite curierul la adresa cu care s-a înregistrat
      // contul ocazional — adică nu la client. Verificat: câmpul e acceptat.
      sender: {
        name: exp.nume,
        phone: telefonNational(exp.telefon),
        email: exp.email ?? undefined,
        address: {
          county: faraDiacritice(exp.judet), locality: faraDiacritice(exp.localitate),
          street: exp.strada,
        },
      },
    },
  });
  const id = d?.data?.id;
  if (!id) throw new EroareFan(mesajFan(d) ?? "FAN n-a confirmat comanda de curier.", 422);
  return String(id);
}

/**
 * Anulează comanda de curier. Ca la `stergeAwb`, „nu există / deja anulată” e
 * rezultatul dorit, nu o eroare: verificat pe contul lor de test, o comandă
 * ștearsă răspunde cu 403 „This order was already deleted”.
 */
export async function anuleazaComandaCurier(id: string, cfgR?: ConfigFanRetur): Promise<"anulata" | "nu_exista"> {
  cfgR = cfgR ?? await configFanRetur();
  const deja = (m: string) => /already|deleted|not\s*found|nu\s*exist|invalid/i.test(m);
  try {
    const d = await cere(caCfg(cfgR), "/order", { metoda: "DELETE", query: { clientId: cfgR.clientId, id } });
    if (d?.status && d.status !== "success") {
      const m = mesajFan(d) ?? "";
      if (deja(m)) return "nu_exista";
      throw new EroareFan(`FAN n-a anulat comanda de curier: ${m || "motiv necunoscut"}.`, 422);
    }
    return "anulata";
  } catch (e) {
    if (e instanceof EroareFan && (e.stare === 403 || e.stare === 404 || deja(e.message))) return "nu_exista";
    throw e;
  }
}

/** Cât costă returul, înainte de a-l genera — operatorul sună clientul oricum.
 *  Spre deosebire de tariful de livrare, aici contează ȘI de unde pleacă. */
export async function tarifRetur(
  exp: Pick<Expeditor, "judet" | "localitate">,
  colet: Pick<ColetRetur, "colete" | "greutate" | "lungime" | "latime" | "inaltime">,
  cfgR?: ConfigFanRetur, dep?: DepozitRetur,
): Promise<Tarif> {
  cfgR = cfgR ?? await configFanRetur();
  if (!returConfigurat(cfgR))
    throw new EroareFan("Contul FAN de retur nu e configurat. Completează-l în Admin → Integrări.");
  dep = dep ?? await depozitRetur();
  const d = await cere(caCfg(cfgR), "/reports/awb/internal-tariff", {
    query: {
      clientId: cfgR.clientId,
      "info[service]": "Standard",
      "info[payment]": cfgR.payment,
      "info[packages][parcel]": String(colet.colete),
      "info[packages][envelope]": "0",
      "info[weight]": String(colet.greutate),
      "info[dimensions][length]": String(colet.lungime),
      "info[dimensions][width]": String(colet.latime),
      "info[dimensions][height]": String(colet.inaltime),
      "sender[county]": faraDiacritice(exp.judet),
      "sender[locality]": faraDiacritice(exp.localitate),
      "recipient[county]": dep.judet,
      "recipient[locality]": dep.localitate,
    },
  });
  const t = d?.data;
  if (!t || !(Number(t.total) > 0))
    throw new EroareFan("FAN n-a putut calcula tariful returului. Verifică localitatea, greutatea și dimensiunile.");
  return {
    greutate: Number(t.weightCost) || 0, kmSuplimentari: Number(t.extraKmCost) || 0,
    combustibil: Number(t.fuelCost) || 0, optiuni: Number(t.optionsCost) || 0,
    asigurare: Number(t.insuranceCost) || 0, faraTva: Number(t.costNoVAT) || 0,
    tva: Number(t.vat) || 0, total: Number(t.total) || 0, serviciu: "Standard",
  };
}

/** „Verifică conexiunea” pentru contul ocazional. */
export async function verificaReturul(): Promise<{ servicii: string[]; cfg: ConfigFanRetur }> {
  const cfgR = await configFanRetur();
  if (!returConfigurat(cfgR))
    throw new EroareFan("Completează întâi Client ID, utilizatorul și parola contului ocazional, apoi salvează.");
  tokenMemorat = null;
  const d = await cere(caCfg(cfgR), "/reports/services");
  return { servicii: (d?.data ?? []).map((s: { name: string }) => s.name), cfg: cfgR };
}
