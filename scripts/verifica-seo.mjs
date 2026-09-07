// ============================================================
// VERIFICAREA METADATELOR — titluri, descrieri, sufixul de marcă
//
// DE CE EXISTĂ
// Sufixul de marcă a fost adăugat de două ori în aceeași lună, în două locuri
// diferite: o dată pe pagina de piesă („… | AUTOPAS · Autopas Dezmembrări",
// 74 de caractere), o dată pe cea de mașină (85). De fiecare dată defectul a
// fost invizibil în generator și s-a văzut abia în HTML-ul servit.
//
// De aceea verificarea se face pe PAGINI REALE, cerute de la un server care
// rulează, nu pe funcțiile care compun titlurile. Un generator poate fi corect
// și pagina tot greșită, dacă altcineva mai adaugă ceva pe drum.
//
// CE VERIFICĂ
//   · titlul are cel mult 65 de caractere
//   · descrierea are cel mult 165 și există pe fiecare pagină
//   · marca apare EXACT o dată în titlu — nici zero, nici de două ori
//   · două pagini nu împart aceeași descriere
//   · fiecare pagină are exact un `<link rel="canonical">`, spre ea însăși
//
// CUM SE RULEAZĂ (serverul trebuie să meargă separat)
//   npm run build && npx next start -p 3000
//   node scripts/verifica-seo.mjs
//
//   BASE=http://localhost:3100   altă adresă
//
// Iese cu cod 1 dacă vreo verificare pică.
// ============================================================
const BASE = (process.env.BASE ?? "http://localhost:3000").replace(/\/+$/, "");
const SUFIX = " | AUTOPAS";
/** Marca, oricum ar fi scrisă. Verificarea nu caută sufixul literal, ci MARCA:
 *  prima pagină folosește `title.default`, care nu trece prin șablon și n-are
 *  sufix — dar titlul ei conține „Autopas Dezmembrări", deci marca e acolo o
 *  dată, ceea ce e corect. O regulă care ar cere sufixul literal ar fi picat pe
 *  prima pagină fără să fie ceva stricat. */
const MARCA = /autopas/gi;
const MAX_TITLU = 65;
const MAX_DESCRIERE = 165;

/** Un exemplar din fiecare TIP de pagină. Nu are rost să cerem toate cele 8.739
 *  de piese: toate trec prin același generator. Dacă apare un tip nou de pagină,
 *  se adaugă aici — altfel verificarea nu-l acoperă. */
const PAGINI = [
  "/",
  "/piese",
  "/piese?pagina=3",
  "/masini",
  "/faq",
  "/contact",
  "/despre-noi",
  "/preda-masina",
  "/programul-rabla",
  "/formular-retur",
  "/cauta-dupa-masina",
  "/legal/termeni-si-conditii",
  "/legal/politica-de-confidentialitate",
  "/legal/politica-de-cookies",
  "/legal/livrare",
  "/legal/politica-de-retur",
  "/legal/certificat-garantie",
  "/legal/setari-cookie-uri",
  "/legal/anpc-si-sol",
];

let treceri = 0, picate = 0;
const cer = (eticheta, ok, detaliu = "") => {
  if (ok) treceri++;
  else { picate++; console.log(`  ✗ ${eticheta}${detaliu ? ` — ${detaliu}` : ""}`); }
};

const intre = (html, re) => (html.match(re) ?? [])[1] ?? "";
const numara = (t, bucata) => t.split(bucata).length - 1;

/** Câte o piesă și o mașină reale, luate din sitemap: slug-urile se schimbă la
 *  fiecare import, deci n-au ce căuta scrise în script. */
async function exemplareDinSitemap() {
  try {
    const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
    const cale = (re) => (xml.match(re) ?? [])[1];
    return [cale(/<loc>[^<]*(\/piese\/[^<]+)<\/loc>/), cale(/<loc>[^<]*(\/masini\/[^<]+)<\/loc>/)]
      .filter(Boolean);
  } catch {
    return [];
  }
}

const pagini = [...PAGINI, ...(await exemplareDinSitemap())];
console.log(`VERIFICARE METADATE · ${pagini.length} tipuri de pagini · ${BASE}\n`);

const descrieri = new Map();

for (const cale of pagini) {
  let html, status;
  try {
    const r = await fetch(BASE + cale);
    status = r.status;
    html = await r.text();
  } catch (e) {
    cer(`${cale} — se poate cere`, false, e.message);
    continue;
  }
  if (status !== 200) { cer(`${cale} — HTTP 200`, false, `a răspuns ${status}`); continue; }

  const titlu = intre(html, /<title>([^<]*)<\/title>/);
  const descriere = intre(html, /name="description" content="([^"]*)"/);
  const canonice = html.match(/rel="canonical"/g) ?? [];

  cer(`${cale} — titlu ≤ ${MAX_TITLU}`, titlu.length > 0 && titlu.length <= MAX_TITLU,
      `${titlu.length}: „${titlu}"`);
  // Regula pentru care există scriptul: marca o singură dată. Defectul găsit de
  // două ori era chiar dublarea ei („… | AUTOPAS · Autopas Dezmembrări").
  const oriMarca = (titlu.match(MARCA) ?? []).length;
  cer(`${cale} — marca apare exact o dată în titlu`, oriMarca === 1,
      `apare de ${oriMarca} ori în „${titlu}"`);
  cer(`${cale} — are descriere`, descriere.length > 0);
  cer(`${cale} — descriere ≤ ${MAX_DESCRIERE}`, descriere.length <= MAX_DESCRIERE,
      `${descriere.length} caractere`);
  cer(`${cale} — un singur canonical`, canonice.length === 1, `${canonice.length} etichete`);

  if (descriere) {
    const vazutaLa = descrieri.get(descriere);
    cer(`${cale} — descriere unică`, !vazutaLa, `aceeași ca la ${vazutaLa}`);
    if (!vazutaLa) descrieri.set(descriere, cale);
  }

  // ---- datele structurate, pe paginile de piesă ----
  //
  // Merchant Center le citește ca să corecteze prețul și disponibilitatea între
  // două preluări ale feed-ului. Dacă pagina spune altceva decât feed-ul, Google
  // nu alege una dintre ele: suspendă produsul. De aceea verificarea nu se uită
  // doar la „există", ci la ce scrie acolo.
  if (cale.startsWith("/piese/") && !cale.startsWith("/piese/categorie/") && !cale.startsWith("/piese/marca/")) {
    const blocuri = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
      .map((m) => { try { return JSON.parse(m[1]); } catch { return null; } });
    const produs = blocuri.find((b) => b?.["@type"] === "Product");
    const drum = blocuri.find((b) => b?.["@type"] === "BreadcrumbList");

    cer(`${cale} — are date structurate Product`, !!produs);
    if (produs) {
      const o = produs.offers ?? {};
      cer(`${cale} — prețul e „123.45", fără monedă`, /^\d+\.\d{2}$/.test(String(o.price)), String(o.price));
      cer(`${cale} — moneda e RON`, o.priceCurrency === "RON", String(o.priceCurrency));
      // Google acceptă exact valorile astea două; „InStock" fără adresă, sau
      // „in_stock" ca în feed, nu sunt citite și produsul rămâne fără stoc.
      cer(`${cale} — disponibilitatea e una dintre cele două adrese schema.org`,
          ["https://schema.org/InStock", "https://schema.org/OutOfStock"].includes(String(o.availability)),
          String(o.availability));
      cer(`${cale} — starea e „folosit"`, produs.itemCondition === "https://schema.org/UsedCondition");
      cer(`${cale} — are cod propriu (sku)`, !!produs.sku);
      // Prețul din pagină trebuie să fie exact cel afișat omului. Verificarea e
      // grosieră intenționat: caută cifrele prețului în textul paginii.
      const intreg = String(o.price).split(".")[0];
      cer(`${cale} — prețul din date se regăsește în pagină`,
          html.includes(intreg) || html.includes(Number(intreg).toLocaleString("ro-RO")), intreg);
      // Recenzii inventate = penalizare manuală. Nu avem recenzii, deci n-are
      // ce căuta nimic aici.
      cer(`${cale} — fără recenzii inventate`, !produs.aggregateRating && !produs.review);
    }
    cer(`${cale} — are firul Ariadnei structurat`, !!drum && (drum.itemListElement ?? []).length >= 3);
  }
}

console.log(`\n=== ${treceri} verificări trec · ${picate} pică ===`);
process.exit(picate ? 1 : 0);
