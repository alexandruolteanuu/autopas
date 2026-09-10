// ============================================================
// VERIFICAREA LEGĂTURII CU dez.ro — fără rețea, fără bază de date.
//
// Publicarea a 8.700 de anunțuri ține ore și lovește un server care nu e al
// nostru, deci nu poate fi rulată de fiecare dată când cineva schimbă o regulă.
// Aici se verifică regulile pe care se sprijină, cu un depozit fals și o sesiune
// falsă:
//
//   1. invariantul de timp al unui lot (nu poate depăși funcția de 60s)
//   2. potrivirea modelelor: generații, ani, capcana Peugeot „2008”
//   3. traducerile scrise de om au întâietate și nu sunt călcate de automat
//   4. ce se trimite într-un anunț: anul doar când e sigur, generația în `variant`
//   5. amprenta: aceleași câmpuri => aceeași amprentă, indiferent de ordine
//   6. diferența de poze: ce se adaugă, ce se șterge, plafonul de 10
//   7. o piesă fără mapare NU se publică (nu se inventează o categorie)
//   8. retragerea: numai anunțurile pieselor care chiar nu mai sunt eligibile
//   9. coada automată: ce e de făcut se decide din starea de ACUM a piesei, iar
//      anunțul unei piese ȘTERSE se stinge deși rândul ei nu mai există
//
//   node scripts/verifica-dezro.mjs
//
// Iese cu cod 1 dacă vreo verificare pică.
// ============================================================
import {
  BUGET_MS, LIMITA_LOT_MS, BUGET_POZE_MS, TIMEOUT_MS, MAX_POZE,
  potrivesteModel, potrivesteMarca, potrivesteCategorie, normalizeazaModel,
  faraGeneratie, REGULI_CATEGORII, PRAG_SIGUR,
  construieste, amprentaCampuri, diferentaPoze, anulAnuntului, descriere, MOTIVE,
  lotPublicare, lotRetragere, lotCoada, pragCoada, PRAG_RETRAGERE, TIP_ANUNT,
} from "../lib/dezro/index.mjs";

let treceri = 0, picate = 0;
const cer = (eticheta, conditie, detaliu = "") => {
  if (conditie) { treceri++; console.log(`  ✓ ${eticheta}`); }
  else { picate++; console.log(`  ✗ ${eticheta}${detaliu ? ` — ${detaliu}` : ""}`); }
};
const sectiune = (t) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 52 - t.length))}`);

// ============================================================
sectiune("1. Invariantul de timp al unui lot");
// Funcția de pe Vercel trăiește 60 de secunde. Dacă cineva mărește una dintre
// valorile astea fără să se uite la celelalte, loturile încep să fie tăiate cu
// 504 exact în locul unde n-ar mai apuca să scrie în bază ce au făcut.
cer("BUGET_MS + TIMEOUT_MS ≤ LIMITA_LOT_MS", BUGET_MS + TIMEOUT_MS <= LIMITA_LOT_MS,
  `${BUGET_MS} + ${TIMEOUT_MS} = ${BUGET_MS + TIMEOUT_MS} > ${LIMITA_LOT_MS}`);
cer("LIMITA_LOT_MS ≤ 55s (sub cele 60 ale funcției)", LIMITA_LOT_MS <= 55_000, `${LIMITA_LOT_MS}`);
cer("BUGET_POZE_MS încape în bugetul unui lot", BUGET_POZE_MS < BUGET_MS, `${BUGET_POZE_MS} ≥ ${BUGET_MS}`);

// ============================================================
sectiune("2. Potrivirea modelelor");
const modeleVW = [
  { dezro_id: 1, nume: "Golf" }, { dezro_id: 2, nume: "Golf 5" }, { dezro_id: 3, nume: "Golf Plus" },
  { dezro_id: 4, nume: "Passat" }, { dezro_id: 5, nume: "Passat CC" }, { dezro_id: 6, nume: "Caddy" },
  { dezro_id: 7, nume: "T-Roc" }, { dezro_id: 8, nume: "Polo" },
];
const potr = (nume, lista = modeleVW) => potrivesteModel(nume, lista)?.nume ?? null;

cer("„Golf 5 (2003–2008)” -> „Golf 5” (identic, nu „Golf”)", potr("Golf 5 (2003–2008)") === "Golf 5", potr("Golf 5 (2003–2008)"));
cer("„Passat B6 (2005–2010)” -> „Passat”", potr("Passat B6 (2005–2010)") === "Passat", potr("Passat B6 (2005–2010)"));
cer("„Golf 5 Plus” -> „Golf Plus”, nu „Golf 5”", potr("Golf 5 Plus") === "Golf Plus", potr("Golf 5 Plus"));
cer("„Caddy III (2004–2015)” -> „Caddy”", potr("Caddy III (2004–2015)") === "Caddy", potr("Caddy III (2004–2015)"));
cer("„T-Roc 2GA 2018 - 2025” -> „T-Roc”", potr("T-Roc 2GA 2018 - 2025") === "T-Roc", potr("T-Roc 2GA 2018 - 2025"));
cer("„Polo 6R (2009–2017)” -> „Polo”", potr("Polo 6R (2009–2017)") === "Polo", potr("Polo 6R (2009–2017)"));

// Capcana Peugeot: „2008” e NUME de model, nu an. Dacă anii s-ar șterge orbește,
// numele ar rămâne gol și modelul n-ar mai putea fi potrivit niciodată.
cer("„2008” rămâne „2008” după normalizare (nu se șterge ca an)", normalizeazaModel("2008") === "2008", normalizeazaModel("2008"));
cer("„Crafter 2E 2006 -2017” -> „crafter 2e” (anii se scot)", normalizeazaModel("Crafter 2E 2006 -2017") === "crafter 2e", normalizeazaModel("Crafter 2E 2006 -2017"));
const peugeot = [{ dezro_id: 20, nume: "2008" }, { dezro_id: 21, nume: "208" }, { dezro_id: 22, nume: "308" }];
cer("Peugeot „2008” -> „2008”, nu „208”", potrivesteModel("2008", peugeot)?.nume === "2008", String(potrivesteModel("2008", peugeot)?.nume));

// Primul cuvânt nu se atinge niciodată: e chiar numele modelului.
cer("„A4” rămâne „a4” (nu se ia drept generație)", faraGeneratie("A4") === "a4", faraGeneratie("A4"));
cer("„X3 F25” -> „x3”", faraGeneratie("X3 F25") === "x3", faraGeneratie("X3 F25"));

// Prefixul invers merge doar când e UNIC.
const bmw = [{ dezro_id: 30, nume: "F07 Gran Turismo" }, { dezro_id: 31, nume: "X3" },
              { dezro_id: 32, nume: "X3 M" }, { dezro_id: 33, nume: "X3 M50" }];
cer("„F07” -> „F07 Gran Turismo” (singurul cu prefixul ăsta)", potrivesteModel("F07", bmw)?.nume === "F07 Gran Turismo");
cer("„X3” -> „X3” exact, nu vreun „X3 M”", potrivesteModel("X3", bmw)?.nume === "X3");

// Distanța de o literă e voie DOAR fără cifre: „Golf 5”/„Golf 6” sunt la 1.
cer("„Giulietta” -> „Giuletta” (greșeala lor de scriere)",
  potrivesteMarca("Giulietta", [{ dezro_id: 40, nume: "Giuletta" }])?.nume === "Giuletta");
cer("„Golf 5” NU se lipește de „Golf 6”",
  potrivesteModel("Golf 5", [{ dezro_id: 41, nume: "Golf 6" }]) === null,
  String(potrivesteModel("Golf 5", [{ dezro_id: 41, nume: "Golf 6" }])?.nume));

// ============================================================
sectiune("3. Traducerile scrise de om");
const catalogFals = [
  { dezro_id: 1, nume: "Elemente caroserie", parinte: null, selectabil: false },
  { dezro_id: 2, nume: "Bara spate", parinte: 1, selectabil: true },
  { dezro_id: 3, nume: "Intaritura bara spate", parinte: 1, selectabil: true },
  { dezro_id: 4, nume: "Clima habitaclu", parinte: null, selectabil: true },
  { dezro_id: 5, nume: "Compresor aer conditionat", parinte: 4, selectabil: true },
  { dezro_id: 6, nume: "Suport compresor AC", parinte: 4, selectabil: true },
];
const catPentru = (slug, nume, parinte = null) =>
  potrivesteCategorie({ slug, nume, numeParinte: parinte }, catalogFals, 3)[0];

// Fără regulă, automatul alege „Suport compresor AC”: are două cuvinte comune
// din trei. Cu regulă, alege compresorul. Ăsta e chiar motivul pentru care
// REGULI_CATEGORII există.
const cuRegula = catPentru("climatizare-si-incalzire-compresor-ac", "Compresor AC", "Climatizare (AC) și încălzire");
cer("„Compresor AC” -> compresorul, nu suportul lui", cuRegula?.dezro_id === 5, String(cuRegula?.nume));
cer("regula e marcată ca atare (scor 100)", cuRegula?.regula === true && cuRegula?.scor === 100);

// O categorie de GRUPARE nu poate fi propusă: ei o refuză la trimitere.
const neselectabil = potrivesteCategorie({ slug: "x", nume: "Elemente caroserie" }, catalogFals, 5)
  .some((c) => c.dezro_id === 1);
cer("categoriile neselectabile nu se propun niciodată", !neselectabil);

// Toate regulile trebuie să arate spre o cale, nu spre un id: un id schimbat la
// ei ar rupe tăcut maparea, o cale se vede că nu se mai rezolvă.
const reguliFaraCale = Object.entries(REGULI_CATEGORII).filter(([, v]) => !/^[^>]+( > [^>]+)*$/.test(v));
cer("toate regulile sunt căi de catalog", reguliFaraCale.length === 0, reguliFaraCale.slice(0, 3).join(", "));
cer("regulile acoperă categoriile mari", Object.keys(REGULI_CATEGORII).length >= 200,
  `${Object.keys(REGULI_CATEGORII).length}`);

// ============================================================
sectiune("4. Ce se trimite într-un anunț");
/** Un pixel WebP valid, ca `aducePoza` să întoarcă un fișier adevărat. */
const POZA_FALSA = "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4H";

const context = {
  catalogDupaId: new Map([["model:2", { dezro_id: 2, nume: "Golf", parinte: 78 }]]),
  mapariModele: new Map([[10, 2]]),
  mapariCategorii: new Map([[5, 46]]),
  modeleNoastre: new Map([[10, { id: 10, nume: "Golf 5 (2003–2008)", brand_id: 1 }]]),
  marciNoastre: new Map([[1, { id: 1, nume: "Volkswagen" }]]),
};
const piesaFalsa = {
  id: 1, cod_intern: "AP-000001", nume: "Far stanga Vw Golf 5 2004 2005 2006",
  pret_lei: "350.00", pret_sufix: null, ani: "2004–2008", oem: null, stoc: 1,
  stare_nota: "Far original, fara fisuri.", compat: ["Volkswagen Golf 5", "Volkswagen Jetta"],
  // Poze care chiar se pot „aduce": `fetch` din Node citește data: URL-uri, deci
  // testul trece prin exact același drum ca o poză reală din Storage, fără rețea.
  poze: [POZA_FALSA + "1", POZA_FALSA + "2"],
  model_ids: [10], categorie_id: 4, subcategorie_id: 5,
};
const a = construieste(piesaFalsa, context);
cer("piesa completă se poate publica", a.ok, a.motiv);
cer("tipul e „Piese Auto” (0)", a.campuri?.type === TIP_ANUNT);
cer("marca vine din modelul lor, nu dintr-o mapare separată", a.campuri?.idBrand === 78);
cer("modelul e cel mapat", a.campuri?.idModel === 2);
cer("categoria e cea mapată", a.campuri?.idPart === 46);
cer("prețul e întreg", a.campuri?.price === 350);

// Anul: PRIMUL din interval. Decizia de dimineata (niciun an, ca sa nu inventam)
// a fost rasturnata chiar de moderatorul lor, care a verificat primul anunt real:
// categoria ok, marca ok, modelul ok, pretul ok, titlul ok - dar nu avem an.
cer("din interval se ia PRIMUL an", a.campuri?.year === 2004, String(a.campuri?.year));
cer("un an singur se trimite ca atare", anulAnuntului("2011") === 2011);
cer("intervalul da primul an", anulAnuntului("2004-2008") === 2004);
cer("fara ani -> 0 (an necunoscut la ei)", anulAnuntului(null) === 0);
cer("text fara ani -> 0", anulAnuntului("necunoscut") === 0);

// Generația e singurul lucru pe care catalogul lor plat nu-l are.
cer("generația ajunge în `variant`", a.campuri?.variant === "Golf 5", a.campuri?.variant);
cer("intervalul de ani ajunge în descriere", (a.campuri?.description ?? "").includes("2004–2008"));
cer("codul intern ajunge în descriere", (a.campuri?.description ?? "").includes("AP-000001"));
cer("compatibilitățile ajung în descriere", (a.campuri?.description ?? "").includes("Volkswagen Jetta"));
// Un link către magazinul nostru într-un anunț de pe un portal de anunțuri e
// motiv de respingere. Codul intern face aceeași treabă fără riscul ăsta.
cer("descrierea NU conține link către site-ul nostru",
  !/https?:\/\//.test(a.campuri?.description ?? ""));

// ============================================================
sectiune("5. Amprenta");
const c1 = { title: "A", description: "B", type: 0, idBrand: 1, idModel: 2, idPart: 3, year: 0, price: 10, qty: 1, variant: "", oem: "" };
const c2 = { qty: 1, oem: "", variant: "", price: 10, year: 0, idPart: 3, idModel: 2, idBrand: 1, type: 0, description: "B", title: "A" };
cer("ordinea cheilor nu schimbă amprenta", amprentaCampuri(c1) === amprentaCampuri(c2));
cer("un preț schimbat schimbă amprenta", amprentaCampuri(c1) !== amprentaCampuri({ ...c1, price: 11 }));
cer("descrierea schimbată schimbă amprenta", amprentaCampuri(c1) !== amprentaCampuri({ ...c1, description: "C" }));

// ============================================================
sectiune("6. Diferența de poze");
const d1 = diferentaPoze(["a", "b", "c"], ["a", "b"], [{ id: 1 }, { id: 2 }]);
cer("poza nouă se adaugă", d1.deAdaugat.length === 1 && d1.deAdaugat[0] === "c");
cer("nimic de șters când nu s-a scos nimic", d1.deSters.length === 0);

const d2 = diferentaPoze(["a"], ["a", "b"], [{ id: 1 }, { id: 2 }]);
cer("poza scoasă se șterge după id-ul LOR", d2.deSters.length === 1 && d2.deSters[0].id === 2);

const multe = Array.from({ length: 15 }, (_, i) => `p${i}`);
const d3 = diferentaPoze(multe, [], []);
cer(`nu se trimit mai mult de ${MAX_POZE} poze`, d3.deAdaugat.length <= MAX_POZE, `${d3.deAdaugat.length}`);

const d4 = diferentaPoze(["a", "b"], ["a", "b"], [{ id: 1 }, { id: 2 }]);
cer("fără schimbări => nicio cerere de poze", d4.deAdaugat.length === 0 && d4.deSters.length === 0);

// ============================================================
sectiune("7. Ce NU se publică");
const fara = (patch) => construieste({ ...piesaFalsa, ...patch }, context);
cer("fără poză -> nu se publică", fara({ poze: [] }).motiv === MOTIVE.faraPoza);
cer("fără model -> nu se publică", fara({ model_ids: [] }).motiv === MOTIVE.faraModel);
cer("model nemapat -> nu se publică", fara({ model_ids: [999] }).motiv === MOTIVE.modelNemapat);
cer("fără categorie -> nu se publică", fara({ categorie_id: null, subcategorie_id: null }).motiv === MOTIVE.faraCategorie);
cer("categorie nemapată -> nu se publică", fara({ subcategorie_id: 999 }).motiv === MOTIVE.categorieNemapata);

// Modelul PRINCIPAL, niciodată al doilea: `model_ids[0]` e mașina de pe care
// s-a demontat piesa. A cădea pe a doua compatibilitate ar trece un Sharan la Ford.
const alDoilea = construieste({ ...piesaFalsa, model_ids: [999, 10] }, context);
cer("nu se cade pe a doua compatibilitate", !alDoilea.ok && alDoilea.motiv === MOTIVE.modelNemapat);

// ============================================================
sectiune("8. Publicare și retragere, pe un depozit fals");
function depozitFals(stare) {
  return {
    piese: stare.piese,
    async pieseEligibile(dupa, cate) { return stare.piese.filter((p) => p.id > dupa).slice(0, cate); },
    async citesteAnunturiPentru(ids) { return new Map(ids.filter((i) => stare.anunturi[i]).map((i) => [i, stare.anunturi[i]])); },
    async scrieAnunt(id, patch) { stare.anunturi[id] = { ...(stare.anunturi[id] ?? {}), product_id: id, ...patch }; },
    async pieseDupaIduri(ids) { return stare.piese.filter((p) => ids.includes(p.id)); },
    async anunturiDeRetras(dupa, cate) {
      const eligibile = new Set(stare.piese.map((p) => p.id));
      return Object.values(stare.anunturi)
        .filter((a) => a.status === "activ" && a.product_id > dupa)
        .sort((x, y) => x.product_id - y.product_id).slice(0, cate)
        .map((a) => ({ ...a, deRetras: !eligibile.has(a.product_id) }));
    },
  };
}
/** Sesiune falsă: numără ce s-ar trimite, nu trimite nimic. */
function sesiuneFalsa(jurnal) {
  let idAnunt = 100;
  return {
    async cere(cale, opt = {}) {
      jurnal.push(`${opt.metoda ?? "GET"} ${cale}`);
      if (opt.metoda === "DELETE") return { message: "ok" };
      idAnunt++;
      return { ad: { id: idAnunt, alias: `a-${idAnunt}`, url: `https://www.dez.ro/a-${idAnunt}.html`, approved: true, images: [] } };
    },
  };
}

const jurnal = [];
const stare = { piese: [piesaFalsa], anunturi: {} };
const dep = depozitFals(stare);
const r1 = await lotPublicare({ cfg: {}, depozit: dep, sesiune: sesiuneFalsa(jurnal), job: { pozitie: 0 }, context });
cer("piesa nouă se publică", r1.publicate === 1, JSON.stringify(r1.motive));
cer("s-a chemat POST /ads o singură dată", jurnal.filter((x) => x === "POST /ads").length === 1, jurnal.join(" | "));
cer("anunțul e memorat ca activ", stare.anunturi[1]?.status === "activ");

// A doua trecere, cu absolut nimic schimbat: NU trebuie să plece nicio cerere.
const jurnal2 = [];
const r2 = await lotPublicare({ cfg: {}, depozit: dep, sesiune: sesiuneFalsa(jurnal2), job: { pozitie: 0 }, context });
cer("a doua trecere nu atinge nimic", r2.neschimbate === 1 && r2.publicate === 0 && r2.actualizate === 0);
cer("a doua trecere nu face nicio cerere la ei", jurnal2.length === 0, jurnal2.join(" | "));

// Prețul schimbat: se actualizează, dar NU se creează un al doilea anunț.
stare.piese[0] = { ...piesaFalsa, pret_lei: "300.00" };
const jurnal3 = [];
const r3 = await lotPublicare({ cfg: {}, depozit: dep, sesiune: sesiuneFalsa(jurnal3), job: { pozitie: 0 }, context });
cer("prețul schimbat => actualizare, nu anunț nou", r3.actualizate === 1 && r3.publicate === 0);
cer("actualizarea merge pe același anunț", jurnal3.some((x) => x.startsWith("POST /ads/")), jurnal3.join(" | "));

// Piesa dispare din stoc: anunțul se retrage.
stare.piese = [];
const jurnal4 = [];
const r4 = await lotRetragere({ depozit: dep, sesiune: sesiuneFalsa(jurnal4), job: { pozitie: 0 } });
cer("piesa vândută => anunțul se retrage", r4.retrase === 1, JSON.stringify(r4));
cer("s-a chemat DELETE /ads/{id}", jurnal4.some((x) => x.startsWith("DELETE /ads/")), jurnal4.join(" | "));
cer("rândul rămâne în bază, cu status „retras”", stare.anunturi[1]?.status === "retras");

// Iar o piesă care ÎNCĂ e eligibilă nu se retrage niciodată.
stare.piese = [piesaFalsa];
stare.anunturi[1] = { ...stare.anunturi[1], status: "activ" };
const jurnal5 = [];
const r5 = await lotRetragere({ depozit: dep, sesiune: sesiuneFalsa(jurnal5), job: { pozitie: 0 } });
cer("piesa încă în stoc NU se retrage", r5.retrase === 0 && jurnal5.length === 0, jurnal5.join(" | "));

// ============================================================
sectiune("9. Coada automată (migrarea 39)");
// Regula pe care se sprijină tot mecanismul: ce e de făcut cu un rând din coadă
// se decide din starea piesei de ACUM, nu din `motiv`-ul scris de trigger.
// Între trigger și procesare piesa se mai poate schimba o dată — iar o coadă
// care ar ține minte „era de publicat" ar trimite la ei o piesă vândută între timp.
{
  const st = { piese: [piesaFalsa], anunturi: {} };
  const d = depozitFals(st);
  d.coadaSterge = async () => {};
  d.coadaEsec = async () => {};

  const j1 = [];
  const c1r = await lotCoada({ depozit: d, sesiune: sesiuneFalsa(j1), context,
    randuri: [{ id: 1, product_id: 1, motiv: "piesă nouă" }] });
  cer("piesă nouă din coadă => se publică", c1r.publicate === 1 && c1r.facute.length === 1, JSON.stringify(c1r.motive));

  // Același rând, nimic schimbat: rândul se închide, dar fără nicio cerere la ei.
  const j2 = [];
  const c2r = await lotCoada({ depozit: d, sesiune: sesiuneFalsa(j2), context,
    randuri: [{ id: 2, product_id: 1, motiv: "piesă modificată" }] });
  cer("rând fără nicio schimbare => zero cereri la ei", c2r.neschimbate === 1 && j2.length === 0, j2.join(" | "));
  cer("rândul se închide oricum (nu rămâne blocat)", c2r.facute.length === 1);

  // Triggerul a scris „piesă modificată", dar între timp piesa s-a VÂNDUT.
  // Decizia se ia din starea de acum: anunțul se retrage.
  st.piese = [];
  const j3 = [];
  const c3r = await lotCoada({ depozit: d, sesiune: sesiuneFalsa(j3), context,
    randuri: [{ id: 3, product_id: 1, motiv: "piesă modificată" }] });
  cer("piesa vândută între timp => se retrage, nu se publică",
    c3r.retrase === 1 && c3r.publicate === 0, JSON.stringify(c3r));
  cer("s-a chemat DELETE /ads/{id}", j3.some((x) => x.startsWith("DELETE /ads/")), j3.join(" | "));

  // Piesa ȘTEARSĂ din bază: rândul din `dezro_anunturi` a plecat cu ea, deci
  // singura urmă a anunțului e `ad_id`-ul copiat în coadă de trigger.
  const j4 = [];
  const c4r = await lotCoada({ depozit: d, sesiune: sesiuneFalsa(j4), context,
    randuri: [{ id: 4, ad_id: 555, motiv: "piesă ștearsă" }] });
  cer("piesă ștearsă => anunțul orfan se stinge după ad_id",
    c4r.retrase === 1 && j4.some((x) => x === "DELETE /ads/555"), j4.join(" | "));

  // O piesă nepublicată care n-a avut niciodată anunț: rândul se închide fără
  // nicio cerere. E cazul obișnuit al unei piese editate în admin.
  const j5 = [];
  const c5r = await lotCoada({ depozit: d, sesiune: sesiuneFalsa(j5), context,
    randuri: [{ id: 5, product_id: 42, motiv: "piesă modificată" }] });
  cer("piesă fără anunț și fără stoc => zero cereri", c5r.neschimbate === 1 && j5.length === 0, j5.join(" | "));
}

// Plasa de 20%: aici nu apasă nimeni niciun buton, deci trebuie să OPREASCĂ.
{
  const depPrag = (active, deRetras, deSters) => ({
    async pragRetragere() { return { active, deRetras, procent: active ? deRetras / active : 0 }; },
    async coadaStare() { return { de_sters: deSters }; },
  });
  const putine = await pragCoada({ depozit: depPrag(1000, 50, 0) });
  cer("50 din 1.000 de anunțuri => trece", !putine.depasit, JSON.stringify(putine));
  const multe = await pragCoada({ depozit: depPrag(1000, 300, 0) });
  cer("300 din 1.000 => se oprește și cere confirmare", multe.depasit, JSON.stringify(multe));
  // Piesele ȘTERSE nu mai apar în `dezro_de_retras` (rândul lor din
  // `dezro_anunturi` a plecat cu ele), deci trebuie numărate separat — altfel
  // exact ștergerea în masă, cazul cel mai grav, ar trece pe lângă plasă.
  const sterse = await pragCoada({ depozit: depPrag(1000, 0, 300) });
  cer("300 de piese ȘTERSE => tot se oprește", sterse.depasit, JSON.stringify(sterse));
  cer("pragul e același ca la publicarea mare", PRAG_RETRAGERE === 0.2, String(PRAG_RETRAGERE));
}

// ============================================================
console.log(`\n${treceri} verificări trecute, ${picate} picate.`);
process.exit(picate ? 1 : 0);
