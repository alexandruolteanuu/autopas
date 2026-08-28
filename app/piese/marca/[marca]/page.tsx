// ============================================================
// PIESE DUPĂ MARCĂ — /piese/marca/{marca}
//
// DE CE EXISTĂ CA RUTĂ, NU CA FILTRU
// Două motive, amândouă măsurate:
//
//   1. „piese Dacia" și „piese Skoda" sunt exact ce tastează oamenii în Google.
//      O adresă proprie poate fi indexată și poate aduce trafic singură; un
//      filtru `?marca=dacia` nu, fiindcă e conținut duplicat peste catalog.
//   2. Din 8.739 de piese, doar 343 erau accesibile în trei clicuri din prima
//      pagină. Paginarea catalogului arată prima pagină, ultima și vecinii, deci
//      paginile 3–363 nu erau accesibile crawlerului. Cele 38 de pagini de marcă
//      sparg catalogul în felii pe care se poate umbla.
//
// Piesele se leagă de marcă prin modelele ei: `products.model_ids` ține
// modelele compatibile, iar marca vine de la ele. Nu există o coloană „marcă"
// pe piesă, și nici n-ar trebui — o piesă se potrivește pe mai multe mașini.
// ============================================================
import { cache } from "react";
import { sbServer, citesteTot } from "@/lib/supabase";
import type { Product, Brand, Model, Category } from "@/lib/types";
import ListarePiese, { LegaturiInrudite } from "@/components/ListarePiese";
import Breadcrumbs from "@/components/Breadcrumbs";
import StareGoala from "@/components/StareGoala";
import PartRequestForm from "@/components/PartRequestForm";
import { IconLupa } from "@/components/Icoane";
import { VacantaStareGoala } from "@/components/VacantaNota";
import { getVacanta } from "@/lib/settings";
import { nrPiese } from "@/lib/format";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const PE_PAGINA = 24;
/** Peste atâtea legături, pagina își diluează singură valoarea. */
const MAX_LEGATURI = 15;

type SP = { pagina?: string };

const adresa = (slug: string, n: number) => `/piese/marca/${slug}${n > 1 ? `?pagina=${n}` : ""}`;

/** Marca și modelele ei. `cache()`, fiindcă le cer și metadatele, și pagina. */
const iaMarca = cache(async (slug: string) => {
  const sb = sbServer();
  if (!sb) return null;
  const { data } = await sb.from("brands").select("*").eq("slug", slug).maybeSingle();
  const marca = (data as Brand | null) ?? null;
  if (!marca) return null;
  const models = await citesteTot<Model>(
    () => sb.from("models").select("*", { count: "exact" }).eq("brand_id", marca.id).order("id"),
    { eticheta: "modelele mărcii" });
  return { marca, models };
});

/** O pagină de piese ale mărcii, cu numărul total. */
const iaPiese = cache(async (idsModele: string, pagina: number) => {
  const sb = sbServer();
  const ids = idsModele ? idsModele.split(",").map(Number) : [];
  if (!sb || ids.length === 0) return { produse: [] as Product[], total: 0 };
  const de = (pagina - 1) * PE_PAGINA;
  const r = await sb.from("products")
    .select("*, categories!products_categorie_id_fkey(*), vehicles(*)", { count: "exact" })
    .eq("publicat", true).gt("stoc", 0)
    .overlaps("model_ids", ids)
    // Ordine pe o coloană unică, altfel aceeași piesă poate apărea pe două
    // pagini și alta pe niciuna — `created_at` nu e unic, importul scrie sute
    // de rânduri în aceeași secundă.
    .order("created_at", { ascending: false }).order("id", { ascending: false })
    .range(de, de + PE_PAGINA - 1);
  return { produse: (r.data ?? []) as Product[], total: r.count ?? 0 };
});

export async function generateMetadata({ params, searchParams }:
  { params: { marca: string }; searchParams: SP }): Promise<Metadata> {
  const d = await iaMarca(params.marca);
  if (!d) return { title: "Marcă negăsită" };
  const pagina = Math.max(1, Number(searchParams.pagina) || 1);
  const { total } = await iaPiese(d.models.map((m) => m.id).join(","), pagina);
  const titlu = pagina > 1
    ? `Piese ${d.marca.nume} — pagina ${pagina}`
    : `Piese ${d.marca.nume} din dezmembrări`;
  // `nrPiese` face acordul corect: „1 piesă", „3 piese", „20 de piese", dar
  // „1009 piese" — nu „1009 de piese".
  const cate = nrPiese(total);
  return {
    title: titlu,
    description: total > 0
      ? (pagina > 1
          ? `Pagina ${pagina} din piesele ${d.marca.nume} — ${cate} din dezmembrări, pe stoc, cu garanție 90 de zile.`
          : `${cate} ${d.marca.nume} din dezmembrări, pe stoc. Testate, cu garanție 90 de zile și livrare în toată țara.`)
      : `Piese ${d.marca.nume} din dezmembrări. Spune-ne ce cauți și verificăm în depozit.`,
    alternates: { canonical: adresa(params.marca, pagina) },
  };
}

export default async function PieseMarca({ params, searchParams }:
  { params: { marca: string }; searchParams: SP }) {
  const d = await iaMarca(params.marca);
  if (!d) notFound();
  const { marca, models } = d;

  const pagina = Math.max(1, Number(searchParams.pagina) || 1);
  const vacanta = await getVacanta();
  const { produse, total } = await iaPiese(models.map((m) => m.id).join(","), pagina);
  const ultimaPagina = Math.max(1, Math.ceil(total / PE_PAGINA));

  // Categoriile care au piese de marca asta, din view — o singură interogare,
  // câteva zeci de rânduri. Vezi supabase/piese-marca-categorie.sql.
  const sb = sbServer();
  const perechi = sb
    ? (((await sb.from("piese_pe_marca_categorie").select("categorie_id,nr_piese")
        .eq("marca_id", marca.id).order("nr_piese", { ascending: false })
        .limit(MAX_LEGATURI + 1)).data ?? []) as { categorie_id: number; nr_piese: number }[])
    : [];
  const categorii = sb && perechi.length
    ? (((await sb.from("categories").select("id,slug,nume")
        .in("id", perechi.map((x) => x.categorie_id))).data ?? []) as Pick<Category, "id" | "slug" | "nume">[])
    : [];
  const legaturi = perechi.slice(0, MAX_LEGATURI).map((x) => {
    const c = categorii.find((y) => y.id === x.categorie_id);
    return c ? { href: `/piese/categorie/${c.slug}`, nume: c.nume, nr: Number(x.nr_piese) } : null;
  }).filter(Boolean) as { href: string; nume: string; nr: number }[];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumbs items={[
        { t: "Acasă", href: "/" },
        { t: "Piese auto", href: "/piese" },
        { t: `Piese ${marca.nume}` },
      ]} />

      <h1 className="t-sectiune mt-2">Piese {marca.nume} din dezmembrări</h1>
      {!vacanta.activ && (
        <p className="text-textSecundar mt-2 text-[15px]">
          {total > 0 ? <>{nrPiese(total)} pe stoc{ultimaPagina > 1 && <> · pagina {pagina} din {ultimaPagina}</>}</>
                     : "Nicio piesă pe stoc chiar acum."}
        </p>
      )}

      <div className="mt-6">
        {vacanta.activ ? (
          <VacantaStareGoala vacanta={vacanta} titlu="Suntem în pauză" />
        ) : produse.length > 0 ? (
          <ListarePiese produse={produse} pagina={pagina} ultimaPagina={ultimaPagina}
            adresa={(n) => adresa(params.marca, n)} />
        ) : (
          <StareGoala
            icon={<IconLupa className="w-7 h-7" />}
            titlu={`Nicio piesă ${marca.nume} pe stoc acum`}
            text="Stocul se schimbă săptămânal, pe măsură ce dezmembrăm mașini noi. Lasă-ne o cerere și te anunțăm."
            actiune={{ eticheta: "Vezi tot catalogul", href: "/piese" }}
            copii={<div className="max-w-2xl mx-auto text-left"><PartRequestForm sursa={`marca:${marca.slug}`} /></div>}
          />
        )}
      </div>

      {!vacanta.activ && (
        <LegaturiInrudite
          titlu={`Categorii cu piese ${marca.nume}`}
          intrari={legaturi}
          toate={perechi.length > MAX_LEGATURI ? { href: "/piese", eticheta: "Toate categoriile" } : undefined}
        />
      )}
    </div>
  );
}
