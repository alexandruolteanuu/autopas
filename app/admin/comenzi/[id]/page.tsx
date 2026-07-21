"use client";
// DETALIU COMANDĂ — centrul de comandă al unei vânzări:
// produse + mașina-sursă, clientul cu acțiuni rapide, jurnalul complet (cine/când/ce),
// facturare (fluxul Saga), expediere (greutate + AWB), anulare cu republicarea pieselor.
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { sbBrowser } from "@/lib/supabase";
import { lei } from "@/lib/format";
import { getSetariBrowser, waLinkCu, CURIERI_IMPLICITI, type Curier, type Firma, FIRMA_IMPLICITA } from "@/lib/settings";
import type { OrderFull, OrderEvent } from "@/lib/types";

type Item = { id: number; nume: string; pret: number; cantitate: number; product_id: number | null;
  products: { oem: string; slug: string; greutate_kg: number | null; vehicles: { nume: string; an: number } | null } | null };

const PASI = ["noua", "confirmata", "expediata", "livrata"];
const NUME: Record<string, string> = { noua: "Nouă", confirmata: "Confirmată", expediata: "Expediată", livrata: "Livrată", anulata: "Anulată" };

export default function DetaliuComanda() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [o, setO] = useState<OrderFull | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [msg, setMsg] = useState("");
  const [gata, setGata] = useState(false);
  const [curieri, setCurieri] = useState<Curier[]>(CURIERI_IMPLICITI);
  const [firma, setFirma] = useState<Firma>(FIRMA_IMPLICITA);
  useEffect(() => { getSetariBrowser().then((s) => { setCurieri(s.curieri); setFirma(s.firma); }); }, []);

  const incarca = useCallback(async () => {
    const sb = sbBrowser(); if (!sb) return;
    const [ord, it, ev] = await Promise.all([
      sb.from("orders").select("*").eq("id", id).single(),
      sb.from("order_items").select("*, products(oem,slug,greutate_kg,vehicles(nume,an))").eq("order_id", id),
      sb.from("order_events").select("*").eq("order_id", id).order("created_at", { ascending: false }),
    ]);
    setO(ord.data as OrderFull); setItems((it.data ?? []) as Item[]); setEvents((ev.data ?? []) as OrderEvent[]);
    setGata(true);
  }, [id]);
  useEffect(() => { incarca(); }, [incarca]);

  async function salveaza(campuri: Record<string, unknown>, jurnal?: string) {
    const sb = sbBrowser()!; setMsg("");
    const { error } = await sb.from("orders").update(campuri).eq("id", id);
    if (error) { setMsg("Eroare: " + error.message); return; }
    if (jurnal) await sb.from("order_events").insert({ order_id: Number(id), tip: "nota", mesaj: jurnal, autor: (await sb.auth.getUser()).data.user?.email ?? "echipa" });
    incarca();
  }

  async function anuleaza() {
    if (!confirm("Anulezi comanda? Piesele revin automat pe stoc și se republică pe site.")) return;
    const sb = sbBrowser()!;
    const { error } = await sb.rpc("anuleaza_comanda", { oid: Number(id) });
    if (error) setMsg("Eroare: " + error.message); else incarca();
  }

  async function stergeComanda() {
    if (!confirm("ȘTERGI definitiv comanda? Piesele revin pe stoc. Acțiunea nu poate fi anulată.")) return;
    const sb = sbBrowser()!;
    const { data, error } = await sb.rpc("sterge_comanda", { oid: Number(id) });
    if (error) { setMsg("Eroare: " + error.message); return; }
    const r = data as { ok: boolean; mesaj: string };
    if (!r.ok) { setMsg(r.mesaj); return; }
    router.push("/admin/comenzi");
  }

  async function genereazaAwb() {
    if (!o) return; setMsg("");
    const r = await fetch("/api/awb", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ curier: o.curier, cerere: { numar_comanda: o.numar, nume: o.firma ?? o.nume, telefon: o.telefon, email: o.email, adresa: o.adresa, oras: o.oras, judet: o.judet, ramburs: o.plata === "ramburs" ? Number(o.total) : 0, greutate_kg: greutate } }) });
    const j = await r.json();
    if (j.ok && j.awb) { await salveaza({ awb: j.awb, awb_generat_la: new Date().toISOString() }, `AWB ${j.awb} generat la ${o.curier}`); }
    else setMsg(j.eroare ?? "Eroare la AWB.");
  }

  if (!gata) return <div className="text-mut">Se încarcă…</div>;
  if (!o) return <div className="card p-8 text-center"><b>Comanda nu există.</b> <Link href="/admin/comenzi" className="text-acc font-semibold block mt-2">← Înapoi la comenzi</Link></div>;

  const greutate = Math.max(1, items.reduce((s, i) => s + (Number(i.products?.greutate_kg) || 5) * i.cantitate, 0));
  const curier = curieri.find((c) => c.id === o.curier);
  const pasCurent = PASI.indexOf(o.status);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><Link href="/admin/comenzi" className="text-sm text-mut hover:text-acc">← Comenzi</Link>
          <h1 className="font-disp font-bold text-2xl">{o.numar}</h1>
          <span className="text-sm text-mut">{new Date(o.created_at).toLocaleString("ro-RO")}</span></div>
        <div className="flex gap-2">
          {o.status !== "anulata" && o.status !== "livrata" && (
            <button onClick={anuleaza} className="rounded-xl border-2 border-red-200 text-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-50">Anulează</button>)}
          <button onClick={stergeComanda} title="Doar administratorul; piesele revin pe stoc"
            className="rounded-xl border-2 border-line text-mut px-4 py-2 text-sm font-semibold hover:border-red-300 hover:text-red-600">Șterge</button>
        </div>
      </div>

      {/* Statusul — pași apăsabili */}
      <div className="card p-4">
        <div className="flex items-center gap-1 flex-wrap">
          {PASI.map((s, i) => (
            <button key={s} onClick={() => salveaza({ status: s })} disabled={o.status === "anulata"}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold border-2 transition
                ${o.status === s ? "border-acc bg-acc text-white" : i <= pasCurent ? "border-ok/40 bg-ok/5 text-ok" : "border-line text-mut hover:border-acc/40"}`}>
              {i < pasCurent && o.status !== "anulata" ? "✓ " : ""}{NUME[s]}</button>
          ))}
          {o.status === "anulata" && <span className="px-3.5 py-2 rounded-xl bg-red-100 text-red-600 text-sm font-bold">Anulată — piesele au fost republicate</span>}
        </div>
        <p className="text-xs text-mut mt-2">Apasă pe pasul următor pentru a avansa comanda — fiecare schimbare intră automat în jurnal.</p>
      </div>

      <div className="grid lg:grid-cols-[1.35fr,1fr] gap-4 items-start">
        <div className="space-y-4">
          {/* Produse */}
          <div className="card">
            <b className="font-disp font-semibold text-[13px] block px-5 py-3.5 border-b border-line">Produse — {items.length}</b>
            <div className="divide-y divide-line">
              {items.map((i) => (
                <div key={i.id} className="px-5 py-3 flex items-center gap-3 text-sm">
                  <div className="flex-1 min-w-0">
                    {i.products ? <Link href={`/piese/${i.products.slug}`} className="font-semibold hover:text-acc">{i.nume}</Link> : <b>{i.nume}</b>}
                    <div className="text-[11px] text-mut">
                      {i.products ? `OEM ${i.products.oem}` : ""}{i.products?.vehicles ? ` · din ${i.products.vehicles.nume} · ${i.products.vehicles.an}` : ""}
                    </div>
                  </div>
                  <span className="text-mut">×{i.cantitate}</span>
                  <b className="font-disp whitespace-nowrap">{lei(Number(i.pret) * i.cantitate)}</b>
                </div>
              ))}
            </div>
            <div className="px-5 py-3.5 border-t border-line text-sm space-y-1">
              <div className="flex justify-between text-mut"><span>Subtotal</span><span>{lei(Number(o.subtotal))}</span></div>
              {Number(o.discount_valoare) > 0 && <div className="flex justify-between text-ok"><span>Reducere {o.discount_cod}</span><span>−{lei(Number(o.discount_valoare))}</span></div>}
              <div className="flex justify-between text-mut"><span>Livrare — {curier?.nume ?? o.curier}</span><span>{lei(Number(o.livrare))}</span></div>
              <div className="flex justify-between text-base"><b>Total {o.plata === "ramburs" ? "(ramburs la livrare)" : "(transfer bancar)"}</b>
                <b className="font-disp text-xl text-acc">{lei(Number(o.total))}</b></div>
            </div>
          </div>

          {/* Jurnalul */}
          <div className="card">
            <b className="font-disp font-semibold text-[13px] block px-5 py-3.5 border-b border-line">Istoricul acțiunilor (jurnal)</b>
            <div className="divide-y divide-line max-h-80 overflow-y-auto">
              {events.map((e) => (
                <div key={e.id} className="px-5 py-2.5 text-sm flex gap-3">
                  <span className="text-mut text-xs whitespace-nowrap w-32 shrink-0">{new Date(e.created_at).toLocaleString("ro-RO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="min-w-0">{e.mesaj} <span className="text-mut text-xs">· {e.autor}</span></span>
                </div>
              ))}
              {events.length === 0 && <p className="px-5 py-4 text-sm text-mut">Jurnalul e gol (comenzile plasate după rularea admin.sql se jurnalizează automat).</p>}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Client */}
          <div className="card p-5 text-sm">
            <b className="font-disp font-semibold text-[13px]">Client</b>
            <p className="mt-2"><b>{o.firma ?? o.nume}</b> · {o.tip_client === "firma" ? `firmă (CUI ${o.cui})` : "persoană fizică"}</p>
            <p className="text-mut">{o.adresa}, {o.oras}, jud. {o.judet}</p>
            <p className="mt-1">{o.telefon} · {o.email}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <a href={waLinkCu(o.telefon.replace(/^0/, "4"),
                `Bună ziua, ${o.nume}! Confirmăm comanda ${o.numar} de pe autopas.ro:\n` +
                items.map((i) => `• ${i.nume} — ${Number(i.pret)} lei`).join("\n") +
                `\nTotal: ${Number(o.total)} lei (${o.plata === "ramburs" ? "ramburs la livrare" : "transfer bancar"}).\n` +
                `Livrare prin ${curier?.nume ?? o.curier} în 1–3 zile lucrătoare. Vă mulțumim!`)}
                target="_blank" rel="noopener noreferrer" className="rounded-xl bg-[#25D366] text-white px-3.5 py-2 text-xs font-bold">
                Trimite confirmarea pe WhatsApp</a>
              <a href={`https://wa.me/4${o.telefon.replace(/\D/g, "")}?text=${encodeURIComponent(`Bună ziua! Vă contactăm de la Autopas Dezmembrări în legătură cu comanda ${o.numar}.`)}`}
                target="_blank" rel="noopener noreferrer" className="rounded-xl bg-[#25D366] text-white px-3.5 py-2 text-xs font-bold">WhatsApp</a>
              <a href={`mailto:${o.email}?subject=Comanda ${o.numar} — Autopas Dezmembrări`} className="rounded-xl bg-ink text-white px-3.5 py-2 text-xs font-bold">E-mail</a>
              <a href={`tel:${o.telefon}`} className="rounded-xl border-2 border-line px-3.5 py-2 text-xs font-bold">Sună</a>
            </div>
          </div>

          {/* Facturare — fluxul Saga */}
          <div className="card p-5 text-sm">
            <b className="font-disp font-semibold text-[13px]">Facturare (Saga)</b>
            <p className="text-xs text-mut mt-1">Emiți factura în Saga, apoi notezi seria aici — apare în exportul CSV și în evidență.</p>
            <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget);
              salveaza({ factura_serie: f.get("serie") || null, factura_status: f.get("serie") ? "emisa" : "de_emis" },
                f.get("serie") ? `Factura ${f.get("serie")} notată ca emisă` : undefined); }}
              className="mt-3 flex gap-2">
              <input name="serie" defaultValue={o.factura_serie ?? ""} placeholder="ex. AUTP-0912"
                className="flex-1 rounded-xl border-2 border-line px-3 py-2 outline-none focus:border-acc" />
              <button className="btn-dark !py-2 !px-4 text-xs">Salvează</button>
            </form>
            <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-[11px] font-bold ${o.factura_status === "emisa" ? "bg-ok/10 text-ok" : "bg-paper text-mut"}`}>
              {o.factura_status === "emisa" ? `Emisă — ${o.factura_serie}` : "De emis"}</span>
          </div>

          {/* Expediere */}
          <div className="card p-5 text-sm">
            <b className="font-disp font-semibold text-[13px]">Expediere</b>
            <div className="mt-2 space-y-1 text-mut">
              <div className="flex justify-between"><span>Curier</span><b className="text-ink">{curier?.nume ?? o.curier}{o.plata === "ramburs" ? " — ramburs" : ""}</b></div>
              <div className="flex justify-between"><span>Greutate estimată (din piese)</span><b className="text-ink">{greutate.toFixed(1)} kg</b></div>
              <div className="flex justify-between"><span>AWB</span>{o.awb ? <b className="text-ok">{o.awb}</b> : <span>negenerat</span>}</div>
            </div>
            {!o.awb && (<>
              <button onClick={genereazaAwb} className="btn-acc w-full mt-3 !py-2.5 text-sm">Generează AWB automat</button>
              <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const v = String(f.get("awb") || "").trim();
                if (v) salveaza({ awb: v, awb_generat_la: new Date().toISOString() }, `AWB ${v} introdus manual`); }}
                className="mt-2 flex gap-2">
                <input name="awb" placeholder="…sau scrie AWB-ul manual" className="flex-1 rounded-xl border-2 border-line px-3 py-2 outline-none focus:border-acc" />
                <button className="rounded-xl border-2 border-line px-3 text-xs font-bold hover:border-acc">OK</button>
              </form>
            </>)}
          </div>

          {/* Notă internă */}
          <div className="card p-5 text-sm">
            <b className="font-disp font-semibold text-[13px]">Notă internă <span className="font-normal text-mut">(doar echipa o vede)</span></b>
            <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget);
              salveaza({ nota_interna: f.get("nota") || null }, "Notă internă actualizată"); }}>
              <textarea name="nota" rows={3} defaultValue={o.nota_interna ?? ""}
                className="w-full mt-2 rounded-xl border-2 border-line px-3 py-2 outline-none focus:border-acc"
                placeholder="ex. clientul ridică personal sâmbătă / verificat telefonic" />
              <button className="btn-dark w-full mt-2 !py-2 text-xs">Salvează nota</button>
            </form>
          </div>
          {msg && <p className="text-sm text-red-600">{msg}</p>}
        </div>
      </div>
    </div>
  );
}
