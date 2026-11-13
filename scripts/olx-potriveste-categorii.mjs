// ============================================================
// POTRIVIREA AUTOMATĂ A CATEGORIILOR OLX (pasul 2 din docs/olx-plan.md, 13 noiembrie 2026)
//
//   node scripts/olx-potriveste-categorii.mjs            → aduce catalogul OLX (olx_categorii),
//        propune o frunză OLX pentru fiecare categorie de pe site cu piese publicate și scrie
//        propunerea în `olx-potriviri-propuse.json` (sau --fisier=…). NU scrie potriviri.
//   node scripts/olx-potriveste-categorii.mjs --scrie    → scrie în olx_mapari DOAR potrivirile
//        sigure din fișier, cu atributele obligatorii completate; restul doar se raportează.
//
// CHEIA: categoria pe care o folosește generatorul (lib/olx-anunt.mjs) pentru o piesă —
// subcategoria ei, altfel categoria. Se potrivesc exact cheile care au piese publicate cu stoc.
//
// REGULA: /categories/suggestion pe titlurile a până la 5 piese reale (răspândite în listă)
// și pe numele categoriei. Sigur = frunza cea mai votată are ≥ 60% din voturi ȘI e aceeași cu
// sugestia pe nume, SAU are ≥ 80% din cel puțin 3 voturi. Altfel se alege sugestia pe nume
// și categoria intră în lista „de verificat” (nu se scrie) — dacă nu are o corectură în --corectii=….
//
// ATRIBUTELE: se completează singur DOAR starea (folosit). Orice alt atribut obligatoriu
// face potrivirea nesigură (nu se scrie) și apare în raport.
// O potrivire scrisă de om (actualizat_de ≠ null) NU se suprascrie.
// ============================================================
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { clientOlxRest, bazaRest } from "./olx-client-rest.mjs";
import { citesteTotRest } from "../lib/rest.mjs";
import { dinData } from "../lib/olx-api.mjs";

const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=");
const SCRIE = process.argv.includes("--scrie");
const FISIER = arg("fisier") ?? "olx-potriviri-propuse.json";
const CACHE = arg("cache") ?? null;
// Corecturile după nume (cele din 13 noiembrie 2026: scripts/olx-corectii-categorii.json): { "<categorie_id>": { "olx": "<sfârșitul căii OLX>", "verifica": "motiv" | null } }.
// Bat sugestiile; „verifica” o trimite în lista de verificat de om (dar se scrie).
const CORECTII = arg("corectii") ? JSON.parse(readFileSync(arg("corectii"), "utf8")) : {};
const MOSTRE = 5;
const PAUZA_MS = 1500;
const RADACINA_PIESE = 1639; // „Piese și accesorii”

const { url, antete, rest } = bazaRest();
const olx = clientOlxRest();

/** Starea = folosit. Codul și valoarea se iau din atributele categoriei, nu se ghicesc. */
function atributStare(a) {
  if (!/stare|state|condition/i.test(`${a.code} ${a.label}`)) return null;
  const v = (a.values ?? []).find((x) => /folosit|utilizat|second|used/i.test(`${x.code} ${x.label}`));
  return v ? { code: a.code, value: String(v.code) } : null;
}
const obligatorii = (atribute) => (atribute ?? []).filter((a) => a.validation?.required && a.code !== "price" && !["price", "salary"].includes(a.validation?.type));

async function aduCatalogul() {
  const toate = dinData((await olx.cere({ cale: "/categories", tip: "categorii" })).json) ?? [];
  if (toate.length < 500) throw new Error(`OLX a întors doar ${toate.length} categorii — mă opresc.`);
  const dupaId = new Map(toate.map((c) => [Number(c.id), c]));
  const cale = (id) => { const p = []; let c = dupaId.get(id), g = 0;
    while (c && g++ < 10) { p.unshift(c.name); c = c.parent_id ? dupaId.get(Number(c.parent_id)) : undefined; } return p.join(" › "); };
  const randuri = toate.map((c) => ({ id: Number(c.id), nume: c.name, parent_id: Number(c.parent_id) || null, is_leaf: !!c.is_leaf,
    photos_limit: c.photos_limit ?? null, cale: cale(Number(c.id)), adus_la: new Date().toISOString() }));
  for (let i = 0; i < randuri.length; i += 500)
    await rest("olx_categorii?on_conflict=id", { metoda: "POST", corp: randuri.slice(i, i + 500), prefer: "resolution=merge-duplicates" });
  return new Map(randuri.map((r) => [r.id, r]));
}

async function sugestie(q, cache) {
  const k = q.slice(0, 150);
  if (cache[k] !== undefined) return cache[k];
  // Rar: OLX (CloudFront) blochează IP-ul după câteva sute de cereri la rând (403 „Request blocked”,
  // măsurat la 13 noiembrie 2026, după ~700). Pauză între cereri; cache-ul se salvează după fiecare.
  await new Promise((r) => setTimeout(r, PAUZA_MS));
  const { json } = await olx.cere({ cale: `/categories/suggestion?q=${encodeURIComponent(k)}`, tip: "sugestie" });
  const d = dinData(json);
  const x = Array.isArray(d) ? d[0] : null;
  cache[k] = x ? Number(x.id) : null;
  if (CACHE) writeFileSync(CACHE, JSON.stringify(cache));
  return cache[k];
}

async function propune() {
  console.log("1. Catalogul OLX…");
  const catalog = await aduCatalogul();
  const subPiese = (id) => { let c = catalog.get(id), g = 0; while (c && g++ < 10) { if (c.id === RADACINA_PIESE) return true; c = c.parent_id ? catalog.get(c.parent_id) : null; } return false; };
  console.log(`   ${catalog.size} categorii, ${[...catalog.values()].filter((c) => c.is_leaf && subPiese(c.id)).length} frunze sub „Piese și accesorii”.`);

  console.log("2. Categoriile noastre cu piese publicate…");
  const [piese, cats] = await Promise.all([
    citesteTotRest(url, antete, "products?select=id,nume,categorie_id,subcategorie_id&publicat=eq.true&stoc=gt.0&order=id", { eticheta: "piese" }),
    citesteTotRest(url, antete, "categories?select=id,nume,parent_id&order=id", { eticheta: "categorii" }),
  ]);
  const cat = new Map(cats.map((c) => [c.id, c]));
  const peCheie = new Map();
  for (const p of piese) { const k = p.subcategorie_id ?? p.categorie_id; if (k) peCheie.set(k, [...(peCheie.get(k) ?? []), p]); }
  console.log(`   ${piese.length} piese, ${peCheie.size} categorii de potrivit.`);

  const cache = CACHE && existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};
  const rezultat = [];
  let i = 0;
  for (const [k, lista] of [...peCheie.entries()].sort((a, b) => b[1].length - a[1].length)) {
    i++;
    const c = cat.get(k);
    const parinte = c?.parent_id ? cat.get(c.parent_id)?.nume : null;
    const n = Math.min(MOSTRE, lista.length);
    const mostre = Array.from({ length: n }, (_, j) => lista[Math.floor((j * lista.length) / n)]);
    const voturi = new Map();
    for (const p of mostre) {
      const id = await sugestie(p.nume, cache);
      if (id) voturi.set(id, (voturi.get(id) ?? 0) + 1);
    }
    const peNume = await sugestie(c?.nume ?? "", cache);
    const [sus, nSus] = [...voturi.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
    const cota = n ? nSus / n : 0;
    let ales, sigur, motiv;
    if (sus && ((cota >= 0.6 && sus === peNume) || (n >= 3 && cota >= 0.8))) { ales = sus; sigur = true; motiv = `${nSus}/${n} titluri${sus === peNume ? " + numele" : ""}`; }
    else { ales = peNume ?? sus; sigur = false; motiv = `sugestiile se contrazic (${[...voturi.entries()].map(([id, v]) => `${catalog.get(id)?.nume ?? id}×${v}`).join(", ") || "niciuna"}; pe nume: ${catalog.get(peNume)?.nume ?? "—"})`; }
    if (ales && !catalog.get(ales)?.is_leaf) { sigur = false; motiv += "; nu e frunză"; }
    if (ales && !subPiese(ales)) { sigur = false; motiv += "; în afara „Piese și accesorii”"; }
    rezultat.push({ categorie_id: k, nume: c?.nume, parinte, piese: lista.length, olx_categorie_id: ales, cale: catalog.get(ales)?.cale ?? null,
      sigur, motiv, mostre: mostre.map((p) => p.nume) });
    if (i % 20 === 0) { console.log(`   ${i}/${peCheie.size}…`); if (CACHE) writeFileSync(CACHE, JSON.stringify(cache)); }
  }
  if (CACHE) writeFileSync(CACHE, JSON.stringify(cache));

  // Corecturile după nume (calea OLX se caută între frunzele de sub „Piese și accesorii”).
  const frunzePiese = [...catalog.values()].filter((c) => c.is_leaf && subPiese(c.id));
  for (const r of rezultat) {
    const k = CORECTII[String(r.categorie_id)];
    if (!k) continue;
    const g = frunzePiese.filter((c) => c.cale.endsWith(k.olx));
    if (g.length !== 1) throw new Error(`Corectura pentru „${r.nume}”: „${k.olx}” se potrivește pe ${g.length} frunze.`);
    r.sugestie = r.cale;
    r.olx_categorie_id = g[0].id; r.cale = g[0].cale; r.sigur = true;
    r.motiv = `ales după nume (sugestii: ${r.motiv})`;
    r.verifica = k.verifica ?? null;
  }

  console.log("3. Atributele frunzelor alese…");
  const frunze = [...new Set(rezultat.map((r) => r.olx_categorie_id).filter(Boolean))];
  const atr = new Map();
  for (const id of frunze) {
    const d = dinData((await olx.cere({ cale: `/categories/${id}/attributes`, tip: "atribute" })).json);
    const atribute = Array.isArray(d) ? d : [];
    atr.set(id, atribute);
    await rest(`olx_categorii?id=eq.${id}`, { metoda: "PATCH", corp: { atribute, atribute_la: new Date().toISOString() } });
  }
  for (const r of rezultat) {
    if (!r.olx_categorie_id) continue;
    const ob = obligatorii(atr.get(r.olx_categorie_id));
    r.atribute = [];
    r.atribute_nededuse = [];
    for (const a of ob) { const v = atributStare(a); if (v) r.atribute.push(v); else r.atribute_nededuse.push(`${a.label} (${a.code})`); }
    // Starea se trimite și când nu e obligatorie, dacă există.
    if (!r.atribute.length) for (const a of atr.get(r.olx_categorie_id) ?? []) { const v = atributStare(a); if (v) { r.atribute.push(v); break; } }
    if (r.atribute_nededuse.length) { r.sigur = false; r.motiv += `; atribute obligatorii nededuse: ${r.atribute_nededuse.join(", ")}`; }
  }
  writeFileSync(FISIER, JSON.stringify(rezultat, null, 1));
  const s = rezultat.filter((r) => r.sigur);
  console.log(`\nPropunere scrisă în ${FISIER}: ${s.length} sigure (${s.reduce((t, r) => t + r.piese, 0)} piese), ${rezultat.length - s.length} de verificat (${rezultat.filter((r) => !r.sigur).reduce((t, r) => t + r.piese, 0)} piese).`);
}

async function scrie() {
  const rezultat = JSON.parse(readFileSync(FISIER, "utf8"));
  const existente = await rest("olx_mapari?select=categorie_id,actualizat_de");
  const deOm = new Set(existente.filter((m) => m.actualizat_de).map((m) => m.categorie_id));
  const randuri = rezultat.filter((r) => r.sigur && r.olx_categorie_id && !deOm.has(r.categorie_id))
    .map((r) => ({ categorie_id: r.categorie_id, olx_categorie_id: r.olx_categorie_id, atribute: r.atribute ?? [], actualizat_la: new Date().toISOString(), actualizat_de: null }));
  for (let i = 0; i < randuri.length; i += 200)
    await rest("olx_mapari?on_conflict=categorie_id", { metoda: "POST", corp: randuri.slice(i, i + 200), prefer: "resolution=merge-duplicates" });
  const total = await rest("olx_mapari?select=categorie_id");
  console.log(`Scrise ${randuri.length} potriviri (sărite, puse de om: ${deOm.size}). În olx_mapari sunt acum ${total.length}.`);
}

try { await (SCRIE ? scrie() : propune()); }
catch (e) { console.error("EROARE:", e?.message ?? e); process.exit(1); }
