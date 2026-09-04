// ============================================================
// VERIFICAREA FEED-URILOR DE PRODUSE — Google Merchant Center și Meta
//
// DE CE EXISTĂ
// Un feed greșit nu dă niciun semn din interiorul site-ului: paginile arată
// perfect, iar defectul se vede abia peste 24–48 de ore, în contul Merchant
// Center, sub forma „8.803 produse respinse". Între timp campaniile stau, iar un
// cont cu prea multe respingeri poate fi suspendat.
//
// Verificarea se face pe FIȘIERUL SERVIT, cerut de la un server care rulează —
// nu pe funcțiile care îl compun. Un formator poate fi corect și fișierul tot
// stricat, dacă se schimbă altceva pe drum (antete, cache, o rută).
//
// CE VERIFICĂ
//   · antetele: tipul conținutului și `X-Robots-Tag: noindex`
//   · fiecare produs: id ≤ 50 și unic, titlu 1–150, descriere 1–5.000,
//     link absolut pe domeniul public, imagine absolută, preț „123.45 RON",
//     disponibilitate și stare din listele închise ale Google
//   · lipsa caracterelor de control, care fac XML-ul invalid în întregime
//   · CSV-ul Meta: antetul așteptat și același număr de coloane pe fiecare rând
//   · ⚠ CEA MAI IMPORTANTĂ: id-urile din feed-ul Google și cele din catalogul
//     Meta sunt IDENTICE. Dacă se despart, reclamele dinamice arată altă piesă
//     decât cea privită de om, iar nimic din interfețele celor două platforme
//     nu spune de ce.
//
// CUM SE RULEAZĂ (serverul trebuie să meargă separat)
//   npm run build && npx next start -p 3000
//   node scripts/verifica-feed.mjs
//
//   BASE=http://localhost:3112       altă adresă
//   FEED_TOKEN=secret                dacă feed-urile sunt protejate
//
// Iese cu cod 1 dacă vreo verificare pică.
// ============================================================
const BASE = (process.env.BASE ?? "http://localhost:3000").replace(/\/+$/, "");
const TOKEN = process.env.FEED_TOKEN ?? "";
const q = TOKEN ? `?token=${encodeURIComponent(TOKEN)}` : "";

// Limitele Google. Meta le are mai largi, deci ce trece de Google trece peste tot.
const MAX_ID = 50;
const MAX_TITLU = 150;
const MAX_DESCRIERE = 5000;
const DISPONIBILITATE = ["in_stock", "out_of_stock", "preorder", "backorder"];
const STARE = ["new", "refurbished", "used"];
const PRET = /^\d+\.\d{2} [A-Z]{3}$/;

let treceri = 0, picate = 0;
const cer = (ce, conditie, detaliu = "") => {
  if (conditie) { treceri++; return true; }
  picate++;
  console.log(`  ✗ ${ce}${detaliu ? ` — ${detaliu}` : ""}`);
  return false;
};

/** Prima potrivire dintr-un text, sau șir gol. */
const intre = (t, re) => (t.match(re)?.[1] ?? "").trim();

/** Textul dintr-o etichetă XML, cu entitățile întoarse la loc. Verificăm
 *  lungimi și forme pe conținutul REAL, nu pe cel scăpat: „&amp;" e un singur
 *  caracter pentru Google, nu cinci. */
function dinXml(t) {
  return t.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"')
          .replaceAll("&apos;", "'").replaceAll("&amp;", "&");
}

async function ia(cale) {
  const r = await fetch(`${BASE}${cale}${q}`);
  const text = await r.text();
  return { r, text };
}

console.log(`=== Verific feed-urile de pe ${BASE} ===\n`);

// ============================================================
// 1. GOOGLE MERCHANT CENTER
// ============================================================
console.log("--- /feed/google.xml ---");
const g = await ia("/feed/google.xml");
cer("răspunde 200", g.r.status === 200, `status ${g.r.status}`);
cer("tip XML", (g.r.headers.get("content-type") ?? "").includes("xml"),
    g.r.headers.get("content-type") ?? "lipsă");
// Feed-ul trebuie să poată fi CITIT de Google (deci robots.txt nu-l blochează),
// dar să nu ajungă în rezultatele căutării. Cele două se rezolvă diferit.
cer("X-Robots-Tag: noindex", (g.r.headers.get("x-robots-tag") ?? "").includes("noindex"),
    g.r.headers.get("x-robots-tag") ?? "lipsă");

const iteme = g.text.split("<item>").slice(1).map((b) => b.split("</item>")[0]);
cer("are produse", iteme.length > 0, `${iteme.length}`);
console.log(`  · ${iteme.length} produse, ${(g.text.length / 1048576).toFixed(1)} MB`);

// Caracterele de control fac fișierul invalid ÎN ÎNTREGIME, nu doar rândul.
let control = 0;
for (let i = 0; i < g.text.length; i++) {
  const c = g.text.charCodeAt(i);
  if (c < 32 && c !== 9 && c !== 10 && c !== 13) control++;
}
cer("fără caractere de control", control === 0, `${control} caractere`);

const idGoogle = new Set();
const probleme = new Map();   // tipul problemei -> câte produse, plus un exemplu
const nota = (tip, exemplu) => {
  const p = probleme.get(tip) ?? { n: 0, exemplu };
  p.n++; probleme.set(tip, p);
};

for (const it of iteme) {
  const id = dinXml(intre(it, /<g:id>([\s\S]*?)<\/g:id>/));
  const titlu = dinXml(intre(it, /<title>([\s\S]*?)<\/title>/));
  const descriere = dinXml(intre(it, /<description>([\s\S]*?)<\/description>/));
  const link = dinXml(intre(it, /<link>([\s\S]*?)<\/link>/));
  const poza = dinXml(intre(it, /<g:image_link>([\s\S]*?)<\/g:image_link>/));
  const pret = dinXml(intre(it, /<g:price>([\s\S]*?)<\/g:price>/));
  const disp = intre(it, /<g:availability>([\s\S]*?)<\/g:availability>/);
  const stare = intre(it, /<g:condition>([\s\S]*?)<\/g:condition>/);
  const marca = dinXml(intre(it, /<g:brand>([\s\S]*?)<\/g:brand>/));
  const mpn = intre(it, /<g:mpn>([\s\S]*?)<\/g:mpn>/);
  const faraIdent = it.includes("<g:identifier_exists>no</g:identifier_exists>");

  if (!id || id.length > MAX_ID) nota("id lipsă sau peste 50 de caractere", id);
  if (idGoogle.has(id)) nota("id repetat", id);
  idGoogle.add(id);
  if (!titlu || titlu.length > MAX_TITLU) nota(`titlu gol sau peste ${MAX_TITLU}`, `${id}: ${titlu.length}`);
  if (!descriere || descriere.length > MAX_DESCRIERE) nota(`descriere goală sau peste ${MAX_DESCRIERE}`, `${id}: ${descriere.length}`);
  if (!/^https?:\/\//.test(link)) nota("link care nu e absolut", `${id}: ${link}`);
  if (!/^https:\/\//.test(poza)) nota("imagine care nu e pe https", `${id}: ${poza}`);
  if (!PRET.test(pret)) nota("preț în alt format decât 123.45 RON", `${id}: ${pret}`);
  if (!DISPONIBILITATE.includes(disp)) nota("disponibilitate necunoscută", `${id}: ${disp}`);
  if (!STARE.includes(stare)) nota("stare necunoscută", `${id}: ${stare}`);
  // Fără GTIN și fără MPN, Google cere `identifier_exists: no`. Altfel caută un
  // identificator inexistent și respinge produsul.
  if (!mpn && !faraIdent) nota("fără MPN și fără identifier_exists=no", id);
  if (!marca && !faraIdent) nota("fără marcă și fără identifier_exists=no", id);
}

for (const [tip, p] of probleme)
  cer(`Google — ${tip}`, false, `${p.n} produse (ex.: ${p.exemplu})`);
if (probleme.size === 0) { treceri++; console.log("  ✓ toate produsele trec regulile Google"); }

// Linkul trebuie să ducă pe domeniul public, nu pe localhost sau pe adresa
// temporară de Vercel: Merchant Center respinge produsele al căror link nu e pe
// domeniul revendicat. E o AVERTIZARE, nu o picare — local e normal să fie așa.
const primulLink = dinXml(intre(iteme[0] ?? "", /<link>([\s\S]*?)<\/link>/));
if (/localhost|127\.0\.0\.1|\.vercel\.app/.test(primulLink))
  console.log(`  ⚠ linkurile duc spre ${primulLink.split("/piese")[0]} — pe producție trebuie NEXT_PUBLIC_SITE_URL`);

// ============================================================
// 2. META (FACEBOOK + INSTAGRAM)
// ============================================================
console.log("\n--- /feed/meta.csv ---");
const m = await ia("/feed/meta.csv");
cer("răspunde 200", m.r.status === 200, `status ${m.r.status}`);
cer("tip CSV", (m.r.headers.get("content-type") ?? "").includes("csv"),
    m.r.headers.get("content-type") ?? "lipsă");
cer("X-Robots-Tag: noindex", (m.r.headers.get("x-robots-tag") ?? "").includes("noindex"));

// Un parser de CSV mic, dar corect: fără el, o descriere care conține „,” ar
// părea o coloană în plus, iar verificarea numărului de coloane ar da alarme
// false pe jumătate din catalog.
function randuriCsv(text) {
  const out = [];
  let camp = "", rand = [], inGhilimele = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inGhilimele) {
      if (c === '"') { if (text[i + 1] === '"') { camp += '"'; i++; } else inGhilimele = false; }
      else camp += c;
    } else if (c === '"') inGhilimele = true;
    else if (c === ",") { rand.push(camp); camp = ""; }
    else if (c === "\n") { rand.push(camp); out.push(rand); rand = []; camp = ""; }
    else if (c !== "\r") camp += c;
  }
  if (camp || rand.length) { rand.push(camp); out.push(rand); }
  return out;
}

const randuri = randuriCsv(m.text);
const capuri = randuri[0] ?? [];
// Fără BOM: unele importatoare îl citesc ca parte din numele primei coloane.
cer("fără BOM la început", !m.text.startsWith(String.fromCharCode(0xfeff)));
for (const obligatoriu of ["id", "title", "description", "availability", "condition", "price", "link", "image_link"])
  cer(`Meta — are coloana „${obligatoriu}"`, capuri.includes(obligatoriu));

const corp = randuri.slice(1).filter((r) => r.length > 1);
console.log(`  · ${corp.length} produse`);
const stramb = corp.filter((r) => r.length !== capuri.length);
cer("Meta — toate rândurile au același număr de coloane", stramb.length === 0,
    `${stramb.length} rânduri strâmbe`);

const iId = capuri.indexOf("id");
const idMeta = new Set(corp.map((r) => r[iId]));
cer("Meta — id-uri unice", idMeta.size === corp.length, `${corp.length - idMeta.size} repetate`);

// ============================================================
// 3. POTRIVIREA DINTRE CELE DOUĂ — verificarea pentru care există scriptul
// ============================================================
console.log("\n--- potrivirea Google ↔ Meta ---");
const doarLaGoogle = [...idGoogle].filter((x) => !idMeta.has(x));
const doarLaMeta = [...idMeta].filter((x) => !idGoogle.has(x));
cer("aceleași produse în ambele feed-uri",
    doarLaGoogle.length === 0 && doarLaMeta.length === 0,
    `${doarLaGoogle.length} doar la Google, ${doarLaMeta.length} doar la Meta`);

// ============================================================
// 4. FEED-URILE GENERICE — doar că răspund și că nu sunt goale
// ============================================================
console.log("\n--- /feed/produse.csv și /feed/produse.xml ---");
for (const [cale, semn] of [["/feed/produse.csv", "cod"], ["/feed/produse.xml", "<produs>"]]) {
  const x = await ia(cale);
  cer(`${cale} — răspunde 200`, x.r.status === 200, `status ${x.r.status}`);
  cer(`${cale} — are conținut`, x.text.includes(semn), `${x.text.length} octeți`);
}

console.log(`\n=== ${treceri} verificări trec · ${picate} pică ===`);
process.exit(picate ? 1 : 0);
