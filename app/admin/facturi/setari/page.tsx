"use client";
// FACTURI → SETĂRI SERIE (pasul 4 din docs/saga-plan.md, 10 noiembrie 2026).
//
// Seria și numărul de start ale facturilor emise DIN APLICAȚIE. Decizia
// proprietarului: aplicația continuă seria existentă din SAGA („PAP FE”), fără
// serie separată, iar numărul de start se setează abia în ZIUA PORNIRII —
// ultimul număr emis manual + 1 („Procedura de pornire” din plan).
//
// Nicio serie și niciun număr nu sunt scrise aici sau în bază dinainte: le
// scrie omul, în ziua pornirii. Salvarea cere o bifă de confirmare explicită;
// regula care contează (numărul nu poate coborî sub ce s-a emis deja) e a bazei,
// în `seteaza_serie_factura`.
//
// Accesul: adminul și contabilul (RLS pe `facturi_serii` + verificarea din funcție).
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { sbBrowser } from "@/lib/supabase";
import type { FacturaSerie, FacturaSerieIstoric } from "@/lib/types";

export default function SetariSerie() {
  const [serii, setSerii] = useState<FacturaSerie[]>([]);
  const [ultimele, setUltimele] = useState<Record<string, number>>({});
  const [istoric, setIstoric] = useState<FacturaSerieIstoric[]>([]);
  const [incarcat, setIncarcat] = useState(false);
  const [eroareCitire, setEroareCitire] = useState("");

  const [serie, setSerie] = useState("");
  const [urmator, setUrmator] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [lucru, setLucru] = useState(false);
  const [msg, setMsg] = useState<{ bun: boolean; text: string } | null>(null);

  const incarca = useCallback(async () => {
    const sb = sbBrowser(); if (!sb) return;
    const [s, i] = await Promise.all([
      sb.from("facturi_serii").select("*").order("serie"),
      sb.from("facturi_serii_istoric").select("*").order("id", { ascending: false }).limit(20),
    ]);
    if (s.error || i.error) {
      setEroareCitire((s.error ?? i.error)!.message);
      setIncarcat(true);
      return;
    }
    // Cel mai mare număr emis din aplicație, pe fiecare serie. Puține serii,
    // deci o citire pe serie e mai simplă decât o funcție nouă în bază.
    const maxim: Record<string, number> = {};
    for (const r of (s.data ?? []) as FacturaSerie[]) {
      const { data } = await sb.from("facturi").select("numar").eq("serie", r.serie)
        .order("numar", { ascending: false }).limit(1);
      if (data && data.length) maxim[r.serie] = data[0].numar as number;
    }
    setSerii((s.data ?? []) as FacturaSerie[]);
    setUltimele(maxim);
    setIstoric((i.data ?? []) as FacturaSerieIstoric[]);
    setIncarcat(true);
  }, []);
  useEffect(() => { incarca(); }, [incarca]);

  const serieCurata = serie.trim();
  const numar = /^\d+$/.test(urmator.trim()) ? Number(urmator.trim()) : NaN;
  const valid = serieCurata !== "" && serieCurata.length <= 20 && Number.isInteger(numar) && numar >= 1;
  // Textul confirmării se calculează din ce s-a scris: omul confirmă EXACT
  // numărul ultimei facturi manuale, nu o formulă generală.
  const textConfirmare = valid
    ? `Confirm că ultima factură pe ${serieCurata} — din aplicație sau emisă manual în SAGA — are numărul ${numar - 1}, deci următoarea primește ${numar}.`
    : "Completează seria și numărul următor ca să apară textul de confirmat.";

  // Orice schimbare a seriei sau a numărului scoate bifa: confirmarea e pentru valorile de acum.
  useEffect(() => { setConfirm(false); }, [serie, urmator]);

  async function salveaza(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || !confirm) return;
    const sb = sbBrowser(); if (!sb) return;
    setLucru(true); setMsg(null);
    const { data, error } = await sb.rpc("seteaza_serie_factura", { p_serie: serieCurata, p_urmator: numar });
    setLucru(false);
    if (error) { setMsg({ bun: false, text: `NU s-a salvat: ${error.message}` }); return; }
    const r = data as { serie: string; urmator: number };
    setMsg({ bun: true, text: `✓ Seria activă: ${r.serie}. Următoarea factură emisă din aplicație primește numărul ${r.urmator}.` });
    setSerie(""); setUrmator(""); setConfirm(false);
    incarca();
  }

  const activa = serii.find((s) => s.activa) ?? null;

  // Oprirea emiterii (pasul 6, migrarea 51): nicio serie activă. Folosită după o
  // probă pe o serie de test sau oricând trebuie oprită facturarea din aplicație.
  async function opreste() {
    if (!activa || !window.confirm(`Oprești emiterea facturilor din aplicație? Seria „${activa.serie}” devine inactivă (numărul ${activa.urmator} se păstrează). Până la o nouă setare de serie nu se mai emite nicio factură.`)) return;
    const sb = sbBrowser(); if (!sb) return;
    setLucru(true); setMsg(null);
    const { error } = await sb.rpc("opreste_emiterea");
    setLucru(false);
    if (error) { setMsg({ bun: false, text: `NU s-a oprit: ${error.message}` }); return; }
    setMsg({ bun: true, text: "✓ Emiterea e oprită: nicio serie activă." });
    incarca();
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <div className="dim"><Link href="/admin/facturi" className="hover:text-acc">Facturi</Link> → Setări serie</div>
        <h1 className="font-disp font-bold text-2xl mt-1">Seria facturilor</h1>
        <p className="text-sm text-mut mt-1">
          Seria și numărul următoarei facturi emise din admin.
        </p>
      </div>

      {/* Regula din 11 noiembrie 2026 (docs/saga-plan.md, „Procedura de pornire”): facturarea manuală pe
          aceeași serie poate continua, cu numărul ținut la zi aici, de mână. */}
      <div className="card p-4 text-sm border-2 border-amber-300 bg-amber-50 text-amber-900">
        <b>Factură manuală în SAGA pe aceeași serie?</b>
        <ol className="list-decimal ml-5 mt-1 space-y-0.5">
          <li><b>Înainte</b>: verifică în SAGA că numărul propus e cel de după ultima factură din aplicație
            {activa ? <> (azi: <b>{activa.serie} {activa.urmator}</b> e următorul liber)</> : null}.</li>
          <li><b>Imediat după</b>: actualizează aici „Numărul următoarei facturi” = numărul facturii manuale + 1.</li>
        </ol>
        <p className="text-xs mt-1">Altfel, aplicația și SAGA pot da același număr la două facturi. Stornările pe această serie se fac din aplicație.</p>
      </div>

      {eroareCitire && <div className="card p-3 text-sm border-2 border-red-300 bg-red-50 text-red-800">
        Nu pot citi seriile: {eroareCitire}. (Pagina e pentru administrator și contabil.)</div>}

      <div className="card p-5 text-sm">
        <b className="font-disp font-semibold text-[13px]">Seria activă</b>
        {!incarcat ? <p className="text-mut mt-2">Se încarcă…</p>
          : activa ? (
            <p className="mt-2">
              <b className="font-disp text-lg">{activa.serie}</b> — următoarea factură primește numărul{" "}
              <b className="font-disp text-lg">{activa.urmator}</b>
              {ultimele[activa.serie] !== undefined && <span className="text-mut"> (ultima emisă din aplicație: {ultimele[activa.serie]})</span>}
            </p>
          ) : null}
        {incarcat && activa && (
          <button type="button" onClick={opreste} disabled={lucru}
            className="mt-3 rounded-xl border-2 border-red-200 text-red-600 px-4 py-2 text-xs font-semibold hover:bg-red-50">
            Oprește emiterea (nicio serie activă)</button>
        )}
        {incarcat && !activa && (
            <p className="mt-2 text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2">
              Nicio serie activă: din admin nu se emite nicio factură până nu setezi una mai jos.
            </p>
          )}
      </div>

      <form onSubmit={salveaza} className="card p-5 grid gap-3 text-sm" autoComplete="off">
        <b className="font-disp font-semibold text-[13px]">Setează seria și numărul de start</b>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="fld"><label>Seria (exact ca în SAGA)</label>
            <input value={serie} onChange={(e) => setSerie(e.target.value)} maxLength={20} /></div>
          <div className="fld"><label>Numărul următoarei facturi</label>
            <input value={urmator} onChange={(e) => setUrmator(e.target.value)} inputMode="numeric" /></div>
        </div>
        <label className={`flex items-start gap-2 text-sm cursor-pointer rounded-xl border-2 px-3 py-2 ${confirm ? "border-ok/40 bg-ok/5" : "border-line"} ${valid ? "" : "opacity-60"}`}>
          <input type="checkbox" className="mt-1" checked={confirm} disabled={!valid}
            onChange={(e) => setConfirm(e.target.checked)} />
          <span>{textConfirmare}</span>
        </label>
        <button className="btn-acc" disabled={!valid || !confirm || lucru}>
          {lucru ? "Se salvează…" : "Salvează seria"}</button>
        {msg && <p className={`text-sm ${msg.bun ? "text-ok" : "text-red-700"}`}>{msg.text}</p>}
        <p className="text-[11px] text-mut">
          Un număr deja folosit de o factură din admin e refuzat.
        </p>
      </form>

      <div className="card p-5 text-sm">
        <b className="font-disp font-semibold text-[13px]">Istoric</b>
        {istoric.length === 0 ? <p className="text-mut mt-2">Nicio setare încă.</p> : (
          <ul className="mt-2 divide-y divide-line">
            {istoric.map((h) => (
              <li key={h.id} className="py-2 flex flex-wrap gap-x-3">
                <span className="text-mut">{new Date(h.facut_la).toLocaleString("ro-RO")}</span>
                <b>{h.serie}</b>
                <span>{h.actiune === "setare" ? `următorul număr: ${h.urmator}` : h.detalii}</span>
                {h.facut_de_email && <span className="text-mut">— {h.facut_de_email}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
