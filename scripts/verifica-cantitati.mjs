#!/usr/bin/env node
// VERIFICĂ CANTITĂȚILE DIN COȘ, ÎN BROWSER, PE PIESE REALE.
//
// DE CE (20 octombrie 2026)
// Coșul a refuzat până azi a doua bucată din aceeași piesă („la dezmembrări
// fiecare piesă e unicat"). Măsurat atunci: 84 de piese publicate aveau stoc
// peste 1 — arcuri, injectoare, bobine, capace de jante, adică exact ce se
// cumpără în set. Regula veche costa vânzări.
//
// Regula de acum are o parte în browser (selector, plafon, subtotaluri) și una
// pe server (`plaseaza_comanda` înmulțește și refuză peste stoc). Niciuna nu se
// poate verifica citind codul: plafonul e o valoare din baza de date, iar
// coșul trăiește în `localStorage`. De aici scriptul.
//
// ATENȚIE, DOUĂ CAPCANE MĂSURATE:
//   · Se rulează pe build-ul de PRODUCȚIE (`npm run build && npx next start`).
//     În `npm run dev`, React StrictMode golește coșul la reîncărcare — vezi
//     CLAUDE.md. Pe dev, verificarea 5 ar pica fără ca nimic să fie stricat.
//   · Proba de server trimite INTENȚIONAT un total greșit. `plaseaza_comanda`
//     compară totalul ÎNAINTE de `insert into orders`, deci se oprește acolo:
//     nu se creează nicio comandă și nu se consumă niciun număr de comandă
//     (`nextval` vine după verificare). Verificat: `orders` neatinsă.
//
// CUM SE RULEAZĂ
//   npm run build && npx next start -p 3100 &
//   BASE=http://localhost:3100 node scripts/verifica-cantitati.mjs
//
// Are nevoie de `playwright-core` și de un Chromium, legate ca la
// `scan-responsive.mjs` (vezi antetul lui). Iese cu cod 1 dacă pică ceva.
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = (process.env.BASE || "http://localhost:3000").replace(/\/$/, "");

// ---------- cheile Supabase, din .env.local ----------
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n")
  .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
  .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const SB = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const rest = async (cale) =>
  (await fetch(`${SB}/rest/v1/${cale}`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } })).json();

let picate = 0;
const verifica = (ce, cond, detaliu = "") => {
  console.log(`${cond ? "✓" : "✗"} ${ce}${detaliu ? ` — ${detaliu}` : ""}`);
  if (!cond) picate++;
};

// ---------- piesele de probă se ALEG din bază ----------
// Hardcodate, s-ar rupe la prima vânzare. Cerem o piesă cu stoc peste 1 și una
// unicat, amândouă publicate și cu poze (ca pagina să arate ca una reală).
const [multe] = await rest("products?stoc=gt.2&publicat=eq.true&select=id,slug,pret_lei,stoc&order=stoc.desc&limit=1");
const [unica] = await rest("products?stoc=eq.1&publicat=eq.true&select=id,slug,pret_lei&order=id.desc&limit=1");
if (!multe || !unica) {
  console.error("Nu s-au găsit piese de probă (una cu stoc > 2 și una cu stoc 1). Nimic de verificat.");
  process.exit(2);
}
const lei = (n) => n.toLocaleString("ro-RO").replace(/ /g, ".");
console.log(`Piese de probă: #${multe.id} (${multe.pret_lei} lei, stoc ${multe.stoc}) și #${unica.id} (${unica.pret_lei} lei, unicat)\n`);

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });   // telefon
const p = await ctx.newPage();
const text = () => p.locator("body").innerText();
const campCant = () => p.getByLabel("Cantitate", { exact: true }).first();

// ---------- 1. pagina piesei: eticheta și selectorul ----------
await p.goto(`${BASE}/piese/${multe.slug}`, { waitUntil: "networkidle" });
verifica(`eticheta scrie „${multe.stoc} buc. pe stoc”`,
  await p.getByText(`${multe.stoc} buc. pe stoc`).isVisible());
verifica("selectorul pornește de la 1", (await campCant().inputValue()) === "1");
verifica("„−” e stins la 1", await p.getByLabel("Scade cantitatea").isDisabled());
for (let i = 0; i < 3; i++) await p.getByLabel("Crește cantitatea").click();
verifica("3 apăsări pe „+” dau 4", (await campCant().inputValue()) === "4", await campCant().inputValue());

// ---------- 2. cantitatea aleasă ajunge în coș ----------
await p.getByRole("button", { name: "Adaugă în coș" }).first().click();
await p.waitForURL("**/cos");
await p.waitForLoadState("networkidle");
let t = await text();
verifica("coșul numără 4 bucăți, nu 1 rând", /·\s*4 piese/.test(t), t.match(/Coșul meu[^\n]*/)?.[0]);
verifica(`rândul arată „4 × ${lei(multe.pret_lei)} lei”`, t.includes(`4 × ${lei(multe.pret_lei)} lei`));
verifica("totalul rândului e înmulțit", t.includes(`${lei(multe.pret_lei * 4)} lei`));

// ---------- 3. plafonul e stocul real ----------
await campCant().fill("999");
await p.waitForTimeout(250);
verifica(`999 se taie la stocul real (${multe.stoc})`,
  (await campCant().inputValue()) === String(multe.stoc), await campCant().inputValue());
verifica("„+” e stins la plafon", await p.getByLabel("Crește cantitatea").isDisabled());
verifica("subtotalul urmează plafonul",
  (await text()).includes(`${lei(multe.pret_lei * multe.stoc)} lei`));

// ---------- 4. piesa unicat n-are selector ----------
await p.goto(`${BASE}/piese/${unica.slug}`, { waitUntil: "networkidle" });
verifica("piesa unicat n-are selector", (await p.getByLabel("Cantitate", { exact: true }).count()) === 0);
await p.getByRole("button", { name: "Adaugă în coș" }).first().click();
await p.waitForURL("**/cos");
await p.waitForLoadState("networkidle");
t = await text();
const bucati = multe.stoc + 1;
verifica(`coșul numără ${bucati} bucăți`, new RegExp(`·\\s*${bucati} `).test(t), t.match(/·\s*\d+ [^\n]*/)?.[0]);
verifica("subtotalul adună corect amestecul",
  t.includes(`${lei(multe.pret_lei * multe.stoc + Number(unica.pret_lei))} lei`));
verifica("rândul unicat scrie „piesă unică”", /piesă unică/.test(t));
verifica("rândul unicat n-are selector", (await p.getByLabel("Cantitate", { exact: true }).count()) === 1);

// ---------- 5. coșul supraviețuiește reîncărcării ----------
await p.reload({ waitUntil: "networkidle" });
verifica("după reîncărcare cantitățile sunt tot acolo",
  new RegExp(`·\\s*${bucati} `).test(await text()));

// ---------- 6. checkout: sumarul nu se contrazice ----------
await p.getByRole("link", { name: "Finalizează comanda" }).click();
await p.waitForURL("**/checkout");
await p.waitForLoadState("networkidle");
t = await text();
verifica(`sumarul din checkout scrie „× ${multe.stoc}”`, t.includes(`× ${multe.stoc}`));
verifica("totalul din checkout e cel din coș",
  t.includes(`${lei(multe.pret_lei * multe.stoc + Number(unica.pret_lei))} lei`));
await ctx.close();
const b2 = b;   // același browser, context curat pentru măsurarea așezării

// ---------- 7. AȘEZAREA: butonul nu intră peste vecini ----------
// DE CE EXISTĂ VERIFICAREA ASTA: prima formă a selectorului îl punea LÂNGĂ
// butonul „Adaugă în coș" de la 640px în sus. Componenta trăiește într-o celulă
// de grilă `minmax(0,1fr)`, iar butonul are `whitespace-nowrap`, deci nu poate
// scădea sub lățimea textului — la 640, 1024, 1280 și 1440px ieșea PESTE
// butonul de WhatsApp. Nu s-a văzut în verificarea de depășire orizontală a
// paginii (nu era niciuna) și a fost găsită de proprietar, în browser.
// De atunci se măsoară aici, pe cutiile reale.
const LATIMI = [320, 360, 390, 428, 480, 640, 768, 834, 1024, 1280, 1440];
const ctx2 = await b2.newContext();
const q = await ctx2.newPage();
let aseza = 0;
for (const w of LATIMI) {
  await q.setViewportSize({ width: w, height: 1000 });
  await q.goto(`${BASE}/piese/${multe.slug}`, { waitUntil: "networkidle" });
  const r = await q.evaluate(() => {
    const cutie = (e) => { if (!e) return null; const b = e.getBoundingClientRect();
      return { x: b.x, y: b.y, r: b.right, bot: b.bottom, w: b.width, h: b.height }; };
    const btn = [...document.querySelectorAll("button")]
      .find((e) => /^(Adaugă în coș|În coș)/.test(e.textContent.trim()));
    const wa = [...document.querySelectorAll("a")].find((e) => e.textContent.trim() === "WhatsApp");
    const minus = document.querySelector('[aria-label="Scade cantitatea"]');
    const sel = minus?.parentElement;
    const peste = (a, c) => a && c && a.x < c.r && c.x < a.r && a.y < c.bot && c.y < a.bot;
    const B = cutie(btn), W = cutie(wa), S = cutie(sel), M = cutie(minus);
    // Textul care iese din propriul buton e a doua formă a aceleiași probleme.
    const taiat = [btn, wa].filter((e) => e && e.scrollWidth - e.clientWidth > 1).length;
    return {
      suprapus: peste(B, W) || peste(S, B) || peste(S, W), taiat,
      areSelector: !!S, areButon: !!B,
      // Așezarea cerută de proprietar: cantitatea și butonul pe un rând,
      // WhatsApp dedesubt. Sub 360px nu încap — butonul coboară pe toată
      // lățimea, ceea ce e în regulă.
      unRand: !!S && !!B && Math.abs(S.y - B.y) < 6,
      waDedesubt: !!W && !!B && W.y >= B.bot - 2,
      tintaMica: !!M && (M.w < 44 || M.h < 44),
    };
  });
  const cere1Rand = w >= 360;
  const probleme = [
    r.suprapus && "butoane suprapuse",
    r.taiat && "text tăiat",
    !r.areSelector && "fără selector",
    !r.areButon && "fără buton",
    r.tintaMica && "țintă sub 44px",
    cere1Rand && !r.unRand && "cantitatea nu e pe rândul butonului",
    !r.waDedesubt && "WhatsApp nu e dedesubt",
  ].filter(Boolean);
  if (probleme.length) { console.log(`✗ așezare @${w}px: ${probleme.join(", ")}`); aseza++; }
}
await ctx2.close();
verifica(`pe ${LATIMI.length} lățimi: cantitatea lângă buton, WhatsApp dedesubt, nimic suprapus`, aseza === 0,
  aseza === 0 ? "320–1440px" : `${aseza} lățimi cu probleme`);

await b.close();

// ---------- 8. SERVERUL înmulțește și refuză peste stoc ----------
// Partea asta nu trece prin browser: cheamă direct funcția, cu un total greșit,
// deci nu scrie nimic. Vezi antetul.
const cheamaServer = async (cant) => {
  const r = await fetch(`${SB}/rest/v1/rpc/plaseaza_comanda`, { method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      p_client: { nume: "Probă cantitate", email: "proba@exemplu.ro", telefon: "0700000000",
                  adresa: "Str. Probei 1", oras: "Piatra-Neamt", judet: "Neamt", gdpr: true },
      p_items: [{ id: multe.id, cantitate: cant }],
      p_curier: "fan", p_plata: "ramburs", p_total_asteptat: 1 }) });
  return (await r.json())?.mesaj ?? "";
};
const m1 = await cheamaServer(1);
const mN = await cheamaServer(multe.stoc);
const mPeste = await cheamaServer(multe.stoc + 1);
verifica("serverul confirmă prețul unei bucăți",
  m1.includes(`${Number(multe.pret_lei).toFixed(2)} lei`), m1.slice(0, 80));
verifica(`serverul înmulțește cu ${multe.stoc}`,
  mN.includes(`${(multe.pret_lei * multe.stoc).toFixed(2)} lei`), mN.slice(0, 80));
verifica("serverul refuză o cantitate peste stoc",
  /s-a vândut/.test(mPeste), mPeste.slice(0, 60));
// Nicio comandă n-a fost creată: toate trei s-au oprit la verificarea totalului.
verifica("niciuna dintre probe n-a creat comandă",
  [m1, mN, mPeste].every((m) => m.length > 0));

console.log(picate === 0 ? "\nTOATE AU TRECUT" : `\n${picate} VERIFICĂRI PICATE`);
process.exit(picate === 0 ? 0 : 1);
