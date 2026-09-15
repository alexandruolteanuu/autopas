// ============================================================
// PRELUAREA UNUI ANUNȚ DIN BROWSERUL OPERATORULUI — ciornele din „Piese noi din CSV"
//
// DE CE (cerut de proprietar, 15 septembrie 2026)
// pieseauto.ro refuză cererile serverului nostru (pagina „sorry"), deci pozele și
// descrierea ciornelor nu se mai pot aduce din import. NU le ocolim blocarea (alt
// IP, antete de browser): anunțul îl deschide operatorul, în browserul lui, cum
// l-ar deschide oricine, iar butonul din bara de favorite („Preia în Autopas",
// generat în `/admin/piese-noi`) trimite pagina și pozele — deja încărcate acolo —
// către `/admin/preia-anunt`, care le trimite aici. Serverul nostru nu face nicio
// cerere la pieseauto.ro.
//
// Două acțiuni, amândouă doar pentru echipă:
//   · POST ?actiune=poza&id=<piesă>&i=<index>  — corpul e poza (octeți); se convertește
//     și se urcă exact ca la import (`urcaPozaImport`). Una pe cerere: o funcție
//     Vercel primește cel mult 4,5 MB, iar opt poze originale trec ușor de atât.
//   · POST { actiune: "salveaza", id, url, html, poze, erori_poze } — rulează
//     `piesaDinPagina`, ACEEAȘI funcție ca importul clasic (categorie, modele, cod
//     OEM, descriere întreagă), și completează ciorna. Se publică doar dacă are poze.
//   · POST { actiune: "renunta", poze } — șterge pozele urcate, dacă salvarea a picat.
//
// Gărzi: piesa trebuie să fie ÎNCĂ ciornă (dacă a completat-o cineva între timp,
// nu se suprascrie nimic), iar ID-ul din adresa anunțului trebuie să fie chiar
// `sursa_id`-ul piesei — altfel s-ar putea lipi pozele unui anunț pe altă piesă.
// ============================================================
import { NextResponse } from "next/server";
import { esteEchipa, sbAdmin } from "@/lib/supabase";
import { depozitDinMediu, piesaDinPagina, urcaPozaImport, esteCiorna, metaProp, idAnuntDinAdresa } from "@/lib/import/index.mjs";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const raspuns = (date: any, stare = 200) => NextResponse.json(date, { status: stare });
const eroare = (mesaj: string, stare = 400) => raspuns({ ok: false, eroare: mesaj }, stare);

/** Sub plafonul de 4,5 MB al unei cereri către o funcție Vercel. Browserul
 *  micșorează înainte orice poză mai mare (vezi `/admin/preia-anunt`). */
const MAX_POZA = 4 * 1024 * 1024;
/** Pagina unui anunț are câteva sute de KB; peste atât nu e o pagină de produs. */
const MAX_HTML = 3 * 1024 * 1024;

/** JPEG, PNG, WebP sau GIF, după primii octeți — nu după ce pretinde cererea. */
function estePoza(b: Uint8Array) {
  const s = (i: number, t: string) => t.split("").every((c, k) => b[i + k] === c.charCodeAt(0));
  return (b[0] === 0xff && b[1] === 0xd8) || s(1, "PNG") || (s(0, "RIFF") && s(8, "WEBP")) || s(0, "GIF8");
}

/** Prefixul adreselor din bucketul de poze, fără bara finală din variabila de mediu. */
const prefixPoze = () =>
  `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "")}/storage/v1/object/public/poze-piese/`;

/** Doar pozele urcate de acțiunea `poza` pentru ACEASTĂ piesă sunt acceptate. */
function caleValida(url: unknown, sursaId: string): string | null {
  if (typeof url !== "string" || !url.startsWith(prefixPoze())) return null;
  const cale = url.slice(prefixPoze().length);
  return new RegExp(`^\\d{4}/import-${sursaId}-\\d+-[a-z0-9]+\\.(webp|jpg)$`).test(cale) ? cale : null;
}

export async function POST(req: Request) {
  if (!(await esteEchipa(req))) return eroare("Doar echipa poate prelua anunțuri.", 401);
  const sb = sbAdmin();
  if (!sb) return eroare("Serverul nu are cheia de serviciu Supabase.", 500);

  let depozit: any;
  try { depozit = depozitDinMediu(); } catch (e: any) { return eroare(e?.message ?? String(e), 500); }

  const q = new URL(req.url).searchParams;

  // ---------- o poză ----------
  if (q.get("actiune") === "poza") {
    const id = Number(q.get("id")), i = Number(q.get("i"));
    if (!Number.isInteger(id) || !Number.isInteger(i) || i < 0 || i > 50) return eroare("Parametri greșiți.");
    const { data: p } = await sb.from("products").select("id,sursa_id,import_erori").eq("id", id).maybeSingle();
    if (!p || !esteCiorna(p)) return eroare("Piesa nu există sau nu mai e ciornă.", 409);
    const brut = new Uint8Array(await req.arrayBuffer());
    if (!brut.length) return eroare("Poza a sosit goală.");
    if (brut.length > MAX_POZA) return eroare("Poza e prea mare (peste 4 MB).", 413);
    if (!estePoza(brut)) return eroare("Fișierul primit nu e o poză.", 415);
    try {
      const r = await urcaPozaImport(depozit, String(p.sursa_id), i, Buffer.from(brut));
      return raspuns({ ok: true, url: r.url });
    } catch (e: any) { return eroare(`Poza nu s-a putut urca: ${e?.message ?? e}`, 502); }
  }

  let body: any;
  try { body = await req.json(); } catch { return eroare("Cerere nevalidă."); }

  // ---------- renunțare: pozele urcate degeaba ----------
  if (body.actiune === "renunta") {
    const { data: p } = await sb.from("products").select("sursa_id").eq("id", Number(body.id)).maybeSingle();
    if (!p) return raspuns({ ok: true, sterse: 0 });
    let sterse = 0;
    for (const u of Array.isArray(body.poze) ? body.poze : []) {
      const cale = caleValida(u, String(p.sursa_id));
      if (!cale) continue;
      try { await depozit.stergePoza(cale); sterse++; } catch { /* rămâne pentru curata-orfani.mjs */ }
    }
    return raspuns({ ok: true, sterse });
  }

  if (body.actiune !== "salveaza") return eroare("Acțiune necunoscută.");

  // ---------- salvarea ----------
  const id = Number(body.id);
  const html = typeof body.html === "string" ? body.html : "";
  const adresa = typeof body.url === "string" ? body.url : "";
  if (!Number.isInteger(id)) return eroare("Lipsește piesa.");
  if (!html || html.length > MAX_HTML) return eroare("Pagina anunțului lipsește sau e prea mare.");

  const { data: p, error } = await sb.from("products")
    .select("id,nume,pret_lei,ani,model_ids,compat,sursa,sursa_id,sursa_url,sursa_activ,editat_manual,import_erori,cod_intern,slug")
    .eq("id", id).maybeSingle();
  if (error || !p) return eroare("Piesa nu există.", 404);
  if (p.sursa !== "pieseauto.ro" || !esteCiorna(p))
    return eroare("Piesa nu mai e ciornă — a completat-o cineva între timp. Nu am suprascris nimic.", 409);

  // Anunțul trimis trebuie să fie chiar al piesei: din adresa tabului ȘI din og:url.
  const idAdresa = idAnuntDinAdresa(adresa);
  const og = metaProp(html, "og:url");
  const idOg = og ? idAnuntDinAdresa(og) : null;
  if (idAdresa !== String(p.sursa_id) || (idOg && idOg !== String(p.sursa_id)))
    return eroare(`Anunțul deschis (${idOg ?? idAdresa ?? "necunoscut"}) nu e al piesei ${p.cod_intern} (${p.sursa_id}).`, 409);

  const poze: string[] = [];
  for (const u of Array.isArray(body.poze) ? body.poze : []) {
    if (!caleValida(u, String(p.sursa_id))) return eroare("O poză nu vine din preluarea acestei piese.");
    poze.push(u);
  }
  const eroriPoze = (Array.isArray(body.erori_poze) ? body.erori_poze : []).map((x: unknown) => String(x).slice(0, 200)).slice(0, 20);

  let rez: any;
  try {
    const taxonomie = await depozit.citesteTaxonomia();
    rez = await piesaDinPagina({
      depozit, taxonomie, html, urlFinal: adresa,
      feed: { ID: String(p.sursa_id), Titlu: p.nume, Pret: p.pret_lei, URL: p.sursa_url },
      aduPoze: async () => ({ salvate: poze, erori: eroriPoze, octeti: 0 }),
    });
  } catch (e: any) { return eroare(`Anunțul nu s-a putut prelucra: ${e?.message ?? e}`, 500); }

  const { rand, ext } = rez;
  // Pagina „sorry" sau altă pagină decât anunțul: n-are titlu, descriere și poze.
  if (!ext.titlu || (!ext.descriere && !ext.poze.length))
    return eroare("Pagina primită nu pare un anunț de piesă (fără titlu, descriere și poze). Nu am schimbat nimic.", 422);

  // Fără poze piesa nu se publică: rămâne ciornă, dar cu descrierea și categoria puse.
  const publica = rand.poze.length > 0;
  const revizuire: string[] = rand.import_erori?.revizuire ?? [];
  const patch = {
    nume: p.editat_manual ? p.nume : rand.nume,
    stare_nota: rand.stare_nota,
    oem: rand.oem,
    ani: rand.ani ?? p.ani,
    art: rand.art,
    categorie_id: rand.categorie_id,
    subcategorie_id: rand.subcategorie_id,
    model_ids: rand.model_ids.length ? rand.model_ids : (p.model_ids ?? []),
    compat: rand.compat.length ? rand.compat : (p.compat ?? []),
    sursa_url: rand.sursa_url,
    poze: rand.poze,
    poze_sursa: rand.poze_sursa,
    poze_descarcate: rand.poze_descarcate,
    publicat: publica,
    import_erori: publica
      ? (revizuire.length ? { revizuire: ["preluat din browser", ...revizuire] } : null)
      : { ciorna: true, revizuire: ["preluat din browser fără nicio poză — de pus pozele de mână", ...revizuire] },
    sursa_sincronizat_la: rand.sursa_sincronizat_la,
  };

  // Condiționat de „încă ciornă", ca două taburi deschise pe aceeași piesă să nu
  // se calce: al doilea găsește zero rânduri și primește eroare.
  const { data: scrise, error: eScriere } = await sb.from("products").update(patch)
    .eq("id", id).filter("import_erori->>ciorna", "eq", "true").select("id");
  if (eScriere || !scrise?.length)
    return eroare(`Piesa nu s-a putut salva${eScriere ? `: ${eScriere.message}` : " (nu mai e ciornă)"}.`, 409);

  return raspuns({
    ok: true, publicata: publica,
    piesa: { id: p.id, cod_intern: p.cod_intern, slug: p.slug },
    rezumat: {
      titlu: patch.nume, poze: rand.poze.length, oem: rand.oem,
      categorie: rez.cat?.subcategorie ?? rez.cat?.categorie ?? null,
      categorie_id: rand.categorie_id, modele: patch.model_ids.length, compat: patch.compat,
      descriere: (rand.stare_nota ?? "").length,
    },
    revizuire,
  });
}
