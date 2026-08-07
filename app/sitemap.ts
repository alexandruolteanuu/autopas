// ============================================================
// sitemap.xml — generat automat de Next la /sitemap.xml
//
// Conține paginile publice fixe, documentele legale și fiecare piesă
// publicată. NU conține filtrele de catalog (`/piese?categorie=…`): sunt
// aceleași produse rearanjate, iar Google le-ar trata drept conținut duplicat.
// Nu conține nici coșul, contul sau adminul.
//
// Se reface la fiecare oră, ca piesele noi să apară fără un redeploy.
// ============================================================
import type { MetadataRoute } from "next";
import { sbServer } from "@/lib/supabase";
import { LEGAL_SLUGS } from "@/lib/legal";
import { SITE_URL } from "@/lib/config";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const acum = new Date();

  // Paginile fixe, cu importanța relativă în site.
  const fixe: { cale: string; prioritate: number; frecventa: "daily" | "weekly" | "monthly" | "yearly" }[] = [
    { cale: "", prioritate: 1.0, frecventa: "daily" },
    { cale: "/piese", prioritate: 0.9, frecventa: "daily" },
    { cale: "/cauta-dupa-masina", prioritate: 0.8, frecventa: "weekly" },
    { cale: "/preda-masina", prioritate: 0.7, frecventa: "monthly" },
    { cale: "/programul-rabla", prioritate: 0.7, frecventa: "monthly" },
    { cale: "/despre-noi", prioritate: 0.6, frecventa: "monthly" },
    { cale: "/contact", prioritate: 0.6, frecventa: "monthly" },
    { cale: "/faq", prioritate: 0.6, frecventa: "monthly" },
    { cale: "/formular-retur", prioritate: 0.4, frecventa: "yearly" },
  ];

  const intrari: MetadataRoute.Sitemap = fixe.map((p) => ({
    url: `${SITE_URL}${p.cale}`,
    lastModified: acum,
    changeFrequency: p.frecventa,
    priority: p.prioritate,
  }));

  // Documentele legale — lista vine din lib/legal.ts, deci rămâne sincronizată.
  for (const d of LEGAL_SLUGS) {
    intrari.push({
      url: `${SITE_URL}/legal/${d.slug}`,
      lastModified: acum,
      changeFrequency: "yearly",
      priority: 0.3,
    });
  }

  // Piesele publicate, cu stoc. Dacă baza nu e configurată, sitemap-ul rămâne
  // valid, doar fără produse — nu vrem să pice build-ul din cauza asta.
  const sb = sbServer();
  if (sb) {
    const { data } = await sb
      .from("products")
      .select("slug, created_at")
      .eq("publicat", true)
      .gt("stoc", 0)
      .order("created_at", { ascending: false })
      .limit(5000);

    for (const p of data ?? []) {
      intrari.push({
        url: `${SITE_URL}/piese/${p.slug}`,
        lastModified: p.created_at ? new Date(p.created_at) : acum,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  }

  return intrari;
}
