// ============================================================
// DIN PIESA NOASTRĂ ÎNTR-UN ANUNȚ dez.ro
//
// Un singur loc care hotărăște CE se trimite. Motorul se ocupă de CÂND.
//
// ============================================================
// DECIZIILE, cu motivele lor
//
// TIPUL e mereu 0 („Piese Auto"). Celelalte patru tipuri ale lor descriu altceva
// (o mașină la dezmembrat, o mașină avariată, anvelope, piese de camion); noi
// trimitem piese, bucată cu bucată.
//
// MARCA nu se mapează separat, ci se ia din modelul lor: `idBrand` e părintele
// modelului ales. Așa e imposibil să trimitem un model care nu aparține mărcii
// trimise — o pereche greșită ar fi refuzată de ei, sau, mai rău, acceptată.
//
// MODELUL e cel PRINCIPAL al piesei (`model_ids[0]`), niciodată altul din listă.
// `model_ids` ține toate compatibilitățile („un radiator de Passat B6 se leagă
// legitim de 7 modele"), dar anunțul are un singur câmp. Primul e cel confirmat
// de titlu la import, adică mașina de pe care s-a demontat piesa. Dacă el n-are
// mapare, piesa NU se publică — a cădea pe a doua compatibilitate ar însemna un
// anunț de Sharan trecut la Ford Galaxy.
//
// ANUL se trimite DOAR dacă e neîndoielnic. Măsurat pe catalogul real: 8.695 de
// piese din 8.825 au în `ani` un INTERVAL („2008–2011"), 39 au un an singur, 91
// n-au nimic. Câmpul lor e un an, unul singur. Din „2008–2011" nu iese un an
// adevărat: 2008 ar spune că piesa e de pe o mașină din 2008, iar cumpărătorul
// cu un 2011 ar trece pe lângă ea. Deci intervalul intră în DESCRIERE, unde se
// citește întreg, iar câmpul rămâne gol („an necunoscut"). Dacă vreodată aflăm
// de la ei ce înseamnă exact filtrul lor pe an, se reia decizia asta.
//
// VARIANTA duce generația. Catalogul lor e plat („Passat", nu „Passat B6"), iar
// generația e exact lucrul care desparte o piesă care se potrivește de una care
// nu. Câmpul `variant` e text liber la ei — acolo îi e locul.
//
// DESCRIEREA pleacă de la `stare_nota`, care la piesele importate e chiar textul
// anunțului de la sursă. Peste el se adaugă doar ce ȘTIM: anii, compatibilitățile
// și codul intern. Nu se inventează nimic — nici garanții, nici stări, nici
// termene.
//
// FĂRĂ LINK CĂTRE SITE-UL NOSTRU. Un anunț pe un portal de anunțuri care trimite
// cumpărătorul pe alt magazin e, pe orice portal, motiv de respingere sau de
// suspendare a contului. Codul intern („AP-000123") face aceeași treabă fără
// riscul ăsta: clientul îl spune la telefon și piesa se găsește imediat.
//
// PREȚUL se rotunjește la leu — câmpul lor e întreg. `pret_sufix` („/ set")
// intră în descriere, fiindcă la ei nu există unde altundeva.
// ============================================================

import { createHash } from "node:crypto";
import { TIP_ANUNT, MAX_POZE, MAX_OCTETI_POZA } from "./api.mjs";

/** Cât de lung poate fi titlul trimis. Ei nu documentează nicio limită, dar un
 *  câmp de titlu pe un site vechi e aproape sigur `varchar`. 100 e sub orice
 *  limită plauzibilă și taie doar 56 din cele 8.825 de titluri ale noastre —
 *  și acelea la marginea unui cuvânt, nu în mijlocul lui. */
export const MAX_TITLU = 100;

/** Câte compatibilități se scriu în descriere. Peste atât devine un perete de
 *  text care ascunde restul; cine are nevoie de toate sună. */
const MAX_COMPAT_IN_DESCRIERE = 12;

/** Motivele pentru care o piesă NU poate deveni anunț. Textul e cel arătat în
 *  panou, deci e scris pentru om, nu pentru cod. */
export const MOTIVE = {
  faraPoza: "n-are nicio poză",
  faraModel: "n-are model de mașină",
  modelNemapat: "modelul nu e potrivit cu unul de pe dez.ro",
  faraCategorie: "n-are categorie",
  categorieNemapata: "categoria nu e potrivită cu una de pe dez.ro",
  modelFaraMarca: "modelul de pe dez.ro n-are marcă în catalogul adus",
};

const taie = (s, n) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  const scurt = t.slice(0, n);
  const spatiu = scurt.lastIndexOf(" ");
  return (spatiu > n * 0.6 ? scurt.slice(0, spatiu) : scurt).trim();
};

/** Anul, dacă e unul singur și numai atunci. Vezi „ANUL" din antet. */
export function anulSigur(ani) {
  const t = String(ani ?? "").trim();
  const gasite = t.match(/\b(19|20)\d{2}\b/g) ?? [];
  if (gasite.length !== 1) return 0;
  const an = Number(gasite[0]);
  return an >= 1900 && an <= 2100 ? an : 0;
}

/** Descrierea trimisă la ei. */
export function descriere(piesa, { numeModel = "", numeMarca = "" } = {}) {
  const parti = [];
  const nota = String(piesa.stare_nota ?? "").trim();
  // `stare_nota` începe de obicei cu titlul, fiindcă așa vine de la sursă. Nu se
  // scoate: pe pagina lor descrierea se citește singură, fără titlu deasupra.
  if (nota) parti.push(nota);
  else parti.push(`${piesa.nume}. Piesă auto second-hand, din dezmembrări.`);

  const detalii = [];
  // Anii dintre paranteze se scot din numele modelului: „A4 B8 (2008–2015)" e
  // intervalul GENERAȚIEI, iar rândul de dedesubt scrie deja anii PIESEI. Două
  // intervale unul sub altul, care nu spun același lucru, doar încurcă.
  const masina = [numeMarca, numeModel.replace(/\([^)]*\)/g, "").trim()].filter(Boolean).join(" ");
  if (masina) detalii.push(`Mașină: ${masina}`);
  if (piesa.ani) detalii.push(`Ani: ${piesa.ani}`);
  if (piesa.oem && String(piesa.oem).trim() && String(piesa.oem).trim() !== "-")
    detalii.push(`Cod OEM: ${String(piesa.oem).trim()}`);
  if (piesa.pret_sufix) detalii.push(`Preț ${String(piesa.pret_sufix).trim()}`);
  if (detalii.length) parti.push(detalii.join("\n"));

  const compat = (piesa.compat ?? []).filter(Boolean);
  if (compat.length) {
    const listate = compat.slice(0, MAX_COMPAT_IN_DESCRIERE);
    const rest = compat.length - listate.length;
    parti.push(
      `Se potrivește pe:\n${listate.map((c) => `· ${c}`).join("\n")}` +
      (rest > 0 ? `\n· și încă ${rest} ${rest === 1 ? "model" : "modele"} — întreabă-ne` : ""),
    );
  }

  if (piesa.cod_intern)
    parti.push(`Cod intern: ${piesa.cod_intern} — spune-l când suni și găsim piesa imediat.`);

  return parti.join("\n\n");
}

/**
 * Câmpurile anunțului, sau motivul pentru care piesa nu poate fi publicată.
 *
 * @param piesa   rândul din `products`
 * @param context { modele, categorii, catalog } — hărți gata făcute de motor,
 *                ca funcția asta să nu atingă baza de date niciodată
 * @returns {{ ok:true, campuri:object, amprenta:string } | { ok:false, motiv:string }}
 */
export function construieste(piesa, context) {
  const { mapariModele, mapariCategorii, catalogDupaId, modeleNoastre, marciNoastre } = context;

  if (!(piesa.poze ?? []).length) return { ok: false, motiv: MOTIVE.faraPoza };

  const modelLocal = (piesa.model_ids ?? [])[0];
  if (!modelLocal) return { ok: false, motiv: MOTIVE.faraModel };

  const idModel = mapariModele.get(modelLocal);
  if (!idModel) return { ok: false, motiv: MOTIVE.modelNemapat };

  const nodModel = catalogDupaId.get(`model:${idModel}`);
  const idMarca = nodModel?.parinte;
  if (!idMarca) return { ok: false, motiv: MOTIVE.modelFaraMarca };

  const categorieLocala = piesa.subcategorie_id ?? piesa.categorie_id;
  if (!categorieLocala) return { ok: false, motiv: MOTIVE.faraCategorie };

  const idCategorie = mapariCategorii.get(categorieLocala);
  if (!idCategorie) return { ok: false, motiv: MOTIVE.categorieNemapata };

  const modelNostru = modeleNoastre.get(modelLocal);
  const marcaNoastra = modelNostru ? marciNoastre.get(modelNostru.brand_id) : null;

  const campuri = {
    title: taie(piesa.nume, MAX_TITLU),
    description: descriere(piesa, {
      numeModel: modelNostru?.nume ?? "",
      numeMarca: marcaNoastra?.nume ?? "",
    }),
    type: TIP_ANUNT,
    idBrand: idMarca,
    idModel,
    idPart: idCategorie,
    year: anulSigur(piesa.ani),
    price: Math.round(Number(piesa.pret_lei) || 0),
    qty: Math.max(0, Number(piesa.stoc) || 0),
    // Generația, pe care catalogul lor plat n-o are. Vezi „VARIANTA" din antet.
    variant: modelNostru?.nume ? String(modelNostru.nume).replace(/\([^)]*\)/g, "").trim() : "",
    oem: piesa.oem && String(piesa.oem).trim() !== "-" ? String(piesa.oem).trim() : "",
  };

  return { ok: true, campuri, amprenta: amprentaCampuri(campuri) };
}

/**
 * Amprenta câmpurilor trimise.
 *
 * Fără ea, o resincronizare ar rescrie toate cele 8.700 de anunțuri la fiecare
 * rulare: ore de trafic pentru zero schimbări, pe un API care ne-a răspuns deja
 * cu 500 și 504. Cu ea, se retrimit doar piesele la care s-a schimbat ceva.
 *
 * Cheile se sortează înainte de serializare: altfel ordinea în care obiectul a
 * fost construit ar schimba amprenta fără ca vreun câmp să se fi schimbat, și
 * am retrimite tot catalogul după o refactorizare inocentă.
 */
export function amprentaCampuri(campuri) {
  const ordonat = Object.keys(campuri).sort().map((k) => [k, campuri[k]]);
  return createHash("sha1").update(JSON.stringify(ordonat)).digest("hex").slice(0, 16);
}

/**
 * Ce poze trebuie adăugate și care șterse.
 *
 * Comparația e pe ADRESELE NOASTRE, memorate în `dezro_anunturi.poze_trimise` —
 * nu pe ale lor, care sunt alte fișiere (le pun filigran înainte de stocare) și
 * n-au nicio legătură vizibilă cu ale noastre. Ordinea din `products.poze` e
 * păstrată: prima poză a piesei rămâne prima și la ei.
 */
export function diferentaPoze(pozeAcum, pozeTrimise, pozeDezro) {
  const trimise = pozeTrimise ?? [];
  const acum = (pozeAcum ?? []).slice(0, MAX_POZE);
  const deAdaugat = acum.filter((u) => !trimise.includes(u));
  const deSters = [];
  trimise.forEach((u, i) => {
    if (acum.includes(u)) return;
    // Pozele lor vin în aceeași ordine în care le-am trimis, deci indicele din
    // `poze_trimise` arată către rândul potrivit din `poze_dezro`.
    const alLor = (pozeDezro ?? [])[i];
    if (alLor?.id) deSters.push({ id: alLor.id, url: u });
  });
  // Plafonul lor: 10 cu totul. Ce ar depăși e ignorat tăcut de ei, deci mai bine
  // nici nu plecăm cu ele.
  const loc = MAX_POZE - (trimise.length - deSters.length);
  return { deAdaugat: deAdaugat.slice(0, Math.max(0, loc)), deSters };
}

/**
 * Aduce o poză de la noi din Storage, gata de urcat la ei.
 * Întoarce `null` dacă nu se poate — o poză lipsă nu are voie să oprească un
 * anunț întreg; anunțul pleacă cu pozele care s-au putut aduce.
 */
export async function aducePoza(url, timeoutMs = 15_000) {
  try {
    const stop = AbortSignal.timeout ? AbortSignal.timeout(timeoutMs) : undefined;
    const r = await fetch(url, { signal: stop });
    if (!r.ok) return null;
    const brut = Buffer.from(await r.arrayBuffer());
    if (!brut.length || brut.length > MAX_OCTETI_POZA) return null;
    const tip = r.headers.get("content-type") || "image/webp";
    const nume = (url.split("/").pop() || "poza.webp").split("?")[0];
    return { nume, tip, date: brut, url };
  } catch {
    return null;
  }
}
