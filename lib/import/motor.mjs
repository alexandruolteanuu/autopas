// ============================================================
// MOTORUL IMPORTULUI — planificarea și procesarea rândurilor.
//
// Modul COMUN. Aici stau regulile care decid ce se întâmplă cu fiecare rând din
// feed, iar cele două declanșatoare (scriptul din terminal și ruta /api/import)
// nu fac decât să-l cheme: unul într-o buclă lungă, celălalt în loturi scurte.
// Nicio regulă de import nu are voie să existe în altă parte.
// ============================================================
import { aducePagina, aducePoza, pauzaPoliticoasa, PAUZA_MS } from "./aducere.mjs";
import { extrage, urlCanonic } from "./extragere.mjs";
import { potriveste, potrivesteCategoria, modelDinTitlu, normalizeaza } from "./potrivire.mjs";
import { construiesteRand, patchLaReimport, slugifica } from "./rand.mjs";
import { converteste, extensiaPentru } from "./imagini.mjs";

export const SURSA = "pieseauto.ro";

// Peste pragul ăsta de pagini fără nicio poză, importul se oprește: înseamnă că
// sursa și-a schimbat HTML-ul, iar noi am scrie 8.000 de rânduri goale.
export const LOT_CANAR = 50;
export const PRAG_CANAR = 0.20;

// Peste atâtea piese lipsă din feed față de câte avem în bază, fișierul e
// probabil un export trunchiat, nu o zi bună de vânzări. Se cere confirmare.
export const PRAG_DEPUBLICARE = 0.20;

// Limitele unui lot procesat de ruta /api/import. Un lot se oprește la PRIMA
// limită atinsă:
//   · 15 secunde     — bugetul de lucru
//   · 50 de pagini   — atâtea descărcări încap comod în bugetul de timp
//   · 500 de rânduri — rândurile care nu cer descărcare merg instant, deci un
//                      lot poate mătura sute dintr-o dată; fără plafonul ăsta,
//                      un feed de 8.000 fără piese noi ar face o singură cerere
//                      uriașă în loc de câteva scurte
//
// DE CE 15 ȘI NU 25 (25 august 2026)
// Bugetul se verifică ÎNAINTE de fiecare rând, deci lotul durează în realitate
// „buget + ultimul rând". Un rând nou costă ~3,5s în mod normal, dar poate ajunge
// la 30 (curl are `--max-time 30`). Cu 25 de secunde de buget, un lot putea atinge
// 55 — lipit de limita de 60s a funcției. Cu 15, plafonul real e ~45s, iar lotul
// obișnuit se încheie în ~18: destul de scurt cât să treacă și pe lângă proxy-uri
// mai nerăbdătoare, și destul de des cât progresul să se vadă în ecran.
export const BUGET_MS = 15000;
export const LOT_PAGINI = 50;
export const LOT_RANDURI = 500;

// Rezerva peste buget în care mai au voie să se întindă reîncercările unui rând.
// Peste ea, `aducePagina` renunță la somn și raportează eroarea, în loc să doarmă
// 45 de secunde și să ducă tot lotul peste limita serverului.
export const REZERVA_MS = 20000;

/**
 * Ce are de făcut importul, calculat EXCLUSIV din CSV și din ce e deja în bază.
 * Zero cereri către pieseauto.ro — de asta o previzualizare e instantanee.
 */
export function planifica(randuriCsv, existente, { pragDepublicare = PRAG_DEPUBLICARE } = {}) {
  const dupaId = new Map(existente.map((x) => [x.sursa_id, x]));
  const inFeed = new Set(randuriCsv.map((r) => r.ID));

  const noi = [], deActualizat = [];
  let neschimbate = 0;
  for (const r of randuriCsv) {
    const e = dupaId.get(r.ID);
    if (!e) { noi.push(r); continue; }
    const patch = patchLaReimport(e, r);
    if (patch) deActualizat.push({ feed: r, existent: e, patch });
    else neschimbate++;
  }

  // Dispărute = ce avem în bază de la sursa asta și nu mai apare în feed.
  // Cele deja inactive nu se numără din nou: au fost depublicate la un import
  // anterior, iar altfel procentul ar crește de la o rulare la alta fără motiv.
  const disparute = existente.filter((x) => !inFeed.has(x.sursa_id) && x.sursa_activ !== false);
  const procent = existente.length ? disparute.length / existente.length : 0;

  return {
    noi, deActualizat, neschimbate, disparute,
    total: randuriCsv.length,
    inBaza: existente.length,
    procentDisparute: procent,
    pragDepasit: procent > pragDepublicare,
    // Timpul se duce aproape integral în pauza dintre cereri, plus ~1s de poze.
    minuteEstimate: Math.round((noi.length * (PAUZA_MS + 1000)) / 60000),
  };
}

/** Descarcă, convertește și urcă pozele unei piese. Nu aruncă: o poză care nu
 *  vine nu are voie să oprească importul, doar să lase o notă. */
async function aduPozele(depozit, sursaId, urls) {
  const salvate = [], erori = [];
  let octeti = 0;
  for (let i = 0; i < urls.length; i++) {
    try {
      const brut = await aducePoza(urls[i]);
      const { date, tip } = await converteste(brut);
      const an = new Date().getFullYear();
      const cale = `${an}/import-${sursaId}-${i}-${Math.random().toString(36).slice(2, 8)}.${extensiaPentru(tip)}`;
      salvate.push(await depozit.urcaPoza(cale, date, tip));
      octeti += date.length;
    } catch (e) {
      erori.push(`poza ${i + 1}: ${e?.message ?? e}`);
    }
  }
  return { salvate, erori, octeti };
}

/**
 * Completează arborele de categorii cu ce lipsește, cu numele luate de la sursă.
 *
 * Rândurile noi intră IMEDIAT în `taxonomie.categories`, copia din memorie a
 * lotului: fără asta, al doilea produs din aceeași categorie nouă ar cere din nou
 * crearea ei, iar depozitul ar face o cerere degeaba pentru fiecare rând.
 */
export async function asiguraCategoria(depozit, taxonomie, deCreat) {
  const cat = taxonomie.categories;
  const urmatoareaOrdine = (parentId) =>
    Math.max(0, ...cat.filter((c) => c.parent_id === parentId).map((c) => c.ordine ?? 0)) + 1;

  let parinte = deCreat.parinte.id ? cat.find((c) => c.id === deCreat.parinte.id) : null;
  if (!parinte) {
    parinte = await depozit.asiguraCategorie({
      slug: slugifica(deCreat.parinte.nume),
      nume: deCreat.parinte.nume,
      parent_id: null,
      ordine: urmatoareaOrdine(null),
    });
    if (!cat.some((c) => c.id === parinte.id)) cat.push(parinte);
  }

  let sub = null;
  if (deCreat.sub) {
    sub = await depozit.asiguraCategorie({
      slug: `${parinte.slug}-${slugifica(deCreat.sub.nume)}`,
      nume: deCreat.sub.nume,
      parent_id: parinte.id,
      art: parinte.art ?? "engine",       // subcategoria moștenește ilustrația părintelui
      ordine: urmatoareaOrdine(parinte.id),
    });
    if (!cat.some((c) => c.id === sub.id)) cat.push(sub);
  }
  return { categorie_id: parinte.id, categorie: parinte.nume,
           subcategorie_id: sub?.id ?? null, subcategorie: sub?.nume ?? null };
}

/**
 * A doua șansă pentru model, când compatibilitatea sursei n-a dat unul.
 *
 * Întâi se caută în titlu, printre modelele pe care le avem deja — compatibilitatea
 * lor se contrazice uneori cu titlul, iar titlul are dreptate. Abia dacă nici acolo
 * nu iese nimic se CREEAZĂ modelul din compatibilitate, și numai dacă titlul îl
 * confirmă. Fără condiția asta am fi legat „Maneta Tempomat Vw Golf 5" de un model
 * „Jetta" nou-nouț, doar fiindcă așa scria în datele lor.
 */
export async function asiguraModelul(depozit, taxonomie, ext, pot) {
  const dinTitlu = modelDinTitlu(ext.titlu, taxonomie);
  if (dinTitlu) {
    return { model_id: dinTitlu.model.id, model: dinTitlu.model.nume,
             brand_id: dinTitlu.brand.id, marca: dinTitlu.brand.nume,
             nota: `model luat din titlu: ${dinTitlu.brand.nume} ${dinTitlu.model.nume}` };
  }

  const nume = pot.model_compat_brut;
  if (!pot.brand_id || !nume || !pot.model_compat) return null;
  const titlu = " " + normalizeaza(ext.titlu ?? "") + " ";
  if (!titlu.includes(" " + pot.model_compat + " ")) return null;   // titlul nu confirmă

  const marca = taxonomie.brands.find((b) => b.id === pot.brand_id);
  const model = await depozit.asiguraModel({
    slug: `${marca.slug}-${slugifica(nume)}`,
    nume,
    brand_id: pot.brand_id,
  });
  if (!taxonomie.models.some((m) => m.id === model.id)) taxonomie.models.push(model);
  return { model_id: model.id, model: model.nume, brand_id: pot.brand_id, marca: pot.marca,
           nota: `model nou, creat din compatibilitatea sursei și confirmat de titlu: „${nume}"` };
}

/**
 * Procesează o felie de rânduri din feed.
 *
 * Se oprește singură când expiră bugetul de timp, când s-a atins numărul maxim de
 * pagini descărcate sau când canarul detectează că extragerea a încetat să meargă.
 * Cine o cheamă (scriptul sau ruta) reia de la `pozitie`.
 *
 * @param {{
 *   depozit: any, randuri: any[], taxonomie?: any, uscat?: boolean,
 *   canar?: { total: number, faraPoze: number },
 *   bugetMs?: number, maxPagini?: number, maxRanduri?: number,
 *   laProgres?: ((ev: any) => void) | null,
 *   adu?: (url: string, opt?: any) => Promise<any>,
 *   pauza?: () => Promise<void>,
 * }} opt
 * @returns numărătorile lotului, ca să fie adunate în `import_jobs`.
 */
export async function proceseazaRanduri({
  depozit, randuri, taxonomie, uscat = false,
  canar = { total: 0, faraPoze: 0 },
  bugetMs = Infinity, maxPagini = Infinity, maxRanduri = Infinity,
  laProgres = null,
  // Cele două de mai jos există ca să poată fi verificat motorul fără să lovim
  // pieseauto.ro (vezi scripts/verifica-import.mjs). În producție rămân cele
  // implicite — nimeni nu le schimbă din cod de aplicație.
  adu = aducePagina, pauza = pauzaPoliticoasa,
}) {
  const start = Date.now();
  // Termenul până la care au voie să se întindă reîncercările unui singur rând.
  // `Infinity + orice` rămâne `Infinity`, deci scriptul din terminal nu e limitat.
  const pana = start + bugetMs + REZERVA_MS;
  const rez = {
    procesate: 0, noi: 0, actualizate: 0, neschimbate: 0,
    pagini: 0, pozeSalvate: 0, octetiPoze: 0,
    categoriiCreate: 0, modeleCreate: 0,
    erori: [], categoriiSursa: {}, revizuire: 0,
    canar: { ...canar }, oprit: null, mesaj: null,
  };
  if (!randuri.length) return rez;

  // Ce există deja, aflat dintr-o singură cerere pentru toată felia.
  const existente = await depozit.citesteExistente(SURSA, randuri.map((r) => r.ID));

  for (const r of randuri) {
    if (rez.procesate >= maxRanduri) break;
    if (rez.pagini >= maxPagini) break;
    if (rez.procesate > 0 && Date.now() - start > bugetMs) break;

    const existent = existente.get(r.ID);

    // ---------- piesă cunoscută: totul din CSV, nicio cerere HTTP ----------
    if (existent) {
      const patch = patchLaReimport(existent, r);
      if (patch) {
        if (!uscat) {
          try {
            await depozit.actualizeazaPiesa(existent.id, { ...patch, sursa_sincronizat_la: new Date().toISOString() });
            rez.actualizate++;
          } catch (e) { rez.erori.push({ id: r.ID, eroare: `actualizare: ${e.message}` }); }
        } else rez.actualizate++;
      } else rez.neschimbate++;
      rez.procesate++;
      laProgres?.({ rand: r, tip: patch ? "actualizat" : "neschimbat", rez });
      continue;
    }

    // ---------- piesă nouă: singurul caz care cere pagina ----------
    if (rez.pagini > 0) await pauza();
    const a = await adu(r.URL, { pana });
    rez.pagini++;
    rez.canar.total++;

    if (!a.ok) {
      // Eroare FATALĂ = un refuz care a ținut prin toată scara de reîncercări
      // (vezi EROARE_REFUZ_PERSISTENT). E o stare a sursei, nu a rândului: ar fi
      // la fel pentru toate celelalte. N-are sens să marcăm mii de rânduri ca
      // eșuate — oprim lotul cu motivul la vedere, exact ca la canar.
      if (a.fatal) {
        rez.pagini--;
        rez.canar.total--;
        rez.oprit = "refuz";
        rez.mesaj = `Oprit: ${a.eroare}`;
        break;
      }
      rez.erori.push({ id: r.ID, eroare: a.eroare });
      rez.procesate++;
      laProgres?.({ rand: r, tip: "eroare", eroare: a.eroare, rez });
      continue;
    }

    const canonic = urlCanonic(a.html, a.urlFinal);
    const ext = extrage(a.html, canonic);
    if (!ext.poze.length) rez.canar.faraPoze++;

    const pot = taxonomie ? potriveste(ext, taxonomie) : { note: ["taxonomie necitită"] };
    const revizuire = [...ext.erori, ...pot.note];
    if (canonic.includes("/produs-")) revizuire.push("URL canonic indisponibil — taxonomia nu s-a putut citi");

    // ---------- modelul, dacă lipsește ----------
    // În modul uscat nu se atinge: ar însemna scriere în bază.
    if (taxonomie && !uscat && !pot.model_id) {
      try {
        const m = await asiguraModelul(depozit, taxonomie, ext, pot);
        if (m) {
          pot.model_id = m.model_id; pot.model = m.model;
          pot.brand_id = m.brand_id; pot.marca = m.marca;
          revizuire.push(m.nota);
          if (m.nota.startsWith("model nou")) rez.modeleCreate++;
        }
      } catch (e) { revizuire.push(`model: ${e.message}`); }
    }

    // ---------- categoria ----------
    // Din 25 august 2026 nu se mai lasă gol: ce lipsește din arborele nostru se
    // creează cu numele de la sursă (vezi potrivesteCategoria). Slug-ul sursei se
    // numără oricum, ca operatorul să vadă în raport ce a intrat și de unde.
    let cat = { categorie_id: null, subcategorie_id: null, note: [] };
    if (taxonomie && ext.categorie_sursa) {
      cat = potrivesteCategoria(ext.categorie_sursa, taxonomie.categories);
      revizuire.push(...cat.note);
      rez.categoriiSursa[ext.categorie_sursa] = (rez.categoriiSursa[ext.categorie_sursa] ?? 0) + 1;
      if (cat.de_creat && !uscat) {
        try {
          const facute = await asiguraCategoria(depozit, taxonomie, cat.de_creat);
          cat.categorie_id = facute.categorie_id; cat.categorie = facute.categorie;
          cat.subcategorie_id = facute.subcategorie_id; cat.subcategorie = facute.subcategorie;
          rez.categoriiCreate++;
        } catch (e) { revizuire.push(`categorie: ${e.message}`); }
      }
    }

    // Pozele se aduc ÎNAINTE de inserare: așa piesa nu apare nicio clipă pe site
    // fără nimic de arătat. Dacă n-a venit niciuna, se publică oricum (A.0.5).
    let poze = { salvate: [], erori: [], octeti: 0 };
    if (!uscat && ext.poze.length) {
      poze = await aduPozele(depozit, r.ID, ext.poze);
      rez.pozeSalvate += poze.salvate.length;
      rez.octetiPoze += poze.octeti;
      if (poze.erori.length) revizuire.push(...poze.erori);
      if (!poze.salvate.length) revizuire.push("nicio poză n-a putut fi adusă — piesa e publicată fără poze");
    }

    const rand = construiesteRand(
      { ...ext, ...pot, ...cat, feed: r, sursa_id: r.ID, sursa_url: canonic, revizuire },
      taxonomie?.categories, poze.salvate,
    );
    rand.sursa_sincronizat_la = new Date().toISOString();

    if (!uscat) {
      try { await depozit.insereazaPiesa(rand); rez.noi++; }
      catch (e) { rez.erori.push({ id: r.ID, eroare: `inserare: ${e.message}` }); }
    } else rez.noi++;

    if (revizuire.length) rez.revizuire++;
    rez.procesate++;
    laProgres?.({ rand: r, tip: "nou", ext, pot, poze: poze.salvate.length, rez });

    // ---------- canarul ----------
    // Doar lipsa pozelor oprește importul: înseamnă că s-a schimbat HTML-ul.
    // Nepotrivirile sunt o proprietate a datelor lor, nu o defecțiune.
    if (rez.canar.total >= LOT_CANAR) {
      const rata = rez.canar.faraPoze / rez.canar.total;
      if (rata > PRAG_CANAR) {
        rez.oprit = "canar";
        rez.mesaj = `Oprit: ${(rata * 100).toFixed(0)}% din ultimele ${rez.canar.total} pagini n-au dat nicio poză (prag ${PRAG_CANAR * 100}%). Probabil pieseauto.ro și-a schimbat HTML-ul — verifică extragerea înainte de a relua.`;
        break;
      }
      rez.canar = { total: 0, faraPoze: 0 };
    }
  }

  return rez;
}
