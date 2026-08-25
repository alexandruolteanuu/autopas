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
// Dacă `curl` lipsește (cazul unei funcții serverless), se încearcă `fetch` —
// dar refuzul lui e sigur, nu întâmplător, deci se raportează pe loc ca eroare
// FATALĂ, fără reîncercări. Altfel fiecare piesă nouă ar costa 5+15+45 = 65 de
// secunde de somn pentru același „sorry", peste limita funcției, iar operatorul
// ar vedea doar un 504 fără explicație. Refuzul se detectează în ambele cazuri,
// deci nu se salvează niciodată o pagină „sorry" ca și cum ar fi un produs.
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
export const TIMEOUT_POZA_MS = 20000;                   // o poză care nu vine nu blochează lotul

/** Refuzul primit pe varianta `fetch` NU e trecător: undici trimite mereu
 *  `sec-fetch-mode: cors`, filtrul lor îl vede de fiecare dată, deci a doua și a
 *  treia încercare primesc exact același răspuns. Reîncercarea lui costă 65 de
 *  secunde de somn degeaba — mai mult decât trăiește o funcție serverless, care
 *  e tăiată cu 504 fără să apuce să salveze nimic. De aceea e marcat `fatal`. */
export const EROARE_FARA_CURL =
  'refuzat de sursă (pagina „sorry"): mediul de rulare n-are `curl`, iar pieseauto.ro ' +
  'refuză cererile făcute cu `fetch`. Importul de piese noi trebuie pornit dintr-un mediu ' +
  'cu curl (Codespace sau server propriu), nu dintr-o funcție serverless.';

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

/** Varianta de rezervă, când `curl` nu există în mediul de rulare. */
async function prinFetch(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, redirect: "follow" });
  return { cod: r.status, urlFinal: r.url || url, html: await r.text() };
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
  const cuCurl = await existaCurl();
  for (let i = 0; i <= ASTEPTARI_EROARE.length; i++) {
    const ultima = i === ASTEPTARI_EROARE.length;
    let r;
    try {
      r = cuCurl ? await prinCurl(url) : await prinFetch(url);
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
    if (r.urlFinal.includes("action=sorry")) {
      // Pe varianta `fetch` refuzul e sigur și repetabil — vezi EROARE_FARA_CURL.
      // Nu are rost să-l reîncercăm: same input, same answer, 65 de secunde pierdute.
      if (!cuCurl) return { ok: false, eroare: EROARE_FARA_CURL, fatal: true };
      if (ultima || !(await somnCuTermen(ASTEPTARI_EROARE[i], pana)))
        return { ok: false, eroare: 'refuzat de server (pagina „sorry")' };
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
