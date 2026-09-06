// ============================================================
// PAGINA UNEI MAȘINI DEZMEMBRATE — /masini/[slug]
//
// De ce există: cineva caută „dezmembrari passat b7 2012" mult mai des decât un
// cod OEM. Pagina asta e răspunsul la căutarea aia.
//
// CE O UMPLE (schimbat la 6 septembrie 2026)
// Piesele COMPATIBILE cu generația mașinii, prin `products.model_ids` — adică
// prin compatibilitatea extrasă la import din „Piesă auto compatibilă cu:".
// Se umple singură; nimeni nu mai leagă piese de mână.
//
// Înainte, pagina arăta doar piesele legate manual prin `products.vehicul_id`.
// Măsurat pe baza reală chiar înainte de schimbare: 0 din 8.895 de piese aveau
// coloana aia completată, deci toate cele 23 de pagini de mașină erau goale, iar
// cele 8.754 de piese importate n-aveau cum să ajungă vreodată acolo — feed-ul
// pieseauto.ro nu spune niciodată de pe ce mașină s-a demontat piesa.
//
// POTRIVIREA SE FACE PE GENERAȚIE, NICIODATĂ PE AN.
// Anul mașinii („Audi A4 2014") folosește o singură dată, în admin, ca operatorul
// să aleagă generația (A4 B8). Pe pagină nu mai intervine. Măsurat:
//     doar generația ............................ 221 de piese
//     generația ȘI anul 2014 în `products.ani` ...  90 de piese
// `products.ani` sunt anii MAȘINII DE PE CARE S-A DEMONTAT piesa, nu intervalul
// ei de compatibilitate. Vezi supabase/piese-compatibile-masini.sql.
//
// CE NU PROMITE PAGINA
// „Se potrivește pe", nu „demontată de pe". Compatibilitatea vine de la sursă și
// e orientativă — un B8 din 2009 și unul din 2014 (facelift) diferă la caroserie
// și lumini. De asta fiecare card își poartă anii, iar deasupra grilei stă o
// notă care spune limpede ce e și ce nu e. Un client care crede că piesa vine de
// pe mașina din poze e un retur.
//
// `products.vehicul_id` rămâne în bază și în editorul de piesă, dar e strict
// INTERNĂ: alimentează profitul pe mașină din /admin/masini și nu are niciun
// efect aici.
// ============================================================
import { cache } from "react";
import { sbServer, citesteTot } from "@/lib/supabase";
import { titluMasinaSeo, descriereMasina, SUFIX_TITLU } from "@/lib/seo";
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
import { nrPiese, numerePaginare, numeModelFaraAni, aniiModelului } from "@/lib/format";
import { SITE_URL } from "@/lib/config";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

// Ca la pagina de piesă: stocul trebuie citit la secundă, fiindcă fiecare piesă
// e unicat. `revalidate = 300` din layout ar ține aici o piesă vândută încă 5
// minute pe pagină.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/** Aceeași mărime ca pe /piese: 24 de carduri intră curat pe 2, 3 sau 4 coloane. */
const PE_PAGINA = 24;

type SP = { categorie?: string; pagina?: string };

/** Adresa aceleiași pagini de mașină, la alt număr de pagină sau altă categorie.
 *  Pagina 1 rămâne fără parametru, ca să existe o singură adresă canonică. */
function adresaPaginii(slug: string, sp: SP, n: number) {
  const q = new URLSearchParams();
  if (sp.categorie) q.set("categorie", sp.categorie);
  if (n > 1) q.set("pagina", String(n));
  const qs = q.toString();
  return `/masini/${slug}${qs ? `?${qs}` : ""}`;
}

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

/** Câte piese se potrivesc pe mașina asta, din view: un rând, nu tot catalogul.
 *  Tot prin `cache()`: îl folosesc și metadatele, și pagina. */
const iaNrPiese = cache(async (vehiculId: number) => {
  const sb = sbServer();
  if (!sb) return 0;
  const { data } = await sb.from("numar_piese_compatibile_pe_masina")
    .select("nr_piese").eq("vehicul_id", vehiculId).maybeSingle();
  return Number((data as { nr_piese?: number } | null)?.nr_piese ?? 0);
});

/** Generația și marca mașinii, ca date. Fără ele pagina n-are cheie de potrivire
 *  și rămâne la starea „încă nu sunt listate" — se completează din Admin → Mașini. */
const iaMarcaModel = cache(async (v: Vehicle) => {
  const sb = sbServer();
  if (!sb || (!v.marca_id && !v.model_id)) return { marca: null as Brand | null, model: null as Model | null };
  const [b, m] = await Promise.all([
    v.marca_id ? sb.from("brands").select("*").eq("id", v.marca_id).maybeSingle() : Promise.resolve({ data: null }),
    v.model_id ? sb.from("models").select("*").eq("id", v.model_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return { marca: (b.data as Brand | null) ?? null, model: (m.data as Model | null) ?? null };
});

export async function generateMetadata(
  { params, searchParams }: { params: { slug: string }; searchParams: SP },
): Promise<Metadata> {
  const v = await iaMasina(params.slug);
  if (!v) return { title: "Mașină negăsită" };
  const t = titluMasina(v);
  const pagina = Math.max(1, Number(searchParams.pagina) || 1);
  // Numărul se citește live, din view. O descriere care promite piese
  // inexistente e mai rea decât una fără cifre.
  const cate = await iaNrPiese(v.id);
  const titlu = titluMasinaSeo(t);
  const descriere = descriereMasina(t, cate);
  return {
    // Titlu simplu: sufixul îl adaugă șablonul din layout, o singură dată.
    title: titlu,
    description: descriere,
    // Fiecare pagină din serie își are canonica ei, ca pe /piese: altfel Google
    // ar vedea 10 adrese cu conținut diferit și aceeași canonică.
    alternates: { canonical: adresaPaginii(v.slug, searchParams, pagina) },
    openGraph: {
      title: titlu + SUFIX_TITLU,
      description: descriere,
      images: v.poze && v.poze.length > 0 ? [v.poze[0]] : undefined,
    },
  };
}

export default async function PaginaMasina(
  { params, searchParams }: { params: { slug: string }; searchParams: SP },
) {
  const sb = sbServer();
  if (!sb) notFound();
  const v = await iaMasina(params.slug);
  if (!v) notFound();

  const vacanta = await getVacanta();
  const { marca: marcaAcestei, model: modelAcestei } = await iaMarcaModel(v);
  const pagina = Math.max(1, Number(searchParams.pagina) || 1);

  // ---- piesele care se potrivesc pe mașina asta ----
  // Cheia e generația. Fără ea (mașină fără marcă/model în admin) pagina rămâne
  // corectă și goală, nu picată: `model_id` null înseamnă zero rezultate, iar
  // adminul marchează mașina cu „⚠ fără model".
  const categoriiTot = await citesteTot<Category>(
    () => sb.from("categories").select("*", { count: "exact" }).order("ordine").order("id"),
    { eticheta: "categoriile" });

  // Categoriile pentru care mașina chiar are piese, cu numărul lor. Se citește o
  // singură COLOANĂ, nu tot rândul: pentru 221 de piese e o cerere, iar dacă
  // vreun model ajunge la mii de piese rămâne tot un întreg pe rând, nu un
  // produs întreg cu poze și descriere.
  const randuriCat = v.model_id
    ? await citesteTot<{ categorie_id: number | null }>(
        () => sb.from("products").select("categorie_id", { count: "exact" })
          .contains("model_ids", [v.model_id as number])
          .eq("publicat", true).gt("stoc", 0).order("id"),
        { eticheta: "categoriile pieselor compatibile" })
    : [];

  const pePiese: Record<number, number> = {};
  for (const r of randuriCat) if (r.categorie_id) pePiese[r.categorie_id] = (pePiese[r.categorie_id] ?? 0) + 1;
  const categorii = categoriiTot
    .filter((c) => (pePiese[c.id] ?? 0) > 0)
    .sort((a, b) => (pePiese[b.id] ?? 0) - (pePiese[a.id] ?? 0));
  const total = randuriCat.length;

  // Filtrul pe categorie apare doar când chiar ajută: sub 12 piese, sau cu o
  // singură categorie, ar fi un rând de butoane care nu filtrează nimic.
  const areFiltru = total >= 12 && categorii.length > 1;
  const catActiva = areFiltru ? categorii.find((c) => c.slug === searchParams.categorie) : undefined;

  let piese: Product[] = [];
  let totalAfisat = total;
  if (v.model_id) {
    let q = sb.from("products")
      .select("*, categories!products_categorie_id_fkey(*)", { count: "exact" })
      .contains("model_ids", [v.model_id])
      .eq("publicat", true).gt("stoc", 0);
    if (catActiva) q = q.eq("categorie_id", catActiva.id);
    // Ordinea: întâi piesele SPECIFICE modelului. `nr_modele` e coloana calculată
    // din migrarea 34 — câte modele sunt trecute pe piesă. Una trecută doar la
    // „A4 B8" e aproape sigur o piesă de B8; una trecută la 31 de modele e un
    // senzor care intră peste tot și n-are ce căuta în capul listei.
    // `id` la final face paginarea deterministă: `created_at` nu e unic, importul
    // scrie sute de piese în aceeași secundă.
    q = q.order("nr_modele", { ascending: true })
         .order("created_at", { ascending: false })
         .order("id", { ascending: false });
    const de = (pagina - 1) * PE_PAGINA;
    const r = await q.range(de, de + PE_PAGINA - 1);
    if (r.error) throw new Error(`piesele compatibile: ${r.error.message}`);
    piese = (r.data ?? []) as Product[];
    totalAfisat = r.count ?? 0;
  }
  const ultimaPagina = Math.max(1, Math.ceil(totalAfisat / PE_PAGINA));

  const t = titluMasina(v);
  const numeGeneratie = modelAcestei
    ? `${marcaAcestei ? marcaAcestei.nume + " " : ""}${numeModelFaraAni(modelAcestei.nume)}`
    : "";
  const aniiGeneratiei = modelAcestei ? aniiModelului(modelAcestei) : "";

  const SPECIFICATII: [string, string][] = [
    ["Marca", marcaAcestei?.nume ?? "—"],
    ["Model", modelAcestei ? numeModelFaraAni(modelAcestei.nume) : "—"],
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
        ...(modelAcestei ? { model: numeModelFaraAni(modelAcestei.nume) } : {}),
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
            {total > 0
              ? <>Avem <b className="text-text">{nrPiese(total)}</b> care se potrivesc pe {numeGeneratie || t}.</>
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

      {/* ---- piesele care se potrivesc ---- */}
      <section className="mt-12">
        <h2 className="font-disp font-bold text-2xl">
          {numeGeneratie ? `Piese care se potrivesc pe ${numeGeneratie}` : "Piese care se potrivesc"}
          {aniiGeneratiei && <span className="font-normal text-textSecundar text-lg"> ({aniiGeneratiei})</span>}
        </h2>

        {/* Nota nu e mărunțiș juridic, e ce ne scutește de retururi: lista vine din
            compatibilitatea declarată de sursă, pe generație. Un B8 din 2009 și
            unul din 2014, de după facelift, diferă la caroserie și lumini. */}
        {total > 0 && !vacanta.activ && (
          <p className="mt-2 mb-5 text-[13px] text-textSecundar max-w-3xl">
            Lista e făcută după generația mașinii, nu după piesele demontate chiar de pe exemplarul din
            poze. Fiecare piesă își poartă anii mașinii de pe care a fost demontată — dacă nu ești sigur
            că se potrivește pe anul tău, sună-ne și verificăm împreună înainte să comanzi.
          </p>
        )}

        {areFiltru && (
          <div className="flex gap-2 flex-wrap mb-5">
            <Link href={adresaPaginii(v.slug, {}, 1)}
              className={`rounded-full border px-3.5 py-1.5 text-sm ${!catActiva ? "bg-accent text-accentContrast border-accentChenar" : "border-chenarPuternic"}`}>
              Toate ({total})
            </Link>
            {categorii.map((c) => (
              <Link key={c.id} href={adresaPaginii(v.slug, { categorie: c.slug }, 1)}
                className={`rounded-full border px-3.5 py-1.5 text-sm ${catActiva?.id === c.id ? "bg-accent text-accentContrast border-accentChenar" : "border-chenarPuternic"}`}>
                {c.nume} ({pePiese[c.id]})
              </Link>
            ))}
          </div>
        )}

        {vacanta.activ ? (
          <VacantaStareGoala vacanta={vacanta} />
        ) : piese.length > 0 ? (
          <>
            {ultimaPagina > 1 && (
              <p className="text-sm text-textSecundar mb-4">
                {totalAfisat} {totalAfisat === 1 ? "piesă" : "piese"} · pagina {pagina} din {ultimaPagina}
              </p>
            )}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {piese.map((p, i) => <ProductCard key={p.id} p={p} prioritara={i === 0} />)}
            </div>

            {/* Paginarea: linkuri adevărate, ca pe /piese. Google trebuie să poată
                urma fiecare pagină, altfel din 221 de piese ar indexa 24. */}
            {ultimaPagina > 1 && (
              <>
                {pagina > 1 && <link rel="prev" href={adresaPaginii(v.slug, searchParams, pagina - 1)} />}
                {pagina < ultimaPagina && <link rel="next" href={adresaPaginii(v.slug, searchParams, pagina + 1)} />}
                <nav aria-label="Paginare" className="mt-8 flex items-center justify-center gap-1.5 flex-wrap">
                  {pagina > 1 && (
                    <Link href={adresaPaginii(v.slug, searchParams, pagina - 1)} rel="prev"
                      className="rounded-lg border border-chenarPuternic px-3 min-h-[44px] inline-flex items-center text-sm">
                      ← Înapoi
                    </Link>
                  )}
                  {numerePaginare(pagina, ultimaPagina).map((n, i) =>
                    n === null ? (
                      <span key={`gol-${i}`} className="px-1.5 text-textSecundar">…</span>
                    ) : (
                      <Link key={n} href={adresaPaginii(v.slug, searchParams, n)}
                        aria-current={n === pagina ? "page" : undefined}
                        className={`rounded-lg border px-3 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-sm ${
                          n === pagina ? "bg-accent text-accentContrast border-accentChenar font-semibold" : "border-chenarPuternic"}`}>
                        {n}
                      </Link>
                    ))}
                  {pagina < ultimaPagina && (
                    <Link href={adresaPaginii(v.slug, searchParams, pagina + 1)} rel="next"
                      className="rounded-lg border border-chenarPuternic px-3 min-h-[44px] inline-flex items-center text-sm">
                      Înainte →
                    </Link>
                  )}
                </nav>
              </>
            )}
          </>
        ) : (
          <StareGoala
            icon={<MasinaArt className="w-14 h-14 rounded-full" />}
            titlu={total > 0 ? "Nicio piesă în categoria asta" : "Piesele nu sunt încă listate"}
            text={total > 0
              ? "Alege altă categorie sau vezi toate piesele care se potrivesc."
              : `Dezmembrăm ${t} chiar acum. Spune-ne ce piesă cauți și îți răspundem cu disponibilitatea și prețul.`}
            actiune={total > 0 ? { eticheta: "Vezi toate piesele", href: adresaPaginii(v.slug, {}, 1) } : undefined}
            secundar={{ eticheta: "Vezi tot catalogul", href: "/piese" }}
          />
        )}
      </section>

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
