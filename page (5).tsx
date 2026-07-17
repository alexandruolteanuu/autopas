"use client";
// PANOU DE ADMINISTRARE — vizibil doar utilizatorilor cu rol "admin" (vezi README, pasul „Creează adminul").
// Comenzile și produsele sunt REALE, din Supabase; RLS blochează accesul oricui altcuiva.
import { useEffect, useState } from "react";
import { sbBrowser } from "@/lib/supabase";
import { lei } from "@/lib/format";
import Link from "next/link";
import type { Category, Vehicle } from "@/lib/types";

type Ord = { id: number; numar: string; nume: string; telefon: string; oras: string; total: number; status: string; plata: string; curier: string; created_at: string };
type Prod = { id: number; nume: string; oem: string; pret_lei: number; stoc: number; publicat: boolean; slug: string };
const STATUSURI = ["noua", "confirmata", "expediata", "livrata", "anulata"];

export default function Admin() {
  const [rol, setRol] = useState<"verific" | "anonim" | "client" | "admin">("verific");
  const [tab, setTab] = useState<"comenzi" | "produse">("comenzi");
  const [orders, setOrders] = useState<Ord[]>([]);
  const [prods, setProds] = useState<Prod[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [cars, setCars] = useState<Vehicle[]>([]);
  const [msg, setMsg] = useState("");

  async function incarca() {
    const sb = sbBrowser(); if (!sb) { setRol("anonim"); return; }
    const { data: u } = await sb.auth.getUser();
    if (!u.user) { setRol("anonim"); return; }
    const { data: p } = await sb.from("profiles").select("role").eq("id", u.user.id).single();
    if (p?.role !== "admin") { setRol("client"); return; }
    setRol("admin");
    const [o, pr, c, v] = await Promise.all([
      sb.from("orders").select("*").order("created_at", { ascending: false }),
      sb.from("products").select("id,nume,oem,pret_lei,stoc,publicat,slug").order("created_at", { ascending: false }),
      sb.from("categories").select("*").order("ordine"),
      sb.from("vehicles").select("*").order("intrare", { ascending: false }),
    ]);
    setOrders((o.data ?? []) as Ord[]); setProds((pr.data ?? []) as Prod[]);
    setCats((c.data ?? []) as Category[]); setCars((v.data ?? []) as Vehicle[]);
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
      stoc: Number(f.get("stoc") || 1), publicat: true,
    });
    setMsg(error ? "Eroare: " + error.message : "✓ Piesa a fost adăugată și e deja live pe site.");
    if (!error) { (e.target as HTMLFormElement).reset(); incarca(); }
  }

  if (rol === "verific") return <div className="p-20 text-center text-mut">Se verifică accesul…</div>;
  if (rol !== "admin")
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="font-disp font-black uppercase text-2xl">Zonă restricționată</h1>
        <p className="text-mut mt-2 text-sm">Panoul de administrare e disponibil doar contului de admin.
          {rol === "anonim" ? " Autentifică-te mai întâi." : " Contul tău nu are rol de admin (vezi README — pasul «Creează adminul»)."}</p>
        <Link href="/autentificare" className="btn-acc mt-5">Autentificare</Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="dim">Panou de administrare</div>
      <div className="flex items-center gap-3 mt-2 mb-6">
        <h1 className="font-disp font-black uppercase text-3xl flex-1">Administrare</h1>
        {(["comenzi", "produse"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg font-disp font-bold uppercase text-sm border-2 ${tab === t ? "border-acc text-acc bg-acc/5" : "border-line"}`}>
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
            <b className="font-disp uppercase tracking-widest text-[13px]">Adaugă piesă nouă</b>
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
            <div className="fld"><label>Compatibilitate (un model pe linie)</label><textarea name="compat" rows={3} placeholder={"VW Golf 6 1.6 TDI · 2009–2013\nVW Passat B7 1.6 TDI · 2010–2014"} /></div>
            <button className="btn-acc">Publică piesa</button>
            {msg && <p className="text-xs text-center">{msg}</p>}
          </form>
        </div>
      )}
    </div>
  );
}
