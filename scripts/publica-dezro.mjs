#!/usr/bin/env node
// ============================================================
// PUBLICAREA PE dez.ro, DIN TERMINAL
//
// Geamănul ecranului din Admin → Anunțuri dez.ro, cu ACELAȘI motor
// (`lib/dezro/`). Nicio regulă nu e scrisă aici: dacă adaugi una, o adaugi în
// motor, altfel cele două căi se despart în timp — lecția de la importul din
// pieseauto.ro.
//
// CÂND SE FOLOSEȘTE ASTA ȘI CÂND ECRANUL
// Ecranul cere un lot pe HTTP, deci fiecare lot reciteste catalogul lor și
// mapările — la prima publicare, cea a tuturor celor ~8.700 de piese, sunt vreo
// 350 de loturi. Scriptul citește totul o dată și merge până la capăt.
// Deci: PRIMA publicare mare se face de aici; ecranul e pentru întreținerea de
// zi cu zi (piese noi, prețuri schimbate, anunțuri de retras).
//
// CUM SE RULEAZĂ
//   node scripts/publica-dezro.mjs                 # totul: publicare + retragere
//   node scripts/publica-dezro.mjs --catalog       # doar aduce catalogul lor
//   node scripts/publica-dezro.mjs --potriveste    # doar potrivirea automată
//   node scripts/publica-dezro.mjs --uscat         # spune ce ar face, fără să trimită
//   node scripts/publica-dezro.mjs --limita=50     # se oprește după 50 de piese
//   node scripts/publica-dezro.mjs --doar-cu-oem   # doar piesele care au deja cod OEM
//   node scripts/publica-dezro.mjs --fara-retragere
//
// Are nevoie de NEXT_PUBLIC_SUPABASE_URL și SUPABASE_SERVICE_ROLE_KEY în mediu
// (sau în .env.local). Cheia dez.ro, utilizatorul și parola se citesc din
// `settings.integrari.dezro`, ca și în ruta de server — un singur loc.
// ============================================================
import fs from "node:fs";
import path from "node:path";
import {
  depozitDinMediu, sesiuneDin, lotCatalog, lotPublicare, lotRetragere,
  potrivesteTot, contextPublicare, construieste, PRAG_RETRAGERE, TIMEOUT_LUNG_MS,
} from "../lib/dezro/index.mjs";

// În terminal nu există limita de 60 de secunde a unei funcții serverless, deci
// lotul are voie să fie lung și cererea are voie să aștepte. Nu e un lux:
// măsurat pe contul real, API-ul lor a răspuns la o listare în 98 de secunde, iar
// o actualizare a expirat la 30 — deși ajunsese. Cu valorile din panou, o
// publicare mare la ore de vârf ar da eroare după eroare degeaba.
const LOT_TERMINAL = { limitaMs: 15 * 60_000, bugetMs: 10 * 60_000, timeout: TIMEOUT_LUNG_MS };

// .env.local, dacă rulezi din proiect
const caleEnv = path.join(process.cwd(), ".env.local");
if (fs.existsSync(caleEnv)) {
  for (const linie of fs.readFileSync(caleEnv, "utf8").split("\n")) {
    const t = linie.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    const k = t.slice(0, i).trim();
    if (!process.env[k]) process.env[k] = t.slice(i + 1).trim();
  }
}

const arg = (n) => process.argv.includes(`--${n}`);
const valoare = (n, implicit) => {
  const g = process.argv.find((a) => a.startsWith(`--${n}=`));
  return g ? g.split("=")[1] : implicit;
};

const USCAT = arg("uscat");
// Cât timp `completeaza-oem.mjs` încă rulează, catalogul e amestecat: unele piese
// au descrierea întreagă și codul, altele încă nu. Cu filtrul ăsta se trimit doar
// cele gata, iar restul la o rulare următoare — mai bine două rulări decât 8.000
// de anunțuri care ar trebui apoi actualizate unul câte unul.
const DOAR_CU_OEM = arg("doar-cu-oem");
const LIMITA = Number(valoare("limita", 0)) || 0;
const nr = (n) => new Intl.NumberFormat("ro-RO").format(n || 0);

async function main() {
  const depozit = depozitDinMediu();
  const cfg = await depozit.citesteConfig();
  if (!cfg.cheie) {
    console.error("Lipsește cheia API dez.ro. O pui din Admin → Integrări → dez.ro.");
    process.exit(1);
  }

  if (arg("catalog")) return await catalog(depozit, cfg);
  if (arg("potriveste")) return await potrivire(depozit);

  // Catalogul și potrivirile sunt condiții, nu opțiuni: fără ele nu se publică
  // nimic, iar un script care ar porni oricum ar raporta 8.700 de piese sărite.
  const catalogRanduri = await depozit.citesteCatalog();
  if (!catalogRanduri.length) {
    console.error("Catalogul dez.ro n-a fost adus. Rulează întâi: node scripts/publica-dezro.mjs --catalog");
    process.exit(1);
  }

  const stare = await depozit.stare();
  console.log(
    `Piese eligibile: ${nr(stare.eligibile)} · gata de trimis: ${nr(stare.gata)} · ` +
    `anunțuri active: ${nr(stare.anunturi_active)}`,
  );
  if (stare.gata < stare.eligibile) {
    console.log(
      `  ${nr(stare.eligibile - stare.gata)} nu se pot publica: ` +
      `${nr(stare.fara_poza)} fără poză, ${nr(stare.fara_model)} fără model, ` +
      `${nr(stare.model_nemapat)} model nemapat, ${nr(stare.categorie_nemapata)} categorie nemapată`,
    );
  }

  if (USCAT) return await uscat(depozit);

  if (!cfg.utilizator || !cfg.parola) {
    console.error("Lipsesc utilizatorul și parola dez.ro (Admin → Integrări).");
    process.exit(1);
  }

  const sesiune = sesiuneDin(cfg, depozit);
  const context = await contextPublicare(depozit);
  const t0 = Date.now();
  const total = { publicate: 0, actualizate: 0, neschimbate: 0, sarite: 0, poze: 0, erori: 0, retrase: 0 };
  const motive = {};
  let pozitie = 0;

  // ---------- publicarea ----------
  for (;;) {
    // `--limita` se respectă LA PIESĂ, nu la lot. Altfel „--limita=3" ar fi
    // trimis tot lotul de 25 — la o probă înaintea unei publicări mari, exact
    // surpriza pe care n-o vrei, fiindcă anunțurile plecate nu se pot lua înapoi.
    const facuteAcum = total.publicate + total.actualizate + total.neschimbate + total.sarite;
    const r = await lotPublicare({ cfg, depozit, sesiune, job: { pozitie }, context, ...LOT_TERMINAL,
      filtrePiese: DOAR_CU_OEM ? "oem=not.is.null&oem=neq." : "",
      ...(LIMITA ? { maxPiese: Math.max(1, LIMITA - facuteAcum) } : {}) });
    pozitie = r.pozitie;
    total.publicate += r.publicate;
    total.actualizate += r.actualizate;
    total.neschimbate += r.neschimbate;
    total.sarite += r.sarite;
    total.poze += r.poze;
    total.erori += r.erori.length;
    for (const [k, v] of Object.entries(r.motive)) motive[k] = (motive[k] ?? 0) + v;
    for (const e of r.erori) console.error(`  ! ${e.cod ?? e.id}: ${e.eroare}`);

    const facute = total.publicate + total.actualizate + total.neschimbate + total.sarite;
    process.stdout.write(
      `\r${nr(facute)} piese · ${nr(total.publicate)} noi · ${nr(total.actualizate)} actualizate · ` +
      `${nr(total.neschimbate)} neschimbate · ${nr(total.erori)} erori   `,
    );

    if (r.oprit) { console.log(`\nOprit: ${r.oprit}`); process.exit(1); }
    if (r.gata) break;
    if (LIMITA && facute >= LIMITA) { console.log(`\nM-am oprit la limita de ${LIMITA}.`); return raport(total, motive, t0); }
  }
  console.log("");

  // ---------- retragerea ----------
  // La o rulare parțială nu se retrage nimic: „lipsește din mulțimea publicată"
  // nu înseamnă „s-a vândut", iar pragul de 20% s-ar declanșa degeaba.
  if (!arg("fara-retragere") && !DOAR_CU_OEM) {
    const prag = await depozit.pragRetragere();
    if (prag.active > 0 && prag.procent > PRAG_RETRAGERE && !arg("confirm-retragere-mare")) {
      console.error(
        `\nS-ar retrage ${nr(prag.deRetras)} din ${nr(prag.active)} anunțuri ` +
        `(${(prag.procent * 100).toFixed(1)}%). Pare o depublicare în masă, nu vânzări.\n` +
        `La ei ștergerea NU se poate desface prin API. Dacă e corect, rulează din nou cu --confirm-retragere-mare.`,
      );
      return raport(total, motive, t0);
    }
    let p = 0;
    for (;;) {
      const r = await lotRetragere({ depozit, sesiune, job: { pozitie: p }, ...LOT_TERMINAL });
      p = r.pozitie;
      total.retrase += r.retrase;
      total.erori += r.erori.length;
      for (const e of r.erori) console.error(`  ! retragere ${e.id}: ${e.eroare}`);
      process.stdout.write(`\r${nr(total.retrase)} anunțuri retrase   `);
      if (r.oprit) { console.log(`\nOprit: ${r.oprit}`); break; }
      if (r.gata) break;
    }
    console.log("");
  }

  raport(total, motive, t0);
}

function raport(total, motive, t0) {
  const min = ((Date.now() - t0) / 60000).toFixed(1);
  console.log(
    `\nGata în ${min} min · ${nr(total.publicate)} anunțuri noi · ${nr(total.actualizate)} actualizate · ` +
    `${nr(total.neschimbate)} neatinse · ${nr(total.retrase)} retrase · ${nr(total.poze)} poze · ` +
    `${nr(total.erori)} erori`,
  );
  if (total.sarite) {
    console.log(`${nr(total.sarite)} piese sărite:`);
    for (const [m, n] of Object.entries(motive).sort((a, b) => b[1] - a[1])) console.log(`  · ${nr(n)} — ${m}`);
  }
}

async function catalog(depozit, cfg) {
  let pozitie = 0;
  for (;;) {
    const r = await lotCatalog({ cfg, depozit, job: { pozitie } });
    pozitie = r.pozitie;
    process.stdout.write(`\rCatalog: pasul ${pozitie}${r.total ? ` din ${r.total}` : ""}   `);
    if (r.gata) break;
  }
  const c = await depozit.citesteCatalog();
  console.log(
    `\nAdus: ${nr(c.filter((x) => x.fel === "marca").length)} mărci · ` +
    `${nr(c.filter((x) => x.fel === "model").length)} modele · ` +
    `${nr(c.filter((x) => x.fel === "piesa").length)} categorii`,
  );
}

async function potrivire(depozit) {
  const r = await potrivesteTot({ depozit, autor: "script" });
  console.log(`Potriviri scrise: ${nr(r.scrise)} · rămase de confirmat de om: ${nr(r.deConfirmat)}`);
  const peFel = {};
  for (const p of r.propuneri) peFel[p.fel] = (peFel[p.fel] ?? 0) + 1;
  for (const [f, n] of Object.entries(peFel)) console.log(`  · ${f}: ${nr(n)}`);
  console.log("Le confirmi din Admin → Anunțuri dez.ro → Potriviri de confirmat.");
}

/** Ce s-ar trimite, fără să se trimită. Merge fără cont dez.ro: nu atinge API-ul
 *  lor deloc, doar construiește câmpurile. Bun ca să se vadă cum arată o
 *  descriere înainte ca 8.700 de anunțuri să plece cu ea. */
async function uscat(depozit) {
  const context = await contextPublicare(depozit);
  const piese = await depozit.pieseEligibile(0, 5);
  for (const p of piese) {
    const c = construieste(p, context);
    console.log(`\n──────── ${p.cod_intern ?? p.id} ────────`);
    if (!c.ok) { console.log(`NU se publică: ${c.motiv}`); continue; }
    for (const [k, v] of Object.entries(c.campuri)) {
      const text = String(v ?? "");
      console.log(`${k.padEnd(12)} ${text.length > 200 ? text.slice(0, 200) + "…" : text}`);
    }
    console.log(`poze         ${(p.poze ?? []).length}`);
  }
}

main().catch((e) => { console.error("\n" + (e?.stack ?? e)); process.exit(1); });
