// ============================================================
// COMPLETEAZĂ CATEGORIA ȘI MODELUL PIESELOR DEJA IMPORTATE
//
// Regulile noi de taxonomie (categoriile luate din catalogul pieseauto.ro) se
// aplică la import. Piesele intrate ÎNAINTE de ele rămân însă cum au fost, iar un
// re-import nu le repară: `patchLaReimport` atinge doar prețul, numele și
// `sursa_activ` — categoria e muncă de operator și nu se suprascrie niciodată.
//
// Scriptul ăsta le aduce la zi, o singură dată, folosind EXACT aceleași funcții
// ca importul (`potrivesteCategoria`, `asiguraCategoria`, `asiguraModelul`), ca să
// nu existe două seturi de reguli care se despart în timp.
//
// Ce NU atinge:
//   · piesele cu `editat_manual` — acolo a lucrat un om;
//   · categoria deja pusă pe o piesă — se completează doar ce lipsește;
//   · greutatea — pieseauto.ro nu o publică, deci n-are de unde veni.
//
//   node scripts/completeaza-taxonomia.mjs          # doar raportează
//   node scripts/completeaza-taxonomia.mjs --scrie  # aplică
// ============================================================
import { depozitDinMediu, SURSA, taxonomieDinUrl, potriveste, potrivesteCategoria,
         asiguraCategoria, asiguraModelul } from "../lib/import/index.mjs";

const SCRIE = process.argv.includes("--scrie");

const depozit = depozitDinMediu();
const taxonomie = await depozit.citesteTaxonomia();

// Toate piesele de la sursă, cu ce ne trebuie ca să decidem.
const piese = await depozit.citesteTotPentruCompletare(SURSA);

console.log(`${piese.length} piese de la ${SURSA}${SCRIE ? "" : "  ·  MOD RAPORT: nu se scrie nimic"}\n`);

const catNoi = [], modNoi = [], atinse = [], nerezolvate = [];

for (const p of piese) {
  if (p.editat_manual) continue;
  const patch = {};

  // ---------- categoria ----------
  if (!p.categorie_id || !p.subcategorie_id) {
    const slug = taxonomieDinUrl(p.sursa_url).categorie;
    const cat = potrivesteCategoria(slug, taxonomie.categories);
    if (cat.de_creat) {
      if (SCRIE) {
        const facute = await asiguraCategoria(depozit, taxonomie, cat.de_creat);
        cat.categorie_id = facute.categorie_id; cat.subcategorie_id = facute.subcategorie_id;
        cat.categorie = facute.categorie; cat.subcategorie = facute.subcategorie;
      } else {
        // În modul raport nu se creează nimic, dar spunem ce s-ar crea.
        const et = `${cat.de_creat.parinte.nume}${cat.de_creat.sub ? " / " + cat.de_creat.sub.nume : ""}`;
        if (!catNoi.includes(et)) catNoi.push(et);
      }
    }
    if (cat.categorie_id && cat.categorie_id !== p.categorie_id) patch.categorie_id = cat.categorie_id;
    if (cat.subcategorie_id && cat.subcategorie_id !== p.subcategorie_id) patch.subcategorie_id = cat.subcategorie_id;
    if (!cat.categorie_id && !cat.de_creat) nerezolvate.push(`${p.nume.slice(0, 40)} — categorie „${slug}"`);
  }

  // ---------- modelul ----------
  if (!(p.model_ids ?? []).length) {
    const ext = { titlu: p.nume, compat: p.compat ?? [], an_min: null, an_max: null, erori: [] };
    const pot = potriveste(ext, taxonomie);
    let m = pot.model_id ? { model_id: pot.model_id, model: pot.model, nota: "din compatibilitate" } : null;
    if (!m && SCRIE) m = await asiguraModelul(depozit, taxonomie, ext, pot);
    if (!m && !SCRIE) {
      const { modelDinTitlu } = await import("../lib/import/potrivire.mjs");
      const d = modelDinTitlu(ext.titlu, taxonomie);
      if (d) m = { model_id: d.model.id, model: d.model.nume, nota: "din titlu" };
    }
    if (m) {
      patch.model_ids = [m.model_id];
      if (m.nota?.startsWith("model nou") && !modNoi.includes(m.model)) modNoi.push(m.model);
    } else nerezolvate.push(`${p.nume.slice(0, 40)} — model`);
  }

  if (!Object.keys(patch).length) continue;
  atinse.push({ id: p.id, nume: p.nume, patch });
  if (SCRIE) await depozit.actualizeazaPiesa(p.id, patch);
}

console.log(`piese de completat            ${atinse.length}`);
console.log(`  cu categorie                 ${atinse.filter((x) => x.patch.categorie_id).length}`);
console.log(`  cu subcategorie              ${atinse.filter((x) => x.patch.subcategorie_id).length}`);
console.log(`  cu model                     ${atinse.filter((x) => x.patch.model_ids).length}`);
if (catNoi.length) console.log(`\ncategorii care s-ar crea (${catNoi.length}):\n  ` + catNoi.join("\n  "));
if (modNoi.length) console.log(`\nmodele create (${modNoi.length}): ` + modNoi.join(", "));
if (nerezolvate.length) {
  console.log(`\nrămân nerezolvate (${nerezolvate.length}):`);
  nerezolvate.slice(0, 15).forEach((x) => console.log("  · " + x));
}
console.log(SCRIE ? "\nScris în bază." : "\nNimic nu s-a scris. Rulează din nou cu --scrie ca să aplici.");
