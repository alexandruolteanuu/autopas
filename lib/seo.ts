// ============================================================
// TITLURI ȘI DESCRIERI PENTRU MOTOARELE DE CĂUTARE
//
// Generate din datele existente, niciodată scrise de mână: sunt 8.739 de pagini
// de piesă, iar până acum toate aveau ACELAȘI titlu și aceeași descriere — cele
// implicite din layout. Pentru Google, 8.739 de pagini identice ca metadate.
//
// DE CE NU ȘABLONUL EVIDENT
// Șablonul „{denumire} — {marcă} {model} {ani}" nu se poate aplica literal,
// fiindcă denumirile din catalog CONȚIN deja marca, modelul și anii. Ar ieși
// „Motoraș etrier spate Audi A4 B8 2.0 TDI — Audi A4 B8 2008–2015".
//
// Regula e alta: **se reconstruiește doar când numele nu încape**. Numele are
// detalii pe care o reconstrucție le-ar pierde („Facelift", codul motorului),
// deci cât timp intră în limită, el rămâne.
//
// Verificat pe tot catalogul înainte de a intra în cod: 8.739 de descrieri
// distincte din 8.739 de piese, zero titluri peste 65 de caractere, zero
// descrieri peste 160.
// ============================================================
import type { Product, Brand, Model } from "./types";

/**
 * Sufixul de marcă al fiecărui titlu. **Un singur loc din tot proiectul îl
 * adaugă** — șablonul din `app/layout.tsx`, care îl importă de aici.
 *
 * DE CE (defectul găsit de două ori, la piese și la mașini)
 * Înainte, marca se adăuga în DOUĂ locuri: șablonul din layout ȘI generatorul
 * de aici. Rezultatul era „… | AUTOPAS · Autopas Dezmembrări" — marca de două
 * ori, 74 și respectiv 85 de caractere. De fiecare dată s-a văzut abia în HTML,
 * nu în generator.
 *
 * Deci funcțiile de mai jos NU adaugă sufixul. Îl pune șablonul, o singură dată,
 * pentru toate paginile. `scripts/verifica-seo.mjs` verifică asta.
 *
 * Forma scurtă (10 caractere, nu 22): o foloseau deja 8.739 din cele ~8.780 de
 * pagini. Contextul mărcii vine oricum din domeniul afișat deasupra titlului în
 * rezultatele Google, nu din sufix.
 */
export const SUFIX_TITLU = " | AUTOPAS";
/** Șablonul pentru `metadata.title.template` din layout. */
export const SABLON_TITLU = `%s${SUFIX_TITLU}`;
/** Bugetul titlului PROPRIU, fără sufix. Cu cele 10 caractere ale sufixului dau
 *  65 în total. Google taie vizual pe la 600px, adică în jur de 60 de caractere;
 *  ce trece de acolo tot contează pentru potrivire, dar nu se vede. */
const MAX_TITLU = 55;
const MAX_DESCRIERE = 160;
/** Peste atâtea potriviri, alegerea unui singur model devine arbitrară. */
const PREA_MULTE_MODELE = 3;

const faraDiacritice = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Numele fără șirul de ani enumerați de la final: „… 2008 2009 2010 2011" -> „…".
 *  Aceeași informație stă compact în coloana `ani`, de patru ori mai scurtă. */
export const faraAniEnumerati = (nume: string) =>
  nume.replace(/(?:\s+(?:19|20)\d{2}){2,}\s*$/, "").trim();

/** Semnele de punctuație rămase la capătul unui text tăiat. */
const COADA_SEMNE = /[\s,\/·—–-]+$/;

const faraParanteze = (n: string) => n.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();

/** Taie la ultimul cuvânt întreg care încape, fără „…": Google taie oricum vizual,
 *  iar punctele de suspensie arată a text retezat de noi. */
function taie(t: string, max: number) {
  if (t.length <= max) return t;
  const p = t.slice(0, max);
  const i = p.lastIndexOf(" ");
  let r = (i > max * 0.55 ? p.slice(0, i) : p).replace(COADA_SEMNE, "");
  // Un cuvânt de una-două litere rămas la coadă („… testat pe") arată a frază
  // retezată. Se scoate, cu tot cu semnele de după el.
  //
  // Clasa de litere e scrisă explicit, nu ca `\p{L}`: `tsconfig` țintește ES5,
  // unde indicatorul `u` al expresiilor regulate nu e disponibil.
  r = r.replace(/\s+[a-zA-ZăâîșțĂÂÎȘȚ]{1,2}$/, "").replace(COADA_SEMNE, "");
  return r;
}

/**
 * Partea din nume care spune CE E piesa: tot ce stă înaintea primei mărci.
 * „Supapa electromagnetica Skoda Karoq / …" -> „Supapa electromagnetica".
 *
 * Potrivirea se face FĂRĂ diacritice: marca e „Škoda" în tabelă, dar „Skoda" în
 * numele piesei. Cu potrivire brută, Škoda nu se găsea niciodată, iar titlurile
 * ieșeau tăiate în locul greșit.
 */
function cePiesaE(nume: string, marci: Brand[]) {
  const n = faraAniEnumerati(nume);
  const nn = faraDiacritice(n);
  let prima = -1;
  for (const b of marci) {
    const i = nn.indexOf(faraDiacritice(b.nume));
    if (i > 0 && (prima === -1 || i < prima)) prima = i;
  }
  return prima > 0 ? n.slice(0, prima).replace(COADA_SEMNE, "") : n;
}

export function titluPiesa(p: Product, marca?: Brand | null, model?: Model | null) {
  const preaMulte = (p.model_ids ?? []).length > PREA_MULTE_MODELE;

  let t = faraAniEnumerati(p.nume);
  if (p.ani && !t.includes(p.ani)) t = `${t} ${p.ani}`;

  // Reconstruim DOAR dacă nu încape. O piesă potrivită pe multe mașini nu se
  // rezumă la una singură: pentru „Balast xenon AUDI Q7 A3 A4 A5 A6 A8",
  // alegerea unui model ar fi arbitrară, iar enumerarea din nume prinde mai
  // multe căutări reale.
  if (t.length > MAX_TITLU && marca && model && !preaMulte) {
    t = [cePiesaE(p.nume, [marca]), marca.nume, faraParanteze(model.nume), p.ani]
      .filter(Boolean).join(" ");
  }
  return taie(t.replace(/\s+/g, " "), MAX_TITLU);
}

export function descrierePiesa(p: Product) {
  const pret = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 }).format(Number(p.pret_lei));

  // Capul e chiar numele piesei, nu o reformulare: acolo stau detaliile după
  // care caută oamenii (codul motorului, „Facelift", codul din titlu).
  let cap = faraAniEnumerati(p.nume);
  if (p.ani && !cap.includes(p.ani)) cap = `${cap}, ${p.ani}`;

  // `cod_intern` face fiecare descriere unică prin construcție. Catalogul are
  // piese fizic diferite cu același nume ȘI același preț — șapte „Bara fata
  // Skoda Octavia 4" — care altfel ar împărți aceeași descriere. Codul apare și
  // pe pagină, deci nu e text scris pentru Google: metadatele care nu se
  // regăsesc în pagină sunt exact ce penalizează.
  //
  // `oem` e null pe tot catalogul importat din pieseauto.ro; ramura rămâne
  // pentru piesele adăugate de mână, care pot avea cod OEM.
  const coada = [
    p.cod_intern ? `Cod intern ${p.cod_intern}.` : null,
    p.oem ? `Cod OEM ${p.oem}.` : null,
    `Piesă din dezmembrări, testată — ${pret} lei.`,
    "Garanție 90 de zile, livrare în toată țara.",
  ].filter(Boolean).join(" ");

  // Capul se strânge cât să încapă TOATĂ coada: garanția și livrarea sunt
  // argumentele de click, n-au voie să fie tăiate de un nume lung.
  const cap2 = taie(cap, Math.max(20, MAX_DESCRIERE - coada.length - 1))
    .replace(/[^.]$/, (c) => c + ".");
  return taie(`${cap2} ${coada}`.replace(/\s+/g, " ").trim(), MAX_DESCRIERE);
}

// ============================================================
// PAGINI ÎN AFARA CATALOGULUI
// ============================================================

/** Taie un text la o lungime, la ultimul cuvânt întreg. Exportat ca să poată
 *  descrierile paginilor legale să se genereze din chiar textul documentului. */
export const taieText = (t: string, max: number) => taie(t, max);

/**
 * Titlul unei mașini dezmembrate: „Dezmembrări VW Passat B6 2.0 TDI 2008".
 *
 * Fără sufixul „— piese disponibile" pe care îl avea înainte: cu șablonul din
 * layout adăugat peste, titlul ajungea la 85 de caractere și repeta marca —
 * „Dezmembrări Vw Passat B6 2.0 TDI BMP · 2008 — piese disponibile · Autopas
 * Dezmembrări". Se folosește cu `title: { absolute }`.
 */
export function titluMasinaSeo(numeAfisat: string) {
  return taie(`Dezmembrări ${numeAfisat}`.replace(/\s+/g, " "), MAX_TITLU);
}

/**
 * Descrierea unei mașini dezmembrate. Numărul de piese e informație reală, se
 * schimbă odată cu catalogul, și e chiar ce caută omul: „au sau n-au piese de
 * pe mașina mea".
 */
export function descriereMasina(numeAfisat: string, nrPiese: number) {
  const cap = nrPiese > 0
    ? `${nrPiese} ${nrPiese === 1 ? "piesă demontată" : "piese demontate"} de pe ${numeAfisat}, testate, cu garanție 90 de zile.`
    : `Dezmembrăm ${numeAfisat}. Spune-ne ce piesă cauți și verificăm pe loc dacă o avem.`;
  return taie(`${cap} Livrare în toată țara.`.replace(/\s+/g, " "), MAX_DESCRIERE);
}

/** Descrierea listei de mașini, cu cifrele reale ale depozitului. */
export function descriereListaMasini(cuPiese: number, total: number) {
  const cap = cuPiese > 0
    ? `${cuPiese} ${cuPiese === 1 ? "mașină" : "mașini"} cu piese pe site, din ${total} aflate la dezmembrat.`
    : `${total} ${total === 1 ? "mașină aflată" : "mașini aflate"} la dezmembrat în depozitul nostru.`;
  return taie(`${cap} Vezi ce piese avem de pe fiecare, cu garanție 90 de zile.`, MAX_DESCRIERE);
}
