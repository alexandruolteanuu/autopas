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
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition
        ${mare ? "bg-acc text-white px-6 py-3.5 text-base hover:brightness-110 w-full" : "bg-ink text-white px-3.5 py-2 text-xs hover:bg-steel"}`}>
      {inCos ? "În coș — vezi coșul" : "Adaugă în coș"}
    </button>
  );
}
