// ============================================================
// MOTORUL — ce se face, în ce ordine, și când se oprește un lot.
//
// DE CE LOTURI (același motiv ca la importul din pieseauto.ro)
// 8.700 de anunțuri × o pauză politicoasă ≈ ore. O funcție pe Vercel trăiește
// 60 de secunde. Deci lucrul se taie în felii: fiecare cerere de la browser face
// cât apucă în bugetul ei, scrie unde a rămas, și se întoarce. Tabul închis nu
// pierde nimic — poziția stă în `dezro_jobs`, nu în pagină.
//
// INVARIANTUL UNUI LOT
//   BUGET_MS + cea mai lungă cerere ≤ LIMITA_LOT_MS ≤ 55s
//   20.000    +  30.000 (TIMEOUT_MS)                = 50.000  ✓
// Bugetul se verifică ÎNAINTE de fiecare piesă, deci un lot poate începe una
// chiar la limită. Termenul absolut (`pana`) e ce garantează că nici acea ultimă
// piesă nu trece de limită: `cere()` nu începe o încercare care n-ar apuca să se
// termine. `scripts/verifica-dezro.mjs` verifică suma.
//
// CE FACE UN LOT DE PUBLICARE, pentru fiecare piesă:
//   · construiește câmpurile (lib/dezro/anunt.mjs)
//   · dacă n-are anunț  -> îl creează, cu pozele
//   · dacă are          -> compară amprenta; egală și fără poze schimbate =>
//                          NU se atinge nimic
//   · dacă piesa nu poate fi publicată (fără poză, fără mapare) => se sare,
//     motivul se numără; nu e eroare, e ceva de completat
//
// FAZA DE RETRAGERE vine după ce s-au parcurs toate piesele. Un anunț al cărui
// produs nu mai e publicat sau are stoc 0 se ȘTERGE la ei. Ăsta e capătul care
// contează cel mai mult: un anunț rămas pentru o piesă vândută înseamnă un
// telefon degeaba și un cumpărător nemulțumit, iar piesele noastre sunt unicat.
// ============================================================

import {
  creeazaSesiune, creeazaAnunt, actualizeazaAnunt, stergeAnunt, stergePoza,
  marci, modele, categoriiRadacina, categoriiCopii, TIP, PAUZA_MS,
  EroareDezro,
} from "./api.mjs";
import { construieste, diferentaPoze, aducePoza, MOTIVE } from "./anunt.mjs";
import {
  potrivesteMarca, potrivesteModel, potrivesteCategorie, PRAG_SIGUR,
} from "./potrivire.mjs";

/** Cât lucrează un lot înainte să se întoarcă la browser. */
export const BUGET_MS = 20_000;
/** Termenul absolut al lotului. Peste el nu se mai începe nicio cerere. */
export const LIMITA_LOT_MS = 50_000;
/** Cât poate dura aducerea pozelor unei singure piese. Opt poze lente s-ar
 *  înmulți, iar o piesă neterminată nu avansează poziția — publicarea s-ar
 *  bloca pe ea la infinit. Aceeași grijă ca la `BUGET_POZE_MS` din import. */
export const BUGET_POZE_MS = 12_000;
/** Câte piese cere un lot din bază deodată. Mai multe n-ar apuca oricum. */
export const LOT_PIESE = 25;

/** Peste procentul ăsta de retrageri, motorul cere confirmare separată.
 *  Aceeași plasă ca `PRAG_DEPUBLICARE` de la import, și pentru același gen de
 *  accident: o citire incompletă sau o depublicare în masă la noi ar stinge tot
 *  ce avem la ei, iar la ei ștergerea nu se poate desface prin API. */
export const PRAG_RETRAGERE = 0.2;

const acum = () => Date.now();

// ------------------------------------------------------------
// 1. SINCRONIZAREA CATALOGULUI LOR
//
// Se face în UNITĂȚI, fiindcă arborele întreg într-o cerere pică cu 504 la ei
// (vezi antetul din api.mjs). Unitatea 0 aduce mărcile și categoriile-rădăcină;
// de acolo încolo se știe exact câte unități mai sunt, iar `pozitie` din job e
// numărul de unități terminate.
// ------------------------------------------------------------

/** Câte unități are sincronizarea, odată ce unitatea 0 s-a făcut. */
export function unitatiCatalog(catalog) {
  const nrMarci = catalog.filter((c) => c.fel === "marca").length;
  const nrRadacini = catalog.filter((c) => c.fel === "piesa" && c.parinte === null).length;
  return 1 + nrMarci + nrRadacini;
}

export async function lotCatalog({ cfg, depozit, job }) {
  const pana = acum() + LIMITA_LOT_MS;
  const limita = acum() + BUGET_MS;
  const jurnal = [];
  let pozitie = job.pozitie ?? 0;
  let aduse = 0;

  // ---------- unitatea 0: mărcile și categoriile-rădăcină ----------
  if (pozitie === 0) {
    const m = (await marci(cfg, TIP, { pana })).map((x) => ({ ...x, fel: "marca", tip: TIP }));
    const r = (await categoriiRadacina(cfg, TIP, { pana })).map((x) => ({ ...x, fel: "piesa", tip: TIP }));
    await depozit.scrieCatalog([...m, ...r]);
    aduse += m.length + r.length;
    pozitie = 1;
    jurnal.push(`${m.length} mărci și ${r.length} grupe de categorii`);
  }

  const catalog = await depozit.citesteCatalog();
  const marciSalvate = catalog.filter((c) => c.fel === "marca").sort((a, b) => a.dezro_id - b.dezro_id);
  const radacini = catalog.filter((c) => c.fel === "piesa" && c.parinte === null).sort((a, b) => a.dezro_id - b.dezro_id);
  const total = 1 + marciSalvate.length + radacini.length;

  // ---------- unitățile 1..N: modelele fiecărei mărci ----------
  while (pozitie - 1 < marciSalvate.length && acum() < limita) {
    const marca = marciSalvate[pozitie - 1];
    const lista = await modele(cfg, marca.dezro_id, TIP, { pana });
    await depozit.scrieCatalog(lista.map((x) => ({ ...x, fel: "model", tip: TIP })));
    aduse += lista.length;
    pozitie++;
  }

  // ---------- unitățile N+1..: subarborele fiecărei grupe ----------
  while (pozitie - 1 - marciSalvate.length < radacini.length && acum() < limita) {
    const grupa = radacini[pozitie - 1 - marciSalvate.length];
    const lista = await categoriiCopii(cfg, grupa.dezro_id, TIP, { pana });
    await depozit.scrieCatalog(lista.map((x) => ({ ...x, fel: "piesa", tip: TIP })));
    aduse += lista.length;
    pozitie++;
  }

  return { pozitie, total, aduse, gata: pozitie >= total, jurnal };
}

// ------------------------------------------------------------
// 2. POTRIVIREA AUTOMATĂ
//
// Nu atinge niciodată o mapare pusă de om (`sursa = 'om'`) — nici măcar una
// negativă („s-a decis că n-are corespondent"). Altfel fiecare resincronizare ar
// șterge munca de verificare.
//
// Peste PRAG_SIGUR maparea se scrie. Sub el se întoarce ca PROPUNERE, pentru
// ecranul de potriviri, dar nu se scrie: „Range Rover Evoque" seamănă destul cu
// „Range Rover" ca să treacă neobservat, și sunt două mașini.
// ------------------------------------------------------------
export async function potrivesteTot({ depozit, autor = null }) {
  const [catalog, mapariVechi, nostru] = await Promise.all([
    depozit.citesteCatalog(),
    depozit.citesteMapari(),
    depozit.citesteTaxonomiaNoastra(),
  ]);

  const omDecis = new Set(
    mapariVechi.filter((m) => m.sursa === "om").map((m) => `${m.fel}:${m.local_id}`),
  );
  const marciLor = catalog.filter((c) => c.fel === "marca");
  const modeleLor = catalog.filter((c) => c.fel === "model");
  const modeleLorPeMarca = new Map();
  for (const m of modeleLor) {
    if (!modeleLorPeMarca.has(m.parinte)) modeleLorPeMarca.set(m.parinte, []);
    modeleLorPeMarca.get(m.parinte).push(m);
  }
  const categoriiLor = catalog.filter((c) => c.fel === "piesa");
  const categoriiNoastre = new Map(nostru.categories.map((c) => [c.id, c]));

  const deScris = [];
  const propuneri = [];

  // --- mărci ---
  const marcaPentru = new Map();
  for (const b of nostru.brands) {
    const p = potrivesteMarca(b.nume, marciLor);
    if (p) marcaPentru.set(b.id, p.dezro_id);
    if (omDecis.has(`marca:${b.id}`)) continue;
    if (p && p.scor >= PRAG_SIGUR) deScris.push({ fel: "marca", local_id: b.id, dezro_id: p.dezro_id, sursa: "auto", scor: p.scor });
    else propuneri.push({ fel: "marca", local_id: b.id, nume: b.nume, candidat: p ?? null });
  }
  // O marcă pusă de om înlocuiește propunerea automată la restrângerea modelelor.
  for (const m of mapariVechi) if (m.fel === "marca" && m.sursa === "om" && m.dezro_id) marcaPentru.set(m.local_id, m.dezro_id);

  // --- modele ---
  for (const mo of nostru.models) {
    const idMarcaLor = marcaPentru.get(mo.brand_id);
    const candidati = idMarcaLor ? (modeleLorPeMarca.get(idMarcaLor) ?? []) : [];
    const p = candidati.length ? potrivesteModel(mo.nume, candidati) : null;
    if (omDecis.has(`model:${mo.id}`)) continue;
    if (p && p.scor >= PRAG_SIGUR) deScris.push({ fel: "model", local_id: mo.id, dezro_id: p.dezro_id, sursa: "auto", scor: p.scor });
    else propuneri.push({ fel: "model", local_id: mo.id, nume: mo.nume, candidat: p ?? null });
  }

  // --- categorii ---
  for (const c of nostru.categories) {
    const parinte = c.parent_id ? categoriiNoastre.get(c.parent_id) : null;
    const lista = potrivesteCategorie(
      { slug: c.slug, nume: c.nume, numeParinte: parinte?.nume ?? null },
      categoriiLor,
      3,
    );
    const p = lista[0] ?? null;
    if (omDecis.has(`categorie:${c.id}`)) continue;
    if (p && p.scor >= PRAG_SIGUR)
      deScris.push({
        fel: "categorie", local_id: c.id, dezro_id: p.dezro_id, sursa: "auto", scor: p.scor,
        nota: p.regula ? "traducere aprobată" : null,
      });
    else propuneri.push({ fel: "categorie", local_id: c.id, nume: c.nume, candidat: p ?? null });
  }

  if (deScris.length) await depozit.scrieMapari(deScris, autor);
  return { scrise: deScris.length, deConfirmat: propuneri.length, propuneri };
}

// ------------------------------------------------------------
// 3. CONTEXTUL DE PUBLICARE — hărțile citite o dată pe lot
// ------------------------------------------------------------
export async function contextPublicare(depozit) {
  const [catalog, mapari, nostru] = await Promise.all([
    depozit.citesteCatalog(),
    depozit.citesteMapari(),
    depozit.citesteTaxonomiaNoastra(),
  ]);
  return {
    catalogDupaId: new Map(catalog.map((c) => [`${c.fel === "piesa" ? "piesa" : c.fel}:${c.dezro_id}`, c])),
    mapariModele: new Map(mapari.filter((m) => m.fel === "model" && m.dezro_id).map((m) => [m.local_id, m.dezro_id])),
    mapariCategorii: new Map(mapari.filter((m) => m.fel === "categorie" && m.dezro_id).map((m) => [m.local_id, m.dezro_id])),
    modeleNoastre: new Map(nostru.models.map((m) => [m.id, m])),
    marciNoastre: new Map(nostru.brands.map((b) => [b.id, b])),
  };
}

// ------------------------------------------------------------
// 4. O SINGURĂ PIESĂ
// ------------------------------------------------------------
async function publicaPiesa({ sesiune, depozit, piesa, anunt, context, pana, timeout }) {
  const c = construieste(piesa, context);
  if (!c.ok) return { fel: "sarita", motiv: c.motiv };

  // Nimic schimbat: nici câmpuri, nici poze. Cel mai frecvent caz la o
  // resincronizare, și singurul care nu costă nicio cerere către ei.
  const poze = diferentaPoze(piesa.poze, anunt?.poze_trimise, anunt?.poze_dezro);
  const neatins = anunt && anunt.status === "activ" && anunt.amprenta === c.amprenta
    && !poze.deAdaugat.length && !poze.deSters.length;
  if (neatins) return { fel: "neschimbata" };

  // Pozele se aduc de la noi din Storage, cu buget propriu.
  const limitaPoze = acum() + BUGET_POZE_MS;
  const fisiere = [];
  for (const u of poze.deAdaugat) {
    if (acum() > limitaPoze) break;
    const f = await aducePoza(u);
    if (f) fisiere.push(f);
  }

  // ---------- anunț nou ----------
  if (!anunt?.ad_id || anunt.status === "retras") {
    const raspuns = await creeazaAnunt(sesiune, c.campuri, fisiere, { pana, timeout });
    await depozit.scrieAnunt(piesa.id, {
      ad_id: raspuns?.id ?? null,
      alias: raspuns?.alias ?? null,
      url: raspuns?.url ?? null,
      aprobat: raspuns?.approved ?? null,
      status: raspuns?.id ? "activ" : "eroare",
      amprenta: c.amprenta,
      poze_trimise: fisiere.map((f) => f.url),
      poze_dezro: raspuns?.images ?? [],
      eroare: raspuns?.id ? null : "dez.ro n-a întors id-ul anunțului",
      incercari: 0,
      trimis_la: new Date().toISOString(),
      retras_la: null,
    });
    return { fel: "publicata", poze: fisiere.length, url: raspuns?.url ?? null };
  }

  // Pozele n-au putut fi aduse de la noi din Storage (adresă moartă, Storage
  // căzut) și în rest nu s-a schimbat nimic. O actualizare fără câmpuri și fără
  // fișiere e, după ghidul lor, un „no-op" — deci ar fi o cerere plătită degeaba
  // la fiecare rulare. Se raportează ca neschimbată; pozele se vor reîncerca
  // singure data viitoare.
  if (anunt?.ad_id && anunt.status === "activ" && anunt.amprenta === c.amprenta
      && !fisiere.length && !poze.deSters.length) {
    return { fel: "neschimbata" };
  }

  // ---------- anunț existent ----------
  for (const p of poze.deSters) {
    await stergePoza(sesiune, anunt.ad_id, p.id, { pana, timeout });
  }
  const doarCampuri = anunt.amprenta !== c.amprenta;
  const raspuns = await actualizeazaAnunt(
    sesiune, anunt.ad_id, doarCampuri ? c.campuri : {}, fisiere, { pana, timeout },
  );
  const ramase = (anunt.poze_trimise ?? []).filter((u) => !poze.deSters.some((x) => x.url === u));
  await depozit.scrieAnunt(piesa.id, {
    alias: raspuns?.alias ?? anunt.alias,
    url: raspuns?.url ?? anunt.url,
    aprobat: raspuns?.approved ?? anunt.aprobat,
    status: "activ",
    amprenta: c.amprenta,
    poze_trimise: [...ramase, ...fisiere.map((f) => f.url)],
    poze_dezro: raspuns?.images ?? anunt.poze_dezro,
    eroare: null,
    incercari: 0,
    trimis_la: new Date().toISOString(),
  });
  return { fel: "actualizata", poze: fisiere.length };
}

// ------------------------------------------------------------
// 5. UN LOT DE PUBLICARE
// ------------------------------------------------------------
/**
 * Un lot de publicare.
 *
 * `opresteDupaUna` e pentru butonul „Publică o piesă de probă": se parcurge
 * lista până când CHIAR se publică ceva (piesele nepublicabile se sar, ca de
 * obicei) și se oprește acolo. Proba trece prin exact același drum ca publicarea
 * adevărată — altfel n-ar dovedi nimic despre ea.
 */
export async function lotPublicare({
  cfg, depozit, sesiune, job, context, opresteDupaUna = false,
  limitaMs = LIMITA_LOT_MS, bugetMs = BUGET_MS, timeout = undefined, filtrePiese = "",
  maxPiese = LOT_PIESE,
}) {
  const pana = acum() + limitaMs;
  const limita = acum() + bugetMs;
  const rez = {
    procesate: 0, publicate: 0, actualizate: 0, neschimbate: 0, sarite: 0,
    poze: 0, erori: [], motive: {}, pozitie: job.pozitie ?? 0, gata: false, oprit: null,
    // Se declară de la început, ca forma obiectului să fie aceeași pe toate
    // drumurile — altfel TypeScript, care deduce tipul din fișierul ăsta, nu l-ar
    // vedea la cei care îl citesc.
    proba: null,
  };

  const piese = await depozit.pieseEligibile(rez.pozitie, Math.max(1, maxPiese), filtrePiese);
  if (!piese.length) { rez.gata = true; return rez; }

  const anunturi = await depozit.citesteAnunturiPentru(piese.map((p) => p.id));

  for (const piesa of piese) {
    if (acum() > limita) break;
    try {
      const r = await publicaPiesa({
        sesiune, depozit, piesa, anunt: anunturi.get(piesa.id) ?? null, context, pana, timeout,
      });
      if (r.fel === "publicata") { rez.publicate++; rez.poze += r.poze ?? 0; }
      else if (r.fel === "actualizata") { rez.actualizate++; rez.poze += r.poze ?? 0; }
      else if (r.fel === "neschimbata") rez.neschimbate++;
      else { rez.sarite++; rez.motive[r.motiv] = (rez.motive[r.motiv] ?? 0) + 1; }
      if (opresteDupaUna && (r.fel === "publicata" || r.fel === "actualizata")) {
        rez.procesate++;
        rez.pozitie = piesa.id;
        rez.proba = { id: piesa.id, cod: piesa.cod_intern, nume: piesa.nume, fel: r.fel, url: r.url ?? null };
        return rez;
      }
    } catch (e) {
      // ATENȚIE: un timeout NU înseamnă că n-a intrat nimic la ei. Măsurat la
      // 7 septembrie 2026: o actualizare a expirat de partea noastră după 30 de
      // secunde, dar anunțul citit după aceea AVEA schimbarea. API-ul lor poate
      // ține un minut și jumătate pe o cerere.
      // De asta rândul rămâne cu amprenta VECHE: la rularea următoare se
      // retrimite, iar retrimiterea e inofensivă — `POST /ads/{id}` scrie
      // aceleași valori peste ele însele. Alternativa (să presupunem că a
      // reușit) ar lăsa tăcut anunțuri neactualizate.
      const mesaj = e?.message ?? String(e);
      rez.erori.push({ id: piesa.id, cod: piesa.cod_intern, eroare: mesaj.slice(0, 300) });
      const vechi = anunturi.get(piesa.id);
      await depozit.scrieAnunt(piesa.id, {
        status: "eroare",
        eroare: mesaj.slice(0, 300),
        incercari: (vechi?.incercari ?? 0) + 1,
      }).catch(() => null);

      // O sesiune refuzată și după reînnoire, sau o limitare de la ei, nu se
      // repară cu piesa următoare: se oprește lotul, cu motivul la vedere.
      // Aceeași regulă ca `oprit = "refuz"` din motorul de import.
      if (e instanceof EroareDezro && (e.stare === 401 || e.stare === 403 || e.stare === 429)) {
        rez.oprit = mesaj;
        break;
      }
    }
    rez.procesate++;
    rez.pozitie = piesa.id;
  }

  return rez;
}

// ------------------------------------------------------------
// 6. UN LOT DE RETRAGERE
//
// Se face DUPĂ ce s-au parcurs toate piesele. Nu are voie să înceapă mai devreme:
// până atunci nu știm câte anunțuri rămân active, deci n-am putea judeca pragul.
// ------------------------------------------------------------
export async function lotRetragere({
  depozit, sesiune, job, limitaMs = LIMITA_LOT_MS, bugetMs = BUGET_MS, timeout = undefined,
}) {
  const pana = acum() + limitaMs;
  const limita = acum() + bugetMs;
  const rez = { procesate: 0, retrase: 0, erori: [], pozitie: job.pozitie ?? 0, gata: false, oprit: null };

  const randuri = await depozit.anunturiDeRetras(rez.pozitie, LOT_PIESE);
  if (!randuri.length) { rez.gata = true; return rez; }

  for (const a of randuri) {
    if (acum() > limita) break;
    rez.pozitie = a.product_id;
    rez.procesate++;
    if (!a.deRetras) continue;
    try {
      await stergeAnunt(sesiune, a.ad_id, { pana, timeout });
      await depozit.scrieAnunt(a.product_id, {
        status: "retras", retras_la: new Date().toISOString(), eroare: null,
      });
      rez.retrase++;
    } catch (e) {
      const mesaj = e?.message ?? String(e);
      // 404 la ei = anunțul nu mai există (l-a șters un admin, sau noi, înainte).
      // Nu e eroare: rezultatul dorit e deja obținut.
      if (e instanceof EroareDezro && e.stare === 404) {
        await depozit.scrieAnunt(a.product_id, {
          status: "retras", retras_la: new Date().toISOString(),
          eroare: "nu mai exista la ei",
        });
        rez.retrase++;
        continue;
      }
      rez.erori.push({ id: a.product_id, eroare: mesaj.slice(0, 300) });
      if (e instanceof EroareDezro && (e.stare === 401 || e.stare === 403 || e.stare === 429)) {
        rez.oprit = mesaj;
        break;
      }
    }
  }
  return rez;
}

// ------------------------------------------------------------
// 7. REÎMPROSPĂTAREA STĂRII DE APROBARE
//
// DE CE EXISTĂ (măsurat la primul anunț real, 7 septembrie 2026)
// Ghidul lor spune de trei ori că anunțurile trimise prin API sunt publicate pe
// loc: „approved is always true for API-created ads", „The ad is immediately
// visible on the site", „For API-created ads pending should always be 0".
// Nu e adevărat. Primul anunț trimis s-a întors cu `approved: false`, `url:
// null`, iar `GET /ads?count` a răspuns `{total:1, approved:0, pending:1}`.
// Anunțurile trec printr-o aprobare la ei.
//
// Consecința practică: adresa publică a anunțului (`url`) NU există în clipa
// creării. Vine abia după aprobare, iar noi n-avem de unde s-o aflăm decât
// cerând din nou lista. De asta există lotul ăsta: parcurge paginile lor (10
// anunțuri pe pagină) și scrie înapoi `aprobat` și `url` pe rândurile noastre.
//
// Se merge pe PAGINILE LOR, nu pe piesele noastre: o cerere aduce 10 anunțuri,
// pe când o verificare piesă cu piesă ar însemna o cerere pentru fiecare.
// ------------------------------------------------------------
export async function lotImprospatare({ depozit, sesiune, pagina = 1 }) {
  const pana = acum() + LIMITA_LOT_MS;
  const limita = acum() + BUGET_MS;
  const rez = { pagina, actualizate: 0, aprobate: 0, inAsteptare: 0, gata: false };

  while (acum() < limita) {
    const d = await sesiune.cere(`/ads?page=${rez.pagina}`, { pana });
    const lista = d?.ads ?? [];
    for (const a of lista) {
      if (a.approved) rez.aprobate++; else rez.inAsteptare++;
      await depozit.scrieAnuntDupaAdId(a.id, {
        aprobat: a.approved === true,
        url: a.url ?? null,
        alias: a.alias ?? null,
      });
      rez.actualizate++;
    }
    if (!d?.pagination?.has_more || !lista.length) { rez.gata = true; break; }
    rez.pagina++;
  }
  return rez;
}

/** Sesiunea, cu token-ul memorat în `settings.integrari.dezro`. Fără memorare
 *  ne-am autentifica la fiecare lot, iar ei limitează autentificările. */
export function sesiuneDin(cfg, depozit) {
  return creeazaSesiune(cfg, {
    token: cfg.token ?? null,
    expira: cfg.token_expira ?? null,
    salveaza: async ({ token, expira }) => {
      await depozit.salveazaConfig({ token, token_expira: expira });
    },
  });
}

// MOTIVE și PAUZA_MS NU se re-exportă de aici: `index.mjs` face `export *` din
// toate modulele, iar un nume exportat din două locuri devine ambiguu și dispare
// tăcut din pachet. Cine are nevoie de ele le ia din `anunt.mjs`, respectiv
// `api.mjs`, unde sunt definite.
