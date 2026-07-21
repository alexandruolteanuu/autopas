"use client";
// CEREREA = AUR. Inbox unificat: caut o piesă / predă mașina + Rabla / retururi / contact.
// Fiecare cerere are status (nouă → în lucru → rezolvată/respinsă), notă internă și contact rapid.
import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { sbBrowser } from "@/lib/supabase";

type Tab = "piese" | "predare" | "retur" | "contact";
const TABURI: { id: Tab; t: string; tabel: string }[] = [
  { id: "piese", t: "Caut o piesă", tabel: "part_requests" },
  { id: "predare", t: "Predare / Rabla", tabel: "car_intake_requests" },
  { id: "retur", t: "Retururi", tabel: "return_requests" },
  { id: "contact", t: "Mesaje contact", tabel: "contact_messages" },
];
const ST: Record<string, [string, string]> = {
  noua: ["Nouă", "bg-acc/10 text-acc"], in_lucru: ["În lucru", "bg-blue-100 text-blue-700"],
  rezolvata: ["Rezolvată", "bg-ok/10 text-ok"], respinsa: ["Respinsă", "bg-paper text-mut"],
};

function CereriInner() {
  const sp = useSearchParams();
  const [tab, setTab] = useState<Tab>((sp.get("tab") as Tab) ?? "piese");
  const [rows, setRows] = useState<any[]>([]);
  const [contor, setContor] = useState<Record<Tab, number>>({ piese: 0, predare: 0, retur: 0, contact: 0 });
  const [doarNoi, setDoarNoi] = useState(false);

  const tabel = TABURI.find((t) => t.id === tab)!.tabel;

  const incarca = useCallback(async () => {
    const sb = sbBrowser(); if (!sb) return;
    let q = sb.from(tabel).select("*").order("created_at", { ascending: false }).limit(100);
    if (doarNoi) q = q.eq("status", "noua");
    setRows((await q).data ?? []);
    const c: any = {};
    for (const t of TABURI) c[t.id] = (await sb.from(t.tabel).select("id", { count: "exact", head: true }).eq("status", "noua")).count ?? 0;
    setContor(c);
  }, [tabel, doarNoi]);
  useEffect(() => { incarca(); }, [incarca]);

  async function setStatus(id: number, status: string) {
    const sb = sbBrowser()!; await sb.from(tabel).update({ status }).eq("id", id); incarca();
  }
  async function salveazaNota(id: number, nota: string) {
    const sb = sbBrowser()!; await sb.from(tabel).update({ nota: nota || null }).eq("id", id);
  }

  return (
    <div className="space-y-4">
      <div><div className="dim">Administrare</div><h1 className="font-disp font-bold text-2xl mt-1">Cereri (Inbox)</h1>
        <p className="text-sm text-mut mt-1">Fiecare cerere netratată e un client pierdut — iar cererile agregate îți spun ce mașini merită cumpărate la dezmembrat.</p></div>

      <div className="flex flex-wrap gap-2 items-center">
        {TABURI.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-semibold border-2 ${tab === t.id ? "border-acc bg-acc/5 text-acc" : "border-line hover:border-acc/40"}`}>
            {t.t}{contor[t.id] > 0 && <span className="ml-1.5 bg-acc text-white text-[11px] font-bold rounded-full px-1.5 py-0.5">{contor[t.id]}</span>}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-sm text-mut cursor-pointer">
          <input type="checkbox" checked={doarNoi} onChange={(e) => setDoarNoi(e.target.checked)} /> doar cele noi
        </label>
      </div>

      <div className="space-y-3">
        {rows.map((r) => {
          const [sT, sC] = ST[r.status] ?? [r.status, "bg-paper"];
          const tel = (r.telefon ?? "").replace(/\D/g, "");
          return (
            <div key={r.id} className="card p-4">
              <div className="flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-[240px] text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <b>{r.nume}</b>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${sC}`}>{sT}</span>
                    <span className="text-xs text-mut">{new Date(r.created_at).toLocaleString("ro-RO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    {tab === "predare" && <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-yellow-100 text-yellow-700">{r.tip === "rabla" ? "RABLA" : "predare"}</span>}
                  </div>
                  {tab === "piese" && <p className="mt-1.5"><b>{r.piesa}</b> pentru <b>{r.masina}</b>{r.mesaj ? <span className="text-mut"> — {r.mesaj}</span> : null}</p>}
                  {tab === "predare" && <p className="mt-1.5"><b>{r.masina}</b>{r.an ? ` · ${r.an}` : ""}{r.vin ? ` · VIN ${r.vin}` : ""}{r.mesaj ? <span className="text-mut"> — {r.mesaj}</span> : null}</p>}
                  {tab === "retur" && <p className="mt-1.5">Comanda <b>{r.numar_comanda}</b> · {r.produs} — <span className="text-mut">{r.motiv}</span>{r.iban ? <span className="text-mut"> · IBAN {r.iban}</span> : null}</p>}
                  {tab === "contact" && <p className="mt-1.5 text-mut">{r.mesaj}</p>}
                  <p className="text-xs text-mut mt-1">{r.telefon ?? ""}{r.email ? ` · ${r.email}` : ""}{r.sursa ? ` · sursa: ${r.sursa}` : ""}</p>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <div className="flex gap-1.5">
                    {tel && <a href={`https://wa.me/4${tel}`} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-[#25D366] text-white px-2.5 py-1.5 text-[11px] font-bold">WhatsApp</a>}
                    {tel && <a href={`tel:${r.telefon}`} className="rounded-lg border-2 border-line px-2.5 py-1.5 text-[11px] font-bold">Sună</a>}
                    {r.email && <a href={`mailto:${r.email}`} className="rounded-lg bg-ink text-white px-2.5 py-1.5 text-[11px] font-bold">E-mail</a>}
                  </div>
                  <div className="flex gap-1.5">
                    {r.status === "noua" && <button onClick={() => setStatus(r.id, "in_lucru")} className="rounded-lg border-2 border-blue-200 text-blue-700 px-2.5 py-1.5 text-[11px] font-bold hover:bg-blue-50">Preiau</button>}
                    {r.status !== "rezolvata" && <button onClick={() => setStatus(r.id, "rezolvata")} className="rounded-lg border-2 border-ok/40 text-ok px-2.5 py-1.5 text-[11px] font-bold hover:bg-ok/5">Rezolvată ✓</button>}
                    {tab !== "contact" && r.status !== "respinsa" && r.status !== "rezolvata" &&
                      <button onClick={() => setStatus(r.id, "respinsa")} className="rounded-lg border-2 border-line text-mut px-2.5 py-1.5 text-[11px] font-bold hover:border-red-200 hover:text-red-500">Respinge</button>}
                  </div>
                </div>
              </div>
              <input defaultValue={r.nota ?? ""} onBlur={(e) => salveazaNota(r.id, e.target.value)}
                placeholder="Notă internă (se salvează automat la ieșirea din câmp)…"
                className="mt-3 w-full rounded-xl border-2 border-line px-3 py-2 text-sm outline-none focus:border-acc bg-paper/50" />
            </div>
          );
        })}
        {rows.length === 0 && <div className="card p-10 text-center text-mut text-sm">Nicio cerere aici{doarNoi ? " (filtrul «doar noi» e activ)" : ""}. ✓</div>}
      </div>
    </div>
  );
}

export default function Cereri() {
  return <Suspense fallback={<div className="text-mut">Se încarcă…</div>}><CereriInner /></Suspense>;
}
