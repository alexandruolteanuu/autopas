"use client";
// FACTURI — registrul pentru fluxul real cu Saga (care nu are API public):
// emiți factura în Saga, notezi seria aici, exporți CSV-ul pentru contabil.
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { sbBrowser } from "@/lib/supabase";
import { lei } from "@/lib/format";
import type { OrderFull } from "@/lib/types";

export default function Facturi() {
  const azi = new Date().toISOString().slice(0, 10);
  const luna0 = new Date(); luna0.setDate(1);
  const [de, setDe] = useState(luna0.toISOString().slice(0, 10));
  const [pana, setPana] = useState(azi);
  const [filtru, setFiltru] = useState<"toate" | "de_emis" | "emisa">("toate");
  const [orders, setOrders] = useState<OrderFull[]>([]);

  const incarca = useCallback(async () => {
    const sb = sbBrowser(); if (!sb) return;
    let q = sb.from("orders").select("*").neq("status", "anulata")
      .gte("created_at", new Date(de + "T00:00:00").toISOString())
      .lte("created_at", new Date(pana + "T23:59:59").toISOString())
      .order("created_at", { ascending: false });
    if (filtru !== "toate") q = q.eq("factura_status", filtru);
    setOrders(((await q).data ?? []) as OrderFull[]);
  }, [de, pana, filtru]);
  useEffect(() => { incarca(); }, [incarca]);

  async function salveazaSerie(o: OrderFull, serie: string) {
    const sb = sbBrowser()!;
    await sb.from("orders").update({ factura_serie: serie || null, factura_status: serie ? "emisa" : "de_emis" }).eq("id", o.id);
    incarca();
  }

  async function exportSaga() {
    const sb = sbBrowser()!;
    const { data: items } = await sb.from("order_items").select("*").in("order_id", orders.map((o) => o.id));
    const rows: (string | number)[][] = [["Numar comanda","Data","Serie factura","Client","CUI","Adresa","Oras","Judet","Email","Telefon","Produs","Cant","Pret cu TVA","Baza fara TVA","TVA 19%","Curier","Cost livrare","Plata"]];
    for (const o of orders) for (const i of (items ?? []).filter((x: any) => x.order_id === o.id)) {
      const brut = Number(i.pret) * i.cantitate, baza = brut / 1.19;
      rows.push([o.numar, new Date(o.created_at).toLocaleDateString("ro-RO"), o.factura_serie ?? "", o.firma ?? o.nume, o.cui ?? "-",
        o.adresa, o.oras, o.judet, o.email, o.telefon, i.nume, i.cantitate, brut.toFixed(2), baza.toFixed(2), (brut - baza).toFixed(2),
        o.curier, Number(o.livrare).toFixed(2), o.plata]);
    }
    const csv = "\uFEFF" + rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `saga-${de}_${pana}.csv`; a.click();
  }

  const deEmis = orders.filter((o) => o.factura_status !== "emisa").length;
  const total = orders.reduce((s, o) => s + Number(o.total), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div><div className="dim">Administrare</div><h1 className="font-disp font-bold text-2xl mt-1">Facturi</h1>
          <p className="text-sm text-mut mt-1">Saga nu are API public — fluxul standard e emiterea în Saga + importul acestui CSV. Statusul e-Factura ANAF îl gestionează Saga.</p></div>
        <button onClick={exportSaga} className="rounded-xl bg-ok/10 text-ok border-2 border-ok/30 px-4 py-2 text-sm font-semibold hover:bg-ok/20">Export Saga (CSV)</button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[["Comenzi în interval", String(orders.length)], ["De facturat", String(deEmis)], ["Valoare totală", lei(total)]].map(([t, v]) => (
          <div key={t} className="card p-4"><span className="text-xs text-mut">{t}</span><b className="block font-disp text-xl mt-1">{v}</b></div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center text-sm">
        <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="rounded-lg border-2 border-line px-2 py-1.5" />
        <span className="text-mut">→</span>
        <input type="date" value={pana} onChange={(e) => setPana(e.target.value)} className="rounded-lg border-2 border-line px-2 py-1.5" />
        {([["toate", "Toate"], ["de_emis", "De emis"], ["emisa", "Emise"]] as const).map(([id, t]) => (
          <button key={id} onClick={() => setFiltru(id)} className={`rounded-full border-2 px-3.5 py-1.5 font-semibold ${filtru === id ? "border-acc bg-acc/5 text-acc" : "border-line"}`}>{t}</button>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead><tr className="text-left text-mut text-xs border-b border-line">
            <th className="px-4 py-3">Comandă</th><th className="px-4 py-3">Data</th><th className="px-4 py-3">Client</th>
            <th className="px-4 py-3">CUI</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Serie factură (din Saga)</th></tr></thead>
          <tbody className="divide-y divide-line">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-paper">
                <td className="px-4 py-3"><Link href={`/admin/comenzi/${o.id}`} className="font-disp font-semibold hover:text-acc">{o.numar}</Link></td>
                <td className="px-4 py-3 text-mut">{new Date(o.created_at).toLocaleDateString("ro-RO")}</td>
                <td className="px-4 py-3">{o.firma ?? o.nume}</td>
                <td className="px-4 py-3 text-mut">{o.cui ?? "—"}</td>
                <td className="px-4 py-3 font-disp font-semibold">{lei(Number(o.total))}</td>
                <td className="px-4 py-3">
                  <input defaultValue={o.factura_serie ?? ""} placeholder="ex. AUTP-0912"
                    onBlur={(e) => { if (e.target.value !== (o.factura_serie ?? "")) salveazaSerie(o, e.target.value.trim()); }}
                    className={`rounded-lg border-2 px-2.5 py-1.5 text-sm outline-none w-40 ${o.factura_status === "emisa" ? "border-ok/40 bg-ok/5" : "border-line focus:border-acc"}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && <p className="p-8 text-center text-mut text-sm">Nicio comandă în intervalul ales.</p>}
      </div>
    </div>
  );
}
