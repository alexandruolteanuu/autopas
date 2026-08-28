// ============================================================
// PIESE DINTR-O CATEGORIE — /piese/categorie/{categorie}
//
// Perechea rutei de marcă. Aceleași două motive: „faruri Passat" e o căutare
// reală, iar cele 299 de categorii cu piese sparg catalogul în felii pe care
// crawlerul poate umbla — din 8.739 de piese, doar 343 erau accesibile în trei
// clicuri.
//
// O SINGURĂ RUTĂ pentru grupe și subcategorii, fiindcă stau în aceeași tabelă
// `categories` (`parent_id` le desparte) și slug-urile lor sunt distincte pe tot
// tabelul — verificat: 349 de categorii, 349 de slug-uri, zero coliziuni și cu
// cele 42 de mărci. Deci `/piese/categorie/{slug}` e neambiguu.
//
// O GRUPĂ ADUCE ȘI PIESELE SUBCATEGORIILOR EI. Altfel „Optică și faruri" ar
// arăta doar piesele puse direct pe grupă — de obicei foarte puține — deși
// subcategoriile ei au sute.
// ============================================================
import { cache } from "react";
import { sbServer, citesteTot } from "@/lib/supabase";
import type { Product, Brand, Category } from "@/lib/types";
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
const MAX_LEGATURI = 15;

type SP = { pagina?: string };

const adresa = (slug: string, n: number) => `/piese/categorie/${slug}${n > 1 ? `?pagina=${n}` : ""}`;

/** Categoria și, dacă e grupă, subcategoriile ei. */
const iaCategoria = cache(async (slug: string) => {
  const sb = sbServer();
  if (!sb) return null;
  const { data } = await sb.from("categories").select("*").eq("slug", slug).maybeSingle();
  const cat = (data as Category | null) ?? null;
  if (!cat) return null;
  const copii = cat.parent_id
    ? []
    : await citesteTot<Category>(
        () => sb.from("categories").select("*", { count: "exact" }).eq("parent_id", cat.id).order("id"),
        { eticheta: "subcategoriile" });
  return { cat, copii };
});

const iaPiese = cache(async (ids: string, pagina: number) => {
  const sb = sbServer();
  const lista = ids.split(",").map(Number).filter(Boolean);
  if (!sb || lista.length === 0) return { produse: [] as Product[], total: 0 };
  const de = (pagina - 1) * PE_PAGINA;
  const r = await sb.from("products")
    .select("*, categories!products_categorie_id_fkey(*), vehicles(*)", { count: "exact" })
    .eq("publicat", true).gt("stoc", 0)
    // Piesa poate fi pusă pe grupă SAU pe subcategorie; le acoperim pe amândouă.
    .or(`categorie_id.in.(${lista.join(",")}),subcategorie_id.in.(${lista.join(",")})`)
    .order("created_at", { ascending: false }).order("id", { ascending: false })
    .range(de, de + PE_PAGINA - 1);
  return { produse: (r.data ?? []) as Product[], total: r.count ?? 0 };
});

export async function generateMetadata({ params, searchParams }:
  { params: { categorie: string }; searchParams: SP }): Promise<Metadata> {
  const d = await iaCategoria(params.categorie);
  if (!d) return { title: "Categorie negăsită" };
  const pagina = Math.max(1, Number(searchParams.pagina) || 1);
  const ids = [d.cat.id, ...d.copii.map((c) => c.id)].join(",");
  const { total } = await iaPiese(ids, pagina);
  const cate = nrPiese(total);
  return {
    title: pagina > 1 ? `${d.cat.nume} — pagina ${pagina}` : `${d.cat.nume} din dezmembrări`,
    description: total > 0
      ? (pagina > 1
          ? `Pagina ${pagina} din categoria ${d.cat.nume} — ${cate} second-hand, testate, cu garanție 90 de zile.`
          : `${cate} din categoria ${d.cat.nume}, second-hand, testate. Garanție 90 de zile și livrare în toată țara.`)
      : `${d.cat.nume} din dezmembrări. Spune-ne ce cauți și verificăm în depozit.`,
    alternates: { canonical: adresa(params.categorie, pagina) },
  };
}

export default async function PieseCategorie({ params, searchParams }:
  { params: { categorie: string }; searchParams: SP }) {
  const d = await iaCategoria(params.categorie);
  if (!d) notFound();
  const { cat, copii } = d;

  const pagina = Math.max(1, Number(searchParams.pagina) || 1);
  const vacanta = await getVacanta();
  const ids = [cat.id, ...copii.map((c) => c.id)].join(",");
  const { produse, total } = await iaPiese(ids, pagina);
  const ultimaPagina = Math.max(1, Math.ceil(total / PE_PAGINA));

  // Mărcile care au piese în categoria asta, din același view ca la ruta de marcă.
  const sb = sbServer();
  type PerecheMarca = { marca_id: number; nr_piese: number };
  const perechi: PerecheMarca[] = sb
    ? (((await sb.from("piese_pe_marca_categorie").select("marca_id,nr_piese")
        .in("categorie_id", [cat.id, ...copii.map((c) => c.id)])
        .order("nr_piese", { ascending: false }).limit(MAX_LEGATURI * 3)).data ?? []) as PerecheMarca[])
    : [];
  // O grupă are câte un rând pe subcategorie pentru aceeași marcă; le adunăm.
  // Obiect simplu, nu `Map`: `tsconfig` țintește ES5, unde răspândirea unui
  // iterator de `Map` n-are voie.
  const peMarca: Record<number, number> = {};
  for (const x of perechi) peMarca[x.marca_id] = (peMarca[x.marca_id] ?? 0) + Number(x.nr_piese);
  const idsMarci = Object.keys(peMarca).map(Number);
  const marci = sb && idsMarci.length
    ? (((await sb.from("brands").select("id,slug,nume").in("id", idsMarci)).data ?? []) as Pick<Brand, "id" | "slug" | "nume">[])
    : [];
  const legaturi = idsMarci
    .sort((a, b) => peMarca[b] - peMarca[a])
    .slice(0, MAX_LEGATURI)
    .map((id) => {
      const m = marci.find((y) => y.id === id);
      return m ? { href: `/piese/marca/${m.slug}`, nume: m.nume, nr: peMarca[id] } : null;
    }).filter(Boolean) as { href: string; nume: string; nr: number }[];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumbs items={[
        { t: "Acasă", href: "/" },
        { t: "Piese auto", href: "/piese" },
        { t: cat.nume },
      ]} />

      <h1 className="t-sectiune mt-2">{cat.nume} din dezmembrări</h1>
      {!vacanta.activ && (
        <p className="text-textSecundar mt-2 text-[15px]">
          {total > 0 ? <>{nrPiese(total)} pe stoc{ultimaPagina > 1 && <> · pagina {pagina} din {ultimaPagina}</>}</>
                     : "Nicio piesă pe stoc chiar acum."}
        </p>
      )}

      {/* Subcategoriile unei grupe: și navigație pentru om, și legături pentru
          crawler către rutele lor proprii. */}
      {!vacanta.activ && copii.length > 0 && (
        <LegaturiInrudite titlu="Alege mai exact"
          intrari={copii.slice(0, MAX_LEGATURI).map((c) => ({
            href: `/piese/categorie/${c.slug}`, nume: c.nume, nr: c.nr_piese ?? 0 }))} />
      )}

      <div className="mt-6">
        {vacanta.activ ? (
          <VacantaStareGoala vacanta={vacanta} titlu="Suntem în pauză" />
        ) : produse.length > 0 ? (
          <ListarePiese produse={produse} pagina={pagina} ultimaPagina={ultimaPagina}
            adresa={(n) => adresa(params.categorie, n)} />
        ) : (
          <StareGoala
            icon={<IconLupa className="w-7 h-7" />}
            titlu={`Nicio piesă din ${cat.nume} pe stoc acum`}
            text="Stocul se schimbă săptămânal, pe măsură ce dezmembrăm mașini noi. Lasă-ne o cerere și te anunțăm."
            actiune={{ eticheta: "Vezi tot catalogul", href: "/piese" }}
            copii={<div className="max-w-2xl mx-auto text-left"><PartRequestForm sursa={`categorie:${cat.slug}`} /></div>}
          />
        )}
      </div>

      {!vacanta.activ && (
        <LegaturiInrudite titlu={`Mărci cu piese din ${cat.nume}`} intrari={legaturi} />
      )}
    </div>
  );
}
