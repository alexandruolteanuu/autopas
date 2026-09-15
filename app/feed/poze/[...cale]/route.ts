// ============================================================
// /feed/poze/<cale-din-bucket>.jpg — pozele pieselor, ca JPEG, pentru pieseauto.ro
//
// Pozele stau în bucket ca WebP (20.147 din 20.220, măsurat la 15 septembrie 2026).
// Exemplul de import al pieseauto.ro are `.jpg`, iar un importator vechi poate
// refuza WebP fără să spună de ce — anunțul ar ieși fără poze. Deci pozele din
// feed trec pe aici și pleacă JPEG. Aceeași poză, alt format.
//
// NU e un proxy deschis: acceptă doar căi din bucketul `poze-piese`, fără „..",
// și cere mereu de la adresa noastră de Supabase.
//
// Conversia se face o singură dată pe poză: numele fișierelor din bucket sunt
// unice și nu se rescriu niciodată, deci răspunsul stă în cache-ul CDN un an.
// ============================================================
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CALE_VALIDA = /^[A-Za-z0-9._\-]+(\/[A-Za-z0-9._\-]+)*\.(webp|jpe?g|png)$/i;

export async function GET(_req: Request, { params }: { params: { cale: string[] } }) {
  const brut = (params.cale ?? []).map((c) => decodeURIComponent(c)).join("/");
  if (!brut.toLowerCase().endsWith(".jpg")) return new Response("Negăsit", { status: 404 });
  const cale = brut.slice(0, -4);
  if (!CALE_VALIDA.test(cale) || cale.includes("..")) return new Response("Negăsit", { status: 404 });

  const baza = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  const sursa = await fetch(`${baza}/storage/v1/object/public/poze-piese/${cale}`, { cache: "no-store" }).catch(() => null);
  if (!sursa || !sursa.ok) return new Response("Negăsit", { status: 404 });
  const intrare = Buffer.from(await sursa.arrayBuffer());

  let iesire: Buffer = intrare;
  let tip = sursa.headers.get("content-type") ?? "image/jpeg";
  try {
    const sharp = (await import("sharp")).default;
    iesire = await sharp(intrare).rotate().resize({ width: 1600, withoutEnlargement: true })
      .jpeg({ quality: 85, mozjpeg: true }).toBuffer();
    tip = "image/jpeg";
  } catch {
    // Fără `sharp`, poza pleacă în formatul ei: mai bine o poză WebP decât niciuna.
  }

  return new Response(new Uint8Array(iesire), {
    headers: {
      "content-type": tip,
      "cache-control": "public, max-age=31536000, s-maxage=31536000, immutable",
      "x-robots-tag": "noindex",
    },
  });
}
