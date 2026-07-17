import { sbServer } from "@/lib/supabase";
import type { Product } from "@/lib/types";
import PartArt from "@/components/PartArt";
import AddToCart from "@/components/AddToCart";
import ProductCard from "@/components/ProductCard";
import { lei } from "@/lib/format";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Produs({ params }: { params: { slug: string } }) {
  const sb = sbServer();
  if (!sb) notFound();
  const { data: p } = await sb.from("products")
    .select("*, categories(*), vehicles(*)").eq("slug", params.slug).single();
  if (!p) notFound();
  const prod = p as Product;

  // Piese din aceeași mașină-sursă (dacă piesa are vehicul asociat)
  let dinAceeasi: Product[] = [];
  if (prod.vehicul_id) {
    dinAceeasi = ((await sb.from("products").select("*").eq("vehicul_id", prod.vehicul_id)
      .neq("id", prod.id).eq("publicat", true).limit(4)).data ?? []) as Product[];
  }
  const similare = ((await sb.from("products").select("*").eq("categorie_id", prod.categorie_id)
    .neq("id", prod.id).eq("publicat", true).limit(4)).data ?? []) as Product[];

  const stareTxt = { A: "testată, funcționare verificată", B: "funcțională, cu urme normale de uz", C: "pentru recondiționare" }[prod.stare];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="dim">Acasă / {prod.categories?.nume ?? "Piese"} / {prod.nume.slice(0, 40)}…</div>
      <div className="grid lg:grid-cols-2 gap-8 mt-4">
        {/* Galeria (ilustrație până la fotografiile reale) */}
        <div>
          <div className="relative card overflow-hidden">
            <PartArt kind={prod.art} className="w-full aspect-[100/72]" />
            <span className="absolute top-3 left-3 text-xs font-bold px-2.5 py-1 rounded-full bg-ok/15 text-ok">✓ Testat în atelier</span>
            <span className="absolute bottom-3 right-3 text-xs font-semibold px-2.5 py-1 rounded-md bg-ink/80 text-white">Foto reale · la cerere pe WhatsApp</span>
          </div>
          <div className="grid grid-cols-4 gap-2 mt-2">
            {[0,1,2,3].map((i) => <PartArt key={i} kind={prod.art} className="w-full aspect-[100/72] rounded-lg border border-line" />)}
          </div>
        </div>
        {/* Detalii */}
        <div>
          <h1 className="font-disp font-black uppercase text-[26px] leading-tight">{prod.nume}</h1>
          <div className="mt-3 flex flex-wrap gap-2 text-[12px] font-bold">
            <span className="px-2.5 py-1 rounded-md bg-ink text-white">Cod OEM: {prod.oem}</span>
            {prod.ani && <span className="px-2.5 py-1 rounded-md bg-paper border border-line">{prod.ani}</span>}
          </div>
          {/* Nota de stare A/B/C */}
          <div className="card p-3.5 mt-4 flex items-center gap-3">
            {(["A","B","C"] as const).map((s) => (
              <span key={s} className={`w-8 h-8 grid place-items-center rounded-md font-disp font-black
                ${s === prod.stare ? "bg-ok text-white" : "bg-paper text-mut border border-line"}`}>{s}</span>
            ))}
            <div className="text-sm"><b>Stare {prod.stare}</b> — {stareTxt}.
              {prod.stare_nota && <span className="text-mut"> Notă: {prod.stare_nota}.</span>}</div>
          </div>
          <div className="mt-5 flex items-end gap-3">
            <span className="font-disp font-black text-4xl text-acc">{lei(Number(prod.pret_lei), prod.pret_sufix)}</span>
            <span className="text-mut text-sm mb-1.5">TVA inclus</span>
          </div>
          <div className="mt-2 flex gap-2 text-[12px] font-bold">
            <span className="px-2.5 py-1 rounded-full bg-acc/10 text-acc">Stoc: {prod.stoc} buc — piesă unică</span>
            <span className="px-2.5 py-1 rounded-full bg-ok/10 text-ok">Garanție 30 de zile</span>
          </div>
          <div className="mt-5 grid sm:grid-cols-2 gap-3">
            <AddToCart p={prod} mare />
            <a href="https://wa.me/40740123456" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-lg bg-[#1FA463] text-white px-6 py-3.5 font-disp font-bold uppercase tracking-wide hover:brightness-110">
              Întreabă pe WhatsApp</a>
          </div>
          <div className="mt-4 grid sm:grid-cols-2 gap-2 text-sm">
            <div className="card px-3.5 py-2.5">🚚 Livrare 24–48h · de la 14,90 lei</div>
            <Link href="/legal/politica-de-retur" className="card px-3.5 py-2.5 hover:border-acc">↩ Retur 14 zile fără explicații</Link>
          </div>
          {/* Compatibilitate */}
          {prod.compat.length > 0 && (
            <div className="card p-4 mt-5">
              <b className="font-disp uppercase tracking-widest text-[13px]">Compatibilitate — se potrivește pe:</b>
              <ul className="mt-2 space-y-1.5 text-sm">
                {prod.compat.map((c) => <li key={c} className="flex gap-2"><span className="text-ok font-bold">✓</span>{c}</li>)}
              </ul>
              <p className="text-xs text-acc font-semibold mt-3">Nu ești sigur? Trimite-ne seria de șasiu (VIN) pe WhatsApp — verificăm noi.</p>
            </div>
          )}
        </div>
      </div>

      {/* Din aceeași mașină */}
      {dinAceeasi.length > 0 && (
        <section className="mt-12">
          <div className="dim">Provine din: {prod.vehicles?.nume} · {prod.vehicles?.an} · dezmembrare completă</div>
          <h2 className="font-disp font-black uppercase text-2xl mt-2 mb-5">Din aceeași mașină dezmembrată</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{dinAceeasi.map((x) => <ProductCard key={x.id} p={x} />)}</div>
        </section>
      )}
      {similare.length > 0 && (
        <section className="mt-12">
          <h2 className="font-disp font-black uppercase text-2xl mb-5">Piese similare</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{similare.map((x) => <ProductCard key={x.id} p={x} />)}</div>
        </section>
      )}
    </div>
  );
}
