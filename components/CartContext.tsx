"use client";
// Coșul de cumpărături: trăiește în memoria browserului (localStorage),
// iar la finalizare comanda se scrie REAL în Supabase.
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { CartItem } from "@/lib/types";
import { ev, MONEDA } from "@/lib/analytics";
import { sbBrowser } from "@/lib/supabase";

type Ctx = {
  items: CartItem[];
  add: (i: Omit<CartItem, "cantitate">) => void;
  remove: (id: number) => void;
  clear: () => void;
  total: number;
};
const CartCtx = createContext<Ctx>({ items: [], add: () => {}, remove: () => {}, clear: () => {}, total: 0 });

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  useEffect(() => { // la încărcare, recuperăm coșul salvat
    try { const s = localStorage.getItem("autopas_cart"); if (s) setItems(JSON.parse(s)); } catch {}
  }, []);
  useEffect(() => { localStorage.setItem("autopas_cart", JSON.stringify(items)); }, [items]);

  // Completează poza pieselor puse în coș ÎNAINTE de 7 septembrie 2026, când
  // `CartItem` n-avea câmpul. Fără asta, cine avea deja ceva în coș ar fi văzut
  // desenul de rezervă până când scotea piesa și o punea la loc — un defect
  // care se repară singur doar pentru clienții noi, adică nu se repară.
  //
  // Condiția e `!("poza" in i)`, nu `!i.poza`: o piesă chiar fără poză primește
  // `null` și nu se mai reinteroghează niciodată. Cu `!i.poza` ar fi pornit o
  // cerere la fiecare încărcare de pagină, pe viață.
  useEffect(() => {
    const lipsa = items.filter((i) => !("poza" in i)).map((i) => i.id);
    if (lipsa.length === 0) return;
    const sb = sbBrowser();
    if (!sb) return;
    let anulat = false;
    (async () => {
      const { data } = await sb.from("products").select("id,poze").in("id", lipsa);
      if (anulat || !data) return;
      const harta = new Map((data as { id: number; poze: string[] | null }[])
        .map((p) => [p.id, p.poze && p.poze.length > 0 ? p.poze[0] : null]));
      // O piesă dispărută din catalog (ștearsă, depublicată) nu vine înapoi în
      // `data`; primește tot `null` și rămâne cu desenul, fără să reîncerce.
      setItems((prev) => prev.map((i) => ("poza" in i ? i : { ...i, poza: harta.get(i.id) ?? null })));
    })();
    return () => { anulat = true; };
  }, [items]);

  const add = (i: Omit<CartItem, "cantitate">) =>
    setItems((prev) => {
      if (prev.some((x) => x.id === i.id)) return prev;   // piesele sunt unicate
      // Evenimentul pleacă doar la o adăugare REALĂ. Un al doilea click pe
      // aceeași piesă nu schimbă coșul, deci n-are ce raporta.
      ev("add_to_cart", { currency: MONEDA, value: i.pret,
        items: [{ item_id: i.oem || String(i.id), item_name: i.nume, price: i.pret, quantity: 1 }] });
      return [...prev, { ...i, cantitate: 1 }];
    });
  const remove = (id: number) =>
    setItems((prev) => {
      const scos = prev.find((x) => x.id === id);
      if (scos) ev("remove_from_cart", { currency: MONEDA, value: scos.pret * scos.cantitate,
        items: [{ item_id: scos.oem || String(scos.id), item_name: scos.nume, price: scos.pret, quantity: scos.cantitate }] });
      return prev.filter((x) => x.id !== id);
    });
  const clear = () => setItems([]);
  const total = items.reduce((s, i) => s + i.pret * i.cantitate, 0);

  return <CartCtx.Provider value={{ items, add, remove, clear, total }}>{children}</CartCtx.Provider>;
}
export const useCart = () => useContext(CartCtx);
