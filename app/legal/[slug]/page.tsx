import { sbServer } from "@/lib/supabase";
import type { Product, Category, Brand, Model } from "@/lib/types";
import VehicleFilter from "@/components/VehicleFilter";
import PartRequestForm from "@/components/PartRequestForm";
import { fitmentCounts } from "@/lib/format";
import ProductCard from "@/components/ProductCard";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Piese auto" };

type SP = { q?: string; oem?: string; categorie?: string; vehicul?: string; stare?: string; sort?: string; marca?: string; model?: string };

export default async function Piese({ searchParams }: { searchParams: SP }) {
  const sb = sbServer();
  let products: Product[] = []; let cats: Category[] = []; let titlu = "Toate piesele";
  let brands: Brand[] = []; let models: Model[] = []; let fitRows: { model_ids: number[] }[] = [];
  if (sb) {
    cats = ((await sb.from("categories").select("*").order("ordine")).data ?? []) as Category[];
    brands = ((await sb.from("brands").select("*").order("ordine")).data ?? []) as Brand[];
    models = ((await sb.from("models").select("*").order("nume")).data ?? []) as Model[];
    fitRows = ((await sb.from("products").select("model_ids").eq("publicat", true)).data ?? []) as { model_ids: number[] }[];
    let q = sb.from("products").select("*, categories(*), vehicles(*)").eq("publicat", true);
    if (searchParams.categorie) {
      const c = cats.find((x) => x.slug === searchParams.categorie);
      if (c) { q = q.eq("categorie_id", c.id); titlu = c.nume; }
    }
    if (searchParams.vehicul) {
      const v = (await sb.from("vehicles").select("*").eq("slug", searchParams.vehicul).single()).data;
      if (v) { q = q.eq("vehicul_id", v.id); titlu = `Piese din ${v.nume} · ${v.an}`; }
    }
    // filtrarea din listele fixe: model exact sau toată marca
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
        titlu = `Piese pentru ${b.nume}`;
      }
    }
    if (searchParams.categorie && (searchParams.marca || searchParams.model)) {
      const c = cats.find((x) => x.slug === searchParams.categorie);
      if (c) titlu += ` — ${c.nume}`;
    }
    if (searchParams.stare) q = q.eq("stare", searchParams.stare);
    const text = searchParams.q || searchParams.oem;
    if (text) { q = q.or(`nume.ilike.%${text}%,oem.ilike.%${text}%`); titlu = `Rezultate pentru „${text}”`; }
    if (searchParams.sort === "pret-asc") q = q.order("pret_lei", { ascending: true });
    else if (searchParams.sort === "pret-desc") q = q.order("pret_lei", { ascending: false });
    else q = q.order("created_at", { ascending: false });
    products = ((await q).data ?? []) as Product[];
  }
  const qs = (extra: Record<string, string>) => {
    const cur: Record<string, string> = {};
    Object.entries(searchParams).forEach(([k, v]) => { if (v) cur[k] = v; });
    const p = new URLSearchParams({ ...cur, ...extra });
    return `/piese?${p.toString()}`;
  };
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="dim">Acasă / Piese auto</div>
      <h1 className="font-disp font-bold text-3xl mt-2 mb-4">{titlu}</h1>
      <div className="mb-6"><VehicleFilter brands={brands} models={models} cats={cats} counts={fitmentCounts(fitRows, models)} compact /></div>
      <div className="grid lg:grid-cols-[220px,1fr] gap-6">
        <aside className="card p-4 h-fit text-sm">
          <b className="font-disp font-semibold text-[12px] text-mut">Categorii</b>
          <ul className="mt-2 space-y-1">
            <li><Link href="/piese" className={!searchParams.categorie ? "text-acc font-bold" : "hover:text-acc"}>Toate</Link></li>
            {cats.map((c) => (
              <li key={c.id}><Link href={`/piese?categorie=${c.slug}`}
                className={searchParams.categorie === c.slug ? "text-acc font-bold" : "hover:text-acc"}>{c.nume}</Link></li>
            ))}
          </ul>
          <b className="font-disp font-semibold text-[12px] text-mut block mt-5">Stare piesă</b>
          <ul className="mt-2 space-y-1">
            {(["A","B","C"] as const).map((s) => (
              <li key={s}><Link href={qs({ stare: s })} className={searchParams.stare === s ? "text-acc font-bold" : "hover:text-acc"}>
                Stare {s} {s === "A" ? "— testată" : s === "B" ? "— urme de uz" : "— recondiționare"}</Link></li>
            ))}
          </ul>
        </aside>
        <div>
          <div className="flex items-center justify-between mb-4 text-sm">
            <span className="text-mut">{products.length} piese găsite</span>
            <div className="flex gap-3">
              <Link href={qs({ sort: "pret-asc" })} className={searchParams.sort === "pret-asc" ? "text-acc font-bold" : "text-mut hover:text-acc"}>Preț ↑</Link>
              <Link href={qs({ sort: "pret-desc" })} className={searchParams.sort === "pret-desc" ? "text-acc font-bold" : "text-mut hover:text-acc"}>Preț ↓</Link>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
          {products.length === 0 && (
            <div className="card p-10 text-center">
              <b className="font-disp uppercase text-xl">Nicio piesă pentru acest filtru</b>
              <p className="text-mut mt-2 text-sm">Lasă-ne o cerere din pagina de <Link href="/contact" className="text-acc font-bold">contact</Link> — verificăm stocul fizic și te anunțăm.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
