"use client";
// FACTURI — registrul pentru fluxul cu Saga: emiți factura în Saga, notezi seria
// aici, exporți CSV-ul pentru contabil. (Integrarea prin API-ul SAGA WEB e în
// lucru, pe pași: docs/saga-plan.md.)
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { sbBrowser, scrieVerificat, citesteTot, citesteDupaIduri } from "@/lib/supabase";
import { lei } from "@/lib/format";
import type { OrderFull, SagaStatus } from "@/lib/types";
import { ETICHETE_STARE } from "@/components/admin/FacturaSaga";

export default function Facturi() {
  const azi = new Date().toISOString().slice(0, 10);
  const luna0 = new Date(); luna0.setDate(1);
  const [de, setDe] = useState(luna0.toISOString().slice(0, 10));
  const [pana, setPana] = useState(azi);
  const [filtru, setFiltru] = useState<"toate" | "de_emis" | "emisa">("toate");
  const [orders, setOrders] = useState<OrderFull[]>([]);
  // Mesaj de eroare pentru salvarea seriei. Până acum rezultatul se pierdea:
  // câmpul revenea la valoarea veche la reîncărcare, fără nicio explicație.
  const [msg, setMsg] = useState("");

  const incarca = useCallback(async () => {
    const sb = sbBrowser(); if (!sb) return;
    // PAGINAT. Exportul pentru Saga pleacă din lista asta: dacă intervalul are
    // peste 1.000 de comenzi, varianta veche lua primele 1.000 și scria un CSV
    // care arată perfect valid, dar e incomplet. La contabilitate ăsta nu mai e
    // un defect tehnic.
    const comenzi = await citesteTot<OrderFull>(() => {
      let q = sb.from("orders").select("*", { count: "exact" }).neq("status", "anulata")
        .gte("created_at", new Date(de + "T00:00:00").toISOString())
        .lte("created_at", new Date(pana + "T23:59:59").toISOString())
        .order("id");
      if (filtru !== "toate") q = q.eq("factura_status", filtru);
      return q;
    }, { eticheta: "comenzile pentru facturi" });
    setOrders(comenzi);
  }, [de, pana, filtru]);
  useEffect(() => { incarca(); }, [incarca]);

  // FACTURILE EMISE DIN APLICAȚIE (pasul 6 din docs/saga-plan.md), cu filtru pe starea
  // față de SAGA. Separat de lista comenzilor de mai jos, care rămâne registrul pentru
  // facturile emise manual și sursa exportului CSV.
  type Doc = { id: number; tip: string; serie: string; numar: number; data: string; total: number;
    saga_status: SagaStatus; order_id: number; client: Record<string, string | null> };
  const [docs, setDocs] = useState<Doc[]>([]);
  const [stare, setStare] = useState<"toate" | SagaStatus>("toate");
  // Pasul 10: facturile de PROBĂ ascunse (`facturi_ascunse`) lipsesc implicit din listă.
  const [ascunse, setAscunse] = useState<Set<number>>(new Set());
  const [aratAscunse, setAratAscunse] = useState(false);
  const incarcaDocs = useCallback(async () => {
    const sb = sbBrowser(); if (!sb) return;
    {
      const { data } = await sb.from("facturi_ascunse").select("factura_id");   // tabelă mică: doar probele
      setAscunse(new Set(((data ?? []) as { factura_id: number }[]).map((r) => r.factura_id)));
    }
    try {
      setDocs(await citesteTot<Doc>(() => {
        let q = sb.from("facturi").select("id,tip,serie,numar,data,total,saga_status,order_id,client", { count: "exact" })
          .order("id", { ascending: false });
        if (stare !== "toate") q = q.eq("saga_status", stare);
        return q;
      }, { eticheta: "facturile emise" }));
    } catch { setDocs([]); }   // migrarea 49 nerulată sau fără drept: secțiunea rămâne goală
  }, [stare]);
  useEffect(() => { incarcaDocs(); }, [incarcaDocs]);

  // „Trimite selectate” (pasul 8): câte o factură pe apel, pe rând — fiecare cerere
  // încape în 60 s, iar un răspuns privește o singură factură. Starea o decide serverul.
  const [alese, setAlese] = useState<Set<number>>(new Set());
  const [trimit, setTrimit] = useState<{ facut: number; din: number; rezultate: string[] } | null>(null);
  const deTrimis = (d: Doc) => d.saga_status === "de_trimis" || d.saga_status === "eroare";
  const vizibile = aratAscunse ? docs : docs.filter((d) => !ascunse.has(d.id));
  function bifeaza(id: number) {
    setAlese((v) => { const n = new Set(v); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  async function trimiteSelectate() {
    const lista = docs.filter((d) => alese.has(d.id) && deTrimis(d));
    if (!lista.length) return;
    if (!confirm(`Trimiți ${lista.length} ${lista.length === 1 ? "factură" : "facturi"} în SAGA, pe rând? După trimitere nu se mai modifică și nu se mai retrag aici.`)) return;
    const sb = sbBrowser();
    const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
    const rezultate: string[] = [];
    setTrimit({ facut: 0, din: lista.length, rezultate });
    for (let i = 0; i < lista.length; i++) {
      const d = lista[i];
      const r = await fetch("/api/saga", { method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ actiune: "trimite", factura_id: d.id }) });
      const j = await r.json().catch(() => ({ ok: false, eroare: `HTTP ${r.status}` }));
      rezultate.push(`${d.serie} ${d.numar}: ${!j.ok ? `NETRIMISĂ — ${j.eroare}` : j.stare === "eroare" ? `eroare — ${j.nota}` : j.stare === "confirmata" ? "importată și finalizată" : "încărcată (de validat în SAGA)"}`);
      setTrimit({ facut: i + 1, din: lista.length, rezultate: [...rezultate] });
      // O cheie respinsă sau setări lipsă nu se repară la factura următoare: ne oprim.
      if (!j.ok && (j.cod === "cheie_blocata" || j.cod === "config" || j.cod === "fara_cheie")) { rezultate.push("Oprit: problema de mai sus privește toate facturile."); break; }
    }
    setTrimit({ facut: lista.length, din: lista.length, rezultate: [...rezultate] });
    setAlese(new Set());
    incarcaDocs();
  }
  // Comenzile care au factură din aplicație: pe ele seria NU se mai scrie de mână
  // (ar strica oglinda pe care o scrie `emite_factura`).
  const [cuDocument, setCuDocument] = useState<Set<number>>(new Set());
  useEffect(() => {
    const sb = sbBrowser(); if (!sb) return;
    citesteTot<{ order_id: number }>(() => sb.from("facturi").select("order_id", { count: "exact" }).order("id"),
      { eticheta: "comenzile facturate din aplicație" })
      .then((r) => setCuDocument(new Set(r.map((x) => x.order_id)))).catch(() => setCuDocument(new Set()));
  }, [docs]);

  async function salveazaSerie(o: OrderFull, serie: string) {
    const sb = sbBrowser()!; setMsg("");
    // Seria facturii e legătura cu contabilitatea: dacă nu se scrie, comanda
    // rămâne „de emis" la nesfârșit, iar exportul pentru Saga pleacă incomplet.
    const r = await scrieVerificat(sb.from("orders")
      .update({ factura_serie: serie || null, factura_status: serie ? "emisa" : "de_emis" })
      .eq("id", o.id));
    if (!r.ok) setMsg(`Seria NU s-a salvat pentru ${o.numar}: ${r.eroare}`);
    incarca();
  }

  // EXPORTUL PENTRU SAGA (pasul 2 din docs/saga-plan.md, 10 noiembrie 2026).
  // Calculul NU se mai face aici. Până acum browserul împărțea la 1.19 — cota de
  // 19% scrisă în cod, depășită din august 2025 — și nu rotunjea baza. Acum
  // liniile vin gata calculate din `export_saga_linii` (migrarea 48): TVA-ul cu
  // `calculeaza_linie_tva`, la cota din Admin → Integrări → Saga (gol = 21%), iar
  // transportul facturabil cu `transport_facturabil` — aceleași funcții pe care le
  // va folosi factura, deci CSV-ul și factura nu pot ajunge la cifre diferite.
  //
  // Coloanele rămân în ACEEAȘI ordine ca înainte (contabila poate avea un import
  // configurat în Saga): doar „TVA 19%” devine „TVA”, iar „Cota TVA” se adaugă la
  // final.
  async function exportSaga() {
    const sb = sbBrowser()!; setMsg("");
    type Linie = { order_id: number; item_id: number; produs: string; cantitate: number;
      pret_cu_tva: number; pret_fara_tva: number; valoare: number; tva: number; total: number;
      cota: number; transport: number };
    let linii: Linie[];
    try {
      // În loturi de 200 de comenzi, fiecare paginat: o funcție care întoarce
      // rânduri e tăiată de PostgREST la 1.000, ca orice tabelă.
      linii = await citesteDupaIduri<Linie>(orders.map((o) => o.id),
        (lot) => sb.rpc("export_saga_linii", { p_order_ids: lot }, { count: "exact" }).order("item_id"),
        { eticheta: "liniile pentru Saga" });
    } catch (e: any) {
      // Cota greșită în setări, regimul marjă, sau migrarea 48 nerulată: exportul
      // se OPREȘTE cu motivul, nu pleacă un CSV calculat greșit.
      setMsg(`Exportul NU s-a făcut: ${e?.message ?? e}`);
      return;
    }
    const peComanda = new Map<number, Linie[]>();
    for (const l of linii) peComanda.set(l.order_id, [...(peComanda.get(l.order_id) ?? []), l]);

    const bani = (x: number) => Number(x).toFixed(2);
    const rows: (string | number)[][] = [["Numar comanda","Data","Serie factura","Client","CUI","Adresa","Oras","Judet","Email","Telefon","Produs","Cant","Pret cu TVA","Baza fara TVA","TVA","Curier","Cost livrare","Plata","Cota TVA"]];
    for (const o of orders) for (const l of peComanda.get(o.id) ?? []) {
      // „Pret cu TVA” e, ca și până acum, totalul LINIEI (preț × cantitate).
      rows.push([o.numar, new Date(o.created_at).toLocaleDateString("ro-RO"), o.factura_serie ?? "", o.firma ?? o.nume, o.cui ?? "-",
        o.adresa, o.oras, o.judet, o.email, o.telefon, l.produs, l.cantitate, bani(l.total), bani(l.valoare), bani(l.tva),
        o.curier, bani(l.transport), o.plata, String(Number(l.cota))]);
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
        <div className="flex flex-wrap gap-2">
          {/* Seria și numărul de start ale facturilor emise din aplicație (pasul 4 din docs/saga-plan.md). */}
          <Link href="/admin/facturi/setari" className="rounded-xl border-2 border-line px-4 py-2 text-sm font-semibold hover:border-acc">Setări serie</Link>
          <Link href="/admin/facturi/articole" className="rounded-xl border-2 border-line px-4 py-2 text-sm font-semibold hover:border-acc">Articole SAGA</Link>
          <button onClick={exportSaga} className="rounded-xl bg-ok/10 text-ok border-2 border-ok/30 px-4 py-2 text-sm font-semibold hover:bg-ok/20">Export Saga (CSV)</button>
        </div>
      </div>

      {msg && <div className="card p-3 text-sm border-2 border-red-300 bg-red-50 text-red-800">{msg}</div>}

      <div className="card p-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <b className="font-disp font-semibold text-[13px] mr-2">Facturi emise din aplicație</b>
          {(["toate", "de_trimis", "in_curs", "trimisa", "eroare", "confirmata"] as const).map((k) => (
            <button key={k} type="button" onClick={() => setStare(k)}
              className={`rounded-full border-2 px-3 py-1 text-xs font-semibold ${stare === k ? "border-acc bg-acc/5 text-acc" : "border-line"}`}>
              {k === "toate" ? "Toate" : ETICHETE_STARE[k]}</button>
          ))}
        </div>
        {ascunse.size > 0 && (
          <label className="flex items-center gap-2 text-xs mt-3 cursor-pointer w-fit">
            <input type="checkbox" checked={aratAscunse} onChange={(e) => setAratAscunse(e.target.checked)} />
            Arată și facturile de probă ascunse ({ascunse.size})</label>
        )}
        {vizibile.some(deTrimis) && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button type="button" className="btn-acc !py-1.5 text-xs" disabled={!!trimit && trimit.facut < trimit.din || !Array.from(alese).some((id) => docs.find((d) => d.id === id && deTrimis(d)))}
              onClick={trimiteSelectate}>Trimite selectate în SAGA{alese.size ? ` (${alese.size})` : ""}</button>
            <span className="text-xs text-mut">Se pot bifa doar facturile „de trimis” și cele cu eroare. Pleacă pe rând, câte una.</span>
          </div>
        )}
        {trimit && (
          <div className="mt-2 text-xs">
            <b>{trimit.facut < trimit.din ? `Se trimite ${trimit.facut + 1} din ${trimit.din}…` : `Gata: ${trimit.din} ${trimit.din === 1 ? "factură" : "facturi"}.`}</b>
            <ul className="mt-1 space-y-0.5">{trimit.rezultate.map((r, i) => <li key={i}>{r}</li>)}</ul>
          </div>
        )}
        {vizibile.length === 0 ? <p className="text-mut mt-3">Nicio factură{stare === "toate" ? " emisă din aplicație încă" : " în starea aleasă"}.</p> : (
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-sm md:min-w-[640px]">
              <thead><tr className="text-left text-mut text-xs border-b border-line">
                <th className="px-3 py-2"></th><th className="px-3 py-2">Factura</th><th className="px-3 py-2">Data</th><th className="px-3 py-2">Client</th>
                <th className="px-3 py-2">Total</th><th className="px-3 py-2">Stare</th></tr></thead>
              <tbody className="divide-y divide-line">
                {vizibile.map((d) => (
                  <tr key={d.id} className="hover:bg-paper">
                    <td className="px-3 py-2">{deTrimis(d) &&
                      <input type="checkbox" aria-label={`Alege ${d.serie} ${d.numar}`} checked={alese.has(d.id)} onChange={() => bifeaza(d.id)} />}</td>
                    <td className="px-3 py-2"><Link href={`/admin/facturi/${d.id}`} className="font-disp font-semibold hover:text-acc">
                      {d.tip === "storno" ? "Storno " : ""}{d.serie} {d.numar}</Link></td>
                    <td className="px-3 py-2 text-mut">{d.data.split("-").reverse().join(".")}</td>
                    <td className="px-3 py-2">{d.client?.firma || d.client?.nume}</td>
                    <td className="px-3 py-2 font-disp font-semibold">{lei(Number(d.total))}</td>
                    <td className="px-3 py-2 text-xs">{ETICHETE_STARE[d.saga_status]}{ascunse.has(d.id) && <span className="text-amber-800"> · ascunsă</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
        <table className="tabel-carduri w-full text-sm md:min-w-[720px]">
          <thead><tr className="text-left text-mut text-xs border-b border-line">
            <th className="px-4 py-3">Comandă</th><th className="px-4 py-3">Data</th><th className="px-4 py-3">Client</th>
            <th className="px-4 py-3">CUI</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Serie factură (din Saga)</th></tr></thead>
          <tbody className="divide-y divide-line">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-paper">
                <td data-eticheta="Comandă" className="px-4 py-3"><Link href={`/admin/comenzi/${o.id}`} className="font-disp font-semibold hover:text-acc">{o.numar}</Link></td>
                <td data-eticheta="Data" className="px-4 py-3 text-mut">{new Date(o.created_at).toLocaleDateString("ro-RO")}</td>
                <td data-eticheta="Client" className="px-4 py-3">{o.firma ?? o.nume}</td>
                <td data-eticheta="CUI" className="px-4 py-3 text-mut">{o.cui ?? "—"}</td>
                <td data-eticheta="Total" className="px-4 py-3 font-disp font-semibold">{lei(Number(o.total))}</td>
                <td className="px-4 py-3">
                  <input defaultValue={o.factura_serie ?? ""} placeholder="seria din SAGA"
                    disabled={cuDocument.has(o.id)} title={cuDocument.has(o.id) ? "Factură emisă din aplicație — seria nu se scrie de mână" : undefined}
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
