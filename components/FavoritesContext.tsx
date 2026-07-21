"use client";
// FAVORITE — model hibrid:
//  • nelogat: lista trăiește în browser (localStorage), merge instant pentru oricine
//  • logat: lista se sincronizează cu contul (tabela favorites) și te urmează pe orice dispozitiv
//  • la autentificare, favoritele adunate local se urcă automat în cont
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { sbBrowser } from "@/lib/supabase";

type Ctx = { ids: number[]; are: (id: number) => boolean; comuta: (id: number) => void; nr: number };
const FavCtx = createContext<Ctx>({ ids: [], are: () => false, comuta: () => {}, nr: 0 });
const CHEIE = "autopas_favorite";

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<number[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  // 1. pornim din localStorage
  useEffect(() => {
    try { const s = localStorage.getItem(CHEIE); if (s) setIds(JSON.parse(s)); } catch {}
  }, []);

  // 2. dacă există cont, sincronizăm în ambele sensuri
  const sincronizeaza = useCallback(async (uid: string) => {
    const sb = sbBrowser(); if (!sb) return;
    const locale: number[] = JSON.parse(localStorage.getItem(CHEIE) ?? "[]");
    const { data } = await sb.from("favorites").select("product_id").eq("user_id", uid);
    const dinCont = (data ?? []).map((r: any) => Number(r.product_id));
    const doarLocale = locale.filter((x) => !dinCont.includes(x));
    if (doarLocale.length) {
      await sb.from("favorites").insert(doarLocale.map((product_id) => ({ user_id: uid, product_id })));
    }
    const tot = Array.from(new Set([...dinCont, ...locale]));
    setIds(tot); localStorage.setItem(CHEIE, JSON.stringify(tot));
  }, []);

  useEffect(() => {
    const sb = sbBrowser(); if (!sb) return;
    sb.auth.getUser().then(({ data }) => {
      if (data.user) { setUserId(data.user.id); sincronizeaza(data.user.id); }
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, sesiune) => {
      if (sesiune?.user) { setUserId(sesiune.user.id); sincronizeaza(sesiune.user.id); }
      else setUserId(null);
    });
    return () => sub.subscription.unsubscribe();
  }, [sincronizeaza]);

  const comuta = useCallback((id: number) => {
    setIds((prev) => {
      const are = prev.includes(id);
      const noi = are ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem(CHEIE, JSON.stringify(noi));
      const sb = sbBrowser();
      if (sb && userId) {
        if (are) sb.from("favorites").delete().eq("user_id", userId).eq("product_id", id).then(() => {});
        else sb.from("favorites").insert({ user_id: userId, product_id: id }).then(() => {});
      }
      return noi;
    });
  }, [userId]);

  return (
    <FavCtx.Provider value={{ ids, are: (id) => ids.includes(id), comuta, nr: ids.length }}>
      {children}
    </FavCtx.Provider>
  );
}
export const useFavorites = () => useContext(FavCtx);
