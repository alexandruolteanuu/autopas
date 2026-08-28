"use client";
// EXPEDIERI — ecranul de depozit: ce colete predau azi curierului + borderoul printabil.
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { sbBrowser, scrieVerificat, citesteTot, citesteDupaIduri } from "@/lib/supabase";
import { lei } from "@/lib/format";
import { getSetariBrowser, type Curier } from "@/lib/settings";
import type { OrderFull } from "@/lib/types";

export default function Expedieri() {
  const [orders, setOrders] = useState<OrderFull[]>([]);
  const [greutati, setGreutati] = useState<Record<number, number>>({});
  const [curieri, setCurieri] = useState<Curier[]>([]);
  const [sel, setSel] = useState<number[]>([]);
  const [lucru, setLucru] = useState(false);
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState<"de_predat" | "in_tranzit" | "livrate">("de_predat");

  const incarca = useCallback(async () => {
    const sb = sbBrowser(); if (!sb) return;
    const stat = tab === "de_predat" ? "confirmata" : tab === "in_tranzit" ? "expediata" : "livrata";
    const list = await citesteTot<OrderFull>(
      () => sb.from("orders").select("*", { count: "exact" }).eq("status", stat).order("id"),
      { eticheta: "comenzile de expediat" });
    setOrders(list); setSel([]);
    if (list.length) {
      // În loturi + paginat: borderoul dat curierului se calculează de aici.
      const it = await citesteDupaIduri<any>(list.map((o) => o.id),
        (lot) => sb.from("order_items").select("order_id,cantitate,products(greutate_kg)", { count: "exact" })
          .in("order_id", lot).order("id"),
        { eticheta: "liniile comenzilor" });
      const g: Record<number, number> = {};
      it.forEach((i) => { g[i.order_id] = (g[i.order_id] ?? 0) + (Number(i.products?.greutate_kg) || 5) * i.cantitate; });
      setGreutati(g);
    }
  }, [tab]);
  useEffect(() => { incarca(); }, [incarca]);
  useEffect(() => { getSetariBrowser().then((s) => setCurieri(s.curieri)); }, []);

  const numeCurier = (id: string) => curieri.find((c) => c.id === id)?.nume ?? id;

  function borderou() {
    const alese = orders.filter((o) => sel.includes(o.id));
    if (alese.length === 0) { alert("Bifează întâi coletele pe care le predai."); return; }
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`<html><head><title>Borderou predare ${new Date().toLocaleDateString("ro-RO")}</title>
      <style>body{font-family:system-ui;padding:24px;color:#15181C}h1{font-size:18px;margin:0 0 4px}
      table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}
      th,td{border:1px solid #ddd;padding:7px;text-align:left}th{background:#f5f4f1}
      .semn{margin-top:40px;display:flex;justify-content:space-between;font-size:13px}
      .cap{display:flex;align-items:center;gap:14px}.cap img{height:52px;width:auto}</style></head>
      <body onload="window.print()">
      <div class="cap"><img src="/logo.png" alt="Autopas Dezmembrări" width="600" height="276">
      <h1>Borderou de predare colete</h1></div>
      <div>Data: ${new Date().toLocaleDateString("ro-RO")} · Colete: ${alese.length}</div>
      <table><tr><th>#</th><th>AWB</th><th>Comandă</th><th>Destinatar</th><th>Localitate</th><th>Curier</th><th>Greutate</th><th>Ramburs</th></tr>
      ${alese.map((o, i) => `<tr><td>${i + 1}</td><td>${o.awb ?? "—"}</td><td>${o.numar}</td>
        <td>${o.firma ?? o.nume}<br><small>${o.telefon}</small></td><td>${o.oras}, ${o.judet}</td>
        <td>${numeCurier(o.curier)}</td><td>${(greutati[o.id] ?? 5).toFixed(1)} kg</td>
        <td>${o.plata === "ramburs" ? Number(o.total).toFixed(2) + " lei" : "—"}</td></tr>`).join("")}</table>
      <div class="semn"><span>Predat (Autopas): ______________________</span><span>Primit (curier): ______________________</span></div>
      </body></html>`);
    // Tipărirea o pornește `onload` din pagina scrisă mai sus, nu o chemăm aici:
    // altfel dialogul s-ar deschide înainte ca logo-ul să apuce să se încarce.
    w.document.close();
  }

  async function marcheazaExpediat() {
    if (sel.length === 0 || lucru) return;
    const sb = sbBrowser()!; setLucru(true); setMsg("");
    // Fiecare comandă separat, cu rezultatul citit: până acum, dacă RLS oprea
    // operațiunea, coletele rămâneau „de expediat" fără ca nimeni să afle, iar
    // borderoul se tipărea a doua zi cu aceleași comenzi.
    let ok = 0; const picate: string[] = [];
    for (const id of sel) {
      const r = await scrieVerificat(sb.from("orders").update({ status: "expediata" }).eq("id", id));
      if (r.ok) ok++; else picate.push(r.eroare!);
    }
    setLucru(false);
    setMsg(`✓ ${ok} ${ok === 1 ? "comandă marcată expediată" : "comenzi marcate expediate"}.` +
      (picate.length ? ` ${picate.length} nu s-au putut marca: ${picate[0]}` : ""));
    incarca();
  }

  const perCurier = curieri.map((c) => ({ ...c, n: orders.filter((o) => o.curier === c.id).length }));

  return (
    <div className="space-y-4">
      <div><div className="dim">Administrare</div><h1 className="font-disp font-bold text-2xl mt-1">Expedieri (AWB)</h1>
        <p className="text-sm text-mut mt-1">Bifează coletele predate azi → printează borderoul → marchează-le expediate dintr-o mișcare.</p></div>

      {msg && <div className="card p-3 text-sm">{msg}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4"><span className="text-xs text-mut">De predat azi</span>
          <b className="block font-disp text-xl mt-1">{tab === "de_predat" ? orders.length : "—"}</b></div>
        {perCurier.map((c) => (
          <div key={c.id} className="card p-4"><span className="text-xs text-mut">{c.nume}</span>
            <b className="block font-disp text-xl mt-1">{c.n}</b></div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center text-sm">
        {([["de_predat", "De predat (confirmate)"], ["in_tranzit", "În tranzit"], ["livrate", "Livrate"]] as const).map(([id, t]) => (
          <button key={id} onClick={() => setTab(id)} className={`rounded-full border-2 px-3.5 py-1.5 font-semibold ${tab === id ? "border-acc bg-acc/5 text-acc" : "border-line"}`}>{t}</button>
        ))}
        {tab === "de_predat" && (
          <div className="ml-auto flex gap-2">
            <button onClick={borderou} className="rounded-xl border-2 border-line px-4 py-1.5 font-semibold hover:border-acc">Printează borderoul ({sel.length})</button>
            <button onClick={marcheazaExpediat} disabled={sel.length === 0 || lucru} className="btn-acc !py-1.5 !px-4 disabled:opacity-40">
              {lucru ? "Se marchează…" : "Marchează expediate"}</button>
          </div>
        )}
      </div>

      <div className="card overflow-x-auto">
        <table className="tabel-carduri w-full text-sm md:min-w-[820px]">
          <thead><tr className="text-left text-mut text-xs border-b border-line">
            {tab === "de_predat" && <th className="px-4 py-3 w-10">
              <input type="checkbox" checked={sel.length === orders.length && orders.length > 0}
                onChange={(e) => setSel(e.target.checked ? orders.map((o) => o.id) : [])} /></th>}
            <th className="px-4 py-3">AWB</th><th className="px-4 py-3">Comandă</th><th className="px-4 py-3">Destinatar</th>
            <th className="px-4 py-3">Curier</th><th className="px-4 py-3">Greutate</th><th className="px-4 py-3">Ramburs</th></tr></thead>
          <tbody className="divide-y divide-line">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-paper">
                {tab === "de_predat" && <td className="px-4 py-3">
                  <input type="checkbox" checked={sel.includes(o.id)}
                    onChange={(e) => setSel(e.target.checked ? [...sel, o.id] : sel.filter((x) => x !== o.id))} /></td>}
                <td data-eticheta="AWB" className="px-4 py-3">{o.awb ? <b className="text-ok">{o.awb}</b> : <span className="text-mut text-xs">negenerat</span>}</td>
                <td data-eticheta="Comandă" className="px-4 py-3"><Link href={`/admin/comenzi/${o.id}`} className="font-disp font-semibold hover:text-acc">{o.numar}</Link></td>
                <td data-eticheta="Client" className="px-4 py-3">{o.firma ?? o.nume}<div className="text-[11px] text-mut">{o.oras}, {o.judet} · {o.telefon}</div></td>
                <td data-eticheta="Curier" className="px-4 py-3">{numeCurier(o.curier)}</td>
                <td data-eticheta="Greutate" className="px-4 py-3">{(greutati[o.id] ?? 5).toFixed(1)} kg</td>
                <td data-eticheta="Ramburs" className="px-4 py-3">{o.plata === "ramburs" ? <b>{lei(Number(o.total))}</b> : <span className="text-mut">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && <p className="p-8 text-center text-mut text-sm">Niciun colet în această listă.</p>}
      </div>
    </div>
  );
}
