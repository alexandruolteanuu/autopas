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

/**
 * Sinonime de marcă: alt nume scris de sursă -> slug-ul mărcii de la noi.
 *
 * Tabelul ăsta e MĂSURAT, nu scris din memorie. La 28 august 2026 s-au numărat
 * toate cele 12.410 linii de compatibilitate din bază, pe forme: sursa scrie
 * „Mercedes …" (438 de linii) și niciodată „Mercedes-Benz"; „Land Rover …" (206)
 * și niciodată „Range Rover"; „SsangYong …" (68) și niciodată „KGM". Nu apare
 * nicăieri „VAG" sau „MB". Deci sinonimele care păreau evidente din memorie
 * n-aveau niciun rând în spate și n-au fost adăugate.
 *
 * Rămâne unul singur, și e pentru viitor, nu pentru trecut: marca se cheamă azi
 * oficial „KGM", după ce SsangYong a fost cumpărată. Noi o ținem sub numele pe
 * care îl caută clientul — cine vrea o piesă de Rexton scrie „SsangYong" — dar
 * dacă feed-ul începe mâine să scrie numele nou, tot o recunoaștem.
 */
export const SINONIME_MARCI = {
  "kgm": "ssangyong",
  "kgm ssangyong": "ssangyong",
};

/** Toate denumirile sub care poate apărea o marcă: numele ei, slug-ul, plus
 *  sinonimele măsurate. Un singur loc, ca potrivirea din compatibilitate și cea
 *  din titlu să folosească exact aceeași listă. */
export function cheiMarca(b) {
  const chei = [b.nume, b.slug];
  for (const [sinonim, slug] of Object.entries(SINONIME_MARCI))
    if (slug === b.slug) chei.push(sinonim);
  return chei;
}

/** Numele unui model NOU, scris cum îl scrie omul. Sursa e inconsecventă cu
 *  majusculele („jumpy" lângă „Jumper"), iar în filtrul de pe site modelele stau
 *  unul sub altul, deci diferența se vede. Se atinge DOAR prima literă: „CX-5",
 *  „S-cross" sau „ix35" își păstrează restul scrierii exact cum vine de la sursă. */
export const numeModelNou = (s) => (s ?? "").trim().replace(/^\p{Ll}/u, (c) => c.toUpperCase());

/** Desparte „Volkswagen Polo 6R" în marcă + model, folosind lista noastră de mărci:
 *  marca e cel mai lung prefix care se potrivește, restul e modelul. */
export function despartCompat(text, brands) {
  const n = normalizeaza(text);
  let gasit = null;
  for (const b of brands) {
    for (const cheie of cheiMarca(b)) {
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
  const marci = brands.filter((b) => cheiMarca(b).some((x) => t.includes(" " + normalizeaza(x) + " ")));
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

// Capetele deschise ale unui interval de generație. `an_start` gol = „dinainte de
// ce ne interesează"; `an_final` gol = „încă în producție". Nu sunt ani reali, ci
// margini, alese în afara intervalului acceptat de constrângerea din bază.
const AN_MINIM = 1900;
const AN_MAXIM = 2200;

/** Potrivirea UNEI singure linii de compatibilitate („Volkswagen Sharan"). */
function potrivesteOLinie(text, ext, taxonomie) {
  const { brands, models } = taxonomie;
  const out = { brand: null, model: null, normalizat: null, brut: null,
                generatieDedusa: false, generatiiCandidate: false, note: [] };
  const { brand, model: mCompat, modelBrut } = despartCompat(text, brands);
  out.normalizat = mCompat;
  out.brut = modelBrut;

  if (!brand) { out.note.push(`marcă nerecunoscută în compatibilitate: „${text}"`); return out; }
  out.brand = brand;

  // ---- verificare încrucișată pe MARCĂ ----
  //
  // Aceeași idee ca verificarea pe model, mutată cu un nivel mai sus: titlul e
  // scris de vânzător despre piesa pe care o are în mână, deci o linie de
  // compatibilitate pe care titlul o contrazice nu merită aceeași încredere.
  //
  // NU se cere ca marca să APARĂ în titlu — multe titluri scriu doar „Golf 5",
  // fără „Vw", și ar fi respinse pe nedrept. Se cere doar să nu fie contrazisă:
  // titlul numește mărci cunoscute, și niciuna nu e a liniei ăsteia.
  //
  // Ce declanșează CONSECINȚA e mai îngust decât pare, și intenționat (vezi
  // filtrul lui `de_creat_modele`): linia contrazisă NU are voie să CREEZE un
  // model nou, dar are voie să se lege de unul pe care îl avem deja.
  //
  // Motivul e că cele două cazuri arată identic din afară:
  //   · „Debitmetru Aer Vw Sharan" are în compatibilitate și „Ford Galaxy" —
  //     titlul spune Vw, linia spune Ford, și amândouă au dreptate: Sharan și
  //     Galaxy sunt aceeași mașină. Ford Galaxy există la noi, deci se leagă.
  //   · „Far stanga Full Led Matrix Audi Q8" are în compatibilitate „Hyundai
  //     Matrix" — acolo „Matrix" e tehnologia farului, nu mașina, iar sursa a
  //     etichetat greșit. Hyundai Matrix NU există la noi, deci nu se creează.
  //
  // Diferența pe care ne bazăm nu e lingvistică, ci de cost: a lega o piesă de un
  // model existent e reversibil dintr-un clic, dar a inventa un model în tabela
  // care alimentează filtrul de pe site, plecând de la o linie pe care titlul o
  // contrazice, e exact felul de greșeală care se descoperă peste trei luni.
  const titluNorm = " " + normalizeaza(ext.titlu ?? "") + " ";
  const marciInTitlu = brands.filter((b) => cheiMarca(b).some((k) => titluNorm.includes(" " + normalizeaza(k) + " ")));
  if (marciInTitlu.length && !marciInTitlu.some((b) => b.id === brand.id)) {
    out.conflictMarca = true;
    out.note.push(`⚠ titlul numește ${marciInTitlu.map((b) => b.nume).join(", ")}, nu ${brand.nume} — din „${text}" nu se creează niciun model nou`);
  }

  if (!mCompat) { out.note.push(`model absent din compatibilitatea „${text}"`); return out; }

  const aleMarcii = models.filter((m) => m.brand_id === brand.id);
  const baza = (m) => normalizeaza(m.nume.replace(/\(.*$/, ""));

  // 1. Potrivire exactă pe numele fără paranteză („A4 B8" din „A4 B8 (2008–2015)").
  const exact = aleMarcii.filter((m) => baza(m) === mCompat);
  if (exact.length === 1) { out.model = exact[0]; return out; }

  // 2. Sursa nu spune generația. Două situații, tratate la fel:
  //
  //    a) numele de bază diferă prin generație — „Skoda Octavia", iar noi avem
  //       „Octavia 2" și „Octavia 3";
  //    b) numele de bază e IDENTIC, iar generațiile se deosebesc doar prin anii
  //       din paranteză — „XC 60 (2012–2016)" și „XC 60 (2017–2024)". Aici se
  //       renunța până la 28 august 2026, cu nota „model ambiguu", și anii nu mai
  //       erau consultați NICIODATĂ. Or anii sunt exact ce deosebește cele două
  //       rânduri: singura informație care le desparte era și singura ignorată.
  //
  //    În amândouă, generația se alege comparând anii din titlu cu intervalul.
  const candidati = exact.length > 1
    ? exact
    : aleMarcii.filter((m) => baza(m).startsWith(mCompat + " "));
  if (!candidati.length) { out.note.push(`model negăsit la ${brand.nume}: „${mCompat}"`); return out; }
  // Avem generații pentru numele ăsta („Octavia 2", „Octavia 3"), doar că anii n-au
  // putut alege una. E ambiguitate, nu model lipsă: dacă am crea un „Octavia" fără
  // generație, ar sta lângă celelalte două și ar strica filtrarea.
  out.generatiiCandidate = true;
  if (ext.an_min == null) { out.note.push(`generație nedeterminabilă pentru „${mCompat}": titlul n-are ani`); return out; }

  // Anii generației vin din coloanele `an_start` / `an_final` (supabase/ani-generatie.sql).
  //
  // Până la 28 august 2026 se citeau din NUMELE modelului, cu un regex care cerea
  // paranteze: „Fabia 2 (2007–2014)". Doar 69 din 345 de modele aveau anii scriși,
  // iar formatul lor era amestecat („Crafter 2E 2006 -2017", fără paranteze).
  // Un model fără interval era eliminat TĂCUT din dezambiguizare, deci „Fabia 3"
  // nu putea fi ales niciodată, oricât de limpede ar fi fost anii din titlu: cele
  // 40 de piese de „Skoda Fabia" rămâneau fără model din cauza asta.
  //
  // `an_final` null înseamnă „încă în producție", nu „necunoscut" — capătul de sus
  // devine deschis. Dacă lipsesc amândouă, se încearcă tot numele, ca plasă pentru
  // un model creat înainte de migrare și încă necompletat de operator.
  const interval = (m) => {
    if (m.an_start != null || m.an_final != null)
      return [m.an_start ?? AN_MINIM, m.an_final ?? AN_MAXIM];
    const iv = m.nume.match(/(\d{4})\s*[–—-]\s*(\d{4})/);
    return iv ? [+iv[1], +iv[2]] : null;
  };
  // Întâi strict: anii din titlu încap întregi în intervalul generației.
  let incap = candidati.filter((m) => {
    const iv = interval(m);
    return iv ? ext.an_min >= iv[0] && ext.an_max <= iv[1] : false;
  });
  // Dacă nu iese nimic, se acceptă și SUPRAPUNEREA, dar numai cu o singură
  // generație. Vânzătorii scriu anii larg: „Caddy 2003 2004 2005" iese din
  // intervalul lui „Caddy III (2004–2015)" cu un an, deși e limpede despre care
  // e vorba. Când suprapunerea prinde două generații („Golf 2008", între Golf 5
  // și Golf 6), rămâne ambiguu și nu se alege niciuna.
  if (!incap.length) {
    incap = candidati.filter((m) => {
      const iv = interval(m);
      return iv ? ext.an_min <= iv[1] && ext.an_max >= iv[0] : false;
    });
    if (incap.length === 1) out.prinSuprapunere = true;
  }
  if (incap.length === 1) {
    out.model = incap[0]; out.generatieDedusa = true;
    out.note.push(`generație dedusă din ani (${ext.an_min}–${ext.an_max})${out.prinSuprapunere ? ", prin suprapunere" : ""} → ${incap[0].nume}`);
  } else if (incap.length > 1) {
    out.note.push(`generație ambiguă pentru „${mCompat}": anii ${ext.an_min}–${ext.an_max} se suprapun peste ${incap.map((m) => m.nume).join(" și ")}`);
  } else {
    out.note.push(`generație negăsită pentru „${mCompat}": anii ${ext.an_min}–${ext.an_max} nu încap în niciun interval`);
  }
  return out;
}

/**
 * Marca și modelele unei piese, din TOATE liniile de compatibilitate.
 *
 * Pagina scrie „Piesă auto compatibilă cu:" și enumeră mașinile — de obicei mai
 * multe, fiindcă piesa chiar se potrivește la toate: Sharan și Galaxy sunt aceeași
 * mașină, Caddy e pe platforma lui Golf 5. Până la 25 august 2026 se citea doar
 * prima linie, iar restul se pierdeau; piesa apărea legată de un singur model, iar
 * dezacordul cu titlul era luat drept greșeală a sursei. Nu era: erau amândouă
 * adevărate.
 *
 * `model_ids` le ține pe toate (coloana e `bigint[]`). `model_id` rămâne cel
 * „principal", pentru afișare: primul model recunoscut pe care îl confirmă și
 * titlul, fiindcă titlul e scris de vânzător despre piesa pe care o are în mână.
 */
export function potriveste(ext, taxonomie) {
  const rez = {
    brand_id: null, marca: null, model_id: null, model: null, model_ids: [],
    nepotrivire_marca: false, note: [],
    model_compat: null, model_compat_brut: null, brand_pentru_creare: null, de_creat_modele: [],
  };

  const linii = ext.compat ?? [];
  if (!linii.length) { rez.note.push("compatibilitate absentă"); return rez; }

  const potriviri = linii.map((t) => potrivesteOLinie(t, ext, taxonomie));
  for (const p of potriviri) rez.note.push(...p.note);

  // Toate modelele recunoscute, în ordinea din pagină, fără dubluri.
  for (const p of potriviri)
    if (p.model && !rez.model_ids.includes(p.model.id)) rez.model_ids.push(p.model.id);

  // Comparăm pe cuvinte, nu pe șir continuu. Vânzătorul scrie „Vw Passat 3c b6",
  // iar sursa spune „Passat B6": cuvintele sunt aceleași, dar are „3c" între ele.
  const cuvinteTitlu = new Set(normalizeaza(ext.titlu ?? "").split(" "));
  const inTitlu = (p) => !!p.normalizat && p.normalizat.split(" ").every((c) => !c || cuvinteTitlu.has(c));

  const principal = potriviri.find((p) => p.model && inTitlu(p))
                 ?? potriviri.find((p) => p.model)
                 ?? potriviri[0];
  if (principal?.model) { rez.model_id = principal.model.id; rez.model = principal.model.nume; }
  if (principal?.brand) { rez.brand_id = principal.brand.id; rez.marca = principal.brand.nume; }
  if (principal?.generatieDedusa) rez.generatie_dedusa = true;

  // Ce ar putea crea motorul: liniile cu marcă știută și model pe care nu-l avem.
  // `potriveste` rămâne pură — creează motorul, nu ea. `inTitlu` spune cât de mult
  // se poate avea încredere în linie, iar motorul decide după asta:
  //   · dacă piesa n-are NICIUN model, se creează doar linia confirmată de titlu —
  //     altfel am lega o piesă de Golf 5 la un „Jetta" doar fiindcă așa scrie la ei;
  //   · dacă piesa are deja un model, restul liniilor sunt compatibilități în plus,
  //     scrise de vânzător tocmai fiindcă piesa se potrivește și acolo. Se creează.
  rez.de_creat_modele = potriviri
    .filter((p) => !p.model && p.brand && p.normalizat && p.brut && !p.generatiiCandidate && !p.conflictMarca)
    .map((p) => ({ brand_id: p.brand.id, nume: p.brut, normalizat: p.normalizat, inTitlu: inTitlu(p) }));

  const principalDeCreat = rez.de_creat_modele.find((x) => x.inTitlu);
  if (principalDeCreat) {
    rez.model_compat = principalDeCreat.normalizat;
    rez.model_compat_brut = principalDeCreat.nume;
    rez.brand_pentru_creare = principalDeCreat.brand_id;
  }

  // ---- verificare pe TITLU ----
  // Verificarea față de URL a fost scoasă la 25 august 2026: pe 50 de produse,
  // URL-ul se contrazicea cu `q-car-model` în 66% din cazuri, iar în cele 25 de
  // dezacorduri tranșate de titlu URL-ul n-a avut dreptate NICIODATĂ.
  //
  // Se semnalează doar dacă NICIUNA dintre compatibilități nu apare în titlu.
  // Una singură care lipsește nu mai e semnal: e a doua mașină compatibilă, pe
  // care vânzătorul n-a scris-o în titlu fiindcă vinde piesa de pe prima.
  const t = " " + normalizeaza(ext.titlu ?? "") + " ";
  const marci = potriviri.filter((p) => p.brand);
  if (marci.length && !marci.some((p) => cheiMarca(p.brand).some((k) => t.includes(" " + normalizeaza(k) + " ")))) {
    rez.nepotrivire_marca = true;
    rez.note.push(`⚠ nicio marcă din compatibilitate (${marci.map((p) => p.brand.nume).join(", ")}) nu apare în titlu: „${ext.titlu ?? ""}"`);
  }
  const cuModel = potriviri.filter((p) => p.normalizat);
  if (cuModel.length && !cuModel.some(inTitlu)) {
    rez.nepotrivire_titlu = true;
    rez.note.push(`⚠ niciun model din compatibilitate (${cuModel.map((p) => p.normalizat).join(", ")}) nu apare în titlu: „${ext.titlu ?? ""}"`);
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
