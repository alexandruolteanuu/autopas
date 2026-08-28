import Breadcrumbs from "@/components/Breadcrumbs";
import { sbServer } from "@/lib/supabase";
import type { Product, Category, Brand, Model } from "@/lib/types";
import ProductCard from "@/components/ProductCard";
import VehicleFilter from "@/components/VehicleFilter";
import PartRequestForm from "@/components/PartRequestForm";
import SortSelect from "@/components/SortSelect";
import FiltreSertar from "@/components/FiltreSertar";
import StareGoala from "@/components/StareGoala";
import { IconLupa } from "@/components/Icoane";
import { fitmentCounts, marciCuPiese, textCautare } from "@/lib/format";
import { getVacanta } from "@/lib/settings";
import { VacantaStareGoala } from "@/components/VacantaNota";
import Link from "next/link";

export const dynamic = "force-dynamic";
// Datele catalogului se citesc mereu proaspăt. `revalidate = 300` din layout
// (pus ca modificările din Admin → Setări să ajungă pe paginile statice) se
// aplică întregului arbore de rute și punea în cache 5 minute și interogările
// de aici — o piesă vândută rămânea „În stoc". La dezmembrări fiecare piesă e
// unicat, deci stocul trebuie citit la secundă.
export const fetchCache = "force-no-store";
export const metadata = { title: "Piese auto" };

type SP = { q?: string; oem?: string; categorie?: string; subcategorie?: string; vehicul?: string;
  sort?: string; marca?: string; model?: string };

export default async function Piese({ searchParams }: { searchParams: SP }) {
  const sb = sbServer();
  // În vacanță listarea rămâne, cu filtre cu tot, dar fără rezultate. Paginile
  // individuale de produs trăiesc mai departe, cu 200 — vezi app/piese/[slug].
  const vacanta = await getVacanta();
  let products: Product[] = []; let cats: Category[] = []; let titlu = "Toate piesele";
  let brands: Brand[] = []; let models: Model[] = []; let fitRows: { model_ids: number[] }[] = [];
  let catActiva: Category | null = null;

  if (sb) {
    cats = ((await sb.from("categorii_cu_numar").select("*").order("ordine")).data ?? []) as Category[];
    brands = ((await sb.from("brands").select("*").order("ordine")).data ?? []) as Brand[];
    models = ((await sb.from("models").select("*").order("nume")).data ?? []) as Model[];
    fitRows = ((await sb.from("products").select("model_ids").eq("publicat", true)).data ?? []) as { model_ids: number[] }[];

    // Atenție: `products` are DOUĂ legături către `categories` (categorie_id și
    // subcategorie_id). Fără să spunem pe care o vrem, Supabase respinge cererea
    // ca ambiguă (eroarea PGRST201) și lista rămâne goală. Numim cheia străină.
    let q = sb.from("products")
      .select("*, categories!products_categorie_id_fkey(*), vehicles(*)")
      .eq("publicat", true);

    if (searchParams.subcategorie) {
      const s = cats.find((x) => x.slug === searchParams.subcategorie);
      if (s) { q = q.eq("subcategorie_id", s.id); titlu = s.nume; catActiva = s; }
    } else if (searchParams.categorie) {
      const c = cats.find((x) => x.slug === searchParams.categorie);
      if (c) {
        const copii = cats.filter((x) => x.parent_id === c.id).map((x) => x.id);
        q = q.or(`categorie_id.eq.${c.id}${copii.length ? `,subcategorie_id.in.(${copii.join(",")})` : ""}`);
        titlu = c.nume; catActiva = c;
      }
    }
    if (searchParams.vehicul) {
      const v = (await sb.from("vehicles").select("*").eq("slug", searchParams.vehicul).single()).data;
      if (v) { q = q.eq("vehicul_id", v.id); titlu = `Piese din ${v.nume}${v.an ? ` · ${v.an}` : ""}`; }
    }
    if (searchParams.model) {
      const m = models.find((x) => x.slug === searchParams.model);
      if (m) {
        q = q.contains("model_ids", [m.id]);
        const b = brands.find((x) => x.id === m.brand_id);
        titlu = `Piese pentru ${b?.nume ?? ""} ${m.nume}`;
      }
    } else if (searchParams.marca) {
      const b = brands.find((x) => x.slug === searchParams.marca);
      if (b) {
        const ids = models.filter((m) => m.brand_id === b.id).map((m) => m.id);
        if (ids.length) q = q.overlaps("model_ids", ids);
        titlu = `Piese ${b.nume}`;
      }
    }
    if (catActiva && (searchParams.marca || searchParams.model)) titlu += ` — ${catActiva.nume}`;

    const text = searchParams.q || searchParams.oem;
    if (text) {
      // Căutăm în coloana `cautare` (nume + OEM + cod intern, fără diacritice),
      // normalizând la fel și ce a tastat clientul: „turbina" găsește „Turbină".
      // Cuvintele se caută separat, fiecare cu propriul filtru, deci trebuie să
      // apară toate, dar nu neapărat lipite: „turbina ford" găsește
      // „Turbină Garrett — Ford Focus 3".
      // Bonus: textul merge ca valoare, nu lipit într-un filtru `or`, unde o
      // virgulă din căutare strica întreaga expresie.
      for (const cuvant of textCautare(text).split(/\s+/).filter(Boolean).slice(0, 6)) {
        q = q.ilike("cautare", `%${cuvant}%`);
      }
      titlu = `Rezultate pentru „${text}”`;
    }

    if (searchParams.sort === "pret-asc") q = q.order("pret_lei", { ascending: true });
    else if (searchParams.sort === "pret-desc") q = q.order("pret_lei", { ascending: false });
    else if (searchParams.sort === "nume") q = q.order("nume", { ascending: true });
    else q = q.order("created_at", { ascending: false });

    products = ((await q).data ?? []) as Product[];
  }

  // Filtrele active, ca etichete cu „×": fiecare link duce la aceeași căutare,
  // fără parametrul respectiv. Se construiesc pe server, din searchParams.
  const faraParam = (cheie: keyof SP) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) if (k !== cheie && v) p.set(k, String(v));
    const qs = p.toString();
    return qs ? `/piese?${qs}` : "/piese";
  };
  const filtreActive: { eticheta: string; href: string }[] = [];
  if (searchParams.q) filtreActive.push({ eticheta: `„${searchParams.q}”`, href: faraParam("q") });
  if (catActiva) filtreActive.push({ eticheta: catActiva.nume, href: faraParam(catActiva.parent_id ? "subcategorie" : "categorie") });
  if (searchParams.marca) filtreActive.push({ eticheta: brands.find((b) => b.slug === searchParams.marca)?.nume ?? searchParams.marca, href: faraParam("marca") });
  if (searchParams.model) filtreActive.push({ eticheta: models.find((m) => m.slug === searchParams.model)?.nume ?? searchParams.model, href: faraParam("model") });
  if (searchParams.vehicul) filtreActive.push({ eticheta: "Mașina aleasă", href: faraParam("vehicul") });

  // Numărătorile se calculează o dată: le folosesc și filtrul (ca să scrie „· 12 piese"),
  // și `marciCuPiese`, ca să nu arate în listă mărci fără nicio piesă publicată.
  // `brands` rămâne întreg mai sus, la etichetele filtrelor active: cine ajunge pe
  // /piese?marca=byd cu un link vechi trebuie să vadă tot „BYD", nu slug-ul brut.
  const counts = fitmentCounts(fitRows, models);
  const principale = cats.filter((c) => !c.parent_id);
  const subAle = (id: number) => cats.filter((c) => c.parent_id === id);
  const parintele = catActiva?.parent_id ? cats.find((c) => c.id === catActiva!.parent_id) : catActiva;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumbs items={[{ t: "Acasă", href: "/" },
        { t: "Piese auto", ...(catActiva ? { href: "/piese" } : {}) },
        ...(catActiva?.parent_id ? [{ t: cats.find((c) => c.id === catActiva!.parent_id)?.nume ?? "", href: `/piese?categorie=${cats.find((c) => c.id === catActiva!.parent_id)?.slug}` }] : []),
        ...(catActiva ? [{ t: catActiva.nume }] : [])]} />
      <h1 className="t-sectiune mt-2 mb-4">{titlu}</h1>
      <div className="mb-6"><VehicleFilter brands={marciCuPiese(brands, counts)} models={models} cats={principale} counts={counts} compact /></div>

      {/* Filtrele active, pe un rând care se defilează orizontal pe telefon */}
      {filtreActive.length > 0 && (
        <div className="-mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 mb-4 flex gap-2 overflow-x-auto">
          {filtreActive.map((f) => (
            <Link key={f.eticheta} href={f.href}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-chenar bg-suprafata pl-3 pr-2 min-h-[36px] text-[13px] hover:border-accentChenar">
              {f.eticheta}
              <span aria-hidden="true" className="grid place-items-center w-6 h-6 rounded-full text-textSecundar">×</span>
              <span className="sr-only">Elimină filtrul</span>
            </Link>
          ))}
          <Link href="/piese" className="shrink-0 inline-flex items-center rounded-full px-3 min-h-[36px] text-[13px] accentuat font-semibold">
            Șterge filtrele
          </Link>
        </div>
      )}

      <div className="grid lg:grid-cols-[250px,minmax(0,1fr)] gap-6">
        {/* ===== FILTRUL DE CATEGORII =====
            Sub 1024px conținutul de mai jos ajunge în sertarul care urcă de jos;
            de la 1024px rămâne coloana laterală. */}
        <FiltreSertar nrFiltre={filtreActive.length}>
          <nav className="text-sm">
            <Link href="/piese" className={`flex items-center rounded-lg px-3 min-h-[44px] ${!catActiva ? "bg-accent/10 accentuat font-semibold" : "hover:bg-suprafata2"}`}>
              Toate piesele</Link>
            {principale.map((c) => {
              const subs = subAle(c.id);
              const deschis = parintele?.id === c.id;
              return (
                <div key={c.id} className="mt-0.5">
                  <Link href={`/piese?categorie=${c.slug}`}
                    className={`flex items-center justify-between gap-2 rounded-lg px-3 min-h-[44px] ${catActiva?.id === c.id ? "bg-accent/10 accentuat font-semibold" : "hover:bg-suprafata2"}`}>
                    <span>{c.nume}</span>
                    <span className="text-[12px] text-textSecundar">{c.nr_piese ?? 0}</span>
                  </Link>
                  {deschis && subs.length > 0 && (
                    <div className="ml-3 pl-2 border-l-2 border-chenar mt-0.5">
                      {subs.map((s) => (
                        <Link key={s.id} href={`/piese?subcategorie=${s.slug}`}
                          className={`flex items-center justify-between gap-2 rounded-lg px-3 min-h-[44px] text-[13px] ${catActiva?.id === s.id ? "accentuat font-semibold" : "text-text hover:bg-suprafata2"}`}>
                          <span>{s.nume}</span><span className="text-[12px] text-textSecundar">{s.nr_piese ?? 0}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </FiltreSertar>

        <div className="min-w-0">
          {!vacanta.activ && (
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <span className="text-sm text-textSecundar">{products.length} {products.length === 1 ? "piesă găsită" : "piese găsite"}</span>
              <SortSelect />
            </div>
          )}
          {!vacanta.activ && (
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
              {products.map((p) => <ProductCard key={p.id} p={p} />)}
            </div>
          )}
          {/* Mesajul de vacanță ține locul stării goale obișnuite: aceea ar fi
              spus „încearcă să elimini marca", trimițând omul să caute degeaba. */}
          {vacanta.activ && <VacantaStareGoala vacanta={vacanta} titlu="Suntem în pauză" />}
          {!vacanta.activ && products.length === 0 && (
            <StareGoala
              icon={<IconLupa className="w-7 h-7" />}
              titlu="Nicio piesă nu corespunde filtrelor"
              text="Încearcă să elimini marca sau categoria. Stocul se schimbă săptămânal, pe măsură ce dezmembrăm mașini noi."
              actiune={filtreActive.length > 0 ? { eticheta: "Șterge filtrele", href: "/piese" } : undefined}
              copii={<div className="max-w-2xl mx-auto text-left">
                <p className="text-[13px] text-textSecundar mb-3 text-center">Sau lasă-ne o cerere — te anunțăm imediat ce piesa intră în stoc.</p>
                <PartRequestForm sursa="filtru-fara-rezultate" />
              </div>}
            />
          )}
        </div>
      </div>
    </div>
  );
}
