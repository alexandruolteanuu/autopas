import Breadcrumbs from "@/components/Breadcrumbs";
import { cache } from "react";
import { sbServer, citesteTot } from "@/lib/supabase";
import type { Product, Category, Brand, Model } from "@/lib/types";
import ProductCard from "@/components/ProductCard";
import VehicleFilter from "@/components/VehicleFilter";
import PartRequestForm from "@/components/PartRequestForm";
import SortSelect from "@/components/SortSelect";
import FiltreSertar from "@/components/FiltreSertar";
import StareGoala from "@/components/StareGoala";
import { IconLupa } from "@/components/Icoane";
import { counturiPeModel, marciCuPiese, textCautare } from "@/lib/format";
import { getVacanta } from "@/lib/settings";
import { VacantaStareGoala } from "@/components/VacantaNota";
import Link from "next/link";
import EvenimentGa from "@/components/EvenimentGa";
import { piesaGa } from "@/lib/analytics";

export const dynamic = "force-dynamic";
// Datele catalogului se citesc mereu proaspăt. `revalidate = 300` din layout
// (pus ca modificările din Admin → Setări să ajungă pe paginile statice) se
// aplică întregului arbore de rute și punea în cache 5 minute și interogările
// de aici — o piesă vândută rămânea „În stoc". La dezmembrări fiecare piesă e
// unicat, deci stocul trebuie citit la secundă.
export const fetchCache = "force-no-store";
/** Câte piese pe pagină. 24 se împarte exact la 1, 2 și 3 coloane, deci ultimul
 *  rând al grilei e plin la orice lățime.
 *  NU e exportată: Next acceptă în fișierul unei pagini doar o listă fixă de
 *  exporturi (`metadata`, `dynamic`, `revalidate`…) și respinge build-ul pentru
 *  oricare altul. */
const PE_PAGINA = 24;

type SP = { q?: string; oem?: string; categorie?: string; subcategorie?: string; vehicul?: string;
  sort?: string; marca?: string; model?: string; pagina?: string };

/** Adresa aceleiași căutări, la altă pagină. Pagina 1 rămâne fără parametru, ca
 *  să existe o singură adresă canonică pentru ea, nu și `?pagina=1`. */
function adresaPaginii(sp: SP, n: number) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (k !== "pagina" && v) q.set(k, String(v));
  if (n > 1) q.set("pagina", String(n));
  const qs = q.toString();
  return `/piese${qs ? `?${qs}` : ""}`;
}

/**
 * Numerele de pagină de arătat: primele, ultimele și vecinii paginii curente,
 * cu „…" în locul golurilor. `null` = gol.
 *
 * La 365 de pagini nu se pot afișa toate — pe telefon ar fi un perete de cifre
 * lung cât pagina. Se arată mereu prima și ultima, ca saltul la capăt să fie la
 * un clic, plus câte una de-o parte și de alta a celei curente: maximum 7
 * elemente, deci încape și la 320px.
 */
function numerePaginare(pagina: number, ultima: number): (number | null)[] {
  // Fără `Set`: `tsconfig` țintește ES5, unde răspândirea unui Set n-are voie.
  const brute = [1, ultima, pagina - 1, pagina, pagina + 1];
  const n = brute
    .filter((x, i) => x >= 1 && x <= ultima && brute.indexOf(x) === i)
    .sort((a, b) => a - b);
  const out: (number | null)[] = [];
  for (let i = 0; i < n.length; i++) {
    if (i > 0 && n[i] - n[i - 1] > 1) out.push(null);
    out.push(n[i]);
  }
  return out;
}

/**
 * Titlul și adresa canonică pentru fiecare pagină.
 *
 * Fără `canonical` pe pagină, Google ar vedea 365 de adrese cu conținut diferit
 * dar aceeași canonică și le-ar considera duplicate — exact invers față de ce
 * vrem, adică fiecare piesă găsibilă. `prev`/`next` îi spun că sunt o serie.
 */
/** Câte piese sunt publicate, pentru descriere. Interogare de numărare pură
 *  (`head: true`), fără rânduri, prin `cache()` ca să nu se repete. */
const cateePiese = cache(async () => {
  const sb = sbServer();
  if (!sb) return 0;
  const { count } = await sb.from("products")
    .select("id", { count: "exact", head: true }).eq("publicat", true).gt("stoc", 0);
  return count ?? 0;
});

export async function generateMetadata({ searchParams }: { searchParams: SP }) {
  const pagina = Math.max(1, Number(searchParams.pagina) || 1);
  const cate = await cateePiese();
  // Numărul e informație reală și se schimbă odată cu catalogul — exact ce
  // caută omul care se întreabă dacă merită să intre.
  // Paginile 2+ primesc numărul paginii: altfel toate cele 365 ar avea aceeași
  // descriere. Canonical-ul le desparte oricum, dar o descriere repetată de 365
  // de ori nu ajută pe nimeni.
  const descriere = cate > 0
    ? (pagina > 1
        ? `Pagina ${pagina} din catalogul de piese auto second-hand — ${cate.toLocaleString("ro-RO")} de piese pe stoc, din dezmembrări autorizate în județul Neamț.`
        : `${cate.toLocaleString("ro-RO")} de piese auto second-hand pe stoc, din dezmembrări autorizate în județul Neamț. Testate, cu garanție 90 de zile și livrare în toată țara.`)
    : undefined;
  return {
    title: pagina > 1 ? `Piese auto — pagina ${pagina}` : "Piese auto",
    description: descriere,
    alternates: { canonical: adresaPaginii(searchParams, pagina) },
    // `rel=prev/next` NU se pun aici: `metadata.other` ar emite
    // `<meta name="link:prev">`, care nu înseamnă nimic pentru Google. Se pun ca
    // elemente `<link>` adevărate în corpul paginii, unde numărul total de pagini
    // e deja calculat — Next le ridică singur în <head>.
  };
}

export default async function Piese({ searchParams }: { searchParams: SP }) {
  const sb = sbServer();
  // În vacanță listarea rămâne, cu filtre cu tot, dar fără rezultate. Paginile
  // individuale de produs trăiesc mai departe, cu 200 — vezi app/piese/[slug].
  const vacanta = await getVacanta();
  let products: Product[] = []; let cats: Category[] = []; let titlu = "Toate piesele";
  let brands: Brand[] = []; let models: Model[] = []; let fitRows: any[] = [];
  let catActiva: Category | null = null;
  // Numărul REAL de rezultate, din `count: "exact"` — adică din antetul
  // `content-range` al lui PostgREST. Înainte se afișa `products.length`, iar
  // aceea era lungimea listei primite: cu plafonul de 1.000 al serverului,
  // pagina scria „1000 piese găsite" pentru un catalog de 8.754.
  let total = 0;
  const pagina = Math.max(1, Number(searchParams.pagina) || 1);

  if (sb) {
    // ---- VALUL 1: tot ce nu depinde de nimic, în paralel ----
    //
    // Erau cinci `await` unul după altul, deci cinci drumuri dus-întors până la
    // Supabase, în serie. Doar interogarea de piese are nevoie de rezultatele
    // celorlalte — traduce slug-urile din adresă în id-uri, prin `cats.find`,
    // `models.find` și `brands.find` — așa că restul pot pleca deodată.
    //
    // Contoarele filtrului vin din view (538 de rânduri), nu din `products`
    // (8.783, tăiate la 1.000). Vezi supabase/numar-piese-pe-model.sql.
    //
    // `Promise.all` respinge la PRIMA eroare, iar noi n-o prindem aici: pagina
    // pică vizibil. E intenționat. Dacă am fi pus `?? []` pe fiecare rezultat,
    // o interogare căzută ar fi dat o listă goală de mărci sau de categorii, iar
    // pagina ar fi arătat „nicio piesă găsită" ca și cum ar fi fost adevărat —
    // exact tiparul de la plafonul de 1.000 de rânduri și de la RLS: o
    // operațiune care pare că a reușit, dar n-a atins tot. Mai bine o eroare
    // văzută decât un catalog gol care pare corect.
    const [rCats, rBrands, rModels, rFit] = await Promise.all([
      citesteTot<Category>(() => sb.from("categorii_cu_numar").select("*", { count: "exact" }).order("ordine").order("id"), { eticheta: "categoriile" }),
      citesteTot<Brand>(() => sb.from("brands").select("*", { count: "exact" }).order("ordine").order("id"), { eticheta: "mărcile" }),
      citesteTot<Model>(() => sb.from("models").select("*", { count: "exact" }).order("nume").order("id"), { eticheta: "modelele" }),
      citesteTot<any>(() => sb.from("numar_piese_pe_model").select("*", { count: "exact" }).order("model_id"), { eticheta: "contoarele pe model" }),
    ]);
    cats = rCats; brands = rBrands; models = rModels; fitRows = rFit;

    // Atenție: `products` are DOUĂ legături către `categories` (categorie_id și
    // subcategorie_id). Fără să spunem pe care o vrem, Supabase respinge cererea
    // ca ambiguă (eroarea PGRST201) și lista rămâne goală. Numim cheia străină.
    // `count: "exact"` cere serverului totalul filtrului, nu doar rândurile
    // paginii — el ajunge în `count` și de acolo în contorul de sus.
    let q = sb.from("products")
      .select("*, categories!products_categorie_id_fkey(*), vehicles(*)", { count: "exact" })
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

    // Ordinea secundară după `id` face paginarea deterministă: `created_at` nu e
    // unic (importul scrie sute de piese în aceeași secundă), iar fără un
    // departajator Postgres n-are nicio obligație să păstreze ordinea între două
    // cereri — aceeași piesă ar putea apărea pe pagina 2 și pe 3, iar alta deloc.
    q = q.order("id", { ascending: false });

    const de = (pagina - 1) * PE_PAGINA;
    const r = await q.range(de, de + PE_PAGINA - 1);
    products = (r.data ?? []) as Product[];
    total = r.count ?? 0;
  }
  const ultimaPagina = Math.max(1, Math.ceil(total / PE_PAGINA));

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
  const counts = counturiPeModel(fitRows, models);
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
          {/* `search` se trimite de pe pagina de REZULTATE, nu din formularul din
              header: așa prinde și căutările deschise dintr-un link salvat sau
              dintr-un rezultat Google, nu doar cele tastate acum. Doar pagina 1,
              ca răsfoirea paginilor să nu numere aceeași căutare de zece ori. */}
          {(searchParams.q || searchParams.oem) && pagina === 1 && (
            <EvenimentGa nume="search" cheie={String(searchParams.q || searchParams.oem)}
              date={{ search_term: String(searchParams.q || searchParams.oem), rezultate: total }} />
          )}

          {/* `view_item_list` raportează CE s-a arătat, adică pagina curentă de
              24, nu tot filtrul: în GA4 „lista" înseamnă ce a văzut omul. */}
          {!vacanta.activ && products.length > 0 && (
            <EvenimentGa nume="view_item_list"
              cheie={`${titlu}|${pagina}`}
              date={{
                item_list_name: titlu,
                items: products.map((p, i) => piesaGa(p, { index: (pagina - 1) * PE_PAGINA + i })),
              }} />
          )}
          {!vacanta.activ && (
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <span className="text-sm text-textSecundar">
                {total} {total === 1 ? "piesă găsită" : "piese găsite"}
                {ultimaPagina > 1 && <> · pagina {pagina} din {ultimaPagina}</>}
              </span>
              <SortSelect />
            </div>
          )}
          {!vacanta.activ && (
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
              {/* Doar PRIMA e prioritară: ea e elementul LCP. Vezi ProductPhoto. */}
              {products.map((p, i) => <ProductCard key={p.id} p={p} prioritara={i === 0} />)}
            </div>
          )}

          {/* Paginarea. Linkuri adevărate, nu butoane cu JavaScript: Google
              trebuie să poată urma fiecare pagină ca să ajungă la toate cele
              8.754 de piese. `rel=prev/next` sunt elemente `<link>` reale —
              Next le ridică în <head> — și se pun doar când există într-adevăr
              o pagină înainte sau după. */}
          {!vacanta.activ && ultimaPagina > 1 && (
            <>
              {pagina > 1 && <link rel="prev" href={adresaPaginii(searchParams, pagina - 1)} />}
              {pagina < ultimaPagina && <link rel="next" href={adresaPaginii(searchParams, pagina + 1)} />}
              <nav aria-label="Paginare" className="mt-8 flex items-center justify-center gap-1.5 flex-wrap">
                {pagina > 1 && (
                  <Link href={adresaPaginii(searchParams, pagina - 1)} rel="prev"
                    className="rounded-lg border border-chenarPuternic px-3 min-h-[44px] inline-flex items-center text-sm">
                    ← Înapoi
                  </Link>
                )}
                {numerePaginare(pagina, ultimaPagina).map((n, i) =>
                  n === null ? (
                    <span key={`gol-${i}`} className="px-1.5 text-textSecundar">…</span>
                  ) : (
                    <Link key={n} href={adresaPaginii(searchParams, n)}
                      aria-current={n === pagina ? "page" : undefined}
                      className={`rounded-lg border px-3 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-sm ${
                        n === pagina ? "bg-accent text-accentContrast border-accentChenar font-semibold" : "border-chenarPuternic"}`}>
                      {n}
                    </Link>
                  ))}
                {pagina < ultimaPagina && (
                  <Link href={adresaPaginii(searchParams, pagina + 1)} rel="next"
                    className="rounded-lg border border-chenarPuternic px-3 min-h-[44px] inline-flex items-center text-sm">
                    Înainte →
                  </Link>
                )}
              </nav>
            </>
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
