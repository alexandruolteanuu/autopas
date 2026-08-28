import Link from "next/link";
import { sbServer } from "@/lib/supabase";
import type { Category, Product, Vehicle, Brand, Model } from "@/lib/types";
import ProductCard from "@/components/ProductCard";
import PartArt from "@/components/PartArt";
import PartRequestForm from "@/components/PartRequestForm";
import VehicleFilter from "@/components/VehicleFilter";
import TrustBar from "@/components/TrustBar";
import RecycleIcon from "@/components/RecycleIcon";
import StareGoala from "@/components/StareGoala";
import { IconLupa } from "@/components/Icoane";
import { fitmentCounts, marciCuPiese, nrPiese } from "@/lib/format";
import { getVacanta } from "@/lib/settings";

export const dynamic = "force-dynamic";
// Datele catalogului se citesc mereu proaspăt. `revalidate = 300` din layout
// (pus ca modificările din Admin → Setări să ajungă pe paginile statice) se
// aplică întregului arbore de rute și punea în cache 5 minute și interogările
// de aici — o piesă vândută rămânea „În stoc". La dezmembrări fiecare piesă e
// unicat, deci stocul trebuie citit la secundă.
export const fetchCache = "force-no-store";

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
  const counts = fitmentCounts((fit.data ?? []) as { model_ids: number[] }[], models);
  return {
    cats: (c.data ?? []) as Category[], products: (p.data ?? []) as Product[], cars: (v.data ?? []) as Vehicle[],
    // Doar mărcile care au măcar o piesă publicată ajung în filtru și în secțiunea
    // „Mărci auto". Tabela rămâne completă; vezi `marciCuPiese` din lib/format.ts.
    brands: marciCuPiese((b.data ?? []) as Brand[], counts), models, counts,
  };
}

export default async function Home() {
  const { cats, products, cars, brands, models, counts } = await getData();
  // În vacanță secțiunea „Piese adăugate recent" DISPARE cu totul, nu rămâne
  // titlul cu gol dedesubt. Hello bar-ul din header spune deja de ce.
  const vacanta = await getVacanta();
  return (
    <>
      {/* HERO. Singura bandă din site care își schimbă culoarea cu tema: pe
          „Întunecat" e neagră, ca headerul, iar pe „Luminos" devine deschisă —
          „hero alb", cerința clientului. Celelalte benzi negre (cererea de piese
          de mai jos, chipurile din Despre noi, bannerul de cookie-uri) rămân
          negre pe ambele teme: sunt „zonele negre" care țin identitatea. */}
      <section className="bg-heroBg text-heroText">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-12 lg:py-16 grid items-stretch lg:grid-cols-[minmax(0,1.2fr),minmax(0,0.8fr)] gap-10">
          <div>
            {/* Supratitlul rămâne unde era, doar puțin mai mare și cu simbolul
                reciclării alături. Titlul mare al paginii e cel de sub el. */}
            <div className="dim accentuat !text-[13px]">
              <RecycleIcon className="w-[18px] h-[18px] shrink-0" />
              Dezmembrăm responsabil. Reciclăm pentru viitor.
            </div>
            <h1 className="t-hero t-hero-acasa mt-4">
              Piese originale. Testate. Cu garanție.<br />
              <span className="accentuat">Pregătite pentru noul tău drum.</span>
            </h1>
            <p className="text-heroText/70 mt-4 max-w-lg">Piese auto livrate din stoc.</p>
            <div className="mt-7"><VehicleFilter brands={brands} models={models} cats={cats} counts={counts} /></div>
            <p className="text-heroText/50 text-sm mt-3">Selectează marca, modelul și categoria pentru a găsi piesa de care ai nevoie.</p>
          </div>
          {/* Coloana dreaptă se întinde cât cea stângă (grila e `items-stretch`), iar
              cardurile împart între ele înălțimea rămasă. Plafonul de 140px oprește
              întinderea când coloana stângă e neobișnuit de înaltă: patru carduri de
              200px arată gol, nu echilibrat — atunci `justify-between` le distanțează.
              Sub `lg:` coloanele se stivuiesc, deci egalizarea nu se aplică. */}
          <div className="flex flex-col lg:h-full">
            <div className="dim !text-heroText/60">Mașini dezmembrate recent</div>
            <div className="mt-4 flex flex-col gap-3 lg:flex-1 lg:justify-between">
              {cars.map((c) => (
                <Link key={c.id} href={`/piese?vehicul=${c.slug}`}
                  className="flex items-center justify-between gap-3 rounded-xl bg-suprafata border border-chenar px-4 py-3 hover:border-accentChenar transition lg:flex-1 lg:max-h-[140px]">
                  <div>
                    <b className="font-disp text-[15px] tracking-wide">{c.nume}{c.an ? ` · ${c.an}` : ""}</b>
                    <div className="text-heroText/50 text-xs">{nrPiese(c.piese_listate ?? 0)} {c.piese_listate === 1 ? "disponibilă" : "disponibile"}</div>
                  </div>
                  <span className="accentuat font-bold">→</span>
                </Link>
              ))}
              {cars.length === 0 && <p className="text-heroText/50 text-sm">Adaugă vehicule din panoul de administrare.</p>}
            </div>
          </div>
        </div>
      </section>

      <TrustBar />

      <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="dim">Categorii piese auto</div>
        <h2 className="t-sectiune mt-2 mb-6">Categorii principale</h2>
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {cats.map((c) => (
            <Link key={c.id} href={`/piese?categorie=${c.slug}`}
              className="card p-4 hover:border-accentChenar transition flex items-center gap-3">
              <PartArt kind={c.art} className="w-14 h-11 rounded-md shrink-0" />
              <div><b className="block text-[13px] leading-tight">{c.nume}</b>
                <span className="text-textSecundar text-xs">{c.nr_piese ?? 0} {c.nr_piese === 1 ? "piesă" : "piese"}</span></div>
            </Link>
          ))}
        </div>
      </section>

      {!vacanta.activ && (
      <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pb-12">
        <div className="flex items-end justify-between mb-6">
          <div><div className="dim">Noutăți</div>
            <h2 className="t-sectiune mt-2">Piese adăugate recent</h2></div>
          <Link href="/piese" className="inline-flex items-center min-h-[44px] accentuat font-bold text-sm">Vezi toate piesele →</Link>
        </div>
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          {products.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
        {products.length === 0 && (
          <StareGoala icon={<IconLupa className="w-7 h-7" />} titlu="Nicio piesă publicată încă" text="Adaugă prima piesă din panoul de administrare și va apărea imediat aici." actiune={{ eticheta: "Deschide panoul", href: "/admin/produse" }} />
        )}
      </section>
      )}

      {brands.length > 0 && (
        <section className="bg-suprafata border-y border-chenar">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
            <div className="dim">Mărci auto</div>
            <h2 className="t-sectiune mt-2 mb-5">Caută piese după marcă</h2>
            <div className="flex flex-wrap gap-2.5">
              {brands.map((b) => (
                <Link key={b.id} href={`/piese?marca=${b.slug}`}
                  className="rounded-xl border-2 border-chenar px-4 py-2.5 font-disp font-semibold text-[15px] hover:border-accentChenar accentuat-hover transition">
                  {b.nume}</Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="bg-headerBg text-headerText">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-12 grid lg:grid-cols-2 gap-8 items-center">
          <div>
            <div className="dim !text-headerText/60">Adaugă o cerere de piese</div>
            <h2 className="t-sectiune mt-2">Nu ai găsit piesele de care ai nevoie?</h2>
            <p className="text-headerText/70 mt-3">Verificăm stocul fizic și următoarele mașini care urmează să fie dezmembrate pentru a găsi piesele potrivite pentru tine.</p>
            <p className="mt-4 text-sm text-headerText/60">Te sunăm sau îți scriem când piesa e disponibilă. Preferi WhatsApp? Scrie-ne codul OEM sau o poză.</p>
          </div>
          <PartRequestForm sursa="home" dark />
        </div>
      </section>
    </>
  );
}
