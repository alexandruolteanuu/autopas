"use client";
// Coșul de cumpărături: trăiește în memoria browserului (localStorage),
// iar la finalizare comanda se scrie REAL în Supabase.
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { CartItem } from "@/lib/types";
import { ev, MONEDA } from "@/lib/analytics";

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
