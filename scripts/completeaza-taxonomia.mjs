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
// Cu `--reciteste`, cere din nou pagina fiecărei piese de la sursă și reia
// compatibilitățile de acolo. E nevoie când extragerea s-a schimbat — de exemplu
// la 25 august 2026, când s-a descoperit că doar PRIMA mașină compatibilă e link
// în HTML, iar celelalte se pierdeau. Costă o cerere pe piesă, cu pauza politicoasă
// obișnuită, deci durează ~2 secunde pentru fiecare.
//
//   node scripts/completeaza-taxonomia.mjs             # doar raportează
//   node scripts/completeaza-taxonomia.mjs --scrie     # aplică
//   node scripts/completeaza-taxonomia.mjs --reciteste --scrie
// ============================================================
import { depozitDinMediu, SURSA, taxonomieDinUrl, potriveste, potrivesteCategoria,
         asiguraCategoria, asiguraModelul, asiguraModeleleInPlus, aducePagina, extrage,
         urlCanonic, pauzaPoliticoasa, aniDinTitlu, modelDinTitlu, numeModelNou } from "../lib/import/index.mjs";

const SCRIE = process.argv.includes("--scrie");
const RECITESTE = process.argv.includes("--reciteste");

const depozit = depozitDinMediu();
const taxonomie = await depozit.citesteTaxonomia();

// Toate piesele de la sursă, cu ce ne trebuie ca să decidem.
const piese = await depozit.citesteTotPentruCompletare(SURSA);

console.log(`${piese.length} piese de la ${SURSA}${SCRIE ? "" : "  ·  MOD RAPORT: nu se scrie nimic"}\n`);

const catNoi = [], modNoi = [], atinse = [], nerezolvate = [];
let recitite = 0, compatMaiBogate = 0;

// Modelele pe care rularea LE-AR CREA, strânse în modul raport. Fără lista asta,
// „--scrie" ar fi un salt în gol: se creează zeci de modele noi în tabela care
// alimentează filtrul de pe site, fără ca nimeni să le fi văzut înainte.
// Cheia e marca + numele, ca să se numere piesele care cer același model.
const propuse = new Map();
const propun = (marca, numeBrut, motiv, titlu) => {
  const nume = numeModelNou(numeBrut);
  const cheie = `${marca}|${nume}`;
  const x = propuse.get(cheie) ?? { marca, nume, motiv, piese: 0, exemplu: titlu };
  x.piese++; propuse.set(cheie, x);
};

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

  // ---------- compatibilitățile și modelele ----------
  // Cu `--reciteste`, lista vine din nou de la sursă: e singura cale de a repara
  // piesele importate pe vremea când se citea doar prima linie.
  let compat = p.compat ?? [];
  if (RECITESTE) {
    if (recitite > 0) await pauzaPoliticoasa();
    recitite++;
    const r = await aducePagina(p.sursa_url);
    if (r.ok) {
      const proaspat = extrage(r.html, urlCanonic(r.html, p.sursa_url)).compat;
      if (proaspat.length > compat.length) compatMaiBogate++;
      if (proaspat.length) compat = proaspat;
    } else nerezolvate.push(`${p.nume.slice(0, 40)} — pagina nu s-a putut reciti: ${r.eroare}`);
  }
  if (JSON.stringify(compat) !== JSON.stringify(p.compat ?? [])) patch.compat = compat;

  // Anii din titlu sunt obligatorii: fără ei nu se poate alege generația („Octavia 2"
  // vs „Octavia 3"), iar potrivirea ar rata modele pe care le avem deja.
  const ani = aniDinTitlu(p.nume);
  const ext = { titlu: p.nume, compat, an_min: ani[0] ?? null, an_max: ani[ani.length - 1] ?? null, erori: [] };
  const pot = potriveste(ext, taxonomie);
  let idsNoi = pot.model_ids;
  if (!idsNoi.length) {
    let m = null;
    if (SCRIE) m = await asiguraModelul(depozit, taxonomie, ext, pot);
    else {
      // Modul raport urmează EXACT decizia lui `asiguraModelul`, dar fără să scrie:
      // întâi modelele pe care le avem deja și pe care titlul le confirmă, abia apoi
      // crearea unuia nou din compatibilitate — și numai dacă titlul o confirmă.
      const d = modelDinTitlu(ext.titlu, taxonomie);
      if (d) m = { model_id: d.model.id, model: d.model.nume, nota: "din titlu" };
      else if (pot.brand_pentru_creare && pot.model_compat_brut) {
        const marca = taxonomie.brands.find((b) => b.id === pot.brand_pentru_creare);
        if (marca) propun(marca.nume, pot.model_compat_brut, "confirmat de titlu", p.nume);
      }
    }
    if (m) {
      idsNoi = [m.model_id];
      if (m.nota?.startsWith("model nou") && !modNoi.includes(m.model)) modNoi.push(m.model);
    }
  } else if (!SCRIE && (pot.de_creat_modele ?? []).length) {
    // Piesa are deja un model; restul liniilor sunt compatibilități în plus.
    // Aici nu se cere confirmarea titlului — vezi `asiguraModeleleInPlus`.
    for (const cerut of pot.de_creat_modele) {
      const marca = taxonomie.brands.find((b) => b.id === cerut.brand_id);
      if (marca) propun(marca.nume, cerut.nume, "compatibilitate în plus", p.nume);
    }
  } else if (SCRIE && (pot.de_creat_modele ?? []).length) {
    // Piesa are deja un model, dar sursa mai enumeră mașini pe care nu le avem.
    // Alea sunt compatibilități în plus, nu contradicții — se creează.
    const { adaugate } = await asiguraModeleleInPlus(depozit, taxonomie, pot);
    for (const id of adaugate) if (!idsNoi.includes(id)) idsNoi.push(id);
    for (const id of adaugate) {
      const mm = taxonomie.models.find((x) => x.id === id);
      if (mm && !modNoi.includes(mm.nume)) modNoi.push(mm.nume);
    }
  }
  const vechiIds = (p.model_ids ?? []).slice().sort();
  if (idsNoi.length && JSON.stringify(idsNoi.slice().sort()) !== JSON.stringify(vechiIds)) patch.model_ids = idsNoi;
  // Nerezolvată = rămâne chiar fără model. Una care are deja unul în bază, dar pe
  // care potrivirea de acum nu-l redescoperă din compatibilitate, nu e o problemă:
  // patch-ul n-o atinge, iar modelul ei rămâne pus.
  if (!idsNoi.length && !(p.model_ids ?? []).length) nerezolvate.push(`${p.nume.slice(0, 40)} — model`);

  if (!Object.keys(patch).length) continue;
  atinse.push({ id: p.id, nume: p.nume, patch });
  if (SCRIE) await depozit.actualizeazaPiesa(p.id, patch);
}

console.log(`piese de completat            ${atinse.length}`);
console.log(`  cu categorie                 ${atinse.filter((x) => x.patch.categorie_id).length}`);
console.log(`  cu subcategorie              ${atinse.filter((x) => x.patch.subcategorie_id).length}`);
console.log(`  cu model                     ${atinse.filter((x) => x.patch.model_ids).length}`);
if (RECITESTE) {
  console.log(`\npagini recitite               ${recitite}`);
  console.log(`  cu mai multe compatibilități ${compatMaiBogate}`);
}
const cuDouaPlus = atinse.filter((x) => (x.patch.model_ids ?? []).length > 1).length;
if (cuDouaPlus) console.log(`  piese legate de 2+ modele    ${cuDouaPlus}`);
if (catNoi.length) console.log(`\ncategorii care s-ar crea (${catNoi.length}):\n  ` + catNoi.join("\n  "));
if (modNoi.length) console.log(`\nmodele create (${modNoi.length}): ` + modNoi.join(", "));
if (propuse.size) {
  const lista = [...propuse.values()].sort((a, b) => b.piese - a.piese || a.marca.localeCompare(b.marca));
  console.log(`\nMODELE CARE S-AR CREA (${lista.length}) — de aprobat înainte de --scrie:`);
  console.log("  piese  marcă           model                     motiv");
  for (const x of lista)
    console.log(`  ${String(x.piese).padStart(5)}  ${x.marca.padEnd(14).slice(0, 14)}  ${x.nume.padEnd(24).slice(0, 24)}  ${x.motiv}`);
}
if (nerezolvate.length) {
  console.log(`\nrămân nerezolvate (${nerezolvate.length}):`);
  nerezolvate.slice(0, 15).forEach((x) => console.log("  · " + x));
}
console.log(SCRIE ? "\nScris în bază." : "\nNimic nu s-a scris. Rulează din nou cu --scrie ca să aplici.");
