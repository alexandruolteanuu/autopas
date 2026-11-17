// ============================================================
// CELE TREI TESTE ESENȚIALE ALE PASULUI 13 (lib/saga-emitere.mjs, migrarea 60)
//
// Fără rețea și fără bază: clientul SAGA ADEVĂRAT (lib/saga-api.mjs) cu un `fetch`
// simulat, plus depozitul facturilor imitat în memorie (aceleași reguli ca funcțiile
// din migrarea 60: lacătul, renumerotarea cu contorul, încercările).
//   (a) emitere normală → emisă, un singur apel, numărul neschimbat;
//   (b) „operata manual deja” fără încercare anterioară → renumerotare (contor +1),
//       retrimitere cu numărul nou, emisă;
//   (c) o încercare fără răspuns (timeout), apoi „operata manual deja” pe același număr
//       → emisă, FĂRĂ renumerotare.
// Textul „deja” e cel real, din jurnalul SAGA (PAP FE 14210, 11.11.2026, HTTP 422).
//
// Folosire: node scripts/verifica-saga-emitere-un-buton.mjs   (iese cu cod 1 la prima picată)
// ============================================================
import { creeazaClientSaga } from "../lib/saga-api.mjs";
import { lucreazaFactura } from "../lib/saga-emitere.mjs";

let n = 0;
function ok(cond, ce) { if (!cond) { console.error(`PICAT: ${ce}`); process.exit(1); } n++; console.log(`ok   ${ce}`); }

const SETARI = { format_numar: "serie_spatiu", format_data: "zi-luna-an", tva_la_incasare: "nu", import_automat: "da" };
const raportDeja = (nr) => `Raport Import F_RO36608590_${nr.replace(/ /g, "_")}_17_11_2026\n\nFactura 1.\n     NR_DOC: ${nr}\n     Eroare antet: Factura a fost importata sau operata manual deja.`;

// ---------- depozitul cheii (pentru clientul SAGA) ----------
function depozitCheie() {
  let pana = -Infinity;
  return {
    iaBlocarea: async (_id, sec) => { if (pana >= Date.now()) return false; pana = Date.now() + sec * 1000; return true; },
    elibereaza: async () => { pana = -Infinity; },
    citesteCheia: async () => "CHEIE-SIMULATA", rotesteCheia: async () => true,
    marcheazaFolosita: async () => {}, marcheazaBlocata: async () => {}, jurnal: async () => {},
  };
}

// ---------- SAGA simulat: fiecare apel primește răspunsul următor din listă ----------
function sagaSimulat(raspunsuri) {
  const apeluri = [];
  const fetch = async (_url, init) => {
    const fisier = init.body.get("file").name;
    apeluri.push({ fisier, automat: init.body.get("importAutomat") });
    const r = raspunsuri.shift();
    if (r === "timeout") return new Promise((_, nu) => init.signal.addEventListener("abort", () => nu(new Error("aborted"))));
    return new Response(r.corp, { status: r.status });
  };
  return { apeluri, client: creeazaClientSaga({ depozit: depozitCheie(), url: "http://127.0.0.1/api/v1", cif: "RO36608590", fetch, timeoutMs: 50 }) };
}

// ---------- depozitul facturilor, imitat (regulile din migrarea 60) ----------
function depozitFacturi({ numar = 14296, urmator = 14297 } = {}) {
  const db = {
    serie: { urmator },
    f: {
      id: 77, tip: "factura", serie: "PAP FE", numar, data: "2026-11-17", scadenta: "2026-11-17",
      saga_status: "se_trimite", saga_eroare: null, renumerotari: 0, reincercari: 0, reincearca_la: null,
      lacat_de: "TOKEN-1", lacat_pana: Date.now() + 120_000,
      mentiune_plata: "ramburs in cont", observatii: "Comanda AP-2026-01900",
      furnizor: { denumire: "PIESE AUTO PAS SRL", cui: "RO 36608590", cod_judet: "NT", tara: "RO" },
      client: { tip: "pf", nume: "Ion Test", adresa: "Str. 1", localitate: "Bacău", cod_judet: "BC", tara: "RO" },
      linii: [{ nr_crt: 1, descriere: "FAR", cod_articol_saga: "1457070031", denumire_site: "Far stânga", um: "BUC",
                cantitate: 1, pret_fara_tva: 165.29, valoare: 165.29, cota_tva: 21, tva: 34.71, total: 200 }],
    },
    incercari: [],
  };
  const d = {
    db,
    acum: () => Date.now(),
    async ia(id, token) {
      const f = db.f;
      if (f.saga_status !== "se_trimite") return null;
      const libera = (!f.lacat_pana || f.lacat_pana < d.acum()) && (!f.reincearca_la || Date.parse(f.reincearca_la) <= d.acum());
      if ((token && f.lacat_de === token) || libera) { f.lacat_de = token ?? "TOKEN-CEAS"; f.lacat_pana = d.acum() + 120_000; return f.lacat_de; }
      return null;
    },
    async citesteFactura() { return JSON.parse(JSON.stringify(db.f)); },
    async incepeIncercare(r) { db.incercari.push({ ...r, id: db.incercari.length + 1, stare: "in_curs" }); return db.incercari.length; },
    async terminaIncercare(id, c) { Object.assign(db.incercari[id - 1], c); },
    async areFaraRaspuns(fid, serie, numar, exceptId) {
      return db.incercari.some((i) => i.factura_id === fid && i.serie === serie && i.numar === numar
        && ["in_curs", "fara_raspuns"].includes(i.stare) && i.id !== exceptId);
    },
    async renumeroteaza(_id, token) {
      if (db.f.lacat_de !== token) throw new Error("token");
      const nou = Math.max(db.serie.urmator, db.f.numar + 1);
      db.f.numar = nou; db.f.renumerotari++; db.serie.urmator = nou + 1;
      return { numar: nou };
    },
    async elibereaza() { throw new Error("nu trebuia eliberată"); },
    async seteaza(_id, token, c) { if (db.f.lacat_de !== token) throw new Error("lacăt pierdut"); Object.assign(db.f, c); },
  };
  return d;
}

// (a) EMITERE NORMALĂ
{
  const dep = depozitFacturi();
  const s = sagaSimulat([{ status: 200, corp: '{"success":true}' }]);
  const r = await lucreazaFactura({ id: 77, token: "TOKEN-1", client: s.client, depozit: dep, setariSaga: SETARI, de: "u-1" });
  ok(r.stare === "confirmata" && r.numar === 14296, "(a) emitere normală → emisă, PAP FE 14296");
  ok(s.apeluri.length === 1 && s.apeluri[0].automat === "true" && s.apeluri[0].fisier.includes("14296"),
    "(a) un singur POST /Import, cu importAutomat=true, pe numărul alocat");
  ok(dep.db.serie.urmator === 14297 && dep.db.f.lacat_de === null && dep.db.incercari[0].stare === "raspuns",
    "(a) contorul neatins, lacătul eliberat, încercarea jurnalizată cu răspuns");
}

// (b) „NUMĂR EXISTENT” FĂRĂ ÎNCERCARE ANTERIOARĂ → RENUMEROTARE
{
  const dep = depozitFacturi();
  const s = sagaSimulat([{ status: 422, corp: raportDeja("PAP FE 14296") }, { status: 200, corp: '{"success":true}' }]);
  const r = await lucreazaFactura({ id: 77, token: "TOKEN-1", client: s.client, depozit: dep, setariSaga: SETARI });
  ok(r.stare === "confirmata" && r.numar === 14297, "(b) 14296 era manuală → factura emisă ca PAP FE 14297");
  ok(s.apeluri.length === 2 && s.apeluri[1].fisier.includes("14297"), "(b) retrimisă automat, în aceeași cerere, cu numărul nou");
  ok(dep.db.serie.urmator === 14298 && dep.db.f.renumerotari === 1, "(b) contorul seriei actualizat (14298), o renumerotare");
}

// (c) ÎNCERCARE FĂRĂ RĂSPUNS, APOI „NUMĂR EXISTENT” → A NOASTRĂ, FĂRĂ RENUMEROTARE
{
  const dep = depozitFacturi();
  const s = sagaSimulat(["timeout", { status: 422, corp: raportDeja("PAP FE 14296") }]);
  const r1 = await lucreazaFactura({ id: 77, token: "TOKEN-1", client: s.client, depozit: dep, setariSaga: SETARI });
  ok(r1.stare === "se_trimite" && dep.db.incercari[0].stare === "fara_raspuns" && dep.db.f.reincearca_la,
    "(c) timeout → rămâne „se_trimite”, încercarea „fără răspuns”, reîncercare programată");
  dep.acum = () => Date.now() + 2 * 60_000;                          // ceasul, după pauză
  const r2 = await lucreazaFactura({ id: 77, client: s.client, depozit: dep, setariSaga: SETARI, acum: dep.acum, pana: dep.acum() + 40_000 });
  ok(r2.stare === "confirmata" && r2.numar === 14296, "(c) „deja” după încercarea fără răspuns → emisă, tot PAP FE 14296");
  ok(dep.db.f.renumerotari === 0 && dep.db.serie.urmator === 14297 && s.apeluri.every((a) => a.fisier.includes("14296")),
    "(c) fără renumerotare, contorul neatins, ambele trimiteri pe același număr");
}

console.log(`\nREZULTAT OK: ${n} verificări (3 teste).`);
