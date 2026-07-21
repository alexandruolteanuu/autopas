"use client";
// MAȘINI LA DEZMEMBRAT — fiecare mașină e un mini-business:
// cost de achiziție vs. încasat din piesele ei = profit + zile până la amortizare.
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { sbBrowser } from "@/lib/supabase";
import { lei } from "@/lib/format";
import type { VehiculAdmin } from "@/lib/types";

type Randament = { listate: number; vandute: number; incasat: number };

export default function Masini() {
  const [cars, setCars] = useState<VehiculAdmin[]>([]);
  const [rand, setRand] = useState<Record<number, Randament>>({});
  const [edit, setEdit] = useState<VehiculAdmin | null>(null);
  const [form, setForm] = useState(false);
  const [msg, setMsg] = useState("");

  const incarca = useCallback(async () => {
    const sb = sbBrowser(); if (!sb) return;
    const [v, p, it] = await Promise.all([
      sb.from("vehicles").select("*").order("intrare", { ascending: false }),
      sb.from("products").select("id,vehicul_id,stoc,pret_lei"),
      sb.from("order_items").select("pret,cantitate,product_id,orders!inner(status)").neq("orders.status", "anulata"),
    ]);
    setCars((v.data ?? []) as VehiculAdmin[]);
    const pieseDupaId = new Map<number, any>(((p.data ?? []) as any[]).map((x) => [x.id, x]));
    const r: Record<number, Randament> = {};
    ((p.data ?? []) as any[]).forEach((x) => {
      if (!x.vehicul_id) return;
      r[x.vehicul_id] ??= { listate: 0, vandute: 0, incasat: 0 };
      r[x.vehicul_id].listate++;
      if (x.stoc <= 0) r[x.vehicul_id].vandute++;
    });
    ((it.data ?? []) as any[]).forEach((i) => {
      const p = pieseDupaId.get(i.product_id); if (!p?.vehicul_id) return;
      r[p.vehicul_id] ??= { listate: 0, vandute: 0, incasat: 0 };
      r[p.vehicul_id].incasat += Number(i.pret) * i.cantitate;
    });
    setRand(r);
  }, []);
  useEffect(() => { incarca(); }, [incarca]);

  async function salveaza(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setMsg("");
    const f = new FormData(e.currentTarget); const sb = sbBrowser()!;
    const nume = String(f.get("nume"));
    const date = {
      nume, an: Number(f.get("an")) || null, vin_masca: f.get("vin") || null,
      cost_achizitie: Number(f.get("cost")) || null, status: String(f.get("status")),
      intrare: String(f.get("intrare") || new Date().toISOString().slice(0, 10)),
    };
    let error;
    if (edit) ({ error } = await sb.from("vehicles").update(date).eq("id", edit.id));
    else {
      const slug = nume.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Math.floor(Math.random() * 999);
      ({ error } = await sb.from("vehicles").insert({ ...date, slug, piese_listate: 0 }));
    }
    setMsg(error ? "Eroare: " + error.message : edit ? "✓ Mașina a fost actualizată." : "✓ Mașina a fost adăugată — o poți alege acum la piese.");
    if (!error) { setEdit(null); setForm(false); incarca(); }
  }

  async function sterge(v: VehiculAdmin) {
    if (!confirm(`Ștergi „${v.nume}"? Piesele rămân, dar nu vor mai fi legate de o mașină.`)) return;
    const sb = sbBrowser()!;
    await sb.from("products").update({ vehicul_id: null }).eq("vehicul_id", v.id);
    const { error } = await sb.from("vehicles").delete().eq("id", v.id);
    setMsg(error ? "Eroare: " + error.message : "✓ Mașina a fost ștearsă."); incarca();
  }

  const totalCost = cars.reduce((s, c) => s + Number(c.cost_achizitie || 0), 0);
  const totalIncasat = Object.values(rand).reduce((s, r) => s + r.incasat, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div><div className="dim">Administrare</div><h1 className="font-disp font-bold text-2xl mt-1">Mașini la dezmembrat</h1>
          <p className="text-sm text-mut mt-1">Metrica-cheie a afacerii: cât a costat mașina vs. cât ai încasat din piesele ei.</p></div>
        <button onClick={() => { setEdit(null); setForm(!form); }} className="btn-acc !py-2 !px-4 text-sm">{form ? "Închide" : "+ Înregistrează vehicul"}</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[["Vehicule în evidență", String(cars.length)],
          ["Investit în achiziții", lei(totalCost)],
          ["Încasat din piese", lei(totalIncasat)],
          ["Rezultat", lei(totalIncasat - totalCost)]].map(([t, v]) => (
          <div key={t} className="card p-4"><span className="text-xs text-mut">{t}</span>
            <b className={`block font-disp text-xl mt-1 ${t === "Rezultat" ? (totalIncasat - totalCost >= 0 ? "text-ok" : "text-red-600") : ""}`}>{v}</b></div>
        ))}
      </div>

      {(form || edit) && (
        <form onSubmit={salveaza} className="card p-5 grid sm:grid-cols-3 gap-3 text-sm">
          <b className="font-disp font-semibold text-[13px] sm:col-span-3">{edit ? `Editezi: ${edit.nume}` : "Vehicul nou"}</b>
          <div className="fld sm:col-span-2"><label>Denumire * <span className="font-normal text-mut">(ex. VW Passat B7 2.0 TDI)</span></label>
            <input name="nume" required defaultValue={edit?.nume} /></div>
          <div className="fld"><label>An</label><input name="an" type="number" defaultValue={edit?.an ?? ""} /></div>
          <div className="fld"><label>VIN mascat <span className="font-normal text-mut">(public, parțial)</span></label>
            <input name="vin" defaultValue={edit?.vin_masca ?? ""} placeholder="WVWZZZ…9917" /></div>
          <div className="fld"><label>Cost achiziție (lei)</label><input name="cost" type="number" step="0.01" defaultValue={edit?.cost_achizitie ?? ""} /></div>
          <div className="fld"><label>Data intrării</label><input name="intrare" type="date" defaultValue={(edit?.intrare ?? new Date().toISOString()).slice(0, 10)} /></div>
          <div className="fld sm:col-span-2"><label>Status</label>
            <select name="status" defaultValue={edit?.status ?? "in_dezmembrare"}>
              <option value="in_dezmembrare">În dezmembrare</option>
              <option value="amortizata">Amortizată</option>
              <option value="finalizata">Finalizată</option>
            </select></div>
          <div className="flex gap-2 items-end">
            <button className="btn-acc flex-1">{edit ? "Salvează" : "Adaugă"}</button>
            {edit && <button type="button" onClick={() => setEdit(null)} className="rounded-xl border-2 border-line px-4">Renunț</button>}
          </div>
        </form>
      )}
      {msg && <p className="text-sm">{msg}</p>}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[820px]">
          <thead><tr className="text-left text-mut text-xs border-b border-line">
            <th className="px-4 py-3">Vehicul</th><th className="px-4 py-3">Intrare</th><th className="px-4 py-3">Piese</th>
            <th className="px-4 py-3">Cost</th><th className="px-4 py-3">Încasat</th><th className="px-4 py-3">Profit</th>
            <th className="px-4 py-3">Amortizare</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th></tr></thead>
          <tbody className="divide-y divide-line">
            {cars.map((v) => {
              const r = rand[v.id] ?? { listate: 0, vandute: 0, incasat: 0 };
              const cost = Number(v.cost_achizitie || 0);
              const profit = r.incasat - cost;
              const zile = Math.round((Date.now() - new Date(v.intrare).getTime()) / 86400000);
              return (
                <tr key={v.id} className="hover:bg-paper">
                  <td className="px-4 py-3"><b>{v.nume}</b>{v.an ? ` · ${v.an}` : ""}
                    <div className="text-[11px] text-mut">{v.vin_masca ?? ""}</div></td>
                  <td className="px-4 py-3 text-mut">{new Date(v.intrare).toLocaleDateString("ro-RO")}</td>
                  <td className="px-4 py-3"><Link href={`/piese?vehicul=${v.slug}`} className="text-acc font-semibold">{r.listate} listate</Link>
                    <div className="text-[11px] text-mut">{r.vandute} vândute</div></td>
                  <td className="px-4 py-3">{cost ? lei(cost) : <span className="text-mut">—</span>}</td>
                  <td className="px-4 py-3">{lei(r.incasat)}</td>
                  <td className={`px-4 py-3 font-semibold ${profit >= 0 ? "text-ok" : "text-red-600"}`}>{cost ? (profit >= 0 ? "+" : "") + lei(profit) : "—"}</td>
                  <td className="px-4 py-3 text-xs">{cost ? (r.incasat >= cost ? <span className="text-ok font-semibold">amortizată în {zile} zile</span> : <span className="text-mut">în curs · {zile} zile</span>) : "—"}</td>
                  <td className="px-4 py-3 text-xs">{v.status.replace("_", " ")}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button onClick={() => { setEdit(v); setForm(false); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="text-acc font-semibold mr-3">Editează</button>
                    <button onClick={() => sterge(v)} className="text-mut hover:text-red-600">Șterge</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {cars.length === 0 && <p className="p-8 text-center text-mut text-sm">Niciun vehicul înregistrat încă.</p>}
      </div>
    </div>
  );
}
