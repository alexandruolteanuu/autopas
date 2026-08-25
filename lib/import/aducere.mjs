// ============================================================
// CERERE POLITICOASĂ către pieseauto.ro, cu reîncercări.
//
// Modul COMUN: aceleași pauze, același User-Agent și aceeași detectare a
// refuzurilor, indiferent dacă importul pornește din terminal sau din admin.
//
// DE CE HTTP/2 ȘI NU `fetch` (constatat 25 august 2026)
// `fetch` din Node (undici) e refuzat de pieseauto.ro: cererea primește HTTP 200,
// dar conținutul e pagina `/?action=sorry`, nu produsul. Multă vreme am crezut că
// vinovat e antetul `sec-fetch-mode: cors`, pe care undici îl trimite mereu. Nu
// el era: o cerere prin `node:https`, cu exact antetele lui curl și fără niciun
// `sec-`, e refuzată la fel. Diferența adevărată e VERSIUNEA DE PROTOCOL — curl
// negociază HTTP/2, iar `fetch` și `node:https` vorbesc HTTP/1.1. Aceeași cerere
// pe HTTP/2 primește pagina produsului.
//
// De aceea transportul e acum `node:http2`, nu un proces extern: merge la fel în
// Codespace și într-o funcție serverless, unde `curl` nu există. `curl` rămâne ca
// plasă, dacă h2 nu se poate deschide. UN SINGUR drum peste tot — diferența
// dintre medii era chiar cauza defectului din 25 august 2026.
//
// NU trimitem antete de browser ca să ne dăm drept om — ar fi mascare, și ar
// strica tocmai acordul pe care clientul îl are cu platforma. Trimitem o cerere
// simplă și cinstită (`Accept: */*`), cu User-Agent-ul nostru și adresa de
// contact în el. Cine se uită în jurnalele lor vede exact cine suntem.
//
// Refuzul „sorry" se detectează oricum ar veni, deci nu se salvează niciodată o
// pagină goală ca și cum ar fi un produs.
// ============================================================
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import http2 from "node:http2";
import { gunzipSync, brotliDecompressSync, inflateSync } from "node:zlib";

// ---------- politețe ----------
// Serverul e al altcuiva. O singură cerere pe rând, pauză cu variație, User-Agent
// care spune cine suntem și unde ne găsești dacă deranjăm.
export const UA = "AutopasImport/1.0 (+https://autopas-dezmembrari.ro)";
export const PAUZA_MS = 1750;          // 1,75s ± 30% => între 1,2 și 2,3 secunde
export const VARIATIE = 0.3;
export const ASTEPTARI_EROARE = [5000, 15000, 45000];   // exponențial, apoi abandon
export const TIMEOUT_POZA_MS = 20000;                   // o poză care nu vine nu blochează lotul
// 20s, nu 30 (cât aștepta `curl --max-time 30`): o pagină vine în ~1,4s măsurat,
// iar plafonul trebuie să încapă în bugetul unui lot. Vezi invariantul din motor.mjs.
export const TIMEOUT_PAGINA_MS = 20000;
export const MAX_REDIRECT = 5;

const REDIRECTURI = new Set([301, 302, 303, 307, 308]);

/** Un refuz care ține și după toate reîncercările nu e o pană de moment: e o
 *  stare a sursei sau a mediului nostru, la fel pentru toate cele 8.000 de rânduri.
 *  Marcat `fatal`, ca motorul să oprească lotul cu motivul la vedere, în loc să
 *  macine mai departe și să marcheze mii de rânduri ca eșuate. */
export const EROARE_REFUZ_PERSISTENT =
  'refuzat de sursă (pagina „sorry") și după toate reîncercările. Ori pieseauto.ro ' +
  'a început să respingă cererile noastre, ori mediul de rulare nu poate deschide ' +
  'o conexiune HTTP/2 către ei. Importul e oprit aici, nu marchează rândurile ca eșuate.';

/** Somn care respectă un termen limită. Întoarce `false` dacă n-are loc să doarmă
 *  — atunci cine o cheamă abandonează pe loc, în loc să depășească bugetul. */
async function somnCuTermen(ms, pana) {
  if (Date.now() + ms > pana) return false;
  await dormi(ms);
  return true;
}

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

/** Desface corpul, oricum ar fi fost comprimat pe drum. */
function descompune(corp, codificare) {
  if (codificare === "gzip") return gunzipSync(corp).toString("utf8");
  if (codificare === "br") return brotliDecompressSync(corp).toString("utf8");
  if (codificare === "deflate") return inflateSync(corp).toString("utf8");
  return corp.toString("utf8");
}

/** O singură cerere HTTP/2, fără redirectări. Aruncă la orice problemă de rețea. */
function unSaltHttp2(href) {
  return new Promise((rezolva, respinge) => {
    const u = new URL(href);
    const sesiune = http2.connect(u.origin);
    let terminat = false;
    const iese = (f) => (x) => {
      if (terminat) return;
      terminat = true;
      sesiune.close();
      f(x);
    };
    const cade = iese((e) => respinge(e instanceof Error ? e : new Error(String(e))));

    sesiune.on("error", cade);
    sesiune.setTimeout(TIMEOUT_PAGINA_MS, () => cade(new Error(`fără răspuns în ${TIMEOUT_PAGINA_MS / 1000}s`)));

    const cerere = sesiune.request({
      ":path": (u.pathname || "/") + u.search,
      ":method": "GET",
      "user-agent": UA,
      "accept": "*/*",
      "accept-encoding": "gzip, deflate, br",
    });
    let antete = {};
    const bucati = [];
    cerere.on("response", (h) => { antete = h; });
    cerere.on("data", (d) => bucati.push(d));
    cerere.on("error", cade);
    cerere.on("end", iese(() => rezolva({
      cod: Number(antete[":status"]),
      locatie: antete["location"],
      corp: Buffer.concat(bucati),
      codificare: antete["content-encoding"],
    })));
    cerere.end();
  });
}

/** Transportul obișnuit: HTTP/2, urmărind redirectările ca `curl -L`. */
async function prinHttp2(url) {
  let curent = url;
  for (let salt = 0; salt <= MAX_REDIRECT; salt++) {
    const r = await unSaltHttp2(curent);
    if (REDIRECTURI.has(r.cod) && r.locatie) { curent = new URL(r.locatie, curent).href; continue; }
    return { cod: r.cod, urlFinal: curent, html: descompune(r.corp, r.codificare) };
  }
  throw new Error(`peste ${MAX_REDIRECT} redirectări`);
}

/** O încercare, cu transportul care merge. HTTP/2 e drumul obișnuit — merge și în
 *  Codespace, și pe o funcție serverless. `curl` intervine doar dacă h2 nu se
 *  poate deschide deloc (rețea filtrată, proxy care nu știe h2). */
async function unaSingura(url) {
  try {
    return await prinHttp2(url);
  } catch (e) {
    if (!(await existaCurl())) throw e;
    return await prinCurl(url);
  }
}

/**
 * Aduce o pagină de produs. Întoarce `{ok:true, html, urlFinal}` sau `{ok:false, eroare}`.
 *
 * `pana` e un termen limită absolut (`Date.now() + …`). Reîncercările dorm doar
 * dacă mai încap înainte de el: altfel un singur rând ar putea ține 65 de secunde
 * de somn, iar cine cheamă motorul în loturi scurte n-ar mai apuca să salveze
 * progresul. Implicit e `Infinity` — scriptul din terminal n-are grabă.
 *
 * `fatal: true` înseamnă „reluarea nu rezolvă nimic": nu e o pană trecătoare a
 * sursei, ci mediul de rulare care nu poate ajunge la ea. Motorul oprește lotul
 * în loc să marcheze mii de rânduri ca eșuate.
 */
export async function aducePagina(url, { pana = Infinity } = {}) {
  for (let i = 0; i <= ASTEPTARI_EROARE.length; i++) {
    const ultima = i === ASTEPTARI_EROARE.length;
    let r;
    try {
      r = await unaSingura(url);
    } catch (e) {
      const cauza = `rețea: ${(e?.stderr || e?.message || e).toString().trim().slice(0, 120)}`;
      if (ultima || !(await somnCuTermen(ASTEPTARI_EROARE[i], pana))) return { ok: false, eroare: cauza };
      continue;
    }

    if (r.cod === 429 || r.cod === 503) {
      if (ultima || !(await somnCuTermen(ASTEPTARI_EROARE[i], pana)))
        return { ok: false, eroare: `HTTP ${r.cod}` };
      continue;
    }
    if (r.cod < 200 || r.cod >= 300) return { ok: false, eroare: `HTTP ${r.cod}` };

    // Refuzul lor vine cu HTTP 200, nu cu 429. Fără verificarea asta am fi
    // înregistrat pagini goale ca succese.
    if (r.urlFinal.includes("action=sorry") || r.html.includes("action=sorry")) {
      // Un refuz izolat poate fi o limitare de moment, deci se mai încearcă. Unul
      // care ține și după toată scara de așteptări e altceva: e la fel pentru toate
      // rândurile, deci se raportează ca FATAL și oprește lotul (vezi motor.mjs).
      if (ultima || !(await somnCuTermen(ASTEPTARI_EROARE[i], pana)))
        return { ok: false, eroare: EROARE_REFUZ_PERSISTENT, fatal: true };
      continue;
    }

    return { ok: true, html: r.html, urlFinal: r.urlFinal };
  }
  return { ok: false, eroare: "epuizat" };
}

/** Descarcă o poză de la sursă. Pozele sunt servite de un CDN de imagini, nu de
 *  aplicația lor, și `fetch` merge — nu e nevoie de curl aici.
 *  Timeout obligatoriu: un `fetch` fără el așteaptă la nesfârșit, iar o singură
 *  conexiune agățată ar ține lotul blocat până îl taie serverul cu 504. */
export async function aducePoza(url) {
  const r = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(TIMEOUT_POZA_MS),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}
