// ============================================================
// PAGINA UNEI MAȘINI DEZMEMBRATE — /masini/[slug]
//
// De ce există: cineva caută „dezmembrari passat b7 2012" mult mai des decât un
// cod OEM. Pagina asta e răspunsul la căutarea aia.
//
// CE O UMPLE
// Piesele legate prin `products.vehicul_id`, adică prin câmpul „Mașina-sursă"
// din editorul de produs. Legătura se pune de OM, la listare. Cele 8.754 de
// piese importate din pieseauto.ro rămân nelegate, prin decizie (28 august
// 2026): feed-ul nu spune niciodată de pe ce mașină s-a demontat piesa, iar
// deducerea din titlu s-a măsurat și s-a dovedit greșită — la „VW Golf 6 1.6
// TDI", 36 din 67 de potriviri erau piese de Golf 7, fiindcă „6" se regăsește
// în „1.6". Vezi supabase/pagini-masini.sql.
//
// Deci o mașină fără piese legate NU e un defect, ci starea normală până la
// prima mașină dezmembrată de noi. Pagina ei arată o invitație, nu un gol.
// ============================================================
import { cache } from "react";
import { sbServer, citesteTot } from "@/lib/supabase";
import { titluMasinaSeo, descriereMasina } from "@/lib/seo";
import type { Product, Vehicle, Brand, Model, Category } from "@/lib/types";
import ProductCard from "@/components/ProductCard";
import ProductGallery from "@/components/ProductGallery";
import MasinaArt from "@/components/MasinaArt";
import Breadcrumbs from "@/components/Breadcrumbs";
import BackLink from "@/components/BackLink";
import StareGoala from "@/components/StareGoala";
import PartRequestForm from "@/components/PartRequestForm";
import { VacantaBanner, VacantaStareGoala } from "@/components/VacantaNota";
import { getVacanta } from "@/lib/settings";
import { nrPiese, bazaModel } from "@/lib/format";
import { SITE_URL } from "@/lib/config";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

// Ca la pagina de piesă: stocul trebuie citit la secundă, fiindcă fiecare piesă
// e unicat. `revalidate = 300` din layout ar ține aici o piesă vândută încă 5
// minute pe pagină.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/** Titlul afișat: „VW Passat B7 2.0 TDI · 2012".
 *
 *  Motorizarea se adaugă doar dacă nu e DEJA în nume, iar potrivirea se face pe
 *  cilindree, nu pe textul întreg: operatorul scrie de obicei „Vw Passat B6 2.0
 *  TDI BMP" în nume și „2.0 TDI 140 CP" în câmpul de motorizare. Cele două șiruri
 *  nu se conțin unul pe altul, așa că o comparație pe text întreg dădea titlul
 *  „Vw Passat B6 2.0 TDI BMP 2.0 TDI 140 CP". Cilindreea („2.0") e partea care
 *  se repetă întotdeauna, deci ea e testul bun. */
function titluMasina(v: Vehicle) {
  const m = (v.motorizare ?? "").trim();
  const cilindree = m.match(/\d[.,]\d/)?.[0];
  const dejaInNume = cilindree
    ? v.nume.includes(cilindree)
    : m !== "" && v.nume.toLowerCase().includes(m.toLowerCase());
  const cuMotor = m && !dejaInNume ? `${v.nume} ${m}` : v.nume;
  return v.an ? `${cuMotor} · ${v.an}` : cuMotor;
}

// `cache()`: `generateMetadata` și pagina cer amândouă aceeași mașină. Fără el
// pleacă două interogări identice la fiecare afișare.
const iaMasina = cache(async (slug: string) => {
  const sb = sbServer();
  if (!sb) return null;
  // Politica de citire din migrarea 28 e `publicat = true or is_staff()`, iar
  // aici clientul e cel anonim: o mașină nepublicată nu se întoarce deloc, deci
  // 404-ul e garantat de bază, nu doar de codul de mai jos.
  const { data } = await sb.from("vehicles").select("*").eq("slug", slug).maybeSingle();
  return (data as Vehicle | null) ?? null;
});

/** Numărul REAL de piese publicate, din view. Un rând, nu tot catalogul.
 *  Tot prin `cache()`: îl folosesc și metadatele, și pagina. */
const iaNrPiese = cache(async (vehiculId: number) => {
  const sb = sbServer();
  if (!sb) return 0;
  const { data } = await sb.from("numar_piese_pe_masina")
    .select("nr_piese").eq("vehicul_id", vehiculId).maybeSingle();
  return Number((data as { nr_piese?: number } | null)?.nr_piese ?? 0);
});

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const v = await iaMasina(params.slug);
  if (!v) return { title: "Mașină negăsită" };
  const t = titluMasina(v);
  // Numărul se citește live, nu din `piese_listate`: coloana aia e o valoare
  // memorată de trigger, iar o descriere care promite piese inexistente e mai
  // rea decât una fără cifre.
  const cate = await iaNrPiese(v.id);
  const titlu = titluMasinaSeo(t);
  const descriere = descriereMasina(t, cate);
  return {
    // `absolute`, ca la pagina de piesă: șablonul din layout adăuga „· Autopas
    // Dezmembrări" peste titlu, care ajungea la 85 de caractere cu marca de
    // două ori. Verificat pe producție.
    title: { absolute: titlu },
    description: descriere,
    alternates: { canonical: `/masini/${v.slug}` },
    openGraph: {
      title: titlu,
      description: descriere,
      images: v.poze && v.poze.length > 0 ? [v.poze[0]] : undefined,
    },
  };
}

export default async function PaginaMasina(
  { params, searchParams }: { params: { slug: string }; searchParams: { categorie?: string } },
) {
  const sb = sbServer();
  if (!sb) notFound();
  const v = await iaMasina(params.slug);
  if (!v) notFound();

  const vacanta = await getVacanta();

  // ---- piesele acestei mașini ----
  const piese = await citesteTot<Product>(() => sb.from("products")
    .select("*, categories!products_categorie_id_fkey(*)", { count: "exact" })
    .eq("vehicul_id", v.id).eq("publicat", true).gt("stoc", 0)
    .order("created_at", { ascending: false }).order("id"), { eticheta: "piesele mașinii" });

  // Filtrul pe categorie apare doar când chiar ajută: sub 12 piese, sau cu o
  // singură categorie, ar fi un rând de butoane care nu filtrează nimic.
  const categorii: Category[] = [];
  for (const p of piese) {
    const c = p.categories;
    if (c && !categorii.some((x) => x.id === c.id)) categorii.push(c);
  }
  const areFiltru = piese.length >= 12 && categorii.length > 1;
  const catActiva = areFiltru ? categorii.find((c) => c.slug === searchParams.categorie) : undefined;
  const pieseAfisate = catActiva ? piese.filter((p) => p.categories?.id === catActiva.id) : piese;

  // ---- piese de la mașini compatibile (B.3) ----
  // Ordinea de relevanță, de la tare la slab:
  //   1. același model (adică aceeași generație — în `models` o generație e un
  //      rând separat: „Golf 5" și „Golf 6" sunt două modele)
  //   2. același model de bază, altă generație — `bazaModel` din lib/format.ts
  //   4. aceeași marcă, alt model
  // Nivelul 3 (platformă comună: Touran pe platforma lui Passat B6) NU e
  // implementat: ar cere un tabel de platforme pe care nu-l avem. Vezi raportul.
  const marci = await citesteTot<Brand>(() => sb.from("brands").select("*", { count: "exact" }).order("id"), { eticheta: "mărcile" });
  const modele = await citesteTot<Model>(() => sb.from("models").select("*", { count: "exact" }).order("id"), { eticheta: "modelele" });
  const modelAcestei = modele.find((m) => m.id === v.model_id);
  const marcaAcestei = marci.find((b) => b.id === v.marca_id);

  let compatibile: { p: Product; masina: Vehicle }[] = [];
  if (v.marca_id || v.model_id) {
    const altele = await citesteTot<Vehicle>(() => sb.from("vehicles").select("*", { count: "exact" })
      .neq("id", v.id).eq("publicat", true).order("id"), { eticheta: "mașinile" });

    const nivel = (alt: Vehicle): number => {
      if (v.model_id && alt.model_id === v.model_id) return 1;
      const mAlt = modele.find((m) => m.id === alt.model_id);
      if (modelAcestei && mAlt && mAlt.brand_id === modelAcestei.brand_id
          && bazaModel(mAlt.nume) === bazaModel(modelAcestei.nume)) return 2;
      if (v.marca_id && alt.marca_id === v.marca_id) return 4;
      return 99;
    };

    const candidate = altele.map((a) => ({ a, n: nivel(a) })).filter((x) => x.n < 99);
    if (candidate.length) {
      const dupaId = new Map(candidate.map((x) => [x.a.id, x]));
      const rows = ((await sb.from("products").select("*")
        .in("vehicul_id", candidate.map((x) => x.a.id))
        .eq("publicat", true).gt("stoc", 0).limit(60)).data ?? []) as Product[];
      compatibile = rows
        .map((p) => ({ p, x: dupaId.get(p.vehicul_id as number)! }))
        .filter((r) => r.x)
        .sort((a, b) => a.x.n - b.x.n)
        .slice(0, 12)
        .map((r) => ({ p: r.p, masina: r.x.a }));
    }
  }
  // „Sub 4 rezultate, ascunde caruselul complet" — o secțiune cu două carduri
  // arată a defect, nu a ofertă.
  const arataCompatibile = compatibile.length >= 4;

  const t = titluMasina(v);
  const SPECIFICATII: [string, string][] = [
    ["Marca", marcaAcestei?.nume ?? "—"],
    ["Model", modelAcestei?.nume ?? "—"],
    ["An", v.an ? String(v.an) : "—"],
    ["Motorizare", v.motorizare || "—"],
    ["Caroserie", v.caroserie || "—"],
    ["Cutie de viteze", v.cutie_viteze || "—"],
    ["Culoare", v.culoare || "—"],
    ["Kilometri", v.km ? `${v.km.toLocaleString("ro-RO")} km` : "—"],
    ["Serie șasiu", v.vin_masca || "—"],
  ];

  // Date structurate: mașina ca `Vehicle` și firul Ariadnei. Fără preț și fără
  // disponibilitate — mașina nu e de vânzare, piesele ei sunt.
  const dateStructurate = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Vehicle",
        name: t,
        ...(marcaAcestei ? { brand: { "@type": "Brand", name: marcaAcestei.nume } } : {}),
        ...(modelAcestei ? { model: modelAcestei.nume } : {}),
        ...(v.an ? { modelDate: String(v.an) } : {}),
        ...(v.culoare ? { color: v.culoare } : {}),
        ...(v.caroserie ? { bodyType: v.caroserie } : {}),
        ...(v.km ? { mileageFromOdometer: { "@type": "QuantitativeValue", value: v.km, unitCode: "KMT" } } : {}),
        ...(v.poze && v.poze.length ? { image: v.poze } : {}),
        url: `${SITE_URL}/masini/${v.slug}`,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Acasă", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Mașini dezmembrate", item: `${SITE_URL}/masini` },
          { "@type": "ListItem", position: 3, name: t },
        ],
      },
    ],
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(dateStructurate) }} />

      <div className="flex items-center gap-3 flex-wrap mb-4">
        <BackLink />
        <Breadcrumbs items={[
          { t: "Acasă", href: "/" },
          { t: "Mașini dezmembrate", href: "/masini" },
          { t },
        ]} />
      </div>

      {vacanta.activ && <VacantaBanner vacanta={vacanta} className="mb-6" />}

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Fără poze se desenează silueta, nu un dreptunghi gol. */}
        <ProductGallery poze={v.poze ?? []} nume={t}
          rezerva={<MasinaArt className="w-full aspect-[100/72]" />} />

        <div>
          <div className="dim">Mașină dezmembrată</div>
          <h1 className="t-sectiune mt-1">{t}</h1>

          <p className="mt-3 text-textSecundar text-[15px]">
            {piese.length > 0
              ? <>Avem <b className="text-text">{nrPiese(piese.length)}</b> demontate de pe această mașină.</>
              : <>Mașina e în dezmembrare. Piesele nu sunt încă listate — scrie-ne ce cauți și verificăm pe loc.</>}
          </p>

          <dl className="mt-5 card divide-y divide-chenar text-[15px]">
            {SPECIFICATII.map(([k, val]) => (
              <div key={k} className="flex gap-4 px-4 py-2.5">
                <dt className="text-textSecundar w-36 shrink-0">{k}</dt>
                <dd className="min-w-0">{val}</dd>
              </div>
            ))}
          </dl>

          {v.descriere && (
            <div className="mt-5 text-[15px] leading-relaxed whitespace-pre-line">{v.descriere}</div>
          )}
        </div>
      </div>

      {/* ---- piesele acestei mașini ---- */}
      <section className="mt-12">
        <h2 className="font-disp font-bold text-2xl mb-5">Piesele acestei mașini</h2>

        {areFiltru && (
          <div className="flex gap-2 flex-wrap mb-5">
            <Link href={`/masini/${v.slug}`}
              className={`rounded-full border px-3.5 py-1.5 text-sm ${!catActiva ? "bg-accent text-accentContrast border-accentChenar" : "border-chenarPuternic"}`}>
              Toate ({piese.length})
            </Link>
            {categorii.map((c) => (
              <Link key={c.id} href={`/masini/${v.slug}?categorie=${c.slug}`}
                className={`rounded-full border px-3.5 py-1.5 text-sm ${catActiva?.id === c.id ? "bg-accent text-accentContrast border-accentChenar" : "border-chenarPuternic"}`}>
                {c.nume} ({piese.filter((p) => p.categories?.id === c.id).length})
              </Link>
            ))}
          </div>
        )}

        {vacanta.activ ? (
          <VacantaStareGoala vacanta={vacanta} />
        ) : pieseAfisate.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {pieseAfisate.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
        ) : (
          <StareGoala
            icon={<MasinaArt className="w-14 h-14 rounded-full" />}
            titlu={piese.length > 0 ? "Nicio piesă în categoria asta" : "Piesele nu sunt încă listate"}
            text={piese.length > 0
              ? "Alege altă categorie sau vezi toate piesele mașinii."
              : `Dezmembrăm ${t} chiar acum. Spune-ne ce piesă cauți și îți răspundem cu disponibilitatea și prețul.`}
            actiune={piese.length > 0 ? { eticheta: "Vezi toate piesele", href: `/masini/${v.slug}` } : undefined}
            secundar={{ eticheta: "Vezi tot catalogul", href: "/piese" }}
          />
        )}
      </section>

      {/* ---- piese de la mașini compatibile ---- */}
      {arataCompatibile && !vacanta.activ && (
        <section className="mt-12">
          <div className="dim">Se potrivesc și pe {t}</div>
          <h2 className="font-disp font-bold text-2xl mt-2 mb-5">Piese de la mașini compatibile</h2>
          <div className="flex gap-4 overflow-x-auto pb-2 snap-x">
            {compatibile.map(({ p, masina }) => (
              <div key={p.id} className="w-[220px] shrink-0 snap-start">
                <ProductCard p={p} />
                {/* „fiecare card arată de la ce mașină provine" — altfel omul n-ar
                    ști că piesa nu e de pe mașina pe care tocmai o citește. */}
                <Link href={`/masini/${masina.slug}`}
                  className="block mt-1.5 text-[12px] text-textSecundar hover:text-text truncate">
                  de pe {masina.nume}
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---- cererea de piesă, precompletată cu mașina ---- */}
      <section className="mt-12">
        <h2 className="font-disp font-bold text-2xl mb-2">Cauți altă piesă de la această mașină?</h2>
        <p className="text-textSecundar text-[15px] mb-5 max-w-2xl">
          Nu tot ce demontăm ajunge imediat pe site. Scrie-ne ce cauți și verificăm în depozit.
        </p>
        <PartRequestForm sursa={`masina:${v.slug}`} masinaImplicita={t} />
      </section>
    </div>
  );
}
