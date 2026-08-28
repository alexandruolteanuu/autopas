// ============================================================
// VERIFICAREA MOTORULUI DE IMPORT — fără rețea, fără bază de date.
//
// Importul complet durează ore și lovește un server care nu e al nostru, deci nu
// poate fi rulat de fiecare dată când cineva schimbă o regulă. Aici se verifică
// exact regulile pe care se sprijină importul, cu o sursă falsă și un depozit
// fals:
//
//   1. parserul CSV
//   2. protecția anti-fișier-trunchiat (20%)
//   3. ce are voie să atingă un re-import (munca operatorului rămâne intactă)
//   4. rândul construit la import: publicat, cu 1 kg estimat, cu poze
//   5. reluarea după închiderea tabului: nici sărituri, nici rânduri dublate
//   6. canarul: peste 20% pagini fără poze, importul se oprește singur
//
//   node scripts/verifica-import.mjs
//
// Iese cu cod 1 dacă vreo verificare pică.
// ============================================================
import {
  parseCSV, verificaColoane, planifica, proceseazaRanduri,
  patchLaReimport, construiesteRand, PRAG_CANAR, REZERVA_MS,
  potrivesteCategoria, modelDinTitlu, categoriaSursa, slugifica,
  extrage, potriveste, taxonomieDinUrl, numeModelNou,
} from "../lib/import/index.mjs";

let treceri = 0, picate = 0;
const cer = (eticheta, conditie, detaliu = "") => {
  if (conditie) { treceri++; console.log(`  ✓ ${eticheta}`); }
  else { picate++; console.log(`  ✗ ${eticheta}${detaliu ? ` — ${detaliu}` : ""}`); }
};
const sectiune = (t) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 52 - t.length))}`);

// ============================================================
// Sursă falsă: o pagină de produs cu exact structura pe care o citim.
// ============================================================
const paginaFalsa = ({ titlu, poze = 1, model = "Volkswagen Passat B6" }) => `
<html><head>
<meta property="og:url" content="https://www.pieseauto.ro/etriere/vw/passat-b6/piesa-1.html">
<meta itemprop="price" content="350"><meta itemprop="priceCurrency" content="RON">
</head><body>
<h1>${titlu}</h1>
<div itemprop="description">Piesă testată, demontată de pe mașină.</div>
<div class="pr-subtitle2">Piesă auto compatibilă cu:</div>
${[].concat(model).map((m, i) => i === 0
  ? `<p><span class="q-car-model"> <a href="https://www.pieseauto.ro/x/">${m}</a> </span></p>`
  : `<p><span class="q-car-model"> ${m} </span></p>`).join("")}
<script>let images = [${Array.from({ length: poze }, (_, i) => `{"original":"https://exemplu/poza${i}.jpg","size":[1024,576]}`).join(",")}];</script>
</body></html>`;

const taxonomieFalsa = {
  brands: [{ id: 1, nume: "Volkswagen", slug: "vw" }],
  models: [{ id: 10, nume: "Passat B6 (2005–2010)", brand_id: 1 }],
  categories: [
    { id: 1, nume: "Sistem de frânare", slug: "franare", parent_id: null, art: "brake" },
    { id: 2, nume: "Etriere", slug: "etriere", parent_id: 1, art: "brake" },
  ],
};

/** Depozit fals: ține minte ce s-a scris, nu atinge nimic real. */
function depozitFals(existente = []) {
  const dupaId = new Map(existente.map((x) => [x.sursa_id, x]));
  const scrise = { inserate: [], actualizate: [], poze: [], categorii: [], modele: [], intrebariExistenta: [] };
  return {
    scrise,
    async citesteExistente(_s, ids) {
      scrise.intrebariExistenta.push(ids.length);
      const m = new Map();
      for (const id of ids) if (dupaId.has(id)) m.set(id, dupaId.get(id));
      return m;
    },
    async citesteToateDeLaSursa() { return existente; },
    async insereazaPiesa(r) { scrise.inserate.push(r); return { ...r, id: scrise.inserate.length }; },
    async actualizeazaPiesa(id, patch) { scrise.actualizate.push({ id, patch }); },
    async urcaPoza(cale, date) { scrise.poze.push(cale); return `https://exemplu/${cale}`; },
    async asiguraCategorie(c) {
      const gasit = scrise.categorii.find((x) => x.slug === c.slug);
      if (gasit) return gasit;
      const rand = { ...c, id: 1000 + scrise.categorii.length };
      scrise.categorii.push(rand);
      return rand;
    },
    async asiguraModel(m) {
      const gasit = scrise.modele.find((x) => x.slug === m.slug);
      if (gasit) return gasit;
      const rand = { ...m, id: 2000 + scrise.modele.length };
      scrise.modele.push(rand);
      return rand;
    },
    async depublica() {},
    async citesteTaxonomia() { return taxonomieFalsa; },
  };
}

const feedFals = (n, de = 0) => Array.from({ length: n }, (_, i) => ({
  ID: String(de + i + 1), URL: `https://www.pieseauto.ro/produs-${de + i + 1}.html`,
  Titlu: `Etrier Vw Passat B6 2008 ${de + i + 1}`, Moneda: "RON", Pret: "350",
}));

// ============================================================
// 1. CSV
// ============================================================
sectiune("1. Parserul CSV");
{
  const text = 'ID,URL,Titlu,Moneda,Pret\n1,http://x/1,"Etrier, spate ""B8""",RON,350\n2,http://x/2,Fuzeta,RON,120\n';
  const r = parseCSV(text);
  cer("două rânduri citite", r.length === 2, `am ${r.length}`);
  cer("virgula din interiorul ghilimelelor nu rupe câmpul", r[0].Titlu === 'Etrier, spate "B8"', r[0]?.Titlu);
  cer("coloanele obligatorii sunt recunoscute", verificaColoane(r) === null);
  cer("un fișier fără coloanele cerute e refuzat", verificaColoane(parseCSV("A,B\n1,2\n")) !== null);
  cer("BOM-ul UTF-8 nu strică prima coloană", parseCSV("﻿" + text)[0].ID === "1");
}

// ============================================================
// 2. Protecția anti-fișier-trunchiat
// ============================================================
sectiune("2. Protecția de 20% la depublicare");
{
  const inBaza = Array.from({ length: 100 }, (_, i) => ({
    id: i + 1, sursa_id: String(i + 1), nume: `P${i + 1}`, pret_lei: 350,
    editat_manual: false, publicat: true, sursa_activ: true,
  }));

  const putine = planifica(feedFals(90), inBaza);
  cer("10% lipsă => se aplică fără întrebări", putine.disparute.length === 10 && !putine.pragDepasit);

  const multe = planifica(feedFals(50), inBaza);
  cer("50% lipsă => cere confirmare", multe.disparute.length === 50 && multe.pragDepasit);

  const laLimita = planifica(feedFals(80), inBaza);
  cer("exact 20% NU declanșează pragul", !laLimita.pragDepasit, `${(laLimita.procentDisparute * 100).toFixed(0)}%`);

  // Ultimele 50 au fost deja depublicate la un import anterior, iar feed-ul le
  // conține exact pe primele 50. Dacă le-am număra din nou, procentul ar crește
  // de la o rulare la alta fără să dispară nimic nou.
  const dejaStinse = inBaza.map((x, i) => (i >= 50 ? { ...x, sursa_activ: false } : x));
  const aDoua = planifica(feedFals(50), dejaStinse);
  cer("piesele deja depublicate nu se numără din nou", aDoua.disparute.length === 0 && !aDoua.pragDepasit);

  cer("feed complet => zero dispăruți", planifica(feedFals(100), inBaza).disparute.length === 0);
}

// ============================================================
// 3. Ce are voie să atingă un re-import
// ============================================================
sectiune("3. Munca operatorului rămâne intactă la re-import");
{
  const feed = { ID: "1", Titlu: "Titlu nou de la sursă", Pret: "400" };
  const neatinsa = { pret_lei: 350, nume: "Titlu vechi", editat_manual: false, sursa_activ: true };
  const editata = { pret_lei: 350, nume: "Titlu scris de operator", editat_manual: true, sursa_activ: true };

  const p1 = patchLaReimport(neatinsa, feed);
  cer("prețul schimbat se scrie", p1?.pret_lei === 400);
  cer("titlul se actualizează dacă piesa n-a fost editată", p1?.nume === "Titlu nou de la sursă");

  const p2 = patchLaReimport(editata, feed);
  cer("titlul editat manual NU se suprascrie", p2 && !("nume" in p2), JSON.stringify(p2));
  cer("prețul se actualizează și la o piesă editată", p2?.pret_lei === 400);

  const p3 = patchLaReimport({ ...neatinsa, pret_lei: 400, nume: "Titlu nou de la sursă" }, feed);
  cer("un rând fără nicio schimbare nu se atinge deloc", p3 === null);

  const p4 = patchLaReimport({ ...neatinsa, pret_lei: 400, nume: "Titlu nou de la sursă", sursa_activ: false }, feed);
  cer("o piesă reapărută în feed redevine activă", p4?.sursa_activ === true);
  cer("dar NU se republică singură — decizia operatorului rămâne", p4 && !("publicat" in p4));
  cer("pozele, greutatea și categoria nu apar niciodată în patch",
    ["poze", "greutate_kg", "categorie_id", "stare_nota", "cost_lei"].every((c) => !(p1 && c in p1)));
}

// ============================================================
// 4. Rândul construit la import
// ============================================================
sectiune("4. Rândul nou: publicat, 1 kg estimat, cu poze");
{
  const x = {
    titlu: "Etrier Vw Passat B6", feed: { Titlu: "Etrier", Pret: "350" }, sursa_id: "77",
    sursa_url: "https://www.pieseauto.ro/etriere/vw/passat-b6/x-77.html",
    descriere: "Piesă testată", poze: ["https://exemplu/a.jpg"], compat: ["Volkswagen Passat B6"],
    an_min: 2008, an_max: 2008, categorie_id: 1, subcategorie_id: 2, model_id: 10, revizuire: [],
  };
  const cuPoze = construiesteRand(x, taxonomieFalsa.categories, ["https://noi/a.webp"]);
  cer("piesa intră PUBLICATĂ", cuPoze.publicat === true);
  cer("greutatea e 1 kg, marcată estimată", cuPoze.greutate_kg === 1 && cuPoze.greutate_estimata === true);
  cer("pozele proprii ajung în `poze`", cuPoze.poze.length === 1 && cuPoze.poze_descarcate === true);
  cer("URL-urile sursei rămân separat, în `poze_sursa`", cuPoze.poze_sursa.length === 1);
  cer("slug-ul poartă id-ul sursei, deci e unic", cuPoze.slug.endsWith("-77"));
  cer("`stare` A/B/C nu se completează", !("stare" in cuPoze));

  const faraPoze = construiesteRand({ ...x, revizuire: ["nicio poză n-a putut fi adusă"] }, taxonomieFalsa.categories, []);
  cer("fără poze piesa se publică TOTUȘI", faraPoze.publicat === true);
  cer("motivul rămâne scris în import_erori", !!faraPoze.import_erori?.revizuire?.length);
  cer("poze_descarcate rămâne false, ca butonul de reluare s-o găsească", faraPoze.poze_descarcate === false);
}

// ============================================================
// 5. Reluarea după închiderea tabului
// ============================================================
sectiune("5. Reluarea din poziția salvată");
{
  // 500 de rânduri care există deja în bază: niciun apel către sursă, deci
  // verificarea rulează instant și testează exact aritmetica reluării.
  const feed = feedFals(500);
  const inBaza = feed.map((r, i) => ({
    id: i + 1, sursa_id: r.ID, nume: r.Titlu, pret_lei: 350,
    editat_manual: false, publicat: true, sursa_activ: true,
  }));

  // Rulare „dintr-o bucată", cu loturi de 120 de rânduri, ca ruta din admin.
  const dep = depozitFals(inBaza);
  let pozitie = 0, loturi = 0;
  const vazute = [];
  while (pozitie < feed.length) {
    const rez = await proceseazaRanduri({
      depozit: dep, randuri: feed.slice(pozitie), taxonomie: taxonomieFalsa,
      maxRanduri: 120, laProgres: (ev) => vazute.push(ev.rand.ID),
    });
    pozitie += rez.procesate; loturi++;
    if (!rez.procesate) break;
  }
  cer("tot feed-ul e parcurs", pozitie === 500, `poziția finală ${pozitie}`);
  cer("în loturi, nu dintr-o dată", loturi === Math.ceil(500 / 120), `${loturi} loturi`);
  cer("niciun rând sărit sau dublat", new Set(vazute).size === 500 && vazute.length === 500);

  // Acum: tabul se închide la jumătate, apoi se redeschide.
  const dep2 = depozitFals(inBaza);
  const primaParte = await proceseazaRanduri({
    depozit: dep2, randuri: feed, taxonomie: taxonomieFalsa, maxRanduri: 237,
  });
  const dupaReluare = await proceseazaRanduri({
    depozit: dep2, randuri: feed.slice(primaParte.procesate), taxonomie: taxonomieFalsa,
  });
  // Un lot întreabă baza DOAR despre rândurile pe care le poate atinge. Pare un
  // detaliu, dar cine îl strică plătește scump: la un feed de 8.500, întrebarea
  // despre toată coada înseamnă 85 de cereri REST (3,4s măsurate) înainte de a
  // procesa 4 piese — la fiecare lot, de ~1.900 de ori.
  const depFelie = depozitFals(inBaza);
  await proceseazaRanduri({
    depozit: depFelie, randuri: feed, taxonomie: taxonomieFalsa, maxRanduri: 120,
  });
  cer("lotul întreabă doar despre feliile lui, nu despre tot feed-ul",
      depFelie.scrise.intrebariExistenta.every((n) => n <= 120),
      `a întrebat despre ${depFelie.scrise.intrebariExistenta.join(", ")} rânduri`);

  cer("întrerupt la 237, reluat de acolo, total 500",
    primaParte.procesate + dupaReluare.procesate === 500,
    `${primaParte.procesate} + ${dupaReluare.procesate}`);
  cer("piesele deja în bază nu se re-inserează", dep2.scrise.inserate.length === 0);
  cer("și nici nu se rescriu degeaba", dep2.scrise.actualizate.length === 0);
}

// ============================================================
// 6. Canarul
// ============================================================
sectiune("6. Canarul: peste 20% pagini fără poze, importul se oprește");
{
  const feed = feedFals(60);

  // a) sursa merge normal — 60 de pagini cu poze
  const depBun = depozitFals([]);
  const bun = await proceseazaRanduri({
    depozit: depBun, randuri: feed, taxonomie: taxonomieFalsa, uscat: true,
    adu: async () => ({ ok: true, html: paginaFalsa({ titlu: "Etrier Vw Passat B6 2008" }), urlFinal: "https://www.pieseauto.ro/etriere/vw/passat-b6/x.html" }),
    pauza: async () => {},
  });
  cer("cu poze peste tot, importul merge până la capăt", bun.procesate === 60 && !bun.oprit);
  cer("piesele noi sunt numărate ca noi", bun.noi === 60);

  // b) sursa și-a schimbat HTML-ul — nicio poză nicăieri
  const depRau = depozitFals([]);
  const rau = await proceseazaRanduri({
    depozit: depRau, randuri: feed, taxonomie: taxonomieFalsa, uscat: true,
    adu: async () => ({ ok: true, html: paginaFalsa({ titlu: "Etrier Vw Passat B6 2008", poze: 0 }), urlFinal: "https://www.pieseauto.ro/etriere/vw/passat-b6/x.html" }),
    pauza: async () => {},
  });
  cer("fără poze nicăieri, importul se oprește", rau.oprit === "canar", `oprit=${rau.oprit}`);
  cer("se oprește după prima fereastră de 50, nu la final", rau.procesate === 50, `${rau.procesate} procesate`);
  cer("mesajul spune ce s-a întâmplat", (rau.mesaj ?? "").includes("nicio poză"));

  // c) sub prag — 8 din 60 fără poze (13%)
  let n = 0;
  const depMix = depozitFals([]);
  const mix = await proceseazaRanduri({
    depozit: depMix, randuri: feed, taxonomie: taxonomieFalsa, uscat: true,
    adu: async () => ({ ok: true, html: paginaFalsa({ titlu: "Etrier Vw Passat B6 2008", poze: n++ < 8 ? 0 : 1 }), urlFinal: "https://www.pieseauto.ro/etriere/vw/passat-b6/x.html" }),
    pauza: async () => {},
  });
  cer(`sub pragul de ${PRAG_CANAR * 100}% importul continuă`, !mix.oprit && mix.procesate === 60);

  // d) extragerea chiar funcționează pe pagina falsă
  const unul = await proceseazaRanduri({
    depozit: depozitFals([]), randuri: feedFals(1), taxonomie: taxonomieFalsa, uscat: true,
    adu: async () => ({ ok: true, html: paginaFalsa({ titlu: "Etrier Vw Passat B6 2008" }), urlFinal: "https://www.pieseauto.ro/etriere/vw/passat-b6/x.html" }),
    pauza: async () => {},
  });
  cer("marca și modelul se potrivesc din pagină", unul.revizuire === 0, `${unul.revizuire} marcate pentru revizuire`);
  cer("categoria-sursă e numărată", unul.categoriiSursa.etriere === 1);
}

// ============================================================
// 7. Bugetul unui lot
//
// Defectul din 25 august 2026: pe un mediu fără `curl` se cădea pe `fetch`, care
// vorbește HTTP/1.1 și e refuzat de sursă. Fiecare piesă nouă primea pagina
// „sorry", intra în scara de reîncercări (5+15+45 = 65 de secunde) și ducea lotul
// peste limita funcției. Serverul îl tăia cu 504 înainte să apuce să salveze ceva,
// deci `procesate` rămânea 0 și reluarea măcina la nesfârșit aceleași rânduri.
// Transportul e azi HTTP/2 și trece de peste tot, dar regulile de mai jos rămân:
// un refuz care ține trebuie să oprească lotul, nu să-l macine.
// ============================================================
sectiune("7. Bugetul unui lot: fatal oprește, trecător se sare");
{
  const feed = feedFals(40);

  // a) eroare FATALĂ (mediul nu poate ajunge la sursă): lotul se oprește la primul
  //    rând, cu motivul la vedere. NU marchează 40 de rânduri ca eșuate.
  let ceruteFatal = 0;
  const fatal = await proceseazaRanduri({
    depozit: depozitFals([]), randuri: feed, taxonomie: taxonomieFalsa, uscat: true,
    adu: async () => { ceruteFatal++; return { ok: false, fatal: true, eroare: "refuz persistent de la sursă" }; },
    pauza: async () => {},
  });
  cer("o eroare fatală oprește lotul", fatal.oprit === "refuz", `oprit=${fatal.oprit}`);
  cer("se cere o singură pagină, nu toate 40", ceruteFatal === 1, `${ceruteFatal} cereri`);
  cer("niciun rând nu e marcat ca eșuat", fatal.erori.length === 0, `${fatal.erori.length} erori`);
  cer("poziția nu avansează peste rândul netrecut", fatal.procesate === 0, `${fatal.procesate}`);
  cer("mesajul spune de ce", (fatal.mesaj ?? "").includes("refuz"));
  cer("pagina netrecută nu intră în canar", fatal.canar.total === 0, `canar=${fatal.canar.total}`);

  // b) eroare TRECĂTOARE: rândul se sare, importul merge mai departe. Așa se
  //    poate folosi apoi „Reia eșuările" doar pe ele.
  const trecator = await proceseazaRanduri({
    depozit: depozitFals([]), randuri: feedFals(5), taxonomie: taxonomieFalsa, uscat: true,
    adu: async () => ({ ok: false, eroare: "HTTP 500" }),
    pauza: async () => {},
  });
  cer("o eroare trecătoare nu oprește lotul", !trecator.oprit);
  cer("rândurile picate sunt numărate, nu pierdute", trecator.erori.length === 5 && trecator.procesate === 5);

  // c) termenul limită ajunge până la aducere, ca reîncercările să nu doarmă
  //    peste bugetul lotului.
  let pana = null;
  await proceseazaRanduri({
    depozit: depozitFals([]), randuri: feedFals(1), taxonomie: taxonomieFalsa, uscat: true,
    bugetMs: 15000,
    adu: async (_u, opt) => { pana = opt?.pana; return { ok: false, eroare: "x" }; },
    pauza: async () => {},
  });
  const ramas = pana - Date.now();
  cer("aducerea primește un termen limită", typeof pana === "number" && Number.isFinite(pana), `pana=${pana}`);
  cer("termenul e bugetul plus rezerva", ramas > 15000 && ramas <= 15000 + REZERVA_MS, `mai are ${ramas}ms`);

  // d) fără buget (scriptul din terminal) termenul rămâne infinit
  let panaInfinit = null;
  await proceseazaRanduri({
    depozit: depozitFals([]), randuri: feedFals(1), taxonomie: taxonomieFalsa, uscat: true,
    adu: async (_u, opt) => { panaInfinit = opt?.pana; return { ok: false, eroare: "x" }; },
    pauza: async () => {},
  });
  cer("scriptul din terminal n-are termen limită", panaInfinit === Infinity, `pana=${panaInfinit}`);
}

// ============================================================
// 8. Taxonomia care se completează singură
//
// Decizie a utilizatorului, 25 august 2026: niciun produs nu mai rămâne fără
// categorie. Ce lipsește din arborele nostru se creează cu numele luat din
// catalogul pieseauto.ro. Regulile scrise de om rămân și au prioritate, fiindcă
// traduc mai bine decât automatismul.
// ============================================================
sectiune("8. Categoriile și modelele se completează de la sursă");
{
  const arbore = [
    { id: 1, nume: "Motor și anexe", slug: "motor-si-anexe", parent_id: null, art: "engine", ordine: 1 },
    { id: 2, nume: "EGR și Clapetă acceleratie", slug: "motor-si-anexe-egr", parent_id: 1, art: "engine", ordine: 1 },
  ];

  // a) regula scrisă de om are întâietate și nu cere nicio creare
  const cuRegula = potrivesteCategoria("egr", arbore);
  cer("regula existentă se folosește ca atare", cuRegula.subcategorie_id === 2 && !cuRegula.de_creat);

  // b) fără regulă, dar grupa lor e mapată pe un părinte de-al nostru
  const mapat = potrivesteCategoria("suporti-motor", arbore);
  cer("grupa mapată păstrează părintele nostru", mapat.de_creat?.parinte.id === 1, JSON.stringify(mapat.de_creat));
  cer("subcategoria primește numele de la sursă", mapat.de_creat?.sub.nume === "Suporți motor", mapat.de_creat?.sub?.nume);

  // c) grupă nemapată => devine ea însăși părinte, cu numele ei
  const nemapat = potrivesteCategoria("carcasa-filtru-aer", arbore);
  cer("grupa nemapată devine părinte nou", nemapat.de_creat?.parinte.id === null && nemapat.de_creat?.parinte.nume === "Filtre auto",
      JSON.stringify(nemapat.de_creat?.parinte));

  // d) o categorie-sursă inexistentă în catalogul lor rămâne gol — n-avem nume de nicăieri
  const habar = potrivesteCategoria("slug-inventat-xyz", arbore);
  cer("ce nu e nici la ei rămâne gol, cu notă", !habar.de_creat && !habar.categorie_id && habar.note.length > 0);

  cer("catalogul sursei e citit din fișier", categoriaSursa("etriere")?.nume === "Etriere", JSON.stringify(categoriaSursa("etriere")));
  cer("slug-ul respectă convenția noastră", slugifica("Carcasă filtru aer") === "carcasa-filtru-aer", slugifica("Carcasă filtru aer"));

  // e) modelul din titlu bate compatibilitatea greșită a sursei
  const tax = {
    brands: [{ id: 1, nume: "Volkswagen", slug: "vw" }, { id: 2, nume: "Ford", slug: "ford" }],
    models: [{ id: 10, nume: "Golf 5 (2003–2009)", brand_id: 1 }, { id: 11, nume: "Golf 6 (2008–2013)", brand_id: 1 }],
  };
  cer("modelul se recunoaște din titlu",
      modelDinTitlu("Maneta Tempomat Vw Golf 5 2004 2005", tax)?.model.id === 10);
  cer("două mărci în titlu => nicio potrivire (prea riscant)",
      modelDinTitlu("Debitmetru Vw Sharan Ford Galaxy 2001", tax) === null);
  cer("titlu fără model cunoscut => null", modelDinTitlu("Piesă oarecare 2005", tax) === null);

  // f) motorul chiar creează, iar piesa iese cu categorie
  const dep = depozitFals([]);
  const rez = await proceseazaRanduri({
    depozit: dep, randuri: feedFals(2), taxonomie: { ...taxonomieFalsa, categories: arbore.map((c) => ({ ...c })) },
    adu: async () => ({ ok: true, html: paginaFalsa({ titlu: "Suport motor Vw Passat B6 2008" }),
                        urlFinal: "https://www.pieseauto.ro/suporti-motor/vw/passat-b6/x.html" }),
    pauza: async () => {},
  });
  cer("categoria lipsă a fost creată", dep.scrise.categorii.length === 1, `${dep.scrise.categorii.length} create`);
  cer("cu numele de la sursă", dep.scrise.categorii[0]?.nume === "Suporți motor", dep.scrise.categorii[0]?.nume);
  cer("sub părintele nostru, nu unul nou", dep.scrise.categorii[0]?.parent_id === 1);
  cer("slug-ul e prefixat cu al părintelui", dep.scrise.categorii[0]?.slug === "motor-si-anexe-suporti-motor", dep.scrise.categorii[0]?.slug);
  cer("piesele inserate au subcategoria pusă", dep.scrise.inserate.every((r) => r.subcategorie_id), JSON.stringify(dep.scrise.inserate.map((r) => r.subcategorie_id)));
  cer("a doua piesă NU recreează categoria", rez.categoriiCreate === 1, `${rez.categoriiCreate}`);
}

// ============================================================
// 10. Bugetul de poze pe piesă
//
// Fiecare poză are timeout-ul ei, dar opt poze lente s-ar înmulți și ar duce
// rândul peste limita funcției. Cum un rând neterminat nu avansează poziția,
// importul s-ar bloca pe el la nesfârșit — exact tiparul defectului de 504.
// ============================================================
sectiune("10. Pozele unei piese au un buget, nu doar timeout individual");
{
  const { BUGET_POZE_MS } = await import("../lib/import/motor.mjs");
  cer("bugetul e declarat și rezonabil", BUGET_POZE_MS > 0 && BUGET_POZE_MS <= 30000, `${BUGET_POZE_MS}ms`);
  // Bugetul lasă mereu prima poză să treacă, oricât ar dura: altfel o sursă lentă
  // ar produce numai piese fără nicio poză.
  const sursaAduce = (await import("../lib/import/aducere.mjs"));
  cer("fiecare poză are și timeout propriu", sursaAduce.TIMEOUT_POZA_MS > 0, `${sursaAduce.TIMEOUT_POZA_MS}ms`);
  // Invariantul care ține un lot sub limita de 60s a funcției serverless.
  const { BUGET_MS, LIMITA_LOT_MS } = await import("../lib/import/motor.mjs");
  const celMaiRauLot = BUGET_MS + sursaAduce.TIMEOUT_PAGINA_MS + BUGET_POZE_MS;
  cer("cel mai rău lot rămâne sub limita funcției",
      celMaiRauLot <= LIMITA_LOT_MS,
      `buget ${BUGET_MS} + pagină ${sursaAduce.TIMEOUT_PAGINA_MS} + poze ${BUGET_POZE_MS} = ${celMaiRauLot}ms, plafon ${LIMITA_LOT_MS}ms`);
}

// ============================================================
// 9. Compatibilitatea multiplă
//
// Defect găsit la 25 august 2026, semnalat de utilizator. Pagina scrie „Piesă auto
// compatibilă cu:" și enumeră mai multe mașini, dar doar PRIMA e link — restul sunt
// text simplu în `<span>`. Regexul vechi cerea `<a>` înăuntru și pierdea tăcut
// celelalte linii. Consecința: „Debitmetru Aer Vw Sharan" apărea legat doar de Ford
// Galaxy, iar dezacordul cu titlul era luat drept greșeală a sursei. Nu era —
// Sharan și Galaxy sunt aceeași mașină, piesa se potrivește la amândouă.
// ============================================================
sectiune("9. Piesa se leagă de toate mașinile compatibile");
{
  const html = paginaFalsa({ titlu: "Debitmetru Aer Vw Sharan 1.9 Tdi 2001 2002",
                             model: ["Ford Galaxy", "Volkswagen Sharan"] });
  const ext = extrage(html, "https://www.pieseauto.ro/debitmetru/ford/galaxy/x.html");
  cer("se citesc TOATE compatibilitățile, cu link sau fără",
      JSON.stringify(ext.compat) === JSON.stringify(["Ford Galaxy", "Volkswagen Sharan"]), JSON.stringify(ext.compat));

  const tax = {
    brands: [{ id: 1, nume: "Volkswagen", slug: "vw" }, { id: 2, nume: "Ford", slug: "ford" }],
    models: [{ id: 10, nume: "Sharan (2000–2010)", brand_id: 1 }, { id: 11, nume: "Galaxy (2000–2006)", brand_id: 2 }],
    categories: [],
  };
  const pot = potriveste(ext, tax);
  cer("piesa se leagă de amândouă modelele",
      pot.model_ids.length === 2 && pot.model_ids.includes(10) && pot.model_ids.includes(11), JSON.stringify(pot.model_ids));
  cer("modelul principal e cel confirmat de titlu", pot.model_id === 10, `model_id=${pot.model_id}`);
  cer("marca principală vine tot de la el", pot.marca === "Volkswagen", pot.marca);
  cer("nu se mai semnalează nepotrivire de marcă", !pot.nepotrivire_marca);
  cer("nici nepotrivire de model", !pot.nepotrivire_titlu);

  const rand = construiesteRand({ ...ext, ...pot, feed: { Titlu: ext.titlu, Pret: "350" }, sursa_id: "1" }, [], []);
  cer("rândul salvat le poartă pe amândouă", rand.model_ids.length === 2, JSON.stringify(rand.model_ids));

  // Generația se deduce și când anii din titlu ies puțin din interval — dar numai
  // dacă o singură generație se suprapune.
  const taxG = {
    brands: [{ id: 1, nume: "Volkswagen", slug: "vw" }],
    models: [{ id: 20, nume: "Caddy III (2004–2015)", brand_id: 1 },
             { id: 21, nume: "Golf 5 (2003–2008)", brand_id: 1 },
             { id: 22, nume: "Golf 6 (2008–2013)", brand_id: 1 }],
  };
  const caddy = potriveste({ titlu: "Yala Usa Fata Vw Caddy 2003 2004 2005", compat: ["Volkswagen Caddy"],
                             an_min: 2003, an_max: 2005, erori: [] }, taxG);
  cer("anii care ies puțin din interval nu mai pierd generația", caddy.model_id === 20, JSON.stringify(caddy.note));

  const golf = potriveste({ titlu: "Piesă Vw Golf 2008", compat: ["Volkswagen Golf"],
                            an_min: 2008, an_max: 2008, erori: [] }, taxG);
  cer("două generații suprapuse rămân ambigue, nu se ghicește", golf.model_id === null, JSON.stringify(golf.note));

  // O piesă chiar nepotrivită rămâne semnalată: nicio compatibilitate în titlu.
  const htmlRau = paginaFalsa({ titlu: "Balast Xenon Skoda Octavia 2010", model: ["Ford Galaxy"] });
  const potRau = potriveste(extrage(htmlRau, "https://www.pieseauto.ro/balast-xenon/ford/galaxy/x.html"), tax);
  cer("când NICIUNA nu apare în titlu, tot se semnalează", potRau.nepotrivire_marca, JSON.stringify(potRau.note));
}

// ============================================================
// 11. Taxonomia din URL — și forma scurtă, cu două segmente
//
// Sursa scrie uneori doar /categorie/titlu.html, când anunțul n-are marca și
// modelul completate. 206 din cele 8.754 de piese importate la 26 august 2026 au
// intrat fără categorie exact din cauza asta, deși primul segment E categoria.
// ============================================================
sectiune("11. Categoria se citește și din URL-ul scurt");
{
  const lung = taxonomieDinUrl("https://www.pieseauto.ro/etriere/audi/a4-b8/piesa-1.html");
  cer("forma lungă: categorie + marcă + model", lung.categorie === "etriere" && lung.marca === "audi" && lung.model === "a4-b8");

  const scurt = taxonomieDinUrl("https://www.pieseauto.ro/bandouri/bandou-usa-dreapta-vw-touareg-123.html");
  cer("forma scurtă: categoria se citește, marca rămâne goală",
      scurt.categorie === "bandouri" && scurt.marca === null && scurt.model === null, JSON.stringify(scurt));

  const treiSeg = taxonomieDinUrl("https://www.pieseauto.ro/faruri/bmw/piesa-9.html");
  cer("forma cu trei segmente e neatinsă", treiSeg.categorie === "faruri" && treiSeg.marca === "bmw" && treiSeg.model === null);

  cer("un URL fără cale nu inventează nimic", taxonomieDinUrl("https://www.pieseauto.ro/").categorie === null);
  cer("un URL stricat nu aruncă", taxonomieDinUrl("nu-e-url").categorie === null);
}

// ============================================================
// 12. Anii generației vin din coloane, nu din numele modelului
//
// Regula veche citea intervalul din nume, cu un regex care cerea paranteze. Doar
// 69 din 345 de modele îl aveau scris, deci „Fabia 3" nu putea fi ales niciodată.
// ============================================================
sectiune("12. Generația se alege după an_start / an_final");
{
  const taxA = {
    brands: [{ id: 1, nume: "Škoda", slug: "skoda" }],
    models: [{ id: 30, nume: "Fabia 2", brand_id: 1, an_start: 2007, an_final: 2014 },
             { id: 31, nume: "Fabia 3", brand_id: 1, an_start: 2014, an_final: 2021 }],
  };
  const f3 = potriveste({ titlu: "Far Stanga Skoda Fabia 2016 2017", compat: ["Skoda Fabia"],
                          an_min: 2016, an_max: 2017, erori: [] }, taxA);
  cer("un model FĂRĂ ani în nume poate fi ales, dacă are coloanele", f3.model_id === 31, JSON.stringify(f3.note));

  const f2 = potriveste({ titlu: "Far Stanga Skoda Fabia 2009 2010", compat: ["Skoda Fabia"],
                          an_min: 2009, an_max: 2010, erori: [] }, taxA);
  cer("generația veche se alege tot corect", f2.model_id === 30, JSON.stringify(f2.note));

  // an_final gol = încă în producție, nu „necunoscut".
  const taxB = {
    brands: [{ id: 1, nume: "Volvo", slug: "volvo" }],
    models: [{ id: 40, nume: "XC 40", brand_id: 1, an_start: 2017, an_final: null }],
  };
  const xc = potriveste({ titlu: "Bara Fata Volvo XC 40 2024", compat: ["Volvo XC 40"],
                          an_min: 2024, an_max: 2024, erori: [] }, taxB);
  cer("an_final gol înseamnă „încă în producție”", xc.model_id === 40, JSON.stringify(xc.note));

  // Plasa din nume rămâne, pentru modelele create înainte de migrare.
  const taxC = {
    brands: [{ id: 1, nume: "Volkswagen", slug: "vw" }],
    models: [{ id: 50, nume: "Crafter 2E 2006 -2017", brand_id: 1 },
             { id: 51, nume: "Crafter 7C 2018 - 2026", brand_id: 1 }],
  };
  const cr = potriveste({ titlu: "Far Vw Crafter 2020 2021", compat: ["Volkswagen Crafter"],
                          an_min: 2020, an_max: 2021, erori: [] }, taxC);
  cer("anii scriși în nume fără paranteze rămân o plasă valabilă", cr.model_id === 51, JSON.stringify(cr.note));

  // Două generații cu ACELAȘI nume de bază, deosebite doar prin ani.
  const taxE = {
    brands: [{ id: 1, nume: "Volvo", slug: "volvo" }],
    models: [{ id: 80, nume: "XC60 (2012 - 2016)", brand_id: 1, an_start: 2012, an_final: 2016 },
             { id: 81, nume: "XC60 (2017 - 2024)", brand_id: 1, an_start: 2017, an_final: 2024 }],
  };
  const xc60 = potriveste({ titlu: "Aripa dreapta fata Volvo Xc60 2019 2020", compat: ["Volvo XC60"],
                            an_min: 2019, an_max: 2020, erori: [] }, taxE);
  cer("nume de bază identic: generația se alege tot din ani", xc60.model_id === 81, JSON.stringify(xc60.note));

  const xcVechi = potriveste({ titlu: "Aripa dreapta fata Volvo Xc60 2013 2014", compat: ["Volvo XC60"],
                               an_min: 2013, an_max: 2014, erori: [] }, taxE);
  cer("și generația veche, cu aceleași nume", xcVechi.model_id === 80, JSON.stringify(xcVechi.note));

  const xcFaraAni = potriveste({ titlu: "Aripa dreapta fata Volvo Xc60", compat: ["Volvo XC60"],
                                 an_min: null, an_max: null, erori: [] }, taxE);
  cer("fără ani în titlu rămâne ambiguu, nu se ghicește", xcFaraAni.model_id === null, JSON.stringify(xcFaraAni.note));
  cer("și nu se creează un al treilea „XC60” generic", (xcFaraAni.de_creat_modele ?? []).length === 0);

  // Peugeot: „2008" e nume de model, nu an. Nu are voie să devină interval.
  const taxD = {
    brands: [{ id: 1, nume: "Peugeot", slug: "peugeot" }],
    models: [{ id: 60, nume: "2008", brand_id: 1 }],
  };
  const peu = potriveste({ titlu: "Bara Fata Peugeot 2008 2015", compat: ["Peugeot 2008"],
                           an_min: 2015, an_max: 2015, erori: [] }, taxD);
  cer("„Peugeot 2008” rămâne nume de model, nu an", peu.model_id === 60, JSON.stringify(peu.note));
}

// ============================================================
// 14. Titlul contrazice marca liniei => nu se creează model nou
//
// „Hyundai Matrix" apare ca linie de compatibilitate pe faruri de Audi și de VW,
// fiindcă „Matrix" e tehnologia farului, nu mașina. Cuvântul chiar e în titlu,
// deci confirmarea prin titlu nu ajunge: contează CE MARCĂ numește titlul.
// ============================================================
sectiune("14. Marca din titlu contrazice compatibilitatea");
{
  const taxM = {
    brands: [{ id: 1, nume: "Audi", slug: "audi" }, { id: 2, nume: "Hyundai", slug: "hyundai" }],
    models: [{ id: 90, nume: "Q8", brand_id: 1 }],
  };
  const far = potriveste({ titlu: "Far stanga FULL LED Matrix Audi Q8 2018 2019 2020",
                           compat: ["Audi Q8", "Hyundai Matrix"], an_min: 2018, an_max: 2020, erori: [] }, taxM);
  cer("piesa rămâne legată de modelul confirmat de titlu", far.model_ids.join() === "90", JSON.stringify(far.model_ids));
  cer("„Hyundai Matrix” NU intră între modelele de creat",
      !(far.de_creat_modele ?? []).some((x) => x.nume.toLowerCase().includes("matrix")), JSON.stringify(far.de_creat_modele));
  cer("și motivul e scris în notele de revizuire",
      far.note.some((n) => n.includes("titlul numește") && n.includes("Hyundai")), JSON.stringify(far.note));

  // Contra-proba: compatibilitatea legitimă între mărci NU are voie să cadă.
  // Sharan și Galaxy sunt aceeași mașină, iar Galaxy îl avem deja în tabelă.
  const taxG2 = {
    brands: [{ id: 1, nume: "Volkswagen", slug: "vw" }, { id: 2, nume: "Ford", slug: "ford" }],
    models: [{ id: 91, nume: "Sharan", brand_id: 1 }, { id: 92, nume: "Galaxy", brand_id: 2 }],
  };
  const deb = potriveste({ titlu: "Debitmetru Aer Vw Sharan 2005", compat: ["Volkswagen Sharan", "Ford Galaxy"],
                           an_min: 2005, an_max: 2005, erori: [] }, taxG2);
  cer("un model EXISTENT de altă marcă se leagă în continuare",
      deb.model_ids.slice().sort().join() === "91,92", JSON.stringify(deb.model_ids));

  // Piesele multi-marcă reale: fiecare linie își găsește marca în titlu.
  const taxV = {
    brands: [{ id: 1, nume: "Volkswagen", slug: "vw" }, { id: 2, nume: "Audi", slug: "audi" }],
    models: [{ id: 93, nume: "Golf 5", brand_id: 1, an_start: 2003, an_final: 2008 },
             { id: 94, nume: "A3 8P", brand_id: 2, an_start: 2003, an_final: 2012 }],
  };
  const senz = potriveste({ titlu: "Senzor presiune gaze evacuare VW AUDI 076906051A 2007",
                            compat: ["Volkswagen Golf 5", "Audi A3 8P"], an_min: 2007, an_max: 2007, erori: [] }, taxV);
  cer("piesa cu două mărci în titlu nu semnalează niciun conflict",
      senz.model_ids.slice().sort().join() === "93,94" && !senz.note.some((n) => n.includes("titlul numește")),
      JSON.stringify(senz.note));
}

// ============================================================
// 15. Numele modelelor noi încep cu majusculă
// ============================================================
sectiune("15. Majuscula inițială la modelele noi");
{
  cer("„jumpy” devine „Jumpy”", numeModelNou("jumpy") === "Jumpy");
  cer("„CX-5” rămâne neatins", numeModelNou("CX-5") === "CX-5");
  cer("restul scrierii nu se atinge", numeModelNou("ix35") === "Ix35");
  cer("spațiile din capete se taie", numeModelNou("  s-cross ") === "S-cross");
}

// ============================================================
// 13. Sinonimele de marcă — măsurate, nu inventate
// ============================================================
sectiune("13. Sinonime de marcă");
{
  const taxS = {
    brands: [{ id: 1, nume: "SsangYong", slug: "ssangyong" }],
    models: [{ id: 70, nume: "Korando", brand_id: 1 }],
  };
  const sub = potriveste({ titlu: "Far Stanga SsangYong Korando 2015", compat: ["SsangYong Korando"],
                           an_min: 2015, an_max: 2015, erori: [] }, taxS);
  cer("numele obișnuit al mărcii se potrivește", sub.model_id === 70, JSON.stringify(sub.note));

  const kgm = potriveste({ titlu: "Far Stanga KGM Korando 2015", compat: ["KGM Korando"],
                           an_min: 2015, an_max: 2015, erori: [] }, taxS);
  cer("numele corporativ nou (KGM) e recunoscut ca sinonim", kgm.model_id === 70, JSON.stringify(kgm.note));
}

console.log(`\n=== ${treceri} verificări trec · ${picate} pică ===`);
if (picate) process.exit(1);
