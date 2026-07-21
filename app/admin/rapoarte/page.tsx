"use client";
// RAPOARTE — trei rapoarte reale, calculate din baza de date, cu export CSV.
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { sbBrowser } from "@/lib/supabase";
import { lei } from "@/lib/format";

type Rand = { nume: string; suma: number; buc: number };
type Profit = { nume: string; cost: number; incasat: number; profit: number; zile: number; slug: string };
type Veche = { id: number; nume: string; oem: string; slug: string; pret: number; zile: number };

function csv(nume: string, rows: (string | number)[][]) {
  const c = "\uFEFF" + rows.map((r) => r.map((x) => `"${String(x).replaceAll('"', '""')}"`).join(";")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([c], { type: "text/csv;charset=utf-8" }));
  a.download = nume; a.click();
}

export default function Rapoarte() {
  const azi = new Date().toISOString().slice(0, 10);
  const acum30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [de, setDe] = useState(acum30);
  const [pana, setPana] = useState(azi);
  const [cats, setCats] = useState<Rand[]>([]);
  const [profituri, setProfituri] = useState<Profit[]>([]);
  const [vechi, setVechi] = useState<Veche[]>([]);
  const [prag, setPrag] = useState(90);

  const incarca = useCallback(async () => {
    const sb = sbBrowser(); if (!sb) return;
    const d0 = new Date(de + "T00:00:00").toISOString();
    const d1 = new Date(pana + "T23:59:59").toISOString();

    const [items, catAll, veh, prod] = await Promise.all([
      sb.from("order_items").select("pret,cantitate,product_id,orders!inner(created_at,status)")
        .gte("orders.created_at", d0).lte("orders.created_at", d1).neq("orders.status", "anulata"),
      sb.from("categories").select("id,nume"),
      sb.from("vehicles").select("id,nume,slug,cost_achizitie,intrare"),
      sb.from("products").select("id,nume,oem,slug,pret_lei,stoc,categorie_id,vehicul_id,created_at"),
    ]);
    const produse = new Map<number, any>(((prod.data ?? []) as any[]).map((p) => [p.id, p]));
    const numeCat = new Map<number, string>(((catAll.data ?? []) as any[]).map((c) => [c.id, c.nume]));

    // 1) vânzări pe categorii
    const perCat = new Map<string, Rand>();
    ((items.data ?? []) as any[]).forEach((i) => {
      const p = produse.get(i.product_id);
      const n = numeCat.get(p?.categorie_id) ?? "Altele";
      const r = perCat.get(n) ?? { nume: n, suma: 0, buc: 0 };
      r.suma += Number(i.pret) * i.cantitate; r.buc += i.cantitate; perCat.set(n, r);
    });
    setCats(Array.from(perCat.values()).sort((a, b) => b.suma - a.suma));

    // 2) profit pe mașină (pe tot istoricul, nu doar interval — e o metrică de ciclu de viață)
    const toateItems = await sb.from("order_items").select("pret,cantitate,product_id,orders!inner(status)").neq("orders.status", "anulata");
    const incasatVeh = new Map<number, number>();
    ((toateItems.data ?? []) as any[]).forEach((i) => {
      const p = produse.get(i.product_id); if (!p?.vehicul_id) return;
      incasatVeh.set(p.vehicul_id, (incasatVeh.get(p.vehicul_id) ?? 0) + Number(i.pret) * i.cantitate);
    });
    setProfituri(((veh.data ?? []) as any[]).map((v) => {
      const inc = incasatVeh.get(v.id) ?? 0, cost = Number(v.cost_achizitie || 0);
      return { nume: v.nume, slug: v.slug, cost, incasat: inc, profit: inc - cost,
        zile: Math.round((Date.now() - new Date(v.intrare).getTime()) / 86400000) };
    }).sort((a, b) => b.profit - a.profit));

    // 3) stocuri vechi
    setVechi(((prod.data ?? []) as any[]).filter((p) => p.stoc > 0)
      .map((p) => ({ id: p.id, nume: p.nume, oem: p.oem, slug: p.slug, pret: Number(p.pret_lei),
        zile: Math.round((Date.now() - new Date(p.created_at).getTime()) / 86400000) }))
      .filter((p) => p.zile >= prag).sort((a, b) => b.zile - a.zile));
  }, [de, pana, prag]);
  useEffect(() => { incarca(); }, [incarca]);

  const totalCat = cats.reduce((s, c) => s + c.suma, 0);
  const maxCat = Math.max(1, ...cats.map((c) => c.suma));
  const valImobilizata = vechi.reduce((s, v) => s + v.pret, 0);

  return (
    <div className="space-y-4">
      <div><div className="dim">Administrare</div><h1 className="font-disp font-bold text-2xl mt-1">Rapoarte</h1></div>

      {/* 1. Vânzări pe categorii */}
      <div className="card p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <b className="font-disp font-semibold text-[13px]">Vânzări pe categorii</b>
          <div className="flex items-center gap-2 text-sm">
            <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="rounded-lg border-2 border-line px-2 py-1" />
            <span className="text-mut">→</span>
            <input type="date" value={pana} onChange={(e) => setPana(e.target.value)} className="rounded-lg border-2 border-line px-2 py-1" />
            <button onClick={() => csv(`vanzari-categorii-${de}_${pana}.csv`, [["Categorie", "Bucati", "Valoare lei"], ...cats.map((c) => [c.nume, c.buc, c.suma.toFixed(2)])])}
              className="rounded-lg border-2 border-line px-3 py-1 font-semibold hover:border-acc">Export CSV</button>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {cats.map((c) => (
            <div key={c.nume} className="text-sm">
              <div className="flex justify-between"><span>{c.nume} <span className="text-mut">· {c.buc} buc</span></span><b>{lei(c.suma)}</b></div>
              <div className="h-2 rounded-full bg-paper mt-1"><div className="h-2 rounded-full bg-acc" style={{ width: `${(c.suma / maxCat) * 100}%` }} /></div>
            </div>
          ))}
          {cats.length === 0 && <p className="text-sm text-mut">Nicio vânzare în intervalul ales.</p>}
        </div>
        {cats.length > 0 && <p className="mt-4 pt-3 border-t border-line text-sm flex justify-between"><b>Total interval</b><b className="font-disp text-lg text-acc">{lei(totalCat)}</b></p>}
      </div>

      {/* 2. Profit pe mașină */}
      <div className="card p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div><b className="font-disp font-semibold text-[13px]">Profit pe mașină dezmembrată</b>
            <p className="text-xs text-mut">Cost achiziție vs. încasat din piesele ei — raportul-vedetă al domeniului.</p></div>
          <button onClick={() => csv("profit-masini.csv", [["Vehicul", "Cost", "Incasat", "Profit", "Zile de la intrare"], ...profituri.map((p) => [p.nume, p.cost.toFixed(2), p.incasat.toFixed(2), p.profit.toFixed(2), p.zile])])}
            className="rounded-lg border-2 border-line px-3 py-1 text-sm font-semibold hover:border-acc">Export CSV</button>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm min-w-[620px]">
            <thead><tr className="text-left text-mut text-xs border-b border-line">
              <th className="py-2">Vehicul</th><th className="py-2">Cost</th><th className="py-2">Încasat</th><th className="py-2">Profit</th><th className="py-2">Stare</th></tr></thead>
            <tbody className="divide-y divide-line">
              {profituri.map((p) => (
                <tr key={p.slug}>
                  <td className="py-2"><Link href={`/piese?vehicul=${p.slug}`} className="hover:text-acc font-semibold">{p.nume}</Link></td>
                  <td className="py-2">{p.cost ? lei(p.cost) : "—"}</td>
                  <td className="py-2">{lei(p.incasat)}</td>
                  <td className={`py-2 font-semibold ${p.profit >= 0 ? "text-ok" : "text-red-600"}`}>{p.cost ? (p.profit >= 0 ? "+" : "") + lei(p.profit) : "—"}</td>
                  <td className="py-2 text-xs text-mut">{p.cost ? (p.incasat >= p.cost ? `amortizată · ${p.zile} zile` : `în curs · ${p.zile} zile`) : "fără cost trecut"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {profituri.length === 0 && <p className="text-sm text-mut py-4">Niciun vehicul înregistrat. Adaugă-le în „Mașini la dezmembrat".</p>}
        </div>
      </div>

      {/* 3. Stocuri vechi */}
      <div className="card p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div><b className="font-disp font-semibold text-[13px]">Stocuri vechi</b>
            <p className="text-xs text-mut">Piese nevândute de peste {prag} de zile — bani blocați pe raft.</p></div>
          <div className="flex gap-2 text-sm">
            {[90, 180, 365].map((z) => (
              <button key={z} onClick={() => setPrag(z)} className={`rounded-lg border-2 px-3 py-1 font-semibold ${prag === z ? "border-acc text-acc" : "border-line"}`}>{z}+ zile</button>
            ))}
            <button onClick={() => csv(`stocuri-vechi-${prag}zile.csv`, [["Piesa", "OEM", "Pret", "Zile pe stoc"], ...vechi.map((v) => [v.nume, v.oem, v.pret.toFixed(2), v.zile])])}
              className="rounded-lg border-2 border-line px-3 py-1 font-semibold hover:border-acc">Export CSV</button>
          </div>
        </div>
        <p className="mt-3 text-sm">{vechi.length} piese · valoare imobilizată: <b className="text-acc font-disp">{lei(valImobilizata)}</b></p>
        <div className="mt-3 divide-y divide-line max-h-72 overflow-y-auto">
          {vechi.slice(0, 50).map((v) => (
            <div key={v.id} className="py-2 flex items-center gap-3 text-sm">
              <Link href={`/piese/${v.slug}`} className="flex-1 min-w-0 truncate hover:text-acc">{v.nume}</Link>
              <span className="text-xs text-mut">OEM {v.oem}</span>
              <span className="text-xs text-mut">{v.zile} zile</span>
              <b className="font-disp whitespace-nowrap">{lei(v.pret)}</b>
            </div>
          ))}
          {vechi.length === 0 && <p className="py-4 text-sm text-mut">Nicio piesă mai veche de {prag} de zile. ✓</p>}
        </div>
      </div>
    </div>
  );
}
