import Link from "next/link";
import PartArt from "./PartArt";
import AddToCart from "./AddToCart";
import { lei } from "@/lib/format";
import type { Product } from "@/lib/types";

export default function ProductCard({ p }: { p: Product }) {
  return (
    <div className="bg-white border border-line rounded-xl overflow-hidden shadow-card flex flex-col">
      <Link href={`/piese/${p.slug}`} className="relative block">
        <PartArt kind={p.art} className="w-full aspect-[100/72]" />
        <span className="absolute top-2 left-2 text-[11px] font-bold px-2 py-0.5 rounded-full bg-ok/15 text-ok">✓ Testat</span>
        <span className="absolute top-2 right-2 text-[11px] font-bold px-2 py-0.5 rounded-full bg-acc/15 text-acc">Stoc: {p.stoc} buc</span>
      </Link>
      <div className="p-3.5 flex flex-col gap-1.5 flex-1">
        <Link href={`/piese/${p.slug}`} className="font-semibold text-[13.5px] leading-snug hover:text-acc">{p.nume}</Link>
        <div className="font-disp text-[11px] tracking-wider text-mut uppercase">Cod OEM {p.oem}{p.ani ? ` · ${p.ani}` : ""}</div>
        <div className="mt-auto pt-2 flex items-center justify-between gap-2">
          <span className="font-disp font-bold text-xl text-acc">{lei(Number(p.pret_lei), p.pret_sufix)}</span>
          <AddToCart p={p} />
        </div>
      </div>
    </div>
  );
}
