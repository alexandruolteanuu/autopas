"use client";
// FAVORITELE MELE — lista salvată (local + în cont, dacă ești autentificat).
import { useEffect, useState } from "react";
import Link from "next/link";
import { useFavorites } from "@/components/FavoritesContext";
import { sbBrowser } from "@/lib/supabase";
import ProductCard from "@/components/ProductCard";
import Breadcrumbs from "@/components/Breadcrumbs";
import type { Product } from "@/lib/types";

export default function Favorite() {
  const { ids } = useFavorites();
  const [produse, setProduse] = useState<Product[]>([]);
  const [gata, setGata] = useState(false);
  const [logat, setLogat] = useState(false);

  useEffect(() => {
    const sb = sbBrowser(); if (!sb) { setGata(true); return; }
    sb.auth.getUser().then(({ data }) => setLogat(!!data.user));
    if (ids.length === 0) { setProduse([]); setGata(true); return; }
    sb.from("products").select("*").in("id", ids).then(({ data }) => {
      setProduse((data ?? []) as Product[]); setGata(true);
    });
  }, [ids]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Breadcrumbs items={[{ t: "Acasă", href: "/" }, { t: "Favoritele mele" }]} />
      <h1 className="font-disp font-bold text-3xl mt-2 mb-2">Favoritele mele</h1>
      <p className="text-sm text-mut mb-6">
        {logat ? "Lista e salvată în contul tău — o regăsești pe orice dispozitiv."
               : <>Lista e salvată în acest browser. <Link href="/autentificare" className="text-acc font-semibold">Autentifică-te</Link> ca s-o păstrezi pe orice dispozitiv.</>}
      </p>
      {!gata && <p className="text-mut">Se încarcă…</p>}
      {gata && produse.length === 0 && (
        <div className="card p-10 text-center">
          <b className="font-disp font-bold text-xl block">Încă n-ai piese favorite</b>
          <p className="text-mut mt-2 text-sm">Apasă pe inima de pe orice piesă ca s-o păstrezi aici pentru mai târziu.</p>
          <Link href="/piese" className="btn-acc mt-5">Vezi piesele</Link>
        </div>
      )}
      {produse.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {produse.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      )}
    </div>
  );
}
