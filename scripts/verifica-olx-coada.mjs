// ============================================================
// VERIFICĂRILE COZII OLX (pasul 3, lib/olx-coada.mjs) — fără rețea și fără bază:
// OLX și depozitul sunt imitații în memorie. Se rulează oricând:
//   node scripts/verifica-olx-coada.mjs
// Iese cu cod 1 la prima verificare picată.
// Verifică: decizia pe fiecare caz, ce cereri pleacă (și că nu pleacă niciuna când nu s-a
// schimbat nimic), retragerea (deactivate vândut / ascuns, finish pe neplătit, 404),
// reactivarea, piesa ștearsă, erorile și oprirea lotului, bugetul, plasa de 20%, „Adu la zi”,
// lista închisă de apeluri și potrivirea dintre SQL (triggerul, stările) și cod.
// ============================================================
import { readFileSync } from "node:fs";
import { decide, lotCoada, prag, diferente, STARI_VII, BUGET_MS, TIMEOUT_COADA_MS, PRAG_RETRAGERE } from "../lib/olx-coada.mjs";
import { apelPermis, EroareOlx } from "../lib/olx-api.mjs";
import { construiesteAnunt } from "../lib/olx-anunt.mjs";

let n = 0;
const ok = (cond, ce) => { n++; if (!cond) { console.error(`PICAT: ${ce}`); process.exit(1); } console.log(`ok   ${ce}`); };

// ---------- imitațiile ----------
const ctx = {
  mapari: new Map([[1, { olx_categorie_id: 100, atribute: [] }]]),
  categoriiOlx: new Map([[100, { photos_limit: 8, atribute: [], cale: "Auto › Piese" }]]),
  setari: { city_id: 1, contact_nume: "Autopas" }, siteUrl: "https://site.test", poza: (u) => u,
};
const piesaNoua = (id, x = {}) => ({ id, nume: `Far stanga Golf 5 piesa ${id}`, slug: `far-${id}`, stare_nota: "Far in stare buna, fara fisuri, testat.",
  ani: "2004–2008", compat: ["VW Golf 5"], oem: "1K6941005", cod_intern: `AP-${String(id).padStart(6, "0")}`, pret_lei: 300, pret_sufix: null,
  poze: ["https://x/p.webp"], stoc: 1, publicat: true, categorie_id: 1, subcategorie_id: null, ...x });

function lume() {
  const piese = new Map(), anunturi = [], coada = new Map(), olx = new Map(), apeluri = [];
  let urmAdvert = 900, urmRand = 1;
  const dupaPiesa = (id) => anunturi.find((a) => a.product_id === id) ?? null;
  const depozit = {
    citeste: async (id) => dupaPiesa(id),
    revendica: async (id, cod) => { if (dupaPiesa(id)?.advert_id) return false; if (!dupaPiesa(id)) anunturi.push({ id: urmRand++, product_id: id, cod_intern: cod, status: "in_curs", created_at: new Date().toISOString() }); return true; },
    scrie: async (id, c) => { const a = dupaPiesa(id); if (!a) throw new Error("scrie: lipsă"); Object.assign(a, c); },
    faraExternalUrl: async () => {}, faraCurier: async () => {},
    piesa: async (id) => piese.get(id) ?? null,
    anuntDupaPiesa: async (id) => dupaPiesa(id),
    anuntDupaAdvert: async (ad) => anunturi.find((a) => a.advert_id === ad) ?? null,
    scrieDupaAdvert: async (ad, c) => { const a = anunturi.find((x) => x.advert_id === ad); if (!a) throw new Error("scrieDupaAdvert: lipsă"); Object.assign(a, c); },
    coadaSterge: async (id) => { coada.delete(id); },
    coadaEsec: async (id, eroare, incercari) => { Object.assign(coada.get(id), { eroare, incercari }); },
  };
  const client = {
    cere: async ({ metoda = "GET", cale, corp }) => {
      if (!apelPermis(metoda, cale, corp)) throw new EroareOlx(`nepermis ${metoda} ${cale}`, { cod: "nepermis" });
      apeluri.push(`${metoda} ${cale.split("?")[0]}${corp?.command ? ` ${corp.command}${corp.command === "deactivate" ? `:${corp.is_success}` : ""}` : ""}`);
      if (lume.esec) { const e = lume.esec; lume.esec = null; throw e; }
      let m;
      if (metoda === "GET" && cale.startsWith("/adverts?")) return { status: 200, json: { data: [] } };
      if (metoda === "POST" && cale === "/adverts") { const id = urmAdvert++; olx.set(id, { id, status: "limited", url: `https://olx/${id}` }); return { status: 200, json: { data: olx.get(id) } }; }
      if ((m = cale.match(/^\/adverts\/(\d+)$/))) {
        const ad = olx.get(Number(m[1]));
        if (!ad) throw new EroareOlx("OLX (HTTP 404)", { cod: "404", status: 404 });
        if (metoda === "PUT") return { status: 200, json: { data: ad } };
        return { status: 200, json: { data: ad } };
      }
      if ((m = cale.match(/^\/adverts\/(\d+)\/commands$/))) {
        const ad = olx.get(Number(m[1]));
        if (corp.command === "deactivate") { if (ad.status !== "active") throw new EroareOlx("Primul pas este ca anuntul sa fie activ", { cod: "olx", status: 400 }); ad.status = "removed_by_user"; }
        if (corp.command === "finish") { if (ad.status !== "limited") throw new EroareOlx("finish doar pe limited", { cod: "olx", status: 400 }); ad.status = "removed_by_user"; }
        if (corp.command === "activate") ad.status = "limited";
        return { status: 204, json: null };
      }
      throw new Error(`imitația nu știe ${metoda} ${cale}`);
    },
  };
  const pune = (r) => { const id = urmRand++; coada.set(id, { id, incercari: 0, motiv: "test", ...r }); return id; };
  const lot = (o = {}) => lotCoada({ randuri: [...coada.values()].filter((r) => r.incercari < 5), ctx, client, depozit, pauzaMs: 0, ...o });
  return { piese, anunturi, coada, olx, apeluri, depozit, client, pune, lot, dupaPiesa };
}

// ---------- 1. decizia ----------
const an = (x) => ({ advert_id: 5, status: "limited", amprenta: "A", retras_la: null, ...x });
ok(decide(piesaNoua(1), null, undefined) === "publica", "decizie: piesă de vânzare fără anunț → publică");
ok(decide(piesaNoua(1), { advert_id: null, status: "eroare" }, undefined) === "publica", "decizie: rând fără advert_id (eroare) → publică din nou");
ok(decide(piesaNoua(1), an(), "A") === "nimic", "decizie: anunț viu, aceeași amprentă → nimic");
ok(decide(piesaNoua(1), an(), "B") === "actualizeaza", "decizie: amprentă diferită → actualizează");
ok(decide(piesaNoua(1), an(), null) === "actualizeaza", "decizie: anunțul nu se poate genera → actualizează (aruncă motivele, la vedere)");
ok(decide(piesaNoua(1), an({ retras_la: "x" }), "A") === "reactiveaza", "decizie: anunț retras, piesa a revenit → reactivează");
ok(decide(piesaNoua(1), an({ status: "outdated" }), "A") === "reactiveaza", "decizie: anunț expirat, piesa de vânzare → reactivează");
ok(decide(piesaNoua(1, { stoc: 0 }), an(), "A") === "retrage", "decizie: vândută cu anunț viu → retrage");
ok(decide(piesaNoua(1, { publicat: false }), an({ status: "active" }), "A") === "retrage", "decizie: ascunsă cu anunț activ → retrage");
ok(decide(null, an(), "A") === "retrage", "decizie: piesă inexistentă cu anunț viu → retrage");
ok(decide(piesaNoua(1, { stoc: 0 }), an({ retras_la: "x" }), "A") === "nimic", "decizie: deja retras → nimic");
ok(decide(piesaNoua(1, { stoc: 0 }), an({ status: "removed_by_user" }), "A") === "nimic", "decizie: anunț deja inactiv → nimic");
ok(decide(piesaNoua(1, { stoc: 0 }), null, undefined) === "nimic", "decizie: vândută fără anunț → nimic");

// ---------- 2. lista închisă ----------
ok(apelPermis("POST", "/adverts/5/commands", { command: "finish" }), "lista închisă: `finish` permis");
ok(!apelPermis("POST", "/adverts/5/commands", { command: "extend" }), "lista închisă: `extend` refuzat");
ok(!apelPermis("DELETE", "/adverts/5"), "lista închisă: DELETE refuzat");
ok(!apelPermis("POST", "/paid-features"), "lista închisă: promovările refuzate");

// ---------- 3. publicare, apoi nimic, apoi preț ----------
{
  const L = lume();
  L.piese.set(1, piesaNoua(1));
  L.pune({ product_id: 1 });
  let r = await L.lot();
  ok(r.publicate === 1 && r.facute === 1 && L.coada.size === 0, "piesă nouă: publicată, rândul a ieșit din coadă");
  ok(L.apeluri.join("|") === "GET /adverts|POST /adverts", `piesă nouă: o căutare + un POST (${L.apeluri.join("|")})`);
  ok(!!L.dupaPiesa(1).advert_id && L.dupaPiesa(1).amprenta === construiesteAnunt(L.piese.get(1), ctx).amprenta, "piesă nouă: advert_id și amprenta salvate");
  L.apeluri.length = 0; L.pune({ product_id: 1 });
  r = await L.lot();
  ok(r.nimic === 1 && L.apeluri.length === 0, "modificare fără efect în anunț: ZERO cereri la OLX");
  L.piese.get(1).pret_lei = 350; L.pune({ product_id: 1 });
  r = await L.lot();
  ok(r.actualizate === 1 && L.apeluri.join("|") === "PUT /adverts/900", `preț schimbat: un singur PUT (${L.apeluri.join("|")})`);
  L.apeluri.length = 0; L.pune({ product_id: 1 });
  await L.lot();
  ok(L.apeluri.length === 0, "după PUT amprenta e nouă: a doua procesare nu mai trimite nimic");

  // ---------- 4. vândută (activ la OLX) → deactivate vândut ----------
  L.olx.get(900).status = "active"; L.dupaPiesa(1).status = "limited"; // în bază stare veche
  L.piese.get(1).stoc = 0; L.apeluri.length = 0; L.pune({ product_id: 1 });
  r = await L.lot();
  ok(r.retrase === 1 && L.apeluri.join("|") === "GET /adverts/900|POST /adverts/900/commands deactivate:true|GET /adverts/900",
    `vândută, activă la OLX (deși „limited” în bază): starea citită, deactivate cu is_success true (${L.apeluri.join("|")})`);
  ok(!!L.dupaPiesa(1).retras_la && L.dupaPiesa(1).status === "removed_by_user", "vândută: retras_la scris, starea nouă salvată");
  L.apeluri.length = 0; L.pune({ product_id: 1 });
  await L.lot();
  ok(L.apeluri.length === 0, "vândută și retrasă: a doua procesare nu mai cere nimic");

  // ---------- 5. revine pe stoc → activate, retras_la șters ----------
  L.piese.get(1).stoc = 1; L.apeluri.length = 0; L.pune({ product_id: 1 });
  r = await L.lot();
  ok(r.reactivate === 1 && L.apeluri.join("|") === "GET /adverts/900|POST /adverts/900/commands activate|GET /adverts/900",
    `revenită pe stoc: activate, fără PUT dacă nimic nu s-a schimbat (${L.apeluri.join("|")})`);
  ok(L.dupaPiesa(1).retras_la === null, "revenită: retras_la șters");
  L.piese.get(1).stoc = 0; L.piese.get(1).pret_lei = 999; L.pune({ product_id: 1 }); await L.lot(); // retrasă din nou (limited → finish)
  L.piese.get(1).stoc = 1; L.apeluri.length = 0; L.pune({ product_id: 1 });
  await L.lot();
  ok(L.apeluri.at(-1) === "PUT /adverts/900", "revenită cu preț schimbat: activate + PUT");
}

// ---------- 6. ascunsă, neplătită → finish ----------
{
  const L = lume();
  L.piese.set(2, piesaNoua(2, { publicat: false }));
  L.olx.set(500, { id: 500, status: "limited" });
  L.anunturi.push({ id: 1, product_id: 2, advert_id: 500, status: "limited", amprenta: "x", retras_la: null });
  L.pune({ product_id: 2 });
  const r = await L.lot();
  ok(r.retrase === 1 && L.apeluri.join("|") === "GET /adverts/500|POST /adverts/500/commands finish|GET /adverts/500",
    `ascunsă, anunț „limited”: finish, nu deactivate (${L.apeluri.join("|")})`);
}

// ---------- 6b. OLX întoarce starea veche imediat după deactivate ----------
{
  const L = lume();
  L.piese.set(2, piesaNoua(2, { stoc: 0 }));
  L.olx.set(510, { id: 510, status: "active" });
  L.anunturi.push({ id: 1, product_id: 2, advert_id: 510, status: "limited", amprenta: "x", retras_la: null });
  const cere = L.client.cere;
  L.client.cere = async (o) => { const r = await cere(o); if (o.corp?.command === "deactivate") L.olx.get(510).status = "active"; return r; }; // întârzierea lor
  L.pune({ product_id: 2 });
  await L.lot();
  ok(L.dupaPiesa(2).status === "removed_by_user" && !!L.dupaPiesa(2).retras_la, "deactivate reușit, dar OLX citește încă „active”: se scrie removed_by_user");
}

// ---------- 7. piesă ștearsă, 404, erori, oprire, buget ----------
{
  const L = lume();
  L.olx.set(600, { id: 600, status: "active" });
  L.anunturi.push({ id: 1, product_id: null, advert_id: 600, status: "limited", retras_la: null });
  L.pune({ advert_id: 600 });
  let r = await L.lot();
  ok(r.retrase === 1 && L.apeluri.includes("POST /adverts/600/commands deactivate:false"), "piesă ștearsă: deactivate cu is_success false");

  L.anunturi.push({ id: 2, product_id: null, advert_id: 601, status: "active", retras_la: null }); // nu există la OLX
  L.apeluri.length = 0; L.pune({ advert_id: 601 });
  r = await L.lot();
  ok(r.retrase === 1 && L.anunturi.find((a) => a.advert_id === 601).status === "disparut", "anunț care nu mai există la OLX (404): marcat dispărut, fără comandă");

  L.piese.set(3, piesaNoua(3)); L.piese.set(4, piesaNoua(4));
  const c3 = L.pune({ product_id: 3 }); L.pune({ product_id: 4 });
  lume.esec = new EroareOlx("OLX (HTTP 500): eroare internă", { cod: "olx", status: 500 });
  r = await L.lot();
  ok(r.erori.length === 1 && L.coada.get(c3)?.incercari === 1 && r.publicate === 1 && !r.oprit,
    "eroare de moment: rândul rămâne cu încercarea numărată, lotul merge mai departe");

  L.piese.set(5, piesaNoua(5)); L.piese.set(6, piesaNoua(6));
  L.coada.clear(); L.pune({ product_id: 5 }); L.pune({ product_id: 6 });
  lume.esec = new EroareOlx("OLX (HTTP 403): Request blocked", { cod: "olx", status: 403 });
  r = await L.lot();
  ok(!!r.oprit && r.facute === 0 && L.coada.size === 2, "403 „Request blocked”: lotul se OPREȘTE, nimic nu se pierde");

  let t = 0;
  r = await L.lot({ bugetMs: 10, acum: () => (t += 20) });
  ok(r.facute === 0, "bugetul depășit: nu se mai începe niciun rând");
}

// ---------- 8. plasa de 20% ----------
ok(!prag({ vii: 1000, deRetras: 200 }).depasit, "prag: 20% exact nu oprește");
ok(prag({ vii: 1000, deRetras: 201 }).depasit, "prag: peste 20% oprește");
ok(!prag({ vii: 0, deRetras: 5 }).depasit, "prag: fără anunțuri vii nu oprește (nimic de apărat)");
ok(PRAG_RETRAGERE === 0.2, "prag: 20%, ca la dez.ro și la import");

// ---------- 9. „Adu la zi” ----------
{
  const p1 = piesaNoua(1), p2 = piesaNoua(2), p3 = piesaNoua(3, { stoc: 0 }), p4 = piesaNoua(4, { publicat: false }),
        p5 = piesaNoua(5, { categorie_id: 77 }), p6 = piesaNoua(6);
  const a2 = construiesteAnunt(p2, ctx).amprenta;
  const anunturi = [
    { product_id: 2, advert_id: 2, status: "limited", amprenta: a2 },              // la zi
    { product_id: 3, advert_id: 3, status: "limited", amprenta: "x" },             // vândută
    { product_id: 4, advert_id: 4, status: "active", amprenta: "x" },              // ascunsă
    { product_id: 6, advert_id: 6, status: "limited", amprenta: "vechi" },         // de actualizat
    { product_id: null, advert_id: 7, status: "limited" },                         // ștearsă
    { product_id: null, advert_id: 8, status: "limited", retras_la: "x" },         // ștearsă, deja retrasă
  ];
  const d = diferente({ piese: [p1, p2, p3, p4, p5, p6], anunturi, ctx });
  ok(JSON.stringify(d.produse.sort()) === "[1,3,4,6]" && JSON.stringify(d.advert) === "[7]",
    `adu la zi: exact piesele care diferă (${d.produse} / ${d.advert})`);
  ok(d.motive["nu se poate publica încă (vezi raportul)"] === 1, "adu la zi: piesa fără potrivire OLX nu intră în coadă (ar pica de 5 ori)");
}

// ---------- 10. SQL ↔ cod ----------
const sql = readFileSync(new URL("../supabase/olx-coada.sql", import.meta.url), "utf8");
const ts = readFileSync(new URL("../lib/olx.ts", import.meta.url), "utf8");
const coloane = ts.match(/COLOANE_PIESA = "([^"]+)"/)[1].split(",").filter((c) => c !== "id").sort();
const dinTrigger = [...sql.matchAll(/old\.(\w+)\s+is distinct from new\.\1/g)].map((m) => m[1]).sort();
ok(JSON.stringify(coloane) === JSON.stringify(dinTrigger), `triggerul urmărește exact coloanele generatorului (${dinTrigger.length})`);
const stariSql = [...sql.matchAll(/status in \(([^)]+)\)/g)].map((m) => m[1].replace(/[\s']/g, "").split(",").sort().join(","));
ok(stariSql.length === 2 && stariSql.every((s) => s === [...STARI_VII].sort().join(",")), "stările „vii” din SQL = STARI_VII din cod (ambele view-uri)");
ok(!readFileSync(new URL("./anuleaza-olx-coada.sql", import.meta.url), "utf8").split("\n").filter((l) => !l.trim().startsWith("--")).some((l) => /\bcascade\b/i.test(l)),
  "anularea nu folosește cascade");
ok(BUGET_MS + 2 * TIMEOUT_COADA_MS <= 55_000, `un lot încape: buget ${BUGET_MS / 1000}s + 2 × ${TIMEOUT_COADA_MS / 1000}s ≤ 55s`);

console.log(`\nREZULTAT OK: toate cele ${n} verificări au trecut.`);
