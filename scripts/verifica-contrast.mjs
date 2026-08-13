// ============================================================
// VERIFICAREA CONTRASTULUI — pe paleta site-ului și pe cea a panoului /admin.
//
// Citește variabilele din app/globals.css și calculează raporturile de
// contrast, ca să nu evaluăm din ochi. Praguri (WCAG 2.1):
//   4.5:1 text normal (1.4.3)
//   3:1   text mare, peste 24px sau 19px bold (1.4.3)
//   3:1   conturul componentelor de interfață — chenare de input,
//         de buton, marcaje de stare (1.4.11)
//
//   node scripts/verifica-contrast.mjs
//
// Iese cu cod 1 dacă vreo pereche obligatorie pică, ca să poată fi pus în CI.
// ============================================================
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

const VARIABILE = ["--fundal", "--suprafata", "--suprafata-2", "--text", "--text-secundar",
  "--chenar", "--chenar-puternic", "--camp-bg", "--accent", "--accent-hover",
  "--accent-contrast", "--header-bg", "--header-text", "--footer-bg", "--footer-text"];

/** Extrage paletele: `:root { … }` (site-ul public) și `.tema-clasica { … }` (/admin).
 *
 *  Blocul `@media print` conține și el un `:root` cu variabile răsturnate pentru
 *  hârtie. Îl scoatem din text înainte de căutare: altfel ar fi raportat ca o a
 *  treia paletă, complet albă, și ar da o „temă" falsă în tabel. */
function citesteTeme() {
  const fara_print = css.replace(/@media\s+print\s*\{[\s\S]*?\n\}/g, "");
  const teme = [];
  const re = /(:root|\.tema-clasica)\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(fara_print))) {
    const nume = m[1] === ":root" ? "site public (atelier-galben)" : "/admin (tema clasică)";
    const corp = m[2];
    if (!corp.includes("--fundal")) continue; // sar peste :root-ul cu scara de rotunjire
    const val = {};
    for (const v of VARIABILE) {
      const mm = new RegExp(`${v}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)`).exec(corp);
      if (mm) val[v] = [+mm[1], +mm[2], +mm[3]];
    }
    teme.push({ nume, val });
  }
  return teme;
}

const canal = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lumina = (c) => 0.2126 * canal(c[0]) + 0.7152 * canal(c[1]) + 0.0722 * canal(c[2]);
function contrast(a, b) {
  const [l1, l2] = [lumina(a), lumina(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

// [etichetă, culoare, fundal, prag]
const PERECHI = [
  ["text pe fundal", "--text", "--fundal", 4.5],
  ["text pe card", "--text", "--suprafata", 4.5],
  ["text secundar pe card", "--text-secundar", "--suprafata", 4.5],
  ["text în câmp", "--text", "--camp-bg", 4.5],
  ["CHENAR INPUT pe card", "--chenar-puternic", "--suprafata", 3],
  ["CHENAR INPUT pe câmp", "--chenar-puternic", "--camp-bg", 3],
  ["text pe buton", "--accent-contrast", "--accent", 4.5],
  ["text pe buton (hover)", "--accent-contrast", "--accent-hover", 4.5],
  ["accent pe card (preț, link)", "--accent", "--suprafata", 4.5],
  ["accent pe header", "--accent", "--header-bg", 3],
  ["text header", "--header-text", "--header-bg", 4.5],
  ["text subsol", "--footer-text", "--footer-bg", 4.5],
];

const teme = citesteTeme();
let cazuri = 0, picate = 0;
const lat = Math.max(...PERECHI.map((p) => p[0].length)) + 2;

for (const t of teme) {
  console.log(`\n── ${t.nume} ${"─".repeat(Math.max(0, 34 - t.nume.length))}`);
  for (const [eticheta, a, b, prag] of PERECHI) {
    if (!t.val[a] || !t.val[b]) { console.log(`   ${eticheta.padEnd(lat)} lipsesc variabile`); continue; }
    const r = contrast(t.val[a], t.val[b]);
    const ok = r >= prag;
    cazuri++; if (!ok) picate++;
    console.log(`   ${eticheta.padEnd(lat)} ${r.toFixed(2).padStart(6)} : 1   prag ${prag}   ${ok ? "trece" : "PICĂ"}`);
  }
}

console.log(`\n=== ${cazuri - picate} din ${cazuri} trec · ${teme.length} palete ===`);
if (picate) { console.log(`${picate} perechi sub prag.`); process.exit(1); }
