// ============================================================
// FIȘIERE ORFANE ÎN `poze-piese`
//
// TIPARUL, găsit la 25 august 2026
// `components/admin/PhotoUploader.tsx` urcă poza în Storage IMEDIAT ce o alegi,
// dar adresa ei intră doar în starea formularului. Rândul din `products` se
// scrie abia când apeși „Salvează". Între cele două momente poți închide tabul,
// apăsa „Renunță" sau da peste o eroare de salvare — și atunci fișierul rămâne
// în bucket, fără ca nimic să mai arate vreodată spre el.
//
// La 8.000 de piese, fiecare abandon de formular lasă în urmă 1–5 fișiere de
// câteva sute de KB. Nimeni nu le vede: nu apar nicăieri în interfață, doar pe
// factura de la Supabase.
//
// A doua față a aceleiași monede: butonul de ștergere din PhotoUploader șterge
// fișierul din Storage pe loc. Dacă operatorul NU salvează formularul după aceea,
// rândul din bază rămâne cu o adresă care nu mai există — poză moartă pe site.
// Scriptul raportează și cazul ăsta („referințe fără fișier"), care e mai grav
// decât un orfan, fiindcă îl vede clientul.
//
// SIGURANȚĂ
//   · implicit NU șterge nimic; doar raportează. Ștergerea cere `--sterge`
//   · nu atinge fișierele mai noi de 24 de ore (`--ore=N`): un operator poate
//     avea chiar acum un formular deschis, cu poze urcate și nesalvate
//
//   node scripts/curata-orfani.mjs                # raport
//   node scripts/curata-orfani.mjs --sterge       # raport + ștergere
//   node scripts/curata-orfani.mjs --sterge --ore=72
// ============================================================
import { readFileSync, existsSync } from "node:fs";

const STERGE = process.argv.includes("--sterge");
const ORE = Number(process.argv.find((a) => a.startsWith("--ore="))?.slice(6) ?? 24);

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
const URL_BAZA = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BAZA || !KEY) { console.error("Lipsesc cheile din .env.local."); process.exit(2); }
const h = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

/** Storage nu dă o listare recursivă: folderele vin ca intrări cu `id: null`. */
async function listeaza(prefix = "") {
  const out = [];
  for (let offset = 0; ; offset += 100) {
    const r = await fetch(`${URL_BAZA}/storage/v1/object/list/poze-piese`, {
      method: "POST", headers: h,
      body: JSON.stringify({ prefix, limit: 100, offset, sortBy: { column: "name", order: "asc" } }),
    });
    const lot = await r.json();
    if (!Array.isArray(lot) || !lot.length) break;
    for (const x of lot) {
      const cale = prefix ? `${prefix}/${x.name}` : x.name;
      if (x.id === null) out.push(...await listeaza(cale));
      else out.push({ cale, marime: x.metadata?.size ?? 0, creat: x.created_at });
    }
    if (lot.length < 100) break;
  }
  return out;
}

const fisiere = await listeaza();
const piese = await (await fetch(`${URL_BAZA}/rest/v1/products?select=id,nume,poze,poze_sursa`, { headers: h })).json();

// Se numără ȘI `poze_sursa`: acolo stau de obicei adrese de pe pieseauto.ro, dar
// dacă vreodată ajunge acolo o adresă din bucketul nostru, fișierul nu e orfan.
const folosite = new Set();
for (const p of piese)
  for (const u of [...(p.poze ?? []), ...(p.poze_sursa ?? [])]) {
    const m = String(u).match(/\/poze-piese\/(.+)$/);
    if (m) folosite.add(decodeURIComponent(m[1]));
  }

const acum = Date.now();
const oreVechi = (f) => (acum - new Date(f.creat).getTime()) / 36e5;
const neatinse = fisiere.filter((f) => !folosite.has(f.cale));
const orfani = neatinse.filter((f) => oreVechi(f) >= ORE);
const proaspete = neatinse.filter((f) => oreVechi(f) < ORE);
const lipsa = [...folosite].filter((c) => !fisiere.some((f) => f.cale === c));
const kb = (n) => (n / 1024).toFixed(0) + " KB";

console.log(`fișiere în bucket        ${fisiere.length}`);
console.log(`legate de un produs      ${fisiere.length - neatinse.length}`);
console.log(`orfane, peste ${ORE}h      ${orfani.length}  (${kb(orfani.reduce((s, f) => s + f.marime, 0))})`);
if (proaspete.length)
  console.log(`orfane, dar proaspete    ${proaspete.length}  — sub ${ORE}h, poate fi un formular deschis acum; NU se ating`);

if (lipsa.length) {
  console.log(`\n⚠ REFERINȚE FĂRĂ FIȘIER  ${lipsa.length} — piese cu poze moarte pe site:`);
  for (const c of lipsa) {
    const p = piese.find((x) => [...(x.poze ?? [])].some((u) => String(u).includes(c)));
    console.log(`    ${c}${p ? `  → piesa #${p.id} „${p.nume.slice(0, 45)}"` : ""}`);
  }
} else console.log(`referințe fără fișier    0`);

if (orfani.length) {
  console.log("\nORFANE:");
  for (const f of orfani.sort((a, b) => a.creat.localeCompare(b.creat)))
    console.log(`  ${f.creat.slice(0, 19).replace("T", " ")}  ${kb(f.marime).padStart(9)}  ${f.cale}`);
}

if (!STERGE) {
  if (orfani.length) console.log(`\nNimic nu s-a șters. Adaugă --sterge dacă lista de mai sus e în regulă.`);
  process.exit(0);
}

let sterse = 0;
for (const f of orfani) {
  const r = await fetch(`${URL_BAZA}/storage/v1/object/poze-piese/${f.cale}`, {
    method: "DELETE", headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  if (r.ok) { sterse++; console.log(`  ✓ șters  ${f.cale}`); }
  else console.log(`  ✗ ${f.cale}: HTTP ${r.status}`);
}
console.log(`\n${sterse} din ${orfani.length} șterse · ${kb(orfani.slice(0, sterse).reduce((s, f) => s + f.marime, 0))} eliberați`);
