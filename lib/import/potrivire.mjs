// ============================================================
// POTRIVIREA cu taxonomia proprie: marcă, model, categorie.
//
// Modul COMUN — regulile stau într-un singur loc, ca ce importă operatorul din
// admin să fie identic cu ce importă scriptul din terminal.
//
// Ambiguu sau inexistent => se lasă gol și se marchează pentru revizuire.
// Nu se inventează nimic.
// ============================================================

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
  if (!gasit) return { brand: null, model: null };
  const k = normalizeaza(gasit.cheie);
  let model = n === k ? null : n.slice(k.length).trim();
  if (model && ALIAS_MODELE[model]) model = ALIAS_MODELE[model];
  return { brand: gasit.brand, model };
}

export function potriveste(ext, taxonomie) {
  const { brands, models } = taxonomie;
  const rez = {
    brand_id: null, marca: null, model_id: null, model: null,
    nepotrivire_marca: false, nepotrivire_model: false, note: [],
  };

  // ---- sursa principală: câmpul de compatibilitate ----
  const primaCompat = ext.compat[0] ?? null;
  const { brand: bCompat, model: mCompat } = primaCompat
    ? despartCompat(primaCompat, brands) : { brand: null, model: null };

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
//   `creeaza`= true dacă subcategoria lipsește și utilizatorul a aprobat crearea ei
//              cu numele din `sub`
//
// NU se inventează nume aici. Un slug necunoscut nu produce o categorie cu numele
// tradus automat — ajunge în lista de la finalul raportului, iar utilizatorul decide.
// „ansamblu-stergatoare" a primit nume de la om: „Ștergătoare și spălare parbriz".
// ============================================================
export const REGULI_CATEGORII = {
  // --- aprobate 24 august ---
  "etriere":              { parinte: "Sistem de frânare",             sub: "Etriere" },
  "fuzeta":               { parinte: "Suspensie și direcție",         sub: "Fuzete și rulmenți" },
  "furtune-si-conducte":  { parinte: "Climatizare (AC) și încălzire", sub: "Conducte și furtunuri AC" },
  "ansamblu-stergatoare": { parinte: "Caroserie și exterior",         sub: "Ștergătoare și spălare parbriz", creeaza: true },
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

export function potrivesteCategoria(slugSursa, categories, pragPiese, nrPiese) {
  const rez = { categorie_id: null, categorie: null, subcategorie_id: null, subcategorie: null,
                de_creat: null, note: [] };
  const regula = REGULI_CATEGORII[slugSursa];
  const parinti = categories.filter((c) => c.parent_id === null);

  if (!regula) {
    rez.note.push(`categorie-sursă fără regulă: „${slugSursa}" — de decis`);
    return rez;
  }

  const par = parinti.find((c) => cheieLaxa(c.nume) === cheieLaxa(regula.parinte));
  if (!par) { rez.note.push(`categorie-părinte inexistentă: „${regula.parinte}"`); return rez; }
  rez.categorie_id = par.id; rez.categorie = par.nume;

  // `sub: null` = știm că nu avem subcategorie potrivită; rămâne doar părintele.
  if (!regula.sub) {
    rez.note.push(`fără subcategorie potrivită pentru „${slugSursa}" — rămâne categoria-părinte`);
    return rez;
  }

  const sub = categories.find((c) => c.parent_id === par.id && cheieLaxa(c.nume) === cheieLaxa(regula.sub));
  if (sub) { rez.subcategorie_id = sub.id; rez.subcategorie = sub.nume; return rez; }

  // Subcategoria lipsește.
  // `nrPiese == null` = importul merge în flux (din admin), lot cu lot, deci
  // numărul total de piese din categoria-sursă nu se știe încă. Atunci pragul nu
  // se poate evalua și nu se creează nimic: piesa rămâne pe categoria-părinte,
  // iar slug-ul apare în raportul jobului, ca omul să decidă.
  if (nrPiese == null) {
    rez.note.push(`subcategorie „${regula.sub}" inexistentă — rămâne categoria-părinte, de decis după import`);
  } else if (regula.creeaza && nrPiese >= pragPiese) {
    rez.de_creat = { nume: regula.sub, parent_id: par.id, parinte: par.nume };
    rez.note.push(`subcategorie de creat: „${regula.sub}" sub „${par.nume}" (${nrPiese} piese)`);
  } else if (regula.creeaza) {
    rez.note.push(`subcategorie „${regula.sub}" NU se creează: doar ${nrPiese} piese, pragul e ${pragPiese}`);
  } else {
    rez.note.push(`subcategorie „${regula.sub}" inexistentă — rămâne doar categoria-părinte`);
  }
  return rez;
}
