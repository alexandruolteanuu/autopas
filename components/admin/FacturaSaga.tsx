"use client";
// CARDUL „FACTURARE” DIN PAGINA COMENZII (pasul 6 din docs/saga-plan.md).
//
// Trei situații, în ordinea asta:
//   1. Comanda are o factură emisă din aplicație → o arată (serie, număr, stare,
//      total), cu link la pagina facturii; „Retrage” cât e netrimisă.
//   2. Comanda se poate factura din aplicație (rol admin/contabil, data de start
//      setată, comanda plasată în ziua de start sau după, nemarcată deja ca
//      facturată, neanulată) → „Emite factura”.
//   3. Altfel → câmpul MANUAL de serie, ca până acum (facturile emise direct în
//      SAGA), cu motivul pentru care emiterea din aplicație nu e disponibilă.
// Pasul 10b (migrarea 54): când TOATE facturile comenzii sunt stornate și fiecare storno
// e deja trimis în SAGA, sub listă apare „Emite factura nouă” (refacturarea după storno);
// cu un storno netrimis, motivul. Decizia finală e tot a lui `emite_factura`.
// Ascunderea butoanelor e doar comoditate: `emite_factura` din bază refuză oricum
// tot ce nu are voie (data de start, marcajul manual, seria, rolul).
// Pasul 13 (migrarea 60): „Emite factura” face totul într-o cerere — validare, număr,
// SAGA, verificare (lib/saga-browser.ts). Aceeași apăsare reia o factură rămasă „eroare” /
// „de verificat” / „de trimis”, cu același număr. Cât e „se_trimite”: spinner, starea la 2 s.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { sbBrowser } from "@/lib/supabase";
import { lei } from "@/lib/format";
import { emiteSiAsteapta, asteaptaFactura, textEmitere, type RaspunsEmitere } from "@/lib/saga-browser";
import type { OrderFull, SagaStatus } from "@/lib/types";

type Doc = { id: number; tip: string; storno_pentru: number | null; serie: string; numar: number; total: number; saga_status: SagaStatus; saga_eroare: string | null };

export const ETICHETE_STARE: Record<SagaStatus, string> = {
  de_trimis: "De trimis în SAGA", in_curs: "Se trimite…", trimisa: "Trimisă — așteaptă validarea în SAGA",
  eroare: "Eroare la trimitere", confirmata: "Confirmată în SAGA",
  se_trimite: "Se emite…", de_verificat: "De verificat",
};

/** Stările din care „Emite factura” reia o factură existentă (pasul 13). */
export const SE_REIA: SagaStatus[] = ["de_trimis", "eroare", "de_verificat", "in_curs"];

/** Ziua (ora României) în care a fost plasată comanda, ca AAAA-LL-ZZ. */
function ziuaRo(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(iso));
}

export default function FacturaSaga({ o, laSchimbare, salveazaManual }: {
  o: OrderFull; laSchimbare: () => void; salveazaManual: (serie: string) => void;
}) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [poateFactura, setPoateFactura] = useState(false);
  const [dataStart, setDataStart] = useState<string | null>(null);
  const [mentiune, setMentiune] = useState("");
  const [incarcat, setIncarcat] = useState(false);
  const [lucru, setLucru] = useState(false);
  const [msg, setMsg] = useState<{ bun: boolean; text: string; id?: number } | null>(null);

  const incarca = useCallback(async () => {
    const sb = sbBrowser(); if (!sb) return;
    const [d, rol, s] = await Promise.all([
      sb.from("facturi").select("id,tip,storno_pentru,serie,numar,total,saga_status,saga_eroare").eq("order_id", o.id).order("id"),
      sb.rpc("is_facturare"),
      sb.from("settings").select("valoare").eq("cheie", "integrari").maybeSingle(),
    ]);
    setDocs((d.data ?? []) as Doc[]);
    setPoateFactura(rol.data === true);
    setDataStart(((s.data?.valoare as any)?.saga?.data_start_facturare ?? "").trim() || null);
    setMentiune(String((s.data?.valoare as any)?.saga?.mentiune_plata ?? "").trim());
    setIncarcat(true);
  }, [o.id]);
  useEffect(() => { incarca(); }, [incarca]);

  async function termina(j: RaspunsEmitere) {
    const t = textEmitere(j);
    setLucru(false);
    setMsg({ bun: t.bun, text: t.text, id: t.bun ? j.id : undefined });
    await incarca(); laSchimbare();
  }

  async function emite(p: { order_id?: number; factura_id?: number }) {
    if (!confirm(`Emiți factura pentru comanda ${o.numar}?`)) return;
    setLucru(true); setMsg(null);
    await termina(await emiteSiAsteapta(p));
  }

  // O factură găsită „se_trimite” la deschidere (lucrează serverul / ceasul): doar așteptăm.
  const inLucru = docs.find((d) => d.saga_status === "se_trimite");
  useEffect(() => {
    if (!inLucru || lucru) return;
    setLucru(true);
    asteaptaFactura(inLucru.id).then(termina);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inLucru?.id]);

  async function retrage(doc: Doc) {
    const eStorno = doc.tip === "storno";
    if (!confirm(eStorno
      ? `Retragi stornoul ${doc.serie} ${doc.numar}? Se șterge, numărul ${doc.numar} se refolosește, iar factura stornată rămâne valabilă. Merge doar pentru ultimul document din serie, netrimis.`
      : `Retragi factura ${doc.serie} ${doc.numar}? Se șterge, iar numărul ${doc.numar} va fi folosit de următoarea factură. Merge doar pentru ultima factură din serie, netrimisă.`)) return;
    const sb = sbBrowser(); if (!sb) return;
    setLucru(true); setMsg(null);
    // Pasul 10: `retrage_factura` (49) refuză stornările; pentru ele există `retrage_storno` (53).
    const { error } = await sb.rpc(eStorno ? "retrage_storno" : "retrage_factura", { p_id: doc.id });
    setLucru(false);
    if (error) { setMsg({ bun: false, text: `NU s-a retras: ${error.message}` }); return; }
    setMsg({ bun: true, text: `✓ ${eStorno ? "Stornoul" : "Factura"} ${doc.serie} ${doc.numar} a fost ${eStorno ? "retras" : "retrasă"}.` });
    await incarca(); laSchimbare();
  }

  // Refacturarea după storno (pasul 10b): toate facturile au storno, toate stornările au plecat.
  const facturi = docs.filter((d) => d.tip === "factura");
  const stornari = docs.filter((d) => d.tip === "storno");
  const toateStornate = facturi.length > 0 && facturi.every((f) => stornari.some((s) => s.storno_pentru === f.id));
  const stornoNetrimis = stornari.find((s) => s.saga_status !== "trimisa" && s.saga_status !== "confirmata");
  const refacturare = !toateStornate || !poateFactura || o.status === "anulata" ? null
    : stornoNetrimis ? { poate: false, text: `Stornoul ${stornoNetrimis.serie} ${stornoNetrimis.numar} trebuie întâi trimis în SAGA — abia apoi se poate emite o factură nouă (un storno netrimis se mai poate retrage).` }
    : !dataStart ? { poate: false, text: "Data de start a facturării nu e setată — factura nouă nu se poate emite din aplicație." }
    : { poate: true, text: "Factura e stornată, iar stornoul e în SAGA: se poate emite o factură nouă, corectă." };

  // De ce nu se poate emite din aplicație (în ordinea în care ar refuza și baza).
  const plasata = ziuaRo(o.created_at);
  const motiv =
    !poateFactura ? "Emiterea din aplicație e doar pentru administrator și contabil."
    : o.status === "anulata" ? "Comanda e anulată."
    : !dataStart ? "Data de start a facturării din aplicație nu e setată — comenzile se facturează manual în SAGA."
    : plasata < dataStart ? `Comanda e plasată înainte de data de start a facturării (${dataStart.split("-").reverse().join(".")}) — se facturează manual în SAGA.`
    : (o.factura_serie || (o.factura_status ?? "de_emis") !== "de_emis") ? "Comanda e marcată deja ca facturată (manual)."
    : null;

  return (
    <div className="card p-5 text-sm">
      <b className="font-disp font-semibold text-[13px]">Facturare (Saga)</b>

      {!incarcat ? <p className="text-mut mt-2">Se încarcă…</p> : docs.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {docs.map((d) => (
            <li key={d.id} className="rounded-xl border-2 border-line p-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Link href={`/admin/facturi/${d.id}`} className="font-disp font-semibold hover:text-acc">
                  {d.tip === "storno" ? "Storno " : "Factura "}{d.serie} {d.numar}</Link>
                <span className="text-mut">{lei(Number(d.total))}</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${d.saga_status === "confirmata" ? "bg-ok/10 text-ok" : d.saga_status === "eroare" ? "bg-red-50 text-red-700" : "bg-paper text-mut"}`}>
                  {ETICHETE_STARE[d.saga_status]}</span>
              </div>
              {(d.saga_status === "eroare" || d.saga_status === "de_verificat") && d.saga_eroare &&
                <p className="text-xs text-red-700 mt-1">{d.saga_eroare}</p>}
              <div className="flex flex-wrap gap-2 mt-2">
                <Link href={`/admin/facturi/${d.id}`} className="rounded-xl border-2 border-line px-3 py-1.5 text-xs font-semibold hover:border-acc">Deschide factura</Link>
                {SE_REIA.includes(d.saga_status) && poateFactura &&
                  <button type="button" disabled={lucru} onClick={() => emite({ factura_id: d.id })}
                    className="btn-acc !py-1.5 text-xs">{lucru ? "Se emite…" : "Emite factura"}</button>}
                {d.saga_status === "de_trimis" && poateFactura &&
                  <button type="button" disabled={lucru} onClick={() => retrage(d)}
                    className="rounded-xl border-2 border-line px-3 py-1.5 text-xs font-semibold hover:border-red-400">Retrage</button>}
              </div>
            </li>
          ))}
          {refacturare && (
            <li className="text-xs">
              <p className={refacturare.poate ? "text-mut" : "text-amber-800"}>{refacturare.text}</p>
              {refacturare.poate && <button type="button" className="btn-acc mt-2 !py-2 text-xs" disabled={lucru} onClick={() => emite({ order_id: o.id })}>
                {lucru ? "Se emite…" : "Emite factura nouă"}</button>}
            </li>
          )}
        </ul>
      ) : !motiv ? (
        <div className="mt-3">
          {!mentiune && <p className="text-xs text-amber-800 mb-1">⚠ Mențiunea de plată (Integrări → Saga) e goală — factura ar ieși fără „ramburs in cont”.</p>}
          <button type="button" className="btn-acc !py-2 text-xs" disabled={lucru} onClick={() => emite({ order_id: o.id })}>
            {lucru ? "Se emite…" : "Emite factura"}</button>
          {/* Regula din 11 noiembrie 2026: facturarea manuală pe aceeași serie poate continua după pornire.
              O comandă facturată manual în SAGA se notează aici, ca aplicația să n-o mai factureze
              (`emite_factura` refuză o comandă cu seria notată). */}
          <details className="mt-3 text-xs">
            <summary className="cursor-pointer text-mut">Facturată deja manual în SAGA? Notează seria</summary>
            <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const v = String(f.get("serie") ?? "").trim();
                if (v && confirm(`Notezi că comanda ${o.numar} e facturată manual în SAGA cu „${v}”? Aplicația nu o va mai factura.`)) salveazaManual(v); }}
              className="mt-2 flex gap-2">
              <input name="serie" placeholder="seria și numărul din SAGA (ex. PAP FE 14207)"
                className="flex-1 rounded-xl border-2 border-line px-3 py-2 outline-none focus:border-acc" />
              <button className="btn-dark !py-2 !px-4 text-xs">Salvează</button>
            </form>
            <p className="text-mut mt-1">După o factură manuală pe aceeași serie: actualizează și numărul următor în Facturi → Setări serie.</p>
          </details>
        </div>
      ) : (
        <>
          <p className="text-xs text-mut mt-1">{motiv} Seria facturii emise în SAGA se notează aici — apare în exportul CSV și în evidență.</p>
          <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); salveazaManual(String(f.get("serie") ?? "").trim()); }}
            className="mt-3 flex gap-2">
            <input name="serie" defaultValue={o.factura_serie ?? ""} placeholder="seria și numărul din SAGA"
              className="flex-1 rounded-xl border-2 border-line px-3 py-2 outline-none focus:border-acc" />
            <button className="btn-dark !py-2 !px-4 text-xs">Salvează</button>
          </form>
          <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-[11px] font-bold ${o.factura_status === "emisa" ? "bg-ok/10 text-ok" : "bg-paper text-mut"}`}>
            {o.factura_status === "emisa" ? `Emisă — ${o.factura_serie}` : "De emis"}</span>
        </>
      )}
      {lucru && <p className="text-xs mt-2 text-mut flex items-center gap-2" role="status">
        <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-line border-t-acc animate-spin" aria-hidden />Se emite…</p>}
      {!lucru && msg && <p className={`text-xs mt-2 ${msg.bun ? "text-ok" : "text-red-700"}`}>{msg.text}
        {msg.id && <> · <Link href={`/admin/facturi/${msg.id}`} className="underline">Deschide factura</Link></>}</p>}
    </div>
  );
}
