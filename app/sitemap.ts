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

    // ---- paginile de marcă ----
    // Toate mărcile care au măcar o piesă. Fără prag: „piese Alfa Romeo" e o
    // căutare la fel de legitimă ca „piese Volkswagen", iar 8 piese invizibile
    // sunt 8 piese pierdute (aceeași regulă ca la filtrul de pe site).
    const marci = await citesteTot<{ slug: string; nr_piese: number }>(
      () => sb.from("numar_piese_pe_marca").select("slug,nr_piese", { count: "exact" })
        .gt("nr_piese", 0).order("marca_id"),
      { eticheta: "mărcile pentru sitemap" },
    );
    for (const m of marci) {
      intrari.push({ url: `${SITE_URL}/piese/marca/${m.slug}`, lastModified: acum,
        changeFrequency: "weekly", priority: 0.7 });
    }

    // ---- paginile de categorie ----
    // PRAG DE 3 PIESE. O categorie cu una-două piese e o pagină subțire; dacă o
    // trimitem la indexare, Google învață că site-ul are pagini slabe. Ea există
    // ca rută și primește linkuri din sertarul de filtre — doar nu o anunțăm.
    //
    // Regula de IEȘIRE e automată: pragul se aplică la fiecare regenerare a
    // sitemap-ului (o dată pe oră, `revalidate = 3600`), pe numărul de atunci.
    // Când o categorie trece de 3 piese, intră singură; când scade sub, iese.
    // Nu există nicio listă de ținut la zi.
    const PRAG_CATEGORIE = 3;
    const categorii = await citesteTot<{ slug: string; nr_piese: number }>(
      () => sb.from("categorii_cu_numar").select("slug,nr_piese", { count: "exact" })
        .gte("nr_piese", PRAG_CATEGORIE).order("id"),
      { eticheta: "categoriile pentru sitemap" },
    );
    for (const c of categorii) {
      intrari.push({ url: `${SITE_URL}/piese/categorie/${c.slug}`, lastModified: acum,
        changeFrequency: "weekly", priority: 0.7 });
    }
  }

  return intrari;
}
