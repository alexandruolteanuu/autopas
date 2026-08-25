// ============================================================
// IMPORT DIN FEED-UL pieseauto.ro — declanșatorul din terminal
//
// Feed-ul dă lista și prețul (5 coloane). Restul — poze, descriere, categorie,
// marcă, model — se află pe pagina fiecărui produs.
//
// ATENȚIE: aici NU e nicio regulă de import. Tot ce ține de extragere, potrivire
// și scriere stă în `lib/import/`, împărțit cu ecranul din admin
// (/admin/import → app/api/import/route.ts). Vezi lib/import/README.md.
// Fișierul ăsta e doar: argumente, fișier de stare, raport pe ecran.
//
// De ce mai există, dacă adminul face același lucru: 8.000 de pagini înseamnă
// ~4,5 ore. Din admin merge, în loturi, cu tabul deschis. Din terminal merge fără
// browser deloc, și e singura cale dacă site-ul nu e pornit.
//
// Cum se rulează:
//   node scripts/import-pieseauto.mjs --feed=import/feed.csv --limita=5 --uscat
//
// Opțiuni:
//   --feed=CALE     fișierul CSV (obligatoriu)
//   --limita=N      procesează doar primele N rânduri
//   --uscat         NU scrie nimic în baza de date; doar extrage și raportează
//   --reia          continuă de unde s-a oprit (starea din import/stare.json)
//   --depublica     depublică piesele care nu mai apar în feed (doar la feed complet)
//   --forteaza      trece peste protecția de 20% la depublicare
//   --json=CALE     scrie rezultatul brut într-un fișier
// ============================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  parseCSV, verificaColoane, planifica, proceseazaRanduri,
  creeazaDepozit, existaCurl, SURSA, PRAG_DEPUBLICARE,
} from "../lib/import/index.mjs";

// ---------- argumente ----------
const arg = (n, impl = null) => {
  const g = process.argv.find((a) => a.startsWith(`--${n}=`));
  if (g) return g.slice(n.length + 3);
  return process.argv.includes(`--${n}`) ? true : impl;
};
const CALE_FEED = arg("feed");
const LIMITA = Number(arg("limita", 0)) || 0;
const USCAT = !!arg("uscat");
const RELUARE = !!arg("reia");
const DEPUBLICA = !!arg("depublica");
const FORTEAZA = !!arg("forteaza");
const CALE_JSON = arg("json");
const CALE_STARE = "import/stare.json";

if (!CALE_FEED) {
  console.error("Lipsește --feed=CALE. Exemplu:\n  node scripts/import-pieseauto.mjs --feed=import/feed.csv --limita=5 --uscat");
  process.exit(2);
}

// ---------- mediul ----------
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

// ---------- starea locală, pentru --reia ----------
const scrieStare = (s) => {
  mkdirSync(dirname(CALE_STARE), { recursive: true });
  writeFileSync(CALE_STARE, JSON.stringify(s, null, 1));
};
const citesteStare = () => (existsSync(CALE_STARE) ? JSON.parse(readFileSync(CALE_STARE, "utf8")) : { gata: [] });

async function main() {
  if (!(await existaCurl()))
    console.log("⚠ `curl` lipsește — se încearcă `fetch`, dar pieseauto.ro îl refuză de obicei.");

  const env = citesteEnv();
  const depozit = creeazaDepozit({
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    key: env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  const toate = parseCSV(readFileSync(CALE_FEED, "utf8"));
  const problema = verificaColoane(toate);
  if (problema) { console.error(problema); process.exit(2); }
  console.log(`Feed: ${CALE_FEED} — ${toate.length} rânduri, coloane: ${Object.keys(toate[0] ?? {}).join(", ")}`);

  const stare = RELUARE ? citesteStare() : { gata: [] };
  const facute = new Set(stare.gata);
  const lista = LIMITA ? toate.slice(0, LIMITA) : toate;
  const deFacut = lista.filter((r) => !facute.has(r.ID));
  if (facute.size) console.log(`Reluare: ${facute.size} deja procesate, rămân ${deFacut.length}.`);

  // ---------- planul, calculat doar din CSV și din bază ----------
  const existente = await depozit.citesteToateDeLaSursa(SURSA);
  const plan = planifica(lista, existente);
  console.log(`\nPLAN`);
  console.log(`  în bază de la sursă      ${plan.inBaza}`);
  console.log(`  noi (cer descărcare)     ${plan.noi.length}  ≈ ${plan.minuteEstimate < 1 ? "sub un minut" : plan.minuteEstimate + " minute"}`);
  console.log(`  de actualizat (preț)     ${plan.deActualizat.length}  instant`);
  console.log(`  neschimbate              ${plan.neschimbate}`);
  console.log(`  dispărute din feed       ${plan.disparute.length}  (${(plan.procentDisparute * 100).toFixed(1)}%)`);
  if (USCAT) console.log("\nMOD USCAT: nu se scrie nimic în baza de date.");

  if (DEPUBLICA && plan.pragDepasit && !FORTEAZA) {
    console.error(`\n⛔ OPRIT înainte de orice scriere: fișierul ar depublica ${plan.disparute.length} din ${plan.inBaza} piese (${(plan.procentDisparute * 100).toFixed(1)}%), peste pragul de ${PRAG_DEPUBLICARE * 100}%.`);
    console.error("   Pare un export incomplet. Verifică fișierul sau adaugă --forteaza dacă știi ce faci.");
    process.exit(1);
  }

  // ---------- procesarea ----------
  const taxonomie = await depozit.citesteTaxonomia();
  let i = 0;
  const rez = await proceseazaRanduri({
    depozit, randuri: deFacut, taxonomie, uscat: USCAT,
    laProgres: (ev) => {
      i++;
      const cap = `[${i}/${deFacut.length}] ${ev.rand.ID} `;
      if (ev.tip === "eroare") console.log(`${cap}✗ ${ev.eroare}`);
      else if (ev.tip === "nou")
        console.log(`${cap}✓ ${ev.poze} poze · ${ev.ext.categorie_sursa ?? "?"} · ${ev.pot.marca ?? "?"} ${ev.pot.model ?? "?"}` +
          (ev.pot.nepotrivire_marca ? " ⚠MARCĂ" : ev.pot.nepotrivire_titlu ? " ⚠titlu" : ev.pot.generatie_dedusa ? " (generație dedusă)" : ""));
      else console.log(`${cap}· ${ev.tip}`);
      if (ev.tip !== "eroare") {
        stare.gata.push(ev.rand.ID);
        if (!USCAT) scrieStare(stare);
      }
      // Consumul de stocare, la fiecare 1.000 de piese (A.5). Nu oprește nimic.
      if (i % 1000 === 0)
        console.log(`   ▸ ${i} procesate · ${ev.rez.pozeSalvate} poze · ${(ev.rez.octetiPoze / 1024 / 1024).toFixed(1)} MB`);
    },
  });

  // ---------- depublicarea ----------
  let depublicate = 0;
  if (DEPUBLICA && !USCAT && !LIMITA) {
    const inFeed = new Set(toate.map((r) => r.ID));
    const lipsa = (await depozit.citesteToateDeLaSursa(SURSA))
      .filter((x) => !inFeed.has(x.sursa_id) && x.sursa_activ !== false);
    if (lipsa.length) await depozit.depublica(lipsa.map((x) => x.id));
    depublicate = lipsa.length;
  } else if (DEPUBLICA && LIMITA) {
    console.log("\n⚠ --depublica ignorat: cu --limita fișierul e parțial, iar depublicarea ar stinge restul catalogului.");
  }

  // ---------- raport ----------
  const proc = (n, d) => (d ? ((n / d) * 100).toFixed(0) + "%" : "—");
  console.log("\n" + "═".repeat(66));
  console.log("RAPORT");
  console.log("═".repeat(66));
  console.log(`  rânduri procesate        ${rez.procesate}/${deFacut.length}`);
  console.log(`  piese noi                ${rez.noi}`);
  console.log(`  actualizate (preț/titlu) ${rez.actualizate}`);
  console.log(`  neschimbate              ${rez.neschimbate}`);
  console.log(`  depublicate              ${depublicate}`);
  console.log(`  pagini descărcate        ${rez.pagini}`);
  console.log(`  poze aduse               ${rez.pozeSalvate}  (${(rez.octetiPoze / 1024 / 1024).toFixed(1)} MB)`);
  if (rez.pagini) {
    const pePiesa = rez.noi ? rez.octetiPoze / rez.noi : 0;
    console.log(`  estimare pentru 8.000    ${((pePiesa * 8000) / 1024 / 1024 / 1024).toFixed(2)} GB`);
  }
  console.log(`  marcate pentru revizuire ${rez.revizuire}  (${proc(rez.revizuire, rez.noi)})`);
  console.log(`  erori                    ${rez.erori.length}`);
  for (const e of rez.erori.slice(0, 20)) console.log(`      ${e.id}: ${e.eroare}`);
  if (rez.mesaj) console.log(`\n⛔ ${rez.mesaj}`);

  if (Object.keys(rez.categoriiSursa).length) {
    console.log("\n  CATEGORII-SURSĂ ÎNTÂLNITE");
    for (const [slug, n] of Object.entries(rez.categoriiSursa).sort((a, b) => b[1] - a[1]))
      console.log(`    ${String(n).padStart(4)} piese  ${slug}`);
  }

  if (CALE_JSON) { writeFileSync(CALE_JSON, JSON.stringify(rez, null, 1)); console.log(`\nRezultat brut: ${CALE_JSON}`); }
  return rez;
}

const r = await main();
console.log(`\nGata. ${r.procesate} rânduri procesate.`);
