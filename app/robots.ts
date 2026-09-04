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
//
// ⚠ EXCEPȚIA /feed/ — nu e o scăpare, e obligatorie.
// Google Merchant Center nu descarcă feed-ul cu un client oarecare: îl cere cu
// Googlebot, și RESPECTĂ robots.txt. Cu un `Disallow: /` care acoperă și
// /feed/, Merchant Center raportează „nu am putut prelua feedul" și contul
// rămâne fără produse — inclusiv acum, înainte de lansare, când tocmai vrem să
// pornim campaniile cu catalogul deja pregătit.
//
// Feed-urile tot nu ajung în rezultatele căutării: fiecare răspuns pleacă cu
// antetul `X-Robots-Tag: noindex` (vezi lib/feed-raspuns.ts). Diferența e
// esențială — „noindex" înseamnă „citește, dar nu publica", pe când
// „Disallow" înseamnă „nici măcar nu citi".
// ============================================================
import type { MetadataRoute } from "next";
import { SITE_URL, INDEXARE_PERMISA } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  if (!INDEXARE_PERMISA) {
    // Înainte de lansare: nu se indexează nimic și nu anunțăm sitemap-ul, dar
    // feed-urile de produse rămân accesibile roboților Google și Meta.
    return { rules: [{ userAgent: "*", allow: "/feed/", disallow: "/" }] };
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
