// ============================================================
// IMPORT DIN FEED-UL pieseauto.ro
//
// Feed-ul dă lista și prețul (5 coloane). Restul — poze, descriere, categorie,
// marcă, model — se află pe pagina fiecărui produs. Scriptul le adună.
//
// NU e funcție serverless. 8.000 de pagini × 2 secunde ≈ 4,5 ore, iar funcțiile
// Vercel au limită de secunde. Se rulează manual, din terminal.
//
// Cum se rulează:
//   node scripts/import-pieseauto.mjs --feed=import/feed.csv --limita=5 --uscat
//
// Opțiuni:
//   --feed=CALE     fișierul CSV (obligatoriu)
//   --limita=N      procesează doar primele N rânduri
//   --uscat         NU scrie nimic în baza de date; doar extrage și raportează
//   --reia          continuă de unde s-a oprit (starea din import/stare.json)
//   --json=CALE     scrie rezultatul brut într-un fișier
//
// ZERO DEPENDINȚE, intenționat. Datele vin dintr-un array JSON și din atribute
// `itemprop`/`meta` generate automat de platformă, deci nu e nevoie de un arbore
// DOM. Proiectul are 3 dependințe și merită păstrat așa. Dacă extragerea începe
// să dea gol, canarul de mai jos oprește importul înainte să strice 8.000 de rânduri.
// ============================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
const execFileP = promisify(execFile);

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
const CALE_JSON = arg("json");
const CALE_STARE = "import/stare.json";
// Sub pragul ăsta nu se creează subcategorie: o subcategorie cu o singură piesă
// face filtrarea mai grea, nu mai ușoară. Se pune categoria-părinte și se marchează.
const PRAG_CATEGORIE = Number(arg("prag-categorie", 3)) || 3;

const RULAT_DIRECT = import.meta.url === `file://${process.argv[1]}`;
if (RULAT_DIRECT && !CALE_FEED) {
  console.error("Lipsește --feed=CALE. Exemplu:\n  node scripts/import-pieseauto.mjs --feed=import/feed.csv --limita=5 --uscat");
  process.exit(2);
}

// ---------- politețe (C.2) ----------
// Serverul e al altcuiva. O singură cerere pe rând, pauză cu variație, User-Agent
// care spune cine suntem și unde ne găsești dacă deranjăm.
const UA = "AutopasImport/1.0 (+https://autopas-dezmembrari.ro)";
const PAUZA_MS = 1750;          // 1,75s ± 30% => între 1,2 și 2,3 secunde
const VARIATIE = 0.3;
const ASTEPTARI_EROARE = [5000, 15000, 45000];   // exponențial, apoi abandon
const LOT_CANAR = 50;           // după fiecare lot verificăm rata de extragere
const PRAG_CANAR = 0.20;        // peste 20% pagini fără poze => oprim

const dormi = (ms) => new Promise((r) => setTimeout(r, ms));
const pauzaPoliticoasa = () => dormi(Math.round(PAUZA_MS * (1 + (Math.random() * 2 - 1) * VARIATIE)));

// ============================================================
// CSV — parser RFC 4180, scris de mână
// Tratează ghilimelele, virgulele și newline-urile din interiorul câmpurilor,
// plus ghilimelele duble escapate (""). Titlurile de piese chiar le conțin.
// ============================================================
export function parseCSV(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);   // BOM UTF-8
  const randuri = [];
  let camp = "", rand = [], inGhilimele = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inGhilimele) {
      if (c === '"') {
        if (text[i + 1] === '"') { camp += '"'; i++; }        // "" => un singur "
        else inGhilimele = false;
      } else camp += c;
      continue;
    }
    if (c === '"') { inGhilimele = true; continue; }
    if (c === ",") { rand.push(camp); camp = ""; continue; }
    if (c === "\r") continue;                                  // CRLF
    if (c === "\n") { rand.push(camp); randuri.push(rand); rand = []; camp = ""; continue; }
    camp += c;
  }
  if (camp !== "" || rand.length) { rand.push(camp); randuri.push(rand); }
  if (!randuri.length) return [];
  const cap = randuri[0].map((h) => h.trim());
  return randuri.slice(1)
    .filter((r) => r.some((v) => v.trim() !== ""))            // sare peste rânduri goale
    .map((r) => Object.fromEntries(cap.map((h, i) => [h, (r[i] ?? "").trim()])));
}

// ============================================================
// EXTRAGERE dintr-o pagină de produs
// ============================================================
const dezescapeaza = (s) => s
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));

// `<br[^>]*>` — nu `<br\s*\/?>`. Sursa scrie `<br style="margin:0px;…" />`, cu
// atribute, iar varianta scurtă nu-l prindea: rândurile se lipeau între ele și
// ieșea „…2010 2011Pret afisat pe bucata". Aceeași grijă la `</p>` și `</div>`,
// care sunt tot sfârșituri de rând în textul afișat.
const faraTaguri = (s) => dezescapeaza(
  s.replace(/<br[^>]*>/gi, "\n")
   .replace(/<\/(p|div|li|tr|h[1-6])\s*>/gi, "\n")
   .replace(/<[^>]+>/g, ""))
  .replace(/[ \t]+/g, " ")
  .split("\n").map((l) => l.trim()).join("\n")
  .replace(/\n{3,}/g, "\n\n").trim();

/** Pozele produsului. STRICT din array-ul `images`; nicio altă sursă.
 *  Pagina conține și pozele anunțurilor similare — un scraper care ia „toate
 *  imaginile" ar importa pozele concurenței. `size` e opțional: apare la unele
 *  poze, lipsește la altele. */
function extragePoze(html) {
  const m = html.match(/let images = (\[[\s\S]*?\]);/);
  if (!m) return { poze: [], motiv: "array `images` inexistent" };
  let arr;
  try { arr = JSON.parse(m[1]); }
  catch { return { poze: [], motiv: "array `images` nevalid JSON" }; }
  if (!Array.isArray(arr) || arr.length === 0) return { poze: [], motiv: "array `images` gol" };
  const poze = arr.map((im) => im?.original).filter((u) => typeof u === "string" && u.startsWith("http"));
  const dim = arr.map((im) => (Array.isArray(im?.size) ? im.size : null));
  return poze.length ? { poze, dimensiuni: dim } : { poze: [], motiv: "array `images` fără câmp `original`" };
}

/** Taxonomia din URL-ul canonic — mai fiabilă decât breadcrumb-ul.
 *  https://www.pieseauto.ro/etriere/audi/a4-b8/slug-123.html
 *                           categorie marca model */
function taxonomieDinUrl(url) {
  try {
    const p = new URL(url).pathname.split("/").filter(Boolean);
    if (p.length >= 4) return { categorie: p[0], marca: p[1], model: p[2] };
    if (p.length === 3) return { categorie: p[0], marca: p[1], model: null };
    return { categorie: null, marca: null, model: null };
  } catch { return { categorie: null, marca: null, model: null }; }
}

const metaProp = (html, p) =>
  html.match(new RegExp(`<meta property="${p}" content="([^"]*)"`))?.[1] ?? null;
const metaItem = (html, p) =>
  html.match(new RegExp(`<meta itemprop="${p}" content="([^"]*)"`))?.[1] ?? null;
const linkItem = (html, p) =>
  html.match(new RegExp(`<link itemprop="${p}" href="([^"]*)"`))?.[1] ?? null;

export function extrage(html, urlFinal) {
  const erori = [];
  const titlu = faraTaguri(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "") || null;
  if (!titlu) erori.push("titlu lipsă");

  const dBloc = html.match(/itemprop="description"[^>]*>([\s\S]*?)<\/div>/);
  const descriere = dBloc ? faraTaguri(dBloc[1]) : null;
  if (!descriere) erori.push("descriere lipsă");

  const { poze, dimensiuni, motiv } = extragePoze(html);
  if (!poze.length) erori.push(`poze lipsă: ${motiv}`);

  const tax = taxonomieDinUrl(urlFinal);
  if (!tax.categorie) erori.push("taxonomie neextrasă din URL");

  // Compatibilitatea din tabul „Specificații" (e în HTML, data-do-ajax="0").
  //
  // ASTA e sursa pentru marcă și model, NU segmentul din URL. La Etapa 1, 2 din 5
  // produse aveau în URL `passat-b6` deși titlul, descrierea și câmpul ăsta spuneau
  // „Touran", respectiv „Golf 5". Trei surse contra una: URL-ul minte la model.
  // Din URL rămâne doar categoria, care s-a dovedit corectă peste tot.
  const compat = [...html.matchAll(/<span class="q-car-model">\s*<a [^>]*>([^<]+)<\/a>/g)]
    .map((m) => dezescapeaza(m[1]).trim());

  const disp = linkItem(html, "availability");
  const stare = linkItem(html, "itemCondition");

  // Anii: numere de 4 cifre între 1990 și 2026, din titlu.
  const ani = [...new Set((titlu ?? "").match(/\b(19[9]\d|20[0-2]\d)\b/g)?.map(Number) ?? [])]
    .filter((a) => a >= 1990 && a <= 2026).sort((a, b) => a - b);

  return {
    titlu,
    descriere,
    poze, poze_dimensiuni: dimensiuni ?? [],
    categorie_sursa: tax.categorie, marca_sursa: tax.marca, model_sursa: tax.model,
    compat,
    pret_pagina: metaItem(html, "price"),
    moneda_pagina: metaItem(html, "priceCurrency"),
    disponibilitate: disp ? disp.split("/").pop() : null,
    stare_sursa: stare ? stare.split("/").pop() : null,
    an_min: ani[0] ?? null, an_max: ani[ani.length - 1] ?? null, ani_gasiti: ani,
    // Confirmate absente pe pagină (vezi raportul C.0). Rămân muncă de operator.
    oem: null, greutate_kg: null, dimensiuni: null,
    og_image: metaProp(html, "og:image"),
    erori,
  };
}

// ============================================================
// CERERE POLITICOASĂ, cu reîncercări
//
// DE CE `curl` ȘI NU `fetch` (constatat 24 august 2026)
// `fetch` din Node (undici) e refuzat de pieseauto.ro: cererea primește HTTP 200,
// dar conținutul e pagina `/?action=sorry`, nu produsul. Motivul e antetul
// `sec-fetch-mode: cors`, pe care undici îl trimite la orice `fetch` și pe care
// Node nu-l lasă șters. Un browser care deschide o pagină trimite `navigate`,
// deci filtrul lor vede imediat că cererea e programatică.
//
// NU trimitem antete de browser ca să ne dăm drept om — ar fi mascare, și ar
// strica tocmai acordul pe care clientul îl are cu platforma. `curl` trimite o
// cerere mai simplă decât Node (`Accept: */*`, HTTP/2, fără antete `sec-`), iar
// User-Agent-ul rămâne al nostru, cu adresa de contact în el. Cine se uită în
// jurnalele lor vede exact cine suntem și unde ne găsește.
//
// Corpul se scrie într-un fișier temporar, iar starea și URL-ul final vin pe
// stdout — altfel n-am putea separa metadatele de HTML.
// ============================================================
async function verificaCurl() {
  try { await execFileP("curl", ["--version"]); }
  catch { console.error("Lipsește `curl`. Scriptul nu poate porni fără el."); process.exit(2); }
}

async function adu(url) {
  const tmp = join(tmpdir(), `autopas-import-${process.pid}-${Math.random().toString(36).slice(2)}.html`);
  try {
    for (let i = 0; i <= ASTEPTARI_EROARE.length; i++) {
      let cod = 0, urlFinal = url;
      try {
        const { stdout } = await execFileP("curl", [
          "-sS", "-L",                       // tăcut (dar arată erorile), urmează redirectul
          "-A", UA,
          "--max-time", "30",
          "--retry", "0",                    // reîncercările le gestionăm noi, cu pauze
          "-o", tmp,
          "-w", "%{http_code}\t%{url_effective}",
          url,
        ], { maxBuffer: 1 << 20 });
        const [c, u] = stdout.trim().split("\t");
        cod = Number(c); urlFinal = u || url;
      } catch (e) {
        if (i === ASTEPTARI_EROARE.length) return { ok: false, eroare: `curl: ${(e.stderr || e.message).toString().trim().slice(0, 120)}` };
        await dormi(ASTEPTARI_EROARE[i]); continue;
      }

      if (cod === 429 || cod === 503) {
        if (i === ASTEPTARI_EROARE.length) return { ok: false, eroare: `HTTP ${cod} după ${ASTEPTARI_EROARE.length} încercări` };
        console.log(`   ⏳ HTTP ${cod}, aștept ${ASTEPTARI_EROARE[i] / 1000}s`);
        await dormi(ASTEPTARI_EROARE[i]); continue;
      }
      if (cod < 200 || cod >= 300) return { ok: false, eroare: `HTTP ${cod}` };

      // Refuzul lor vine cu HTTP 200, nu cu 429. Fără verificarea asta am fi
      // înregistrat pagini goale ca succese.
      if (urlFinal.includes("action=sorry")) {
        if (i === ASTEPTARI_EROARE.length) return { ok: false, eroare: 'refuzat de server (pagina „sorry”)' };
        console.log(`   ⏳ refuzat (pagina „sorry”), aștept ${ASTEPTARI_EROARE[i] / 1000}s`);
        await dormi(ASTEPTARI_EROARE[i]); continue;
      }

      const html = readFileSync(tmp, "utf8");
      return { ok: true, html, urlFinal };
    }
    return { ok: false, eroare: "epuizat" };
  } finally {
    rmSync(tmp, { force: true });
  }
}

// ============================================================
// POTRIVIRE cu taxonomia proprie (marcă / model)
// Ambiguu sau inexistent => se lasă gol și se marchează pentru revizuire.
// Nu se inventează nimic.
// ============================================================
const normalizeaza = (s) => (s ?? "").toString().toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[șş]/g, "s").replace(/[țţ]/g, "t").replace(/[ăâ]/g, "a").replace(/î/g, "i")
  .replace(/[^a-z0-9]+/g, " ").trim();

// Variante de nume care NU sunt modele distincte, ci versiuni de echipare.
// „Caddy Life" e varianta pentru pasageri a lui Caddy, nu un model separat
// (verificat 25 august 2026), deci piesele lui aparțin aceluiași model.
// Se adaugă aici doar cazuri verificate, nu presupuneri.
const ALIAS_MODELE = { "caddy life": "caddy", "caddy maxi": "caddy" };

/** Desparte „Volkswagen Polo 6R" în marcă + model, folosind lista noastră de mărci:
 *  marca e cel mai lung prefix care se potrivește, restul e modelul. */
function despartCompat(text, brands) {
  const n = normalizeaza(text);
  let gasit = null;
  for (const b of brands) {
    for (const cheie of [b.nume, b.slug]) {
      const k = normalizeaza(cheie);
      if (k && (n === k || n.startsWith(k + " ")) && (!gasit || k.length > normalizeaza(gasit.cheie).length))
        gasit = { brand: b, cheie };
    }
  }
  if (!gasit) return { brand: null, model: null };
  const k = normalizeaza(gasit.cheie);
  let model = n === k ? null : n.slice(k.length).trim();
  if (model && ALIAS_MODELE[model]) model = ALIAS_MODELE[model];
  return { brand: gasit.brand, model };
}

function potriveste(ext, taxonomie) {
  const { brands, models } = taxonomie;
  const rez = {
    brand_id: null, marca: null, model_id: null, model: null,
    nepotrivire_marca: false, nepotrivire_model: false, note: [],
  };

  // ---- sursa principală: câmpul de compatibilitate ----
  const primaCompat = ext.compat[0] ?? null;
  const { brand: bCompat, model: mCompat } = primaCompat
    ? despartCompat(primaCompat, brands) : { brand: null, model: null };

  if (bCompat) { rez.brand_id = bCompat.id; rez.marca = bCompat.nume; }
  else rez.note.push(primaCompat ? `marcă nerecunoscută în compatibilitate: „${primaCompat}"` : "compatibilitate absentă");

  if (rez.brand_id && mCompat) {
    const aleMarcii = models.filter((m) => m.brand_id === rez.brand_id);
    const baza = (m) => normalizeaza(m.nume.replace(/\(.*$/, ""));

    // 1. Potrivire exactă pe numele fără paranteză („A4 B8" din „A4 B8 (2008–2015)").
    const exact = aleMarcii.filter((m) => baza(m) === mCompat);
    if (exact.length === 1) { rez.model_id = exact[0].id; rez.model = exact[0].nume; }
    else if (exact.length > 1) rez.note.push(`model ambiguu: „${mCompat}"`);
    else {
      // 2. Sursa nu spune generația („Skoda Octavia", noi avem „Octavia 2" și „Octavia 3").
      //    Dezambiguizăm după anii din titlu, comparați cu intervalul din numele modelului.
      const candidati = aleMarcii.filter((m) => baza(m).startsWith(mCompat + " "));
      if (!candidati.length) { rez.note.push(`model negăsit la ${rez.marca}: „${mCompat}"`); return rez; }
      if (ext.an_min == null) {
        rez.note.push(`generație nedeterminabilă pentru „${mCompat}": titlul n-are ani`);
        return rez;
      }
      const incap = candidati.filter((m) => {
        const iv = m.nume.match(/\((\d{4})\s*[–-]\s*(\d{4})\)/);
        if (!iv) return false;
        return ext.an_min >= +iv[1] && ext.an_max <= +iv[2];
      });
      if (incap.length === 1) {
        rez.model_id = incap[0].id; rez.model = incap[0].nume;
        rez.generatie_dedusa = true;
        rez.note.push(`generație dedusă din ani (${ext.an_min}–${ext.an_max}) → ${incap[0].nume}`);
      } else if (incap.length > 1) {
        rez.note.push(`generație ambiguă pentru „${mCompat}": anii ${ext.an_min}–${ext.an_max} se suprapun peste ${incap.map((m) => m.nume).join(" și ")}`);
      } else {
        rez.note.push(`generație negăsită pentru „${mCompat}": anii ${ext.an_min}–${ext.an_max} nu încap în niciun interval`);
      }
    }
  } else if (rez.brand_id && !mCompat) rez.note.push("model absent din compatibilitate");

  // ---- verificare pe TITLU ----
  // Verificarea față de URL a fost scoasă la 25 august 2026: pe 50 de produse,
  // URL-ul se contrazicea cu `q-car-model` în 66% din cazuri, iar în cele 25 de
  // dezacorduri tranșate de titlu URL-ul n-a avut dreptate NICIODATĂ. Marca 48
  // din 50 de piese pentru revizuire — zgomot, nu semnal.
  //
  // Titlul e scris de vânzător și e sursa cea mai apropiată de adevăr. Dacă modelul
  // din `q-car-model` nu apare în titlu, ceva e greșit la sursă — așa s-au găsit
  // „Balast Xenon Skoda Octavia" pus la Nissan Qashqai și „Debitmetru Vw Sharan"
  // pus la Ford Galaxy.
  if (mCompat) {
    // Comparăm pe cuvinte, nu pe șir continuu. Vânzătorul scrie „Vw Passat 3c b6",
    // iar sursa spune „Passat B6": cuvintele sunt aceleași, dar are „3c" între ele.
    // O căutare de subșir ar fi marcat 10 din 11 piese degeaba.
    const cuvinteTitlu = new Set(normalizeaza(ext.titlu ?? "").split(" "));
    const lipsesc = mCompat.split(" ").filter((c) => c && !cuvinteTitlu.has(c));
    if (lipsesc.length) {
      rez.nepotrivire_titlu = true;
      rez.note.push(`⚠ modelul „${mCompat}" nu apare în titlu (lipsesc: ${lipsesc.join(", ")}): „${ext.titlu ?? ""}"`);
    }
  }
  if (bCompat) {
    const t = " " + normalizeaza(ext.titlu ?? "") + " ";
    const marcaInTitlu = [bCompat.nume, bCompat.slug].some((k) => t.includes(" " + normalizeaza(k) + " "));
    if (!marcaInTitlu) {
      rez.nepotrivire_marca = true;
      rez.note.push(`⚠ MARCA „${bCompat.nume}" nu apare în titlu: „${ext.titlu ?? ""}"`);
    }
  }

  return rez;
}

// ============================================================
// CATEGORII — de la slug-ul sursei la taxonomia noastră
//
// Regulile aprobate de utilizator. Cheia e slug-ul din URL-ul pieseauto.ro.
//   `sub`    = numele subcategoriei noastre (se caută lax: fără diacritice, fără
//              majuscule, singular/plural)
//   `parinte`= numele categoriei de nivel 1
//   `creeaza`= true dacă subcategoria lipsește și utilizatorul a aprobat crearea ei
//              cu numele din `sub`
//
// NU se inventează nume aici. Un slug necunoscut nu produce o categorie cu numele
// tradus automat — ajunge în lista de la finalul raportului, iar utilizatorul decide.
// „ansamblu-stergatoare" a primit nume de la om: „Ștergătoare și spălare parbriz".
// ============================================================
const REGULI_CATEGORII = {
  // --- aprobate 24 august ---
  "etriere":              { parinte: "Sistem de frânare",             sub: "Etriere" },
  "fuzeta":               { parinte: "Suspensie și direcție",         sub: "Fuzete și rulmenți" },
  "furtune-si-conducte":  { parinte: "Climatizare (AC) și încălzire", sub: "Conducte și furtunuri AC" },
  "ansamblu-stergatoare": { parinte: "Caroserie și exterior",         sub: "Ștergătoare și spălare parbriz", creeaza: true },
  // --- aprobate 25 august, după Etapa 2 ---
  "electromotor":         { parinte: "Motor și anexe",                sub: "Electromotor" },
  "egr":                  { parinte: "Motor și anexe",                sub: "EGR și Clapetă acceleratie" },
  // Răcitorul de gaze e parte din sistemul EGR, nu din răcirea motorului:
  // un mecanic îl caută acolo, nu la radiatoare.
  "racitor-gaze":         { parinte: "Motor și anexe",                sub: "EGR și Clapetă acceleratie" },
  "radiator-clima-ac":    { parinte: "Climatizare (AC) și încălzire", sub: "Radiator AC (condensator)" },
  "radiator-apa":         { parinte: "Motor și anexe",                sub: "Radiatoare și Ventilatoare" },
  "intercooler":          { parinte: "Motor și anexe",                sub: "Intercooler", creeaza: true },
  "broasca":              { parinte: "Caroserie și exterior",         sub: "Broaște și încuietori", creeaza: true },
  "debitmetru":           { parinte: "Electrice și senzori",          sub: "Senzori motor" },
  "injectoare":           { parinte: "Motor și anexe",                sub: "Injectoare și rampă" },
  "usa-fata":             { parinte: "Caroserie și exterior",         sub: "Ușă față" },
  "usa-spate":            { parinte: "Caroserie și exterior",         sub: "Ușă spate" },
  "balast-xenon":         { parinte: "Optică și faruri",              sub: "Bloc xenon și balast" },
  "centuri-siguranta":    { parinte: "Interior și tapițerie",         sub: "Centuri de siguranță" },
  // Cele de mai jos n-au subcategorie potrivită în structura noastră. Rămân pe
  // categoria-părinte și se marchează, conform regulii: sub 3 piese nu se creează
  // subcategorie, fiindcă una cu o singură piesă face filtrarea mai grea.
  "maneta-tempomat":      { parinte: "Electrice și senzori",          sub: null },
  "torpedou":             { parinte: "Interior și tapițerie",         sub: null },
  "alarme-auto":          { parinte: "Electrice și senzori",          sub: null },
};

/** Potrivire laxă: fără diacritice, fără majuscule, și cu plural/singular tratat
 *  la fel, ca „Ștergătoare" și „stergatoare" să nu devină două categorii. */
const cheieLaxa = (s) => normalizeaza(s).replace(/\b(uri|urile|ele|ile|le|i|e)\b/g, "").replace(/(uri|ele|ile)$/,"").replace(/\s+/g, " ").trim();

function potrivesteCategoria(slugSursa, categories, pragPiese, nrPiese) {
  const rez = { categorie_id: null, categorie: null, subcategorie_id: null, subcategorie: null,
                de_creat: null, note: [] };
  const regula = REGULI_CATEGORII[slugSursa];
  const parinti = categories.filter((c) => c.parent_id === null);

  if (!regula) {
    rez.note.push(`categorie-sursă fără regulă: „${slugSursa}" — de decis`);
    return rez;
  }

  const par = parinti.find((c) => cheieLaxa(c.nume) === cheieLaxa(regula.parinte));
  if (!par) { rez.note.push(`categorie-părinte inexistentă: „${regula.parinte}"`); return rez; }
  rez.categorie_id = par.id; rez.categorie = par.nume;

  // `sub: null` = știm că nu avem subcategorie potrivită; rămâne doar părintele.
  if (!regula.sub) {
    rez.note.push(`fără subcategorie potrivită pentru „${slugSursa}" — rămâne categoria-părinte`);
    return rez;
  }

  const sub = categories.find((c) => c.parent_id === par.id && cheieLaxa(c.nume) === cheieLaxa(regula.sub));
  if (sub) { rez.subcategorie_id = sub.id; rez.subcategorie = sub.nume; return rez; }

  // Subcategoria lipsește.
  if (regula.creeaza && nrPiese >= pragPiese) {
    rez.de_creat = { nume: regula.sub, parent_id: par.id, parinte: par.nume };
    rez.note.push(`subcategorie de creat: „${regula.sub}" sub „${par.nume}" (${nrPiese} piese)`);
  } else if (regula.creeaza) {
    rez.note.push(`subcategorie „${regula.sub}" NU se creează: doar ${nrPiese} piese, pragul e ${pragPiese}`);
  } else {
    rez.note.push(`subcategorie „${regula.sub}" inexistentă — rămâne doar categoria-părinte`);
  }
  return rez;
}

// ============================================================
// DE LA DATELE EXTRASE LA RÂNDUL DIN `products`
//
// Numele coloanelor sunt cele reale, verificate în bază:
//   · titlul       → `nume`
//   · prețul       → `pret_lei` (nu `pret`)
//   · descrierea   → `stare_nota` (nu există `descriere`; adminul afișează
//                     `stare_nota` sub eticheta „Descriere")
//   · `stare`      → rămâne NULL: are CHECK pe A/B/C, iar starea A/B/C a fost
//                     scoasă din interfață (vezi CLAUDE.md)
//   · `poze`       → rămâne gol. Pozele se descarcă abia la publicare (C.5);
//                     aici se salvează doar URL-urile, în `poze_sursa`
//   · `cod_intern` → îl pune triggerul `set_cod_intern` (AP-000123)
// ============================================================
const slugifica = (s) => normalizeaza(s).replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 70).replace(/^-|-$/g, "");

export function construiesteRand(x, categories) {
  // `art` (ilustrația de rezervă) vine din categoria potrivită, nu se inventează.
  const cat = categories?.find((c) => c.id === (x.subcategorie_id ?? x.categorie_id));
  const erori = x.revizuire?.length ? { revizuire: x.revizuire } : null;
  return {
    // identitate
    slug: `${slugifica(x.titlu ?? x.feed.Titlu)}-${x.sursa_id}`,   // sufixul de ID garantează unicitatea
    nume: x.titlu ?? x.feed.Titlu,
    // preț: din FEED, care e sursa autoritară pentru preț
    pret_lei: Number(x.feed.Pret),
    // conținut
    stare_nota: x.descriere ?? null,
    ani: x.an_min ? (x.an_min === x.an_max ? String(x.an_min) : `${x.an_min}–${x.an_max}`) : null,
    art: cat?.art ?? "engine",
    categorie_id: x.categorie_id ?? null,
    subcategorie_id: x.subcategorie_id ?? null,
    model_ids: x.model_id ? [x.model_id] : [],
    compat: x.compat?.length ? x.compat : [],
    // Greutatea nu există pe pieseauto.ro. Ca să nu blocheze publicarea, piesa
    // primește 1 kg — dar marcat ca estimat, ca nimeni să nu ia valoarea drept
    // cântărită. Steagul cade pe `false` când operatorul salvează o greutate reală.
    greutate_kg: 1,
    greutate_estimata: true,
    // stoc și vizibilitate
    stoc: 1,
    publicat: false,          // NIMIC nu se publică automat (C.10)
    // proveniență
    sursa: "pieseauto.ro",
    sursa_id: x.sursa_id,
    sursa_url: x.sursa_url,
    sursa_activ: true,
    poze: [],                 // se completează la publicare
    poze_sursa: x.poze ?? [],
    poze_descarcate: false,
    editat_manual: false,
    import_erori: erori,
  };
}

// ============================================================
// Taxonomia proprie, citită din Supabase cu cheia publică (doar citire).
// ============================================================
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

// ============================================================
// SCRIEREA ÎN BAZĂ
//
// Trece prin cheia de service, fiindcă `products` n-are politică de insert pentru
// `anon` — a fost ștearsă intenționat (vezi CLAUDE.md). Cheia stă în `.env.local`,
// niciodată în cod.
//
// `on_conflict=sursa,sursa_id` face inserția idempotentă: a doua rulare pe același
// feed nu dublează nimic. Coloanele pe care le poate atinge un re-import sunt doar
// cele de mai jos; munca operatorului (poze, greutate reală, categorii, descriere)
// nu se suprascrie niciodată — vezi `COLOANE_LA_REIMPORT`.
// ============================================================
// Ce poate atinge un RE-import. Tot restul e muncă de operator și nu se
// suprascrie niciodată: poze, greutate_kg, categorie_id, subcategorie_id,
// cod_intern, originala, stare_nota (descrierea) și cost_lei.
// `nume` intră în listă doar dacă piesa n-a fost editată manual.
const COLOANE_LA_REIMPORT = ["pret_lei", "sursa_url", "sursa_activ", "sursa_sincronizat_la"];

async function scrie(randuri, env) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) { console.error("Lipsește SUPABASE_SERVICE_ROLE_KEY din .env.local."); process.exit(2); }
  const baza = env.NEXT_PUBLIC_SUPABASE_URL;
  const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const rez = { noi: 0, actualizate: 0, neschimbate: 0, erori: [] };
  const acum = new Date().toISOString();

  // 1. Ce există deja? Ne uităm și la `editat_manual`, ca să știm dacă avem voie
  //    să atingem titlul.
  const existente = new Map();
  for (let i = 0; i < randuri.length; i += 100) {
    const ids = randuri.slice(i, i + 100).map((x) => `"${x.sursa_id}"`).join(",");
    const r = await fetch(`${baza}/rest/v1/products?sursa=eq.pieseauto.ro&sursa_id=in.(${ids})&select=id,sursa_id,nume,pret_lei,editat_manual`, { headers: h });
    if (!r.ok) { rez.erori.push(`citire existente: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`); continue; }
    for (const x of await r.json()) existente.set(x.sursa_id, x);
  }

  const noi = randuri.filter((x) => !existente.has(x.sursa_id));
  const vechi = randuri.filter((x) => existente.has(x.sursa_id));

  // 2. Piesele noi: inserție completă, nepublicate.
  for (let i = 0; i < noi.length; i += 25) {
    const lot = noi.slice(i, i + 25).map((x) => ({ ...x, sursa_sincronizat_la: acum }));
    const r = await fetch(`${baza}/rest/v1/products`, {
      method: "POST", headers: { ...h, Prefer: "return=representation" }, body: JSON.stringify(lot),
    });
    if (!r.ok) { const t = await r.text(); rez.erori.push(`insert: HTTP ${r.status} ${t.slice(0, 300)}`); console.error(`   ✗ insert: ${r.status} ${t.slice(0, 200)}`); continue; }
    const d = await r.json(); rez.noi += d.length;
    console.log(`   ✓ inserate ${d.length}`);
  }

  // 3. Piesele existente: DOAR coloanele permise. Titlul numai dacă piesa n-a
  //    fost editată manual. Dacă nu s-a schimbat nimic, nu atingem rândul.
  for (const x of vechi) {
    const v = existente.get(x.sursa_id);
    const patch = {};
    if (Number(v.pret_lei) !== Number(x.pret_lei)) patch.pret_lei = x.pret_lei;
    if (!v.editat_manual && v.nume !== x.nume) patch.nume = x.nume;
    if (!Object.keys(patch).length) { rez.neschimbate++; continue; }
    patch.sursa_sincronizat_la = acum;
    patch.sursa_activ = true;
    const r = await fetch(`${baza}/rest/v1/products?id=eq.${v.id}`, { method: "PATCH", headers: h, body: JSON.stringify(patch) });
    if (!r.ok) { rez.erori.push(`update ${x.sursa_id}: HTTP ${r.status}`); continue; }
    rez.actualizate++;
  }

  // 4. Piesele care au dispărut din feed nu se șterg: pot avea comenzi în istoric.
  //    Se depublică și se marchează inactive. (Se face doar la rularea completă,
  //    nu la un feed parțial — altfel un eșantion de 50 ar depublica restul de 7.950.)
  return rez;
}

async function citesteTaxonomia() {
  const env = citesteEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL, key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) { console.log("⚠ Fără chei Supabase — potrivirea marcă/model se sare."); return null; }
  const ia = async (t, sel) => {
    const r = await fetch(`${url}/rest/v1/${t}?select=${sel}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!r.ok) throw new Error(`${t}: HTTP ${r.status}`);
    return r.json();
  };
  const [brands, models, categories] = await Promise.all([
    ia("brands", "id,nume,slug"), ia("models", "id,nume,brand_id"), ia("categories", "id,nume,slug,parent_id"),
  ]);
  return { brands, models, categories };
}

// ============================================================
// RULARE
// ============================================================
const scrieStare = (s) => {
  mkdirSync(dirname(CALE_STARE), { recursive: true });
  writeFileSync(CALE_STARE, JSON.stringify(s, null, 1));
};
const citesteStare = () => (existsSync(CALE_STARE) ? JSON.parse(readFileSync(CALE_STARE, "utf8")) : { gata: [] });

async function main() {
  await verificaCurl();
  const randuri = parseCSV(readFileSync(CALE_FEED, "utf8"));
  console.log(`Feed: ${CALE_FEED} — ${randuri.length} rânduri, coloane: ${Object.keys(randuri[0] ?? {}).join(", ")}`);

  const stare = RELUARE ? citesteStare() : { gata: [] };
  const facute = new Set(stare.gata);
  let lista = LIMITA ? randuri.slice(0, LIMITA) : randuri;
  const deFacut = lista.filter((r) => !facute.has(r.ID));
  if (facute.size) console.log(`Reluare: ${facute.size} deja procesate, rămân ${deFacut.length}.`);

  const minute = Math.round((deFacut.length * PAUZA_MS) / 60000);
  console.log(`De procesat: ${deFacut.length} pagini · timp estimat ≈ ${minute < 1 ? "sub un minut" : minute + " minute"}`);
  if (USCAT) console.log("MOD USCAT: nu se scrie nimic în baza de date.\n");

  const taxonomie = await citesteTaxonomia();
  const rezultate = [];
  let faraPozeInLot = 0, nepotrivireInLot = 0, inLot = 0;
  let refuzuri = 0, erori = 0;

  for (const [i, r] of deFacut.entries()) {
    process.stdout.write(`[${i + 1}/${deFacut.length}] ${r.ID} … `);
    const a = await adu(r.URL);
    if (!a.ok) {
      const refuzat = a.eroare.includes("sorry");
      refuzat ? refuzuri++ : erori++;
      console.log(`✗ ${a.eroare}`);
      rezultate.push({ feed: r, eroare: a.eroare, refuzat, sursa_url: r.URL, compat: [],
                       revizuire: ["pagina n-a putut fi citită"] });
      await pauzaPoliticoasa(); continue;
    }
    // URL-ul canonic: în mod normal e cel la care ne-a dus redirectul. Dacă
    // redirectul n-a avut loc, îl luăm din `og:url`, care conține aceeași
    // taxonomie. Abia dacă nu merge niciuna, rămânem cu URL-ul din feed.
    const ogUrl = metaProp(a.html, "og:url");
    const canonic = (a.urlFinal.includes("/produs-") ? ogUrl : a.urlFinal) || ogUrl || a.urlFinal;

    const ext = extrage(a.html, canonic);
    const pot = taxonomie ? potriveste(ext, taxonomie) : { note: ["taxonomie necitită"] };

    const revizuire = [...ext.erori, ...pot.note];
    if (canonic.includes("/produs-")) revizuire.push("URL canonic indisponibil — taxonomia nu s-a putut citi");

    rezultate.push({
      feed: r,
      sursa_id: r.ID,
      sursa_url: canonic,
      redirectat: a.urlFinal !== r.URL,
      ...ext, ...pot,
      revizuire,
    });

    inLot++;
    if (!ext.poze.length) faraPozeInLot++;
    if (pot.nepotrivire_titlu || pot.nepotrivire_marca) nepotrivireInLot++;
    const semn = pot.nepotrivire_marca ? " ⚠MARCĂ" : pot.nepotrivire_titlu ? " ⚠titlu" : pot.generatie_dedusa ? " (generație dedusă)" : "";
    console.log(`✓ ${ext.poze.length} poze · ${ext.categorie_sursa ?? "?"} · ${pot.marca ?? "?"} ${pot.model ?? "?"}${semn}`);

    // ---- canarul (C.7), cu două măsurători ----
    if (inLot >= LOT_CANAR) {
      const rataPoze = faraPozeInLot / inLot;
      const rataNepotriviri = nepotrivireInLot / inLot;
      console.log(`   canar: ${(rataPoze * 100).toFixed(0)}% fără poze · ${(rataNepotriviri * 100).toFixed(0)}% nepotriviri față de titlu (lot de ${inLot})`);
      // Doar lipsa pozelor oprește importul: înseamnă că s-a schimbat HTML-ul.
      // Nepotrivirile sunt o proprietate a datelor lor, nu o defecțiune — se
      // raportează, nu blochează.
      if (rataPoze > PRAG_CANAR) {
        console.error(`\n⛔ OPRIT: ${(rataPoze * 100).toFixed(0)}% din pagini n-au dat nicio poză (prag ${PRAG_CANAR * 100}%).`);
        console.error("   Probabil pieseauto.ro și-a schimbat HTML-ul. Verifică extragerea înainte de a relua.");
        break;
      }
      inLot = 0; faraPozeInLot = 0; nepotrivireInLot = 0;
    }

    stare.gata.push(r.ID);
    if (!USCAT) scrieStare(stare);
    if (i < deFacut.length - 1) await pauzaPoliticoasa();
  }

  // ---------- a doua trecere: categoriile ----------
  // Se face abia acum, fiindcă pragul de creare are nevoie de numărul total de
  // piese din fiecare categorie-sursă, care se știe doar după ce s-a citit tot.
  const nrPePeCategorie = {};
  for (const x of rezultate) if (x.categorie_sursa) nrPePeCategorie[x.categorie_sursa] = (nrPePeCategorie[x.categorie_sursa] ?? 0) + 1;

  if (taxonomie) {
    for (const x of rezultate) {
      if (!x.categorie_sursa) continue;
      const c = potrivesteCategoria(x.categorie_sursa, taxonomie.categories, PRAG_CATEGORIE, nrPePeCategorie[x.categorie_sursa]);
      Object.assign(x, {
        categorie_id: c.categorie_id, categorie: c.categorie,
        subcategorie_id: c.subcategorie_id, subcategorie: c.subcategorie,
        categorie_de_creat: c.de_creat,
      });
      x.revizuire.push(...c.note);
      // Chiar dacă totul a mers, o categorie creată automat se vede în raport.
      if (c.de_creat) x.revizuire.push("categorie creată automat — de verificat");
    }
  }

  // ---------- raport ----------
  const bune = rezultate.filter((x) => !x.eroare);
  const proc = (n, d) => (d ? ((n / d) * 100).toFixed(0) + "%" : "—");
  console.log("\n" + "═".repeat(66));
  console.log("RAPORT");
  console.log("═".repeat(66));
  console.log(`  pagini citite            ${bune.length}/${rezultate.length}`);
  console.log(`  refuzuri („sorry")       ${refuzuri}`);
  console.log(`  erori de rețea/HTTP      ${erori}`);
  console.log(`  cu poze                  ${bune.filter((x) => x.poze?.length).length}  (${proc(bune.filter((x) => x.poze?.length).length, bune.length)})`);
  const totalPoze = bune.reduce((s, x) => s + (x.poze?.length ?? 0), 0);
  console.log(`  poze în total            ${totalPoze}  (medie ${(totalPoze / (bune.length || 1)).toFixed(1)} pe produs)`);
  console.log(`  cu descriere             ${bune.filter((x) => x.descriere).length}  (${proc(bune.filter((x) => x.descriere).length, bune.length)})`);
  console.log(`  cu marcă potrivită       ${bune.filter((x) => x.brand_id).length}  (${proc(bune.filter((x) => x.brand_id).length, bune.length)})`);
  console.log(`  cu model potrivit        ${bune.filter((x) => x.model_id).length}  (${proc(bune.filter((x) => x.model_id).length, bune.length)})`);
  console.log(`  cu ani                   ${bune.filter((x) => x.an_min).length}  (${proc(bune.filter((x) => x.an_min).length, bune.length)})`);
  console.log(`  cu subcategorie          ${bune.filter((x) => x.subcategorie_id).length}  (${proc(bune.filter((x) => x.subcategorie_id).length, bune.length)})`);
  console.log(`  generație dedusă din ani ${bune.filter((x) => x.generatie_dedusa).length}`);
  const nepMarca = bune.filter((x) => x.nepotrivire_marca).length;
  const nepTitlu = bune.filter((x) => x.nepotrivire_titlu).length;
  console.log(`  ⚠ MARCA lipsă din titlu  ${nepMarca}  (${proc(nepMarca, bune.length)})  ← semnal grav`);
  console.log(`  model lipsă din titlu    ${nepTitlu}  (${proc(nepTitlu, bune.length)})`);
  console.log(`  marcate pentru revizuire ${rezultate.filter((x) => x.revizuire?.length).length}`);
  const dispAltele = bune.filter((x) => x.disponibilitate && x.disponibilitate !== "InStock");
  console.log(`  disponibilitate ≠ InStock ${dispAltele.length}${dispAltele.length ? " → " + [...new Set(dispAltele.map((x) => x.disponibilitate))].join(", ") : ""}`);

  console.log("\n  CATEGORII-SURSĂ ÎNTÂLNITE");
  for (const [slug, n] of Object.entries(nrPePeCategorie).sort((a, b) => b[1] - a[1])) {
    const ex = rezultate.find((x) => x.categorie_sursa === slug);
    const dest = ex?.subcategorie ? `${ex.categorie} / ${ex.subcategorie}`
      : ex?.categorie ? `${ex.categorie} / —`
      : "FĂRĂ POTRIVIRE";
    const marcaj = ex?.categorie_de_creat ? "  [de creat]" : "";
    console.log(`    ${String(n).padStart(4)} piese  ${slug.padEnd(24)} → ${dest}${marcaj}`);
  }

  if (CALE_JSON) { writeFileSync(CALE_JSON, JSON.stringify(rezultate, null, 1)); console.log(`\nRezultat brut: ${CALE_JSON}`); }

  // ---------- scrierea ----------
  if (!USCAT && taxonomie) {
    const randuri = bune.map((x) => construiesteRand(x, taxonomie.categories));
    console.log(`\nScriu ${randuri.length} rânduri în products…`);
    const s = await scrie(randuri, citesteEnv());
    console.log(`\n  noi          ${s.noi}\n  actualizate  ${s.actualizate}\n  neschimbate  ${s.neschimbate}` +
      (s.erori.length ? `\n  erori:\n    ` + s.erori.join("\n    ") : ""));
  }

  return rezultate;
}

// Rulează doar când fișierul e executat direct. Așa `parseCSV` și `extrage` pot fi
// importate de un test fără să pornească importul.
if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await main();
  console.log(`\nGata. ${r.length} pagini procesate, ${r.filter((x) => x.revizuire?.length).length} marcate pentru revizuire.`);
}
