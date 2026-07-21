"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { sbBrowser } from "@/lib/supabase";
import ProductForm from "@/components/admin/ProductForm";
import type { Product } from "@/lib/types";

export default function EditeazaPiesa() {
  const { id } = useParams<{ id: string }>();
  const [p, setP] = useState<Product | null>(null);
  const [gata, setGata] = useState(false);
  useEffect(() => {
    const sb = sbBrowser(); if (!sb) { setGata(true); return; }
    sb.from("products").select("*").eq("id", id).single().then(({ data }) => { setP(data as Product); setGata(true); });
  }, [id]);
  if (!gata) return <div className="text-mut">Se încarcă…</div>;
  if (!p) return <div className="card p-8 text-center">Piesa nu există.</div>;
  return <ProductForm produs={p} />;
}
