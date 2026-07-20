"use client";
// PANOU DE ADMINISTRARE — vizibil doar utilizatorilor cu rol "admin" (vezi README, pasul „Creează adminul").
// Comenzile și produsele sunt REALE, din Supabase; RLS blochează accesul oricui altcuiva.
import { useEffect, useState } from "react";
import { sbBrowser } from "@/lib/supabase";
import { lei } from "@/lib/format";
import Link from "next/link";
import type { Category, Vehicle, Brand, Model } from "@/lib/types";

type Ord = { id: number; numar: string; nume: string; email: string; telefon: string; adresa: string; oras: string; judet: string; cui: string | null; firma: string | null; subtotal: number; livrare: number; total: number; status: string; plata: string; curier: string; awb: string | null; created_at: string };
type Prod = { id: number; nume: string; oem: string; pret_lei: number; stoc: number; publicat: boolean; slug: string };
const STATUSURI = ["noua", "confirmata", "expediata", "livrata", "anulata"];

export default function Admin() {
  const [rol, setRol] = useState<"verific" | "anonim" | "client" | "admin">("verific");
  const [tab, setTab] = useState<"comenzi" | "produse">("comenzi");
  const [orders, setOrders] = useState<Ord[]>([]);
  const [prods, setProds] = useState<Prod[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [cars, setCars] = useState<Vehicle[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [msg, setMsg] = useState("");

  async function incarca() {
    const sb = sbBrowser(); if (!sb) { setRol("anonim"); return; }
    const { data: u } = await sb.auth.getUser();
    if (!u.user) { setRol("anonim"); return; }
    const { data: p } = await sb.from("profiles").select("role").eq("id", u.user.id).single();
    if (p?.role !== "admin") { setRol("client"); return; }
    setRol("admin");
    const [o, pr, c, v, b, m] = await Promise.all([
      sb.from("orders").select("*").order("created_at", { ascending: false }),
      sb.from("products").select("id,nume,oem,pret_lei,stoc,publicat,slug").order("created_at", { ascending: false }),
      sb.from("categories").select("*").order("ordine"),
      sb.from("vehicles").select("*").order("intrare", { ascending: false }),
      sb.from("brands").select("*").order("ordine"),
      sb.from("models").select("*").order("nume"),
    ]);
    setOrders((o.data ?? []) as Ord[]); setProds((pr.data ?? []) as Prod[]);
    setCats((c.data ?? []) as Category[]); setCars((v.data ?? []) as Vehicle[]);
    setBrands((b.data ?? []) as Brand[]); setModels((m.data ?? []) as Model[]);
  }
  useEffect(() => { incarca(); }, []);

  async function schimbaStatus(id: number, status: string) {
    const sb = sbBrowser()!; await sb.from("orders").update({ status }).eq("id", id);
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
  }
  async function adaugaProdus(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget); const sb = sbBrowser()!;
    const nume = String(f.get("nume"));
    const slug = nume.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Math.floor(Math.random() * 999);
    const { error } = await sb.from("products").insert({
      slug, nume, oem: f.get("oem"), stare: f.get("stare"), stare_nota: f.get("stare_nota") || null,
      pret_lei: Number(f.get("pret")), ani: f.get("ani") || null, art: f.get("art"),
      categorie_id: Number(f.get("categorie")) || null, vehicul_id: Number(f.get("vehicul")) || null,
      compat: String(f.get("compat") || "").split("\n").map((s) => s.trim()).filter(Boolean),
      model_ids: Array.from((e.currentTarget.elements.namedItem("modele") as HTMLSelectElement)?.selectedOptions ?? []).map((o) => Number(o.value)),
      stoc: Number(f.get("stoc") || 1), publicat: true,
    });
    setMsg(error ? "Eroare: " + error.message : "✓ Piesa a fost adăugată și e deja live pe site.");
    if (!error) { (e.target as HTMLFormElement).reset(); incarca(); }
  }

  // ---------- EXPORT SAGA: CSV cu comenzile confirmate, gata de importat de contabil ----------
  async function exportSaga() {
    const sb = sbBrowser()!;
    const ids = orders.filter((o) => o.status !== "anulata").map((o) => o.id);
    const { data: items } = await sb.from("order_items").select("*").in("order_id", ids);
    const rows = [["Numar comanda","Data","Client","CUI","Adresa","Oras","Judet","Email","Telefon","Produs","Cant","Pret cu TVA","Baza (fara TVA)","TVA 19%","Curier","Cost livrare","Plata"]];
    for (const o of orders.filter((x) => x.status !== "anulata")) {
      const ale = (items ?? []).filter((i: any) => i.order_id === o.id);
      for (const i of ale) {
        const brut = Number(i.pret) * i.cantitate, baza = brut / 1.19;
        rows.push([o.numar, new Date(o.created_at).toLocaleDateString("ro-RO"), o.firma ?? o.nume, o.cui ?? "-", o.adresa, o.oras, o.judet, o.email, o.telefon, i.nume, String(i.cantitate), brut.toFixed(2), baza.toFixed(2), (brut - baza).toFixed(2), o.curier, Number(o.livrare).toFixed(2), o.plata]);
      }
    }
    const csv = "\uFEFF" + rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `autopas-comenzi-saga-${new Date().toISOString().slice(0, 10)}.csv`; link.click();
  }
  // ---------- AWB: apelează ruta /api/awb; se activează complet la primirea conturilor de curier ----------
  async function genereazaAwb(o: Ord) {
    setMsg("");
    const r = await fetch("/api/awb", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ curier: o.curier, cerere: { numar_comanda: o.numar, nume: o.firma ?? o.nume, telefon: o.telefon, email: o.email, adresa: o.adresa, oras: o.oras, judet: o.judet, ramburs: o.plata === "ramburs" ? Number(o.total) : 0 } }) });
    const j = await r.json();
    if (j.ok && j.awb) {
      const sb = sbBrowser()!; await sb.from("orders").update({ awb: j.awb, awb_generat_la: new Date().toISOString() }).eq("id", o.id);
      setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, awb: j.awb } : x)));
    } else alert(j.eroare ?? "Eroare la generarea AWB.");
  }

  if (rol === "verific") return <div className="p-20 text-center text-mut">Se verifică accesul…</div>;
  if (rol !== "admin")
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="font-disp font-bold text-2xl">Zonă restricționată</h1>
        <p className="text-mut mt-2 text-sm">Panoul de administrare e disponibil doar contului de admin.
          {rol === "anonim" ? " Autentifică-te mai întâi." : " Contul tău nu are rol de admin (vezi README — pasul «Creează adminul»)."}</p>
        <Link href="/autentificare" className="btn-acc mt-5">Autentificare</Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="dim">Panou de administrare</div>
      <div className="flex items-center gap-3 mt-2 mb-6">
        <h1 className="font-disp font-bold text-3xl flex-1">Administrare</h1>
        <button onClick={exportSaga} className="px-4 py-2 rounded-xl font-semibold text-sm bg-ok/10 text-ok border-2 border-ok/30 hover:bg-ok/20" title="Descarcă CSV cu toate comenzile, pentru importul în Saga">
          Export Saga (CSV)</button>
        {(["comenzi", "produse"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg font-semibold text-sm border-2 ${tab === t ? "border-acc text-acc bg-acc/5" : "border-line"}`}>
            {t === "comenzi" ? `Comenzi (${orders.length})` : `Produse (${prods.length})`}</button>
        ))}
      </div>

      {tab === "comenzi" && (
        <div className="card divide-y divide-line overflow-x-auto">
          {orders.length === 0 && <p className="p-8 text-center text-mut">Nicio comandă încă. Plasează una de test din site!</p>}
          {orders.map((o) => (
            <div key={o.id} className="p-4 flex flex-wrap items-center gap-3 text-sm">
              <b className="font-disp text-base w-32">{o.numar}</b>
              <div className="flex-1 min-w-[180px]">{o.nume} · {o.telefon}<div className="text-mut text-xs">{o.oras} · {o.curier} · {o.plata}</div></div>
              <b className="font-disp text-acc">{lei(Number(o.total))}</b>
              {o.awb ? <span className="text-xs font-semibold text-ok" title="AWB generat">AWB {o.awb}</span> :
                <button onClick={() => genereazaAwb(o)} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border-2 border-line hover:border-acc" title="Generează AWB la curierul comenzii">AWB</button>}
              <select value={o.status} onChange={(e) => schimbaStatus(o.id, e.target.value)}
                className="rounded-lg border-2 border-line px-2 py-1.5 text-sm bg-white">
                {STATUSURI.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}

      {tab === "produse" && (
        <div className="grid lg:grid-cols-[1fr,380px] gap-6 items-start">
          <div className="card divide-y divide-line">
            {prods.map((p) => (
              <div key={p.id} className="p-3.5 flex items-center gap-3 text-sm">
                <div className="flex-1"><Link href={`/piese/${p.slug}`} className="font-semibold hover:text-acc">{p.nume}</Link>
                  <div className="text-mut text-xs">OEM {p.oem} · stoc {p.stoc}</div></div>
                <b className="font-disp text-acc">{lei(Number(p.pret_lei))}</b>
              </div>
            ))}
          </div>
          <form onSubmit={adaugaProdus} className="card p-5 grid gap-3 text-sm lg:sticky lg:top-24">
            <b className="font-disp font-semibold text-[13px]">Adaugă piesă nouă</b>
            <div className="fld"><label>Denumire *</label><input name="nume" required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="fld"><label>Cod OEM *</label><input name="oem" required /></div>
              <div className="fld"><label>Preț (lei) *</label><input name="pret" type="number" step="0.01" required /></div>
              <div className="fld"><label>Stare *</label><select name="stare"><option>A</option><option>B</option><option>C</option></select></div>
              <div className="fld"><label>Stoc</label><input name="stoc" type="number" defaultValue={1} /></div>
            </div>
            <div className="fld"><label>Notă stare</label><input name="stare_nota" placeholder="ex. testat pe stand" /></div>
            <div className="fld"><label>Ani compatibili</label><input name="ani" placeholder="ex. 2009–2013" /></div>
            <div className="fld"><label>Categorie</label><select name="categorie">{cats.map((c) => <option key={c.id} value={c.id}>{c.nume}</option>)}</select></div>
            <div className="fld"><label>Mașina-sursă (opțional)</label><select name="vehicul"><option value="">—</option>{cars.map((v) => <option key={v.id} value={v.id}>{v.nume} · {v.an}</option>)}</select></div>
            <div className="fld"><label>Ilustrație</label><select name="art">{["engine","alternator","headlight","gearbox","turbo","mirror","egr","compressor","wheel","suspension","brake","seat","panel"].map((a) => <option key={a}>{a}</option>)}</select></div>
            <div className="fld"><label>Modele compatibile * <span className="font-normal text-mut">(Ctrl+click pentru mai multe — alimentează filtrul de pe site)</span></label>
              <select name="modele" multiple size={6}>
                {brands.map((b) => (
                  <optgroup key={b.id} label={b.nume}>
                    {models.filter((m) => m.brand_id === b.id).map((m) => <option key={m.id} value={m.id}>{m.nume}</option>)}
                  </optgroup>
                ))}
              </select></div>
            <div className="fld"><label>Compatibilitate afișată (un model pe linie)</label><textarea name="compat" rows={3} placeholder={"VW Golf 6 1.6 TDI · 2009–2013\nVW Passat B7 1.6 TDI · 2010–2014"} /></div>
            <button className="btn-acc">Publică piesa</button>
            {msg && <p className="text-xs text-center">{msg}</p>}
          </form>
        </div>
      )}
    </div>
  );
}
