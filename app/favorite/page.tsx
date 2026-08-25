"use client";
// FAVORITELE MELE — lista salvată (local + în cont, dacă ești autentificat).
import { useEffect, useState } from "react";
import Link from "next/link";
import { useFavorites } from "@/components/FavoritesContext";
import { sbBrowser } from "@/lib/supabase";
import ProductCard from "@/components/ProductCard";
import StareGoala from "@/components/StareGoala";
import { ScheletGrilaProduse } from "@/components/ScheletCarduri";
import { IconInima } from "@/components/Icoane";
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
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumbs items={[{ t: "Acasă", href: "/" }, { t: "Favoritele mele" }]} />
      <h1 className="t-sectiune mt-2 mb-2">Favoritele mele</h1>
      <p className="text-sm text-textSecundar mb-6">
        {logat ? "Lista e salvată în contul tău — o regăsești pe orice dispozitiv."
               : <>Lista e salvată în acest browser. <Link href="/autentificare" className="accentuat font-semibold">Autentifică-te</Link> ca s-o păstrezi pe orice dispozitiv.</>}
      </p>
      {!gata && <ScheletGrilaProduse cate={4} />}
      {gata && produse.length === 0 && (
        <StareGoala
          icon={<IconInima className="w-7 h-7" />}
          titlu="Încă n-ai piese favorite"
          text="Apasă pe inima de pe orice piesă ca s-o păstrezi aici pentru mai târziu."
          actiune={{ eticheta: "Vezi piesele pe stoc", href: "/piese" }}
        />
      )}
      {produse.length > 0 && (
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          {produse.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      )}
    </div>
  );
}
