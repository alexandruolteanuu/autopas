import { sbServer } from "@/lib/supabase";
import type { Product, Category, Brand, Model } from "@/lib/types";
import AddToCart from "@/components/AddToCart";
import ProductCard from "@/components/ProductCard";
import ProductGallery from "@/components/ProductGallery";
import Breadcrumbs from "@/components/Breadcrumbs";
import FavButton from "@/components/FavButton";
import BackLink from "@/components/BackLink";
import { TrustIcon } from "@/components/TrustBar";
import { lei } from "@/lib/format";
import { waLink } from "@/lib/config";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Produs({ params }: { params: { slug: string } }) {
  const sb = sbServer();
  if (!sb) notFound();
  const { data: p } = await sb.from("products").select("*, categories(*), vehicles(*)").eq("slug", params.slug).single();
  if (!p) notFound();
  const prod = p as Product;
  await sb.rpc("vazut_produs", { p_id: prod.id });

  const models = ((await sb.from("models").select("*")).data ?? []) as Model[];
  const brands = ((await sb.from("brands").select("*")).data ?? []) as Brand[];
  const modeleProd = models.filter((m) => (prod.model_ids ?? []).includes(m.id));
  const marcaProd = brands.find((b) => modeleProd.some((m) => m.brand_id === b.id));
  const subcat = prod.subcategorie_id
    ? ((await sb.from("categories").select("*").eq("id", prod.subcategorie_id).single()).data as Category | null) : null;

  let similare: Product[] = [];
  {
    let q = sb.from("products").select("*").eq("publicat", true).gt("stoc", 0).neq("id", prod.id);
    if (prod.subcategorie_id) q = q.eq("subcategorie_id", prod.subcategorie_id);
    else if (prod.categorie_id) q = q.eq("categorie_id", prod.categorie_id);
    const idsMarca = marcaProd ? models.filter((m) => m.brand_id === marcaProd.id).map((m) => m.id) : [];
    if (idsMarca.length) q = q.overlaps("model_ids", idsMarca);
    similare = ((await q.limit(4)).data ?? []) as Product[];
    if (similare.length === 0 && prod.categorie_id) {
      similare = ((await sb.from("products").select("*").eq("publicat", true).gt("stoc", 0)
        .neq("id", prod.id).eq("categorie_id", prod.categorie_id).limit(4)).data ?? []) as Product[];
    }
  }

  let aceeasiMasina: Product[] = [];
  if (prod.vehicul_id) {
    aceeasiMasina = ((await sb.from("products").select("*").eq("vehicul_id", prod.vehicul_id)
      .neq("id", prod.id).eq("publicat", true).gt("stoc", 0).limit(8)).data ?? []) as Product[];
  }

  const catPrinc = prod.categories;
  const FISA: [string, React.ReactNode][] = [
    ["Marca", marcaProd?.nume ?? "—"],
    ["Model", modeleProd.length ? modeleProd.map((m) => m.nume).join(", ") : (prod.ani ?? "—")],
    ["Subgrupă", subcat?.nume ?? catPrinc?.nume ?? "—"],
    ["Cod OEM", prod.oem || "—"],
    ["Cod intern", prod.cod_intern ?? "—"],
    ["Vă oferim", <span key="o" className="inline-flex flex-wrap gap-x-3 gap-y-1">
      <span className="text-ok">Factură ✓</span><span className="text-ok">Garanție ✓</span><span className="text-ok">Drept de retur ✓</span></span>],
    ["Livrare", "prin curier rapid în 24/48h (contra cost)"],
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex items-center gap-3 flex-wrap mb-3">
        <BackLink />
        <Breadcrumbs items={[
          { t: "Acasă", href: "/" },
          { t: "Piese auto", href: "/piese" },
          ...(catPrinc ? [{ t: catPrinc.nume, href: `/piese?categorie=${catPrinc.slug}` }] : []),
          ...(subcat ? [{ t: subcat.nume, href: `/piese?subcategorie=${subcat.slug}` }] : []),
          { t: prod.nume },
        ]} />
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <ProductGallery poze={prod.poze ?? []} art={prod.art} nume={prod.nume} />

        <div>
          <h1 className="font-disp font-bold text-[22px] leading-snug">{prod.nume}</h1>

          <div className="mt-3 flex items-center gap-2.5 flex-wrap text-[12px]">
            {prod.stoc > 0
              ? <span className="px-2.5 py-1 rounded-full bg-ok/10 text-ok">În stoc</span>
              : <span className="px-2.5 py-1 rounded-full bg-line text-steel">Stoc epuizat</span>}
            <span className="text-mut">Cod intern: {prod.cod_intern ?? "—"}</span>
          </div>

          <div className="mt-4 flex items-end gap-2.5">
            <span className="font-disp font-bold text-[30px] text-acc leading-none">{lei(Number(prod.pret_lei), prod.pret_sufix)}</span>
            <span className="text-mut text-[13px]">TVA inclus</span>
          </div>

          {prod.originala !== false && (
            <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-ok/30 bg-ok/5 px-3.5 py-2.5 text-[13px] text-steel">
              <span className="text-ok shrink-0"><TrustIcon kind="scut" className="w-5 h-5" /></span>
              Piesă auto originală din dezmembrări — verificată înainte de livrare
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2.5">
            {prod.stoc > 0
              ? <div className="flex-1 min-w-[190px]"><AddToCart p={prod} mare /></div>
              : <div className="flex-1 min-w-[190px] rounded-xl bg-line text-steel px-5 py-3 text-sm font-medium text-center">Stoc epuizat — vezi piese similare</div>}
            <a href={waLink(`Bună! Mă interesează: ${prod.nume}${prod.oem ? ` (OEM ${prod.oem})` : ""} — cod ${prod.cod_intern ?? ""}.`)}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-xl bg-[#1FA463] text-white px-5 py-3 text-sm font-semibold hover:brightness-110">
              Întreabă pe WhatsApp</a>
            <FavButton id={prod.id} variant="line" />
          </div>

          <div className="card mt-5 overflow-hidden">
            <div className="bg-paper px-4 py-2.5 border-b border-line"><b className="font-disp font-semibold text-[13px]">Detaliile piesei</b></div>
            <dl className="divide-y divide-line text-[13.5px]">
              {FISA.map(([k, v]) => (
                <div key={k} className="flex gap-4 px-4 py-2.5">
                  <dt className="text-mut w-32 shrink-0">{k}</dt>
                  <dd className="min-w-0">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mt-3 grid sm:grid-cols-2 gap-2 text-[13px]">
            <Link href="/legal/livrare" className="card px-3.5 py-2.5 flex items-center gap-2 hover:border-acc">
              <span className="text-acc"><TrustIcon kind="camion" /></span> Livrare 1–3 zile lucrătoare</Link>
            <Link href="/legal/politica-de-retur" className="card px-3.5 py-2.5 flex items-center gap-2 hover:border-acc">
              <span className="text-acc"><TrustIcon kind="retur" /></span> Retur în 14 zile</Link>
          </div>

          {prod.stare_nota && (
            <div className="card p-4 mt-3 text-[13.5px]">
              <b className="font-disp font-semibold text-[13px] block mb-1.5">Descriere</b>
              <p className="text-steel">{prod.stare_nota}</p>
            </div>
          )}

          {prod.compat.length > 0 && (
            <div className="card p-4 mt-3">
              <b className="font-disp font-semibold text-[13px]">Compatibilitate — se potrivește pe:</b>
              <ul className="mt-2 space-y-1.5 text-[13.5px]">
                {prod.compat.map((c) => <li key={c} className="flex gap-2"><span className="text-ok">✓</span>{c}</li>)}
              </ul>
            </div>
          )}
        </div>
      </div>

      {similare.length > 0 && (
        <section className="mt-12">
          <div className="dim">Alege în siguranță</div>
          <h2 className="font-disp font-bold text-2xl mt-2 mb-5">Piese similare</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{similare.map((x) => <ProductCard key={x.id} p={x} />)}</div>
        </section>
      )}

      {aceeasiMasina.length > 0 && (
        <section className="mt-12">
          <div className="dim">{prod.vehicles?.nume}{prod.vehicles?.an ? ` · ${prod.vehicles.an}` : ""}</div>
          <h2 className="font-disp font-bold text-2xl mt-2 mb-5">Alte piese pentru această mașină</h2>
          <div className="flex gap-4 overflow-x-auto pb-2 snap-x">
            {aceeasiMasina.map((x) => (
              <div key={x.id} className="w-[220px] shrink-0 snap-start"><ProductCard p={x} /></div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
