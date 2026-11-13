// ============================================================
// PUBLICAREA ÎNTREGULUI CATALOG PE OLX, DIN TERMINAL (13 noiembrie 2026, cerut de proprietar)
//
//   node scripts/olx-publica-tot.mjs [--limita=N] [--uscat] [--pauza-ms=1500]
//
// Folosește EXACT `publica` din lib/olx-publicare.mjs — aceeași funcție ca butonul de pe
// pagina piesei, cu aceleași gărzi: un singur anunț pe piesă (rândul se revendică înainte de
// POST), anunțurile vechi manuale nu se ating, nimic plătit. Anunțurile ies „limited” (fără
// pachet pe cont): se activează din contul OLX, de om, nu de aici.
//
// Sare peste piesele care au deja anunț (`advert_id`) — deci se poate opri și relua oricând.
// Ritm: pauză între piese (fiecare piesă = o căutare + un POST). La 403 „Request blocked”
// (CloudFront, IP blocat după sute de cereri la rând — măsurat la 13 noiembrie 2026) așteaptă
// 10 minute și reia; după 6 blocări la rând se oprește. După 10 erori la rând se oprește.
//
// Pozele pleacă prin /feed/poze/…jpg, ca din site: adresa se scrie cu domeniul de PRODUCȚIE
// (`--site=`), nu cu NEXT_PUBLIC_SITE_URL din .env.local (acolo e localhost).
// ============================================================
import { bazaRest, clientOlxRest } from "./olx-client-rest.mjs";
import { citesteTotRest } from "../lib/rest.mjs";
import { publica, comanda } from "../lib/olx-publicare.mjs";
import { REGULI_TITLU } from "../lib/olx-anunt.mjs";

const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=");
const LIMITA = Number(arg("limita")) || Infinity;
const USCAT = process.argv.includes("--uscat");
const PAUZA_MS = Number(arg("pauza-ms")) || 1500;
const SITE = (arg("site") ?? "https://autopas-dezmembrari.ro").replace(/\/+$/, "");
const COLOANE = "id,nume,slug,stare_nota,ani,compat,oem,cod_intern,pret_lei,pret_sufix,poze,stoc,publicat,categorie_id,subcategorie_id";

const { url, antete, rest } = bazaRest();
const client = clientOlxRest();
const asteapta = (ms) => new Promise((r) => setTimeout(r, ms));
const acum = () => new Date().toLocaleTimeString("ro-RO", { timeZone: "Europe/Bucharest" });

/** Geamănul lui `pozaCsv` din lib/feed-pieseauto.ts (fișier TS, nu se poate importa de aici). */
function poza(u) {
  const m = String(u).match(/\/storage\/v1\/object\/public\/poze-piese\/+(.+)$/);
  if (!m) return String(u).replace(/([^:])\/{2,}/g, "$1/");
  const cale = m[1].replace(/\/{2,}/g, "/");
  return `${SITE}/feed/poze/${cale.split("/").map(encodeURIComponent).join("/")}.jpg`;
}

/** Geamănul lui `depozitAnunturi` din lib/olx.ts, pe REST. */
const depozit = {
  citeste: async (id) => (await rest(`olx_anunturi?product_id=eq.${id}&select=*`))[0] ?? null,
  revendica: async (id, cod, expiraMs) => {
    const nou = await rest("olx_anunturi?on_conflict=product_id&select=id", { metoda: "POST",
      corp: { product_id: id, cod_intern: cod, status: "in_curs" }, prefer: "resolution=ignore-duplicates,return=representation" });
    if (Array.isArray(nou) && nou.length === 1) return true;
    const r = (await rest(`olx_anunturi?product_id=eq.${id}&select=id,status,advert_id,actualizat_la`))[0];
    if (!r || r.advert_id) return false;
    if (r.status === "in_curs" && Date.now() - Date.parse(r.actualizat_la) < expiraMs) return false;
    const luat = await rest(`olx_anunturi?id=eq.${r.id}&actualizat_la=eq.${encodeURIComponent(r.actualizat_la)}&advert_id=is.null&select=id`,
      { metoda: "PATCH", corp: { status: "in_curs", actualizat_la: new Date().toISOString() }, prefer: "return=representation" });
    return Array.isArray(luat) && luat.length === 1;
  },
  scrie: async (id, campuri) => {
    const r = await rest(`olx_anunturi?product_id=eq.${id}&select=id`, { metoda: "PATCH",
      corp: { ...campuri, actualizat_la: new Date().toISOString() }, prefer: "return=representation" });
    if (!Array.isArray(r) || r.length !== 1) throw new Error("Starea anunțului OLX nu s-a putut scrie în bază.");
  },
  faraExternalUrl: async () => {
    const s = (await rest("olx_cont?unic=eq.true&select=setari"))[0]?.setari ?? {};
    await rest("olx_cont?unic=eq.true", { metoda: "PATCH", corp: { setari: { ...s, external_url: false } } });
  },
  faraCurier: async (categorieOlx) => {
    const s = (await rest("olx_cont?unic=eq.true&select=setari"))[0]?.setari ?? {};
    const lista = [...new Set([...(s.fara_curier ?? []), Number(categorieOlx)])];
    await rest("olx_cont?unic=eq.true", { metoda: "PATCH", corp: { setari: { ...s, fara_curier: lista } } });
    if (ctx) ctx.setari = { ...ctx.setari, fara_curier: lista }; // restul pieselor din categorie pleacă direct fără curier
  },
};

/** Contextul generatorului — geamănul lui `contextAnunt` din lib/olx.ts. */
async function context() {
  const m = await rest("olx_mapari?select=categorie_id,olx_categorie_id,atribute");
  const ids = [...new Set([...m.map((r) => r.olx_categorie_id), ...REGULI_TITLU.map((r) => r.olx_categorie_id)])];
  const cats = await rest(`olx_categorii?select=id,cale,nume,photos_limit,atribute&id=in.(${ids.join(",")})`);
  const setari = (await rest("olx_cont?unic=eq.true&select=setari"))[0]?.setari ?? {};
  return { mapari: new Map(m.map((r) => [Number(r.categorie_id), r])),
    categoriiOlx: new Map(cats.map((r) => [Number(r.id), { ...r, cale: r.cale ?? r.nume }])), setari, siteUrl: SITE, poza };
}

let ctx = null;
const piese = await citesteTotRest(url, antete, `products?select=${COLOANE}&publicat=eq.true&stoc=gt.0&order=id`, { eticheta: "piese" });
// Anunțurile CREATE DE APLICAȚIE (`olx_anunturi`). Cele vechi, puse de mână pe cont, nu se citesc
// deloc: orice piesă de pe site primește anunț nou. Se sare doar peste piesele cu anunț viu
// (nou / activ / de plătit / în moderare); cele dezactivate sau expirate se ACTIVEAZĂ la loc
// (cerut de proprietar, 13 noiembrie 2026) — fără pachet, OLX le trece și pe ele la „de plătit”.
const DE_REACTIVAT = ["removed_by_user", "outdated"];
const existente = await citesteTotRest(url, antete, "olx_anunturi?select=product_id,advert_id,status&advert_id=not.is.null&order=id", { eticheta: "anunțuri" });
const viu = new Set(existente.filter((r) => !DE_REACTIVAT.includes(r.status)).map((r) => r.product_id));
const reactivat = new Set(existente.filter((r) => DE_REACTIVAT.includes(r.status)).map((r) => r.product_id));
const deFacut = piese.filter((p) => !viu.has(p.id)).slice(0, LIMITA);
console.log(`${acum()} ${piese.length} piese publicate cu stoc; ${viu.size} au deja anunț viu; de trimis acum: ${deFacut.length}` +
  ` (din care ${deFacut.filter((p) => reactivat.has(p.id)).length} de reactivat)${USCAT ? " (USCAT — nu se trimite nimic)" : ""}.`);
if (USCAT) process.exit(0);

ctx = await context();
const stari = {}; let ok = 0, erori = 0, laRand = 0, blocari = 0, i = 0;
for (const p of deFacut) {
  i++;
  if (i % 200 === 0) ctx = await context(); // potrivirile / setările se pot schimba din admin între timp
  try {
    const r = reactivat.has(p.id)
      ? await comanda({ productId: p.id, comanda: "activate", client, depozit })
      : await publica({ piesa: p, ctx, client, depozit });
    ok++; laRand = 0; blocari = 0;
    stari[r.status ?? "?"] = (stari[r.status ?? "?"] ?? 0) + 1;
  } catch (e) {
    const msg = String(e?.message ?? e);
    if (e?.status === 403 && /request blocked|could not be satisfied/i.test(msg)) {
      blocari++;
      if (blocari > 6) { console.log(`${acum()} OLX blochează în continuare (403) — mă opresc. Reia cu aceeași comandă.`); break; }
      console.log(`${acum()} 403 de la OLX (blocare temporară) la ${p.cod_intern} — aștept 10 minute (${blocari}/6).`);
      await asteapta(10 * 60_000);
      continue; // piesa rămâne fără advert_id → o ia o rulare viitoare; ordinea nu contează
    }
    erori++; laRand++;
    console.log(`${acum()} ✗ ${p.cod_intern}: ${msg.slice(0, 200)}`);
    if (laRand >= 10) { console.log(`${acum()} 10 erori la rând — mă opresc.`); break; }
  }
  if (i % 50 === 0) console.log(`${acum()} ${i}/${deFacut.length} · trimise ${ok} · erori ${erori} · ${JSON.stringify(stari)}`);
  await asteapta(PAUZA_MS);
}
console.log(`${acum()} GATA: ${i}/${deFacut.length} încercate · trimise ${ok} · erori ${erori} · stări ${JSON.stringify(stari)}`);
