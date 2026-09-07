// ============================================================
// PUBLICAREA PE dez.ro, PORNITĂ DIN ADMIN — /api/dezro
//
// Ruta nu conține nicio regulă despre dez.ro: toate stau în `lib/dezro/`,
// împărțite cu scriptul din terminal (vezi lib/dezro/README.md). Aici e doar
// orchestrarea: cine are voie, ce se cheamă, unde se scrie progresul.
//
// DE CE E TOTUL PE SERVER
// Cheia API, utilizatorul și parola de dez.ro stau în `settings.integrari`, care
// nu e citibil public. Ruta rulează cu cheia de service, deci trece peste RLS —
// exact de aceea prima linie a fiecărei acțiuni verifică `esteEchipa()`, ca la
// ruta de AWB și la cea de e-mail.
//
// Acțiuni (toate POST, cu `actiune` în corp):
//   stare            — ce știm: configurare, cifre, jobul activ, ultimele joburi
//   test             — se autentifică și cere numărul de anunțuri. Nu scrie nimic la ei.
//   catalog          — pornește (sau continuă) aducerea catalogului lor
//   potriveste       — rulează potrivirea automată și întoarce ce a rămas de confirmat
//   propuneri        — lista pentru ecranul de potriviri, cu alternative
//   salveaza-mapare  — decizia omului (sursa = 'om')
//   proba            — publică O SINGURĂ piesă, ca să se vadă rezultatul la ei
//   improspateaza    — recitește lista lor și scrie înapoi `aprobat` și adresa publică
//   start            — creează jobul de publicare
//   lot              — următoarea felie
//   pauza/reia/anuleaza
// ============================================================
import { NextResponse } from "next/server";
import { esteEchipa } from "@/lib/supabase";
import {
  depozitDinMediu, sesiuneDin, lotCatalog, lotPublicare, lotRetragere, lotImprospatare,
  potrivesteTot, contextPublicare, potrivesteCategorie, potrivesteModel, potrivesteMarca,
  caleaCategoriei, numaraAnunturi, PRAG_RETRAGERE, PRAG_SIGUR,
} from "@/lib/dezro/index.mjs";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Câte erori ținem în jurnalul jobului. Peste atât numărul rămâne exact, dar
 *  lista se oprește — la fel ca la import. */
const MAX_ERORI_PASTRATE = 300;

const raspuns = (date: any, stare = 200) => NextResponse.json(date, { status: stare });
const eroare = (mesaj: string, stare = 400) => raspuns({ ok: false, eroare: mesaj }, stare);

export async function POST(req: Request) {
  if (!(await esteEchipa(req))) return eroare("Doar echipa poate lucra cu dez.ro.", 401);

  let depozit: any;
  try { depozit = depozitDinMediu(); }
  catch (e: any) { return eroare(e.message, 500); }

  const corp = (await req.json().catch(() => ({}))) as any;
  const actiune = corp?.actiune;

  try {
    switch (actiune) {
      case "stare":           return await stare(depozit);
      case "test":            return await test(depozit);
      case "catalog":         return await catalog(depozit);
      case "potriveste":      return await potriveste(depozit, corp);
      case "propuneri":       return await propuneri(depozit, corp);
      case "salveaza-mapare": return await salveazaMapare(depozit, corp);
      case "proba":           return await proba(depozit, corp);
      case "improspateaza":   return await improspateaza(depozit, corp);
      case "start":           return await start(depozit, corp);
      case "lot":             return await lot(depozit, corp);
      case "pauza":           return await comanda(depozit, corp, "in_pauza", "Oprit de operator.");
      case "reia":            return await comanda(depozit, corp, "in_curs", null);
      case "anuleaza":        return await comanda(depozit, corp, "oprit", "Anulat de operator.");
      default:                return eroare("Acțiune necunoscută.");
    }
  } catch (e: any) {
    console.error("[dezro]", actiune, e);
    return eroare(e?.message ?? "Eroare neașteptată.", 500);
  }
}

/** Configurarea, fără secrete. Nimic din ce se întoarce aici nu trebuie să
 *  poată fi folosit ca să publice cineva în numele nostru. */
async function config(depozit: any) {
  const c = await depozit.citesteConfig();
  return {
    cfg: c,
    public: {
      areCheie: !!c.cheie,
      areCont: !!(c.utilizator && c.parola),
      utilizator: c.utilizator ?? "",
      activ: c.activ === true,
      sesiuneValabila: !!(c.token && c.token_expira && new Date(c.token_expira) > new Date()),
      sesiuneExpira: c.token_expira ?? null,
    },
  };
}

// ------------------------------------------------------------
// STARE
// ------------------------------------------------------------
async function stare(depozit: any) {
  const { public: pub } = await config(depozit);
  // Toate cifrele se numără ÎN BAZĂ. Varianta evidentă — `citesteCatalog()` și
  // `citesteMapari()`, apoi `.filter().length` — ar căra 2.700 de noduri de
  // catalog și 900 de mapări prin rețea la fiecare deschidere a ecranului, ca să
  // afișeze șase numere.
  const zero = () => 0;
  const [cifre, retrageri, cMarci, cModele, cCategorii, mMarci, mModele, mCategorii, deConfirmat, job, istoric] =
    await Promise.all([
      depozit.stare().catch(() => null),
      depozit.pragRetragere().catch(() => null),
      depozit.numaraRanduri("dezro_catalog", { fel: "eq.marca" }).catch(zero),
      depozit.numaraRanduri("dezro_catalog", { fel: "eq.model" }).catch(zero),
      depozit.numaraRanduri("dezro_catalog", { fel: "eq.piesa" }).catch(zero),
      depozit.numaraRanduri("dezro_mapari", { fel: "eq.marca", dezro_id: "not.is.null" }).catch(zero),
      depozit.numaraRanduri("dezro_mapari", { fel: "eq.model", dezro_id: "not.is.null" }).catch(zero),
      depozit.numaraRanduri("dezro_mapari", { fel: "eq.categorie", dezro_id: "not.is.null" }).catch(zero),
      depozit.numaraRanduri("dezro_mapari", { sursa: "eq.auto", scor: `lt.${PRAG_SIGUR}` }).catch(zero),
      depozit.jobActiv(),
      depozit.jobUltimele(8),
    ]);

  // Cifrele LOR, dintr-o singură cerere. Sunt singurul loc din care se vede câte
  // anunțuri sunt cu adevărat live: la noi „activ" înseamnă doar „trimis".
  let laEi = null;
  if (pub.areCheie && pub.areCont) {
    try {
      const c = await depozit.citesteConfig();
      laEi = await numaraAnunturi(sesiuneDin(c, depozit));
    } catch { laEi = null; }
  }

  return raspuns({
    ok: true,
    config: pub,
    laEi,
    cifre,
    retrageri,
    catalog: { marci: cMarci, modele: cModele, categorii: cCategorii },
    mapari: { marci: mMarci, modele: mModele, categorii: mCategorii, deConfirmat },
    job,
    istoric,
  });
}

// ------------------------------------------------------------
// TEST — se autentifică și întreabă câte anunțuri avem. Nu scrie nimic la ei.
// ------------------------------------------------------------
async function test(depozit: any) {
  const { cfg } = await config(depozit);
  if (!cfg.cheie) return eroare("Lipsește cheia API dez.ro (Admin → Integrări).");
  if (!cfg.utilizator || !cfg.parola) return eroare("Lipsesc utilizatorul și parola contului dez.ro (Admin → Integrări).");

  const sesiune = sesiuneDin(cfg, depozit);
  const counts = await numaraAnunturi(sesiune);
  return raspuns({
    ok: true,
    mesaj: `Conectat. La dez.ro sunt ${counts.total} anunțuri pe contul „${cfg.utilizator}" (${counts.approved} publicate, ${counts.pending} în așteptare).`,
    counts,
  });
}

// ------------------------------------------------------------
// CATALOG — o felie din aducerea catalogului lor
// ------------------------------------------------------------
async function catalog(depozit: any) {
  const { cfg } = await config(depozit);
  if (!cfg.cheie) return eroare("Lipsește cheia API dez.ro (Admin → Integrări).");

  let job = await depozit.jobActiv();
  if (job && job.actiune !== "catalog")
    return eroare(`Există deja o publicare în lucru (#${job.id}). Termin-o sau anuleaz-o întâi.`, 409);

  if (!job) {
    const acumIso = new Date().toISOString();
    job = await depozit.jobNou({
      actiune: "catalog", status: "in_curs", faza: "catalog", pozitie: 0,
      jurnal: [{ la: acumIso, text: "Aducerea catalogului dez.ro a pornit" }],
      inceput_la: acumIso, actualizat_la: acumIso,
    });
  }

  const r = await lotCatalog({ cfg, depozit, job });
  const jurnal = [...(job.jurnal ?? []), ...r.jurnal.map((t: string) => ({ la: new Date().toISOString(), text: t }))];
  const patch: any = {
    pozitie: r.pozitie, total: r.total, procesate: r.pozitie, jurnal,
  };
  if (r.gata) {
    patch.status = "gata";
    patch.faza = "gata";
    patch.terminat_la = new Date().toISOString();
    const c = await depozit.citesteCatalog();
    patch.jurnal = [...jurnal, {
      la: patch.terminat_la,
      text: `Catalog adus: ${c.filter((x: any) => x.fel === "marca").length} mărci, ` +
            `${c.filter((x: any) => x.fel === "model").length} modele, ` +
            `${c.filter((x: any) => x.fel === "piesa").length} categorii`,
    }];
  }
  const nou = await depozit.jobActualizeaza(job.id, patch);
  return raspuns({ ok: true, job: nou, gata: r.gata });
}

// ------------------------------------------------------------
// POTRIVIRE
// ------------------------------------------------------------
async function potriveste(depozit: any, corp: any) {
  const catalogRanduri = await depozit.citesteCatalog();
  if (!catalogRanduri.length)
    return eroare("Catalogul dez.ro n-a fost adus încă. Apasă întâi „Adu catalogul dez.ro”.");
  const r = await potrivesteTot({ depozit, autor: corp?.autor ?? null });
  return raspuns({ ok: true, scrise: r.scrise, deConfirmat: r.deConfirmat });
}

/**
 * Lista pentru ecranul de potriviri.
 *
 * Se întorc DOAR rândurile care au nevoie de om: fără mapare, sau cu una
 * automată nesigură. Cele 373 de modele identice la literă n-au ce căuta într-o
 * listă de verificat — ar îneca exact cazurile care contează.
 */
async function propuneri(depozit: any, corp: any) {
  const fel = String(corp?.fel ?? "categorie");
  const [catalogRanduri, mapari, nostru] = await Promise.all([
    depozit.citesteCatalog(),
    depozit.citesteMapari(fel),
    depozit.citesteTaxonomiaNoastra(),
  ]);
  const dupaLocal = new Map(mapari.map((m: any) => [m.local_id, m]));
  const categoriiLor = catalogRanduri.filter((c: any) => c.fel === "piesa");
  const dupaId = new Map(catalogRanduri.map((c: any) => [`${c.fel}:${c.dezro_id}`, c]));
  const catalogDupaIdSimplu = new Map(categoriiLor.map((c: any) => [c.dezro_id, c]));

  const numeLor = (f: string, id: number | null) => {
    if (!id) return "";
    const n: any = dupaId.get(`${f === "categorie" ? "piesa" : f}:${id}`);
    if (!n) return `#${id} (nu e în catalogul adus)`;
    return f === "categorie" ? caleaCategoriei(n, catalogDupaIdSimplu) : n.nume;
  };

  const out: any[] = [];

  if (fel === "categorie") {
    const dupaIdCat = new Map(nostru.categories.map((c: any) => [c.id, c]));
    for (const c of nostru.categories) {
      const m: any = dupaLocal.get(c.id);
      const sigur = m && (m.sursa === "om" || (m.scor ?? 0) >= PRAG_SIGUR);
      if (sigur && !corp?.toate) continue;
      const parinte: any = c.parent_id ? dupaIdCat.get(c.parent_id) : null;
      const lista = potrivesteCategorie(
        { slug: c.slug, nume: c.nume, numeParinte: parinte?.nume ?? null }, categoriiLor, 5,
      );
      out.push({
        local_id: c.id,
        nume: c.nume,
        context: parinte?.nume ?? "",
        curent: m?.dezro_id ?? null,
        curentNume: numeLor("categorie", m?.dezro_id ?? null),
        sursa: m?.sursa ?? null,
        scor: m?.scor ?? null,
        candidati: lista.map((x: any) => ({ dezro_id: x.dezro_id, nume: x.cale, scor: x.scor })),
      });
    }
  } else if (fel === "model") {
    const marci = await depozit.citesteMapari("marca");
    const marcaPentru = new Map(marci.filter((m: any) => m.dezro_id).map((m: any) => [m.local_id, m.dezro_id]));
    const modeleLor = catalogRanduri.filter((c: any) => c.fel === "model");
    const marciNoastre = new Map(nostru.brands.map((b: any) => [b.id, b]));
    for (const mo of nostru.models) {
      const m: any = dupaLocal.get(mo.id);
      const sigur = m && (m.sursa === "om" || (m.scor ?? 0) >= PRAG_SIGUR);
      if (sigur && !corp?.toate) continue;
      const idMarcaLor = marcaPentru.get(mo.brand_id);
      const candidati = modeleLor.filter((x: any) => x.parinte === idMarcaLor);
      const p = candidati.length ? potrivesteModel(mo.nume, candidati) : null;
      out.push({
        local_id: mo.id,
        nume: mo.nume,
        context: (marciNoastre.get(mo.brand_id) as any)?.nume ?? "",
        curent: m?.dezro_id ?? null,
        curentNume: numeLor("model", m?.dezro_id ?? null),
        sursa: m?.sursa ?? null,
        scor: m?.scor ?? null,
        candidati: (p ? [p] : []).map((x: any) => ({ dezro_id: x.dezro_id, nume: x.nume, scor: x.scor })),
        // Toate modelele mărcii, ca omul să poată alege orice, nu doar propunerea.
        toate: candidati.map((x: any) => ({ dezro_id: x.dezro_id, nume: x.nume })).sort((a: any, b: any) => a.nume.localeCompare(b.nume, "ro")),
      });
    }
  } else {
    const marciLor = catalogRanduri.filter((c: any) => c.fel === "marca");
    for (const b of nostru.brands) {
      const m: any = dupaLocal.get(b.id);
      const sigur = m && (m.sursa === "om" || (m.scor ?? 0) >= PRAG_SIGUR);
      if (sigur && !corp?.toate) continue;
      const p = potrivesteMarca(b.nume, marciLor);
      out.push({
        local_id: b.id, nume: b.nume, context: "",
        curent: m?.dezro_id ?? null,
        curentNume: numeLor("marca", m?.dezro_id ?? null),
        sursa: m?.sursa ?? null, scor: m?.scor ?? null,
        candidati: (p ? [p] : []).map((x: any) => ({ dezro_id: x.dezro_id, nume: x.nume, scor: x.scor })),
        toate: marciLor.map((x: any) => ({ dezro_id: x.dezro_id, nume: x.nume })).sort((a: any, b2: any) => a.nume.localeCompare(b2.nume, "ro")),
      });
    }
  }

  // Categoriile de la ei, pentru lista de alegere. Doar cele SELECTABILE: una de
  // grupare e refuzată la trimiterea anunțului, deci n-are ce căuta în listă.
  const alegeri = fel === "categorie"
    ? categoriiLor.filter((c: any) => c.selectabil)
        .map((c: any) => ({ dezro_id: c.dezro_id, nume: caleaCategoriei(c, catalogDupaIdSimplu) }))
        .sort((a: any, b: any) => a.nume.localeCompare(b.nume, "ro"))
    : [];

  return raspuns({ ok: true, fel, randuri: out, alegeri });
}

async function salveazaMapare(depozit: any, corp: any) {
  const fel = String(corp?.fel ?? "");
  if (!["marca", "model", "categorie"].includes(fel)) return eroare("Fel necunoscut.");
  const localId = Number(corp?.local_id);
  if (!localId) return eroare("Lipsește rândul de mapat.");
  // `null` e o valoare cu înțeles: „s-a decis că nu are corespondent". Vezi
  // comentariul de pe coloană în supabase/dezro.sql.
  const dezroId = corp?.dezro_id === null || corp?.dezro_id === "" ? null : Number(corp.dezro_id);
  await depozit.scrieMapari(
    [{ fel, local_id: localId, dezro_id: dezroId, sursa: "om", scor: null, nota: null }],
    corp?.autor ?? null,
  );
  return raspuns({ ok: true });
}

// ------------------------------------------------------------
// PROBĂ — o singură piesă, ca să se vadă rezultatul înainte de cele 8.700
// ------------------------------------------------------------
async function proba(depozit: any, corp: any) {
  const { cfg } = await config(depozit);
  if (!cfg.cheie || !cfg.utilizator || !cfg.parola) return eroare("Configurarea dez.ro e incompletă (Admin → Integrări).");

  const activ = await depozit.jobActiv();
  if (activ) return eroare(`Există un job în lucru (#${activ.id}). Proba se face cu totul oprit.`, 409);

  const context = await contextPublicare(depozit);
  const sesiune = sesiuneDin(cfg, depozit);

  // Proba trece prin ACELAȘI motor ca publicarea adevărată — altfel n-ar dovedi
  // nimic despre ea. Singura diferență: se oprește la prima piesă chiar publicată.
  const rez = await lotPublicare({
    cfg, depozit, sesiune, job: { pozitie: Number(corp?.dupaId ?? 0) }, context,
    opresteDupaUna: true,
  });

  if (!rez.proba && !rez.erori.length)
    return raspuns({
      ok: true, rezultat: rez,
      mesaj: "N-a fost nimic de trimis: piesele parcurse erau deja la zi sau n-au potriviri. " +
             "Continuă proba de la poziția întoarsă.",
    });
  return raspuns({ ok: true, rezultat: rez, proba: rez.proba ?? null });
}

// ------------------------------------------------------------
// REÎMPROSPĂTAREA STĂRII DE APROBARE
//
// Anunțurile trimise prin API NU sunt publicate pe loc, deși ghidul lor spune
// asta de trei ori: primul anunț real s-a întors cu `approved: false` și fără
// adresă publică. Adresa vine abia după aprobarea lor, iar singurul mod de a o
// afla e să recitim lista. Nu folosește jobul: paginile lor sunt numerotate,
// deci reluarea e gratuită — se cere pagina următoare și atât.
// ------------------------------------------------------------
async function improspateaza(depozit: any, corp: any) {
  const { cfg } = await config(depozit);
  if (!cfg.cheie || !cfg.utilizator || !cfg.parola) return eroare("Configurarea dez.ro e incompletă.");
  const sesiune = sesiuneDin(cfg, depozit);
  const r = await lotImprospatare({ depozit, sesiune, pagina: Number(corp?.pagina ?? 1) });
  return raspuns({ ok: true, ...r });
}

// ------------------------------------------------------------
// PUBLICAREA
// ------------------------------------------------------------
async function start(depozit: any, corp: any) {
  const { cfg } = await config(depozit);
  if (!cfg.cheie) return eroare("Lipsește cheia API dez.ro (Admin → Integrări).");
  if (!cfg.utilizator || !cfg.parola) return eroare("Lipsesc utilizatorul și parola contului dez.ro (Admin → Integrări).");
  if (cfg.activ === false) return eroare("Integrarea dez.ro e oprită din Admin → Integrări.");

  const activ = await depozit.jobActiv();
  if (activ)
    return eroare(
      `Există deja ${activ.actiune === "catalog" ? "o aducere de catalog" : "o publicare"} ` +
      `${activ.status === "in_pauza" ? "în pauză" : "în curs"} (#${activ.id}). Continu-o sau anuleaz-o.`,
      409,
    );

  const catalogRanduri = await depozit.citesteCatalog();
  if (!catalogRanduri.length) return eroare("Catalogul dez.ro n-a fost adus încă.");

  const cifre = await depozit.stare();
  const total = await depozit.numaraEligibile();
  const acumIso = new Date().toISOString();

  const job = await depozit.jobNou({
    actiune: "publicare", status: "in_curs", faza: "publicare", pozitie: 0,
    total, procesate: 0,
    optiuni: { fara_retragere: corp?.faraRetragere === true, confirmat_prag: corp?.confirmatPrag === true },
    jurnal: [{
      la: acumIso,
      text: `Publicare pornită · ${total} piese eligibile · ${cifre?.gata ?? 0} gata de trimis, ` +
            `${(cifre?.eligibile ?? 0) - (cifre?.gata ?? 0)} de completat`,
    }],
    inceput_la: acumIso, actualizat_la: acumIso,
  });
  return raspuns({ ok: true, job });
}

async function lot(depozit: any, corp: any) {
  const job = await depozit.jobCiteste(Number(corp?.jobId));
  if (!job) return eroare("Jobul nu există.", 404);
  if (job.status !== "in_curs") return raspuns({ ok: true, job, gata: true });

  const { cfg } = await config(depozit);
  const sesiune = sesiuneDin(cfg, depozit);

  // ---------- faza de publicare ----------
  if (job.faza === "publicare") {
    const context = await contextPublicare(depozit);
    const r = await lotPublicare({ cfg, depozit, sesiune, job, context });

    const patch: any = {
      pozitie: r.pozitie,
      procesate: job.procesate + r.procesate,
      publicate: job.publicate + r.publicate,
      actualizate: job.actualizate + r.actualizate,
      neschimbate: job.neschimbate + r.neschimbate,
      poze_urcate: job.poze_urcate + r.poze,
      nr_erori: job.nr_erori + r.erori.length,
      erori: [...(job.erori ?? []), ...r.erori].slice(0, MAX_ERORI_PASTRATE),
      optiuni: { ...(job.optiuni ?? {}), motive: sumaMotive(job.optiuni?.motive, r.motive) },
    };

    if (r.oprit) {
      patch.status = "in_pauza";
      patch.mesaj = r.oprit;
      patch.jurnal = [...(job.jurnal ?? []), { la: new Date().toISOString(), text: `Oprit: ${r.oprit}` }];
      return raspuns({ ok: true, job: await depozit.jobActualizeaza(job.id, patch), gata: true });
    }

    if (r.gata) {
      // S-au terminat piesele. Urmează retragerea — dar numai după verificarea
      // pragului: peste 20% din anunțurile active, motorul cere confirmare.
      if (job.optiuni?.fara_retragere) {
        patch.status = "gata"; patch.faza = "gata"; patch.terminat_la = new Date().toISOString();
        patch.jurnal = incheiere(job, patch, 0);
        return raspuns({ ok: true, job: await depozit.jobActualizeaza(job.id, patch), gata: true });
      }
      const prag = await pragRetragere(depozit);
      if (prag.depasit && !job.optiuni?.confirmat_prag) {
        patch.status = "in_pauza";
        patch.mesaj =
          `S-ar retrage ${prag.deRetras} din ${prag.active} anunțuri (${(prag.procent * 100).toFixed(1)}%). ` +
          `Pare o depublicare în masă, nu vânzări. Confirmă separat dacă e corect.`;
        patch.jurnal = [...(job.jurnal ?? []), { la: new Date().toISOString(), text: patch.mesaj }];
        return raspuns({
          ok: true, job: await depozit.jobActualizeaza(job.id, patch), gata: true, cereConfirmare: true, prag,
        });
      }
      patch.faza = "retragere";
      patch.pozitie = 0;
      patch.jurnal = [...(job.jurnal ?? []), {
        la: new Date().toISOString(),
        text: `Piesele s-au terminat · ${patch.publicate} publicate, ${patch.actualizate} actualizate, ` +
              `${patch.neschimbate} neschimbate. Urmează retragerea a ${prag.deRetras} anunțuri.`,
      }];
      return raspuns({ ok: true, job: await depozit.jobActualizeaza(job.id, patch), gata: false });
    }

    return raspuns({ ok: true, job: await depozit.jobActualizeaza(job.id, patch), gata: false });
  }

  // ---------- faza de retragere ----------
  const r = await lotRetragere({ depozit, sesiune, job });
  const patch: any = {
    pozitie: r.pozitie,
    retrase: job.retrase + r.retrase,
    nr_erori: job.nr_erori + r.erori.length,
    erori: [...(job.erori ?? []), ...r.erori].slice(0, MAX_ERORI_PASTRATE),
  };
  if (r.oprit) {
    patch.status = "in_pauza";
    patch.mesaj = r.oprit;
    patch.jurnal = [...(job.jurnal ?? []), { la: new Date().toISOString(), text: `Oprit: ${r.oprit}` }];
    return raspuns({ ok: true, job: await depozit.jobActualizeaza(job.id, patch), gata: true });
  }
  if (r.gata) {
    patch.status = "gata"; patch.faza = "gata"; patch.terminat_la = new Date().toISOString();
    patch.jurnal = incheiere(job, patch, patch.retrase);
    return raspuns({ ok: true, job: await depozit.jobActualizeaza(job.id, patch), gata: true });
  }
  return raspuns({ ok: true, job: await depozit.jobActualizeaza(job.id, patch), gata: false });
}

function sumaMotive(vechi: any, noi: any) {
  const out = { ...(vechi ?? {}) };
  for (const [k, v] of Object.entries(noi ?? {})) out[k] = (out[k] ?? 0) + (v as number);
  return out;
}

function incheiere(job: any, patch: any, retrase: number) {
  return [...(job.jurnal ?? []), {
    la: new Date().toISOString(),
    text: `Încheiat · ${patch.publicate ?? job.publicate} anunțuri noi · ` +
          `${patch.actualizate ?? job.actualizate} actualizate · ` +
          `${patch.neschimbate ?? job.neschimbate} neschimbate · ${retrase} retrase · ` +
          `${patch.poze_urcate ?? job.poze_urcate} poze urcate`,
  }];
}

/** Cifrele vin din view-ul `dezro_de_retras` (supabase/dezro.sql), nu din Node:
 *  altfel ar trebui aduse toate anunțurile prin rețea doar ca să se numere. */
async function pragRetragere(depozit: any) {
  const p = await depozit.pragRetragere();
  return { ...p, depasit: p.active > 0 && p.procent > PRAG_RETRAGERE };
}

async function comanda(depozit: any, corp: any, status: string, mesaj: string | null) {
  const job = await depozit.jobCiteste(Number(corp?.jobId));
  if (!job) return eroare("Jobul nu există.", 404);
  const patch: any = { status };
  if (mesaj) patch.mesaj = mesaj;
  if (status === "oprit") patch.terminat_la = new Date().toISOString();
  if (status === "in_curs") {
    patch.mesaj = null;
    // „Reia" după oprirea pe prag înseamnă chiar confirmarea pragului: altfel
    // jobul s-ar opri din nou în același loc, la nesfârșit.
    if (corp?.confirmatPrag) patch.optiuni = { ...(job.optiuni ?? {}), confirmat_prag: true };
  }
  return raspuns({ ok: true, job: await depozit.jobActualizeaza(job.id, patch) });
}
