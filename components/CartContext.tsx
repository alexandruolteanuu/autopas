"use client";
// Coșul de cumpărături: trăiește în memoria browserului (localStorage),
// iar la finalizare comanda se scrie REAL în Supabase.
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { CartItem } from "@/lib/types";
import { ev, MONEDA } from "@/lib/analytics";
import { sbBrowser } from "@/lib/supabase";

type Ctx = {
  items: CartItem[];
  /** `cant` = câte bucăți. Dacă piesa e deja în coș, cantitatea se ADUNĂ,
   *  plafonată la stocul cunoscut. Înainte, a doua adăugare era ignorată. */
  add: (i: Omit<CartItem, "cantitate">, cant?: number) => void;
  setCantitate: (id: number, n: number) => void;
  remove: (id: number) => void;
  clear: () => void;
  /** Recitește stocul REAL al pieselor din coș și taie cantitățile peste el.
   *  Se cheamă din `/cos` și din checkout, la deschidere. */
  reimprospateazaStoc: () => Promise<void>;
  total: number;
  /** Câte bucăți, nu câte rânduri. 4 injectoare = 4, nu 1. */
  bucati: number;
};
const CartCtx = createContext<Ctx>({ items: [], add: () => {}, setCantitate: () => {},
  remove: () => {}, clear: () => {}, reimprospateazaStoc: async () => {}, total: 0, bucati: 0 });

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

  // CANTITĂȚI (20 octombrie 2026). Regula veche era „piesele sunt unicate", cu
  // a doua adăugare ignorată tăcut. Măsurat pe baza reală: 84 de piese publicate
  // au stoc peste 1 (arcuri, injectoare, bobine, capace de jante — se cumpără în
  // set), deci regula costa vânzări. Serverul știa deja de cantități:
  // `plaseaza_comanda` înmulțește, verifică `stoc < cantitate` și scrie
  // `order_items.cantitate`; blocajul era doar aici.
  //
  // Plafonul din browser e DOAR comoditate pentru client. Adevărul rămâne pe
  // server: `stoc` din coș poate fi vechi, iar o cantitate peste stoc întoarce
  // „piesa tocmai s-a vândut" cu `reincarca`.
  const plafon = (i: { stoc?: number }) => (typeof i.stoc === "number" && i.stoc > 0 ? i.stoc : 99);

  const add = (i: Omit<CartItem, "cantitate">, cant = 1) =>
    setItems((prev) => {
      const max = plafon(i);
      const vechi = prev.find((x) => x.id === i.id);
      // Cantitatea care intră EFECTIV în coș, după plafonare — exact ce se
      // raportează la analytics. Un `add` care n-a schimbat nimic (coșul e deja
      // la plafon) nu trimite niciun eveniment.
      const ceruta = Math.max(1, Math.floor(cant));
      const noua = Math.min(max, (vechi?.cantitate ?? 0) + ceruta);
      const adaugate = noua - (vechi?.cantitate ?? 0);
      if (adaugate <= 0) return prev;
      ev("add_to_cart", { currency: MONEDA, value: i.pret * adaugate,
        items: [{ item_id: i.oem || String(i.id), item_name: i.nume, price: i.pret, quantity: adaugate }] });
      return vechi
        ? prev.map((x) => (x.id === i.id ? { ...x, ...i, cantitate: noua } : x))
        : [...prev, { ...i, cantitate: noua }];
    });

  // Schimbarea directă din selector. Nu trimite `add_to_cart`: GA4 n-are
  // eveniment pentru „am schimbat cantitatea", iar unul inventat ar umfla
  // numărul de adăugări în rapoarte.
  const setCantitate = (id: number, n: number) =>
    setItems((prev) => prev.map((x) =>
      x.id === id ? { ...x, cantitate: Math.min(plafon(x), Math.max(1, Math.floor(n) || 1)) } : x));

  // Stocul se recitește la deschiderea coșului, nu o singură dată ca poza:
  // între două vizite piesa se poate vinde. `stoc: 0` rămâne în coș, ca `/cos`
  // să poată spune „s-a vândut" ÎNAINTE de checkout — altfel clientul completa
  // tot formularul ca să fie refuzat de server la final.
  const reimprospateazaStoc = async () => {
    const sb = sbBrowser();
    if (!sb || items.length === 0) return;
    const { data } = await sb.from("products").select("id,stoc,publicat").in("id", items.map((i) => i.id));
    if (!data) return;   // offline sau refuz: coșul rămâne cum e, nu se golește
    const harta = new Map((data as { id: number; stoc: number; publicat: boolean }[])
      .map((p) => [p.id, p.publicat ? p.stoc : 0]));
    setItems((prev) => prev.map((i) => {
      // O piesă dispărută din catalog nu vine în `data`. Nu o dăm drept vândută
      // pe baza unei absențe — poate fi doar o citire incompletă; o respinge
      // oricum serverul, cu mesaj.
      const stoc = harta.get(i.id);
      if (stoc === undefined) return i;
      return { ...i, stoc, cantitate: stoc > 0 ? Math.min(i.cantitate, stoc) : i.cantitate };
    }));
  };
  const remove = (id: number) =>
    setItems((prev) => {
      const scos = prev.find((x) => x.id === id);
      if (scos) ev("remove_from_cart", { currency: MONEDA, value: scos.pret * scos.cantitate,
        items: [{ item_id: scos.oem || String(scos.id), item_name: scos.nume, price: scos.pret, quantity: scos.cantitate }] });
      return prev.filter((x) => x.id !== id);
    });
  const clear = () => setItems([]);
  const total = items.reduce((s, i) => s + i.pret * i.cantitate, 0);
  const bucati = items.reduce((s, i) => s + i.cantitate, 0);

  return <CartCtx.Provider value={{ items, add, setCantitate, remove, clear,
    reimprospateazaStoc, total, bucati }}>{children}</CartCtx.Provider>;
}
export const useCart = () => useContext(CartCtx);
