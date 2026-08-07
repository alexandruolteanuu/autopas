// ============================================================
// robots.txt — generat automat de Next la /robots.txt
//
// Cât timp site-ul nu e lansat, cerem motoarelor de căutare să NU indexeze
// nimic: altfel piesele de probă ar ajunge în Google și ar rămâne acolo
// luni de zile după ce le ștergi.
//
// LA LANSARE: în Vercel → Settings → Environment Variables adaugi
//   PERMITE_INDEXARE = da
// și redeployezi. Din acel moment site-ul devine indexabil.
// ============================================================
import type { MetadataRoute } from "next";
import { SITE_URL, INDEXARE_PERMISA } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  if (!INDEXARE_PERMISA) {
    // Înainte de lansare: nimic nu se indexează și nu anunțăm sitemap-ul.
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Pagini care nu au ce căuta în rezultate: panoul de administrare,
        // contul clientului și pașii de cumpărare (conținut personal sau tranzitoriu).
        disallow: [
          "/admin",
          "/admin/",
          "/cont",
          "/autentificare",
          "/cos",
          "/checkout",
          "/comanda-plasata",
          "/favorite",
          "/api/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
