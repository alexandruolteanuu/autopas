#!/usr/bin/env node
// VERIFICĂ FLUXUL DE RETUR FAN, PE API-UL LOR REAL.
//
// DE CE (21 octombrie 2026)
// Returul merge pe un cont selfAWB OCAZIONAL, cu alt clientId, alt utilizator
// și altă parolă decât contul de livrare, cu expeditorul și destinatarul INVERS
// față de un AWB obișnuit, și cu o comandă de curier obligatorie pe lângă AWB.
// Nimic din toate astea nu se poate verifica citind codul: ori răspunde FAN, ori
// nu știm. De asta scriptul cheamă FUNCȚIILE NOASTRE (`lib/fancourier.ts`), nu
// endpoint-uri scrise încă o dată aici — o copie a payload-ului ar trece testul
// și ar lăsa codul real greșit.
//
// RULEAZĂ IMPLICIT PE CONTUL DE PROBĂ AL FAN, cel din anexa lor
// (docs/fancourier/…anexa1.pdf): clienttest@fancourier.ro / testareFAN / 323245.
// Deci merge ÎNAINTE ca firma să aibă cont ocazional propriu. Pe contul real se
// rulează punând variabilele de mediu:
//   FANCOURIER_RETUR_CLIENT_ID=… FANCOURIER_RETUR_USER=… FANCOURIER_RETUR_PASS=… \
//   node scripts/verifica-retur-fan.mjs
//
// CE CREEAZĂ ȘI CE CURĂȚĂ
// Creează un AWB de probă și o comandă de curier, apoi le ȘTERGE pe amândouă.
// Dacă scriptul e întrerupt la mijloc, AWB-ul rămâne la FAN: numărul lui se
// scrie la fiecare pas, ca să poată fi șters de mână din selfawb.ro.
// Nu atinge baza de date a site-ului.
//
// Cere `typescript` (e deja în proiect): compilează lib/fancourier.ts într-un
// folder temporar `.tmp-fan/`, pe care îl șterge la final.
import { execFileSync } from "node:child_process";
import { rmSync, existsSync } from "node:fs";
import { createRequire } from "node:module";

const TMP = ".tmp-fan";
const require_ = createRequire(import.meta.url);

// Contul de probă din anexa FAN. Se schimbă cu variabile de mediu.
process.env.FANCOURIER_RETUR_CLIENT_ID ||= "323245";
process.env.FANCOURIER_RETUR_USER ||= "clienttest@fancourier.ro";
process.env.FANCOURIER_RETUR_PASS ||= "testareFAN";
const CONT_DE_PROBA = process.env.FANCOURIER_RETUR_CLIENT_ID === "323245";

let picate = 0;
const verifica = (ce, cond, detaliu = "") => {
  console.log(`${cond ? "✓" : "✗"} ${ce}${detaliu ? ` — ${detaliu}` : ""}`);
  if (!cond) picate++;
};

// ---------- compilarea ----------
// În PROIECT, nu în /tmp: altfel Node nu găsește `@supabase/supabase-js`.
console.log("Se compilează lib/fancourier.ts…");
rmSync(TMP, { recursive: true, force: true });
// `--incremental false`: altfel `tsc` rescrie `tsconfig.tsbuildinfo` din
// proiect, iar o simplă verificare ar lăsa un fișier modificat în git.
execFileSync("npx", ["tsc", "lib/fancourier.ts", "--outDir", TMP, "--module", "commonjs",
  "--target", "es2020", "--moduleResolution", "node", "--skipLibCheck", "--esModuleInterop",
  "--incremental", "false"],
  { stdio: "inherit" });
const fan = require_(`${process.cwd()}/${TMP}/fancourier.js`);

// Clientul care returnează. Adresă REALĂ (altfel FAN refuză localitatea), dar
// persoană inventată — e o probă, nu o expediție.
const CLIENT = {
  nume: "Proba Retur", telefon: "0723456789", email: null,
  judet: "Cluj", localitate: "Cluj-Napoca", strada: "Strada Memorandumului nr. 28",
};
const COLET = {
  colete: 1, greutate: 2, lungime: 40, latime: 30, inaltime: 20,
  observatii: "Proba tehnica — se sterge", referinta: "AP-PROBA",
};

let awb = null, comandaCurier = null, cfg = null;
try {
  // ---------- 1. configurarea ----------
  cfg = await fan.configFanRetur();
  verifica("contul de retur se citește", fan.returConfigurat(cfg),
    `clientId ${cfg.clientId}${CONT_DE_PROBA ? " (contul de probă al FAN)" : " (cont propriu)"}`);
  verifica("`payment` nu e hardcodat, vine din configurare", typeof cfg.payment === "string" && cfg.payment.length > 0,
    `payment="${cfg.payment}"`);

  const dep = await fan.depozitRetur();
  // Județul și localitatea trebuie scrise ca la FAN. O greșeală aici trimite
  // TOATE retururile în altă parte, iar la prima rulare nu s-ar vedea.
  verifica("depozitul are județ și localitate fără diacritice",
    dep.judet === fan.faraDiacritice(dep.judet) && dep.localitate === fan.faraDiacritice(dep.localitate),
    `${dep.localitate}, jud. ${dep.judet}`);
  verifica("depozitul are stradă și telefon", !!dep.strada && !!dep.telefon, `${dep.strada} · ${dep.telefon}`);

  // ---------- 2. intervalul de ridicare ----------
  // FAN cere minimum 2 ore între capete (măsurat: un interval de o oră dă 422).
  const [h1, h2] = [fan.INTERVAL_RIDICARE.first, fan.INTERVAL_RIDICARE.second].map((t) => Number(t.slice(0, 2)));
  verifica("intervalul de ridicare are cel puțin 2 ore", h2 - h1 >= 2,
    `${fan.INTERVAL_RIDICARE.first}–${fan.INTERVAL_RIDICARE.second}`);
  // 14:00 e capătul cel mai devreme din cele patru intervale ale lor (localitate
  // exterioară cu km taxabili). Peste el, ridicarea ar fi refuzată la unii clienți.
  verifica("intervalul se termină cel târziu la 14:00, ca să fie valid oriunde", h2 <= 14);

  // ---------- 3. conexiunea ----------
  const { servicii } = await fan.verificaReturul();
  verifica("contul răspunde și are serviciul Standard", servicii.includes("Standard"),
    `${servicii.length} servicii`);

  // ---------- 4. tariful ----------
  const tarif = await fan.tarifRetur(CLIENT, COLET, cfg, dep);
  verifica("tariful returului se calculează", tarif.total > 0,
    `${tarif.total.toFixed(2)} lei cu TVA (${tarif.faraTva.toFixed(2)} fără)`);

  // ---------- 5. AWB-ul + comanda de curier ----------
  const maine = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  const r = await fan.genereazaAwbRetur(CLIENT, COLET, maine, cfg, dep);
  awb = r.awb; comandaCurier = r.comandaCurierId;
  console.log(`   [de curățat: AWB ${awb}${comandaCurier ? `, comanda de curier ${comandaCurier}` : ""}]`);
  verifica("AWB-ul de retur se generează", !!r.awb, `AWB ${r.awb}, tarif ${r.tarif} lei`);
  verifica("comanda de curier se plasează odată cu AWB-ul", !!r.comandaCurierId && !r.eroareCurier,
    r.eroareCurier ?? `comanda ${r.comandaCurierId}`);
  verifica("AWB-ul vine cu link de urmărire", /^https?:\/\//.test(r.tracking ?? ""));

  // ---------- 6. eticheta, pe contul OCAZIONAL ----------
  // Cu contul cu contract, FAN n-ar recunoaște AWB-ul — de asta `etichetaAwb`
  // primește configurarea ca parametru.
  const pdf = await fan.etichetaAwb(awb, { clientId: cfg.clientId, user: cfg.user, parola: cfg.parola, rambursInCont: false });
  const antet = Buffer.from(pdf.slice(0, 4)).toString();
  verifica("eticheta vine ca PDF", antet === "%PDF" && pdf.byteLength > 1000, `${pdf.byteLength} octeți`);
} catch (e) {
  verifica("fluxul de retur merge până la capăt", false, e?.message ?? String(e));
} finally {
  // ---------- 7. curățenia ----------
  // Rulează ORICUM, inclusiv după o eroare: un AWB de probă rămas la FAN e
  // gunoi în borderoul lor.
  if (cfg && comandaCurier) {
    try {
      const x = await fan.anuleazaComandaCurier(comandaCurier, cfg);
      verifica("comanda de curier de probă se anulează", true, x);
    } catch (e) { verifica("comanda de curier de probă se anulează", false, e?.message ?? String(e)); }
  }
  if (cfg && awb) {
    try {
      const x = await fan.stergeAwb(awb, { clientId: cfg.clientId, user: cfg.user, parola: cfg.parola, rambursInCont: false });
      verifica("AWB-ul de probă se șterge", x === "sters" || x === "nu_exista", x);
    } catch (e) {
      verifica("AWB-ul de probă se șterge", false,
        `${e?.message ?? e} — ȘTERGE-L DE MÂNĂ din selfawb.ro: ${awb}`);
    }
  }
  if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true });
}

console.log(picate === 0 ? "\nTOATE AU TRECUT" : `\n${picate} VERIFICĂRI PICATE`);
process.exit(picate === 0 ? 0 : 1);
