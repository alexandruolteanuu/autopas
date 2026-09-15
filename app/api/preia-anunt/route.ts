// ============================================================
// PRELUAREA UNUI ANUNȚ DIN BROWSERUL OPERATORULUI — ciornele din „Piese noi din CSV"
//
// DE CE (cerut de proprietar, 15 septembrie 2026)
// pieseauto.ro refuză cererile serverului nostru (pagina „sorry"), deci pozele și
// descrierea ciornelor nu se mai pot aduce din import. NU le ocolim blocarea (alt
// IP, antete de browser): anunțul îl deschide operatorul, în browserul lui, iar
// butonul din bara de favorite („Preia în Autopas", generat în `/admin/piese-noi`)
// trimite pagina și pozele — luate din browserul lui — aici. Serverul nostru nu face
// nicio cerere la pieseauto.ro.
//
// DE CE PRIN SERVER, NU PRIN `postMessage` ÎNTRE TABURI (corectat la 15 septembrie 2026)
// Prima variantă deschidea tabul de admin și vorbea cu el prin `window.opener`.
// pieseauto.ro trimite însă `Cross-Origin-Opener-Policy: same-origin` (verificat pe
// antetele lor), care taie legătura dintre pagina lor și orice tab deschis de pe ea:
// tabul nostru se deschidea cu `opener = null` și nu primea nimic. Acum:
//   1. butonul deschide `/admin/preia-anunt#p=<cod>` (cod aleator, generat de buton) și
//      trimite, cu `fetch` + CORS, pagina și pozele într-un depozit TEMPORAR, sub acel
//      cod (`import-csv/preluari/<cod>/`, bucket privat);
//   2. tabul de admin, autentificat, întreabă de cod până e gata, arată ce a sosit, iar
//      „Preia și publică" completează piesa din depozit și îl golește.
//
// Acțiunile BUTONULUI (fără sesiune: pe pieseauto.ro nu există sesiunea noastră) cer
// cheia din `settings.integrari.preluare.cheie`, pusă în buton la generare. Cheia dă
// voie doar să DEPUI date pentru o ciornă existentă — nu scrie nicio piesă. Scrierea o
// face doar tabul de admin, cu sesiunea echipei.
//   · trimite         { url, html }  → pagina; răspunde cu lista pozelor (extrase aici)
//   · trimite-poza    octeții pozei, ?i=<index>
//   · trimite-gata    { erori }
// Acțiunile TABULUI (echipă): buton (dă cheia), stare, salveaza, renunta.
//
// Gărzi la salvare: piesa trebuie să fie ÎNCĂ ciornă (condiție în UPDATE), iar ID-ul
// din adresa anunțului ȘI din `og:url` trebuie să fie `sursa_id`-ul piesei.
// ============================================================
import { NextResponse } from "next/server";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { esteEchipa, sbAdmin } from "@/lib/supabase";
import {
  depozitDinMediu, piesaDinPagina, urcaPozaImport, esteCiorna, metaProp, idAnuntDinAdresa, extragePoze, extrage, urlCanonic,
} from "@/lib/import/index.mjs";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const BUCKET = "import-csv";
const DOSAR = "preluari";
/** Sub plafonul de 4,5 MB al unei cereri către o funcție Vercel. Butonul micșorează
 *  în browser orice poză mai mare. */
const MAX_POZA = 4 * 1024 * 1024;
/** Pagina unui anunț are câteva sute de KB; peste atât nu e o pagină de produs. */
const MAX_HTML = 3 * 1024 * 1024;
const MAX_POZE = 30;
/** Depunerile nefolosite se șterg după o zi (vezi `curataVechi`). */
const VIATA_MS = 24 * 3600 * 1000;
const ORIGINE_SURSA = /^https:\/\/([a-z0-9-]+\.)*pieseauto\.ro$/;
/** Codul depunerii: momentul în baza 36, cratimă, apoi cel puțin 16 caractere aleatoare. */
const COD = /^([a-z0-9]{6,12})-([a-z0-9]{16,64})$/;

// ---------- CORS: doar pentru butonul care rulează pe pieseauto.ro ----------
function antetCors(req: Request): Record<string, string> {
  const o = req.headers.get("origin") ?? "";
  if (!ORIGINE_SURSA.test(o)) return {};
  return {
    "Access-Control-Allow-Origin": o,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, x-autopas-cheie",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}
const raspuns = (req: Request, date: any, stare = 200) => NextResponse.json(date, { status: stare, headers: antetCors(req) });
const eroare = (req: Request, mesaj: string, stare = 400) => raspuns(req, { ok: false, eroare: mesaj }, stare);

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: antetCors(req) });
}

/** JPEG, PNG, WebP sau GIF, după primii octeți — nu după ce pretinde cererea. */
function estePoza(b: Uint8Array) {
  const s = (i: number, t: string) => t.split("").every((c, k) => b[i + k] === c.charCodeAt(0));
  return (b[0] === 0xff && b[1] === 0xd8) || s(1, "PNG") || (s(0, "RIFF") && s(8, "WEBP")) || s(0, "GIF8");
}

/** Cheia butonului; se creează la prima cerere a unui om din echipă. */
async function cheia(sb: any, creeaza: boolean): Promise<string | null> {
  const { data } = await sb.from("settings").select("valoare").eq("cheie", "integrari").maybeSingle();
  const existenta = data?.valoare?.preluare?.cheie;
  if (existenta || !creeaza) return existenta ?? null;
  const noua = randomBytes(24).toString("hex");
  const valoare = { ...(data?.valoare ?? {}), preluare: { ...(data?.valoare?.preluare ?? {}), cheie: noua } };
  const { data: scris, error } = await sb.from("settings").update({ valoare }).eq("cheie", "integrari").select("cheie");
  if (error || !scris?.length) throw new Error(`cheia nu s-a putut salva${error ? `: ${error.message}` : ""}`);
  return noua;
}

function cheieBuna(primita: string | null, corecta: string | null) {
  if (!primita || !corecta || primita.length !== corecta.length) return false;
  return timingSafeEqual(Buffer.from(primita), Buffer.from(corecta));
}

// ---------- depozitul temporar ----------
const cale = (p: string, fisier: string) => `${DOSAR}/${p}/${fisier}`;

async function citesteJson(sb: any, c: string) {
  const { data, error } = await sb.storage.from(BUCKET).download(c);
  if (error || !data) return null;
  try { return JSON.parse(await data.text()); } catch { return null; }
}
async function scrie(sb: any, c: string, corp: Uint8Array | string, tip: string) {
  const { error } = await sb.storage.from(BUCKET).upload(c, corp, { contentType: tip, upsert: true });
  if (error) throw new Error(`depozitul temporar: ${error.message}`);
}
async function fisiere(sb: any, p: string): Promise<string[]> {
  const { data } = await sb.storage.from(BUCKET).list(`${DOSAR}/${p}`, { limit: 100 });
  return (data ?? []).map((f: any) => String(f.name));
}
async function goleste(sb: any, p: string) {
  const nume = await fisiere(sb, p);
  if (nume.length) await sb.storage.from(BUCKET).remove(nume.map((n) => cale(p, n)));
}
/** Șterge depunerile mai vechi de o zi. Momentul e în cod, deci nu trebuie citit nimic. */
async function curataVechi(sb: any) {
  const { data } = await sb.storage.from(BUCKET).list(DOSAR, { limit: 200 });
  for (const f of data ?? []) {
    const m = String(f.name).match(COD);
    if (!m || Date.now() - parseInt(m[1], 36) > VIATA_MS) await goleste(sb, String(f.name)).catch(() => {});
  }
}
/** Pozele depuse, în ordinea din anunț. */
const pozeDepuse = (nume: string[]) =>
  nume.map((n) => n.match(/^poza-(\d+)$/)).filter((m): m is RegExpMatchArray => !!m).map((m) => Number(m[1])).sort((a, b) => a - b);

/** Ciorna la care se referă un anunț, sau motivul pentru care nu se poate completa. */
async function ciornaPentru(sb: any, adresa: string, html: string): Promise<{ piesa?: any; problema?: string }> {
  const idAdresa = idAnuntDinAdresa(adresa);
  if (!idAdresa) return { problema: "Adresa nu e un anunț pieseauto.ro (lipsește ID-ul din adresă)." };
  const og = metaProp(html, "og:url");
  const idOg = og ? idAnuntDinAdresa(og) : null;
  if (idOg && idOg !== idAdresa) return { problema: `Pagina e a anunțului ${idOg}, dar adresa arată ${idAdresa}.` };
  const { data: p } = await sb.from("products")
    .select("id,nume,pret_lei,ani,model_ids,compat,sursa,sursa_id,sursa_url,sursa_activ,editat_manual,import_erori,cod_intern,slug")
    .eq("sursa", "pieseauto.ro").eq("sursa_id", idAdresa).maybeSingle();
  if (!p) return { problema: `Anunțul ${idAdresa} nu e în Autopas. Rulează întâi sincronizarea CSV.` };
  if (!esteCiorna(p)) return { problema: `Piesa ${p.cod_intern} e deja completată în Autopas. Nu o suprascriu.`, piesa: p };
  return { piesa: p };
}

export async function POST(req: Request) {
  const sb = sbAdmin();
  if (!sb) return eroare(req, "Serverul nu are cheia de serviciu Supabase.", 500);
  const q = new URL(req.url).searchParams;
  const actiune = q.get("actiune");

  // ============ acțiunile BUTONULUI (pe pieseauto.ro, cu cheia) ============
  if (actiune === "trimite" || actiune === "trimite-poza" || actiune === "trimite-gata") {
    if (!cheieBuna(req.headers.get("x-autopas-cheie"), await cheia(sb, false)))
      return eroare(req, "Butonul e vechi sau greșit. Ia-l din nou din Admin → Piese noi din CSV.", 401);
    const p = q.get("p") ?? "";
    if (!COD.test(p)) return eroare(req, "Cod de preluare greșit.");

    try {
      if (actiune === "trimite") {
        let corp: any;
        try { corp = JSON.parse(await req.text()); } catch { return eroare(req, "Cerere nevalidă."); }
        const html = typeof corp?.html === "string" ? corp.html : "";
        const adresa = typeof corp?.url === "string" ? corp.url : "";
        if (!html || html.length > MAX_HTML) return eroare(req, "Pagina lipsește sau e prea mare.");
        const c = await ciornaPentru(sb, adresa, html);
        if (!c.piesa || c.problema) return eroare(req, c.problema ?? "Piesa nu există.", 409);
        await curataVechi(sb).catch(() => {});
        await scrie(sb, cale(p, "pagina.json"), JSON.stringify({ url: adresa, html, primit_la: new Date().toISOString() }), "application/json");
        // Lista pozelor o dă ACEEAȘI regulă ca la import; butonul doar le aduce.
        const poze = extragePoze(html).poze.slice(0, MAX_POZE);
        return raspuns(req, { ok: true, piesa: c.piesa.cod_intern, poze });
      }

      const nume = await fisiere(sb, p);
      if (!nume.includes("pagina.json")) return eroare(req, "Pagina n-a ajuns încă la server.", 409);

      if (actiune === "trimite-poza") {
        const i = Number(q.get("i"));
        if (!Number.isInteger(i) || i < 0 || i >= MAX_POZE) return eroare(req, "Index de poză greșit.");
        const brut = new Uint8Array(await req.arrayBuffer());
        if (!brut.length) return eroare(req, "Poza a sosit goală.");
        if (brut.length > MAX_POZA) return eroare(req, "Poza e prea mare (peste 4 MB).", 413);
        if (!estePoza(brut)) return eroare(req, "Fișierul primit nu e o poză.", 415);
        await scrie(sb, cale(p, `poza-${i}`), brut, "application/octet-stream");
        return raspuns(req, { ok: true });
      }

      let corp: any = {};
      try { corp = JSON.parse(await req.text()); } catch { /* fără erori raportate */ }
      const erori = (Array.isArray(corp?.erori) ? corp.erori : []).map((x: unknown) => String(x).slice(0, 200)).slice(0, 30);
      await scrie(sb, cale(p, "gata.json"), JSON.stringify({ erori, gata_la: new Date().toISOString() }), "application/json");
      return raspuns(req, { ok: true });
    } catch (e: any) {
      return eroare(req, e?.message ?? String(e), 500);
    }
  }

  // ============ acțiunile TABULUI DE ADMIN (sesiunea echipei) ============
  if (!(await esteEchipa(req))) return eroare(req, "Doar echipa poate prelua anunțuri.", 401);
  let body: any;
  try { body = await req.json(); } catch { return eroare(req, "Cerere nevalidă."); }

  if (body.actiune === "buton") {
    try { return raspuns(req, { ok: true, cheie: await cheia(sb, true) }); }
    catch (e: any) { return eroare(req, e?.message ?? String(e), 500); }
  }

  const p = String(body.p ?? "");
  if (!COD.test(p)) return eroare(req, "Cod de preluare greșit.");

  if (body.actiune === "renunta") {
    await goleste(sb, p).catch(() => {});
    return raspuns(req, { ok: true });
  }

  const nume = await fisiere(sb, p);

  if (body.actiune === "stare") {
    const pozeSosite = pozeDepuse(nume).length;
    if (!nume.includes("gata.json"))
      return raspuns(req, { ok: true, gata: false, pagina: nume.includes("pagina.json"), poze_sosite: pozeSosite });
    const pagina = await citesteJson(sb, cale(p, "pagina.json"));
    const gata = await citesteJson(sb, cale(p, "gata.json"));
    if (!pagina) return eroare(req, "Pagina depusă nu se poate citi. Apasă din nou butonul pe anunț.", 410);
    const ext = extrage(pagina.html, urlCanonic(pagina.html, pagina.url));
    const c = await ciornaPentru(sb, pagina.url, pagina.html);
    const previzualizari: (string | null)[] = [];
    for (const i of pozeDepuse(nume)) {
      const { data } = await sb.storage.from(BUCKET).createSignedUrl(cale(p, `poza-${i}`), 900);
      previzualizari.push(data?.signedUrl ?? null);
    }
    const nepotrivita = !ext.titlu || (!ext.descriere && !ext.poze.length)
      ? "Pagina primită nu pare anunțul (fără titlu, descriere și poze). Reîncarcă anunțul și apasă din nou butonul." : null;
    return raspuns(req, {
      ok: true, gata: true, problema: c.problema ?? nepotrivita,
      piesa: c.piesa ? { id: c.piesa.id, cod_intern: c.piesa.cod_intern, pret_lei: c.piesa.pret_lei, sursa_id: c.piesa.sursa_id } : null,
      ext: { titlu: ext.titlu, descriere: ext.descriere, oem: ext.oem, compat: ext.compat, categorie_sursa: ext.categorie_sursa, poze: ext.poze.length },
      poze: previzualizari, erori: gata?.erori ?? [],
    });
  }

  if (body.actiune !== "salveaza") return eroare(req, "Acțiune necunoscută.");

  // ---------- salvarea ----------
  if (!nume.includes("gata.json")) return eroare(req, "Anunțul n-a terminat de sosit.", 409);
  const pagina = await citesteJson(sb, cale(p, "pagina.json"));
  const gata = await citesteJson(sb, cale(p, "gata.json"));
  if (!pagina) return eroare(req, "Pagina depusă nu se poate citi. Apasă din nou butonul pe anunț.", 410);
  const c = await ciornaPentru(sb, pagina.url, pagina.html);
  if (!c.piesa || c.problema) return eroare(req, c.problema ?? "Piesa nu există.", 409);
  const piesa = c.piesa;

  let depozit: any;
  try { depozit = depozitDinMediu(); } catch (e: any) { return eroare(req, e?.message ?? String(e), 500); }

  // Pozele: din depozitul temporar în bucketul public, convertite ca la import.
  const urcate: { url: string; cale: string }[] = [];
  const eroriPoze: string[] = [...(gata?.erori ?? [])];
  for (const i of pozeDepuse(nume)) {
    try {
      const { data, error } = await sb.storage.from(BUCKET).download(cale(p, `poza-${i}`));
      if (error || !data) throw new Error(error?.message ?? "nu se poate citi");
      const r = await urcaPozaImport(depozit, String(piesa.sursa_id), i, Buffer.from(await data.arrayBuffer()));
      urcate.push({ url: r.url, cale: r.cale });
    } catch (e: any) { eroriPoze.push(`poza ${i + 1}: ${e?.message ?? e}`); }
  }
  const renunta = async () => { for (const u of urcate) await depozit.stergePoza(u.cale).catch(() => {}); };

  let rez: any;
  try {
    const taxonomie = await depozit.citesteTaxonomia();
    rez = await piesaDinPagina({
      depozit, taxonomie, html: pagina.html, urlFinal: pagina.url,
      feed: { ID: String(piesa.sursa_id), Titlu: piesa.nume, Pret: piesa.pret_lei, URL: piesa.sursa_url },
      aduPoze: async () => ({ salvate: urcate.map((u) => u.url), erori: eroriPoze, octeti: 0 }),
    });
  } catch (e: any) { await renunta(); return eroare(req, `Anunțul nu s-a putut prelucra: ${e?.message ?? e}`, 500); }

  const { rand, ext } = rez;
  if (!ext.titlu || (!ext.descriere && !ext.poze.length)) {
    await renunta();
    return eroare(req, "Pagina primită nu pare un anunț de piesă (fără titlu, descriere și poze). Nu am schimbat nimic.", 422);
  }

  // Fără poze piesa nu se publică: rămâne ciornă, dar cu descrierea și categoria puse.
  const publica = rand.poze.length > 0;
  const revizuire: string[] = rand.import_erori?.revizuire ?? [];
  const patch = {
    nume: piesa.editat_manual ? piesa.nume : rand.nume,
    stare_nota: rand.stare_nota,
    oem: rand.oem,
    ani: rand.ani ?? piesa.ani,
    art: rand.art,
    categorie_id: rand.categorie_id,
    subcategorie_id: rand.subcategorie_id,
    model_ids: rand.model_ids.length ? rand.model_ids : (piesa.model_ids ?? []),
    compat: rand.compat.length ? rand.compat : (piesa.compat ?? []),
    sursa_url: rand.sursa_url,
    poze: rand.poze,
    poze_sursa: rand.poze_sursa,
    poze_descarcate: rand.poze_descarcate,
    publicat: publica,
    import_erori: publica
      ? { revizuire: ["preluat din browser", ...revizuire] }
      : { ciorna: true, revizuire: ["preluat din browser fără nicio poză — de pus pozele de mână", ...revizuire] },
    sursa_sincronizat_la: rand.sursa_sincronizat_la,
  };

  // Condiționat de „încă ciornă", ca două taburi deschise pe aceeași piesă să nu
  // se calce: al doilea găsește zero rânduri și primește eroare.
  const { data: scrise, error: eScriere } = await sb.from("products").update(patch)
    .eq("id", piesa.id).filter("import_erori->>ciorna", "eq", "true").select("id");
  if (eScriere || !scrise?.length) {
    await renunta();
    return eroare(req, `Piesa nu s-a putut salva${eScriere ? `: ${eScriere.message}` : " (nu mai e ciornă)"}.`, 409);
  }
  await goleste(sb, p).catch(() => {});

  return raspuns(req, {
    ok: true, publicata: publica,
    piesa: { id: piesa.id, cod_intern: piesa.cod_intern, slug: piesa.slug },
    rezumat: {
      titlu: patch.nume, poze: rand.poze.length, oem: rand.oem,
      categorie: rez.cat?.subcategorie ?? rez.cat?.categorie ?? null,
      categorie_id: rand.categorie_id, modele: patch.model_ids.length, descriere: (rand.stare_nota ?? "").length,
    },
    revizuire,
  });
}
