// ============================================================
// GRILA DE PIESE + PAGINAREA — partea comună a listărilor
//
// Folosită de `/piese/marca/[marca]` și `/piese/categorie/[categorie]`.
// `/piese` are propria variantă, împletită cu sertarul de filtre; aici e doar
// ce se repetă între rutele noi, ca să nu existe două paginări care se pot
// despărți în timp.
//
// Paginarea e cu LINKURI adevărate, nu butoane cu JavaScript: Google trebuie
// să poată urma fiecare pagină. `rel=prev/next` sunt elemente `<link>` reale,
// pe care Next le ridică în `<head>`, și se pun doar când chiar există o pagină
// înainte sau după.
// ============================================================
import Link from "next/link";
import ProductCard from "./ProductCard";
import type { Product } from "@/lib/types";

/** Numerele de pagină de arătat: primele, ultimele și vecinii celei curente.
 *  `null` = „…". Maximum 7 elemente, deci încape și la 320px. */
export function numerePaginare(pagina: number, ultima: number): (number | null)[] {
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

export default function ListarePiese({ produse, pagina, ultimaPagina, adresa }: {
  produse: Product[];
  pagina: number;
  ultimaPagina: number;
  /** Adresa aceleiași listări, la altă pagină. */
  adresa: (n: number) => string;
}) {
  return (
    <>
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
        {/* Doar PRIMA imagine e prioritară: ea e elementul LCP. Vezi ProductPhoto. */}
        {produse.map((p, i) => <ProductCard key={p.id} p={p} prioritara={i === 0} />)}
      </div>

      {ultimaPagina > 1 && (
        <>
          {pagina > 1 && <link rel="prev" href={adresa(pagina - 1)} />}
          {pagina < ultimaPagina && <link rel="next" href={adresa(pagina + 1)} />}
          <nav aria-label="Paginare" className="mt-8 flex items-center justify-center gap-1.5 flex-wrap">
            {pagina > 1 && (
              <Link href={adresa(pagina - 1)} rel="prev"
                className="rounded-lg border border-chenarPuternic px-3 min-h-[44px] inline-flex items-center text-sm">
                ← Înapoi
              </Link>
            )}
            {numerePaginare(pagina, ultimaPagina).map((n, i) =>
              n === null ? (
                <span key={`gol-${i}`} className="px-1.5 text-textSecundar">…</span>
              ) : (
                <Link key={n} href={adresa(n)} aria-current={n === pagina ? "page" : undefined}
                  className={`rounded-lg border px-3 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-sm ${
                    n === pagina ? "bg-accent text-accentContrast border-accentChenar font-semibold" : "border-chenarPuternic"}`}>
                  {n}
                </Link>
              ))}
            {pagina < ultimaPagina && (
              <Link href={adresa(pagina + 1)} rel="next"
                className="rounded-lg border border-chenarPuternic px-3 min-h-[44px] inline-flex items-center text-sm">
                Înainte →
              </Link>
            )}
          </nav>
        </>
      )}
    </>
  );
}

/**
 * Rândul de legături către listări înrudite: categoriile unei mărci, mărcile
 * unei categorii.
 *
 * Limitat la 15 intrări, ordonate după numărul de piese. O pagină cu 299 de
 * linkuri își diluează singură valoarea — fiecare link primește o fracțiune din
 * ce transmite pagina, iar Google nu mai poate deosebi ce contează.
 */
export function LegaturiInrudite({ titlu, intrari, toate }: {
  titlu: string;
  intrari: { href: string; nume: string; nr: number }[];
  toate?: { href: string; eticheta: string };
}) {
  if (intrari.length === 0) return null;
  return (
    <section className="mt-12">
      <h2 className="font-disp font-bold text-xl mb-4">{titlu}</h2>
      <div className="flex flex-wrap gap-2.5">
        {intrari.map((x) => (
          <Link key={x.href} href={x.href}
            className="rounded-xl border border-chenarPuternic px-3.5 py-2 text-sm hover:border-accentChenar transition">
            {x.nume} <span className="text-textSecundar">· {x.nr}</span>
          </Link>
        ))}
        {toate && (
          <Link href={toate.href}
            className="rounded-xl border border-chenarPuternic px-3.5 py-2 text-sm accentuat-hover hover:border-accentChenar transition">
            {toate.eticheta} →
          </Link>
        )}
      </div>
    </section>
  );
}
