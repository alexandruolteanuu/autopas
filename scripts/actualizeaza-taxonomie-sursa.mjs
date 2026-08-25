// ============================================================
// TAXONOMIA pieseauto.ro -> lib/import/taxonomie-sursa.json
//
// pieseauto.ro publică la /categorii/ catalogul complet: grupe (titluri) și
// categoriile din fiecare. Breadcrumb-ul unei pagini de produs NU conține grupa
// — arată „Piese Auto > Etriere > Audi > A4 B8 > Neamț" — deci nivelul de sus se
// poate afla doar de aici.
//
// Fișierul rezultat (`.mjs`, nu `.json`: se importă la fel din Node și din
// build-ul Next, fără atribute de import) e citit de `lib/import/potrivire.mjs`
// ca să dea unei
// categorii-sursă necunoscute un NUME omenesc („Carcasă filtru aer", nu
// „carcasa-filtru-aer") și un părinte. E ținut în git, nu descărcat la fiecare
// import: aduce zero cereri în plus către serverul lor la cele ~8.000 de pagini
// și lasă urmă în istoric la fiecare schimbare a catalogului lor.
//
//   node scripts/actualizeaza-taxonomie-sursa.mjs [--uscat]
// ============================================================
import { writeFileSync, readFileSync } from "node:fs";
import { aducePagina } from "../lib/import/aducere.mjs";

const USCAT = process.argv.includes("--uscat");
const IESIRE = new URL("../lib/import/taxonomie-sursa.mjs", import.meta.url).pathname;

// Linkuri care arată ca o categorie, dar sunt pagini de serviciu ale site-ului.
const NU_E_CATEGORIE = new Set([
  "articole", "categorii", "contact", "despre", "politica-cookie", "termeni-si-conditii",
  "vinde", "cereri-piese-auto", "magazine-piese-auto", "parcuri-dezmembrari", "service-auto",
]);

const faraTaguri = (s) => s.replace(/<[^>]+>/g, "").trim();
const dezescapeaza = (s) => s
  .replace(/&amp;/g, "&").replace(/&#0?39;/g, "'").replace(/&quot;/g, '"')
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").trim();

/** Titlurile și linkurile, în ordinea din pagină: fiecare link aparține ultimului
 *  titlu de dinaintea lui. Asta e singura legătură dintre categorie și grupa ei. */
export function extrageTaxonomia(html) {
  const start = html.indexOf("Catalog de piese auto");
  const zona = start > 0 ? html.slice(start) : html;

  const puncte = [];
  for (const m of zona.matchAll(/<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/g))
    puncte.push({ la: m.index, tip: "grup", val: dezescapeaza(faraTaguri(m[2])) });
  for (const m of zona.matchAll(/<a[^>]+href="(?:https:\/\/www\.pieseauto\.ro)?\/([a-z0-9-]+)\/"[^>]*>([\s\S]*?)<\/a>/g))
    puncte.push({ la: m.index, tip: "cat", val: { slug: m[1], nume: dezescapeaza(faraTaguri(m[2])) } });
  puncte.sort((a, b) => a.la - b.la);

  const harta = {};
  let grup = null;
  for (const p of puncte) {
    if (p.tip === "grup") { grup = p.val; continue; }
    if (!grup || grup === "Catalog de piese auto") continue;
    const { slug, nume } = p.val;
    if (!slug || !nume || NU_E_CATEGORIE.has(slug) || harta[slug]) continue;
    harta[slug] = { nume, grup };
  }
  return harta;
}

const r = await aducePagina("https://www.pieseauto.ro/categorii/");
if (!r.ok) { console.error("Nu s-a putut aduce /categorii/:", r.eroare); process.exit(1); }

const harta = extrageTaxonomia(r.html);
const nrGrupe = new Set(Object.values(harta).map((x) => x.grup)).size;
if (Object.keys(harta).length < 300) {
  console.error(`Doar ${Object.keys(harta).length} categorii extrase — pagina lor s-a schimbat. Nu suprascriu fișierul.`);
  process.exit(1);
}

let vechi = {};
try { vechi = (await import(IESIRE)).default; } catch { /* prima rulare */ }
const noi = Object.keys(harta).filter((s) => !vechi[s]);
const disparute = Object.keys(vechi).filter((s) => !harta[s]);

console.log(`${Object.keys(harta).length} categorii în ${nrGrupe} grupe`);
console.log(`  noi față de fișierul actual: ${noi.length}${noi.length ? " — " + noi.slice(0, 8).join(", ") : ""}`);
console.log(`  dispărute:                   ${disparute.length}${disparute.length ? " — " + disparute.slice(0, 8).join(", ") : ""}`);

if (USCAT) { console.log("\nMOD USCAT: nu s-a scris nimic."); process.exit(0); }
const antet = `// GENERAT de scripts/actualizeaza-taxonomie-sursa.mjs — nu se editează cu mâna.
// Catalogul pieseauto.ro: ${Object.keys(harta).length} categorii în ${nrGrupe} grupe.
// Rulează scriptul din nou când catalogul lor se schimbă.
export default `;
writeFileSync(IESIRE, antet + JSON.stringify(harta, null, 1) + ";\n", "utf8");
console.log(`\nScris în ${IESIRE}`);
