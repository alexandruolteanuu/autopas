"use client";
import Breadcrumbs from "@/components/Breadcrumbs";
import { useCart } from "@/components/CartContext";
import PartArt from "@/components/PartArt";
import { lei } from "@/lib/format";
import { useEffect, useState } from "react";
import DiscountBox, { type Reducere } from "@/components/DiscountBox";
import Link from "next/link";

export default function Cos() {
  const { items, remove, total } = useCart();
  const [reducere, setReducere] = useState<Reducere>(null);
  useEffect(() => { // păstrăm reducerea pentru checkout
    if (reducere) sessionStorage.setItem("autopas_reducere", JSON.stringify(reducere));
    else sessionStorage.removeItem("autopas_reducere");
  }, [reducere]);
  if (items.length === 0)
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <div className="text-6xl mb-4">🛒</div>
        <h1 className="font-disp font-bold text-3xl">Coșul tău e gol</h1>
        <p className="text-textSecundar mt-2">Dar depozitul nostru nu e. Piesele așteaptă.</p>
        <div className="mt-6 flex gap-3 justify-center">
          <Link href="/piese" className="btn-acc">Vezi piesele pe stoc</Link>
          <Link href="/cauta-dupa-masina" className="btn-dark">Caută după mașină</Link>
        </div>
      </div>
    );
  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumbs items={[{ t: "Acasă", href: "/" }, { t: "Coșul meu" }]} />
      <h1 className="font-disp font-bold text-3xl mt-2 mb-6">Coșul meu <span className="text-textSecundar text-lg">· {items.length} {items.length === 1 ? "produs" : "produse"}</span></h1>
      <div className="grid lg:grid-cols-[minmax(0,1fr),340px] gap-6 items-start">
        {/* Pe telefon fiecare piesă e un card: imagine 80px în stânga, denumirea
            și prețul în dreapta, iar „Șterge" pe rândul lui, ca țintă de 44px.
            Nu există selector de cantitate: piesele din dezmembrări sunt unicate,
            coșul acceptă o singură bucată din fiecare (vezi CartContext). */}
        <div className="card divide-y divide-chenar">
          {items.map((i) => (
            <div key={i.id} className="p-4">
              <div className="flex gap-3 sm:gap-4 min-w-0">
                <PartArt kind={i.art} className="w-20 sm:w-24 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <Link href={`/piese/${i.slug}`} className="font-semibold text-[15px] leading-snug hover:text-accent break-words">{i.nume}</Link>
                  <div className="text-[13px] text-textSecundar mt-0.5 break-words">OEM {i.oem} · piesă unică — rezervată 30 min</div>
                  <b className="block mt-1.5 font-disp text-lg text-accent tabular-nums">{lei(i.pret)}</b>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button onClick={() => remove(i.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-chenar px-3 min-h-[44px] text-[13px] text-textSecundar hover:text-red-600 hover:border-red-300">
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
                  </svg>
                  Șterge piesa
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="card p-5 space-y-3 text-sm lg:sticky lg:top-24">
          <b className="font-disp font-semibold text-[13px]">Sumar comandă</b>
          <div className="flex justify-between"><span>Subtotal</span><b>{lei(total)}</b></div>
          <DiscountBox subtotal={total} reducere={reducere} setReducere={setReducere} />
          {reducere && <div className="flex justify-between text-ok"><span>Reducere {reducere.cod}</span><b>−{lei(reducere.valoare)}</b></div>}
          {/* Transportul nu se poate calcula automat: piesele diferă mult ca greutate
              și gabarit, iar FAN Courier taxează în funcție de ele. Îl stabilim după
              comandă și îl comunicăm clientului înainte de expediere. */}
          <div className="flex justify-between text-textSecundar"><span>Livrare</span><span>se calculează separat</span></div>
          <div className="flex justify-between border-t border-chenar pt-3 text-base"><span>Total produse</span>
            <b className="font-disp text-2xl text-accent tabular-nums">{lei(Math.max(0, total - (reducere?.valoare ?? 0)))}</b></div>
          <p className="text-xs text-textSecundar bg-suprafata2 rounded-lg px-3 py-2 leading-relaxed">
            Costul livrării depinde de greutatea și dimensiunile pieselor. Îl calculăm după
            plasarea comenzii și te sunăm cu totalul exact înainte de expediere.
          </p>
          <Link href="/checkout" className="btn-acc w-full">Finalizează comanda</Link>
          <p className="text-xs text-textSecundar text-center">Plată ramburs sau transfer bancar · Garanție 90 de zile · Retur în 14 zile</p>
        </div>
      </div>
    </div>
  );
}
