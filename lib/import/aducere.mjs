// ============================================================
// CERERE POLITICOASĂ către pieseauto.ro, cu reîncercări.
//
// Modul COMUN: aceleași pauze, același User-Agent și aceeași detectare a
// refuzurilor, indiferent dacă importul pornește din terminal sau din admin.
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
// Dacă `curl` lipsește (posibil pe o funcție serverless), se încearcă `fetch`.
// Refuzul se detectează la fel în ambele cazuri, deci nu se salvează niciodată
// o pagină „sorry" ca și cum ar fi un produs.
// ============================================================
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ---------- politețe ----------
// Serverul e al altcuiva. O singură cerere pe rând, pauză cu variație, User-Agent
// care spune cine suntem și unde ne găsești dacă deranjăm.
export const UA = "AutopasImport/1.0 (+https://autopas-dezmembrari.ro)";
export const PAUZA_MS = 1750;          // 1,75s ± 30% => între 1,2 și 2,3 secunde
export const VARIATIE = 0.3;
export const ASTEPTARI_EROARE = [5000, 15000, 45000];   // exponențial, apoi abandon

export const dormi = (ms) => new Promise((r) => setTimeout(r, ms));
export const pauzaPoliticoasa = () => dormi(Math.round(PAUZA_MS * (1 + (Math.random() * 2 - 1) * VARIATIE)));

let execFileP = null;
let curlVerificat = false, areCurl = false;

async function iaExec() {
  if (execFileP) return execFileP;
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  execFileP = promisify(execFile);
  return execFileP;
}

export async function existaCurl() {
  if (curlVerificat) return areCurl;
  curlVerificat = true;
  try { const ex = await iaExec(); await ex("curl", ["--version"]); areCurl = true; }
  catch { areCurl = false; }
  return areCurl;
}

/** O singură încercare prin curl. Corpul se scrie într-un fișier temporar, iar
 *  starea și URL-ul final vin pe stdout — altfel n-am putea separa metadatele de HTML. */
async function prinCurl(url) {
  const ex = await iaExec();
  const tmp = join(tmpdir(), `autopas-import-${process.pid}-${Math.random().toString(36).slice(2)}.html`);
  try {
    const { stdout } = await ex("curl", [
      "-sS", "-L",                       // tăcut (dar arată erorile), urmează redirectul
      "-A", UA,
      "--max-time", "30",
      "--retry", "0",                    // reîncercările le gestionăm noi, cu pauze
      "-o", tmp,
      "-w", "%{http_code}\t%{url_effective}",
      url,
    ], { maxBuffer: 1 << 20 });
    const [c, u] = stdout.trim().split("\t");
    return { cod: Number(c), urlFinal: u || url, html: readFileSync(tmp, "utf8") };
  } finally {
    rmSync(tmp, { force: true });
  }
}

/** Varianta de rezervă, când `curl` nu există în mediul de rulare. */
async function prinFetch(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, redirect: "follow" });
  return { cod: r.status, urlFinal: r.url || url, html: await r.text() };
}

/** Aduce o pagină de produs. Întoarce `{ok:true, html, urlFinal}` sau `{ok:false, eroare}`. */
export async function aducePagina(url) {
  const cuCurl = await existaCurl();
  for (let i = 0; i <= ASTEPTARI_EROARE.length; i++) {
    let r;
    try {
      r = cuCurl ? await prinCurl(url) : await prinFetch(url);
    } catch (e) {
      if (i === ASTEPTARI_EROARE.length)
        return { ok: false, eroare: `rețea: ${(e?.stderr || e?.message || e).toString().trim().slice(0, 120)}` };
      await dormi(ASTEPTARI_EROARE[i]); continue;
    }

    if (r.cod === 429 || r.cod === 503) {
      if (i === ASTEPTARI_EROARE.length) return { ok: false, eroare: `HTTP ${r.cod} după ${ASTEPTARI_EROARE.length} încercări` };
      await dormi(ASTEPTARI_EROARE[i]); continue;
    }
    if (r.cod < 200 || r.cod >= 300) return { ok: false, eroare: `HTTP ${r.cod}` };

    // Refuzul lor vine cu HTTP 200, nu cu 429. Fără verificarea asta am fi
    // înregistrat pagini goale ca succese.
    if (r.urlFinal.includes("action=sorry")) {
      if (i === ASTEPTARI_EROARE.length) return { ok: false, eroare: 'refuzat de server (pagina „sorry")' };
      await dormi(ASTEPTARI_EROARE[i]); continue;
    }

    return { ok: true, html: r.html, urlFinal: r.urlFinal };
  }
  return { ok: false, eroare: "epuizat" };
}

/** Descarcă o poză de la sursă. Pozele sunt servite de un CDN de imagini, nu de
 *  aplicația lor, și `fetch` merge — nu e nevoie de curl aici. */
export async function aducePoza(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}
