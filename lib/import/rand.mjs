// ============================================================
// DE LA DATELE EXTRASE LA RÂNDUL DIN `products`
//
// Numele coloanelor sunt cele reale, verificate în bază:
//   · titlul       → `nume`
//   · prețul       → `pret_lei` (nu `pret`)
//   · descrierea   → `stare_nota` (nu există `descriere`; adminul afișează
//                     `stare_nota` sub eticheta „Descriere")
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
