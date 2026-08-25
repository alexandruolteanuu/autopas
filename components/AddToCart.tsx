"use client";
import { useCart } from "./CartContext";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/types";

export default function AddToCart({ p, mare = false }: { p: Product; mare?: boolean }) {
  const { items, add } = useCart();
  const router = useRouter();
  const inCos = items.some((x) => x.id === p.id);
  return (
    <button
      onClick={() => { if (inCos) { router.push("/cos"); return; }
        add({ id: p.id, slug: p.slug, nume: p.nume, pret: Number(p.pret_lei), art: p.art, oem: p.oem ?? p.cod_intern ?? "" });
        router.push("/cos"); }}
      className={`w-full inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition
        min-h-[44px] whitespace-nowrap text-center px-4
        ${mare ? "bg-accent text-accentContrast text-base hover:brightness-110" : "bg-headerBg text-headerText text-[13px] hover:bg-steel"}`}>
      {inCos ? "În coș — vezi coșul" : "Adaugă în coș"}
    </button>
  );
}
