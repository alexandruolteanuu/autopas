"use client";
// FACTURI → ARTICOLE SAGA (pasul 5 din docs/saga-plan.md, 10 noiembrie 2026).
//
// Potrivirea categorie / subcategorie → articolul din gestiunea SAGA care apare
// pe factură (`CodArticolClient` + denumirea). Ordinea, aplicată de
// `emite_factura` (migrarea 50): subcategoria piesei → categoria ei → articolul
// implicit din Admin → Integrări → Saga. Numele complet al piesei de pe site
// merge oricum pe linie, în `InformatiiSuplimentare`.
//
// Pe factura reală toate piesele sunt pe un singur articol, „ACCESORII AUTO” —
// deci pagina pornește goală, iar „fără potrivire” = articolul implicit. Se
// completează doar dacă contabila vrea articole separate pe categorii.
//
// O potrivire schimbată NU atinge facturile deja emise: fiecare linie își are
// articolul copiat la emitere.
//
// Accesul: adminul și contabilul (RLS pe `saga_articole`).
//
// Pasul 9 (11 noiembrie 2026): „Verifică în SAGA” — un `GetArticol` pe cod, prin ruta
// /api/saga (DOAR citire; același lacăt și aceeași rotire a cheii ca orice apel SAGA),
// comparat cu denumirea și UM de la noi. „Verifică toate” le trimite pe rând, câte unul.
// În formular, „Verifică codul” poate prelua denumirea și UM din SAGA — tot fără salvare.
import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { sbBrowser, scrieVerificat } from "@/lib/supabase";

type Categorie = { id: number; nume: string; parent_id: number | null; nr_piese: number };
type Potrivire = { id: number; categorie_id: number; cod_articol: string; denumire: string; um: string };
type Implicit = { cod: string; denumire: string; um: string };
/** Răspunsul rutei `verifica-articol` (sau eroarea ei). */
type Verificare = {
  ok: boolean; eroare?: string; cod?: string; exista?: boolean; mesaj?: string;
  articol?: { denumire: string | null; um: string | null; tva: string | null };
  potrivit?: boolean; diferente?: string[]; informativ?: string[];
};

async function verificaInSaga(cod: string, denumire: string, um: string): Promise<Verificare> {
  const sb = sbBrowser();
  const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
  const r = await fetch("/api/saga", { method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
    body: JSON.stringify({ actiune: "verifica-articol", cod, denumire, um }) });
  return r.json().catch(() => ({ ok: false, eroare: `Răspuns neașteptat (HTTP ${r.status}).` }));
}

/** Rezultatul unei verificări, într-un rând. */
function RezultatSaga({ v }: { v?: Verificare | "lucru" }) {
  if (!v) return null;
  if (v === "lucru") return <p className="text-xs text-mut mt-1">Se verifică în SAGA…</p>;
  if (!v.ok) return <p className="text-xs text-red-700 mt-1">Verificarea n-a mers: {v.eroare}</p>;
  if (!v.exista) return <p className="text-xs text-red-700 mt-1">✗ Codul „{v.cod}” NU există în gestiunea SAGA ({v.mesaj}). Facturile cu el ar ieși pe un articol inexistent — verifică-l cu contabila.</p>;
  return (
    <div className={`text-xs mt-1 ${v.potrivit ? "text-ok" : "text-amber-800"}`}>
      {v.potrivit ? "✓" : "⚠"} În SAGA: <b>{v.articol?.denumire ?? "—"}</b> · {v.articol?.um ?? "—"}
      {v.diferente?.length ? <> — diferă {v.diferente.join("; ")}.</> : ""}
      {v.informativ?.length ? <span className="text-mut"> ({v.informativ.join("; ")})</span> : null}
    </div>
  );
}

export default function ArticoleSaga() {
  const [categorii, setCategorii] = useState<Categorie[]>([]);
  const [potriviri, setPotriviri] = useState<Record<number, Potrivire>>({});
  const [implicit, setImplicit] = useState<Implicit | null>(null);
  const [eroare, setEroare] = useState("");
  const [filtru, setFiltru] = useState("");
  const [incarcat, setIncarcat] = useState(false);
  // Rezultatele verificării în SAGA, după cod (pasul 9).
  const [rez, setRez] = useState<Record<string, Verificare | "lucru">>({});
  const [toate, setToate] = useState<{ facut: number; din: number } | null>(null);
  const verifica = useCallback(async (cod: string, denumire: string, um: string) => {
    setRez((v) => ({ ...v, [cod]: "lucru" }));
    const r = await verificaInSaga(cod, denumire, um);
    setRez((v) => ({ ...v, [cod]: r }));
    return r;
  }, []);

  const incarca = useCallback(async () => {
    const sb = sbBrowser(); if (!sb) return;
    const [c, p, s] = await Promise.all([
      sb.from("categorii_cu_numar").select("id,nume,parent_id,nr_piese").order("nume"),
      sb.from("saga_articole").select("id,categorie_id,cod_articol,denumire,um"),
      sb.from("settings").select("valoare").eq("cheie", "integrari").maybeSingle(),
    ]);
    if (c.error || p.error) { setEroare((c.error ?? p.error)!.message); setIncarcat(true); return; }
    setCategorii((c.data ?? []) as Categorie[]);
    const m: Record<number, Potrivire> = {};
    for (const r of (p.data ?? []) as Potrivire[]) m[r.categorie_id] = r;
    setPotriviri(m);
    const saga = (s.data?.valoare as any)?.saga ?? {};
    setImplicit(saga.articol_implicit
      ? { cod: String(saga.articol_implicit), denumire: String(saga.articol_implicit_denumire ?? ""), um: String(saga.articol_implicit_um || "BUC") }
      : null);
    setIncarcat(true);
  }, []);
  useEffect(() => { incarca(); }, [incarca]);

  // Arborele: categoriile-părinte, fiecare cu subcategoriile ei; cele cu mai multe piese întâi.
  const arbore = useMemo(() => {
    const f = filtru.trim().toLowerCase();
    const copii = new Map<number, Categorie[]>();
    for (const c of categorii) if (c.parent_id) copii.set(c.parent_id, [...(copii.get(c.parent_id) ?? []), c]);
    return categorii
      .filter((c) => !c.parent_id)
      .map((p) => ({ p, copii: (copii.get(p.id) ?? []).sort((a, b) => b.nr_piese - a.nr_piese) }))
      .filter(({ p, copii }) => !f || p.nume.toLowerCase().includes(f) || copii.some((c) => c.nume.toLowerCase().includes(f)))
      .sort((a, b) => b.p.nr_piese - a.p.nr_piese);
  }, [categorii, filtru]);

  const nrPotriviri = Object.keys(potriviri).length;

  // „Verifică toate”: implicitul + fiecare cod propriu, o singură dată pe cod, pe rând.
  async function verificaToate() {
    const lista = new Map<string, { denumire: string; um: string }>();
    if (implicit?.cod) lista.set(implicit.cod, { denumire: implicit.denumire, um: implicit.um });
    for (const p of Object.values(potriviri)) if (!lista.has(p.cod_articol)) lista.set(p.cod_articol, { denumire: p.denumire, um: p.um });
    const coduri = Array.from(lista.keys());
    setToate({ facut: 0, din: coduri.length });
    for (let i = 0; i < coduri.length; i++) {
      const x = lista.get(coduri[i])!;
      const r = await verifica(coduri[i], x.denumire, x.um);
      setToate({ facut: i + 1, din: coduri.length });
      // O cheie respinsă sau lipsă nu se repară la codul următor.
      if (!r.ok && /cheie|Cheia/.test(r.eroare ?? "")) break;
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="dim"><Link href="/admin/facturi" className="hover:text-acc">Facturi</Link> → Articole SAGA</div>
        <h1 className="font-disp font-bold text-2xl mt-1">Articolele din gestiunea SAGA</h1>
        <p className="text-sm text-mut mt-1">
          Ce articol din SAGA apare pe factură pentru piesele fiecărei categorii. Ordinea: subcategoria piesei,
          apoi categoria ei, apoi articolul implicit. Numele complet al piesei apare oricum pe linie. Codurile se
          scriu exact ca în SAGA — le dă contabila. Schimbările nu ating facturile deja emise.
        </p>
      </div>

      {eroare && <div className="card p-3 text-sm border-2 border-red-300 bg-red-50 text-red-800">
        Nu pot citi potrivirile: {eroare}. (Pagina e pentru admin și contabil; migrarea 50 trebuie să fie rulată.)</div>}

      <div className="card p-4 text-sm">
        <b className="font-disp font-semibold text-[13px]">Articolul implicit</b>{" "}
        <span className="text-mut">(pentru tot ce nu are potrivire mai jos)</span>
        {!incarcat ? <p className="text-mut mt-1">Se încarcă…</p>
          : implicit ? <>
              <p className="mt-1"><b>{implicit.denumire || "—"}</b> · cod <b>{implicit.cod}</b> · {implicit.um}
                <button type="button" onClick={() => verifica(implicit.cod, implicit.denumire, implicit.um)} disabled={rez[implicit.cod] === "lucru"}
                  className="ml-3 inline-flex items-center min-h-[44px] text-xs font-semibold text-acc hover:underline">Verifică în SAGA</button></p>
              <RezultatSaga v={rez[implicit.cod]} />
            </>
          : <p className="mt-1 text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2">
              Nesetat. Fără el nu se emite nicio factură. Se setează în Admin → Integrări → Saga (doar adminul);
              codul îl dă contabila.</p>}
        <p className="text-xs text-mut mt-2">{nrPotriviri === 0 ? "Nicio potrivire pe categorii: toate piesele merg pe articolul implicit." : `${nrPotriviri} categorii cu articol propriu.`}</p>
        {(implicit || nrPotriviri > 0) && (
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <button type="button" className="rounded-xl border-2 border-line px-3 py-1.5 text-xs font-bold hover:border-acc"
              disabled={!!toate && toate.facut < toate.din} onClick={verificaToate}>Verifică toate în SAGA</button>
            <span className="text-xs text-mut">{toate ? (toate.facut < toate.din ? `Se verifică ${toate.facut + 1} din ${toate.din}…` : `Gata: ${toate.din} ${toate.din === 1 ? "cod verificat" : "coduri verificate"}.`)
              : "Doar citire din SAGA (GetArticol): codul există? denumirea și UM sunt aceleași?"}</span>
          </div>
        )}
      </div>

      <input value={filtru} onChange={(e) => setFiltru(e.target.value)} placeholder="Caută o categorie…"
        className="w-full rounded-xl border-2 border-line px-3 py-2 text-sm outline-none focus:border-acc" />

      <div className="card divide-y divide-line">
        {arbore.map(({ p, copii }) => (
          <div key={p.id} className="p-3 space-y-2">
            <Rand c={p} potrivire={potriviri[p.id]} implicit={implicit} parinte={null} dupaSalvare={incarca} rez={rez} verifica={verifica} />
            {copii.map((c) => (
              <div key={c.id} className="pl-4 sm:pl-8 border-l-2 border-line">
                <Rand c={c} potrivire={potriviri[c.id]} implicit={implicit} parinte={potriviri[p.id] ?? null} dupaSalvare={incarca} rez={rez} verifica={verifica} />
              </div>
            ))}
          </div>
        ))}
        {incarcat && arbore.length === 0 && <p className="p-6 text-center text-mut text-sm">Nicio categorie găsită.</p>}
      </div>
    </div>
  );
}

/** Un rând: categoria, ce articol primește acum, și formularul de potrivire. */
function Rand({ c, potrivire, implicit, parinte, dupaSalvare, rez, verifica }: {
  c: Categorie; potrivire?: Potrivire; implicit: Implicit | null; parinte: Potrivire | null; dupaSalvare: () => void;
  rez: Record<string, Verificare | "lucru">; verifica: (cod: string, denumire: string, um: string) => Promise<Verificare>;
}) {
  // Verificarea din formular (codul scris acum, încă nesalvat).
  const [inForm, setInForm] = useState<Verificare | "lucru" | undefined>(undefined);
  const [deschis, setDeschis] = useState(false);
  const [cod, setCod] = useState(potrivire?.cod_articol ?? "");
  const [den, setDen] = useState(potrivire?.denumire ?? "");
  const [um, setUm] = useState(potrivire?.um ?? "BUC");
  const [lucru, setLucru] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setCod(potrivire?.cod_articol ?? ""); setDen(potrivire?.denumire ?? ""); setUm(potrivire?.um ?? "BUC");
  }, [potrivire]);

  // Ce articol primesc ACUM piesele categoriei: propriu, al părintelui sau implicitul.
  const efectiv = potrivire
    ? <span><b>{potrivire.denumire}</b> · {potrivire.cod_articol} · {potrivire.um}</span>
    : parinte
      ? <span className="text-mut">ca la categorie: {parinte.denumire} · {parinte.cod_articol}</span>
      : <span className="text-mut">implicit{implicit ? `: ${implicit.denumire || implicit.cod}` : " (nesetat)"}</span>;

  async function salveaza() {
    const sb = sbBrowser(); if (!sb) return;
    const v = { cod_articol: cod.trim(), denumire: den.trim(), um: um.trim() || "BUC" };
    if (!v.cod_articol || !v.denumire) { setMsg("Codul și denumirea sunt obligatorii."); return; }
    setLucru(true); setMsg("");
    if (potrivire) {
      // `scrieVerificat`: un UPDATE oprit de RLS nu ridică eroare (CLAUDE.md, 25 august 2026).
      const r = await scrieVerificat(sb.from("saga_articole")
        .update({ ...v, actualizat_la: new Date().toISOString() }).eq("id", potrivire.id));
      if (!r.ok) { setLucru(false); setMsg(`NU s-a salvat: ${r.eroare}`); return; }
    } else {
      const { error } = await sb.from("saga_articole").insert({ categorie_id: c.id, ...v });
      if (error) { setLucru(false); setMsg(`NU s-a salvat: ${error.message}`); return; }
    }
    setLucru(false); setDeschis(false); dupaSalvare();
  }

  async function sterge() {
    if (!potrivire) return;
    if (!confirm(`Scoți articolul propriu al categoriei „${c.nume}”? Piesele ei vor merge pe ${parinte ? "articolul categoriei-părinte" : "articolul implicit"}.`)) return;
    const sb = sbBrowser(); if (!sb) return;
    setLucru(true); setMsg("");
    const r = await scrieVerificat(sb.from("saga_articole").delete().eq("id", potrivire.id));
    setLucru(false);
    if (!r.ok) { setMsg(`NU s-a șters: ${r.eroare}`); return; }
    dupaSalvare();
  }

  return (
    <div className="text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <b className="font-disp">{c.nume}</b>
        <span className="text-xs text-mut">{c.nr_piese} piese</span>
        <span className="text-xs">→ {efectiv}</span>
        {potrivire && (
          <button type="button" onClick={() => verifica(potrivire.cod_articol, potrivire.denumire, potrivire.um)} disabled={rez[potrivire.cod_articol] === "lucru"}
            className="inline-flex items-center min-h-[44px] text-xs font-semibold text-acc hover:underline">Verifică în SAGA</button>)}
        <button type="button" onClick={() => setDeschis(!deschis)}
          className="ml-auto inline-flex items-center min-h-[44px] text-xs font-semibold text-acc hover:underline">
          {deschis ? "Închide" : potrivire ? "Modifică" : "Articol propriu"}</button>
      </div>
      {deschis && (
        <div className="mt-2 grid sm:grid-cols-[1fr,2fr,90px,auto] gap-2 items-end">
          <div className="fld"><label>Cod în SAGA</label><input value={cod} onChange={(e) => setCod(e.target.value)} /></div>
          <div className="fld"><label>Denumirea articolului în SAGA</label><input value={den} onChange={(e) => setDen(e.target.value)} /></div>
          <div className="fld"><label>UM</label><input value={um} onChange={(e) => setUm(e.target.value)} /></div>
          <div className="flex gap-2">
            <button type="button" className="btn-acc !py-2 text-xs" disabled={lucru} onClick={salveaza}>{lucru ? "…" : "Salvează"}</button>
            {potrivire && <button type="button" className="rounded-xl border-2 border-line px-3 py-2 text-xs font-semibold hover:border-red-400" disabled={lucru} onClick={sterge}>Scoate</button>}
          </div>
          <div className="sm:col-span-4 flex flex-wrap items-center gap-2">
            <button type="button" className="rounded-xl border-2 border-line px-3 py-1.5 text-xs font-semibold hover:border-acc"
              disabled={!cod.trim() || inForm === "lucru"}
              onClick={async () => { setInForm("lucru"); setInForm(await verificaInSaga(cod.trim(), den.trim(), um.trim())); }}>Verifică codul în SAGA</button>
            {inForm && inForm !== "lucru" && inForm.ok && inForm.exista && (!inForm.potrivit || !den.trim()) && (
              <button type="button" className="rounded-xl border-2 border-line px-3 py-1.5 text-xs font-semibold hover:border-acc"
                onClick={() => { setDen(inForm.articol?.denumire ?? den); setUm(inForm.articol?.um ?? um); setInForm(undefined); }}>
                Preia denumirea și UM din SAGA (apoi „Salvează”)</button>)}
          </div>
          <div className="sm:col-span-4"><RezultatSaga v={inForm} /></div>
        </div>
      )}
      {potrivire && <RezultatSaga v={rez[potrivire.cod_articol]} />}
      {msg && <p className="text-xs text-red-700 mt-1">{msg}</p>}
    </div>
  );
}
