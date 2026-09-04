// ============================================================
// MOTORUL FEED-URILOR DE PRODUSE — o singură sursă pentru toate exporturile
//
// LA CE FOLOSEȘTE
// Google Merchant Center (pentru Google Ads / Shopping) și catalogul Meta
// (pentru Facebook & Instagram Ads) nu se alimentează cu fișiere încărcate de
// mână: fiecare cere o ADRESĂ pe care o citește singur, la câteva ore. Aici se
// construiește conținutul acelor adrese, plus exporturile CSV din panou.
//
// REGULA CENTRALĂ: catalogul se citește O SINGURĂ DATĂ, într-o formă normalizată
// (`RandFeed`), iar formatele — RSS pentru Google, CSV pentru Meta, CSV/XML
// generic pentru orice altă platformă — sunt doar moduri de a SCRIE aceleași
// rânduri. Fără asta, fiecare feed nou ar fi însemnat încă o interpretare a
// datelor, iar cele două canale de reclamă ar fi ajuns să spună lucruri diferite
// despre aceeași piesă. Dacă id-ul din feed nu e identic cu id-ul trimis de
// pixel la „adaugă în coș", remarketingul dinamic nu are ce lega între ele.
//
// CITIREA E PAGINATĂ, obligatoriu (`citesteTot`). PostgREST taie tăcut la 1.000
// de rânduri, iar un feed cu 1.000 din 8.804 de piese nu arată a defect: arată a
// magazin mic. Vezi CLAUDE.md, secțiunea despre plafonul de 1.000.
//
// CE NU INTRĂ AICI: costul de achiziție (`cost_lei`), datele de import și orice
// altceva intern. Feed-urile sunt adrese publice — le poate deschide oricine,
// inclusiv un concurent. Exportul complet, cu marja, se descarcă din panou, unde
// trece prin sesiunea și prin RLS-ul omului care apasă butonul.
// ============================================================
import { sbServer, citesteTot } from "./supabase";
import { SITE_URL } from "./config";
import type { Brand, Model, Category } from "./types";

/** Câte secunde ține răspunsul în cache-ul CDN-ului înainte de a fi regenerat.
 *  Trei ore: Merchant Center și Meta reîmprospătează oricum o dată pe zi sau la
 *  câteva ore, iar o piesă vândută dispare din feed la următoarea regenerare.
 *  Mai des n-ar ajuta pe nimeni și ar pune 9 interogări paginate pe fiecare
 *  vizită a oricărui robot care găsește adresa. */
export const CACHE_FEED_SECUNDE = 3 * 60 * 60;

/** Cât mai așteaptă CDN-ul să servească varianta veche în timp ce o regenerează
 *  în fundal. Fără asta, exact cererea care nimerește expirarea ar aștepta cele
 *  câteva secunde de generare — iar aceea poate fi chiar robotul Google. */
export const INVECHIRE_ACCEPTATA_SECUNDE = 10 * 60;

/** Moneda catalogului. Prețurile din bază sunt în lei, cu TVA inclus. */
export const MONEDA_FEED = "RON";

/**
 * Categoria din taxonomia Google, ca TEXT, nu ca număr.
 *
 * Google acceptă ambele forme, dar numărul ar trebui verificat în fișierul lor
 * oficial, iar unul greșit trece de validare și duce produsele în categoria
 * altcuiva. Calea în text e verificabilă cu ochiul și nu se schimbă când Google
 * renumerotează taxonomia.
 *
 * O singură valoare pentru tot catalogul: toate cele 8.800 de piese sunt piese
 * de autovehicul. Nuanța fină (frână, far, motor) o dă `product_type`, care e
 * chiar arborele nostru de categorii.
 */
export const CATEGORIE_GOOGLE = "Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts";

/** Limitele impuse de Google Merchant Center. Meta le are mai largi, deci ce
 *  trece de Google trece peste tot. Se taie aici, o dată, nu în fiecare format. */
export const MAX_TITLU_FEED = 150;
export const MAX_DESCRIERE_FEED = 5000;
/** Google acceptă maximum 10 imagini suplimentare pe produs. */
export const MAX_POZE_SUPLIMENTARE = 10;

// ============================================================
// RÂNDUL NORMALIZAT
// Tot ce poate fi nevoie în orice format, calculat o dată.
// ============================================================
export type RandFeed = {
  // identificare
  id: string;                    // = cod_intern (AP-000123); id-ul din bază dacă lipsește
  id_baza: number;
  slug: string;
  url: string;                   // adresă absolută
  // conținut
  titlu: string;
  descriere: string;
  nume_brut: string;
  stare_nota: string;
  // clasificare
  categorie: string;
  subcategorie: string;
  cale_categorie: string;        // „Motor și anexe > Turbine"
  categorie_google: string;
  // mașina
  marca: string;
  model: string;
  modele: string;                // toate modelele compatibile, separate prin „|"
  compat: string;                // textul de compatibilitate scris de sursă
  ani: string;
  masina_sursa: string;          // mașina din curte de pe care s-a demontat piesa
  // comercial
  pret: number;
  pret_text: string;             // „350.00 RON"
  pret_sufix: string;
  moneda: string;
  stoc: number;
  disponibilitate_google: "in_stock" | "out_of_stock";
  disponibilitate_meta: "in stock" | "out of stock";
  stare_produs: "used";          // toate piesele sunt second-hand
  originala: boolean;
  oem: string;
  // logistică
  greutate_kg: number | null;
  greutate_estimata: boolean;
  // imagini
  poza: string;
  poze_suplimentare: string[];
  nr_poze: number;
  // etichete pentru campanii
  eticheta_marca: string;
  eticheta_categorie: string;
  eticheta_pret: string;
  eticheta_model: string;
  eticheta_ani: string;
  // intern (nu pleacă în feed-urile publice)
  creat_la: string;
  actualizat_la: string;
  publicat: boolean;
  editat_manual: boolean;
  sursa: string;
  sursa_url: string;
  cost_lei: number | null;
  vizualizari: number;
};

/** Motivele pentru care o piesă din catalog NU poate intra într-un feed de
 *  reclame. Se numără și se arată în panou: un produs respins de Google e
 *  invizibil, dar contribuie la rata de eroare a contului. */
export type Excluderi = {
  fara_poza: number;
  fara_pret: number;
  fara_stoc: number;
  fara_categorie: number;
  fara_model: number;
};

export type Catalog = { randuri: RandFeed[]; excluderi: Excluderi; total: number };

// ============================================================
// AJUTOARE DE TEXT
// ============================================================

/** Un singur rând, fără spații duble. Descrierile venite din import au rânduri
 *  goale și liste; într-o celulă CSV ele devin fie câmpuri rupte, fie rânduri
 *  noi pe care unele importatoare le citesc drept produse noi. */
export const unRand = (t: string) => (t ?? "").replace(/\s+/g, " ").trim();

/** Taie la ultimul cuvânt întreg, fără „…". */
export function taie(t: string, max: number) {
  if (t.length <= max) return t;
  const p = t.slice(0, max);
  const i = p.lastIndexOf(" ");
  return (i > max * 0.6 ? p.slice(0, i) : p).replace(/[\s,;:\/·—–-]+$/, "");
}

/** Prețul în forma cerută de Google și Meta: „350.00 RON". Punct zecimal,
 *  niciodată virgulă, și moneda după număr. */
export const pretFeed = (n: number) => `${Number(n).toFixed(2)} ${MONEDA_FEED}`;

/** Pragul de preț, ca etichetă de campanie. Într-un cont de Google Ads nu poți
 *  liciti diferit pe „piese ieftine" și „piese scumpe" fără o astfel de coloană. */
function pragPret(p: number) {
  if (p < 100) return "sub 100 lei";
  if (p < 300) return "100–299 lei";
  if (p < 1000) return "300–999 lei";
  return "peste 1000 lei";
}

// ============================================================
// DESCRIEREA
//
// NU e descrierea din metadatele paginii (`descrierePiesa` din lib/seo.ts).
// Aceea are 160 de caractere fiindcă atât arată Google în rezultatele căutării.
// Aici bugetul e de 5.000, iar textul e citit de un algoritm care caută
// potriviri cu ce a scris omul în bara de căutare: cu cât spune mai mult despre
// piesă — pe ce mașini merge, ce ani, ce s-a verificat — cu atât apare la mai
// multe căutări. Deci se scrie tot ce știm, în ordinea importanței.
// ============================================================
function descriereFeed(r: {
  nume: string; ani: string; compat: string[]; stare_nota: string;
  cod: string; oem: string; marca: string; originala: boolean;
}) {
  const bucati: string[] = [];
  bucati.push(unRand(r.nume) + ".");
  bucati.push("Piesă auto second-hand, demontată din dezmembrări autorizate și verificată în atelier.");
  if (r.originala) bucati.push(r.marca ? `Piesă originală ${r.marca}.` : "Piesă originală, nu replică.");
  if (r.compat.length) bucati.push(`Compatibilă cu: ${r.compat.map(unRand).join("; ")}.`);
  if (r.ani) bucati.push(`Ani de fabricație: ${r.ani}.`);
  // Nota de stare e scrisă de om, despre bucata fizică: „fără joc", „șuruburi
  // noi incluse", „prețul e pe bucată". E cea mai valoroasă propoziție din tot
  // rândul, dar începe adesea cu chiar numele piesei — se scoate repetiția.
  const nota = unRand(r.stare_nota);
  if (nota && !nota.toLowerCase().startsWith(unRand(r.nume).toLowerCase().slice(0, 25)))
    bucati.push(nota);
  else if (nota) bucati.push(unRand(nota.slice(unRand(r.nume).length)).replace(/^[.,;\s-]+/, ""));
  if (r.cod) bucati.push(`Cod intern ${r.cod}.`);
  if (r.oem) bucati.push(`Cod OEM ${r.oem}.`);
  bucati.push("Garanție 90 de zile. Livrare prin curier în toată România, 1–3 zile lucrătoare.");
  return taie(unRand(bucati.filter(Boolean).join(" ")), MAX_DESCRIERE_FEED);
}

// ============================================================
// CITIREA CATALOGULUI
// ============================================================

type ProdusFeed = {
  id: number; slug: string; nume: string; oem: string | null; pret_lei: number; pret_sufix: string | null;
  ani: string | null; stoc: number; publicat: boolean; cod_intern: string | null; poze: string[] | null;
  categorie_id: number | null; subcategorie_id: number | null; model_ids: number[] | null;
  vehicul_id: number | null; greutate_kg: number | null; greutate_estimata: boolean;
  originala: boolean; stare_nota: string | null; compat: string[] | null; created_at: string;
  sursa: string | null; sursa_url: string | null; sursa_sincronizat_la: string | null;
  editat_manual: boolean; cost_lei: number | null; vizualizari: number;
};

/** Coloanele cerute de la bază. Scrise explicit, nu `*`: un `select("*")` ar
 *  aduce și `cautare` (un text lung, calculat, de care feed-ul n-are nevoie) pe
 *  fiecare dintre cele ~8.800 de rânduri. */
const COLOANE =
  "id,slug,nume,oem,pret_lei,pret_sufix,ani,stoc,publicat,cod_intern,poze," +
  "categorie_id,subcategorie_id,model_ids,vehicul_id,greutate_kg,greutate_estimata," +
  "originala,stare_nota,compat,created_at,sursa,sursa_url,sursa_sincronizat_la,editat_manual";

/** Aceleași coloane, plus cele interne. Se folosește DOAR din panou, unde
 *  citirea trece prin sesiunea omului. Feed-urile publice nu o cheamă niciodată. */
const COLOANE_INTERNE = COLOANE + ",cost_lei,vizualizari";

export type OptiuniCatalog = {
  /** Clientul Supabase de folosit. Feed-urile publice dau clientul de server
   *  (anonim, deci vede doar ce e publicat); panoul dă clientul de browser, cu
   *  sesiunea operatorului. */
  sb?: ReturnType<typeof sbServer>;
  /** `true` (implicit) = doar piesele publicate, cu stoc. Panoul poate cere tot
   *  catalogul, ca să exporte și ce e depublicat. */
  doarVandabile?: boolean;
  /** Include coloanele interne (cost, marjă, vizualizări). Doar din panou. */
  cuDateInterne?: boolean;
};

export async function citesteCatalog(optiuni: OptiuniCatalog = {}): Promise<Catalog> {
  const sb = optiuni.sb ?? sbServer();
  const doarVandabile = optiuni.doarVandabile ?? true;
  const gol: Catalog = {
    randuri: [], total: 0,
    excluderi: { fara_poza: 0, fara_pret: 0, fara_stoc: 0, fara_categorie: 0, fara_model: 0 },
  };
  if (!sb) return gol;

  const coloane = optiuni.cuDateInterne ? COLOANE_INTERNE : COLOANE;

  // Cele patru tabele de referință sunt mici (17 categorii + 349 subcategorii,
  // 38 de mărci, 540 de modele, 22 de mașini) și se citesc o dată, în paralel cu
  // catalogul. Alternativa — un `select` cu relații pe produse — ar aduce numele
  // categoriei de 8.800 de ori prin rețea.
  const [produse, categorii, marci, modele, masini] = await Promise.all([
    citesteTot<ProdusFeed>(() => {
      let q = sb.from("products").select(coloane, { count: "exact" });
      if (doarVandabile) q = q.eq("publicat", true).gt("stoc", 0);
      return q.order("id") as any;
    }, { eticheta: "piesele pentru feed" }),
    citesteTot<Category>(() => sb.from("categories").select("id,nume,slug,parent_id", { count: "exact" }).order("id") as any,
      { eticheta: "categoriile pentru feed" }),
    citesteTot<Brand>(() => sb.from("brands").select("id,nume,slug", { count: "exact" }).order("id") as any,
      { eticheta: "mărcile pentru feed" }),
    citesteTot<Model>(() => sb.from("models").select("id,brand_id,nume,slug", { count: "exact" }).order("id") as any,
      { eticheta: "modelele pentru feed" }),
    citesteTot<{ id: number; nume: string }>(() => sb.from("vehicles").select("id,nume", { count: "exact" }).order("id") as any,
      { eticheta: "mașinile pentru feed" }),
  ]);

  const catDupaId = new Map(categorii.map((c) => [c.id, c]));
  const marcaDupaId = new Map(marci.map((b) => [b.id, b]));
  const modelDupaId = new Map(modele.map((m) => [m.id, m]));
  const masinaDupaId = new Map(masini.map((v) => [v.id, v.nume]));

  const excluderi: Excluderi = { fara_poza: 0, fara_pret: 0, fara_stoc: 0, fara_categorie: 0, fara_model: 0 };
  const randuri: RandFeed[] = [];

  for (const p of produse) {
    const poze = (p.poze ?? []).filter(Boolean);
    const modeleP = (p.model_ids ?? []).map((id) => modelDupaId.get(id)).filter(Boolean) as Model[];
    const marca = modeleP.length ? marcaDupaId.get(modeleP[0].brand_id) ?? null : null;

    // Numărătoarea motivelor de excludere se face pe TOT ce s-a citit, chiar
    // dacă rândul intră mai departe: panoul trebuie să poată spune „4 piese n-au
    // poză, deci Google le va respinge", nu doar să le ascundă.
    if (poze.length === 0) excluderi.fara_poza++;
    if (!(Number(p.pret_lei) > 0)) excluderi.fara_pret++;
    if (p.stoc <= 0) excluderi.fara_stoc++;
    if (!p.categorie_id) excluderi.fara_categorie++;
    if (modeleP.length === 0) excluderi.fara_model++;

    const cat = p.categorie_id ? catDupaId.get(p.categorie_id) ?? null : null;
    const subcat = p.subcategorie_id ? catDupaId.get(p.subcategorie_id) ?? null : null;
    const cale = [cat?.nume, subcat?.nume].filter(Boolean).join(" > ");
    const compat = (p.compat ?? []).filter(Boolean);
    const oem = (p.oem ?? "").trim();
    const cod = (p.cod_intern ?? "").trim();
    const ani = (p.ani ?? "").trim();

    randuri.push({
      id: cod || `AP-${p.id}`,
      id_baza: p.id,
      slug: p.slug,
      url: `${SITE_URL}/piese/${p.slug}`,
      titlu: taie(unRand(p.nume), MAX_TITLU_FEED),
      descriere: descriereFeed({
        nume: p.nume, ani, compat, stare_nota: p.stare_nota ?? "", cod, oem,
        marca: marca?.nume ?? "", originala: p.originala,
      }),
      nume_brut: unRand(p.nume),
      stare_nota: unRand(p.stare_nota ?? ""),
      categorie: cat?.nume ?? "",
      subcategorie: subcat?.nume ?? "",
      cale_categorie: cale,
      categorie_google: CATEGORIE_GOOGLE,
      marca: marca?.nume ?? "",
      model: modeleP[0]?.nume ?? "",
      modele: modeleP.map((m) => m.nume).join("|"),
      compat: compat.map(unRand).join("|"),
      ani,
      masina_sursa: p.vehicul_id ? masinaDupaId.get(p.vehicul_id) ?? "" : "",
      pret: Number(p.pret_lei),
      pret_text: pretFeed(Number(p.pret_lei)),
      pret_sufix: (p.pret_sufix ?? "").trim(),
      moneda: MONEDA_FEED,
      stoc: p.stoc,
      disponibilitate_google: p.stoc > 0 ? "in_stock" : "out_of_stock",
      disponibilitate_meta: p.stoc > 0 ? "in stock" : "out of stock",
      stare_produs: "used",
      originala: p.originala,
      oem,
      greutate_kg: p.greutate_kg === null ? null : Number(p.greutate_kg),
      greutate_estimata: p.greutate_estimata,
      poza: poze[0] ?? "",
      poze_suplimentare: poze.slice(1, 1 + MAX_POZE_SUPLIMENTARE),
      nr_poze: poze.length,
      eticheta_marca: marca?.nume ?? "fără marcă",
      eticheta_categorie: cat?.nume ?? "fără categorie",
      eticheta_pret: pragPret(Number(p.pret_lei)),
      eticheta_model: modeleP[0]?.nume ?? "fără model",
      eticheta_ani: ani || "fără ani",
      creat_la: p.created_at,
      actualizat_la: p.sursa_sincronizat_la ?? p.created_at,
      publicat: p.publicat,
      editat_manual: p.editat_manual,
      sursa: p.sursa ?? "",
      sursa_url: p.sursa_url ?? "",
      cost_lei: p.cost_lei === null || p.cost_lei === undefined ? null : Number(p.cost_lei),
      vizualizari: p.vizualizari ?? 0,
    });
  }

  return { randuri, excluderi, total: produse.length };
}

/**
 * Rândurile care au voie într-un feed de reclame.
 *
 * Google respinge orice produs fără imagine sau fără preț, iar Meta la fel. Un
 * produs respins nu doar că nu se afișează: intră în rata de eroare a contului,
 * iar un cont cu multe erori poate fi suspendat. Deci se filtrează AICI, nu se
 * trimit și se speră.
 *
 * Exportul CSV generic din panou NU folosește filtrul ăsta: acolo vrei să vezi
 * exact ce lipsește, ca să completezi.
 */
export const doarPentruReclame = (randuri: RandFeed[]) =>
  randuri.filter((r) => r.poza && r.pret > 0 && r.stoc > 0 && r.titlu);
