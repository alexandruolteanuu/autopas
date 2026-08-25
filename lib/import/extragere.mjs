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
 *                           categorie marca model */
export function taxonomieDinUrl(url) {
  try {
    const p = new URL(url).pathname.split("/").filter(Boolean);
    if (p.length >= 4) return { categorie: p[0], marca: p[1], model: p[2] };
    if (p.length === 3) return { categorie: p[0], marca: p[1], model: null };
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

export function extrage(html, urlFinal) {
  const erori = [];
  const titlu = faraTaguri(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "") || null;
  if (!titlu) erori.push("titlu lipsă");

  const dBloc = html.match(/itemprop="description"[^>]*>([\s\S]*?)<\/div>/);
  const descriere = dBloc ? faraTaguri(dBloc[1]) : null;
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
    // Confirmate absente pe pagină (vezi raportul C.0). Rămân muncă de operator.
    oem: null, greutate_kg: null, dimensiuni: null,
    og_image: metaProp(html, "og:image"),
    erori,
  };
}
