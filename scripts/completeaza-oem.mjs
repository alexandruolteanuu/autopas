// ============================================================
// COMPLETEAZĂ CODUL PIESEI (`oem`) ȘI REPARĂ DESCRIERILE TĂIATE
//
// DE CE E NEVOIE (7 septembrie 2026)
// Descrierea se lua din pagină până la PRIMUL `</div>`, iar sursa își scrie
// paragrafele în `<div>`-uri imbricate. Măsurat pe 40 de pagini luate din tot
// catalogul: **17 descrieri din 40 erau tăiate** — una de la 386 de caractere la
// 84. Rândul „COD: …", care stă mai jos în text, cădea aproape întotdeauna în
// partea pierdută: în bază aveau „COD:" doar 455 de piese din 8.965.
//
// `lib/import/extragere.mjs` e reparat, deci piesele importate DE ACUM ÎNAINTE
// intră cu descrierea întreagă și cu `oem` completat. Piesele vechi nu se repară
// singure: un re-import atinge doar prețul, numele și `sursa_activ`
// (`COLOANE_LA_REIMPORT`), fiindcă descrierea e considerată muncă de operator.
// Scriptul ăsta le aduce la zi, o singură dată.
//
// CE FACE, PENTRU FIECARE PIESĂ
//   1. cere din nou pagina de la sursă (nu există altă cale: codul nu e în baza
//      noastră, tocmai pentru că se pierdea la extragere);
//   2. scoate codul din descriere și îl scrie în `oem`, dacă a găsit unul;
//   3. repară descrierea, dar NUMAI dacă cea salvată e chiar începutul celei noi.
//
// DE CE REGULA PREFIXULUI, la punctul 3
// Descrierea e „muncă de operator" și nu se suprascrie niciodată orbește. Dar o
// descriere TĂIATĂ e, literalmente, începutul celei întregi — dacă textul salvat
// e prefixul celui citit acum, e sigur că a venit de la sursă și că i s-a tăiat
// coada. Dacă operatorul a rescris-o, nu mai e prefix, iar scriptul o lasă în
// pace. Verificat pe 8 piese reale înainte de a scrie regula: la toate opt,
// textul vechi era exact începutul celui nou.
// Piesele cu `editat_manual` nu se ating deloc, nici la descriere, nici la cod.
//
// CÂT DUREAZĂ
// O cerere pe piesă, cu pauza politicoasă obișnuită (~2 secunde). La 8.965 de
// piese înseamnă aproximativ 5 ore. Se poate opri oricând cu Ctrl-C și relua cu
// `--de-la=<ultimul id>`; scriptul îl scrie la fiecare 50 de piese și la ieșire.
//
//   node scripts/completeaza-oem.mjs                  # doar raportează
//   node scripts/completeaza-oem.mjs --scrie
//   node scripts/completeaza-oem.mjs --scrie --de-la=4200
//   node scripts/completeaza-oem.mjs --limita=30      # o probă scurtă
//   node scripts/completeaza-oem.mjs --peste-tot      # și piesele care au deja cod
//   node scripts/completeaza-oem.mjs --din-baza       # fără rețea: doar din ce avem
// ============================================================
import fs from "node:fs";
import path from "node:path";
import {
  depozitDinMediu, SURSA, aducePagina, extrage, codOem, pauzaPoliticoasa,
} from "../lib/import/index.mjs";

// .env.local, dacă rulezi din proiect (ca la scripts/publica-dezro.mjs).
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

const SCRIE = arg("scrie");
const DIN_BAZA = arg("din-baza");
const PESTE_TOT = arg("peste-tot");
const DE_LA = Number(valoare("de-la", 0)) || 0;
const LIMITA = Number(valoare("limita", 0)) || 0;

const nr = (n) => new Intl.NumberFormat("ro-RO").format(n || 0);
const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

const depozit = depozitDinMediu();
let piese = await depozit.citesteTotPentruOem(SURSA);
piese = piese.filter((p) => p.id > DE_LA).sort((a, b) => a.id - b.id);
if (!PESTE_TOT) piese = piese.filter((p) => !String(p.oem ?? "").trim());
if (LIMITA) piese = piese.slice(0, LIMITA);

console.log(
  `${nr(piese.length)} piese de parcurs${DE_LA ? ` (de la id ${DE_LA})` : ""}` +
  `${DIN_BAZA ? "  ·  DIN BAZĂ: nu se cere nicio pagină" : ""}` +
  `${SCRIE ? "" : "  ·  MOD RAPORT: nu se scrie nimic"}\n`,
);
if (!DIN_BAZA) {
  const ore = ((piese.length * 2.1) / 3600).toFixed(1);
  console.log(`Cu pauza politicoasă, durează aproximativ ${ore} ore. Ctrl-C oprește; se reia cu --de-la.\n`);
}

let cuCod = 0, faraCod = 0, descrieriReparate = 0, sarite = 0, esecuri = 0, parcurse = 0;
let ultimulId = DE_LA;
const exemple = [];

// Ctrl-C: spune de unde se reia. Fără linia asta, o oprire la ora a treia ar
// însemna să se ia totul de la capăt.
const laIesire = () => {
  console.log(
    `\n\nOprit după ${nr(parcurse)} piese. Reia cu:  node scripts/completeaza-oem.mjs${SCRIE ? " --scrie" : ""} --de-la=${ultimulId}`,
  );
  process.exit(0);
};
process.on("SIGINT", laIesire);

for (const p of piese) {
  parcurse++;
  ultimulId = p.id;

  // Piesele atinse de un om nu se schimbă, nici la cod, nici la descriere.
  if (p.editat_manual) { sarite++; continue; }

  let descriere = p.stare_nota ?? "";
  if (!DIN_BAZA) {
    if (!p.sursa_url) { sarite++; continue; }
    const pag = await aducePagina(p.sursa_url);
    if (!pag.ok) {
      esecuri++;
      console.log(`  ! ${p.cod_intern ?? p.id}: ${pag.eroare ?? "pagina n-a venit"}`);
      await pauzaPoliticoasa();
      continue;
    }
    descriere = extrage(pag.html, pag.urlFinal).descriere ?? "";
  }

  const cod = codOem(descriere);
  const patch = {};
  if (cod && cod !== (p.oem ?? "")) patch.oem = cod;

  // Regula prefixului — vezi antetul.
  const vechi = norm(p.stare_nota);
  const nou = norm(descriere);
  if (!DIN_BAZA && nou.length > vechi.length && (vechi === "" || nou.startsWith(vechi))) {
    patch.stare_nota = descriere;
    descrieriReparate++;
  }

  if (cod) {
    cuCod++;
    if (exemple.length < 12) exemple.push(`${p.cod_intern ?? p.id}: ${cod}`);
  } else {
    faraCod++;
  }

  if (Object.keys(patch).length && SCRIE) await depozit.actualizeazaPiesa(p.id, patch);

  if (parcurse % 25 === 0) {
    process.stdout.write(
      `\r${nr(parcurse)}/${nr(piese.length)} · ${nr(cuCod)} cu cod · ` +
      `${nr(descrieriReparate)} descrieri reparate · ${nr(esecuri)} eșecuri · ultimul id ${ultimulId}   `,
    );
  }
  if (!DIN_BAZA) await pauzaPoliticoasa();
}

console.log(
  `\n\n${nr(parcurse)} piese parcurse\n` +
  `  ${nr(cuCod)} au cod în descriere\n` +
  `  ${nr(faraCod)} n-au — rămân cu câmpul gol, cum trebuie\n` +
  `  ${nr(descrieriReparate)} descrieri tăiate reparate\n` +
  `  ${nr(sarite)} sărite (editate manual sau fără adresă la sursă)\n` +
  `  ${nr(esecuri)} pagini n-au venit`,
);
if (exemple.length) console.log(`\nExemple de coduri găsite:\n  ${exemple.join("\n  ")}`);
console.log(SCRIE ? "\nScris în bază." : "\nNimic nu s-a scris. Rulează din nou cu --scrie ca să aplici.");
