// ============================================================
// EXTRAGEREA datelor dintr-o pagină de produs pieseauto.ro.
//
// Modul COMUN — aceeași funcție `extrage` rulează și în scriptul din terminal,
// și în ruta /api/import. Dacă sursa își schimbă HTML-ul, se repară aici, o
// singură dată, iar ambele căi se repară odată cu ea.
//
// ZERO DEPENDINȚE, intenționat. Datele vin dintr-un array JSON și din atribute
// `itemprop`/`meta` generate automat de platformă, deci nu e nevoie de un arbore
// DOM. Dacă extragerea începe să dea gol, canarul din motor.mjs oprește importul
// înainte să strice 8.000 de rânduri.
// ============================================================

export const dezescapeaza = (s) => s
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));

// `<br[^>]*>` — nu `<br\s*\/?>`. Sursa scrie `<br style="margin:0px;…" />`, cu
// atribute, iar varianta scurtă nu-l prindea: rândurile se lipeau între ele și
// ieșea „…2010 2011Pret afisat pe bucata". Aceeași grijă la `</p>` și `</div>`,
// care sunt tot sfârșituri de rând în textul afișat.
export const faraTaguri = (s) => dezescapeaza(
  s.replace(/<br[^>]*>/gi, "\n")
   .replace(/<\/(p|div|li|tr|h[1-6])\s*>/gi, "\n")
   .replace(/<[^>]+>/g, ""))
  .replace(/[ \t]+/g, " ")
  .split("\n").map((l) => l.trim()).join("\n")
  .replace(/\n{3,}/g, "\n\n").trim();

/** Pozele produsului. STRICT din array-ul `images`; nicio altă sursă.
 *  Pagina conține și pozele anunțurilor similare — un scraper care ia „toate
 *  imaginile" ar importa pozele concurenței. `size` e opțional: apare la unele
 *  poze, lipsește la altele. */
export function extragePoze(html) {
  const m = html.match(/let images = (\[[\s\S]*?\]);/);
  if (!m) return { poze: [], motiv: "array `images` inexistent" };
  let arr;
  try { arr = JSON.parse(m[1]); }
  catch { return { poze: [], motiv: "array `images` nevalid JSON" }; }
  if (!Array.isArray(arr) || arr.length === 0) return { poze: [], motiv: "array `images` gol" };
  const poze = arr.map((im) => im?.original).filter((u) => typeof u === "string" && u.startsWith("http"));
  const dim = arr.map((im) => (Array.isArray(im?.size) ? im.size : null));
  return poze.length ? { poze, dimensiuni: dim } : { poze: [], motiv: "array `images` fără câmp `original`" };
}

/** Taxonomia din URL-ul canonic — mai fiabilă decât breadcrumb-ul.
 *  https://www.pieseauto.ro/etriere/audi/a4-b8/slug-123.html
 *                           categorie marca model
 *
 *  Sursa are și o formă SCURTĂ, cu doar două segmente, când anunțul n-are marca
 *  și modelul completate:
 *  https://www.pieseauto.ro/bandouri/bandou-usa-dreapta-fata-vw-touareg-123.html
 *                           categorie
 *  Până la 28 august 2026 forma asta întorcea `categorie: null`, deși primul
 *  segment E categoria, la fel ca în forma lungă. Rezultatul: 206 piese din
 *  8.754 au intrat în bază fără categorie și fără subcategorie, toate cu nota
 *  „taxonomie neextrasă din URL" în `import_erori`. Corelația era perfectă —
 *  206 URL-uri scurte, 206 piese fără categorie, niciun alt caz — iar toate cele
 *  60 de slug-uri implicate există în catalogul lor (`taxonomie-sursa.mjs`),
 *  deci n-a lipsit nicio informație: doar n-am citit-o. */
export function taxonomieDinUrl(url) {
  try {
    const p = new URL(url).pathname.split("/").filter(Boolean);
    if (p.length >= 4) return { categorie: p[0], marca: p[1], model: p[2] };
    if (p.length === 3) return { categorie: p[0], marca: p[1], model: null };
    if (p.length === 2) return { categorie: p[0], marca: null, model: null };
    return { categorie: null, marca: null, model: null };
  } catch { return { categorie: null, marca: null, model: null }; }
}

export const metaProp = (html, p) =>
  html.match(new RegExp(`<meta property="${p}" content="([^"]*)"`))?.[1] ?? null;
const metaItem = (html, p) =>
  html.match(new RegExp(`<meta itemprop="${p}" content="([^"]*)"`))?.[1] ?? null;
const linkItem = (html, p) =>
  html.match(new RegExp(`<link itemprop="${p}" href="([^"]*)"`))?.[1] ?? null;

/** URL-ul canonic: în mod normal e cel la care ne-a dus redirectul. Dacă
 *  redirectul n-a avut loc, îl luăm din `og:url`, care conține aceeași
 *  taxonomie. Abia dacă nu merge niciuna, rămânem cu URL-ul din feed. */
export function urlCanonic(html, urlFinal) {
  const og = metaProp(html, "og:url");
  return (urlFinal.includes("/produs-") ? og : urlFinal) || og || urlFinal;
}

/** Anii dintr-un titlu: numere de 4 cifre între 1990 și 2026, crescător.
 *  Exportată fiindcă o folosește și `scripts/completeaza-taxonomia.mjs`, care
 *  reface potrivirea pentru piesele deja în bază, plecând tot de la titlu.
 *  Fără ei, generația unui model nu se poate dezambiguiza. */
export const aniDinTitlu = (titlu) =>
  [...new Set((titlu ?? "").match(/\b(19[9]\d|20[0-2]\d)\b/g)?.map(Number) ?? [])]
    .filter((a) => a >= 1990 && a <= 2026).sort((a, b) => a - b);

/**
 * Conținutul elementului care poartă un anumit atribut, cu etichetele imbricate
 * cu tot.
 *
 * DE CE EXISTĂ (defect găsit la 7 septembrie 2026, în producție de la primul import)
 * Descrierea se lua cu `itemprop="description"[^>]*>([\s\S]*?)<\/div>` — adică
 * până la PRIMUL `</div>`. Sursa își scrie însă descrierile cu `<div>`-uri
 * imbricate, câte unul pe paragraf:
 *
 *   <div class="pr-desc" itemprop="description">
 *     <b>Stop stanga dreapta LED Skoda Scala 2018 2019 2020</b>
 *     <div><b><br /></b></div>
 *     <div><span…>COD: 657945207 / 657945208</span></div>
 *     <div>Pretul afisat este pe bucata !</div>
 *   </div>
 *
 * Primul `</div>` e cel al rândului gol, deci se păstra doar titlul îngroșat.
 * Măsurat pe 40 de pagini luate din tot catalogul: **17 descrieri din 40 erau
 * tăiate** — 386 de caractere reduse la 84, 342 la 63, 316 la 61. Codul piesei,
 * care stă mai jos în text, se pierdea aproape întotdeauna: în bază aveau
 * „COD:" doar 455 de piese din 8.965, deși pe pagini apare la vreo treime.
 *
 * Funcția numără deschiderile și închiderile aceleiași etichete, deci ia blocul
 * întreg indiferent câte niveluri are. Dacă închiderea lipsește (HTML stricat),
 * întoarce tot ce urmează — mai mult text e o problemă mai mică decât text tăiat.
 */
export function blocEtichetat(html, atribut) {
  const i = html.indexOf(atribut);
  if (i < 0) return null;
  const start = html.lastIndexOf("<", i);
  if (start < 0) return null;
  const nume = html.slice(start + 1).match(/^([a-zA-Z][a-zA-Z0-9]*)/)?.[1];
  if (!nume) return null;
  const dupaTag = html.indexOf(">", i);
  if (dupaTag < 0) return null;

  const desch = new RegExp(`<${nume}\\b`, "gi");
  const inch = new RegExp(`</${nume}\\s*>`, "gi");
  let adancime = 1;
  let poz = dupaTag + 1;
  for (;;) {
    desch.lastIndex = poz;
    inch.lastIndex = poz;
    const a = desch.exec(html);
    const b = inch.exec(html);
    if (!b) return html.slice(dupaTag + 1);          // HTML nestructurat
    if (a && a.index < b.index) { adancime++; poz = a.index + 1; continue; }
    adancime--;
    poz = b.index + b[0].length;
    if (adancime === 0) return html.slice(dupaTag + 1, b.index);
  }
}

/**
 * Codul piesei (OEM) din descriere.
 *
 * Vânzătorul îl scrie în text, pe un rând al lui. Formele de mai jos sunt
 * MĂSURATE, nu presupuse: 43 de rânduri „COD:" culese de pe 60 de pagini reale,
 * 7 septembrie 2026.
 *
 *   COD: 5E6809605              un singur cod, forma cea mai deasă
 *   COD:3t0941699c              fără spațiu după două puncte
 *   Cod injector : 038130073AG  un cuvânt între „cod" și „:"
 *   COD: 4M0853817 / 4M0854819  DOUĂ coduri, despărțite de bară
 *   COD: av6n 18456 ca          UN cod scris cu spații (Ford, Toyota, Mazda)
 *   COD: 27060 27040            la fel, numai cifre
 *   COD: 8200842205Pretul afisat este pe bucata !   codul lipit de fraza următoare
 *   COD: 8P4880741j respectiv 8P4880742j    două coduri legate printr-un cuvânt
 *
 * Ultima formă e cea care cere grijă: sursa nu pune întotdeauna un `<br>` după
 * cod, deci textul curge mai departe fără spațiu. Se taie la primul cuvânt care
 * arată a cuvânt — o majusculă urmată de litere mici („Pretul", „Fusta",
 * „Alternatorul") sau patru majuscule la rând („NECESITA"). Numerele de piesă nu
 * arată niciodată așa: se termină în cel mult trei litere („5H0805915P",
 * „1k0407272JT", „3q0035842C").
 *
 * SPAȚIUL ȚINE ÎMPREUNĂ, BARA DESPARTE. „av6n 18456 ca" e UN cod, „4M0853817 /
 * 4M0854819" sunt DOUĂ. Regula asta iese direct din cele 43 de rânduri: n-a
 * apărut niciun caz în care un spațiu să despartă două coduri diferite.
 *
 * Ce NU trece: „COD: se vede in poza" (niciun grup n-are cifre), „Codul postal:
 * 617508" („cod" nu e cuvânt întreg acolo), un cod de motor curat, fără cifre.
 * Mai bine un câmp gol decât unul cu text în el: `oem` ajunge în feed-urile de
 * reclame și în anunțurile de pe dez.ro.
 */
export function codOem(descriere) {
  if (!descriere) return null;

  /** Un grup dintre spații: „5H0805915P", „18456", „ca". Trebuie ori să aibă o
   *  cifră, ori să fie scurt (sufixele Ford: „ca", „cg", „A"). */
  const grupBun = (g) => /\d/.test(g) || /^[A-Za-z]{1,3}$/.test(g);

  /** Un cod întreg, cu spațiile lui. */
  const codBun = (c) => {
    if (!/^[A-Za-z0-9][A-Za-z0-9 .\-]{3,29}$/.test(c)) return false;
    const grupuri = c.split(" ");
    if (grupuri.length > 4) return false;
    if ((c.match(/\d/g) ?? []).length < 3) return false;
    return grupuri.every(grupBun);
  };

  const gasite = [];
  // „cod" ca CUVÂNT întreg, apoi cel mult două cuvinte („cod injector"), apoi „:".
  for (const m of descriere.matchAll(/\bcod\b[^\n:]{0,20}:\s*([^\n]{0,120})/gi)) {
    // Taie fraza lipită de cod.
    const taiat = m[1].split(/[A-ZÎÂĂȘȚ][a-zîâășț]{2,}|[A-Z]{4,}/)[0];
    // „respectiv", „si", „sau" leagă două coduri în vorbirea vânzătorului:
    // „COD: 8P4880741j respectiv 8P4880742j" (stânga și dreapta). Fără ele în
    // lista de despărțitori, primul cuvânt oprea citirea și se pierdeau amândouă.
    for (const bucata of taiat.split(/\s*[/;,]\s*|\s+(?:respectiv|si|sau|ori)\s+/i)) {
      const c = bucata.replace(/[.,;)\-]+$/, "").replace(/\s+/g, " ").trim();
      if (!c) continue;
      if (!codBun(c)) break;      // ce nu arată a cod încheie rândul
      if (!gasite.includes(c)) gasite.push(c);
    }
  }
  // Plafon: un anunț cu zeci de coduri ar umple câmpul și ar deveni ilizibil.
  return gasite.length ? gasite.slice(0, 8).join(" / ") : null;
}

export function extrage(html, urlFinal) {
  const erori = [];
  const titlu = faraTaguri(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "") || null;
  if (!titlu) erori.push("titlu lipsă");

  const dBloc = blocEtichetat(html, 'itemprop="description"');
  const descriere = dBloc ? faraTaguri(dBloc) : null;
  if (!descriere) erori.push("descriere lipsă");

  const { poze, dimensiuni, motiv } = extragePoze(html);
  if (!poze.length) erori.push(`poze lipsă: ${motiv}`);

  const tax = taxonomieDinUrl(urlFinal);
  if (!tax.categorie) erori.push("taxonomie neextrasă din URL");

  // Compatibilitatea din tabul „Specificații" (e în HTML, data-do-ajax="0"),
  // sub titlul „Piesă auto compatibilă cu:". Sunt de obicei MAI MULTE mașini —
  // piesa chiar se potrivește la toate.
  //
  // ASTA e sursa pentru marcă și model, NU segmentul din URL. La Etapa 1, 2 din 5
  // produse aveau în URL `passat-b6` deși titlul, descrierea și câmpul ăsta spuneau
  // „Touran", respectiv „Golf 5". Trei surse contra una: URL-ul minte la model.
  // Din URL rămâne doar categoria, care s-a dovedit corectă peste tot.
  //
  // ATENȚIE la formă (defect găsit 25 august 2026): doar PRIMA mașină e link.
  // Restul sunt text simplu în `<span>`, fiindcă ei n-au pagină de catalog pentru
  // combinația aia. Varianta veche a regexului cerea `<a>` înăuntru și pierdea
  // tăcut a doua compatibilitate — de aceea „Debitmetru Aer Vw Sharan" apărea
  // legat doar de Ford Galaxy, deși pagina spune limpede și „Volkswagen Sharan".
  // Sharan și Galaxy sunt aceeași mașină; piesa se potrivește la amândouă.
  const compat = [...html.matchAll(/<span class="q-car-model">([\s\S]*?)<\/span>/g)]
    .map((m) => dezescapeaza(m[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((x, i, v) => v.indexOf(x) === i);

  const disp = linkItem(html, "availability");
  const stare = linkItem(html, "itemCondition");

  const ani = aniDinTitlu(titlu);

  return {
    titlu,
    descriere,
    poze, poze_dimensiuni: dimensiuni ?? [],
    categorie_sursa: tax.categorie, marca_sursa: tax.marca, model_sursa: tax.model,
    compat,
    pret_pagina: metaItem(html, "price"),
    moneda_pagina: metaItem(html, "priceCurrency"),
    disponibilitate: disp ? disp.split("/").pop() : null,
    stare_sursa: stare ? stare.split("/").pop() : null,
    an_min: ani[0] ?? null, an_max: ani[ani.length - 1] ?? null, ani_gasiti: ani,
    // Codul piesei stă în descriere, pe un rând „COD: …". Până la 7 septembrie
    // 2026 aici era `oem: null`, cu nota „confirmat absent pe pagină" — o
    // concluzie trasă când descrierea se citea tăiată la primul `</div>` și
    // rândul cu codul cădea aproape întotdeauna în partea pierdută.
    // Greutatea și dimensiunile chiar lipsesc: n-au tabel de specificații.
    oem: codOem(descriere), greutate_kg: null, dimensiuni: null,
    og_image: metaProp(html, "og:image"),
    erori,
  };
}
