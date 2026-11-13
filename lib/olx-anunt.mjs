// ============================================================
// DIN PIESA NOASTRĂ ÎNTR-UN ANUNȚ OLX (pasul 2 din docs/olx-plan.md)
//
// Un singur loc care hotărăște CE se trimite la OLX. Fără bază de date și fără
// rețea: primește piesa și contextul (potriviri, categorii OLX, setări), întoarce
// corpul anunțului sau motivele pentru care nu se poate publica.
//
// REGULILE OLX (specificația, „Create advert → Validation rules”):
//   · titlu 16–150 caractere; descriere 80–9000;
//   · fără telefon, e-mail sau adrese www în titlu și descriere;
//   · majusculele ≤ 50% din text;
//   · niciunul din  ! ? . , - = + # % & @ * _ > < : ( ) |  de trei ori la rând.
// Textul se CURĂȚĂ înainte de trimitere; ce s-a schimbat se raportează (`corectari`),
// ca omul să vadă exact ce a plecat. Nu se inventează nimic despre piesă: completarea
// unei descrieri prea scurte folosește doar ce știm (ani, compatibilități, coduri).
//
// TELEFONUL: se scot doar formele SIGURE (07xx xxx xxx, +40 / 0040, sau precedate de
// „tel”). Un număr de 10 cifre care începe cu 0 poate fi un cod Bosch („0280218063”),
// deci rămâne — dar se raportează ca risc, ca să se vadă la proba reală dacă OLX îl ia
// drept telefon.
// ============================================================

import { createHash } from "node:crypto";

export const TITLU_MIN = 16, TITLU_MAX = 150, DESC_MIN = 80, DESC_MAX = 9000;
export const POZE_IMPLICIT = 8;
const MAX_COMPAT = 12;

export const MOTIVE = {
  faraCategorie: "categoria piesei n-are potrivire OLX",
  atributLipsa: "potrivirea OLX nu are toate atributele obligatorii",
  faraPret: "n-are preț",
  faraOras: "orașul anunțurilor nu e setat (Integrări → OLX)",
  faraContact: "numele de contact nu e setat (Integrări → OLX)",
};

// ---------- detectoarele (folosite și la curățare, și la verificare) ----------
const RE_TELEFON = /(?:\b(?:tel(?:efon)?|mobil|nr)\.?\s*:?\s*)?(?:(?:\+|00)\s?40[\s.\-]?|\b0)7\d{2}[\s.\-]?\d{3}[\s.\-]?\d{3}\b/gi;
const RE_TELEFON_PREFIXAT = /\b(?:tel(?:efon)?|mobil)\.?\s*:?\s*\+?[\d][\d\s.\-]{7,14}\d/gi;
const RE_TELEFON_POSIBIL = /\b0\d{9}\b|\b0\d{2,3}[\s.\-]\d{3}[\s.\-]\d{3,4}\b/g;
const RE_EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const RE_WWW = /\bhttps?:\/\/\S+|\bwww\.\S+|\b[a-z][\w-]*\.(?:ro|com|eu|net|org|info|biz)\b(?:\/\S*)?/gi;
const SEMNE = "!?.,\\-=+#%&@*_><:()|";
const RE_SEMNE_3 = new RegExp(`[${SEMNE}]{3,}`, "g");

// MAJUSCULELE: OLX spune „50% din TOT textul” — deci se împart la toate caracterele (fără
// spații), nu doar la litere. Măsurat la 13 noiembrie 2026: raportat la litere, 204 titluri
// ar fi picat („Supapa EGR Vw Caddy 1.9 TDI BKC BXE” are mai multe majuscule decât litere mici)
// și ar fi ieșit stâlcite. Varianta pe litere rămâne doar ca RISC raportat, de lămurit la proba reală.
const nrMajuscule = (t) => (String(t).match(/\p{Lu}/gu) ?? []).length;
export function procentMajuscule(t) {
  const n = String(t).replace(/\s/g, "").length;
  return n ? nrMajuscule(t) / n : 0;
}
export function procentMajusculeDinLitere(t) {
  const n = (String(t).match(/\p{L}/gu) ?? []).length;
  return n ? nrMajuscule(t) / n : 0;
}

/** Ce reguli OLX încalcă un text (fără să-l schimbe). */
export function verificaText(t, { min, max }) {
  const s = String(t ?? "");
  const r = [];
  if (s.length < min) r.push("prea_scurt");
  if (s.length > max) r.push("prea_lung");
  if (new RegExp(RE_TELEFON.source, "i").test(s) || new RegExp(RE_TELEFON_PREFIXAT.source, "i").test(s)) r.push("telefon");
  if (new RegExp(RE_EMAIL.source).test(s)) r.push("email");
  if (new RegExp(RE_WWW.source, "i").test(s)) r.push("www");
  if (procentMajuscule(s) > 0.5) r.push("majuscule");
  if (new RegExp(RE_SEMNE_3.source).test(s)) r.push("semne");
  return r;
}

/** Cuvintele scrise TOT cu majuscule devin „Cuvânt”; codurile (cu cifre) și abrevierile scurte rămân. */
function maiPutineMajuscule(t) {
  let s = t.replace(/\p{Lu}{4,}[\p{L}]*/gu, (w) => (/\d/.test(w) ? w : w[0] + w.slice(1).toLowerCase()));
  if (procentMajuscule(s) > 0.5)
    s = s.replace(/[\p{L}\d-]+/gu, (w) => (/\d/.test(w) ? w : w.length <= 3 && w === w.toUpperCase() ? w : w[0] + w.slice(1).toLowerCase()));
  if (procentMajuscule(s) > 0.5)
    s = s.replace(/[\p{L}\d-]+/gu, (w) => (/\d/.test(w) ? w : w.toLowerCase())).replace(/^\p{Ll}/u, (c) => c.toUpperCase());
  return s;
}

/** Curăță un text după regulile OLX. Întoarce { text, corectari: [cod] }. */
export function curataText(t) {
  const corectari = new Set();
  let s = String(t ?? "").replace(/\r/g, "");
  const inainte = s;
  s = s.replace(RE_EMAIL, () => { corectari.add("email"); return ""; });
  s = s.replace(RE_WWW, () => { corectari.add("www"); return ""; });
  s = s.replace(RE_TELEFON_PREFIXAT, () => { corectari.add("telefon"); return ""; });
  s = s.replace(RE_TELEFON, () => { corectari.add("telefon"); return ""; });
  s = s.replace(RE_SEMNE_3, (m) => { corectari.add("semne"); return m.slice(0, 2); });
  if (procentMajuscule(s) > 0.5) { s = maiPutineMajuscule(s); corectari.add("majuscule"); }
  if (s !== inainte)
    s = s.split("\n").map((l) => l.replace(/[ \t]{2,}/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return { text: s, corectari: [...corectari] };
}

const taie = (s, n) => {
  const t = String(s ?? "").trim();
  if (t.length <= n) return t;
  const scurt = t.slice(0, n);
  const sp = scurt.lastIndexOf(" ");
  return (sp > n * 0.6 ? scurt.slice(0, sp) : scurt).replace(/[\s,;:.\-]+$/, "").trim();
};

/** Descrierea brută, din ce ȘTIM despre piesă (ca la dez.ro, fără link spre site). */
export function descriereBruta(p) {
  const parti = [];
  const nota = String(p.stare_nota ?? "").trim();
  parti.push(nota || String(p.nume ?? "").trim());
  const detalii = [];
  if (p.ani) detalii.push(`Ani: ${p.ani}`);
  const oem = String(p.oem ?? "").trim();
  if (oem && oem !== "-" && !nota.toLowerCase().includes(oem.toLowerCase().split(" / ")[0])) detalii.push(`Cod OEM: ${oem}`);
  if (p.pret_sufix) detalii.push(`Preț ${String(p.pret_sufix).trim()}`);
  if (detalii.length) parti.push(detalii.join("\n"));
  const compat = (p.compat ?? []).filter(Boolean);
  if (compat.length) {
    const l = compat.slice(0, MAX_COMPAT);
    const rest = compat.length - l.length;
    parti.push(`Se potrivește pe:\n${l.map((c) => `· ${c}`).join("\n")}${rest > 0 ? `\n· și încă ${rest} ${rest === 1 ? "model" : "modele"}` : ""}`);
  }
  if (p.cod_intern) parti.push(`Cod piesă: ${p.cod_intern}`);
  return parti.join("\n\n");
}

/**
 * REGULI DUPĂ TITLU, peste potrivirea pe categorie — DOAR pentru categoriile noastre care
 * amestecă două frunze OLX (decizia proprietarului, 13 noiembrie 2026). Cheia e id-ul
 * categoriei pe care o folosește potrivirea (subcategoria piesei, altfel categoria);
 * ținta e frunza OLX. Titlul se compară fără diacritice, cu litere mici.
 * Măsurat pe catalog la 13 noiembrie 2026:
 *   · 18 „EGR și Clapetă accelerație” (324): „EGR” sau „răcitor (de) gaze” → Recirculare gaze EGR
 *     (124 cu „EGR” + ~40 de răcitoare EGR fără cuvântul „EGR”); restul → Clapete de accelerație.
 *   · 20 „Radiatoare și Ventilatoare” (229): „ventilator / ventilatoare” (și „electro…”), „GMV” /
 *     „GMW” → Ventilatoare radiator; restul → Radiatoare.
 */
export const REGULI_TITLU = [
  { categorie_id: 18, re: /\begr\b|\bracitor(ul)?\s+(de\s+)?gaze\b/, olx_categorie_id: 3630 },
  { categorie_id: 20, re: /ventilato(r|are)|\bgm[vw]\b/, olx_categorie_id: 3587 },
];
const faraDiacriticeMic = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** Frunza OLX dată de o regulă după titlu, sau null (atunci rămâne potrivirea pe categorie). */
export function categorieDinTitlu(categorieId, titlu) {
  const t = faraDiacriticeMic(titlu);
  return REGULI_TITLU.find((r) => r.categorie_id === Number(categorieId) && r.re.test(t))?.olx_categorie_id ?? null;
}

/** Fraza de completare pentru descrierile sub 80 de caractere — doar fapte adevărate. */
const COMPLETARE = "Piesă auto second-hand, din dezmembrări. Se poate livra prin curier în toată țara.";

/**
 * Anunțul pentru o piesă.
 * @param p        rândul din `products` (nume, stare_nota, ani, compat, oem, cod_intern, pret_lei, pret_sufix, poze, slug, categorie_id, subcategorie_id)
 * @param context  { mapari: Map<categorie_id, {olx_categorie_id, atribute}>, categoriiOlx: Map<id, {photos_limit, atribute, cale}>,
 *                   setari: {city_id, district_id, contact_nume, contact_telefon, external_url}, siteUrl, poza: (url) => string }
 * @returns {{ ok: boolean, corp: any, motive: string[], corectari: string[], riscuri: string[], amprenta: string|null, categorie: string|null }}
 */
export function construiesteAnunt(p, context) {
  const { mapari, categoriiOlx, setari = {}, siteUrl = "", poza = (u) => u } = context;
  const motive = [], riscuri = [], corectari = new Set();

  // Titlul
  const t = curataText(String(p.nume ?? "").replace(/\s+/g, " "));
  t.corectari.forEach((c) => corectari.add(`titlu_${c}`));
  let titlu = t.text;
  if (titlu.length > TITLU_MAX) { titlu = taie(titlu, TITLU_MAX); corectari.add("titlu_taiat"); }
  if (titlu.length < TITLU_MIN) { titlu = `${titlu} - piesă auto second-hand`.trim(); corectari.add("titlu_completat"); }

  // Descrierea
  const d = curataText(descriereBruta(p));
  d.corectari.forEach((c) => corectari.add(`descriere_${c}`));
  let descriere = d.text;
  if (descriere.length < DESC_MIN) { descriere = `${descriere}\n\n${COMPLETARE}`.trim(); corectari.add("descriere_completata"); }
  if (descriere.length > DESC_MAX) { descriere = taie(descriere, DESC_MAX); corectari.add("descriere_taiata"); }
  if (new RegExp(RE_TELEFON_POSIBIL.source).test(`${titlu}\n${descriere}`)) riscuri.push("un cod care poate fi luat drept telefon");
  if (procentMajusculeDinLitere(titlu) > 0.5) riscuri.push("titlul are peste 50% majuscule dacă se numără doar literele");

  // Plasă: textul final trebuie să treacă regulile; altfel e defect de curățare, nu se trimite.
  for (const [nume, txt, lim] of [["titlu", titlu, { min: TITLU_MIN, max: TITLU_MAX }], ["descriere", descriere, { min: DESC_MIN, max: DESC_MAX }]]) {
    const v = verificaText(txt, lim);
    if (v.length) motive.push(`${nume}: încă încalcă ${v.join(", ")}`);
  }

  // Categoria: subcategoria piesei → categoria ei; apoi regula după titlu (doar la categoriile amestecate)
  const cheie = p.subcategorie_id && mapari.get(p.subcategorie_id) ? p.subcategorie_id : p.categorie_id;
  let potrivire = (cheie && mapari.get(cheie)) || null;
  const olxDinTitlu = potrivire ? categorieDinTitlu(cheie, p.nume) : null;
  if (olxDinTitlu) potrivire = { ...potrivire, olx_categorie_id: olxDinTitlu };
  const catOlx = potrivire ? categoriiOlx.get(potrivire.olx_categorie_id) : null;
  if (!potrivire) motive.push(MOTIVE.faraCategorie);
  else if (catOlx?.atribute) {
    const date = new Set((potrivire.atribute ?? []).filter((a) => String(a.value ?? "").trim()).map((a) => a.code));
    const lipsa = catOlx.atribute.filter((a) => a.validation?.required && !["price", "salary"].includes(a.validation?.type) && a.code !== "price" && !date.has(a.code));
    if (lipsa.length) motive.push(`${MOTIVE.atributLipsa} (${lipsa.map((a) => a.label).join(", ")})`);
  }

  const pret = Number(p.pret_lei);
  if (!(pret > 0)) motive.push(MOTIVE.faraPret);
  if (!setari.city_id) motive.push(MOTIVE.faraOras);
  if (!String(setari.contact_nume ?? "").trim()) motive.push(MOTIVE.faraContact);

  const limita = catOlx?.photos_limit || POZE_IMPLICIT;
  const toatePoze = (p.poze ?? []).filter(Boolean);
  if (!toatePoze.length) riscuri.push("n-are poze");
  if (toatePoze.length > limita) corectari.add("poze_taiate");

  const corp = {
    title: titlu,
    description: descriere,
    category_id: potrivire?.olx_categorie_id ?? null,
    advertiser_type: "business",
    external_id: String(p.cod_intern ?? ""),
    ...(setari.external_url !== false && p.slug ? { external_url: `${siteUrl.replace(/\/+$/, "")}/piese/${p.slug}` } : {}),
    contact: { name: String(setari.contact_nume ?? "").trim(), ...(setari.contact_telefon ? { phone: String(setari.contact_telefon) } : {}) },
    location: { city_id: setari.city_id ?? null, ...(setari.district_id ? { district_id: setari.district_id } : {}) },
    images: toatePoze.slice(0, limita).map((u) => ({ url: poza(u) })),
    price: { value: Math.round(pret * 100) / 100, currency: "RON", negotiable: false, trade: false, budget: false },
    attributes: (potrivire?.atribute ?? []).map((a) => ({ code: a.code, value: String(a.value) })),
    courier: true,
    auto_extend_enabled: true,
  };

  return {
    ok: motive.length === 0, corp, motive, riscuri, corectari: [...corectari],
    amprenta: motive.length ? null : amprenta(corp),
    categorie: catOlx?.cale ?? (potrivire ? `#${potrivire.olx_categorie_id}` : null),
  };
}

/** Amprenta corpului (chei sortate), ca o resincronizare să trimită doar ce s-a schimbat. */
export function amprenta(corp) {
  const sortat = (v) => Array.isArray(v) ? v.map(sortat)
    : v && typeof v === "object" ? Object.keys(v).sort().reduce((o, k) => ((o[k] = sortat(v[k])), o), {}) : v;
  return createHash("sha1").update(JSON.stringify(sortat(corp))).digest("hex").slice(0, 16);
}

/** Pentru raport: ce reguli încalcă textul BRUT (înainte de curățare). */
export function incalcariBrute(p) {
  return {
    titlu: verificaText(String(p.nume ?? "").replace(/\s+/g, " ").trim(), { min: TITLU_MIN, max: TITLU_MAX }),
    descriere: verificaText(descriereBruta(p), { min: DESC_MIN, max: DESC_MAX }),
  };
}
