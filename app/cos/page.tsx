"use client";
import { useCart } from "@/components/CartContext";
import PartArt from "@/components/PartArt";
import { lei } from "@/lib/format";
import { useEffect, useState } from "react";
import DiscountBox, { type Reducere } from "@/components/DiscountBox";
import { getSetariBrowser, CURIERI_IMPLICITI, type Curier } from "@/lib/settings";
import Link from "next/link";

export default function Cos() {
  const { items, remove, total } = useCart();
  const [reducere, setReducere] = useState<Reducere>(null);
  const [curieri, setCurieri] = useState<Curier[]>(CURIERI_IMPLICITI);
  useEffect(() => { getSetariBrowser().then((s) => setCurieri(s.curieri)); }, []);
  useEffect(() => { // păstrăm reducerea pentru checkout
    if (reducere) sessionStorage.setItem("autopas_reducere", JSON.stringify(reducere));
    else sessionStorage.removeItem("autopas_reducere");
  }, [reducere]);
  if (items.length === 0)
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <div className="text-6xl mb-4">🛒</div>
        <h1 className="font-disp font-bold text-3xl">Coșul tău e gol</h1>
        <p className="text-mut mt-2">Dar depozitul nostru nu e. Piesele așteaptă.</p>
        <div className="mt-6 flex gap-3 justify-center">
          <Link href="/piese" className="btn-acc">Vezi piesele pe stoc</Link>
          <Link href="/cauta-dupa-masina" className="btn-dark">Caută după mașină</Link>
        </div>
      </div>
    );
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="dim">Acasă / Coșul meu</div>
      <h1 className="font-disp font-bold text-3xl mt-2 mb-6">Coșul meu <span className="text-mut text-lg">· {items.length} {items.length === 1 ? "produs" : "produse"}</span></h1>
      <div className="grid lg:grid-cols-[1fr,340px] gap-6 items-start">
        <div className="card divide-y divide-line">
          {items.map((i) => (
            <div key={i.id} className="p-4 flex gap-4 items-center">
              <PartArt kind={i.art} className="w-24 rounded-lg shrink-0" />
              <div className="flex-1">
                <Link href={`/piese/${i.slug}`} className="font-semibold text-sm hover:text-acc">{i.nume}</Link>
                <div className="text-xs text-mut mt-0.5">OEM {i.oem} · piesă unică — rezervată 30 min</div>
              </div>
              <b className="font-disp text-lg text-acc whitespace-nowrap">{lei(i.pret)}</b>
              <button onClick={() => remove(i.id)} className="text-mut hover:text-red-600 text-xl" aria-label="elimină">×</button>
            </div>
          ))}
        </div>
        <div className="card p-5 space-y-3 text-sm">
          <b className="font-disp font-semibold text-[13px]">Sumar comandă</b>
          <div className="flex justify-between"><span>Subtotal</span><b>{lei(total)}</b></div>
          <DiscountBox subtotal={total} reducere={reducere} setReducere={setReducere} />
          {reducere && <div className="flex justify-between text-ok"><span>Reducere {reducere.cod}</span><b>−{lei(reducere.valoare)}</b></div>}
          <div className="flex justify-between text-mut"><span>Livrare</span><span>de la {lei(Math.min(...curieri.map((c) => c.pret)))} — aleasă la checkout</span></div>
          <div className="flex justify-between border-t border-line pt-3 text-base"><span>Total estimat</span>
            <b className="font-disp text-2xl text-acc">{lei(Math.max(0, total - (reducere?.valoare ?? 0)) + Math.min(...curieri.map((c) => c.pret)))}</b></div>
          <Link href="/checkout" className="btn-acc w-full">Finalizează comanda</Link>
          <p className="text-xs text-mut text-center">Plată ramburs sau transfer bancar · Retur 14 zile</p>
        </div>
      </div>
    </div>
  );
}
