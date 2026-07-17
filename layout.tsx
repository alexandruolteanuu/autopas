"use client";
// Contul clientului: comenzile lui (RLS le filtrează după e-mailul autentificat).
import { useEffect, useState } from "react";
import { sbBrowser } from "@/lib/supabase";
import { lei } from "@/lib/format";
import Link from "next/link";

type Ord = { id: number; numar: string; created_at: string; total: number; status: string; plata: string };
const STATUS: Record<string, [string, string]> = {
  noua: ["Nouă", "bg-acc/10 text-acc"], confirmata: ["Confirmată", "bg-blue-100 text-blue-700"],
  expediata: ["Expediată", "bg-purple-100 text-purple-700"], livrata: ["Livrată", "bg-ok/10 text-ok"],
  anulata: ["Anulată", "bg-red-100 text-red-600"],
};

export default function Cont() {
  const [email, setEmail] = useState<string | null>(null);
  const [orders, setOrders] = useState<Ord[]>([]);
  const [gata, setGata] = useState(false);
  useEffect(() => {
    const sb = sbBrowser(); if (!sb) { setGata(true); return; }
    sb.auth.getUser().then(async ({ data }) => {
      const em = data.user?.email ?? null;
      setEmail(em);
      if (em) {
        const { data: o } = await sb.from("orders").select("id,numar,created_at,total,status,plata").order("created_at", { ascending: false });
        setOrders((o ?? []) as Ord[]);
      }
      setGata(true);
    });
  }, []);
  const iesi = async () => { const sb = sbBrowser(); await sb?.auth.signOut(); location.href = "/"; };

  if (!gata) return <div className="mx-auto max-w-3xl px-4 py-20 text-center text-mut">Se încarcă…</div>;
  if (!email)
    return <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="font-disp font-black uppercase text-2xl">Nu ești autentificat</h1>
      <Link href="/autentificare" className="btn-acc mt-5">Intră în cont</Link></div>;
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="dim">Contul meu</div>
      <div className="flex items-center justify-between mt-2 mb-6">
        <h1 className="font-disp font-black uppercase text-3xl">Comenzile mele</h1>
        <div className="text-right text-sm"><b>{email}</b><br />
          <button onClick={iesi} className="text-mut hover:text-acc underline underline-offset-2">Ieși din cont</button></div>
      </div>
      {orders.length === 0 && <div className="card p-10 text-center text-mut">Nicio comandă pe acest e-mail, încă. <Link href="/piese" className="text-acc font-bold">Vezi piesele →</Link></div>}
      <div className="space-y-3">
        {orders.map((o) => {
          const [t, cls] = STATUS[o.status] ?? [o.status, "bg-paper"];
          return (
            <div key={o.id} className="card p-4 flex items-center gap-4 text-sm">
              <div className="flex-1"><b className="font-disp text-base">{o.numar}</b>
                <div className="text-mut text-xs">{new Date(o.created_at).toLocaleDateString("ro-RO")} · {o.plata === "ramburs" ? "ramburs" : "transfer bancar"}</div></div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${cls}`}>{t}</span>
              <b className="font-disp text-lg text-acc">{lei(Number(o.total))}</b>
            </div>
          );
        })}
      </div>
    </div>
  );
}
