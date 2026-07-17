"use client";
// Coșul de cumpărături: trăiește în memoria browserului (localStorage),
// iar la finalizare comanda se scrie REAL în Supabase.
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { CartItem } from "@/lib/types";

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
    setItems((prev) => prev.some((x) => x.id === i.id) ? prev : [...prev, { ...i, cantitate: 1 }]); // piesele sunt unicate
  const remove = (id: number) => setItems((prev) => prev.filter((x) => x.id !== id));
  const clear = () => setItems([]);
  const total = items.reduce((s, i) => s + i.pret * i.cantitate, 0);

  return <CartCtx.Provider value={{ items, add, remove, clear, total }}>{children}</CartCtx.Provider>;
}
export const useCart = () => useContext(CartCtx);
