// ============================================================
// POTRIVIREA cu taxonomia proprie: marcă, model, categorie.
//
// Modul COMUN — regulile stau într-un singur loc, ca ce importă operatorul din
// admin să fie identic cu ce importă scriptul din terminal.
//
// Ambiguu sau inexistent => se lasă gol și se marchează pentru revizuire.
// Nu se inventează nimic.
// ============================================================

import TAXONOMIE_SURSA from "./taxonomie-sursa.mjs";

export const normalizeaza = (s) => (s ?? "").toString().toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[șş]/g, "s").replace(/[țţ]/g, "t").replace(/[ăâ]/g, "a").replace(/î/g, "i")
  .replace(/[^a-z0-9]+/g, " ").trim();

// Variante de nume care NU sunt modele distincte, ci versiuni de echipare.
// „Caddy Life" e varianta pentru pasageri a lui Caddy, nu un model separat
// (verificat 25 august 2026), deci piesele lui aparțin aceluiași model.
// Se adaugă aici doar cazuri verificate, nu presupuneri.
const ALIAS_MODELE = { "caddy life": "caddy", "caddy maxi": "caddy" };

/** Desparte „Volkswagen Polo 6R" în marcă + model, folosind lista noastră de mărci:
 *  marca e cel mai lung prefix care se potrivește, restul e modelul. */
export function despartCompat(text, brands) {
  const n = normalizeaza(text);
  let gasit = null;
  for (const b of brands) {
    for (const cheie of [b.nume, b.slug]) {
      const k = normalizeaza(cheie);
      if (k && (n === k || n.startsWith(k + " ")) && (!gasit || k.length > normalizeaza(gasit.cheie).length))
        gasit = { brand: b, cheie };
    }
  }
  if (!gasit) return { brand: null, model: null, modelBrut: null };
  const k = normalizeaza(gasit.cheie);
  let model = n === k ? null : n.slice(k.length).trim();
  if (model && ALIAS_MODELE[model]) model = ALIAS_MODELE[model];
  // Scrierea originală a modelului („A4 B7", nu „a4 b7"), pentru cazul în care
  // trebuie creat: un nume de model se scrie cum îl scrie omul, nu normalizat.
  const cuvinteMarca = k.split(" ").length;
  const brut = text.trim().split(/\s+/).slice(cuvinteMarca).join(" ") || null;
  return { brand: gasit.brand, model, modelBrut: model ? brut : null };
}

/** Modelul căutat direct în titlu, printre cele pe care le avem deja.
 *
 *  Plasă pentru cazul în care compatibilitatea sursei se contrazice cu titlul —
 *  se întâmplă: „Maneta Tempomat Vw Golf 5" are compatibilitatea trecută la
 *  „Jetta", iar „Debitmetru Aer Vw Sharan" la „Ford Galaxy". Titlul e scris de
 *  vânzător și, la verificarea de la 25 august 2026, n-a greșit niciodată când
 *  s-a contrazis cu restul. Se acceptă doar potrivirea fără dubiu: o singură
 *  marcă și un singur model găsite în titlu. */
export function modelDinTitlu(titlu, { brands, models }) {
  const t = " " + normalizeaza(titlu) + " ";
  const marci = brands.filter((b) => [b.nume, b.slug].some((x) => t.includes(" " + normalizeaza(x) + " ")));
  if (marci.length !== 1) return null;
  const marca = marci[0];
  const baza = (m) => normalizeaza(m.nume.replace(/\(.*$/, ""));
  const gasite = models.filter((m) => m.brand_id === marca.id && baza(m) && t.includes(" " + baza(m) + " "));
  if (!gasite.length) return null;
  // Cel mai specific câștigă: „Golf 5" bate „Golf", dacă amândouă apar.
  gasite.sort((a, b) => baza(b).length - baza(a).length);
  if (gasite.length > 1 && baza(gasite[0]).length === baza(gasite[1]).length) return null;
  return { brand: marca, model: gasite[0] };
}

export function potriveste(ext, taxonomie) {
  const { brands, models } = taxonomie;
  const rez = {
    brand_id: null, marca: null, model_id: null, model: null,
    nepotrivire_marca: false, nepotrivire_model: false, note: [],
  };

  // ---- sursa principală: câmpul de compatibilitate ----
  const primaCompat = ext.compat[0] ?? null;
  const { brand: bCompat, model: mCompat, modelBrut } = primaCompat
    ? despartCompat(primaCompat, brands) : { brand: null, model: null, modelBrut: null };

  // Se pun de la început, ca să existe pe TOATE căile de ieșire: motorul are
  // nevoie de ele ca să poată crea modelul lipsă, iar funcția asta iese devreme
  // din mai multe ramuri. `potriveste` rămâne pură — creează motorul, nu ea.
  rez.model_compat = mCompat;
  rez.model_compat_brut = modelBrut;

  if (bCompat) { rez.brand_id = bCompat.id; rez.marca = bCompat.nume; }
  else rez.note.push(primaCompat ? `marcă nerecunoscută în compatibilitate: „${primaCompat}"` : "compatibilitate absentă");

  if (rez.brand_id && mCompat) {
    const aleMarcii = models.filter((m) => m.brand_id === rez.brand_id);
    const baza = (m) => normalizeaza(m.nume.replace(/\(.*$/, ""));

    // 1. Potrivire exactă pe numele fără paranteză („A4 B8" din „A4 B8 (2008–2015)").
    const exact = aleMarcii.filter((m) => baza(m) === mCompat);
    if (exact.length === 1) { rez.model_id = exact[0].id; rez.model = exact[0].nume; }
    else if (exact.length > 1) rez.note.push(`model ambiguu: „${mCompat}"`);
    else {
      // 2. Sursa nu spune generația („Skoda Octavia", noi avem „Octavia 2" și „Octavia 3").
      //    Dezambiguizăm după anii din titlu, comparați cu intervalul din numele modelului.
      const candidati = aleMarcii.filter((m) => baza(m).startsWith(mCompat + " "));
      if (!candidati.length) { rez.note.push(`model negăsit la ${rez.marca}: „${mCompat}"`); return rez; }
      if (ext.an_min == null) {
        rez.note.push(`generație nedeterminabilă pentru „${mCompat}": titlul n-are ani`);
        return rez;
      }
      const incap = candidati.filter((m) => {
        const iv = m.nume.match(/\((\d{4})\s*[–-]\s*(\d{4})\)/);
        if (!iv) return false;
        return ext.an_min >= +iv[1] && ext.an_max <= +iv[2];
      });
      if (incap.length === 1) {
        rez.model_id = incap[0].id; rez.model = incap[0].nume;
        rez.generatie_dedusa = true;
        rez.note.push(`generație dedusă din ani (${ext.an_min}–${ext.an_max}) → ${incap[0].nume}`);
      } else if (incap.length > 1) {
        rez.note.push(`generație ambiguă pentru „${mCompat}": anii ${ext.an_min}–${ext.an_max} se suprapun peste ${incap.map((m) => m.nume).join(" și ")}`);
      } else {
        rez.note.push(`generație negăsită pentru „${mCompat}": anii ${ext.an_min}–${ext.an_max} nu încap în niciun interval`);
      }
    }
  } else if (rez.brand_id && !mCompat) rez.note.push("model absent din compatibilitate");

  // ---- verificare pe TITLU ----
  // Verificarea față de URL a fost scoasă la 25 august 2026: pe 50 de produse,
  // URL-ul se contrazicea cu `q-car-model` în 66% din cazuri, iar în cele 25 de
  // dezacorduri tranșate de titlu URL-ul n-a avut dreptate NICIODATĂ. Marca 48
  // din 50 de piese pentru revizuire — zgomot, nu semnal.
  //
  // Titlul e scris de vânzător și e sursa cea mai apropiată de adevăr. Dacă modelul
  // din `q-car-model` nu apare în titlu, ceva e greșit la sursă — așa s-au găsit
  // „Balast Xenon Skoda Octavia" pus la Nissan Qashqai și „Debitmetru Vw Sharan"
  // pus la Ford Galaxy.
  if (mCompat) {
    // Comparăm pe cuvinte, nu pe șir continuu. Vânzătorul scrie „Vw Passat 3c b6",
    // iar sursa spune „Passat B6": cuvintele sunt aceleași, dar are „3c" între ele.
    // O căutare de subșir ar fi marcat 10 din 11 piese degeaba.
    const cuvinteTitlu = new Set(normalizeaza(ext.titlu ?? "").split(" "));
    const lipsesc = mCompat.split(" ").filter((c) => c && !cuvinteTitlu.has(c));
    if (lipsesc.length) {
      rez.nepotrivire_titlu = true;
      rez.note.push(`⚠ modelul „${mCompat}" nu apare în titlu (lipsesc: ${lipsesc.join(", ")}): „${ext.titlu ?? ""}"`);
    }
  }
  if (bCompat) {
    const t = " " + normalizeaza(ext.titlu ?? "") + " ";
    const marcaInTitlu = [bCompat.nume, bCompat.slug].some((k) => t.includes(" " + normalizeaza(k) + " "));
    if (!marcaInTitlu) {
      rez.nepotrivire_marca = true;
      rez.note.push(`⚠ MARCA „${bCompat.nume}" nu apare în titlu: „${ext.titlu ?? ""}"`);
    }
  }

  return rez;
}

// ============================================================
// CATEGORII — de la slug-ul sursei la taxonomia noastră
//
// Regulile aprobate de utilizator. Cheia e slug-ul din URL-ul pieseauto.ro.
//   `sub`    = numele subcategoriei noastre (se caută lax: fără diacritice, fără
//              majuscule, singular/plural)
//   `parinte`= numele categoriei de nivel 1
//
// `sub: null` = părintele e ales de om, dar subcategoria o dă numele de la sursă.
//
// Tabelul ăsta NU mai e singura cale: din 25 august 2026, o categorie-sursă fără
// regulă nu mai rămâne fără categorie — primește numele și grupa din catalogul
// lor (`taxonomie-sursa.mjs`). Regulile rămân fiindcă traduc mai bine decât
// automatismul: „Răcitor gaze" ajunge la „EGR și Clapetă acceleratie", unde îl
// caută un mecanic, nu la radiatoare.
// ============================================================
export const REGULI_CATEGORII = {
  // --- aprobate 24 august ---
  "etriere":              { parinte: "Sistem de frânare",             sub: "Etriere" },
  "fuzeta":               { parinte: "Suspensie și direcție",         sub: "Fuzete și rulmenți" },
  "furtune-si-conducte":  { parinte: "Climatizare (AC) și încălzire", sub: "Conducte și furtunuri AC" },
  "ansamblu-stergatoare": { parinte: "Caroserie și exterior",         sub: "Ștergătoare și spălare parbriz" },
  // --- aprobate 25 august, după Etapa 2 ---
  "electromotor":         { parinte: "Motor și anexe",                sub: "Electromotor" },
  "egr":                  { parinte: "Motor și anexe",                sub: "EGR și Clapetă acceleratie" },
  // Răcitorul de gaze e parte din sistemul EGR, nu din răcirea motorului:
  // un mecanic îl caută acolo, nu la radiatoare.
  "racitor-gaze":         { parinte: "Motor și anexe",                sub: "EGR și Clapetă acceleratie" },
  "radiator-clima-ac":    { parinte: "Climatizare (AC) și încălzire", sub: "Radiator AC (condensator)" },
  "radiator-apa":         { parinte: "Motor și anexe",                sub: "Radiatoare și Ventilatoare" },
  "intercooler":          { parinte: "Motor și anexe",                sub: "Intercooler", creeaza: true },
  "broasca":              { parinte: "Caroserie și exterior",         sub: "Broaște și încuietori", creeaza: true },
  "debitmetru":           { parinte: "Electrice și senzori",          sub: "Senzori motor" },
  "injectoare":           { parinte: "Motor și anexe",                sub: "Injectoare și rampă" },
  "usa-fata":             { parinte: "Caroserie și exterior",         sub: "Ușă față" },
  "usa-spate":            { parinte: "Caroserie și exterior",         sub: "Ușă spate" },
  "balast-xenon":         { parinte: "Optică și faruri",              sub: "Bloc xenon și balast" },
  "centuri-siguranta":    { parinte: "Interior și tapițerie",         sub: "Centuri de siguranță" },
  // --- aprobate 25 august, după primul import complet al feed-ului ---
  // Toate cele de mai jos aveau deja o subcategorie potrivită în structura
  // noastră, cu nume aproape identic; lipsea doar regula care să le lege.
  "clapeta-acceleratie":  { parinte: "Motor și anexe",                sub: "EGR și Clapetă acceleratie" },
  "capac-distributie":    { parinte: "Motor și anexe",                sub: "Curele și distribuție" },
  "motor":                { parinte: "Motor și anexe",                sub: "Motor complet" },
  "electroventilator":    { parinte: "Motor și anexe",                sub: "Radiatoare și Ventilatoare" },
  "planetare":            { parinte: "Cutie de viteze și transmisie", sub: "Planetare și cardan" },
  "panou-sigurante":      { parinte: "Electrice și senzori",          sub: "Panou de siguranțe" },
  "contact-auto":         { parinte: "Electrice și senzori",          sub: "Contact și cheie" },
  "carcasa-baterie-auto": { parinte: "Electrice și senzori",          sub: "Baterie și borne" },
  "bandouri":             { parinte: "Caroserie și exterior",         sub: "Grile și ornamente" },
  // Coșul general pentru airbag-uri, ales de utilizator la 25 august: categoria-sursă
  // „airbag" e generică, iar „Interior și tapițerie / Airbag volan" ar încadra greșit
  // airbag-urile de bord sau laterale care vin din aceeași categorie a sursei.
  "airbag":               { parinte: "Electrice și senzori",          sub: "Airbag-uri și centuri" },
  "spirala-airbag":       { parinte: "Electrice și senzori",          sub: "Airbag-uri și centuri" },
  // Cele de mai jos n-au subcategorie potrivită în structura noastră. Rămân pe
  // categoria-părinte și se marchează, conform regulii: sub 3 piese nu se creează
  // subcategorie, fiindcă una cu o singură piesă face filtrarea mai grea.
  "maneta-tempomat":      { parinte: "Electrice și senzori",          sub: null },
  "torpedou":             { parinte: "Interior și tapițerie",         sub: null },
  "alarme-auto":          { parinte: "Electrice și senzori",          sub: null },
};

/** Sub pragul ăsta nu se creează subcategorie: o subcategorie cu o singură piesă
 *  face filtrarea mai grea, nu mai ușoară. */
export const PRAG_CATEGORIE = 3;

/** Potrivire laxă: fără diacritice, fără majuscule, și cu plural/singular tratat
 *  la fel, ca „Ștergătoare" și „stergatoare" să nu devină două categorii. */
export const cheieLaxa = (s) => normalizeaza(s).replace(/\b(uri|urile|ele|ile|le|i|e)\b/g, "").replace(/(uri|ele|ile)$/, "").replace(/\s+/g, " ").trim();

// ============================================================
// GRUPELE LOR -> CATEGORIILE-PĂRINTE ALE NOASTRE
//
// pieseauto.ro are două niveluri: 33 de grupe (titlurile din /categorii/) și 742
// de categorii. Breadcrumb-ul produsului arată doar categoria, nu și grupa — de
// asta grupa se ia din `taxonomie-sursa.json`.
//
// Aici sunt trecute DOAR grupele care se suprapun limpede peste unul din cei 10
// părinți construiți de utilizator, fiecare justificată de o subcategorie care
// există deja acolo (ex. „Turbo" -> „Motor și anexe", unde e deja „Turbină").
// O grupă netrecută aici NU se forțează: devine ea însăși categorie-părinte, cu
// numele ei. Așa nu inventăm apartenențe, iar utilizatorul poate muta pe urmă.
// ============================================================
export const GRUPE_LA_PARINTE = {
  "Piese motoare":                 "Motor și anexe",
  "Răcire":                        "Motor și anexe",   // radiatoare, ventilatoare
  "Turbo":                         "Motor și anexe",   // are deja „Turbină"
  "Evacuare":                      "Motor și anexe",   // are deja „Galerie admisie / evacuare"
  "Pompe și injectoare":           "Motor și anexe",   // are deja „Injectoare și rampă"
  "Aprindere":                     "Motor și anexe",
  "Transmisie":                    "Cutie de viteze și transmisie",
  "Frâne":                         "Sistem de frânare",
  "Caroserie":                     "Caroserie și exterior",
  "Direcție":                      "Suspensie și direcție",
  "Suspensie":                     "Suspensie și direcție",
  "Punte și rulmenți":             "Suspensie și direcție",
  "Electrică & Electronică Auto":  "Electrice și senzori",
  "Faruri stopuri lumini":         "Optică și faruri",
  "Xenon":                         "Optică și faruri",  // are deja „Bloc xenon și balast"
  "Interioare auto":               "Interior și tapițerie",
  "Jante & Anvelope":              "Roți, jante și anvelope",
  "Accesorii roți":                "Roți, jante și anvelope",
  "Climatizare":                   "Climatizare (AC) și încălzire",
};

/** Ce știe sursa despre o categorie de-a ei: numele omenesc și grupa. */
export const categoriaSursa = (slug) => TAXONOMIE_SURSA[slug] ?? null;

/**
 * Unde intră o piesă, plecând de la categoria din URL-ul sursei.
 *
 * Ordinea deciziei:
 *   1. dacă există o regulă scrisă de om, ea dă părintele (și subcategoria, dacă
 *      o numește) — traducerile aprobate sunt mai bune decât orice automatism;
 *   2. altfel părintele vine din grupa sursei, prin `GRUPE_LA_PARINTE`; o grupă
 *      nemapată devine ea însăși părinte, cu numele ei;
 *   3. subcategoria e numele lor („Carcasă filtru aer"), dacă regula nu-l dă.
 *
 * Ce nu există încă în baza noastră se întoarce în `de_creat`, iar motorul îl
 * creează. Din 25 august 2026 nimic nu mai rămâne fără categorie — decizie
 * explicită a utilizatorului, care înlocuiește vechea regulă „ce nu se potrivește
 * se lasă gol". Singurul caz rămas gol e o categorie-sursă care lipsește și din
 * catalogul lor: atunci chiar n-avem de unde lua un nume.
 */
export function potrivesteCategoria(slugSursa, categories) {
  const rez = { categorie_id: null, categorie: null, subcategorie_id: null, subcategorie: null,
                de_creat: null, note: [] };
  if (!slugSursa) { rez.note.push("categorie-sursă absentă în URL"); return rez; }

  const regula = REGULI_CATEGORII[slugSursa];
  const sursa = categoriaSursa(slugSursa);

  const numeParinte = regula?.parinte ?? (sursa ? (GRUPE_LA_PARINTE[sursa.grup] ?? sursa.grup) : null);
  if (!numeParinte) {
    rez.note.push(`categorie-sursă „${slugSursa}" necunoscută și absentă din catalogul lor — rulează scripts/actualizeaza-taxonomie-sursa.mjs`);
    return rez;
  }
  // Regula poate numi subcategoria; dacă nu (`sub: null` sau regulă inexistentă),
  // se folosește numele lor. Așa părintele ales de om e păstrat, dar piesa capătă
  // totuși o subcategorie, în loc să stea direct pe părinte.
  const numeSub = regula?.sub ?? sursa?.nume ?? null;

  const par = categories.find((c) => c.parent_id === null && cheieLaxa(c.nume) === cheieLaxa(numeParinte));
  if (par) { rez.categorie_id = par.id; rez.categorie = par.nume; }

  if (par && numeSub) {
    const sub = categories.find((c) => c.parent_id === par.id && cheieLaxa(c.nume) === cheieLaxa(numeSub));
    if (sub) { rez.subcategorie_id = sub.id; rez.subcategorie = sub.nume; return rez; }
  }

  rez.de_creat = {
    parinte: par ? { id: par.id, nume: par.nume } : { id: null, nume: numeParinte },
    sub: numeSub ? { nume: numeSub } : null,
  };
  if (!par) rez.note.push(`categorie-părinte nouă, din grupa lor: „${numeParinte}"`);
  if (numeSub) rez.note.push(`subcategorie nouă, cu numele de la sursă: „${numeSub}" sub „${numeParinte}"`);
  return rez;
}
