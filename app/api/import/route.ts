// ============================================================
// IMPORTUL DIN pieseauto.ro, PORNIT DIN ADMIN
//
// Ruta asta nu conține nicio regulă de import — toate stau în `lib/import/`,
// împărțite cu scriptul din terminal (vezi lib/import/README.md). Aici e doar
// orchestrarea: cine are voie, de unde vine fișierul, unde se scrie progresul.
//
// DE CE LOTURI
// 8.000 de pagini × ~1,75s de pauză politicoasă ≈ 4,5 ore. O funcție serverless
// trăiește zeci de secunde, deci importul nu poate fi o singură cerere. Browserul
// cere lot după lot, iar starea — poziția, numărătorile, fișierul CSV — stă în
// baza de date și în Storage, nu în pagină. Dacă tabul se închide, jobul rămâne
// pe loc și se reia de unde a rămas.
//
// Acțiuni (toate POST, cu `actiune` în corp):
//   previzualizare — citește CSV-ul și spune ce s-ar întâmpla. NU scrie nimic.
//   start          — creează jobul și urcă fișierul în bucketul privat
//   lot            — procesează următoarea felie și întoarce progresul
//   pauza / reia / anuleaza — comenzi asupra jobului
//   reia-esecuri   — job nou, doar cu rândurile care au eșuat
// ============================================================
import { NextResponse } from "next/server";
import { esteEchipa } from "@/lib/supabase";
import {
  parseCSV, verificaColoane, planifica, proceseazaRanduri,
  depozitDinMediu, SURSA, BUGET_MS, LOT_PAGINI, LOT_RANDURI, PRAG_DEPUBLICARE,
} from "@/lib/import/index.mjs";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Câte erori ținem în jurnalul jobului. Peste atât, numărul rămâne exact, dar
 *  lista se oprește — altfel un import cu 3.000 de erori ar umfla rândul. */
const MAX_ERORI_PASTRATE = 300;

/** La câte milisecunde se salvează progresul în timpul unui lot. Vezi `lot()`. */
const SALVARE_LA_MS = 4000;

/**
 * Numărătorile jobului după ce s-a adunat rezultatul unui lot — sau al bucății
 * din el făcute până acum. `job` e mereu rândul citit la începutul lotului, iar
 * `rez` e acumulatorul motorului, deci formula dă un instantaneu corect oricând
 * ar fi chemată. De asta o pot folosi și salvările intermediare, și cea finală,
 * fără să dubleze nimic.
 */
function contoare(job: any, rez: any) {
  const categorii = { ...(job.categorii_sursa ?? {}) };
  for (const [k, v] of Object.entries(rez.categoriiSursa)) categorii[k] = (categorii[k] ?? 0) + (v as number);
  return {
    procesate: job.procesate + rez.procesate,
    noi: job.noi + rez.noi,
    actualizate: job.actualizate + rez.actualizate,
    neschimbate: (job.neschimbate ?? 0) + rez.neschimbate,
    pagini: (job.pagini ?? 0) + rez.pagini,
    poze_salvate: (job.poze_salvate ?? 0) + rez.pozeSalvate,
    octeti_poze: Number(job.octeti_poze ?? 0) + rez.octetiPoze,
    canar_total: rez.canar.total,
    canar_fara_poze: rez.canar.faraPoze,
    categorii_sursa: categorii,
    erori: [...(job.erori ?? []), ...rez.erori].slice(0, MAX_ERORI_PASTRATE),
    nr_erori: (job.nr_erori ?? 0) + rez.erori.length,
  };
}

const raspuns = (date: any, stare = 200) => NextResponse.json(date, { status: stare });
const eroare = (mesaj: string, stare = 400) => raspuns({ ok: false, eroare: mesaj }, stare);

export async function POST(req: Request) {
  if (!(await esteEchipa(req))) return eroare("Doar echipa poate porni importul.", 401);

  let depozit: any;
  try { depozit = depozitDinMediu(); }
  catch (e: any) { return eroare(e.message, 500); }

  const corp = (await req.json().catch(() => ({}))) as any;
  const actiune = corp?.actiune;

  try {
    switch (actiune) {
      case "previzualizare": return await previzualizare(depozit, corp);
      case "start":          return await start(depozit, corp);
      case "lot":            return await lot(depozit, corp);
      case "pauza":          return await comanda(depozit, corp, "in_pauza", "Oprit de operator.");
      case "reia":           return await comanda(depozit, corp, "in_curs", null);
      case "anuleaza":       return await comanda(depozit, corp, "oprit", "Anulat de operator.");
      case "reia-esecuri":   return await reiaEsecuri(depozit, corp);
      default:               return eroare("Acțiune necunoscută.");
    }
  } catch (e: any) {
    console.error("[import]", actiune, e);
    return eroare(e?.message ?? "Eroare neașteptată.", 500);
  }
}

// ------------------------------------------------------------
// PREVIZUALIZARE — se citește tot, nu se scrie nimic (regula A.4)
// ------------------------------------------------------------
async function previzualizare(depozit: any, corp: any) {
  const randuri = parseCSV(String(corp.csv ?? ""));
  const problema = verificaColoane(randuri);
  if (problema) return eroare(problema);

  const existente = await depozit.citesteToateDeLaSursa(SURSA);
  const plan = planifica(randuri, existente);

  return raspuns({
    ok: true,
    plan: {
      total: plan.total,
      inBaza: plan.inBaza,
      noi: plan.noi.length,
      deActualizat: plan.deActualizat.length,
      neschimbate: plan.neschimbate,
      disparute: plan.disparute.length,
      procentDisparute: Math.round(plan.procentDisparute * 1000) / 10,
      pragDepasit: plan.pragDepasit,
      pragProcent: PRAG_DEPUBLICARE * 100,
      minuteEstimate: plan.minuteEstimate,
      exempleNoi: plan.noi.slice(0, 5).map((r: any) => r.Titlu),
      exempleActualizate: plan.deActualizat.slice(0, 5).map((x: any) => ({
        titlu: x.feed.Titlu, vechi: x.existent.pret_lei, nou: x.patch.pret_lei ?? x.existent.pret_lei,
      })),
    },
  });
}

// ------------------------------------------------------------
// START — de aici încolo se scrie
// ------------------------------------------------------------
async function start(depozit: any, corp: any) {
  const text = String(corp.csv ?? "");
  const randuri = parseCSV(text);
  const problema = verificaColoane(randuri);
  if (problema) return eroare(problema);

  // Un singur job activ per sursă (A.1.5). Fără regula asta, două taburi deschise
  // ar procesa aceleași rânduri în paralel și ar lovi sursa de două ori mai des.
  const activ = await depozit.jobActiv(SURSA);
  if (activ) return eroare(`Există deja un import ${activ.status === "in_pauza" ? "în pauză" : "în curs"} (#${activ.id}, ${activ.procesate} din ${activ.total}). Continuă-l sau anulează-l înainte de a porni altul.`, 409);

  const existente = await depozit.citesteToateDeLaSursa(SURSA);
  const plan = planifica(randuri, existente);
  const depublica = corp.depublica !== false;

  // Protecția anti-fișier-trunchiat (A.3.2). Sub prag se aplică fără întrebări;
  // peste prag, doar dacă operatorul a confirmat explicit.
  if (depublica && plan.pragDepasit && !corp.confirmatTrunchiat)
    return raspuns({
      ok: false, cereConfirmare: true,
      eroare: `Fișierul ar depublica ${plan.disparute.length} din ${plan.inBaza} piese (${(plan.procentDisparute * 100).toFixed(1)}%). Pare un export incomplet. Continui?`,
    }, 409);

  const acum = new Date().toISOString();
  const cale = `${new Date().getFullYear()}/feed-${Date.now().toString(36)}.csv`;
  await depozit.urcaCsv(cale, text);

  const job = await depozit.jobNou({
    sursa: SURSA,
    status: "in_curs",
    total: randuri.length,
    procesate: 0, noi: 0, actualizate: 0, disparute: 0,
    erori: [],
    cale_csv: cale,
    nume_fisier: String(corp.numeFisier ?? "feed.csv").slice(0, 200),
    optiuni: { depublica, confirmatTrunchiat: !!corp.confirmatTrunchiat },
    jurnal: [{ la: acum, text: `Import pornit · ${randuri.length} rânduri în fișier · ${plan.noi.length} piese noi de descărcat` }],
    inceput_la: acum,
    actualizat_la: acum,
  });

  return raspuns({ ok: true, job });
}

// ------------------------------------------------------------
// LOT — inima lucrului. O felie, sub 30 de secunde, apoi înapoi la browser.
// ------------------------------------------------------------
async function lot(depozit: any, corp: any) {
  const job = await depozit.jobCiteste(Number(corp.jobId));
  if (!job) return eroare("Jobul nu există.", 404);
  if (job.status !== "in_curs") return raspuns({ ok: true, job, gata: true });

  const text = await depozit.citesteCsv(job.cale_csv);
  let randuri = parseCSV(text);
  const doarIds: string[] | null = job.optiuni?.doar_ids ?? null;
  if (doarIds) {
    const set = new Set(doarIds);
    randuri = randuri.filter((r: any) => set.has(r.ID));
  }

  const felie = randuri.slice(job.procesate);

  // ---------- s-a terminat de parcurs fișierul: rămâne depublicarea ----------
  if (!felie.length) return await incheie(depozit, job, randuri);

  const taxonomie = await depozit.citesteTaxonomia();

  // Progresul se salvează DIN MERS, la fiecare câteva secunde, nu doar la finalul
  // lotului (defect găsit la 25 august 2026). Dacă cererea e tăiată — funcție
  // serverless expirată, proxy nerăbdător — munca făcută până atunci rămâne
  // scrisă, iar „Continuă importul" pornește de unde a rămas. Fără asta, un lot
  // tăiat pierdea tot: `procesate` rămânea 0, reluarea măcina exact aceleași
  // rânduri, se lovea de aceeași limită, și importul nu putea avansa niciodată.
  let ultimaSalvare = Date.now();
  let inSalvare: Promise<any> = Promise.resolve();

  const rez = await proceseazaRanduri({
    depozit, randuri: felie, taxonomie,
    canar: { total: job.canar_total ?? 0, faraPoze: job.canar_fara_poze ?? 0 },
    bugetMs: BUGET_MS, maxPagini: LOT_PAGINI, maxRanduri: LOT_RANDURI,
    laProgres: (ev: any) => {
      if (Date.now() - ultimaSalvare < SALVARE_LA_MS) return;
      ultimaSalvare = Date.now();
      // Fără `await`: salvarea merge în paralel cu rândul următor, ca să nu adauge
      // timp lotului. O eroare aici nu are voie să oprească importul — salvarea
      // finală, de mai jos, scrie oricum totul.
      inSalvare = depozit.jobActualizeaza(job.id, contoare(job, ev.rez)).catch(() => null);
    },
  });
  await inSalvare;   // ultima salvare intermediară să nu bată peste cea finală

  const patch: any = contoare(job, rez);
  const jurnal = [...(job.jurnal ?? [])];
  // Consumul de stocare, la fiecare 1.000 de piese procesate (A.5). Nu oprește
  // nimic — doar spune unde suntem, ca să nu fie o surpriză la final. Se scrie
  // doar aici, nu și la salvările intermediare, ca să nu se repete în același lot.
  if (Math.floor(patch.procesate / 1000) > Math.floor(job.procesate / 1000))
    jurnal.push({
      la: new Date().toISOString(),
      text: `${patch.procesate} piese procesate · ${patch.poze_salvate} poze aduse · stocare folosită ${(patch.octeti_poze / 1024 / 1024).toFixed(1)} MB`,
    });
  patch.jurnal = jurnal;

  if (rez.oprit) {
    const acum = new Date().toISOString();
    patch.mesaj = rez.mesaj;
    patch.jurnal = [...jurnal, { la: acum, text: rez.mesaj }];
    // „refuz" = sursa ne-a respins și după toate reîncercările. Nu e vina
    // fișierului și nu e o oprire definitivă — peste un timp poate merge. Deci
    // jobul rămâne în pauză, cu motivul la vedere, și poate fi continuat de acolo.
    if (rez.oprit === "refuz") {
      patch.status = "in_pauza";
    } else {
      patch.status = "oprit";
      patch.terminat_la = acum;
    }
  }

  const nou = await depozit.jobActualizeaza(job.id, patch);
  return raspuns({ ok: true, job: nou, gata: !!rez.oprit });
}

/** Ultimul pas: piesele care nu mai apar în feed. Nu se șterge nimic — pot avea
 *  comenzi în istoric. `sursa_activ=false` + `publicat=false`, iar rândul rămâne. */
async function incheie(depozit: any, job: any, randuri: any[]) {
  const acum = new Date().toISOString();
  let disparute = 0;

  if (job.optiuni?.depublica !== false && !job.optiuni?.doar_ids) {
    const inFeed = new Set(randuri.map((r) => r.ID));
    const toate = await depozit.citesteToateDeLaSursa(SURSA);
    const lipsa = toate.filter((x: any) => !inFeed.has(x.sursa_id) && x.sursa_activ !== false);
    if (lipsa.length) await depozit.depublica(lipsa.map((x: any) => x.id));
    disparute = lipsa.length;
  }

  const jurnal = [...(job.jurnal ?? []), {
    la: acum,
    text: `Import încheiat · ${job.noi} piese noi · ${job.actualizate} actualizate · ${disparute} depublicate · ` +
          `${job.poze_salvate ?? 0} poze (${((Number(job.octeti_poze ?? 0)) / 1024 / 1024).toFixed(1)} MB)`,
  }];

  const nou = await depozit.jobActualizeaza(job.id, {
    status: "gata", disparute, terminat_la: acum, jurnal,
  });
  return raspuns({ ok: true, job: nou, gata: true });
}

// ------------------------------------------------------------
// COMENZI simple asupra jobului
// ------------------------------------------------------------
async function comanda(depozit: any, corp: any, status: string, mesaj: string | null) {
  const job = await depozit.jobCiteste(Number(corp.jobId));
  if (!job) return eroare("Jobul nu există.", 404);
  const patch: any = { status };
  if (mesaj) patch.mesaj = mesaj;
  if (status === "oprit") patch.terminat_la = new Date().toISOString();
  if (status === "in_curs") patch.mesaj = null;
  const nou = await depozit.jobActualizeaza(job.id, patch);
  return raspuns({ ok: true, job: nou });
}

// ------------------------------------------------------------
// RELUAREA EȘUĂRILOR — un job nou, cu același fișier, dar numai rândurile picate
// ------------------------------------------------------------
async function reiaEsecuri(depozit: any, corp: any) {
  const vechi = await depozit.jobCiteste(Number(corp.jobId));
  if (!vechi) return eroare("Jobul nu există.", 404);
  // Fără `[...new Set()]`: `tsconfig` țintește ES5, unde iterarea unui Set cere
  // `downlevelIteration`. Dedublarea pe index face același lucru.
  const ids = (vechi.erori ?? [])
    .map((e: any) => e.id)
    .filter((id: any, i: number, v: any[]) => id && v.indexOf(id) === i);
  if (!ids.length) return eroare("Jobul n-are rânduri eșuate.");

  const activ = await depozit.jobActiv(SURSA);
  if (activ) return eroare(`Există deja un import activ (#${activ.id}). Termină-l întâi.`, 409);

  const acum = new Date().toISOString();
  const job = await depozit.jobNou({
    sursa: SURSA, status: "in_curs",
    total: ids.length, procesate: 0, noi: 0, actualizate: 0, disparute: 0, erori: [],
    cale_csv: vechi.cale_csv,
    nume_fisier: vechi.nume_fisier,
    // Fără depublicare: fișierul e complet, dar jobul ăsta atinge doar o parte din el.
    optiuni: { depublica: false, doar_ids: ids },
    jurnal: [{ la: acum, text: `Reluare: ${ids.length} rânduri eșuate la importul #${vechi.id}` }],
    inceput_la: acum, actualizat_la: acum,
  });
  return raspuns({ ok: true, job });
}
