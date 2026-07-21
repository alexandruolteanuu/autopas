"use client";
// DASHBOARD — răspunde la întrebarea „ce am de făcut ACUM?", cu date reale din Supabase.
import { useEffect, useState } from "react";
import Link from "next/link";
import { sbBrowser } from "@/lib/supabase";
import { lei } from "@/lib/format";

type Kpi = { azi: number; aziNr: number; luna: number; lunaNr: number; noi: number; deExpediat: number };
type Zi = { eticheta: string; suma: number };
type Recenta = { id: number; numar: string; nume: string; oras: string; total: number; status: string; created_at: string };
type Cat = { nume: string; suma: number };

const STATUS: Record<string, string> = { noua: "bg-acc/10 text-acc", confirmata: "bg-blue-100 text-blue-700", expediata: "bg-purple-100 text-purple-700", livrata: "bg-ok/10 text-ok", anulata: "bg-red-100 text-red-600" };

export default function Dashboard() {
  const [kpi, setKpi] = useState<Kpi | null>(null);
  const [zile, setZile] = useState<Zi[]>([]);
  const [recente, setRecente] = useState<Recenta[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);

  useEffect(() => {
    const sb = sbBrowser(); if (!sb) return;
    (async () => {
      const azi0 = new Date(); azi0.setHours(0, 0, 0, 0);
      const luna0 = new Date(); luna0.setDate(1); luna0.setHours(0, 0, 0, 0);
      const z7 = new Date(azi0); z7.setDate(z7.getDate() - 6);

      const [oAzi, oLuna, o7, oNoi, oExp, oRec, itemsLuna, catAll] = await Promise.all([
        sb.from("orders").select("total").neq("status", "anulata").gte("created_at", azi0.toISOString()),
        sb.from("orders").select("total").neq("status", "anulata").gte("created_at", luna0.toISOString()),
        sb.from("orders").select("total,created_at").neq("status", "anulata").gte("created_at", z7.toISOString()),
        sb.from("orders").select("id", { count: "exact", head: true }).eq("status", "noua"),
        sb.from("orders").select("id", { count: "exact", head: true }).eq("status", "confirmata"),
        sb.from("orders").select("id,numar,nume,oras,total,status,created_at").order("created_at", { ascending: false }).limit(6),
        sb.from("order_items").select("pret,cantitate,orders!inner(created_at,status),products(categorie_id)").gte("orders.created_at", luna0.toISOString()),
        sb.from("categories").select("id,nume"),
      ]);

      const suma = (rows: any[] | null) => (rows ?? []).reduce((s, r) => s + Number(r.total), 0);
      setKpi({ azi: suma(oAzi.data), aziNr: (oAzi.data ?? []).length, luna: suma(oLuna.data), lunaNr: (oLuna.data ?? []).length,
        noi: oNoi.count ?? 0, deExpediat: oExp.count ?? 0 });

      const perZi = new Map<string, number>();
      for (let i = 0; i < 7; i++) { const d = new Date(z7); d.setDate(z7.getDate() + i); perZi.set(d.toDateString(), 0); }
      (o7.data ?? []).forEach((r: any) => { const k = new Date(r.created_at).toDateString(); if (perZi.has(k)) perZi.set(k, perZi.get(k)! + Number(r.total)); });
      const nume = ["Dum", "Lun", "Mar", "Mie", "Joi", "Vin", "Sâm"];
      setZile(Array.from(perZi.entries()).map(([k, v]) => ({ eticheta: nume[new Date(k).getDay()], suma: v })));

      setRecente((oRec.data ?? []) as Recenta[]);

      const numeCat = new Map<number, string>(((catAll.data ?? []) as any[]).map((c) => [c.id, c.nume]));
      const perCat = new Map<string, number>();
      ((itemsLuna.data ?? []) as any[]).forEach((i) => {
        if (i.orders?.status === "anulata") return;
        const n = numeCat.get(i.products?.categorie_id) ?? "Altele";
        perCat.set(n, (perCat.get(n) ?? 0) + Number(i.pret) * i.cantitate);
      });
      setCats(Array.from(perCat.entries()).map(([nume, suma]) => ({ nume, suma })).sort((a, b) => b.suma - a.suma).slice(0, 6));
    })();
  }, []);

  const maxZi = Math.max(1, ...zile.map((z) => z.suma));
  const maxCat = Math.max(1, ...cats.map((c) => c.suma));

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div><div className="dim">Autopas · panou de administrare</div>
          <h1 className="font-disp font-bold text-2xl mt-1">Dashboard</h1></div>
        <span className="text-sm text-mut">{new Date().toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long" })}</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ["Vânzări azi", kpi ? lei(kpi.azi) : "…", kpi ? `${kpi.aziNr} comenzi` : ""],
          ["Vânzări luna aceasta", kpi ? lei(kpi.luna) : "…", kpi ? `${kpi.lunaNr} comenzi` : ""],
          ["Comenzi noi (de confirmat)", kpi ? String(kpi.noi) : "…", "sună clientul, apoi confirmă"],
          ["De expediat (confirmate)", kpi ? String(kpi.deExpediat) : "…", "predă curierului azi"],
        ].map(([t, v, s]) => (
          <div key={t as string} className="card p-4">
            <span className="text-xs text-mut">{t}</span>
            <b className="block font-disp text-2xl mt-1">{v}</b>
            <span className="text-[11px] text-mut">{s}</span>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1.4fr,1fr] gap-4 items-start">
        <div className="card p-5">
          <b className="font-disp font-semibold text-[13px]">Vânzări — ultimele 7 zile</b>
          <div className="mt-4 grid grid-cols-7 gap-2 items-end h-40">
            {zile.map((z, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 h-full justify-end">
                <span className="text-[10px] text-mut">{z.suma > 0 ? lei(z.suma) : ""}</span>
                <div className={`w-full rounded-t-md ${i === 6 ? "bg-acc" : "bg-line"}`} style={{ height: `${Math.max(4, (z.suma / maxZi) * 100)}%` }} />
                <span className="text-[11px] text-mut">{z.eticheta}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <b className="font-disp font-semibold text-[13px]">Top categorii — luna curentă</b>
          <div className="mt-4 space-y-3">
            {cats.length === 0 && <p className="text-sm text-mut">Încă nicio vânzare luna aceasta.</p>}
            {cats.map((c) => (
              <div key={c.nume} className="text-sm">
                <div className="flex justify-between"><span>{c.nume}</span><b>{lei(c.suma)}</b></div>
                <div className="h-2 rounded-full bg-paper mt-1"><div className="h-2 rounded-full bg-acc" style={{ width: `${(c.suma / maxCat) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line">
          <b className="font-disp font-semibold text-[13px]">Comenzi recente</b>
          <Link href="/admin/comenzi" className="text-sm text-acc font-semibold">Toate comenzile →</Link>
        </div>
        <div className="divide-y divide-line">
          {recente.map((o) => (
            <Link key={o.id} href={`/admin/comenzi/${o.id}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-paper">
              <b className="font-disp w-32 shrink-0">{o.numar}</b>
              <span className="flex-1 min-w-0 truncate">{o.nume} · <span className="text-mut">{o.oras}</span></span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${STATUS[o.status] ?? "bg-paper"}`}>{o.status}</span>
              <b className="font-disp text-acc whitespace-nowrap">{lei(Number(o.total))}</b>
            </Link>
          ))}
          {recente.length === 0 && <p className="px-5 py-8 text-sm text-mut text-center">Nicio comandă încă — plasează una de test din site.</p>}
        </div>
      </div>
    </div>
  );
}
