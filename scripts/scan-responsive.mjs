// ============================================================
// SCANARE RESPONSIVE — toate paginile × toate lățimile.
//
// Raportează, pentru fiecare combinație:
//   · scroll orizontal, cu elementul vinovat (selector + început de text)
//   · suprapuneri între elemente interactive
//   · ținte de atingere sub 44px
//   · text sub 12px
//
// Cum se rulează (serverul trebuie să meargă separat: `npm run dev`):
//   node scripts/verifica-contrast.mjs   # paletele
//   node scripts/scan-responsive.mjs     # scanarea
//
// Are nevoie de `playwright-core` și de un Chromium. NU e pus în
// package.json intenționat: e unealtă de verificare, nu dependință a
// site-ului, și n-are ce căuta în build-ul de pe Vercel. Instalare, o
// singură dată, oriunde în afara proiectului:
//   npm i playwright-core && npx playwright install chromium
// apoi îl legi în node_modules-ul proiectului (NODE_PATH NU merge la module
// ESM, Node nu-l consultă la `import`):
//   ln -s /cale/catre/node_modules/playwright-core node_modules/playwright-core
//
// Opțiuni:
//   BASE=http://localhost:3000   adresa site-ului
//   TEMA=luminos                 scanează pe tema luminoasă (implicit: întunecat)
//   DOAR=/piese,/cos             scanează doar paginile astea
//   LATIMI=360,768               scanează doar lățimile astea
//   JSON=raport.json             scrie rezultatul brut într-un fișier
// ============================================================

let chromium;
try { ({ chromium } = await import("playwright-core")); }
catch {
  console.error("Lipsește `playwright-core`. Vezi instrucțiunile din capul acestui fișier.");
  process.exit(2);
}

const BASE = process.env.BASE ?? "http://localhost:3000";

const LATIMI = (process.env.LATIMI?.split(",").map(Number)) ??
  [320, 360, 375, 390, 414, 428, 480, 640, 768, 834, 1024, 1280, 1440];

// Slugurile reale se află din site, nu se scriu de mână: dacă se schimbă
// datele din Supabase, scanarea merge mai departe.
const PAGINI_FIXE = [
  "/", "/piese", "/favorite", "/cos", "/checkout", "/cont", "/autentificare",
  "/cauta-dupa-masina", "/preda-masina", "/programul-rabla", "/despre-noi",
  "/contact", "/faq", "/formular-retur", "/legal/politica-de-cookies",
  "/pagina-care-nu-exista", "/admin",
];

const TEMA = process.env.TEMA === "luminos" ? "luminos" : "intunecat";

const browser = await chromium.launch();

// Tema se alege scriind în localStorage ÎNAINTE de scripturile paginii: exact
// ce citește scriptul anti-flash din app/layout.tsx. Așa pagina se desenează
// direct pe tema cerută, fără comutare vizibilă și fără să depindem de un click.
const context = await browser.newContext();
await context.addInitScript((t) => {
  try { localStorage.setItem("autopas-tema", t); } catch (e) { /* navigare privată */ }
}, TEMA);

async function slugReal(lista, selector) {
  const p = await context.newPage();
  try {
    await p.goto(BASE + lista, { waitUntil: "networkidle", timeout: 30000 });
    return await p.$eval(selector, (a) => a.getAttribute("href"));
  } catch { return null; }
  finally { await p.close(); }
}

const slugPiesa = await slugReal("/piese", 'a[href^="/piese/"]');
const slugLegal = await slugReal("/legal/politica-de-cookies", 'a[href^="/legal/"]');

let PAGINI = [...PAGINI_FIXE];
if (slugPiesa) PAGINI.splice(2, 0, slugPiesa);
if (slugLegal && !PAGINI.includes(slugLegal)) PAGINI.push(slugLegal);
if (process.env.DOAR) PAGINI = process.env.DOAR.split(",");

/** Rulează în pagină: adună toate problemele dintr-o singură trecere. */
function masoara() {
  const d = document.documentElement;
  const ecran = d.clientWidth;

  const selectorul = (el) => {
    if (!el) return "?";
    const cls = (el.className?.toString?.() ?? "").trim().split(/\s+/).slice(0, 3).join(".");
    return el.tagName.toLowerCase() + (el.id ? `#${el.id}` : "") + (cls ? `.${cls}` : "");
  };
  const text = (el) => (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
  const vizibil = (el) => {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || +s.opacity === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  // --- 1. scroll orizontal + vinovați ---
  const orizontal = d.scrollWidth > ecran;
  const vinovati = [];
  if (orizontal) {
    for (const el of d.querySelectorAll("*")) {
      if (!vizibil(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.right > ecran + 1 || r.left < -1) {
        // păstrez doar cel mai adânc element din lanț, nu și părinții lui
        if (vinovati.some((v) => v.el.contains(el))) vinovati.splice(vinovati.findIndex((v) => v.el.contains(el)), 1);
        vinovati.push({ el, sel: selectorul(el), text: text(el), right: Math.round(r.right) });
      }
    }
  }

  // --- 2. ținte de atingere ---
  const controale = [...document.querySelectorAll("a, button, select, input, textarea, [role='button']")].filter(vizibil);
  const tinteMici = [];
  for (const el of controale) {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    // linkurile din interiorul unui paragraf sunt exceptate de WCAG 2.5.8
    const inText = el.tagName === "A" && s.display.startsWith("inline") && el.closest("p, li, td");
    if (inText) continue;
    if (r.width < 44 || r.height < 44)
      tinteMici.push({ sel: selectorul(el), text: text(el), dim: `${Math.round(r.width)}x${Math.round(r.height)}` });
  }

  // --- 3. suprapuneri între controale ---
  const suprapuneri = [];
  for (let i = 0; i < controale.length; i++) {
    for (let j = i + 1; j < controale.length; j++) {
      const a = controale[i], b = controale[j];
      if (a.contains(b) || b.contains(a)) continue;          // imbricate, nu suprapuse
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      const sx = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const sy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (sx > 1 && sy > 1) suprapuneri.push({ a: selectorul(a), b: selectorul(b), zona: `${Math.round(sx)}x${Math.round(sy)}` });
      if (suprapuneri.length > 8) break;
    }
    if (suprapuneri.length > 8) break;
  }

  // --- 4. text sub 12px ---
  const micUnice = new Map();
  for (const el of document.querySelectorAll("*")) {
    const propriu = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join("");
    if (!propriu || !vizibil(el)) continue;
    const px = parseFloat(getComputedStyle(el).fontSize);
    if (px < 12) {
      const cheie = selectorul(el) + "|" + px;
      if (!micUnice.has(cheie)) micUnice.set(cheie, { sel: selectorul(el), px: +px.toFixed(1), text: propriu.slice(0, 40) });
    }
  }

  return {
    orizontal: orizontal ? { scrollW: d.scrollWidth, ecran } : null,
    vinovati: vinovati.slice(0, 5).map(({ sel, text, right }) => ({ sel, text, right })),
    tinteMici, suprapuneri, textMic: [...micUnice.values()],
  };
}

const rezultate = [];
for (const cale of PAGINI) {
  for (const w of LATIMI) {
    const page = await context.newPage();
    await page.setViewportSize({ width: w, height: 900 });
    let r;
    try {
      await page.goto(BASE + cale, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(250);
      r = await page.evaluate(masoara);
    } catch (e) {
      r = { eroare: String(e).split("\n")[0].slice(0, 80) };
    }
    rezultate.push({ pagina: cale, latime: w, ...r });
    await page.close();
  }
  const ale = rezultate.filter((x) => x.pagina === cale);
  const semn = (n) => (n ? String(n) : "·");
  console.log(
    `${cale.padEnd(34)} scroll:${semn(ale.filter((x) => x.orizontal).length).padStart(3)}` +
    `  ținte<44:${semn(ale.reduce((s, x) => s + (x.tinteMici?.length ?? 0), 0)).padStart(4)}` +
    `  suprapuneri:${semn(ale.reduce((s, x) => s + (x.suprapuneri?.length ?? 0), 0)).padStart(4)}` +
    `  text<12px:${semn(ale.reduce((s, x) => s + (x.textMic?.length ?? 0), 0)).padStart(4)}` +
    `  erori:${semn(ale.filter((x) => x.eroare).length)}`
  );
}

await browser.close();

// ---- rezumat ----
const cu = (f) => rezultate.filter(f);
console.log("\n================ REZUMAT ================");
console.log(`temă: ${TEMA}`);
console.log(`${PAGINI.length} pagini × ${LATIMI.length} lățimi = ${rezultate.length} combinații`);
console.log(`scroll orizontal : ${cu((x) => x.orizontal).length}`);
console.log(`ținte sub 44px   : ${cu((x) => x.tinteMici?.length).length} combinații`);
console.log(`suprapuneri      : ${cu((x) => x.suprapuneri?.length).length} combinații`);
console.log(`text sub 12px    : ${cu((x) => x.textMic?.length).length} combinații`);
console.log(`erori de încărcare: ${cu((x) => x.eroare).length}`);

for (const x of cu((y) => y.orizontal)) {
  console.log(`\nSCROLL  ${x.pagina} @${x.latime}  (${x.orizontal.scrollW} > ${x.orizontal.ecran})`);
  x.vinovati.forEach((v) => console.log(`   ${v.sel}  right=${v.right}  „${v.text}"`));
}

if (process.env.JSON) {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(process.env.JSON, JSON.stringify(rezultate, null, 1));
  console.log(`\nRaport brut: ${process.env.JSON}`);
}

process.exit(cu((x) => x.orizontal || x.eroare).length ? 1 : 0);
