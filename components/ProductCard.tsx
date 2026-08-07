import Link from "next/link";
import ProductPhoto from "./ProductPhoto";
import FavButton from "./FavButton";
import AddToCart from "./AddToCart";
import { lei } from "@/lib/format";
import type { Product } from "@/lib/types";

// Cardul de produs e o stivă verticală, în ordine fixă: imagine, cod, denumire,
// preț, stoc, buton. Butonul stă lipit de baza cardului (`mt-auto`) și ocupă
// toată lățimea — înainte împărțea rândul cu prețul, se strângea, iar eticheta
// „Adaugă în coș" se rupea pe două rânduri pe telefon.
export default function ProductCard({ p }: { p: Product }) {
  return (
    <div className="h-full flex flex-col bg-suprafata border border-chenar rounded-xl overflow-hidden shadow-card">
      <Link href={`/piese/${p.slug}`} className="block">
        <ProductPhoto poze={p.poze} art={p.art} alt={p.nume} className="w-full aspect-[4/3]" />
      </Link>

      <div className="flex-1 flex flex-col p-3.5 gap-1.5">
        <div className="font-disp text-[12px] tracking-wider text-textSecundar uppercase">
          {p.oem ? `Cod OEM ${p.oem}` : p.cod_intern ?? ""}{p.ani ? ` · ${p.ani}` : ""}
        </div>

        <Link href={`/piese/${p.slug}`}
          className="font-semibold text-[15px] leading-snug hover:text-accent line-clamp-2 min-h-[44px]">
          {p.nume}
        </Link>

        <div className="font-disp font-bold text-xl text-accent tabular-nums">
          {lei(Number(p.pret_lei), p.pret_sufix)}
        </div>

        {/* Marcajele și inima pe același rând: inima NU mai stă peste imagine,
            ca să nu se suprapună cu linkul piesei. */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="min-w-0 flex flex-wrap gap-1.5">
            {p.stoc > 0
              ? <span className="inline-block text-[12px] px-2 py-0.5 rounded-full bg-ok/10 text-ok">În stoc</span>
              : <span className="inline-block text-[12px] px-2 py-0.5 rounded-full bg-chenar text-text">Stoc epuizat</span>}
            {p.originala !== false && (
              <span className="inline-block text-[12px] px-2 py-0.5 rounded-full bg-accent/10 text-accent">Originală</span>
            )}
          </div>
          <FavButton id={p.id} />
        </div>

        <div className="mt-auto pt-3">
          <AddToCart p={p} />
        </div>
      </div>
    </div>
  );
}
