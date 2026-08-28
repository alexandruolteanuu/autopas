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
import { sbServer, citesteTot } from "@/lib/supabase";
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
    // PAGINAT. Varianta veche cerea `.limit(5000)` și primea 1.000: `limit` poate
    // doar COBORÎ plafonul serverului, niciodată să-l ridice. Sitemap-ul avea deci
    // 1.000 din 8.754 de piese, iar restul de 7.754 nu erau niciodată trimise
    // către Google — pagini bune, invizibile.
    // Ordinea e după `id`, nu după `created_at`: importul scrie sute de piese în
    // aceeași secundă, iar o ordine neunică poate repeta un rând între pagini și
    // sări peste altul.
    const data = await citesteTot<{ slug: string; created_at: string }>(
      () => sb.from("products")
        .select("slug, created_at", { count: "exact" })
        .eq("publicat", true).gt("stoc", 0).order("id"),
      { eticheta: "piesele pentru sitemap" },
    );

    for (const p of data ?? []) {
      intrari.push({
        url: `${SITE_URL}/piese/${p.slug}`,
        lastModified: p.created_at ? new Date(p.created_at) : acum,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }

    // Mașinile dezmembrate publicate. Prioritate mare, fiindcă „dezmembrari
    // passat b7 2012" e o căutare mult mai frecventă decât un cod OEM.
    // Intră și mașinile fără piese listate încă: pagina lor nu e goală (are
    // specificațiile și formularul de cerere), iar o pagină scoasă din sitemap
    // și reintrodusă mai târziu își pierde poziția câștigată.
    const masini = await citesteTot<{ slug: string; intrare: string }>(
      () => sb.from("vehicles").select("slug, intrare", { count: "exact" })
        .eq("publicat", true).order("id"),
      { eticheta: "mașinile pentru sitemap" },
    );

    for (const v of masini ?? []) {
      intrari.push({
        url: `${SITE_URL}/masini/${v.slug}`,
        lastModified: v.intrare ? new Date(v.intrare) : acum,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }

    intrari.push({ url: `${SITE_URL}/masini`, lastModified: acum, changeFrequency: "weekly", priority: 0.8 });
  }

  return intrari;
}
