// ============================================================
// DE LA DATELE EXTRASE LA RÂNDUL DIN `products`
//
// Numele coloanelor sunt cele reale, verificate în bază:
//   · titlul       → `nume`
//   · prețul       → `pret_lei` (nu `pret`)
//   · descrierea   → `stare_nota` (nu există `descriere`; adminul afișează
//                     `stare_nota` sub eticheta „Descriere")
//   · codul piesei → `oem`, scos din rândul „COD: …" al descrierii
//   · `stare`      → rămâne NULL: are CHECK pe A/B/C, iar starea A/B/C a fost
//                     scoasă din interfață (vezi CLAUDE.md)
//   · `cod_intern` → îl pune triggerul `set_cod_intern` (AP-000123)
//
// SCHIMBAREA DE REGULĂ DIN 25 AUGUST 2026 (partea A.0 din sarcină)
// Piesa se publică DIRECT, la import, cu pozele deja descărcate. Nu mai există
// pas de publicare separat, deci nici coloană `poze` goală: pozele se aduc
// înainte de inserare, iar `poze` intră completat de la bun început. Dacă
// descărcarea a eșuat, piesa se publică oricum, fără poze, iar motivul rămâne
// scris în `import_erori`, ca butonul „Reia pozele eșuate" să le găsească.
// ============================================================
import { normalizeaza } from "./potrivire.mjs";

export const slugifica = (s) => normalizeaza(s).replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 70).replace(/^-|-$/g, "");

/**
 * @param {any} x         rezultatul extragerii + potrivirii, cu `feed` și `sursa_id`
 * @param {any[]} categories  taxonomia noastră, pentru ilustrația de rezervă
 * @param {string[]} pozeProprii  URL-urile din bucketul nostru, după descărcare
 */
export function construiesteRand(x, categories, pozeProprii = []) {
  // `art` (ilustrația de rezervă) vine din categoria potrivită, nu se inventează.
  const cat = categories?.find((c) => c.id === (x.subcategorie_id ?? x.categorie_id));
  const revizuire = x.revizuire?.length ? x.revizuire : null;
  return {
    // identitate
    slug: `${slugifica(x.titlu ?? x.feed.Titlu)}-${x.sursa_id}`,   // sufixul de ID garantează unicitatea
    nume: x.titlu ?? x.feed.Titlu,
    // preț: din FEED, care e sursa autoritară pentru preț
    pret_lei: Number(x.feed.Pret),
    // conținut
    stare_nota: x.descriere ?? null,
    // Codul piesei, citit din rândul „COD: …" al descrierii (vezi `codOem` din
    // extragere.mjs). Piesele care n-au unul rămân cu `null` — se caută după
    // titlu, nu se inventează un cod.
    oem: x.oem ?? null,
    ani: x.an_min ? (x.an_min === x.an_max ? String(x.an_min) : `${x.an_min}–${x.an_max}`) : null,
    art: cat?.art ?? "engine",
    categorie_id: x.categorie_id ?? null,
    subcategorie_id: x.subcategorie_id ?? null,
    // TOATE modelele compatibile, nu doar cel principal: pagina sursei enumeră
    // mașinile pe care se potrivește piesa, iar coloana e `bigint[]`.
    model_ids: x.model_ids?.length ? x.model_ids : (x.model_id ? [x.model_id] : []),
    compat: x.compat?.length ? x.compat : [],
    // Greutatea nu există pe pieseauto.ro. Piesa primește 1 kg — marcat ca
    // estimat, ca nimeni să nu ia valoarea drept cântărită. Steagul cade pe
    // `false` când operatorul salvează o greutate reală. Detaliul comenzii
    // avertizează cu bandă galbenă dacă vreo piesă comandată încă îl are `true`.
    greutate_kg: 1,
    greutate_estimata: true,
    // stoc și vizibilitate — piesa intră publicată (A.0)
    stoc: 1,
    publicat: true,
    // proveniență
    sursa: "pieseauto.ro",
    sursa_id: x.sursa_id,
    sursa_url: x.sursa_url,
    sursa_activ: true,
    poze: pozeProprii,
    poze_sursa: x.poze ?? [],
    poze_descarcate: pozeProprii.length > 0,
    editat_manual: false,
    import_erori: revizuire ? { revizuire } : null,
  };
}

// Ce poate atinge un RE-import. Tot restul e muncă de operator și nu se
// suprascrie niciodată: poze, greutate_kg, categorie_id, subcategorie_id,
// cod_intern, originala, stare_nota (descrierea) și cost_lei.
// `nume` intră în listă doar dacă piesa n-a fost editată manual.
export const COLOANE_LA_REIMPORT = ["pret_lei", "sursa_url", "sursa_activ", "sursa_sincronizat_la"];

/** Ce se schimbă la o piesă care există deja. Întoarce `null` dacă nu e nimic
 *  de scris — un rând neatins e un rând care nu consumă nici cerere, nici timp. */
export function patchLaReimport(existent, feed) {
  const patch = {};
  if (Number(existent.pret_lei) !== Number(feed.Pret)) patch.pret_lei = Number(feed.Pret);
  if (!existent.editat_manual && feed.Titlu && existent.nume !== feed.Titlu) patch.nume = feed.Titlu;
  // O piesă care reapare în feed redevine activă. `publicat` NU se atinge:
  // rămâne cum l-a lăsat operatorul (regula A.3.3).
  if (existent.sursa_activ === false) patch.sursa_activ = true;
  return Object.keys(patch).length ? patch : null;
}

// ============================================================
// CIORNA — piesă nouă văzută DOAR în CSV (sincronizarea fără pagini)
//
// DE CE (cerut de proprietar, 15 septembrie 2026)
// pieseauto.ro blochează importul când îi cerem paginile pieselor noi. CSV-ul, în
// schimb, îl avem mereu: ID, URL, Titlu, Moneda, Pret. Din el se poate crea piesa,
// dar fără poze și fără descriere — alea stau doar pe pagina lor.
//
// Deci piesa intră NEPUBLICATĂ, marcată `import_erori.ciorna = true`, și apare în
// Admin → „Piese noi din CSV", unde operatorul pune pozele și descrierea (le vede
// deschizând `sursa_url` în browserul lui — pe el nu-l blochează) și o publică.
//
// Marcajul stă în `import_erori` (jsonb existent), nu într-o coloană nouă: așa
// sincronizarea merge din clipa publicării, fără migrare de rulat de mână.
// Cheia `ciorna` dispare când operatorul salvează piesa publicată (ProductForm).
//
// Ce se completează totuși singur: modelul și anii, din TITLU, cu regulile
// importului (`sugestieDinTitlu`). Categoria o completează formularul la deschidere,
// din votul pieselor existente — funcția aceea cere o sesiune de echipă.
// ============================================================

/** O piesă e ciornă dacă a intrat din CSV și încă n-a fost completată de om. */
export const esteCiorna = (p) => p?.import_erori?.ciorna === true;

/**
 * @param {any} feed      rândul din CSV ({ ID, URL, Titlu, Moneda, Pret })
 * @param {any} sugestie  rezultatul `sugestieDinTitlu` (poate fi null)
 */
export function construiesteCiorna(feed, sugestie) {
  const brand = sugestie?.brand ?? null, model = sugestie?.model ?? null;
  const ani = sugestie?.an_min
    ? (sugestie.an_min === sugestie.an_max ? String(sugestie.an_min) : `${sugestie.an_min}–${sugestie.an_max}`)
    : null;
  const note = ["piesă nouă din CSV: fără poze și fără descriere — de completat în „Piese noi din CSV”"];
  if (model) note.push(`model dedus din titlu: ${brand?.nume ?? ""} ${model.nume}`.replace(/\s+/g, " "));
  return {
    slug: `${slugifica(feed.Titlu)}-${feed.ID}`,
    nume: feed.Titlu,
    pret_lei: Number(feed.Pret),
    stare_nota: null,
    oem: null,
    ani,
    art: "engine",
    categorie_id: null,
    subcategorie_id: null,
    model_ids: model ? [model.id] : [],
    compat: model && brand ? [`${brand.nume} ${String(model.nume).replace(/\(.*$/, "").trim()}`] : [],
    greutate_kg: 1,
    greutate_estimata: true,
    stoc: 1,
    // NEPUBLICATĂ: pe site n-ar avea nici poză, nici descriere.
    publicat: false,
    sursa: "pieseauto.ro",
    sursa_id: feed.ID,
    sursa_url: feed.URL,
    sursa_activ: true,
    poze: [],
    poze_sursa: [],
    poze_descarcate: false,
    editat_manual: false,
    import_erori: { ciorna: true, revizuire: note },
  };
}
