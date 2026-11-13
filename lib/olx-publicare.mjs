// ============================================================
// PUBLICAREA PE OLX (pasul 2 din docs/olx-plan.md) — CE se face cu anunțul unei piese.
// Folosit de butoanele de pe pagina piesei (pasul 2) și de coadă (pasul 3).
// Fără bază proprie: `depozit` (lib/olx.ts) + `client` (lib/olx-api.mjs, singurul cu tokenii).
//
// GARANȚIILE:
//   · UN SINGUR anunț pe piesă: rândul din `olx_anunturi` se REVENDICĂ înainte de POST
//     (`product_id` unic), iar înainte de POST se caută la OLX un anunț cu același
//     `external_id` (cod_intern) — dacă există (POST reușit, dar id-ul nesalvat), se
//     preia și se actualizează, nu se creează altul.
//   · NIMIC PLĂTIT: un anunț „limited” doar se marchează; `activate` e refuzat pe el.
//     Lista închisă din lib/olx-api.mjs refuză oricum pachetele și promovările.
// ============================================================
import { construiesteAnunt } from "./olx-anunt.mjs";
import { EroareOlx, dinData } from "./olx-api.mjs";

/** Stări în care OLX a respins anunțul — se cere și motivul. */
export const STARI_RESPINSE = ["moderated", "blocked", "disabled", "removed_by_moderator"];
/** O revendicare „in_curs” mai veche de atât e a unui proces mort și se poate prelua. */
export const REVENDICARE_EXPIRA_MS = 3 * 60 * 1000;

const faraHtml = (t) => String(t ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const data = (t) => (t ? new Date(String(t).replace(" ", "T") + (/[zZ+]/.test(String(t).slice(10)) ? "" : "+02:00")).toISOString() : null);

/** Câmpurile de salvat din răspunsul OLX despre un anunț. */
function dinAnunt(ad) {
  return { advert_id: ad?.id ?? null, status: ad?.status ?? "necunoscut", url: ad?.url || null, valid_to: data(ad?.valid_to) };
}

/** Anunțul piesei sau motivele; aruncă dacă nu se poate trimite. */
function anuntSau(piesa, ctx) {
  const a = construiesteAnunt(piesa, ctx);
  if (!a.ok) throw new EroareOlx(`Anunțul nu se poate trimite: ${a.motive.join("; ")}.`, { cod: "motive" });
  return a;
}

/** Trimite corpul; dacă OLX refuză `external_url` pentru contul nostru, renunță la el o dată pentru totdeauna. */
async function cuExternalUrl(trimite, a, depozit) {
  try { return await trimite(a.corp); }
  catch (e) {
    if (!a.corp.external_url || !/external url/i.test(String(e?.message))) throw e;
    await depozit.faraExternalUrl();
    const { external_url, ...fara } = a.corp; // eslint-disable-line @typescript-eslint/no-unused-vars
    a.corp = fara;
    return await trimite(fara);
  }
}

/**
 * Publică piesa (sau, dacă are deja anunț, îl actualizează).
 * @param {{ piesa: any, ctx: any, client: any, depozit: any, de?: string|null }} p
 */
export async function publica({ piesa, ctx, client, depozit, de = null }) {
  if (!piesa.publicat || !(Number(piesa.stoc) > 0)) throw new EroareOlx("Piesa nu e publicată pe site sau n-are stoc — nu se publică pe OLX.", { cod: "neeligibila" });
  const a = anuntSau(piesa, ctx);
  const rand = await depozit.citeste(piesa.id);
  if (rand?.advert_id) return actualizeaza({ piesa, ctx, client, depozit, de });

  if (!(await depozit.revendica(piesa.id, piesa.cod_intern, REVENDICARE_EXPIRA_MS)))
    throw new EroareOlx("Piesa e deja în curs de publicare pe OLX. Reîncarcă peste câteva secunde.", { cod: "ocupat" });

  try {
    // Plasa a doua: anunțul poate exista deja la OLX (POST reușit, id nesalvat).
    const cod = String(piesa.cod_intern ?? "");
    const { json } = await client.cere({ cale: `/adverts?external_id=${encodeURIComponent(cod)}&limit=50`, tip: "cauta", product_id: piesa.id, de });
    const existent = (Array.isArray(json?.data) ? json.data : []).find((x) => String(x.external_id ?? "") === cod);
    if (existent) {
      await depozit.scrie(piesa.id, { ...dinAnunt(existent), eroare: null, publicat_la: new Date().toISOString() });
      return { ...(await actualizeaza({ piesa, ctx, client, depozit, de })), preluat: true };
    }
    const r = await cuExternalUrl((corp) => client.cere({ metoda: "POST", cale: "/adverts", corp, tip: "publica", product_id: piesa.id, de }), a, depozit);
    const ad = dinData(r.json);
    await depozit.scrie(piesa.id, { ...dinAnunt(ad), amprenta: a.amprenta, eroare: null, motiv_moderare: null, publicat_la: new Date().toISOString() });
    return { actiune: "publicat", status: ad?.status, url: ad?.url ?? null, advert_id: ad?.id };
  } catch (e) {
    try { await depozit.scrie(piesa.id, { status: "eroare", eroare: String(e?.message ?? e).slice(0, 1000) }); } catch { /* eroarea de mai jos ajunge oricum */ }
    throw e;
  }
}

/** PUT cu anunțul generat acum (preț, titlu, poze, descriere…).
 *  @param {{ piesa: any, ctx: any, client: any, depozit: any, de?: string|null }} p */
export async function actualizeaza({ piesa, ctx, client, depozit, de = null }) {
  const rand = await depozit.citeste(piesa.id);
  if (!rand?.advert_id) throw new EroareOlx("Piesa n-are anunț pe OLX.", { cod: "fara_anunt" });
  const a = anuntSau(piesa, ctx);
  try {
    const r = await cuExternalUrl((corp) => client.cere({ metoda: "PUT", cale: `/adverts/${rand.advert_id}`, corp, tip: "actualizeaza", product_id: piesa.id, de }), a, depozit);
    const ad = dinData(r.json) ?? {};
    await depozit.scrie(piesa.id, { ...(ad.id ? dinAnunt(ad) : {}), amprenta: a.amprenta, eroare: null });
    return { actiune: "actualizat", status: ad.status ?? rand.status, url: ad.url ?? rand.url, advert_id: rand.advert_id };
  } catch (e) {
    try { await depozit.scrie(piesa.id, { eroare: String(e?.message ?? e).slice(0, 1000) }); } catch { /* idem */ }
    throw e;
  }
}

/** Starea de acum de la OLX (+ motivul, dacă e respins).
 *  @param {{ productId: number, client: any, depozit: any, de?: string|null }} p */
export async function improspateaza({ productId, client, depozit, de = null }) {
  const rand = await depozit.citeste(productId);
  if (!rand?.advert_id) throw new EroareOlx("Piesa n-are anunț pe OLX.", { cod: "fara_anunt" });
  const { json } = await client.cere({ cale: `/adverts/${rand.advert_id}`, tip: "stare", product_id: productId, de });
  const ad = dinData(json) ?? {};
  let motiv = null;
  if (STARI_RESPINSE.includes(ad.status)) {
    try {
      const m = await client.cere({ cale: `/adverts/${rand.advert_id}/moderation-reason`, tip: "motiv", product_id: productId, de });
      motiv = faraHtml(dinData(m.json)?.email_notification) || null;
    } catch { motiv = "(motivul nu s-a putut citi)"; }
  }
  await depozit.scrie(productId, { ...dinAnunt({ ...ad, id: ad.id ?? rand.advert_id }), motiv_moderare: motiv });
  return { status: ad.status, url: ad.url ?? null, motiv_moderare: motiv, advert_id: rand.advert_id };
}

/** Dezactivare (`vanduta`: is_success) sau activare. Activarea e refuzată pe „limited” (s-ar cere plată).
 *  @param {{ productId: number, comanda: "activate"|"deactivate", vanduta?: boolean, client: any, depozit: any, de?: string|null }} p */
export async function comanda({ productId, comanda: cmd, vanduta = false, client, depozit, de = null }) {
  const rand = await depozit.citeste(productId);
  if (!rand?.advert_id) throw new EroareOlx("Piesa n-are anunț pe OLX.", { cod: "fara_anunt" });
  if (cmd === "activate" && rand.status === "limited")
    throw new EroareOlx("Anunțul e „limited” (peste limita gratuită). Aplicația nu cumpără nimic — activează-l din contul OLX dacă vrei.", { cod: "limited" });
  const corp = cmd === "deactivate" ? { command: "deactivate", is_success: !!vanduta } : { command: "activate" };
  await client.cere({ metoda: "POST", cale: `/adverts/${rand.advert_id}/commands`, corp, tip: cmd, product_id: productId, de });
  return improspateaza({ productId, client, depozit, de });
}
