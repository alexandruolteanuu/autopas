// ============================================================
// MAȘINI DEZMEMBRATE — /masini
//
// Lista mașinilor din depozit. Are două grupe, și separarea e intenționată:
//
//   · „Cu piese pe site" — mașini care chiar au ce vinde acum;
//   · „În dezmembrare acum" — mașini intrate, fără piese listate încă.
//
// A doua grupă NU e umplutură. Clientul care caută o portieră de Passat B6 vrea
// exact informația asta: „au mașina, întreabă-i". Ascunsă, ar fi o vânzare
// pierdută; amestecată cu prima, ar face lista să pară plină de pagini goale.
//
// Numărul de piese se calculează LIVE, dintr-o singură interogare, nu se ia din
// `vehicles.piese_listate`. Coloana aia e corectă (o ține triggerul
// `recalc_piese_vehicul`), dar e o valoare memorată: dacă vreodată se desincronizează,
// aici s-ar vedea ca „0 piese" pe o mașină plină.
// ============================================================
import { cache } from "react";
import { sbServer, citesteTot } from "@/lib/supabase";
import { descriereListaMasini } from "@/lib/seo";
import type { Vehicle } from "@/lib/types";
import MasinaArt from "@/components/MasinaArt";
import Breadcrumbs from "@/components/Breadcrumbs";
import StareGoala from "@/components/StareGoala";
import { nrPiese } from "@/lib/format";
import Link from "next/link";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/** Descrierea poartă cifrele reale ale depozitului, care se schimbă odată cu
 *  catalogul. Interogările sunt aceleași pe care le face pagina, prin `cache()`. */
export async function generateMetadata(): Promise<Metadata> {
  const { masini, cate } = await iaMasini();
  const cuPiese = masini.filter((v) => (cate[v.id] ?? 0) > 0).length;
  return {
    title: "Mașini dezmembrate — piese pe stoc",
    description: descriereListaMasini(cuPiese, masini.length),
    alternates: { canonical: "/masini" },
  };
}

function CardMasina({ v, cate, prioritara = false }: { v: Vehicle; cate: number; prioritara?: boolean }) {
  return (
    <Link href={`/masini/${v.slug}`}
      className="group card overflow-hidden flex flex-col transition-[box-shadow,border-color] duration-200 hover:border-accentChenar/40 hover:shadow-[var(--umbra-2)]">
      <div className="overflow-hidden">
        {v.poze && v.poze.length > 0
          ? <img src={v.poze[0]} alt={v.nume}
              loading={prioritara ? "eager" : "lazy"}
              fetchPriority={prioritara ? "high" : undefined}
              className="w-full aspect-[4/3] object-cover bg-imagineBg transition-transform duration-200 group-hover:scale-[1.03]" />
          : <MasinaArt className="w-full aspect-[4/3] transition-transform duration-200 group-hover:scale-[1.03]" />}
      </div>
      <div className="p-3.5">
        <b className="font-disp block">{v.nume}</b>
        <div className="text-[13px] text-textSecundar mt-0.5">
          {v.an ? `${v.an} · ` : ""}{cate > 0 ? nrPiese(cate) : "piese pe cerere"}
        </div>
      </div>
    </Link>
  );
}

// Citirile paginii, împărțite cu `generateMetadata` prin `cache()`: altfel
// fiecare afișare ar face de două ori aceleași două interogări.
const iaMasini = cache(async () => {
  const sb = sbServer();
  if (!sb) return { masini: [] as Vehicle[], cate: {} as Record<number, number> };
  const [masini, randuri] = await Promise.all([
    citesteTot<Vehicle>(() => sb.from("vehicles").select("*", { count: "exact" })
      .eq("publicat", true).order("intrare", { ascending: false }).order("id"), { eticheta: "mașinile" }),
    // Numărătorile vin din view: un rând pe mașină. Varianta veche aducea un rând
    // pe piesă legată și se oprea tăcut la 1.000 — vezi supabase/numar-piese-pe-model.sql.
    citesteTot<{ vehicul_id: number; nr_piese: number }>(
      () => sb.from("numar_piese_pe_masina").select("*", { count: "exact" }).order("vehicul_id"),
      { eticheta: "numărul de piese pe mașină" }),
  ]);
  const cate: Record<number, number> = {};
  for (const r of randuri) cate[r.vehicul_id] = r.nr_piese;
  return { masini, cate };
});

export default async function Masini() {
  const { masini, cate } = await iaMasini();

  const cuPiese = masini.filter((v) => (cate[v.id] ?? 0) > 0);
  const faraPiese = masini.filter((v) => (cate[v.id] ?? 0) === 0);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
      <Breadcrumbs items={[{ t: "Acasă", href: "/" }, { t: "Mașini dezmembrate" }]} />

      <h1 className="t-sectiune mt-4">Mașini dezmembrate</h1>
      <p className="text-textSecundar mt-2 max-w-2xl text-[15px]">
        Mașinile din depozitul nostru și piesele demontate de pe fiecare. Dacă mașina ta e în listă,
        aproape sigur avem piesa — dacă n-o vezi pe site, întreabă-ne.
      </p>

      {masini.length === 0 ? (
        <div className="mt-8">
          <StareGoala
            icon={<MasinaArt className="w-14 h-14 rounded-full" />}
            titlu="Nicio mașină publicată deocamdată"
            text="Adăugăm mașinile pe măsură ce intră în depozit. Între timp, caută direct în catalogul de piese."
            actiune={{ eticheta: "Vezi piesele pe stoc", href: "/piese" }}
            secundar={{ eticheta: "Caută după mașină", href: "/cauta-dupa-masina" }}
          />
        </div>
      ) : (
        <>
          {cuPiese.length > 0 && (
            <section className="mt-8">
              <h2 className="font-disp font-bold text-xl mb-4">Cu piese pe site</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {cuPiese.map((v, i) => <CardMasina key={v.id} v={v} cate={cate[v.id] ?? 0} prioritara={i === 0} />)}
              </div>
            </section>
          )}

          {faraPiese.length > 0 && (
            <section className="mt-10">
              <h2 className="font-disp font-bold text-xl mb-1">În dezmembrare acum</h2>
              <p className="text-textSecundar text-sm mb-4">
                Piesele nu sunt încă listate. Sună-ne sau trimite o cerere — verificăm pe loc.
              </p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {faraPiese.map((v, i) => <CardMasina key={v.id} v={v} cate={0} prioritara={cuPiese.length === 0 && i === 0} />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
