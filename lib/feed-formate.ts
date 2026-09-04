// ============================================================
// FORMATELE FEED-ULUI — aceleași rânduri, scrise în patru feluri
//
// Rândurile vin gata calculate din `lib/feed.ts`. Aici nu se mai ia nicio
// decizie despre CE conține un produs, doar despre CUM se scrie. Regula ține
// cele două canale de reclamă sincronizate: dacă mâine se schimbă descrierea,
// se schimbă într-un singur loc și ajunge identică și la Google, și la Meta.
//
// De ce patru:
//   · `xmlGoogle`  — RSS 2.0 cu spațiul de nume `g:`, singurul format pe care
//     Merchant Center îl citește de la o adresă fără nicio configurare.
//   · `csvMeta`    — catalogul Meta (Facebook + Instagram). Acceptă și XML, dar
//     CSV-ul e formatul pe care îl documentează ei și pe care îl poți deschide
//     în Excel când ceva nu merge.
//   · `csvGeneric` — pentru orice altă platformă (OLX, Publi24, un magazin nou,
//     contabilitate). Toate coloanele, nume românești, fără să presupunem nimic.
//   · `xmlGeneric` — același conținut, pentru importatoarele care cer XML și își
//     mapează singure câmpurile.
//
// FIECARE FORMAT ARE DOUĂ VARIANTE: una care întoarce fișierul rupt în bucăți
// (`…Bucati`, o bucată per produs) și un înveliș care le lipește într-un șir.
//
// Nu e o eleganță: feed-ul Google al catalogului real are 25,8 MB, iar o funcție
// Vercel care întoarce un corp construit întreg în memorie are plafon de 4,5 MB
// (vezi lib/feed-raspuns.ts). Rutele publice trimit bucățile în flux; descărcarea
// din panou folosește șirul, fiindcă acolo fișierul trebuie oricum ținut întreg
// ca să devină un `Blob` pe care browserul îl salvează.
//
// Bucăți, nu generatoare: `tsconfig` țintește ES5, unde parcurgerea unui
// `Iterable` cere `--downlevelIteration`. Un vector de bucăți face aceeași
// treabă și se citește la fel de ușor.
// ============================================================
import type { RandFeed } from "./feed";
import { MONEDA_FEED } from "./feed";
import { SITE_URL } from "./config";

// ============================================================
// CSV
// ============================================================

/**
 * O celulă CSV după RFC 4180: totul între ghilimele, ghilimelele dinăuntru
 * dublate. Se citează TOT, chiar și numerele — o coloană care uneori e citată
 * și alteori nu e cea mai frecventă cauză de „importul a mers strâmb de la
 * rândul 4.000", fiindcă e nevoie de o singură denumire cu virgulă ca să rupă
 * restul fișierului.
 */
export const celula = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;

/**
 * Marcajul care îi spune Excel-ului că textul e UTF-8 (U+FEFF). Fără el,
 * „Turbină" se deschide „TurbinÄƒ" pe un Windows românesc.
 *
 * Scris prin codul caracterului, nu ca literal: U+FEFF e invizibil, iar un
 * fișier sursă în care apare „nimic" între ghilimele e o capcană — orice
 * curățare de spații albe l-ar șterge fără ca cineva să observe.
 */
export const BOM = String.fromCharCode(0xfeff);

/**
 * Fișierul CSV. Rândurile se termină cu CRLF, cum cere RFC 4180 — Excel și
 * importatoarele mai vechi citesc corect și LF, dar nu toate.
 *
 * BOM-ul se pune la fișierele descărcate de OM și NU la cele citite de mașini:
 * Google și Meta îl tolerează, dar unele importatoare îl citesc ca parte din
 * numele primei coloane, iar atunci prima coloană „nu există".
 */
export function csvBucati(
  capuri: string[],
  randuri: (string | number)[][],
  optiuni: { separator?: string; bom?: boolean } = {},
): string[] {
  const sep = optiuni.separator ?? ",";
  const out: string[] = [];
  if (optiuni.bom) out.push(BOM);
  out.push(capuri.map(celula).join(sep) + "\r\n");
  for (const r of randuri) out.push(r.map(celula).join(sep) + "\r\n");
  return out;
}

/** Fișierul întreg, ca șir. Se folosește la descărcarea din panou, unde oricum
 *  trebuie ținut tot în memoria browserului ca să devină un `Blob`. Rutele
 *  publice folosesc generatorul de mai sus — vezi antetul fișierului. */
export function csv(
  capuri: string[],
  randuri: (string | number)[][],
  optiuni: { separator?: string; bom?: boolean } = {},
) {
  return csvBucati(capuri, randuri, optiuni).join("");
}

// ============================================================
// GOOGLE MERCHANT CENTER — RSS 2.0
// ============================================================

/**
 * Scoate caracterele de control, care nu sunt legale în XML 1.0.
 *
 * Unul singur, ajuns dintr-o descriere copiată de undeva, face fișierul invalid
 * ÎN ÎNTREGIME: Google nu respinge rândul, ci refuză tot feed-ul. Deci o piesă
 * ciudată ar opri reclamele pentru toate celelalte 8.800.
 *
 * Tab (9), linie nouă (10) și retur de car (13) sunt legale și rămân.
 * Verificarea se face pe cod, nu cu o expresie regulată cu interval de
 * caractere invizibile — aceea ar fi un rând de sursă imposibil de citit și de
 * corectat.
 */
function faraControl(t: string) {
  let out = "";
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i);
    if (c < 32 && c !== 9 && c !== 10 && c !== 13) continue;
    out += t[i];
  }
  return out;
}

/** Textul dintr-o etichetă XML. `&`, `<` și `>` sunt obligatorii; ghilimelele
 *  și apostroful nu, în conținut, dar nu strică nimănui. */
function xmlText(v: unknown) {
  return faraControl(String(v ?? ""))
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

const et = (nume: string, v: unknown) => `    <${nume}>${xmlText(v)}</${nume}>`;

/**
 * Feed-ul pentru Google Merchant Center.
 *
 * DECIZII care nu se văd din cod și care s-ar reface greșit:
 *
 * · `g:id` = codul intern (AP-000123), NU id-ul din bază. Trebuie să fie
 *   identic cu `item_id` trimis de gtag la „vizualizare piesă" și „adaugă în
 *   coș" (`piesaGa` din lib/analytics.ts folosește tot `cod_intern`). Dacă cele
 *   două nu se potrivesc, remarketingul dinamic nu are ce lega și reclamele
 *   afișează produse la întâmplare.
 *
 * · `g:condition` = `used` pentru tot catalogul. Sunt piese din dezmembrări;
 *   „new" ar fi o declarație falsă către Google și către cumpărător.
 *
 * · `g:identifier_exists` = `no` când piesa n-are cod OEM — ceea ce e cazul
 *   întregului catalog importat. Fără el, Google caută un GTIN inexistent și
 *   respinge produsul. Când există OEM, îl trimitem ca `g:mpn` și nu mai punem
 *   `identifier_exists`.
 *
 * · `g:shipping_weight` pleacă DOAR când greutatea e cântărită
 *   (`greutate_estimata = false`). 8.765 din 8.804 de piese au 1 kg pus automat
 *   la import; trimițându-l, Google ar calcula un transport greșit pentru un
 *   bloc motor. Fără greutate, se aplică tariful din setările contului.
 *
 * · `g:brand` = marca MAȘINII (Audi, VW), fiindcă asta caută omul. Când piesa
 *   n-are niciun model recunoscut, eticheta lipsește cu totul — mai bine fără
 *   marcă decât cu o marcă inventată.
 */
export function xmlGoogleBucati(randuri: RandFeed[], optiuni: { titlu?: string } = {}): string[] {
  const out: string[] = [];
  const titlu = optiuni.titlu ?? "Autopas Dezmembrări — piese auto";
  const cap =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n` +
    `  <channel>\n` +
    `    <title>${xmlText(titlu)}</title>\n` +
    `    <link>${xmlText(SITE_URL)}</link>\n` +
    `    <description>${xmlText("Piese auto second-hand din dezmembrări autorizate, testate, cu garanție 90 de zile.")}</description>\n`;
  out.push(cap);

  for (const r of randuri) {
    const linii: string[] = [
      et("g:id", r.id),
      et("title", r.titlu),
      et("description", r.descriere),
      et("link", r.url),
      et("g:image_link", r.poza),
      ...r.poze_suplimentare.map((p) => et("g:additional_image_link", p)),
      et("g:availability", r.disponibilitate_google),
      et("g:price", r.pret_text),
      et("g:condition", r.stare_produs),
      et("g:google_product_category", r.categorie_google),
    ];
    if (r.cale_categorie) linii.push(et("g:product_type", r.cale_categorie));
    if (r.marca) linii.push(et("g:brand", r.marca));
    if (r.oem) linii.push(et("g:mpn", r.oem));
    else linii.push(et("g:identifier_exists", "no"));
    if (r.greutate_kg && !r.greutate_estimata)
      linii.push(et("g:shipping_weight", `${r.greutate_kg} kg`));

    // Etichetele de campanie. Nu se văd nicăieri public; folosesc la împărțirea
    // produselor pe grupuri de licitare în Google Ads („licitez mai mult pe
    // piesele de peste 1000 de lei").
    linii.push(et("g:custom_label_0", r.eticheta_marca));
    linii.push(et("g:custom_label_1", r.eticheta_categorie));
    linii.push(et("g:custom_label_2", r.eticheta_pret));
    linii.push(et("g:custom_label_3", r.eticheta_model));
    linii.push(et("g:custom_label_4", r.eticheta_ani));

    // Detaliile suplimentare apar în fișa produsului din Shopping. Sunt exact
    // câmpurile după care întreabă un cumpărător de piesă second-hand.
    const detalii: [string, string][] = [
      ["Marcă", r.marca], ["Model", r.modele.replaceAll("|", ", ")], ["Ani", r.ani],
      ["Stare", "Second-hand, verificată"], ["Cod intern", r.id],
      ["Piesă originală", r.originala ? "Da" : "Nu"],
    ];
    for (const [nume, val] of detalii) {
      if (!val) continue;
      linii.push(
        `    <g:product_detail>\n` +
        `      <g:section_name>Piesă</g:section_name>\n` +
        `      <g:attribute_name>${xmlText(nume)}</g:attribute_name>\n` +
        `      <g:attribute_value>${xmlText(val)}</g:attribute_value>\n` +
        `    </g:product_detail>`,
      );
    }
    out.push(`    <item>\n${linii.join("\n")}\n    </item>\n`);
  }

  out.push(`  </channel>\n</rss>\n`);
  return out;
}

/** Feed-ul întreg, ca șir — pentru descărcarea manuală din panou. */
export const xmlGoogle = (randuri: RandFeed[], optiuni: { titlu?: string } = {}) =>
  xmlGoogleBucati(randuri, optiuni).join("");

// ============================================================
// META (FACEBOOK + INSTAGRAM) — CSV de catalog
// ============================================================

/**
 * Coloanele catalogului Meta, cu numele lor exacte în engleză. Nu se traduc:
 * Meta le potrivește după antet, iar un „pret" în loc de „price" înseamnă un
 * catalog fără prețuri, importat cu succes.
 *
 * `availability` are la Meta valori cu SPAȚIU („in stock"), spre deosebire de
 * Google, unde e cu underscore („in_stock"). Aceeași informație, două scrieri —
 * de asta `RandFeed` le poartă pe amândouă, calculate o dată.
 *
 * `quantity_to_sell_on_facebook` = stocul. La noi e 1: fiecare piesă e unicat,
 * iar fără coloana asta Meta presupune stoc nelimitat și continuă să afișeze
 * reclama pentru o piesă deja vândută.
 */
export const CAPURI_META = [
  "id", "title", "description", "availability", "condition", "price", "link", "image_link",
  "brand", "additional_image_link", "google_product_category", "product_type",
  "quantity_to_sell_on_facebook",
  "custom_label_0", "custom_label_1", "custom_label_2", "custom_label_3", "custom_label_4",
];

function randuriMeta(randuri: RandFeed[]): (string | number)[][] {
  return randuri.map((r) => [
    r.id, r.titlu, r.descriere, r.disponibilitate_meta, r.stare_produs, r.pret_text, r.url, r.poza,
    r.marca, r.poze_suplimentare.join(","), r.categorie_google, r.cale_categorie,
    r.stoc,
    r.eticheta_marca, r.eticheta_categorie, r.eticheta_pret, r.eticheta_model, r.eticheta_ani,
  ]);
}

// Fără BOM: fișierul îl citește un robot, nu Excel.
export const csvMetaBucati = (randuri: RandFeed[]) =>
  csvBucati(CAPURI_META, randuriMeta(randuri), { separator: ",", bom: false });

/** Fișierul întreg, ca șir — pentru descărcarea manuală din panou. */
export const csvMeta = (randuri: RandFeed[]) => csvMetaBucati(randuri).join("");

// ============================================================
// FEED GENERIC — pentru orice altă platformă
// ============================================================

/**
 * Coloanele exportului complet, cu nume românești. Ordinea e gândită pentru om:
 * întâi identificarea, apoi ce e piesa, apoi mașina, apoi banii, apoi pozele.
 *
 * Coloanele INTERNE (cost, marjă, vizualizări, sursă) sunt la final și se adaugă
 * doar la exportul din panou — vezi `CAPURI_INTERNE`.
 */
export const CAPURI_GENERIC = [
  "cod", "id_intern", "nume", "descriere", "url",
  "categorie", "subcategorie", "cale_categorie",
  "marca", "model", "modele_compatibile", "compatibilitati", "ani", "masina_sursa",
  "cod_oem", "piesa_originala", "stare", "nota_stare",
  "pret", "moneda", "pret_sufix", "tva_inclus", "stoc", "disponibilitate",
  "greutate_kg", "greutate_estimata",
  "poza_principala", "poze_suplimentare", "numar_poze",
  "publicat", "creat_la", "actualizat_la",
];

export const CAPURI_INTERNE = [
  "cost_lei", "marja_lei", "marja_procent", "sursa", "sursa_url", "editat_manual", "vizualizari",
];

const daNu = (b: boolean) => (b ? "da" : "nu");

/** Un rând, în ordinea din `CAPURI_GENERIC`. */
export function randGeneric(r: RandFeed): (string | number)[] {
  return [
    r.id, r.id_baza, r.nume_brut, r.descriere, r.url,
    r.categorie, r.subcategorie, r.cale_categorie,
    r.marca, r.model, r.modele, r.compat, r.ani, r.masina_sursa,
    r.oem, daNu(r.originala), "second-hand", r.stare_nota,
    r.pret.toFixed(2), r.moneda, r.pret_sufix, "da", r.stoc,
    r.stoc > 0 ? "in stoc" : "epuizat",
    r.greutate_kg ?? "", daNu(r.greutate_estimata),
    r.poza, r.poze_suplimentare.join("|"), r.nr_poze,
    daNu(r.publicat), r.creat_la, r.actualizat_la,
  ];
}

/** Coloanele interne, pentru exportul din panou. Marja se calculează aici, o
 *  dată: în Excel ar fi o formulă pe care cineva o rupe la prima sortare. */
export function randIntern(r: RandFeed): (string | number)[] {
  const cost = r.cost_lei;
  const marja = cost === null ? "" : (r.pret - cost).toFixed(2);
  const proc = cost === null || r.pret === 0 ? "" : (((r.pret - cost) / r.pret) * 100).toFixed(1);
  return [cost ?? "", marja, proc, r.sursa, r.sursa_url, daNu(r.editat_manual), r.vizualizari];
}

export function csvGenericBucati(
  randuri: RandFeed[],
  optiuni: { separator?: string; bom?: boolean; cuDateInterne?: boolean } = {},
): string[] {
  const capuri = optiuni.cuDateInterne ? [...CAPURI_GENERIC, ...CAPURI_INTERNE] : CAPURI_GENERIC;
  const linii = randuri.map((r) =>
    optiuni.cuDateInterne ? [...randGeneric(r), ...randIntern(r)] : randGeneric(r));
  return csvBucati(capuri, linii, optiuni);
}

/** Fișierul întreg, ca șir — pentru descărcarea manuală din panou. */
export const csvGeneric = (
  randuri: RandFeed[],
  optiuni: { separator?: string; bom?: boolean; cuDateInterne?: boolean } = {},
) => csvGenericBucati(randuri, optiuni).join("");

/** Aceleași coloane, în XML. Numele etichetelor sunt cele din `CAPURI_GENERIC`,
 *  deci cele două formate rămân sincronizate prin construcție. */
export function xmlGenericBucati(randuri: RandFeed[]): string[] {
  const out: string[] = [];
  // Fără `numar="…"` în eticheta de deschidere: la generare în flux nu știm câte
  // rânduri urmează, iar un număr scris de dragul simetriei ar fi o minciună pe
  // care un importator o poate crede. Numărul se află numărând produsele.
  out.push(`<?xml version="1.0" encoding="UTF-8"?>\n<produse generat="${xmlText(new Date().toISOString())}" ` +
           `moneda="${MONEDA_FEED}" site="${xmlText(SITE_URL)}">\n`);
  for (const r of randuri) {
    const valori = randGeneric(r);
    const linii = CAPURI_GENERIC.map((c, i) => `    <${c}>${xmlText(valori[i])}</${c}>`);
    out.push(`  <produs>\n${linii.join("\n")}\n  </produs>\n`);
  }
  out.push(`</produse>\n`);
  return out;
}

/** Fișierul întreg, ca șir — pentru descărcarea manuală din panou. */
export const xmlGeneric = (randuri: RandFeed[]) => xmlGenericBucati(randuri).join("");
