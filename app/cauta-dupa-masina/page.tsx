import Breadcrumbs from "@/components/Breadcrumbs";
import { sbServer } from "@/lib/supabase";
import type { Vehicle } from "@/lib/types";
import Link from "next/link";
import PartRequestForm from "@/components/PartRequestForm";
import VehicleFilter from "@/components/VehicleFilter";
import type { Brand, Model, Category } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Caută după mașină" };

export default async function CautaDupaMasina() {
  const sb = sbServer();
  const cars = sb ? (((await sb.from("vehicles").select("*").order("intrare", { ascending: false })).data ?? []) as Vehicle[]) : [];
  const brands = sb ? (((await sb.from("brands").select("*").order("ordine")).data ?? []) as Brand[]) : [];
  const models = sb ? (((await sb.from("models").select("*").order("nume")).data ?? []) as Model[]) : [];
  const cats = sb ? (((await sb.from("categories").select("*").order("ordine")).data ?? []) as Category[]) : [];
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Breadcrumbs items={[{ t: "Acasă", href: "/" }, { t: "Caută după mașină" }]} />
      <h1 className="font-disp font-bold text-3xl mt-2">Caută piese după mașina ta</h1>
      <div className="mt-5 mb-2"><VehicleFilter brands={brands} models={models} cats={cats} compact /></div>
      <p className="text-mut mt-6 max-w-2xl">Sau alege una dintre mașinile aflate la noi în dezmembrare — vezi doar piesele care ți se potrivesc. Fiecare piesă e legată de mașina din care provine, cu seria de șasiu la vedere.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-7">
        {cars.map((c) => (
          <Link key={c.id} href={`/piese?vehicul=${c.slug}`} className="card p-5 hover:border-acc transition">
            <div className="dim !text-[10px]">VIN {c.vin_masca}</div>
            <b className="font-disp text-xl uppercase block mt-1">{c.nume} · {c.an}</b>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-mut">{c.piese_listate} piese listate</span>
              <span className="text-acc font-bold">Vezi piesele →</span>
            </div>
          </Link>
        ))}
        {cars.length === 0 && <p className="text-mut">Conectează Supabase (vezi README) pentru lista vehiculelor.</p>}
      </div>
      <div className="grid lg:grid-cols-2 gap-8 mt-12 items-center">
        <div>
          <h2 className="font-disp font-bold text-2xl">Mașina ta nu e în listă?</h2>
          <p className="text-mut mt-2">Primim săptămânal mașini noi la dezmembrat. Lasă o cerere cu mașina și piesa căutată — te anunțăm imediat ce intră în stoc.</p>
        </div>
        <PartRequestForm sursa="cauta-dupa-masina" />
      </div>
    </div>
  );
}
