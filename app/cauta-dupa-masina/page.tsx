import Breadcrumbs from "@/components/Breadcrumbs";
import { sbServer } from "@/lib/supabase";
import type { Vehicle } from "@/lib/types";
import Link from "next/link";
import PartRequestForm from "@/components/PartRequestForm";
import VehicleFilter from "@/components/VehicleFilter";
import type { Brand, Model, Category } from "@/lib/types";
import { fitmentCounts, marciCuPiese, nrPiese } from "@/lib/format";
import { getVacanta } from "@/lib/settings";
import { VacantaStareGoala } from "@/components/VacantaNota";

export const dynamic = "force-dynamic";
// Datele catalogului se citesc mereu proaspăt. `revalidate = 300` din layout
// (pus ca modificările din Admin → Setări să ajungă pe paginile statice) se
// aplică întregului arbore de rute și punea în cache 5 minute și interogările
// de aici — o piesă vândută rămânea „În stoc". La dezmembrări fiecare piesă e
// unicat, deci stocul trebuie citit la secundă.
export const fetchCache = "force-no-store";
export const metadata = { title: "Caută după mașină" };

export default async function CautaDupaMasina() {
  const sb = sbServer();
  const cars = sb ? (((await sb.from("vehicles").select("*").eq("publicat", true)
    .order("intrare", { ascending: false })).data ?? []) as Vehicle[]) : [];
  // Numărul de piese pe mașină, calculat live — la fel ca în hero și în /masini.
  // `vehicles.piese_listate` e corect (îl ține triggerul), dar e valoare memorată,
  // iar aici o desincronizare s-ar vedea drept „0 piese listate" pe o mașină plină.
  const legRows = sb ? (((await sb.from("products").select("vehicul_id")
    .eq("publicat", true).gt("stoc", 0).not("vehicul_id", "is", null)).data ?? []) as { vehicul_id: number }[]) : [];
  const catePiese: Record<number, number> = {};
  for (const r of legRows) catePiese[r.vehicul_id] = (catePiese[r.vehicul_id] ?? 0) + 1;
  const brands = sb ? (((await sb.from("brands").select("*").order("ordine")).data ?? []) as Brand[]) : [];
  const models = sb ? (((await sb.from("models").select("*").order("nume")).data ?? []) as Model[]) : [];
  const cats = sb ? (((await sb.from("categories").select("*").order("ordine")).data ?? []) as Category[]) : [];
  // Aceleași numărători ca pe /piese și pe prima pagină. Aici lipseau cu totul, deci
  // filtrul de aici arăta toate mărcile din tabelă, fără să spună câte piese au —
  // inclusiv cele rămase din lista de dealer, care n-au niciuna.
  const fitRows = sb ? (((await sb.from("products").select("model_ids").eq("publicat", true)).data ?? []) as { model_ids: number[] }[]) : [];
  const counts = fitmentCounts(fitRows, models);
  // În vacanță selectoarele rămân — omul poate să se uite ce avem — dar lista de
  // mașini nu mai duce nicăieri, fiindcă `/piese` nu întoarce rezultate.
  const vacanta = await getVacanta();
  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumbs items={[{ t: "Acasă", href: "/" }, { t: "Caută după mașină" }]} />
      <h1 className="t-sectiune mt-2">Caută piese după mașina ta</h1>
      <div className="mt-5 mb-2"><VehicleFilter brands={marciCuPiese(brands, counts)} models={models} cats={cats} counts={counts} compact /></div>
      {vacanta.activ && <div className="mt-7"><VacantaStareGoala vacanta={vacanta} /></div>}
      {!vacanta.activ && (<>
      <p className="text-textSecundar mt-6 max-w-2xl">Sau alege una dintre mașinile aflate la noi în dezmembrare — vezi doar piesele care ți se potrivesc. Fiecare piesă e legată de mașina din care provine, cu seria de șasiu la vedere.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-7">
        {/* Cardul duce la PAGINA mașinii, nu la `/piese?vehicul=…`. Filtrul acela
            întoarce o listă goală pentru o mașină fără piese legate, adică pentru
            toate, deocamdată — un drum înfundat. Pagina mașinii are întotdeauna
            ceva de arătat: specificațiile și formularul de cerere. */}
        {cars.map((c) => {
          const n = catePiese[c.id] ?? 0;
          return (
            <Link key={c.id} href={`/masini/${c.slug}`} className="card p-5 hover:border-accentChenar transition">
              {c.vin_masca && <div className="dim !text-[12px]">VIN {c.vin_masca}</div>}
              <b className="font-disp text-xl uppercase block mt-1">{c.nume}{c.an ? ` · ${c.an}` : ""}</b>
              <div className="mt-2 flex items-center justify-between text-sm">
                {/* „0 piese listate" e o promisiune neacoperită; „piese pe cerere"
                    e adevărul și, în plus, o invitație. */}
                <span className="text-textSecundar">{n > 0 ? `${nrPiese(n)} ${n === 1 ? "listată" : "listate"}` : "piese pe cerere"}</span>
                <span className="accentuat font-bold">{n > 0 ? "Vezi piesele →" : "Vezi mașina →"}</span>
              </div>
            </Link>
          );
        })}
        {cars.length === 0 && <p className="text-textSecundar">Conectează Supabase (vezi README) pentru lista vehiculelor.</p>}
      </div>
      </>)}
      <div className="grid lg:grid-cols-2 gap-8 mt-12 items-center">
        <div>
          <h2 className="font-disp font-bold text-2xl">Mașina ta nu e în listă?</h2>
          <p className="text-textSecundar mt-2">Primim săptămânal mașini noi la dezmembrat. Lasă o cerere cu mașina și piesa căutată — te anunțăm imediat ce intră în stoc.</p>
        </div>
        <PartRequestForm sursa="cauta-dupa-masina" />
      </div>
    </div>
  );
}
