import Link from "next/link";
import { sbServer } from "@/lib/supabase";
import type { Category, Product, Vehicle, Brand, Model } from "@/lib/types";
import ProductCard from "@/components/ProductCard";
import PartArt from "@/components/PartArt";
import PartRequestForm from "@/components/PartRequestForm";
import VehicleFilter from "@/components/VehicleFilter";
import TrustBar from "@/components/TrustBar";
import { fitmentCounts } from "@/lib/format";

export const dynamic = "force-dynamic";

async function getData() {
  const sb = sbServer();
  if (!sb) return { cats: [] as Category[], products: [] as Product[], cars: [] as Vehicle[],
    brands: [] as Brand[], models: [] as Model[], counts: {} as Record<string, number> };
  const [c, p, v, b, m, fit] = await Promise.all([
    sb.from("categorii_cu_numar").select("*").is("parent_id", null).order("ordine"),
    sb.from("products").select("*").eq("publicat", true).order("created_at", { ascending: false }).limit(8),
    sb.from("vehicles").select("*").order("intrare", { ascending: false }).limit(4),
    sb.from("brands").select("*").order("ordine"),
    sb.from("models").select("*").order("nume"),
    sb.from("products").select("model_ids").eq("publicat", true),
  ]);
  const models = (m.data ?? []) as Model[];
  return {
    cats: (c.data ?? []) as Category[], products: (p.data ?? []) as Product[], cars: (v.data ?? []) as Vehicle[],
    brands: (b.data ?? []) as Brand[], models,
    counts: fitmentCounts((fit.data ?? []) as { model_ids: number[] }[], models),
  };
}

export default async function Home() {
  const { cats, products, cars, brands, models, counts } = await getData();
  return (
    <>
      <section className="bg-ink text-white">
        <div className="mx-auto max-w-6xl px-4 py-12 lg:py-16 grid lg:grid-cols-[1.2fr,0.8fr] gap-10">
          <div>
            <div className="dim !text-acc">Dezmembrăm responsabil · Reciclăm pentru viitor!</div>
            <h1 className="font-disp font-bold leading-[1.08] text-4xl sm:text-[46px] mt-4">
              Piesa potrivită.<br /><span className="text-acc">Testată. Garantată.</span>
            </h1>
            <p className="text-white/70 mt-4 max-w-lg">Piese auto livrate direct din stoc. Testate și livrate cu garanție.</p>
            <div className="mt-7"><VehicleFilter brands={brands} models={models} cats={cats} counts={counts} /></div>
            <p className="text-white/50 text-sm mt-3">Selectează marca, modelul și categoria pentru a găsi piesa de care ai nevoie.</p>
          </div>
          <div>
            <div className="dim !text-white/60">Mașini dezmembrate recent</div>
            <div className="mt-4 space-y-3">
              {cars.map((c) => (
                <Link key={c.id} href={`/piese?vehicul=${c.slug}`}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white/5 border border-white/10 px-4 py-3 hover:border-acc transition">
                  <div>
                    <b className="font-disp text-[15px] tracking-wide">{c.nume}{c.an ? ` · ${c.an}` : ""}</b>
                    <div className="text-white/50 text-xs">{c.piese_listate} piese disponibile</div>
                  </div>
                  <span className="text-acc font-bold">→</span>
                </Link>
              ))}
              {cars.length === 0 && <p className="text-white/50 text-sm">Adaugă vehicule din panoul de administrare.</p>}
            </div>
          </div>
        </div>
      </section>

      <TrustBar />

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="dim">Categorii piese auto</div>
        <h2 className="font-disp font-bold text-3xl mt-2 mb-6">Categorii principale</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {cats.map((c) => (
            <Link key={c.id} href={`/piese?categorie=${c.slug}`}
              className="card p-4 hover:border-acc transition flex items-center gap-3">
              <PartArt kind={c.art} className="w-14 h-11 rounded-md shrink-0" />
              <div><b className="block text-[13px] leading-tight">{c.nume}</b>
                <span className="text-mut text-xs">{c.nr_piese ?? 0} {c.nr_piese === 1 ? "piesă" : "piese"}</span></div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12">
        <div className="flex items-end justify-between mb-6">
          <div><div className="dim">Noutăți</div>
            <h2 className="font-disp font-bold text-3xl mt-2">Piese adăugate recent</h2></div>
          <Link href="/piese" className="text-acc font-bold text-sm">Vezi toate piesele →</Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {products.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
        {products.length === 0 && (
          <div className="card p-8 text-center text-mut">Nicio piesă publicată încă. Adaugă prima din panoul de administrare.</div>
        )}
      </section>

      {brands.length > 0 && (
        <section className="bg-white border-y border-line">
          <div className="mx-auto max-w-6xl px-4 py-10">
            <div className="dim">Mărci auto</div>
            <h2 className="font-disp font-bold text-2xl mt-2 mb-5">Caută piese după marcă</h2>
            <div className="flex flex-wrap gap-2.5">
              {brands.map((b) => (
                <Link key={b.id} href={`/piese?marca=${b.slug}`}
                  className="rounded-xl border-2 border-line px-4 py-2.5 font-disp font-semibold text-[15px] hover:border-acc hover:text-acc transition">
                  {b.nume}</Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="bg-ink text-white">
        <div className="mx-auto max-w-6xl px-4 py-12 grid lg:grid-cols-2 gap-8 items-center">
          <div>
            <div className="dim !text-white/60">Adaugă o cerere de piese</div>
            <h2 className="font-disp font-bold text-3xl mt-2">Nu ai găsit piesele de care ai nevoie?</h2>
            <p className="text-white/70 mt-3">Verificăm stocul fizic și următoarele mașini care urmează să fie dezmembrate pentru a găsi piesele potrivite pentru tine.</p>
            <p className="mt-4 text-sm text-white/60">Te sunăm sau îți scriem când piesa e disponibilă. Preferi WhatsApp? Scrie-ne codul OEM sau o poză.</p>
          </div>
          <PartRequestForm sursa="home" dark />
        </div>
      </section>
    </>
  );
}
