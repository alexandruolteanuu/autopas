import Breadcrumbs from "@/components/Breadcrumbs";
import { sbServer } from "@/lib/supabase";
import type { Product, Category, Brand, Model } from "@/lib/types";
import ProductCard from "@/components/ProductCard";
import VehicleFilter from "@/components/VehicleFilter";
import PartRequestForm from "@/components/PartRequestForm";
import SortSelect from "@/components/SortSelect";
import { fitmentCounts } from "@/lib/format";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Piese auto" };

type SP = { q?: string; oem?: string; categorie?: string; subcategorie?: string; vehicul?: string;
  sort?: string; marca?: string; model?: string };

export default async function Piese({ searchParams }: { searchParams: SP }) {
  const sb = sbServer();
  let products: Product[] = []; let cats: Category[] = []; let titlu = "Toate piesele";
  let brands: Brand[] = []; let models: Model[] = []; let fitRows: { model_ids: number[] }[] = [];
  let catActiva: Category | null = null;

  if (sb) {
    cats = ((await sb.from("categorii_cu_numar").select("*").order("ordine")).data ?? []) as Category[];
    brands = ((await sb.from("brands").select("*").order("ordine")).data ?? []) as Brand[];
    models = ((await sb.from("models").select("*").order("nume")).data ?? []) as Model[];
    fitRows = ((await sb.from("products").select("model_ids").eq("publicat", true)).data ?? []) as { model_ids: number[] }[];

    let q = sb.from("products").select("*, categories(*), vehicles(*)").eq("publicat", true);

    if (searchParams.subcategorie) {
      const s = cats.find((x) => x.slug === searchParams.subcategorie);
      if (s) { q = q.eq("subcategorie_id", s.id); titlu = s.nume; catActiva = s; }
    } else if (searchParams.categorie) {
      const c = cats.find((x) => x.slug === searchParams.categorie);
      if (c) {
        const copii = cats.filter((x) => x.parent_id === c.id).map((x) => x.id);
        q = q.or(`categorie_id.eq.${c.id}${copii.length ? `,subcategorie_id.in.(${copii.join(",")})` : ""}`);
        titlu = c.nume; catActiva = c;
      }
    }
    if (searchParams.vehicul) {
      const v = (await sb.from("vehicles").select("*").eq("slug", searchParams.vehicul).single()).data;
      if (v) { q = q.eq("vehicul_id", v.id); titlu = `Piese din ${v.nume}${v.an ? ` · ${v.an}` : ""}`; }
    }
    if (searchParams.model) {
      const m = models.find((x) => x.slug === searchParams.model);
      if (m) {
        q = q.contains("model_ids", [m.id]);
        const b = brands.find((x) => x.id === m.brand_id);
        titlu = `Piese pentru ${b?.nume ?? ""} ${m.nume}`;
      }
    } else if (searchParams.marca) {
      const b = brands.find((x) => x.slug === searchParams.marca);
      if (b) {
        const ids = models.filter((m) => m.brand_id === b.id).map((m) => m.id);
        if (ids.length) q = q.overlaps("model_ids", ids);
        titlu = `Piese ${b.nume}`;
      }
    }
    if (catActiva && (searchParams.marca || searchParams.model)) titlu += ` — ${catActiva.nume}`;

    const text = searchParams.q || searchParams.oem;
    if (text) { q = q.or(`nume.ilike.%${text}%,oem.ilike.%${text}%,cod_intern.ilike.%${text}%`); titlu = `Rezultate pentru „${text}”`; }

    if (searchParams.sort === "pret-asc") q = q.order("pret_lei", { ascending: true });
    else if (searchParams.sort === "pret-desc") q = q.order("pret_lei", { ascending: false });
    else if (searchParams.sort === "nume") q = q.order("nume", { ascending: true });
    else q = q.order("created_at", { ascending: false });

    products = ((await q).data ?? []) as Product[];
  }

  const principale = cats.filter((c) => !c.parent_id);
  const subAle = (id: number) => cats.filter((c) => c.parent_id === id);
  const parintele = catActiva?.parent_id ? cats.find((c) => c.id === catActiva!.parent_id) : catActiva;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Breadcrumbs items={[{ t: "Acasă", href: "/" },
        { t: "Piese auto", ...(catActiva ? { href: "/piese" } : {}) },
        ...(catActiva?.parent_id ? [{ t: cats.find((c) => c.id === catActiva!.parent_id)?.nume ?? "", href: `/piese?categorie=${cats.find((c) => c.id === catActiva!.parent_id)?.slug}` }] : []),
        ...(catActiva ? [{ t: catActiva.nume }] : [])]} />
      <h1 className="font-disp font-bold text-3xl mt-2 mb-4">{titlu}</h1>
      <div className="mb-6"><VehicleFilter brands={brands} models={models} cats={principale} counts={fitmentCounts(fitRows, models)} compact /></div>

      <div className="grid lg:grid-cols-[250px,1fr] gap-6">
        {/* ===== FILTRUL DE CATEGORII — cu chenar și ierarhie clară ===== */}
        <aside className="card overflow-hidden h-fit lg:sticky lg:top-24">
          <div className="bg-paper px-4 py-3 border-b border-line">
            <b className="font-disp font-semibold text-[13px]">Categorii</b>
          </div>
          <nav className="p-2 text-sm max-h-[70vh] overflow-y-auto">
            <Link href="/piese" className={`block rounded-lg px-3 py-2 ${!catActiva ? "bg-acc/10 text-acc font-semibold" : "hover:bg-paper"}`}>
              Toate piesele</Link>
            {principale.map((c) => {
              const subs = subAle(c.id);
              const deschis = parintele?.id === c.id;
              return (
                <div key={c.id} className="mt-0.5">
                  <Link href={`/piese?categorie=${c.slug}`}
                    className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 ${catActiva?.id === c.id ? "bg-acc/10 text-acc font-semibold" : "hover:bg-paper"}`}>
                    <span>{c.nume}</span>
                    <span className="text-[11px] text-mut">{c.nr_piese ?? 0}</span>
                  </Link>
                  {deschis && subs.length > 0 && (
                    <div className="ml-3 pl-2 border-l-2 border-line mt-0.5">
                      {subs.map((s) => (
                        <Link key={s.id} href={`/piese?subcategorie=${s.slug}`}
                          className={`flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-[13px] ${catActiva?.id === s.id ? "text-acc font-semibold" : "text-steel hover:bg-paper"}`}>
                          <span>{s.nume}</span><span className="text-[11px] text-mut">{s.nr_piese ?? 0}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </aside>

        <div>
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <span className="text-sm text-mut">{products.length} {products.length === 1 ? "piesă găsită" : "piese găsite"}</span>
            <SortSelect />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
          {products.length === 0 && (
            <div className="card p-8">
              <b className="font-disp font-bold text-xl block text-center">Nicio piesă pe stoc pentru această selecție — încă</b>
              <p className="text-mut mt-2 text-sm text-center max-w-xl mx-auto">Stocul se schimbă săptămânal, pe măsură ce dezmembrăm mașini noi. Lasă o cerere — te anunțăm imediat ce piesa intră în stoc.</p>
              <div className="max-w-2xl mx-auto mt-5"><PartRequestForm sursa="filtru-fara-rezultate" /></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
