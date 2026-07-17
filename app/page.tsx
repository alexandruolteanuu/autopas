import Link from "next/link";
import { sbServer } from "@/lib/supabase";
import type { Category, Product, Vehicle } from "@/lib/types";
import ProductCard from "@/components/ProductCard";
import PartArt from "@/components/PartArt";
import PartRequestForm from "@/components/PartRequestForm";

export const dynamic = "force-dynamic"; // datele vin mereu proaspete din Supabase

async function getData() {
  const sb = sbServer();
  if (!sb) return { cats: [] as Category[], products: [] as Product[], cars: [] as Vehicle[] };
  const [c, p, v] = await Promise.all([
    sb.from("categories").select("*").order("ordine"),
    sb.from("products").select("*").eq("publicat", true).order("created_at", { ascending: false }).limit(8),
    sb.from("vehicles").select("*").order("intrare", { ascending: false }).limit(4),
  ]);
  return { cats: (c.data ?? []) as Category[], products: (p.data ?? []) as Product[], cars: (v.data ?? []) as Vehicle[] };
}

export default async function Home() {
  const { cats, products, cars } = await getData();
  return (
    <>
      {/* ===== HERO — cu motto-ul cerut de client ===== */}
      <section className="bg-ink text-white">
        <div className="mx-auto max-w-6xl px-4 py-12 lg:py-16 grid lg:grid-cols-[1.2fr,0.8fr] gap-10">
          <div>
            <div className="dim !text-acc !before:bg-acc">Dezmembrăm responsabil · Reciclăm pentru viitor!</div>
            <h1 className="font-disp font-black uppercase leading-[0.95] text-[44px] sm:text-[56px] mt-4">
              Piesa potrivită.<br /><span className="text-acc">Testată. Garantată.</span>
            </h1>
            <p className="text-white/70 mt-4 max-w-lg">
              Piese pe stoc, fiecare fotografiată real, testată în atelier și livrată cu garanție de 30 de zile.
            </p>
            {/* Căutarea Marcă → Model → An */}
            <form action="/piese" className="mt-7 bg-white rounded-xl p-4 grid sm:grid-cols-[1fr,1fr,auto] gap-3 text-ink shadow-card">
              <div className="fld"><label>Marcă / Model</label>
                <input name="q" placeholder="ex. VW Golf 6" /></div>
              <div className="fld"><label>sau cod OEM</label>
                <input name="oem" placeholder="ex. 03L903023" /></div>
              <button className="btn-acc self-end h-[46px]">Caută piese</button>
            </form>
            <p className="text-white/50 text-sm mt-3">Nu găsești piesa? Completează cererea de mai jos — te anunțăm când intră în stoc.</p>
          </div>
          {/* Mașini intrate recent — direct din baza de date */}
          <div>
            <div className="dim !text-white/60">Intrate recent la dezmembrat</div>
            <div className="mt-4 space-y-3">
              {cars.map((c) => (
                <Link key={c.id} href={`/piese?vehicul=${c.slug}`}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white/5 border border-white/10 px-4 py-3 hover:border-acc transition">
                  <div>
                    <b className="font-disp text-[15px] tracking-wide">{c.nume} · {c.an}</b>
                    <div className="text-white/50 text-xs">{c.piese_listate} piese disponibile</div>
                  </div>
                  <span className="text-acc font-bold">→</span>
                </Link>
              ))}
              {cars.length === 0 && <p className="text-white/50 text-sm">Conectează Supabase pentru a vedea vehiculele (vezi README).</p>}
            </div>
          </div>
        </div>
      </section>

      {/* ===== Banda de încredere ===== */}
      <section className="bg-white border-b border-line">
        <div className="mx-auto max-w-6xl px-4 py-5 grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          {[["Garanție 30 de zile","la toate piesele"],["Livrare 24–48h","FAN · Cargus · Sameday"],["Retur în 14 zile","conform OUG 34/2014"],["Piese testate","verificate înainte de livrare"]].map(([t,d]) => (
            <div key={t} className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-ok/10 text-ok grid place-items-center font-bold">✓</span>
              <div><b className="block">{t}</b><span className="text-mut text-xs">{d}</span></div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Categorii ===== */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="dim">Navighează pe categorii</div>
        <h2 className="font-disp font-black uppercase text-3xl mt-2 mb-6">Categorii principale</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {cats.map((c) => (
            <Link key={c.id} href={`/piese?categorie=${c.slug}`}
              className="card p-4 hover:border-acc transition flex items-center gap-3">
              <PartArt kind={c.art} className="w-14 h-11 rounded-md shrink-0" />
              <div><b className="block text-[13px] leading-tight">{c.nume}</b>
                <span className="text-mut text-xs">{c.display_count.toLocaleString("ro-RO")} piese</span></div>
            </Link>
          ))}
        </div>
      </section>

      {/* ===== Piese recomandate — direct din Supabase ===== */}
      <section className="mx-auto max-w-6xl px-4 pb-12">
        <div className="flex items-end justify-between mb-6">
          <div><div className="dim">Alese de noi</div>
            <h2 className="font-disp font-black uppercase text-3xl mt-2">Piese recomandate</h2></div>
          <Link href="/piese" className="text-acc font-bold text-sm">Vezi toate piesele →</Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {products.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
        {products.length === 0 && (
          <div className="card p-8 text-center text-mut">Baza de date nu este încă conectată sau nu are produse. Urmează pașii din README (schema.sql + seed.sql).</div>
        )}
      </section>

      {/* ===== Cerere de piesă ===== */}
      <section className="bg-ink text-white">
        <div className="mx-auto max-w-6xl px-4 py-12 grid lg:grid-cols-2 gap-8 items-center">
          <div>
            <div className="dim !text-white/60">Nu găsești piesa?</div>
            <h2 className="font-disp font-black uppercase text-3xl mt-2">Lasă o cerere — o căutăm noi.</h2>
            <p className="text-white/70 mt-3">Îți verificăm stocul fizic și mașinile care urmează la dezmembrare. Te sunăm sau îți scriem când piesa e disponibilă.</p>
            <p className="mt-4 text-sm text-white/60">Preferi WhatsApp? Scrie-ne codul OEM sau o poză: <b className="text-white">0740 123 456</b></p>
          </div>
          <PartRequestForm sursa="home" dark />
        </div>
      </section>
    </>
  );
}
