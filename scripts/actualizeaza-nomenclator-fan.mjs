// ============================================================
// NOMENCLATORUL DE ADRESE FAN COURIER -> Supabase (migrarea 44)
//
// Aduce din API-ul FAN județele, localitățile (cu agenția și km suplimentari) și
// străzile, și le scrie în `fan_localitati` / `fan_strazi`. Checkout-ul le
// folosește ca liste de alegere, ca adresa unei comenzi să fie scrisă exact cum o
// acceptă FAN la AWB și la calculul de tarif.
//
//   node scripts/actualizeaza-nomenclator-fan.mjs           # aduce și scrie
//   node scripts/actualizeaza-nomenclator-fan.mjs --uscat   # doar aduce și numără
//
// Contul FAN se citește din `settings.integrari.fancourier` (Admin → Integrări).
// Durează ~5 minute: 42 de cereri pentru localități și ~150 de pagini de străzi.
//
// PLASA: dacă FAN întoarce mult mai puțin decât avem (sub 90%), scriptul NU
// scrie și NU șterge nimic. Un răspuns trunchiat al lor n-are voie să golească
// lista din checkout — ar bloca toate comenzile.
//
// Rândurile care nu mai apar la FAN se șterg abia la final, după ce totul s-a
// scris cu succes (au `actualizat_la` mai vechi decât începutul rulării).
// ============================================================
import { readFileSync, existsSync } from "node:fs";

const USCAT = process.argv.includes("--uscat");
const API = "https://api.fancourier.ro";

function citesteEnv() {
  const out = {};
  for (const f of [".env.local", ".env"]) {
    if (!existsSync(f)) continue;
    for (const l of readFileSync(f, "utf8").split("\n")) {
      const m = l.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m && !(m[1] in out)) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  return out;
}
const env = citesteEnv();
const URL_BAZA = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, ""), KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BAZA || !KEY) { console.error("Lipsesc cheile din .env.local."); process.exit(2); }
const h = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

const pauza = (ms) => new Promise((r) => setTimeout(r, ms));

// Ce NU e stradă în nomenclatorul lor (numărat la prima rulare, 15 septembrie 2026):
//   · 13.833 de rânduri cu strada GOALĂ — câte unul pe localitate. Păstrate, ar fi
//     făcut ca toate satele să pară că au nomenclator de străzi, iar checkout-ul ar
//     fi cerut stradă obligatorie peste tot;
//   · 9.530 „PayPoint" și 3.311 „Locker" — puncte de ridicare, nu adrese
//     („PayPoint _STR MIHAI EMINESCU NR 5 BL D6").
const NU_E_STRADA = new Set(["paypoint", "locker"]);
const eStrada = (s) => (s.street ?? "").trim() !== "" && !NU_E_STRADA.has((s.type ?? "").trim().toLowerCase())
  && !(s.street ?? "").trim().startsWith("_");
/** „STRADA", „strada", „Strada " -> „Strada". */
const tip = (t) => { const x = (t ?? "").trim().toLowerCase(); return x ? x[0].toUpperCase() + x.slice(1) : null; };

/** O cerere la FAN, cu trei încercări: API-ul lor are hopuri rare, dar are. */
async function fan(token, cale) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(`${API}${cale}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, signal: AbortSignal.timeout(60_000) });
      if (r.ok) return await r.json();
      if (r.status < 500 || i >= 3) throw new Error(`${cale}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
    } catch (e) {
      if (i >= 3) throw e;
    }
    await pauza(3000 * i);
  }
}

async function rest(cale, init = {}) {
  const r = await fetch(`${URL_BAZA}/rest/v1/${cale}`, { ...init, headers: { ...h, ...(init.headers ?? {}) } });
  if (!r.ok) throw new Error(`${cale.split("?")[0]}: HTTP ${r.status} ${(await r.text()).slice(0, 300)}`);
  return r;
}

/** Câte rânduri are o tabelă acum (din content-range, nu din lungimea răspunsului). */
async function cate(tabela) {
  const r = await rest(`${tabela}${tabela.includes("?") ? "&" : "?"}select=judet`, { method: "HEAD", headers: { Prefer: "count=exact", Range: "0-0" } });
  return Number((r.headers.get("content-range") ?? "*/0").split("/")[1]) || 0;
}

async function scrieInLoturi(tabela, randuri, cheie) {
  for (let i = 0; i < randuri.length; i += 1000) {
    await rest(`${tabela}?on_conflict=${cheie}`, {
      method: "POST", body: JSON.stringify(randuri.slice(i, i + 1000)),
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    });
    process.stdout.write(`\r  ${tabela}: ${Math.min(i + 1000, randuri.length)} / ${randuri.length}   `);
  }
  process.stdout.write("\n");
}

// ---------- 1. contul FAN ----------
const setari = await (await rest("settings?select=valoare&cheie=eq.integrari")).json();
const f = setari[0]?.valoare?.fancourier ?? {};
if (!f.user || !f.parola) { console.error("Contul FAN nu e completat în Admin → Integrări."); process.exit(2); }
const login = await fetch(`${API}/login`, { method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: f.user, password: f.parola }) });
const token = (await login.json().catch(() => null))?.data?.token;
if (!token) { console.error(`FAN a refuzat autentificarea (HTTP ${login.status}).`); process.exit(2); }

const inceput = new Date().toISOString();

// ---------- 2. localitățile, județ cu județ ----------
const judete = (await fan(token, "/reports/counties")).data.map((j) => j.name);
console.log(`${judete.length} județe`);
const localitati = new Map();
for (const j of judete) {
  const d = await fan(token, `/reports/localities?county=${encodeURIComponent(j)}`);
  for (const l of d.data ?? []) {
    localitati.set(`${l.county}|${l.name}`, {
      judet: l.county, localitate: l.name, agentie: l.agency ?? null,
      km_extra: Number(l.exteriorKm) || 0, are_strazi: false, actualizat_la: inceput,
    });
  }
  process.stdout.write(`\r  localități: ${localitati.size} (${j})          `);
}
process.stdout.write("\n");

// ---------- 3. străzile, pagină cu pagină ----------
const strazi = new Map();
let pagina = 1, total = 0;
do {
  const d = await fan(token, `/reports/streets?perPage=1000&page=${pagina}`);
  total = Number(d.total) || 0;
  for (const s of d.data ?? []) {
    if (!eStrada(s)) continue;
    strazi.set(s.id, { id: s.id, judet: s.county, localitate: s.locality, strada: s.street.trim(), tip: tip(s.type), actualizat_la: inceput });
    const loc = localitati.get(`${s.county}|${s.locality}`);
    if (loc) loc.are_strazi = true;
  }
  process.stdout.write(`\r  străzi: ${strazi.size} / ${total}   `);
  pagina++;
} while ((pagina - 1) * 1000 < total);
process.stdout.write("\n");

const cuStrazi = [...localitati.values()].filter((l) => l.are_strazi).length;
console.log(`Adus de la FAN: ${localitati.size} localități (${cuStrazi} cu nomenclator de străzi), ${strazi.size} străzi.`);

// ---------- 4. plasa ----------
// Străzile se compară doar cu rândurile valide din bază: prima rulare le scrisese și
// pe cele goale/PayPoint/Locker, iar plasa ar fi oprit curățenia lor.
const [aveamLoc, aveamStr] = await Promise.all([cate("fan_localitati"), cate("fan_strazi?strada=neq.&tip=not.in.(PayPoint,Locker)")]);
console.log(`În bază acum: ${aveamLoc} localități, ${aveamStr} străzi.`);
if (localitati.size < 10_000 || localitati.size < aveamLoc * 0.9 || strazi.size < aveamStr * 0.9) {
  console.error("⚠ FAN a întors mult mai puțin decât avem. Nu scriu și nu șterg nimic — verifică și rulează din nou.");
  process.exit(1);
}
if (USCAT) { console.log("--uscat: nu s-a scris nimic."); process.exit(0); }

// ---------- 5. scrierea, apoi ștergerea rândurilor dispărute ----------
await scrieInLoturi("fan_localitati", [...localitati.values()], "judet,localitate");
await scrieInLoturi("fan_strazi", [...strazi.values()], "id");
await rest(`fan_strazi?actualizat_la=lt.${encodeURIComponent(inceput)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
await rest(`fan_localitati?actualizat_la=lt.${encodeURIComponent(inceput)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
const [acumLoc, acumStr] = await Promise.all([cate("fan_localitati"), cate("fan_strazi")]);
console.log(`✓ Gata. În bază: ${acumLoc} localități, ${acumStr} străzi.`);
