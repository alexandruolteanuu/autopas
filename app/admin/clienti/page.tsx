"use client";
// CLIENȚI — agregați automat din comenzi (fără tabelă separată): cine cumpără, cât, când.
import { useEffect, useState } from "react";
import Link from "next/link";
import { sbBrowser } from "@/lib/supabase";
import { lei } from "@/lib/format";

type Client = { email: string; nume: string; telefon: string; oras: string; tip: string; cui: string | null;
  comenzi: number; valoare: number; ultima: string; ids: { id: number; numar: string; total: number; status: string; created_at: string }[] };

export default function Clienti() {
  const [clienti, setClienti] = useState<Client[]>([]);
  const [q, setQ] = useState("");
  const [tip, setTip] = useState<"toti" | "pf" | "firma">("toti");
  const [deschis, setDeschis] = useState<string | null>(null);

  useEffect(() => {
    const sb = sbBrowser(); if (!sb) return;
    (async () => {
      const { data } = await sb.from("orders").select("id,numar,nume,email,telefon,oras,tip_client,cui,firma,total,status,created_at")
        .neq("status", "anulata").order("created_at", { ascending: false });
      const m = new Map<string, Client>();
      ((data ?? []) as any[]).forEach((o) => {
        const k = (o.email || "").toLowerCase();
        const c: Client = m.get(k) ?? { email: o.email, nume: o.firma ?? o.nume, telefon: o.telefon, oras: o.oras,
          tip: o.tip_client, cui: o.cui, comenzi: 0, valoare: 0, ultima: o.created_at, ids: [] as Client["ids"] };
        c.comenzi++; c.valoare += Number(o.total);
        c.ids.push({ id: o.id, numar: o.numar, total: Number(o.total), status: o.status, created_at: o.created_at });
        if (new Date(o.created_at) > new Date(c.ultima)) c.ultima = o.created_at;
        m.set(k, c);
      });
      setClienti(Array.from(m.values()).sort((a, b) => b.valoare - a.valoare));
    })();
  }, []);

  const filtrati = clienti.filter((c) =>
    (tip === "toti" || c.tip === tip) &&
    (!q.trim() || [c.nume, c.email, c.telefon, c.oras].join(" ").toLowerCase().includes(q.toLowerCase())));

  const zileDe = (d: string) => Math.round((Date.now() - new Date(d).getTime()) / 86400000);

  return (
    <div className="space-y-4">
      <div><div className="dim">Administrare</div><h1 className="font-disp font-bold text-2xl mt-1">Clienți</h1>
        <p className="text-sm text-mut mt-1">Construiți automat din comenzi. Clienții fideli (3+ comenzi) și cei inactivi (60+ zile) sunt marcați.</p></div>

      <div className="flex flex-wrap gap-2 items-center text-sm">
        {([["toti", "Toți"], ["pf", "Persoane fizice"], ["firma", "Firme (B2B)"]] as const).map(([id, t]) => (
          <button key={id} onClick={() => setTip(id)} className={`rounded-full border-2 px-3.5 py-1.5 font-semibold ${tip === id ? "border-acc bg-acc/5 text-acc" : "border-line"}`}>
            {t} ({id === "toti" ? clienti.length : clienti.filter((c) => c.tip === id).length})</button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Caută client, e-mail, telefon…"
          className="ml-auto rounded-xl border-2 border-line px-3.5 py-1.5 outline-none focus:border-acc min-w-[220px]" />
      </div>

      <div className="card divide-y divide-line">
        {filtrati.map((c) => (
          <div key={c.email}>
            <button onClick={() => setDeschis(deschis === c.email ? null : c.email)} className="w-full text-left px-4 py-3 flex items-center gap-3 text-sm hover:bg-paper">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <b>{c.nume}</b>
                  {c.tip === "firma" && <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700">B2B{c.cui ? ` · ${c.cui}` : ""}</span>}
                  {c.comenzi >= 3 && <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-ok/10 text-ok">client fidel</span>}
                  {zileDe(c.ultima) > 60 && <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-yellow-100 text-yellow-700">inactiv {zileDe(c.ultima)} zile</span>}
                </div>
                <div className="text-[11px] text-mut">{c.email} · {c.telefon} · {c.oras}</div>
              </div>
              <span className="text-mut text-xs whitespace-nowrap">{c.comenzi} {c.comenzi === 1 ? "comandă" : "comenzi"}</span>
              <b className="font-disp text-acc whitespace-nowrap">{lei(c.valoare)}</b>
            </button>
            {deschis === c.email && (
              <div className="px-4 pb-4 space-y-1.5">
                <div className="flex gap-2 mb-2">
                  <a href={`https://wa.me/4${c.telefon.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-[#25D366] text-white px-3 py-1.5 text-[11px] font-bold">WhatsApp</a>
                  <a href={`mailto:${c.email}`} className="rounded-lg bg-ink text-white px-3 py-1.5 text-[11px] font-bold">E-mail</a>
                </div>
                {c.ids.map((o) => (
                  <Link key={o.id} href={`/admin/comenzi/${o.id}`} className="flex items-center gap-3 text-sm py-1.5 border-t border-line hover:text-acc">
                    <b className="font-disp w-32">{o.numar}</b>
                    <span className="text-mut text-xs flex-1">{new Date(o.created_at).toLocaleDateString("ro-RO")} · {o.status}</span>
                    <b>{lei(o.total)}</b>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
        {filtrati.length === 0 && <p className="p-8 text-center text-mut text-sm">Niciun client încă.</p>}
      </div>
    </div>
  );
}
