// ============================================================
// POTRIVIREA CATALOGULUI NOSTRU CU CEL DE PE dez.ro
//
// CE PROBLEMĂ REZOLVĂ
// Ei cer `idBrand`, `idModel` și `idPart` din catalogul LOR. Noi avem `brands`,
// `models` și `categories` ale noastre. Nimeni nu ne dă o traducere, deci
// trebuie făcută — o dată, verificată de om, și ținută în `dezro_mapari`.
//
// REGULA DE BAZĂ, aceeași ca la taxonomia de import: AUTOMATUL PROPUNE, OMUL
// DECIDE. Funcțiile de aici nu scriu nimic; întorc propuneri cu un scor. Cine le
// cheamă hotărăște ce face cu ele, iar `dezro_mapari.sursa = 'om'` nu se calcă
// niciodată peste.
//
// PRAGURI (măsurate pe catalogul real, 7 septembrie 2026)
//   modele:  537 din 543 primesc o propunere; 373 sunt identice la literă.
//            Peste PRAG_SIGUR se aplică singure, sub el se cere confirmare.
//   categorii: numele lor sunt la singular și fără diacritice („Caseta directie"),
//            ale noastre la plural și cu diacritice („Casetă direcție"), iar
//            unele sunt prescurtate la noi („Compresor AC" vs „Compresor aer
//            conditionat"). De asta există și REGULI_CATEGORII: traducerile
//            scrise de om au întâietate, exact ca la importul din pieseauto.ro.
//
// CE NU FACE
// Nu deduce niciodată marca sau modelul din TITLUL unei piese. Aceea e treaba
// lui `lib/import/potrivire.mjs` și rămâne acolo. Aici se potrivesc doar nume de
// catalog cu nume de catalog.
// ============================================================

/** Peste scorul ăsta o propunere se aplică singură; sub el așteaptă omul.
 *  88 = „identice după ce se scot generația, anii și cuvintele de umplutură".
 *  Tot ce e mai jos înseamnă că unul dintre nume spune ceva în plus, iar acel
 *  ceva poate fi tocmai diferența dintre „Range Rover" și „Range Rover Evoque". */
export const PRAG_SIGUR = 88;

/** Sub scorul ăsta nu se propune nimic: o propunere proastă costă mai mult decât
 *  lipsa ei, fiindcă omul o confirmă din greșeală citind în diagonală. */
export const PRAG_PROPUNERE = 60;

const faraDiacritice = (s) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Cuvinte care nu deosebesc nimic în numele unui MODEL: ei scriu „Seria GX" și
 *  „Clubman Seria", noi scriem „A-Class W168" unde ei scriu „A W168". */
const UMPLUTURA_MODEL = new Set(["seria", "series", "class", "klass", "klasse", "clasa"]);

/**
 * Forma normalizată a unui nume de model.
 *
 * ATENȚIE LA ANI: se șterg doar dacă în nume mai rămâne o literă. „2008",
 * „3008" și „308" sunt NUME de modele Peugeot — regula e aceeași cu cea din
 * `lib/import/potrivire.mjs`, unde a fost scrisă prima dată, și pentru același
 * motiv: un an singur nu se caută niciodată.
 */
export function normalizeazaModel(s) {
  let t = faraDiacritice(s).replace(/\([^)]*\)/g, " ");
  if (/[a-z]/.test(t)) t = t.replace(/\b(19|20)\d{2}\b/g, " ");
  t = t.replace(/[^a-z0-9]+/g, " ").trim();
  const toate = t.split(" ").filter(Boolean);
  const utile = toate.filter((x) => !UMPLUTURA_MODEL.has(x));
  return (utile.length ? utile : toate).join(" ");
}

const ROMAN = /^[ivx]+$/;
/** Arată a cod de generație: „5", „B7", „8P", „E90", „III". */
const esteGeneratie = (t) => ROMAN.test(t) || /^[a-z]{0,2}\d{1,2}[a-z]?$/.test(t);

/**
 * Numele fără codurile de generație de ORIUNDE, nu doar de la final.
 *
 * Primul cuvânt nu se atinge niciodată: „A4", „Q7", „500", „206", „i30" și „X3"
 * SUNT numele modelului, nu generația lui. De asta „Golf 5 Plus" iese „golf plus"
 * (ei au „Golf Plus"), iar „A4" rămâne „a4".
 *
 * Diferă intenționat de `bazaModel` din `lib/format.ts`, care taie doar ultimul
 * cuvânt: acolo scopul e gruparea generațiilor aceluiași model pe site, aici e
 * potrivirea cu un catalog străin care nu are generații deloc.
 */
export function faraGeneratie(s) {
  const t = normalizeazaModel(s).split(" ").filter(Boolean);
  if (t.length < 2) return t.join(" ");
  return [t[0], ...t.slice(1).filter((x) => !esteGeneratie(x))].join(" ");
}

/** Distanța Levenshtein, oprită devreme. Folosită DOAR pe nume fără cifre —
 *  „Golf 5" și „Golf 6" sunt la distanță 1 și sunt două mașini diferite. */
function distanta(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prec = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const t = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prec + (a[i - 1] === b[j - 1] ? 0 : 1));
      prec = t;
    }
  }
  return d[b.length];
}

// ------------------------------------------------------------
// MĂRCI
// ------------------------------------------------------------

/**
 * Marca noastră -> marca lor. Măsurat: 39 din 42 se potrivesc la literă; cele
 * trei rămase (OMODA, Cherry, JAECOO) sunt rămășițe din lista de dealer, fără
 * nicio piesă, iar „Cherry" e chiar scris greșit la noi — la ei e „Chery".
 *
 * @param {string} numeNostru
 * @param {{dezro_id:number,nume:string}[]} candidati
 */
export function potrivesteMarca(numeNostru, candidati) {
  const a = normalizeazaModel(numeNostru);
  const aFaraSpatii = a.replace(/ /g, "");
  let best = null;
  const pune = (c, scor) => {
    if (!best || scor > best.scor || (scor === best.scor && c.dezro_id < best.dezro_id)) best = { ...c, scor };
  };
  for (const c of candidati) {
    const b = normalizeazaModel(c.nume);
    if (!b) continue;
    if (a === b) { pune(c, 100); continue; }
    if (aFaraSpatii === b.replace(/ /g, "")) { pune(c, 95); continue; }
    if (!/\d/.test(a) && !/\d/.test(b) && a.length >= 5 && distanta(a, b) <= 1) pune(c, 70);
  }
  return best && best.scor >= PRAG_PROPUNERE ? best : null;
}

// ------------------------------------------------------------
// MODELE
// ------------------------------------------------------------

/**
 * Modelul nostru (o GENERAȚIE: „Passat B6") -> modelul lor (de obicei doar
 * „Passat", dar uneori chiar generația: ei au și „Golf 5", și „E90").
 *
 * Candidații trebuie să fie DEJA restrânși la marca potrivită. Fără asta,
 * „Sportage" de la Kia s-ar putea lipi de altceva cu același nume.
 *
 * Ordinea paselor, de la sigur la nesigur:
 *   100 identice
 *    95 identice fără spații („RAV 4" = „RAV4", „MG3" = „MG 3")
 *    88 numele nostru fără generație = numele lor întreg („Passat B6" -> „Passat").
 *       Generația se scoate doar din al NOSTRU: dacă s-ar scoate din amândouă,
 *       „Golf 5" s-ar lipi de „Golf 6".
 * 70..79 numele nostru începe cu al lor („Insignia A" -> „Insignia"); cu cât
 *        partea comună e mai lungă, cu atât scorul e mai mare
 *    68 al lor începe cu al nostru ȘI e SINGURUL care face asta
 *        („F07" -> „F07 Gran Turismo"). Condiția de unicitate e esențială:
 *        „X3" ar prinde altfel și „X3 M", și „X3 M50".
 *    65 o singură literă diferență, doar la nume fără cifre
 *        („Giulietta" -> „Giuletta", greșeala lor de scriere)
 */
export function potrivesteModel(numeNostru, candidati) {
  const a = normalizeazaModel(numeNostru);
  const aFaraSpatii = a.replace(/ /g, "");
  const aFaraGen = faraGeneratie(numeNostru);
  let best = null;
  const pune = (c, scor) => {
    if (!best || scor > best.scor || (scor === best.scor && c.dezro_id < best.dezro_id)) best = { ...c, scor };
  };
  const prefixInvers = [];

  for (const c of candidati) {
    const b = normalizeazaModel(c.nume);
    if (!b) continue;
    if (a === b) { pune(c, 100); continue; }
    if (aFaraSpatii === b.replace(/ /g, "")) { pune(c, 95); continue; }
    // Generația se scoate DOAR din numele NOSTRU, niciodată din al lor.
    // Altfel „Golf 5” și „Golf 6” s-ar reduce amândouă la „golf” și s-ar lipi
    // una de alta — două mașini diferite, aceeași potrivire. Ei au și modele cu
    // generație în nume („Golf 5”, „E90”), iar acelea se prind la pasul 100.
    if (aFaraGen && aFaraGen === b) { pune(c, 88); continue; }
    if (b.length >= 2 && a.startsWith(b + " ")) { pune(c, 70 + Math.min(9, b.length)); continue; }
    if (a.length >= 2 && b.startsWith(a + " ")) prefixInvers.push(c);
    if (!/\d/.test(a) && !/\d/.test(b) && a.length >= 5 && distanta(a, b) <= 1) pune(c, 65);
  }
  if (prefixInvers.length === 1) pune(prefixInvers[0], 68);

  return best && best.scor >= PRAG_PROPUNERE ? best : null;
}

// ------------------------------------------------------------
// CATEGORII
// ------------------------------------------------------------

/**
 * TRADUCERILE SCRISE DE OM, care bat orice automatism.
 *
 * Cheia e slug-ul categoriei NOASTRE, valoarea e CALEA din catalogul lor
 * („grupă > categorie"), scrisă exact cum o întoarce API-ul. Se folosește calea,
 * nu id-ul, din două motive: se citește în git ce s-a decis, și un id schimbat
 * la ei n-ar strica tăcut nimic — s-ar vedea că regula nu se mai rezolvă.
 *
 * DE CE E NEVOIE DE ELE
 * Automatismul compară cuvinte. „Compresor AC" și „Compresor aer conditionat"
 * n-au niciun cuvânt comun în afară de primul, deci automatul alegea „Suport
 * compresor AC" — suportul, nu compresorul. Aceeași familie de greșeli:
 * „Cutie de viteze" -> „Conducta cutie de viteze", „Armătură bară spate" ->
 * „Bara spate". Toate seamănă la cuvinte și înseamnă altceva.
 *
 * Regulile de aici acoperă categoriile cu cele mai multe piese. Restul se
 * completează din Admin → dez.ro → Potriviri, iar ce se confirmă acolo rămâne în
 * `dezro_mapari` cu `sursa = 'om'`.
 */
export const REGULI_CATEGORII = {
  // --- caroserie și exterior ---
  "caroserie-si-exterior-grile-si-ornamente":   "Elemente caroserie > Bandouri / ornamente",
  "caroserie-si-exterior-bara-spate":           "Elemente caroserie > Bara spate",
  "caroserie-si-exterior-bara-fata":            "Elemente caroserie > Bara fata",
  "caroserie-si-exterior-armatura-bara-spate":  "Elemente caroserie > Intaritura bara spate",
  "caroserie-si-exterior-armatura-bara-fata":   "Elemente caroserie > Intaritura bara fata",
  "caroserie-si-exterior-difuzor-bara-spate":   "Elemente caroserie > Difuzor bara spate",
  "caroserie-si-exterior-grila-radiator":       "Elemente caroserie > Grila radiator",
  "caroserie-si-exterior-grila-proiector":      "Elemente caroserie > Grila proiector",
  "caroserie-si-exterior-usa-fata":             "Elemente caroserie > Usa",
  "caroserie-si-exterior-usa-spate":            "Elemente caroserie > Usa",
  "caroserie-si-exterior-capota":               "Elemente caroserie > Capota fata",
  "caroserie-si-exterior-capota-portbagaj":     "Elemente caroserie > Capota spate",
  "caroserie-si-exterior-haion":                "Elemente caroserie > Hayon",
  "caroserie-si-exterior-broasca-haion":        "Elemente caroserie > Incuietoare hayon",
  "caroserie-si-exterior-aripa-fata":           "Elemente caroserie > Aripa fata",
  "caroserie-si-exterior-aripa-spate":          "Elemente caroserie > Aripa spate",
  "caroserie-si-exterior-trager":               "Elemente caroserie > Trager / Panou frontal",
  "caroserie-si-exterior-praguri":              "Elemente caroserie > Prag",
  "caroserie-si-exterior-carenaj-roata":        "Elemente caroserie > Carenaj / Aripa interioara",
  "caroserie-si-exterior-spoilere":             "Elemente caroserie > Spoiler inferior bara",
  "caroserie-si-exterior-cadru-motor":          "Motor > Cadru motor",
  "caroserie-si-exterior-oglinzi-complete":     "Geamuri/Oglinzi > Oglinzi",
  "caroserie-si-exterior-suport-far":           "Sistem iluminare > Suport far",
  // Categoria noastră de rest. La ei „Elemente caroserie" NU e selectabilă
  // (e doar grupă), deci singurul loc onest pentru un amestec e „Alte piese auto".
  "caroserie-si-exterior-alte-piese-de-caroserie": "Alte piese auto",

  // --- ștergătoare ---
  // Amestec de motorașe, brațe, duze și vase. Grupa lor le acoperă pe toate și e
  // selectabilă; o frunză ar fi greșită pentru majoritatea pieselor.
  "caroserie-si-exterior-stergatoare-si-spalare-parbriz": "Sistem curatare parbriz",
  "caroserie-si-exterior-vas-lichid-parbriz":   "Sistem curatare parbriz > Rezervor lichid stergator parbriz",
  "electrice-si-senzori-motoras-stergatoare":   "Sistem curatare parbriz > Motoras stergator parbriz",

  // --- motor și anexe ---
  "motor-si-anexe-motor-complet":               "Motor > Motor complet",
  "motor-si-anexe-turbine":                     "Sistem admisie motor > Turbina",
  "motor-si-anexe-intercooler":                 "Sistem admisie motor > Radiator intercooler",
  "motor-si-anexe-galerie-admisie":             "Sistem admisie motor > Galerie admisie",
  "motor-si-anexe-egr-si-clapeta":              "Motor > Control gaze evacuare > EGR / Control aer",
  "motor-si-anexe-capac-motor":                 "Motor > Capac motor",
  "motor-si-anexe-pompa-vacuum":                "Motor > Chiulasa > Pompa vacuum",
  "motor-si-anexe-pompa-apa":                   "Sistem de racire motor > Pompa apa",
  "motor-si-anexe-baie-ulei":                   "Motor > Ungere > Baie ulei",
  "motor-si-anexe-suporti-motor":               "Motor > Suport motor > Suport motor",
  "motor-si-anexe-pompa-injectie":              "Pregatire amestec > Pompa de injectie",
  "motor-si-anexe-rampa-injectoare":            "Pregatire amestec > Rampa injectoare",
  "motor-si-anexe-pompa-motorina-din-rezervor": "Sistem alimentare > Pompa combustibil",
  // Amestec de injectoare ȘI rampe: grupa lor le ține pe amândouă.
  "motor-si-anexe-injectoare-si-rampa":         "Pregatire amestec",
  // Amestec de radiatoare, ventilatoare, vase și furtunuri.
  "motor-si-anexe-radiatoare-si-racire":        "Sistem de racire motor",
  "filtre-auto-carcasa-filtru-aer":             "Sistem admisie motor > Carcasa filtru aer",

  // --- electrice ---
  "electrice-si-senzori-alternator":            "Electrice > Alternator",
  "motor-si-anexe-electromotor":                "Electrice > Electromotor",
  "electrice-si-senzori-calculator-ecu":        "Motor > Calculator motor",
  "electrice-si-senzori-calculator-lumini":     "Electrice > Calculator lumini",
  "electrice-si-senzori-calculator-confort":    "Sistem de confort > Calculator confort",
  "electrice-si-senzori-bloc-lumini":           "Sistem iluminare > Bloc lumini",
  "electrice-si-senzori-contact-si-cheie":      "Electrice > Contact cu cheie",
  "electrice-si-senzori-panou-de-sigurante":    "Electrice > Bloc sigurante / relee",
  // Amestec de airbaguri și centuri — grupa lor le acoperă pe amândouă.
  "electrice-si-senzori-airbag-uri-si-centuri": "Sisteme de securitate",
  "accesorii-auto-senzori-parcare":             "Sistem de confort > Senzori parcare",

  // --- lumini ---
  "optica-si-faruri-faruri":                    "Sistem iluminare > Far",
  "optica-si-faruri-stopuri":                   "Sistem iluminare > Stop / Lampa spate",
  "optica-si-faruri-proiectoare-auto":          "Sistem iluminare > Proiector ceata",
  "optica-si-faruri-lumini-de-zi":              "Sistem iluminare > Daylight",
  "optica-si-faruri-bloc-xenon-si-balast":      "Sistem iluminare > Modul / balast - droser far",

  // --- frânare, direcție, suspensie ---
  "sistem-de-franare-pompa-abs":                "Sistem de franare > Pompa ABS",
  "sistem-de-franare-etriere":                  "Sistem de franare > Etrier",
  "sistem-de-franare-tulumba-frana":            "Sistem de franare > Servofrana",
  "suspensie-si-directie-caseta-directie":      "Directie > Caseta directie",
  "suspensie-si-directie-pompa-servodirectie":  "Directie > Pompa servodirectie hidraulica",
  "suspensie-si-directie-fuzete-si-rulmenti":   "Angrenare roata > Fuzeta",
  "suspensie-si-directie-brate-si-bascule":     "Angrenare roata > Brat suspensie",
  "suspensie-si-directie-punte-spate":          "Angrenare roata > Punte",

  // --- transmisie ---
  // La noi „Cutie de viteze" ține și manuale, și automate (automatele au
  // categoria lor, dar amestecul rămâne). Grupa lor e selectabilă și corectă
  // pentru amândouă.
  "cutie-de-viteze-si-transmisie-cutie-de-viteze":   "Cutie de viteza",
  "cutie-de-viteze-si-transmisie-volanta":           "Motor > Arbore cotit, angrenare > Volanta",
  // „Angrenare roata" nu e selectabilă la ei, deci amestecul planetare+cardan
  // trebuie să cadă pe frunza care acoperă majoritatea.
  "cutie-de-viteze-si-transmisie-planetare-si-cardan": "Angrenare roata > Planetara",

  // --- climatizare ---
  "climatizare-si-incalzire-compresor-ac":          "Clima habitaclu > Compresor aer conditionat",
  "climatizare-si-incalzire-radiator-ac-condensator": "Clima habitaclu > Radiator clima",
  "climatizare-si-incalzire-aeroterma":             "Clima habitaclu > Aeroterma habitaclu",
  "climatizare-si-incalzire-conducte-si-furtunuri-ac": "Clima habitaclu > Conducta aer conditionat",

  // --- interior ---
  "interior-si-tapiterie-ceasuri-bord":         "Electrice > Ceasuri bord",
  "interior-si-tapiterie-bord-complet":         "Elemente caroserie > Echipament interior > Plansa bord",
  "interior-si-tapiterie-volane":               "Directie > Volan",
  "interior-si-tapiterie-display":              "Electrice > Display Bord",
  "interior-si-tapiterie-guri-ventilatie":      "Elemente caroserie > Echipament interior > Grile aerisire bord",

  // --- roți ---
  // Amestec de jante de aliaj și de tablă; grupa lor le ține pe amândouă.
  "roti-jante-si-anvelope-jante":               "Roti",

  // ------------------------------------------------------------
  // AL DOILEA VAL, în ordinea numărului de piese.
  // Aceleași două verificări ca mai sus, făcute mecanic înainte de a fi scrise
  // aici: slug-ul există în `categories`, iar calea există în catalogul lor ȘI
  // e selectabilă. O regulă care nu trece amândouă n-are ce căuta în fișier —
  // s-ar rezolva în gol și piesele ar rămâne nepublicate fără să se vadă de ce.
  // ------------------------------------------------------------
  "caroserie-si-exterior-broaste-si-incuietori":              "Elemente caroserie > Incuietoare usa",
  "electrice-si-senzori-alte-piese-electrica-electronica":    "Alte piese auto",
  "caroserie-si-exterior-grila-bara":                         "Elemente caroserie > Grila radiator",
  "interior-si-tapiterie-ornamente":                          "Elemente caroserie > Bandouri / ornamente",
  "motor-si-anexe-ornament-toba":                             "Sistemul de esapament > Ornament toba",
  "caroserie-si-exterior-brat-stergator":                     "Sistem curatare parbriz > Brat stergator parbriz",
  "cutie-de-viteze-si-transmisie-cutie-de-transfer":          "Angrenare roata > Cutie de transfer",
  "motor-si-anexe-vas-expansiune":                            "Sistem de racire motor > Vas de expansiune lichid racire",
  "interior-si-tapiterie-centuri-de-siguranta":               "Sisteme de securitate > Centura de siguranta",
  "caroserie-si-exterior-flaps-bara":                         "Elemente caroserie > Flaps bara",
  "interior-si-tapiterie-torpedou":                           "Elemente caroserie > Echipament interior > Torpedou",
  "caroserie-si-exterior-scut-motor-plastic":                 "Motor > Scut motor",
  "caroserie-si-exterior-emblema":                            "Elemente caroserie > Emblema",
  "motor-si-anexe-furtun-intercooler-turbo":                  "Sistem admisie motor > Furtun intercooler",
  "cutie-de-viteze-si-transmisie-cardan":                     "Angrenare roata > Ax cardanic complet",
  "electrice-si-senzori-senzor-presiune-gaze-evacuare":       "Sistemul de esapament > Senzor presiune gaze evacuare",
  "motor-si-anexe-fulie-vibrochen":                           "Motor > Arbore cotit, angrenare > Fulie arbore cotit",
  "motor-si-anexe-chiulasa":                                  "Motor > Chiulasa > Chiuloasa",
  "motor-si-anexe-bobina-inductie":                           "Sistem de aprindere > Bobina inductie",
  "suspensie-si-directie-coloana-directie":                   "Directie > Coloana directie",
  "electrice-si-senzori-macara-geam-electric":                "Elemente caroserie > Macara usa",
  "interior-si-tapiterie-butoane-geamuri-electrice":          "Sistem de confort > Comanda electrica geam",
  "motor-si-anexe-capac-chiulasa":                            "Motor > Capac culbutori - chiulasa",
  "electrice-si-senzori-calculator-parcare":                  "Sistem de confort > Calculator / modul parcare",
  "electrice-si-senzori-senzor-nox":                          "Sistemul de esapament > Senzor noxe",
  "interior-si-tapiterie-polita-portbagaj":                   "Elemente caroserie > Polita portbagaj",
  "motor-si-anexe-carcasa-filtru-ulei":                       "Motor > Ungere > Carcasa filtru ulei",
  "motor-si-anexe-tubulatura-intercooler":                    "Sistem admisie motor > Tubulatura intercooler",
  "cutie-de-viteze-si-transmisie-suport-cutie-viteze":        "Cutie de viteza > Suport cutie de viteza",
  "car-audio-cd-player-auto":                                 "Sistem de informatii > CD-player",
  "suspensie-si-directie-amortizoare":                        "Suspensie > Amortizor",
  "suspensie-si-directie-ansamblu-amortizor-arc":             "Suspensie > Ansamblu telescop arc",
  "climatizare-si-incalzire-panou-comanda-ac-clima":          "Clima habitaclu > Comenzi clima",
  "car-audio-boxe-auto":                                      "Sistem de informatii > Sistem audio",
  "caroserie-si-exterior-scut-sub-bara":                      "Elemente caroserie > Scut sub bara",
  "interior-si-tapiterie-rulou-portbagaj":                    "Elemente caroserie > Rulou portbagaj",
  "cutie-de-viteze-si-transmisie-diferentiale":               "Angrenare roata > Grup Diferential",
  "motor-si-anexe-pompa-benzina":                             "Sistem alimentare > Pompa combustibil",
  "motor-si-anexe-pompa-rezervor":                            "Sistem alimentare > Pompa combustibil",
  "filtre-auto-tubulatura-admisie":                           "Sistem admisie motor > Tubulatura admisie",
  "climatizare-si-incalzire-climatronic":                     "Clima habitaclu > Comenzi clima",
  "motor-si-anexe-pistoane":                                  "Motor > Ansamblu piston > Piston",
  "motor-si-anexe-releu-bujii":                               "Sistem de aprindere > Releu bujii",
  "tuning-eleron":                                            "Elemente caroserie > Eleron",
  "caroserie-si-exterior-maner-haion":                        "Elemente caroserie > Maner hayon",
  "electrice-si-senzori-baterie-si-borne":                    "Electrice > Acumulator",
  "caroserie-si-exterior-suport-baterie-auto":                "Electrice > Suport acumulator",
  "accesorii-auto-camera-marsarier":                          "Sistem de confort > Camera mers inapoi",
  "electrice-si-senzori-calculator-airbag":                   "Sisteme de securitate > Calculator airbag",
  "navigatie-gps-navigatie-originala":                        "Sistem de informatii > Navigatie",
  "motor-si-anexe-curele-si-distributie":                     "Control distributie > Set role distributie",
  "motor-si-anexe-rampa-retur-injectoare":                    "Pregatire amestec > Rampa injectoare",
  "motor-si-anexe-sonda-lambda":                              "Motor > Control gaze evacuare > Sonda lambda",
  "accesorii-auto-carlig-remorcare":                          "Sistem de tractare > Carlig tractare",
  "caroserie-si-exterior-usa-culisanta":                      "Elemente caroserie > Usa culisanta",
  "interior-si-tapiterie-alte-butoane":                       "Electrice > Butoane / Comenzi",
  "electrice-si-senzori-maneta-tempomat":                     "Sistem de confort > Comenzi Pilot Automat",
  "car-audio-antena-radio":                                   "Sistem de informatii > Antena",
  "interior-si-tapiterie-fete-usi":                           "Elemente caroserie > Echipament interior > Tapiterie usa",
  "electrice-si-senzori-calculator-frana-mana":               "Sistem de franare > Calculator frana de mana",
  "motor-si-anexe-pompa-ulei":                                "Motor > Ungere > Pompa ulei",
  "motor-si-anexe-electrovalva":                              "Sistem admisie motor > Electrovalva presiune turbocompresor",
  "motor-si-anexe-toba-esapament":                            "Sistemul de esapament > Toba de esapament finala",
  "caroserie-si-exterior-grila-stergatoare":                  "Elemente caroserie > Grila Stergatoare",
  "electrice-si-senzori-claxon":                              "Electrice > Claxon",
  "interior-si-tapiterie-buton-start-stop":                   "Electrice > Buton start stop",
  "suspensie-si-directie-arcuri-auto":                        "Suspensie > Arc spirala",
  "interior-si-tapiterie-buton-frana-de-mana":                "Sistem de franare > Frana de mana",
  "motor-si-anexe-alte-piese-racire":                         "Sistem de racire motor",
  "motor-si-anexe-radiator-ulei-termoflot":                   "Motor > Ungere > Radiator ulei",
  "electrice-si-senzori-pedala-acceleratie":                  "Sistem admisie motor > Pedala acceleratie",
  "diverse-diverse":                                          "Alte piese auto",
  "interior-si-tapiterie-cotiera-auto":                       "Elemente caroserie > Echipament interior > Cotiera",
  "suspensie-si-directie-punte-fata":                         "Angrenare roata > Punte",
  "sistem-de-franare-motoras-etrier":                         "Sistem de franare > Etrier",
  "electrice-si-senzori-instalatie-electrica":                "Electrice > Instalatie electrica",
  "electrice-si-senzori-maneta-semnalizare":                  "Electrice > Maneta stergatoare/ semnalizare",
  "electrice-si-senzori-alarme-auto":                         "Sistem de confort > Alarma",
  "motor-si-anexe-axe-came":                                  "Control distributie > Ax cu came",
  "motor-si-anexe-pompa-amorsare":                            "Sistem alimentare > Pompa amorsare",
  "motor-si-anexe-rezervor-adblue":                           "Sistem Adblue > Rezervor Adblue",
  "caroserie-si-exterior-sticla-oglinda":                     "Geamuri/Oglinzi > Geam oglinda",
  "electrice-si-senzori-borne-baterie":                       "Electrice > Cablu baterie",
  "electrice-si-senzori-relee":                               "Electrice > Releu",
  "interior-si-tapiterie-consola-centrala":                   "Elemente caroserie > Echipament interior > Consola bord",
  "interior-si-tapiterie-nuca-schimbator":                    "Cutie de viteza > Nuca schimbator",
  "electrice-si-senzori-calculator-cutie-automata":           "Cutie de viteza > Calculator cutie de viteza",
  "suspensie-si-directie-kit-brate":                          "Suspensie > Kit Brate Suspensie",
  "suspensie-si-directie-perne-aer":                          "Suspensie > Perna aer suspesie pneumatica",
  "suspensie-si-directie-vas-lichid-servodirectie":           "Directie > Vas lichid servodirectie",
  "sistem-de-franare-pompa-servofrana":                       "Sistem de franare > Pompa frana",
  "motor-si-anexe-suport-filtru-ulei":                        "Motor > Suport filtru ulei",
  "motor-si-anexe-suport-rola-accesorii":                     "Motor > Suport intinzator rola accesorii",
  "motor-si-anexe-vibrochen":                                 "Motor > Arbore cotit, angrenare > Vibrochen / Arbore cotit",
  "electrice-si-senzori-senzori-ploaie":                      "Sistem de confort > Senzor ploaie",
  "electrice-si-senzori-rezistenta-aeroterma":                "Clima habitaclu > Rezistenta trepte aeroterma",
  "motor-si-anexe-catalizator-auto":                          "Sistemul de esapament > Catalizator",
  "motor-si-anexe-bujii-incandescente":                       "Sistem de aprindere > Bujie incandescenta",
  "caroserie-si-exterior-luneta":                             "Geamuri/Oglinzi > Luneta",
  "caroserie-si-exterior-maner-usa":                          "Elemente caroserie > Maner deschidere usa",
  "caroserie-si-exterior-broasca-capota":                     "Elemente caroserie > Incuietoare capota fata",
  "electrice-si-senzori-maneta-stergatoare":                  "Electrice > Maneta stergatoare/ semnalizare",
  "car-audio-alte-componente-car-audio":                      "Sistem de informatii > Sistem audio",
  "cutie-de-viteze-si-transmisie-timonerie":                  "Cutie de viteza > Timonerie cutie de viteza",
  "suspensie-si-directie-bare-stabilizatoare":                "Directie > Bara stabilizatoare",
  "motor-si-anexe-vascocuplaj":                               "Sistem de racire motor > Vascocuplaj",
  "motor-si-anexe-simeringuri":                               "Motor > Garnituri",
  "motor-si-anexe-alte-piese-evacuare":                       "Sistemul de esapament",
  "motor-si-anexe-litrometru":                                "Sistem alimentare > Sonda litrometrica rezervor",
  "filtre-auto-filtru-epurator":                              "Sistem admisie motor > Furtun filtru epurator",
  "filtre-auto-canistra-carbon":                              "Sistem admisie motor > Vas filtru gaze",
  "electrice-si-senzori-kit-pornire":                         "Electrice > Kit pornire motor",
  "suspensie-si-directie-alte-piese-suspensie":               "Suspensie",
  "cutie-de-viteze-si-transmisie-alte-piese-transmisie":      "Cutie de viteza",
  "sistem-de-franare-alte-elemente-frana":                    "Sistem de franare",
  "motor-si-anexe-filtru-de-particule":                       "Sistemul de esapament > Filtru particule",
  "electrice-si-senzori-senzor-temperatura-gaze-evacuare":    "Sistemul de esapament > Senzor temperatura gaze evacuare",
  "caroserie-si-exterior-capac-oglinda":                      "Geamuri/Oglinzi > Capac oglinda",
  "caroserie-si-exterior-amortizoare-haion":                  "Elemente caroserie > Amortizoare hayon",
  "accesorii-auto-bare-longitudinale":                        "Elemente caroserie > Bare longitudinale",
  "electrice-si-senzori-motoras-macara-geam":                 "Electrice > Motoras macara geam",
  "electrice-si-senzori-motoras-deschidere-portbagaj":        "Sistem de confort > Motoras inchidere portbagaj",
  "suspensie-si-directie-foi-de-arc":                         "Suspensie > Arc foi",
  "suspensie-si-directie-conducte-servodirectie":             "Directie > Conducta servodirectie",
  "suspensie-si-directie-blocaj-volan":                       "Directie > Blocator volan",
  "electrice-si-senzori-calculator-abs":                      "Sistem de franare > Calculator unitate abs",
  "motor-si-anexe-galerie-evacuare":                          "Motor > Control gaze evacuare > Galerie evacuare",
  "motor-si-anexe-conducte-alimentare":                       "Sistem alimentare > Conducte combustibil",
  "motor-si-anexe-regulator-presiune":                        "Sistem alimentare > Regulator presiune combustibil",
  "filtre-auto-carcasa-filtru-motorina":                      "Sistem alimentare > Carcasa filtru motorina",
  "motor-si-anexe-pompa-adblue":                              "Sistem Adblue > Modul alimentare Adblue",
  "electrice-si-senzori-senzor-map":                          "Sistem admisie motor > Senzor MAP",
  "motor-si-anexe-furtun-admisie":                            "Sistem admisie motor > Furtun Admisie",
  "motor-si-anexe-actuator-turbo":                            "Sistem admisie motor > Supapa turbo / actuator",
  "electrice-si-senzori-senzor-ax-came":                      "Control distributie > Senzor ax cu came",
  "roti-jante-si-anvelope-capace-roti":                       "Roti > Capace roti",
  "climatizare-si-incalzire-electroventilator-clima-ac":      "Sistem de racire motor > Ventilator radiator",
  "climatizare-si-incalzire-alte-piese-clima-auto":           "Clima habitaclu",
  "interior-si-tapiterie-alte-piese-interior":                "Elemente caroserie > Echipament interior",
  "optica-si-faruri-alte-piese-lumini-auto":                  "Sistem iluminare",
  "accesorii-auto-cui-tractare":                              "Accesorii auto > Cui Tractare",
  "caroserie-si-exterior-brat-oglinda":                       "Geamuri/Oglinzi > Brat oglinda",
  "caroserie-si-exterior-capac-bara":                         "Elemente caroserie > Capac bara",
  "interior-si-tapiterie-covorase":                           "Elemente caroserie > Echipament interior > Mocheta podea interior",
  "caroserie-si-exterior-opritor-usa":                        "Elemente caroserie > Opritor usa",
  "caroserie-si-exterior-chedere":                            "Elemente caroserie > Chedere",
  "caroserie-si-exterior-catadioptru":                        "Elemente caroserie > Catadiopru",
  "caroserie-si-exterior-maner-deschidere-capota":            "Elemente caroserie > Maner deschidere capota",
  "optica-si-faruri-semnalizare-oglinda":                     "Sistem iluminare > Semnalizare oglinda",
  "optica-si-faruri-becuri-xenon":                            "Sistem iluminare > Far > Bec xenon",
  "accesorii-auto-deflector-capota":                          "Accesorii auto > Deflector Capota",
  "interior-si-tapiterie-comenzi-volan":                      "Electrice > Butoane / Comenzi",
  "navigatie-gps-navigatie-auto":                             "Sistem de informatii > Navigatie",
  "car-audio-amplificator-audio":                             "Sistem de informatii > Sistem audio",
  "car-audio-magazie-cd":                                     "Sistem de informatii > CD-player",
  "car-audio-modulator-fm":                                   "Sistem de informatii > Radio",
  "interior-si-tapiterie-plafoniera":                         "Electrice > Lampa iluminare habitaclu",
  "cutie-de-viteze-si-transmisie-bloc-valve-cutie":           "Cutie de viteza > Bloc valve cutie de viteze automata",
  "cutie-de-viteze-si-transmisie-convertizor":                "Cutie de viteza > Convertizor cutie de viteza automata",
  "suspensie-si-directie-flanse-amortizor":                   "Suspensie > Flansa amortizor",
  "motor-si-anexe-fulie-pompa-servo":                         "Directie > Fulie pompa servodirectie",
  "interior-si-tapiterie-maner-frana-mana":                   "Sistem de franare > Frana de mana",
  "interior-si-tapiterie-pedale":                             "Sistem de franare > Pedala frana",
  "motor-si-anexe-carcasa-termostat":                         "Sistem de racire motor > Carcasa Termostat",
  "motor-si-anexe-fulie-ax-came":                             "Control distributie > Fulie ax came",
  "motor-si-anexe-set-curea-transmisie":                      "Control distributie > Set Curea transmisie",
  "motor-si-anexe-rola-intinzatoare-accesorii":               "Motor > Suport intinzator rola accesorii",
  "electrice-si-senzori-senzor-nivel-ulei":                   "Motor > Senzori motor > Senzor nivel ulei motor",
  "cutie-de-viteze-si-transmisie-kit-ambreiaj":               "Ambreiaj > Kit ambreiaj",
  "roti-jante-si-anvelope-roata-de-rezerva":                  "Roti > Roata rezerva",
  "climatizare-si-incalzire-webasto":                         "Sistem de confort > Webasto",
  "suspensie-si-directie-alte-piese-directie":                "Directie",
  "motor-si-anexe-alte-piese-aprindere":                      "Sistem de aprindere",
  "accesorii-auto-diverse-accesorii-auto":                    "Alte piese auto",
  "interior-si-tapiterie-scaune":                             "Elemente caroserie > Echipament interior > Scaun",
  "interior-si-tapiterie-scaune-auto":                        "Elemente caroserie > Echipament interior > Scaun",
  "roti-jante-si-anvelope-senzori-presiune-tpms":             "Roti > Senzori presiune roti",
  "diverse":                                                  "Alte piese auto",
  "cutie-de-viteze-si-transmisie-cutie-viteze-automata": "Cutie de viteza > Cutie de viteza automata",
  "caroserie-si-exterior-balamale": "Elemente caroserie > Balamale usa",
  "accesorii-auto-camera-video-auto": "Sistem de confort > Camera fata",
  "interior-si-tapiterie-oglinda-retrovizoare": "Geamuri/Oglinzi > Oglinzi",
  "caroserie-si-exterior-suporti-prindere-bara": "Elemente caroserie > Suport Bara Fata",
  "caroserie-si-exterior-difuzor-bara-fata": "Elemente caroserie > Spoiler inferior bara",
  "tuning-prelungire-bara-fata": "Elemente caroserie > Spoiler inferior bara",
  "tuning-prelungire-bara-spate": "Elemente caroserie > Spoiler inferior bara",
  "caroserie-si-exterior-geamuri": "Geamuri/Oglinzi > Geam usa",
  "electrice-si-senzori-calculator-injectie": "Motor > Calculator motor",
  "optica-si-faruri-semnalizatoare": "Sistem iluminare > Semnalizare fata",
  "caroserie-si-exterior-grila": "Elemente caroserie > Grila radiator",
  "caroserie-si-exterior-suport-numar-inmatriculare": "Elemente caroserie > Bandouri / ornamente",
};

/** Cuvinte care nu deosebesc nimic într-un nume de categorie. */
const STOP_CATEGORII = new Set([
  "si", "de", "la", "cu", "din", "pe", "auto", "alte", "piese", "componente", "elemente",
]);

const cuvinteCategorie = (s) =>
  faraDiacritice(s).replace(/[^a-z0-9]+/g, " ").trim().split(" ")
    .filter((t) => t && !STOP_CATEGORII.has(t));

/** Cât de mult „sunt același cuvânt" două cuvinte. Prefix comun, fiindcă la ei
 *  numele sunt la singular și fără diacritice („far" / „faruri",
 *  „directie" / „direcție"), iar la noi la plural și cu. */
function cuvinteLipesc(a, b) {
  if (a === b) return 1;
  const n = Math.min(a.length, b.length);
  if (n >= 3 && a.slice(0, n) === b.slice(0, n)) return n >= 5 ? 1 : 0.8;
  return 0;
}

/** Asemănarea a două nume de categorie, 0–100 (Dice pe cuvinte). */
export function scorCategorie(numeNostru, numeLor) {
  const A = cuvinteCategorie(numeNostru);
  const B = cuvinteCategorie(numeLor);
  if (!A.length || !B.length) return 0;
  let comune = 0;
  const luat = new Array(B.length).fill(false);
  for (const x of A) {
    let indice = -1, valoare = 0;
    B.forEach((y, i) => {
      if (luat[i]) return;
      const v = cuvinteLipesc(x, y);
      if (v > valoare) { valoare = v; indice = i; }
    });
    if (indice >= 0) { comune += valoare; luat[indice] = true; }
  }
  return Math.round((200 * comune) / (A.length + B.length));
}

/** Calea unui nod din catalogul lor: „grupă > categorie > subcategorie". */
export function caleaCategoriei(nod, dupaId) {
  const parti = [];
  let n = nod;
  const vazute = new Set();
  while (n && !vazute.has(n.dezro_id)) {
    vazute.add(n.dezro_id);
    parti.unshift(n.nume);
    n = n.parinte ? dupaId.get(n.parinte) : null;
  }
  return parti.join(" > ");
}

/**
 * Categoria noastră -> categoria lor. Întoarce cele mai bune propuneri, în
 * ordine, ca ecranul de potriviri să poată arăta și alternativele.
 *
 * `slug` e al categoriei noastre; dacă apare în REGULI_CATEGORII și calea se
 * rezolvă în catalogul adus, aceea câștigă cu scor 100 și `regula: true`.
 *
 * Se propun DOAR categorii selectabile: una de grupare e refuzată de ei la
 * trimiterea anunțului, deci n-are rost s-o vadă cineva în listă.
 */
export function potrivesteCategorie({ slug, nume, numeParinte }, catalog, cate = 3) {
  const dupaId = new Map(catalog.map((c) => [c.dezro_id, c]));
  const selectabile = catalog.filter((c) => c.selectabil);

  const regula = REGULI_CATEGORII[slug];
  if (regula) {
    const tinta = faraDiacritice(regula).replace(/\s+/g, " ").trim();
    const gasit = selectabile.find(
      (c) => faraDiacritice(caleaCategoriei(c, dupaId)).replace(/\s+/g, " ").trim() === tinta,
    );
    if (gasit) return [{ ...gasit, scor: 100, regula: true, cale: caleaCategoriei(gasit, dupaId) }];
    // Regula există dar calea nu se rezolvă: catalogul lor s-a schimbat. Nu se
    // tace — se cade pe automat, iar nota spune de ce, ca să se poată repara.
  }

  const cu = selectabile.map((c) => {
    let scor = scorCategorie(nume, c.nume);
    // Bonus mic dacă și grupa de deasupra seamănă cu părintele nostru: desparte
    // „Bara spate" (caroserie) de „Bara stabilizatoare" (direcție) când numele
    // scurt al piesei singur n-ar ajunge.
    if (numeParinte && c.parinte) {
      const p = dupaId.get(c.parinte);
      if (p && scorCategorie(numeParinte, p.nume) >= 60) scor += 4;
    }
    return { ...c, scor: Math.min(100, scor), cale: caleaCategoriei(c, dupaId) };
  });

  cu.sort((x, y) => y.scor - x.scor || x.dezro_id - y.dezro_id);
  return cu.filter((x) => x.scor >= PRAG_PROPUNERE).slice(0, cate);
}
