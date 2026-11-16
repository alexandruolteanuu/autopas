// ============================================================
// SINCRONIZAREA AUTOMATĂ CU OLX (pasul 3 din docs/olx-plan.md, migrarea 58)
//
// Motorul cozii. Fără bază proprie și fără rețea proprie: `depozit` (lib/olx.ts)
// + `client` (lib/olx-api.mjs, singurul cu tokenii). De aceea se testează cu
// imitații: scripts/verifica-olx-coada.mjs.
//
// REGULA DE BAZĂ (ca la dez.ro): ce e de făcut se decide la PROCESARE, din starea
// piesei și a anunțului de ATUNCI — niciodată din `motiv`-ul scris de trigger.
// Între trigger și procesare piesa se mai poate schimba o dată.
//
//   piesa publicată + stoc  · fără anunț            → publicare (POST; garda de dublură din `publica`)
//                           · anunț retras / inactiv → reactivare (activate, doar removed_by_user / outdated)
//                           · anunț viu, text schimbat (amprenta) → actualizare (PUT)
//                           · anunț viu, nimic schimbat → nimic (nicio cerere la OLX)
//   piesa vândută (stoc 0)  · anunț viu → retragere „vândut” (deactivate, is_success: true)
//   piesa ascunsă / ștearsă · anunț viu → retragere (deactivate, is_success: false)
//   anunț „limited” / „unpaid” (neplătit — nu se poate dezactiva: „Primul pas este ca
//     anuntul sa fie activ”) → comanda `finish` (îl mută la „terminate”; nu costă nimic).
//   NICIODATĂ DELETE (refuzat oricum de lista închisă din lib/olx-api.mjs).
//
// Retragerea citește ÎNTÂI starea reală de la OLX (GET): starea din bază poate fi
// veche — un anunț „limited” la noi poate fi între timp activat de om, după plată.
// ============================================================
import { construiesteAnunt } from "./olx-anunt.mjs";
import { EroareOlx, dinData } from "./olx-api.mjs";
import { publica, actualizeaza } from "./olx-publicare.mjs";

/** Câte rânduri ia un lot (un lot încape în 60 s; o piesă = 1–4 cereri de ~1–3 s). */
export const PE_LOT = 10;
/** Bugetul unui lot: nu se mai începe un rând după atât. Cu timeout-ul de 15 s pe cerere
 *  și cel mult două cereri lente pe rând, rămâne sub 60 s în cazul obișnuit; dacă totuși
 *  funcția e tăiată, rândurile terminate au plecat DEJA din coadă (se șterg unul câte unul). */
export const BUGET_MS = 20_000;
/** Timeout-ul unei cereri spre OLX din coadă (butoanele din admin folosesc 25 s). */
export const TIMEOUT_COADA_MS = 15_000;
/** Pauza dintre piese: OLX blochează IP-ul (403) după sute de cereri la rând. */
export const PAUZA_MS = 500;
/** După atâtea eșecuri rândul se lasă în pace, cu eroarea la vedere. */
export const MAX_INCERCARI = 5;
/** Plasa: peste atâtea retrageri față de anunțurile vii, coada se OPREȘTE și cere confirmare. */
export const PRAG_RETRAGERE = 0.2;

/** Stări în care anunțul e (sau poate deveni) vizibil — deci trebuie retras dacă piesa nu mai e. */
export const STARI_VII = ["new", "active", "limited", "unpaid", "unconfirmed"];
/** Stări neplătite: `deactivate` e refuzat de OLX, se folosește `finish`. */
export const STARI_NEPLATITE = ["limited", "unpaid", "unconfirmed"];
/** Stări din care un anunț se poate reactiva (cerut de proprietar, 13 noiembrie 2026). */
export const STARI_REACTIVABILE = ["removed_by_user", "outdated"];

const acumIso = () => new Date().toISOString();
const asteapta = (ms) => new Promise((r) => setTimeout(r, ms));

/** Piesa e de pus pe OLX? (aceeași regulă ca `publica`). */
export const eligibila = (p) => !!p && !!p.publicat && Number(p.stoc) > 0;

/**
 * DECIZIA, fără nicio cerere: ce e de făcut cu piesa / anunțul.
 * @param {any} piesa   rândul din `products` (null = piesa nu mai există)
 * @param {any} anunt   rândul din `olx_anunturi` (null = n-a fost niciodată publicată)
 * @param {string|null} amprentaNoua  amprenta anunțului generat acum (null = nu se poate genera)
 * @returns {"publica"|"reactiveaza"|"actualizeaza"|"retrage"|"nimic"}
 */
export function decide(piesa, anunt, amprentaNoua) {
  const areAnunt = !!anunt?.advert_id;
  if (eligibila(piesa)) {
    if (!areAnunt) return "publica";
    if (anunt.retras_la || STARI_REACTIVABILE.includes(anunt.status)) return "reactiveaza";
    if (amprentaNoua === null) return "actualizeaza"; // anunțul nu se poate genera: `actualizeaza` aruncă motivele, la vedere
    return amprentaNoua !== anunt.amprenta ? "actualizeaza" : "nimic";
  }
  if (areAnunt && !anunt.retras_la && STARI_VII.includes(anunt.status)) return "retrage";
  return "nimic";
}

/** Starea anunțului la OLX acum (GET). 404 → null (anunțul nu mai există la ei). */
async function stareOlx(client, advertId, productId, de) {
  try {
    const { json } = await client.cere({ cale: `/adverts/${advertId}`, tip: "stare", product_id: productId, de });
    return dinData(json) ?? {};
  } catch (e) {
    if (e?.cod === "404") return null;
    throw e;
  }
}

const dinAnunt = (ad, vechi) => ({
  status: ad?.status ?? vechi?.status ?? "necunoscut",
  ...(ad?.url ? { url: ad.url } : {}),
});

/**
 * Retrage anunțul unei piese care nu mai e de vânzare (vândută, ascunsă, ștearsă).
 * Citește întâi starea reală; trimite comanda potrivită stării; scrie `retras_la`.
 * @param {{ anunt: any, vanduta: boolean, client: any, depozit: any, de?: string|null }} p
 */
export async function retrage({ anunt, vanduta, client, depozit, de = null }) {
  const id = anunt.advert_id;
  let ad = await stareOlx(client, id, anunt.product_id, de);
  if (ad === null) {
    await depozit.scrieDupaAdvert(id, { status: "disparut", retras_la: acumIso(), eroare: null });
    return { fel: "retras", comanda: null, status: "disparut" };
  }
  const st = ad.status;
  const corp = st === "active" || st === "new" ? { command: "deactivate", is_success: !!vanduta }
    : STARI_NEPLATITE.includes(st) ? { command: "finish" }
    : null; // deja inactiv (removed_by_user, outdated, respins…): nimic de trimis
  if (corp) {
    await client.cere({ metoda: "POST", cale: `/adverts/${id}/commands`, corp, tip: corp.command, product_id: anunt.product_id, de });
    ad = (await stareOlx(client, id, anunt.product_id, de)) ?? { status: "disparut" };
    // OLX răspunde câteva clipe cu starea VECHE după comandă (măsurat la 16 noiembrie 2026: 45 de
    // anunțuri dezactivate citite „active” imediat după, `removed_by_user` un minut mai târziu).
    // Comanda a reușit (2xx), deci se scrie starea la care duce `deactivate`.
    if (corp.command === "deactivate" && ad.status === st) ad = { ...ad, status: "removed_by_user" };
  }
  await depozit.scrieDupaAdvert(id, { ...dinAnunt(ad, anunt), retras_la: acumIso(), eroare: null });
  return { fel: "retras", comanda: corp?.command ?? null, status: ad.status };
}

/**
 * Piesa a revenit pe site (comandă anulată, republicată): anunțul retras se reactivează,
 * apoi se actualizează dacă s-a schimbat ceva.
 * @param {{ piesa: any, anunt: any, ctx: any, client: any, depozit: any, de?: string|null }} p
 */
export async function reactiveaza({ piesa, anunt, ctx, client, depozit, de = null }) {
  const id = anunt.advert_id;
  let ad = await stareOlx(client, id, piesa.id, de);
  if (ad === null)
    throw new EroareOlx(`Anunțul #${id} nu mai există la OLX. Verifică-l în contul OLX; piesa nu primește automat un anunț nou.`, { cod: "disparut" });
  if (STARI_REACTIVABILE.includes(ad.status)) {
    await client.cere({ metoda: "POST", cale: `/adverts/${id}/commands`, corp: { command: "activate" }, tip: "activate", product_id: piesa.id, de });
    ad = (await stareOlx(client, id, piesa.id, de)) ?? {};
  } else if (!STARI_VII.includes(ad.status)) {
    throw new EroareOlx(`Anunțul #${id} are starea „${ad.status}” la OLX și nu se poate reactiva automat — verifică-l în contul OLX.`, { cod: "stare" });
  }
  await depozit.scrieDupaAdvert(id, { ...dinAnunt(ad, anunt), retras_la: null, eroare: null });
  const a = construiesteAnunt(piesa, ctx);
  if (a.ok && a.amprenta === anunt.amprenta) return { fel: "reactivat", status: ad.status };
  const r = await actualizeaza({ piesa, ctx, client, depozit, de });
  return { fel: "reactivat", status: r.status ?? ad.status };
}

/**
 * Un rând din coadă. Întoarce { fel } — publicat / actualizat / reactivat / retras / nimic.
 * @param {{ rand: any, ctx: any, client: any, depozit: any, de?: string|null }} p
 */
export async function proceseazaRand({ rand, ctx, client, depozit, de = null }) {
  // Piesă ȘTEARSĂ din bază: rândul de coadă ține id-ul anunțului.
  if (!rand.product_id) {
    const anunt = await depozit.anuntDupaAdvert(rand.advert_id);
    if (!anunt?.advert_id || anunt.retras_la || !STARI_VII.includes(anunt.status)) return { fel: "nimic" };
    return retrage({ anunt, vanduta: false, client, depozit, de });
  }
  const [piesa, anunt] = await Promise.all([depozit.piesa(rand.product_id), depozit.anuntDupaPiesa(rand.product_id)]);
  const a = eligibila(piesa) && anunt?.advert_id ? construiesteAnunt(piesa, ctx) : null;
  const ce = decide(piesa, anunt, a ? (a.ok ? a.amprenta : null) : undefined);
  if (ce === "publica") return { fel: "publicat", ...(await publica({ piesa, ctx, client, depozit, de })) };
  if (ce === "actualizeaza") return { fel: "actualizat", ...(await actualizeaza({ piesa, ctx, client, depozit, de })) };
  if (ce === "reactiveaza") return reactiveaza({ piesa, anunt, ctx, client, depozit, de });
  if (ce === "retrage") return retrage({ anunt, vanduta: !!piesa && !!piesa.publicat && !(Number(piesa.stoc) > 0), client, depozit, de });
  return { fel: "nimic" };
}

/** Erorile după care lotul se OPREȘTE (nu are rost să încerci piesa următoare). */
export function eOprire(e) {
  const msg = String(e?.message ?? "");
  return e?.cod === "neconectat" || e?.cod === "config" || e?.cod === "nepermis"
    || (e?.status === 403 && /request blocked|could not be satisfied/i.test(msg))
    || e?.cod === "429";
}

/**
 * Un lot din coadă. Fiecare rând terminat se ȘTERGE pe loc din coadă (nu la final): dacă
 * funcția e tăiată la 60 s, ce s-a făcut nu se mai repetă. Rândul picat rămâne, cu
 * încercarea numărată și eroarea la vedere.
 * @param {{ randuri: any[], ctx: any, client: any, depozit: any, bugetMs?: number, pauzaMs?: number, acum?: () => number }} p
 */
export async function lotCoada({ randuri, ctx, client, depozit, bugetMs = BUGET_MS, pauzaMs = PAUZA_MS, acum = Date.now }) {
  const limita = acum() + bugetMs;
  const rez = { facute: 0, publicate: 0, actualizate: 0, reactivate: 0, retrase: 0, nimic: 0, erori: [], oprit: null };
  for (let i = 0; i < randuri.length; i++) {
    if (acum() > limita) break;
    const rand = randuri[i];
    let cereri = false;
    try {
      const r = await proceseazaRand({ rand, ctx, client, depozit });
      const cheie = { publicat: "publicate", actualizat: "actualizate", reactivat: "reactivate", retras: "retrase" }[r.fel] ?? "nimic";
      rez[cheie]++;
      cereri = cheie !== "nimic";
      await depozit.coadaSterge(rand.id);
      rez.facute++;
    } catch (e) {
      cereri = true;
      const mesaj = String(e?.message ?? e).slice(0, 500);
      rez.erori.push({ coada_id: rand.id, product_id: rand.product_id ?? null, advert_id: rand.advert_id ?? null, eroare: mesaj });
      try { await depozit.coadaEsec(rand.id, mesaj, (rand.incercari ?? 0) + 1); } catch { /* rândul rămâne oricum */ }
      if (eOprire(e)) { rez.oprit = mesaj; break; }
    }
    // Pauză doar după o piesă care a vorbit cu OLX (cele „nimic” nu cer nimic).
    if (cereri && pauzaMs && i < randuri.length - 1) await asteapta(pauzaMs);
  }
  return rez;
}

/**
 * Plasa de 20%: câte anunțuri vii ar trebui retrase (piese vândute / ascunse / șterse) față
 * de câte sunt vii. Peste prag, coada se oprește: aici nu apasă nimeni niciun buton, iar un
 * `update products set publicat = false` dat din greșeală ar retrage tot catalogul.
 * @param {{ vii: number, deRetras: number }} n
 */
export function prag({ vii, deRetras }) {
  const procent = vii ? deRetras / vii : 0;
  return { vii, deRetras, procent, depasit: vii > 0 && procent > PRAG_RETRAGERE };
}

/**
 * „ADU LA ZI”: ce trebuie pus în coadă ca OLX să ajungă la starea site-ului — pentru
 * diferențele strânse înainte de pornirea sincronizării (sau după o oprire).
 * @param {{ piese: any[], anunturi: any[], ctx: any }} p
 *   piese    — TOATE piesele (cel puțin id, publicat, stoc; pentru cele eligibile și coloanele generatorului)
 *   anunturi — tot `olx_anunturi`
 * @returns {{ produse: number[], advert: number[], motive: Record<string, number> }}
 */
export function diferente({ piese, anunturi, ctx }) {
  const dupaPiesa = new Map(anunturi.filter((a) => a.product_id).map((a) => [Number(a.product_id), a]));
  const produse = [], advert = [], motive = {};
  const nota = (m) => { motive[m] = (motive[m] ?? 0) + 1; };
  for (const p of piese) {
    const anunt = dupaPiesa.get(Number(p.id)) ?? null;
    const a = eligibila(p) && anunt?.advert_id ? construiesteAnunt(p, ctx) : null;
    const ce = decide(p, anunt, a ? (a.ok ? a.amprenta : null) : undefined);
    if (ce === "nimic") continue;
    // O piesă fără anunț care nu se poate genera (categorie nepotrivită etc.) nu se pune în coadă:
    // ar pica de 5 ori la rând. Apare în „Raport pe tot catalogul”.
    if (ce === "publica" && !construiesteAnunt(p, ctx).ok) { nota("nu se poate publica încă (vezi raportul)"); continue; }
    produse.push(Number(p.id));
    nota({ publica: "de publicat", actualizeaza: "de actualizat", reactiveaza: "de reactivat",
           retrage: eligibila(p) ? "de retras" : !p.publicat ? "de retras (ascunse)" : "de retras (vândute)" }[ce]);
  }
  for (const a of anunturi) {
    if (a.product_id || !a.advert_id || a.retras_la || !STARI_VII.includes(a.status)) continue;
    advert.push(Number(a.advert_id));
    nota("de retras (șterse)");
  }
  return { produse, advert, motive };
}
