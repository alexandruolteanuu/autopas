"use client";
// COMENZI — coada de lucru: filtre pe status cu numărători live, căutare, export Saga.
import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { sbBrowser } from "@/lib/supabase";
import { lei } from "@/lib/format";
import type { OrderFull } from "@/lib/types";

const FILTRE = [
  { id: "", t: "Toate" }, { id: "noua", t: "Noi" }, { id: "confirmata", t: "Confirmate" },
  { id: "expediata", t: "Expediate" }, { id: "livrata", t: "Livrate" }, { id: "anulata", t: "Anulate" },
];
const STATUS: Record<string, string> = { noua: "bg-acc/10 text-acc", confirmata: "bg-blue-100 text-blue-700", expediata: "bg-purple-100 text-purple-700", livrata: "bg-ok/10 text-ok", anulata: "bg-red-100 text-red-600" };

function ComenziInner() {
  const sp = useSearchParams();
  const [filtru, setFiltru] = useState(sp.get("f") ?? "");
  const [q, setQ] = useState("");
  const [orders, setOrders] = useState<OrderFull[]>([]);
  const [contor, setContor] = useState<Record<string, number>>({});
  const [gata, setGata] = useState(false);

  const incarca = useCallback(async () => {
    const sb = sbBrowser(); if (!sb) return;
    let query = sb.from("orders").select("*").order("created_at", { ascending: false }).limit(200);
    if (filtru) query = query.eq("status", filtru);
    if (q.trim()) query = query.or(`numar.ilike.%${q}%,nume.ilike.%${q}%,telefon.ilike.%${q}%,email.ilike.%${q}%`);
    const { data } = await query;
    setOrders((data ?? []) as OrderFull[]); setGata(true);
    const toate = await sb.from("orders").select("status");
    const c: Record<string, number> = { "": (toate.data ?? []).length };
    (toate.data ?? []).forEach((o: any) => { c[o.status] = (c[o.status] ?? 0) + 1; });
    setContor(c);
  }, [filtru, q]);
  useEffect(() => { const t = setTimeout(incarca, q ? 300 : 0); return () => clearTimeout(t); }, [incarca, q]);

  // Export Saga — CSV cu prețuri defalcate bază + TVA, gata de importat de contabil
  async function exportSaga() {
    const sb = sbBrowser()!;
    const de = orders.filter((o) => o.status !== "anulata");
    const { data: items } = await sb.from("order_items").select("*").in("order_id", de.map((o) => o.id));
    const rows = [["Numar comanda","Data","Client","CUI","Adresa","Oras","Judet","Email","Telefon","Produs","Cant","Pret cu TVA","Baza (fara TVA)","TVA 19%","Curier","Cost livrare","Plata","Serie factura"]];
    for (const o of de) for (const i of (items ?? []).filter((x: any) => x.order_id === o.id)) {
      const brut = Number(i.pret) * i.cantitate, baza = brut / 1.19;
      rows.push([o.numar, new Date(o.created_at).toLocaleDateString("ro-RO"), o.firma ?? o.nume, o.cui ?? "-", o.adresa, o.oras, o.judet, o.email, o.telefon, i.nume, String(i.cantitate), brut.toFixed(2), baza.toFixed(2), (brut - baza).toFixed(2), o.curier, Number(o.livrare).toFixed(2), o.plata, o.factura_serie ?? ""]);
    }
    const csv = "\uFEFF" + rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `autopas-saga-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div><div className="dim">Administrare</div><h1 className="font-disp font-bold text-2xl mt-1">Comenzi</h1></div>
        <button onClick={exportSaga} className="rounded-xl bg-ok/10 text-ok border-2 border-ok/30 px-4 py-2 text-sm font-semibold hover:bg-ok/20">Export Saga (CSV)</button>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTRE.map((f) => (
          <button key={f.id} onClick={() => setFiltru(f.id)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-semibold border-2 ${filtru === f.id ? "border-acc bg-acc/5 text-acc" : "border-line hover:border-acc/40"}`}>
            {f.t} <span className="text-mut">({contor[f.id] ?? 0})</span></button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Caută nr. / client / telefon…"
          className="ml-auto rounded-xl border-2 border-line px-3.5 py-1.5 text-sm outline-none focus:border-acc min-w-[220px]" />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead><tr className="text-left text-mut text-xs border-b border-line">
            <th className="px-4 py-3">Comandă</th><th className="px-4 py-3">Client</th><th className="px-4 py-3">Plată</th>
            <th className="px-4 py-3">Total</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Factură</th>
            <th className="px-4 py-3">AWB</th><th className="px-4 py-3"></th></tr></thead>
          <tbody className="divide-y divide-line">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-paper">
                <td className="px-4 py-3"><b className="font-disp">{o.numar}</b>
                  <div className="text-[11px] text-mut">{new Date(o.created_at).toLocaleString("ro-RO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div></td>
                <td className="px-4 py-3">{o.firma ?? o.nume}<div className="text-[11px] text-mut">{o.oras} · {o.telefon}</div></td>
                <td className="px-4 py-3">{o.plata}</td>
                <td className="px-4 py-3 font-disp font-semibold">{lei(Number(o.total))}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${STATUS[o.status] ?? "bg-paper"}`}>{o.status}</span></td>
                <td className="px-4 py-3 text-xs">{o.factura_serie ? <span className="text-ok font-semibold">{o.factura_serie}</span> : <span className="text-mut">de emis</span>}</td>
                <td className="px-4 py-3 text-xs">{o.awb ? <span className="text-ok font-semibold">{o.awb}</span> : <span className="text-mut">—</span>}</td>
                <td className="px-4 py-3"><Link href={`/admin/comenzi/${o.id}`} className="text-acc font-semibold whitespace-nowrap">Deschide →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        {gata && orders.length === 0 && <p className="p-8 text-center text-mut text-sm">Nicio comandă pentru acest filtru.</p>}
      </div>
    </div>
  );
}

export default function Comenzi() {
  return <Suspense fallback={<div className="text-mut">Se încarcă…</div>}><ComenziInner /></Suspense>;
}
