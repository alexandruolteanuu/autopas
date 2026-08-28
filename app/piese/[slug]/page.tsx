import { cache } from "react";
import { sbServer, citesteTot } from "@/lib/supabase";
import { titluPiesa, descrierePiesa } from "@/lib/seo";
import type { Product, Category, Brand, Model } from "@/lib/types";
import AddToCart from "@/components/AddToCart";
import ProductCard from "@/components/ProductCard";
import ProductGallery from "@/components/ProductGallery";
import Breadcrumbs from "@/components/Breadcrumbs";
import FavButton from "@/components/FavButton";
import BackLink from "@/components/BackLink";
import { TrustIcon } from "@/components/TrustBar";
import { lei } from "@/lib/format";
import EvenimentGa from "@/components/EvenimentGa";
import { piesaGa, MONEDA } from "@/lib/analytics";
import { getSetariServer, waLinkCu } from "@/lib/settings";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getVacanta } from "@/lib/settings";
import { VacantaBanner } from "@/components/VacantaNota";

export const dynamic = "force-dynamic";
// Datele catalogului se citesc mereu proaspăt. `revalidate = 300` din layout
// (pus ca modificările din Admin → Setări să ajungă pe paginile statice) se
// aplică întregului arbore de rute și punea în cache 5 minute și interogările
// de aici — o piesă vândută rămânea „În stoc". La dezmembrări fiecare piesă e
// unicat, deci stocul trebuie citit la secundă.
export const fetchCache = "force-no-store";

// ---- CITIRI ÎMPĂRȚITE ÎNTRE METADATE ȘI PAGINĂ ----
//
// `generateMetadata` și componenta paginii rulează amândouă la fiecare afișare
// de produs. Fără `cache()` din React, fiecare și-ar face propriile interogări:
// pe 8.739 de pagini asta ar însemna dublarea cererilor exact după ce am tăiat
// timpul de răspuns de la 2,73 s la 0,88 s.
//
// `cache()` reține rezultatul pe durata UNEI cereri HTTP, deci a doua chemare
// primește ce a adus prima. Nu e cache între vizitatori — nu se bate cap în cap
// cu `fetchCache = "force-no-store"` de mai sus, care ține stocul proaspăt.
const iaPiesa = cache(async (slug: string) => {
  const sb = sbServer();
  if (!sb) return null;
  // Numim explicit cheia străină: `products` leagă `categories` de două ori
  // (categorie_id și subcategorie_id), iar fără precizare cererea e respinsă ca
  // ambiguă, produsul iese `null` și pagina răspundea 404 pentru orice piesă.
  const { data } = await sb.from("products")
    .select("*, categories!products_categorie_id_fkey(*), vehicles(*)")
    .eq("slug", slug).single();
  return (data as Product | null) ?? null;
});

const iaModeleSiMarci = cache(async () => {
  const sb = sbServer();
  if (!sb) return { models: [] as Model[], brands: [] as Brand[] };
  const [models, brands] = await Promise.all([
    citesteTot<Model>(() => sb.from("models").select("*", { count: "exact" }).order("id"), { eticheta: "modelele" }),
    citesteTot<Brand>(() => sb.from("brands").select("*", { count: "exact" }).order("id"), { eticheta: "mărcile" }),
  ]);
  return { models, brands };
});

/** Modelul „principal" e primul din `model_ids` — cel pe care importul îl
 *  confirmă din titlu (vezi CLAUDE.md). Marca vine de la el. */
function masinaPiesei(prod: Product, models: Model[], brands: Brand[]) {
  const primul = (prod.model_ids ?? [])[0];
  const model = primul ? models.find((m) => m.id === primul) ?? null : null;
  const marca = model ? brands.find((b) => b.id === model.brand_id) ?? null : null;
  return { model, marca };
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const prod = await iaPiesa(params.slug);
  if (!prod) return { title: "Piesă negăsită", alternates: { canonical: `/piese/${params.slug}` } };

  const { models, brands } = await iaModeleSiMarci();
  const { model, marca } = masinaPiesei(prod, models, brands);
  const descriere = descrierePiesa(prod);
  const titlu = titluPiesa(prod, marca, model);
  return {
    // `absolute` ocolește șablonul „%s · Autopas Dezmembrări" din layout. Fără
    // el, titlul ieșea „… | AUTOPAS · Autopas Dezmembrări" — marca de două ori
    // și 74 de caractere, din care Google ar fi arătat vreo 60.
    title: { absolute: titlu },
    description: descriere,
    alternates: { canonical: `/piese/${params.slug}` },
    openGraph: {
      title: titlu,
      description: descriere,
      // Poza reală a piesei, nu imaginea generică de partajare a site-ului.
      images: prod.poze && prod.poze.length > 0 ? [prod.poze[0]] : undefined,
    },
  };
}

export default async function Produs({ params }: { params: { slug: string } }) {
  const sb = sbServer();
  if (!sb) notFound();
  // Aceeași citire pe care a folosit-o și `generateMetadata`: `cache()` o
  // servește din memoria cererii curente, deci nu pleacă a doua interogare.
  const p = await iaPiesa(params.slug);
  if (!p) notFound();
  // MOD VACANȚĂ — pagina rămâne accesibilă, cu status 200.
  // Dacă ar întoarce 404 sau ar dispărea din sitemap, Google ar scoate-o din
  // index, iar poziționarea s-ar recâștiga în săptămâni, nu în ore. Se schimbă
  // doar butonul de comandă. Vezi supabase/mod-vacanta.sql și A.4 din sarcină.
  const vacanta = await getVacanta();
  const prod = p as Product;
  const { firma } = await getSetariServer();
  await sb.rpc("vazut_produs", { p_id: prod.id });

  const { models, brands } = await iaModeleSiMarci();
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
      <span className="text-ok">Factură ✓</span><span className="text-ok">Garanție 90 de zile ✓</span><span className="text-ok">Retur în 14 zile ✓</span></span>],
    ["Livrare", "prin curier rapid în 24/48h (contra cost)"],
  ];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
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

      <EvenimentGa nume="view_item" cheie={prod.slug}
        date={{ currency: MONEDA, value: Number(prod.pret_lei), items: [piesaGa(prod)] }} />

      <div className="grid lg:grid-cols-2 gap-8">
        <ProductGallery poze={prod.poze ?? []} art={prod.art} nume={prod.nume} />

        <div>
          {/* Ordinea pe telefon: denumire, cod intern, preț, stoc, apoi butonul
              principal pe toată lățimea — ca să fie vizibil fără defilare. */}
          <h1 className="t-sectiune">{prod.nume}</h1>

          <div className="mt-2 text-[13px] text-textSecundar">Cod intern: {prod.cod_intern ?? "—"}</div>

          <div className="mt-3 flex items-end gap-2.5 flex-wrap">
            <span className="t-pret accentuat !text-[30px] sm:!text-[36px]">{lei(Number(prod.pret_lei), prod.pret_sufix)}</span>
            <span className="text-textSecundar text-[13px]">TVA inclus</span>
          </div>

          <div className="mt-3 flex items-center gap-2.5 flex-wrap text-[12px]">
            {prod.stoc > 0
              ? <span className="px-2.5 py-1 rounded-full bg-ok/10 text-ok">În stoc</span>
              : <span className="px-2.5 py-1 rounded-full bg-chenar text-text">Stoc epuizat</span>}
            {prod.originala !== false && (
              <span className="px-2.5 py-1 rounded-full bg-accent/10 accentuat">Piesă originală</span>
            )}
          </div>

          {vacanta.activ && <VacantaBanner vacanta={vacanta} className="mt-4" />}

          <div className="mt-4 grid gap-2.5 sm:grid-cols-[minmax(0,1fr),auto]">
            {vacanta.activ
              ? <div className="rounded-xl bg-chenar text-text px-5 min-h-[44px] grid place-items-center text-sm font-medium text-center">
                  Comenzile sunt oprite temporar
                </div>
              : prod.stoc > 0
              ? <AddToCart p={prod} mare />
              : <div className="rounded-xl bg-chenar text-text px-5 min-h-[44px] grid place-items-center text-sm font-medium text-center">Stoc epuizat — vezi piese similare</div>}
            <div className="grid grid-cols-2 sm:flex gap-2.5">
              <a href={waLinkCu(firma.whatsapp, `Bună! Mă interesează: ${prod.nume}${prod.oem ? ` (OEM ${prod.oem})` : ""} — cod ${prod.cod_intern ?? ""}.`)}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-xl bg-[#1FA463] text-white px-5 min-h-[44px] text-sm font-semibold hover:brightness-110">
                WhatsApp</a>
              <FavButton id={prod.id} variant="line" />
            </div>
          </div>

          {prod.originala !== false && (
            <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-ok/30 bg-ok/5 px-3.5 py-2.5 text-[13px] text-text">
              <span className="text-ok shrink-0"><TrustIcon kind="scut" className="w-5 h-5" /></span>
              Piesă auto originală din dezmembrări — verificată înainte de livrare
            </div>
          )}

          <div className="card mt-5 overflow-hidden">
            <div className="bg-suprafata2 px-4 py-2.5 border-b border-chenar"><b className="font-disp font-semibold text-[13px]">Detaliile piesei</b></div>
            <dl className="divide-y divide-chenar text-[13.5px]">
              {FISA.map(([k, v]) => (
                <div key={k} className="flex gap-4 px-4 py-2.5">
                  <dt className="text-textSecundar w-32 shrink-0">{k}</dt>
                  <dd className="min-w-0">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mt-3 grid sm:grid-cols-2 gap-2 text-[13px]">
            <Link href="/legal/livrare" className="card px-3.5 min-h-[44px] flex items-center gap-2 hover:border-accentChenar">
              <span className="accentuat"><TrustIcon kind="camion" /></span> Livrare 1–3 zile lucrătoare</Link>
            <Link href="/legal/politica-de-retur" className="card px-3.5 min-h-[44px] flex items-center gap-2 hover:border-accentChenar">
              <span className="accentuat"><TrustIcon kind="retur" /></span> Retur în 14 zile</Link>
          </div>

          {prod.stare_nota && (
            <div className="card p-4 mt-3 text-[13.5px]">
              <b className="font-disp font-semibold text-[13px] block mb-1.5">Descriere</b>
              <p className="text-text">{prod.stare_nota}</p>
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
          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">{similare.map((x) => <ProductCard key={x.id} p={x} />)}</div>
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
