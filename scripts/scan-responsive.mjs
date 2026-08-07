// ============================================================
// SCANER DE AȘEZARE PE ECRAN — unealtă de diagnostic, nu cod de producție.
//
// Deschide fiecare pagină la fiecare lățime și raportează:
//   - scroll orizontal, cu elementul vinovat (selector + început de text)
//   - suprapuneri între elemente pe care se poate apăsa
//   - ținte de atingere sub 44px
//   - text sub 12px calculat
//
// Playwright NU e în package.json intenționat: ar încetini fiecare build de pe
// Vercel fără niciun folos. Se instalează local, doar când ai nevoie de el:
//
//   npm install playwright --no-save && npx playwright install chromium
//   npm run build && npm start &
//   node scripts/scan-responsive.mjs            # raport pe ecran
//   node scripts/scan-responsive.mjs --json out.json
// ============================================================
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const BAZA = process.env.BAZA ?? "http://localhost:3000";

const LATIMI = [320, 360, 375, 390, 414, 428, 480, 640, 768, 834, 1024, 1280, 1440];

// Slugurile reale se dau din afară, ca scriptul să nu presupună date din bază.
const SLUG_PIESA = process.env.SLUG_PIESA ?? "alternator-bosch-vw-golf-6-16-tdi";
const SLUG_LEGAL = process.env.SLUG_LEGAL ?? "certificat-garantie";

const PAGINI = [
  "/", "/piese", `/piese/${SLUG_PIESA}`, "/favorite", "/cos", "/checkout", "/cont",
  "/autentificare", "/cauta-dupa-masina", "/preda-masina", "/programul-rabla",
  "/despre-noi", "/contact", "/faq", "/formular-retur", `/legal/${SLUG_LEGAL}`,
  "/pagina-inexistenta-404",
  "/admin", "/admin/comenzi", "/admin/cereri", "/admin/produse", "/admin/categorii",
  "/admin/marci", "/admin/masini", "/admin/expedieri", "/admin/clienti",
  "/admin/facturi", "/admin/rapoarte", "/admin/marketing", "/admin/setari",
  "/admin/integrari",
];

// Rulează în browser, pentru fiecare pagină.
function masoara() {
  const doc = document.documentElement;
  // ATENȚIE: la emularea de telefon, window.innerWidth raportează fereastra
  // vizuală, care se lărgește ca să încapă conținutul — și atunci elementele
  // care ies din ecran par să încapă. clientWidth e lățimea reală de așezare.
  const W = doc.clientWidth;

  const selector = (el) => {
    const parti = [];
    let n = el;
    for (let i = 0; n && n.nodeType === 1 && i < 4; i++) {
      let s = n.tagName.toLowerCase();
      if (n.id) { parti.unshift(`${s}#${n.id}`); break; }
      const cls = (n.getAttribute("class") ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 3);
      if (cls.length) s += "." + cls.join(".");
      parti.unshift(s);
      n = n.parentElement;
    }
    return parti.join(" > ");
  };
  const text = (el) => (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
  const vizibil = (el) => {
    const st = getComputedStyle(el);
    if (st.display === "none" || st.visibility === "hidden" || st.opacity === "0") return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  // --- 1. scroll orizontal + elementele care depășesc ---
  const scrollOrizontal = doc.scrollWidth > doc.clientWidth;
  const depasesc = [];
  for (const el of document.querySelectorAll("body *")) {
    if (!vizibil(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > W + 1 || r.left < -1) {
      // ne interesează cel mai adânc element vinovat, nu toți părinții lui
      if (![...el.children].some((c) => c.getBoundingClientRect().right > W + 1)) {
        depasesc.push({ sel: selector(el), text: text(el), dreapta: Math.round(r.right), latime: Math.round(r.width) });
      }
    }
  }

  // --- 2. elemente interactive: suprapuneri și ținte mici ---
  const inter = [...document.querySelectorAll("a, button, select, input, textarea, summary, [role=button]")].filter(vizibil);
  const rects = inter.map((el) => ({ el, r: el.getBoundingClientRect() }));

  const suprapuneri = [];
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      // sărim peste cele imbricate unul în altul — nu e suprapunere reală
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const lat = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const inalt = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (lat > 2 && inalt > 2) {
        suprapuneri.push({ a: selector(a.el), textA: text(a.el), b: selector(b.el), textB: text(b.el),
          zona: Math.round(lat * inalt) });
      }
    }
  }

  const tinteMici = [];
  for (const { el, r } of rects) {
    // linkurile din interiorul unui paragraf sunt inline prin natura lor:
    // le numărăm separat, altfel raportul se umple de fals-pozitive
    const inlineInText = getComputedStyle(el).display.startsWith("inline") &&
      !!el.closest("p, li, dd, summary, label");
    if (r.width < 44 || r.height < 44) {
      tinteMici.push({ sel: selector(el), text: text(el),
        w: Math.round(r.width), h: Math.round(r.height), inlineInText });
    }
  }

  // --- 3. text sub 12px ---
  const textMic = [];
  for (const el of document.querySelectorAll("body *")) {
    if (!vizibil(el)) continue;
    const propriu = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!propriu) continue;
    const px = parseFloat(getComputedStyle(el).fontSize);
    if (px < 12) textMic.push({ sel: selector(el), text: text(el), px: Math.round(px * 10) / 10 });
  }

  return { scrollOrizontal, scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth,
    depasesc, suprapuneri, tinteMici, textMic };
}

const browser = await chromium.launch();
const rezultate = [];

for (const latime of LATIMI) {
  const ctx = await browser.newContext({ viewport: { width: latime, height: 800 },
    deviceScaleFactor: 1, isMobile: latime < 768, hasTouch: latime < 768 });
  const page = await ctx.newPage();
  for (const cale of PAGINI) {
    try {
      const rasp = await page.goto(BAZA + cale, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(200); // lăsăm componentele client să se așeze
      const r = await page.evaluate(masoara);
      rezultate.push({ latime, cale, status: rasp?.status() ?? 0, ...r });
    } catch (e) {
      rezultate.push({ latime, cale, eroare: String(e).slice(0, 120) });
    }
  }
  await ctx.close();
  process.stderr.write(`  ${latime}px gata\n`);
}
await browser.close();

// ---------- raport ----------
const idxJson = process.argv.indexOf("--json");
if (idxJson > -1) writeFileSync(process.argv[idxJson + 1] ?? "scan.json", JSON.stringify(rezultate, null, 2));

const n = (r, k) => (r[k] ?? []).length;
const total = {
  scroll: rezultate.filter((r) => r.scrollOrizontal).length,
  suprapuneri: rezultate.reduce((s, r) => s + n(r, "suprapuneri"), 0),
  tinte: rezultate.reduce((s, r) => s + (r.tinteMici ?? []).filter((t) => !t.inlineInText).length, 0),
  tinteInline: rezultate.reduce((s, r) => s + (r.tinteMici ?? []).filter((t) => t.inlineInText).length, 0),
  textMic: rezultate.reduce((s, r) => s + n(r, "textMic"), 0),
  erori: rezultate.filter((r) => r.eroare).length,
};
console.log("\n=== TOTAL ===");
console.log(total);

console.log("\n=== SCROLL ORIZONTAL: pagină × lățime ===");
for (const r of rezultate.filter((x) => x.scrollOrizontal)) {
  console.log(`${String(r.latime).padStart(4)}px  ${r.cale}   (${r.clientWidth} -> ${r.scrollWidth})`);
  for (const d of r.depasesc.slice(0, 3)) console.log(`        ${d.sel}  „${d.text}”  dreapta=${d.dreapta}`);
}

console.log("\n=== SUPRAPUNERI (elemente pe care se poate apăsa) ===");
const supr = new Map();
for (const r of rezultate) for (const s of r.suprapuneri ?? []) {
  const k = `${r.cale} | ${s.a} × ${s.b}`;
  if (!supr.has(k)) supr.set(k, { ...s, cale: r.cale, latimi: [] });
  supr.get(k).latimi.push(r.latime);
}
for (const [k, v] of supr) console.log(`${v.cale}  la ${v.latimi.join(",")}px\n    „${v.textA}” × „${v.textB}”  (${v.zona}px²)`);
if (!supr.size) console.log("  niciuna");

console.log("\n=== ȚINTE SUB 44px (fără linkurile inline din text) ===");
const tin = new Map();
for (const r of rezultate) for (const t of (r.tinteMici ?? []).filter((x) => !x.inlineInText)) {
  const k = `${r.cale} | ${t.sel}`;
  if (!tin.has(k)) tin.set(k, { ...t, cale: r.cale, latimi: [] });
  tin.get(k).latimi.push(r.latime);
}
for (const [, v] of [...tin].slice(0, 40)) console.log(`${v.cale}  ${v.w}×${v.h}  „${v.text}”  la ${v.latimi.length} lățimi\n    ${v.sel}`);
console.log(`  ... ${tin.size} tipuri distincte`);

console.log("\n=== TEXT SUB 12px ===");
const txt = new Map();
for (const r of rezultate) for (const t of r.textMic ?? []) {
  const k = `${t.px}px | ${t.sel}`;
  if (!txt.has(k)) txt.set(k, { ...t, cai: new Set() });
  txt.get(k).cai.add(r.cale);
}
for (const [, v] of [...txt].slice(0, 30)) console.log(`${v.px}px  „${v.text}”  (${v.cai.size} pagini)\n    ${v.sel}`);
console.log(`  ... ${txt.size} tipuri distincte`);

console.log("\n=== ERORI DE ÎNCĂRCARE ===");
for (const r of rezultate.filter((x) => x.eroare)) console.log(`${r.latime}px ${r.cale}: ${r.eroare}`);
