"use client";
// PAGINA UNEI FACTURI (pasul 6 din docs/saga-plan.md, 10 noiembrie 2026).
//
// Arată documentul așa cum a fost COPIAT la emitere (clientul, furnizorul,
// liniile, totalurile) și starea lui față de SAGA. Acțiuni:
//   · „Modifică” — doar înainte de trimitere (`de_trimis` / `eroare`): datele
//     clientului și articolul din gestiune pe linii (`modifica_factura`). Prețurile
//     și numerotarea NU se modifică — vin din comandă;
//   · „Retrage” — doar netrimisă și doar ultima din serie (`retrage_factura`);
//   · „Descarcă XML” — fișierul pentru SAGA, construit în browser cu
//     `lib/saga-xml.mjs`. Formatul numărului, al datei și „TVA la încasare” vin din
//     setări; cât nu sunt alese, se aleg AICI, doar pentru descărcarea asta (probă
//     manuală în SAGA, D.4) — nu se salvează nicăieri.
// Trimiterea în SAGA și „Marchează confirmată” vin la pasul 8.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { sbBrowser } from "@/lib/supabase";
import { lei } from "@/lib/format";
import { construiesteXml, numeFisier, FORMATE_NUMAR, FORMATE_DATA, VARIANTE_CIF_PF } from "@/lib/saga-xml.mjs";
import { ETICHETE_STARE } from "@/components/admin/FacturaSaga";
import type { Factura, FacturaLinie } from "@/lib/types";

type Optiuni = { format_numar: string; format_data: string; tva_la_incasare: string; cif_persoana_fizica: string };
const CAMPURI_CLIENT: [string, string][] = [
  ["nume", "Nume (persoană)"], ["firma", "Firma"], ["cui", "CUI"], ["nr_reg_com", "Nr. Reg. Com."],
  ["adresa", "Adresa"], ["localitate", "Localitatea"], ["judet", "Județul"], ["telefon", "Telefon"], ["email", "E-mail"],
];

export default function FacturaPagina() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [f, setF] = useState<Factura | null>(null);
  const [linii, setLinii] = useState<FacturaLinie[]>([]);
  const [numarComanda, setNumarComanda] = useState("");
  const [poate, setPoate] = useState(false);
  const [setari, setSetari] = useState<Partial<Optiuni>>({});
  const [opt, setOpt] = useState<Optiuni>({ format_numar: "", format_data: "", tva_la_incasare: "", cif_persoana_fizica: "" });
  const [gata, setGata] = useState(false);
  const [msg, setMsg] = useState<{ bun: boolean; text: string } | null>(null);
  const [lucru, setLucru] = useState(false);
  const [editez, setEditez] = useState(false);
  const [client, setClient] = useState<Record<string, string>>({});
  const [art, setArt] = useState<Record<number, { cod: string; den: string; um: string }>>({});

  const incarca = useCallback(async () => {
    const sb = sbBrowser(); if (!sb) return;
    const [fa, li, rol, s] = await Promise.all([
      sb.from("facturi").select("*").eq("id", id).maybeSingle(),
      sb.from("facturi_linii").select("*").eq("factura_id", id).order("nr_crt"),
      sb.rpc("is_facturare"),
      sb.from("settings").select("valoare").eq("cheie", "integrari").maybeSingle(),
    ]);
    const fx = fa.data as Factura | null;
    setF(fx); setLinii((li.data ?? []) as FacturaLinie[]); setPoate(rol.data === true);
    if (fx) {
      const { data: o } = await sb.from("orders").select("numar").eq("id", fx.order_id).maybeSingle();
      setNumarComanda(o?.numar ?? "");
      setClient(Object.fromEntries(CAMPURI_CLIENT.map(([k]) => [k, String(fx.client?.[k] ?? "")])));
      setArt(Object.fromEntries(((li.data ?? []) as FacturaLinie[]).map((l) => [l.id, { cod: l.cod_articol_saga, den: l.descriere, um: l.um }])));
    }
    const saga = (s.data?.valoare as any)?.saga ?? {};
    const din: Partial<Optiuni> = {};
    for (const k of ["format_numar", "format_data", "tva_la_incasare", "cif_persoana_fizica"] as const)
      if (String(saga[k] ?? "").trim()) din[k] = String(saga[k]).trim();
    setSetari(din);
    setOpt((v) => ({ ...v, ...din, cif_persoana_fizica: din.cif_persoana_fizica ?? (v.cif_persoana_fizica || "gol") }));
    setGata(true);
  }, [id]);
  useEffect(() => { incarca(); }, [incarca]);

  if (!gata) return <div className="text-mut">Se încarcă…</div>;
  if (!f) return <div className="card p-8 text-center"><b>Factura nu există sau nu ai acces la ea.</b>
    <Link href="/admin/facturi" className="text-acc font-semibold block mt-2">← Înapoi la facturi</Link></div>;

  const modificabila = f.saga_status === "de_trimis" || f.saga_status === "eroare";
  const xmlGata = !!(opt.format_numar && opt.format_data && opt.tva_la_incasare);

  function descarca() {
    if (!f) return;
    try {
      const xml = construiesteXml([{ ...f, linii }], opt);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([xml], { type: "application/xml;charset=utf-8" }));
      a.download = numeFisier(f, opt); a.click();
      setMsg({ bun: true, text: `✓ Descărcat ${a.download}.` });
    } catch (e: any) { setMsg({ bun: false, text: `XML-ul NU s-a generat: ${e?.message ?? e}` }); }
  }

  async function salveazaModificari() {
    const sb = sbBrowser(); if (!sb || !f) return;
    setLucru(true); setMsg(null);
    const { error } = await sb.rpc("modifica_factura", {
      p_id: f.id, p_client: client,
      p_linii: Object.entries(art).map(([lid, v]) => ({ id: Number(lid), cod_articol_saga: v.cod, descriere: v.den, um: v.um })),
    });
    setLucru(false);
    if (error) { setMsg({ bun: false, text: `NU s-a salvat: ${error.message}` }); return; }
    setMsg({ bun: true, text: "✓ Factura a fost corectată." }); setEditez(false); incarca();
  }

  async function retrage() {
    if (!f || !confirm(`Retragi factura ${f.serie} ${f.numar}? Se șterge, iar numărul ${f.numar} va fi folosit de următoarea factură. Merge doar pentru ultima factură din serie, netrimisă.`)) return;
    const sb = sbBrowser(); if (!sb) return;
    setLucru(true); setMsg(null);
    const { error } = await sb.rpc("retrage_factura", { p_id: f.id });
    setLucru(false);
    if (error) { setMsg({ bun: false, text: `NU s-a retras: ${error.message}` }); return; }
    router.push(`/admin/comenzi/${f.order_id}`);
  }

  const sel = (k: keyof Optiuni, variante: readonly string[]) => (
    <div className="fld"><label>{k}{setari[k] ? "" : " — nesetat în Integrări: valoare de PROBĂ, doar pentru descărcarea asta"}</label>
      <select value={opt[k]} disabled={!!setari[k]} onChange={(e) => setOpt({ ...opt, [k]: e.target.value })}>
        <option value="">— alege —</option>
        {variante.map((v) => <option key={v} value={v}>{v}</option>)}
      </select></div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="dim"><Link href="/admin/facturi" className="hover:text-acc">Facturi</Link>
            {numarComanda && <> · <Link href={`/admin/comenzi/${f.order_id}`} className="hover:text-acc">comanda {numarComanda}</Link></>}</div>
          <h1 className="font-disp font-bold text-2xl mt-1">{f.tip === "storno" ? "Storno " : "Factura "}{f.serie} {f.numar}</h1>
          <span className="text-sm text-mut">{f.data.split("-").reverse().join(".")} · {lei(Number(f.total))} ·{" "}
            <b className={f.saga_status === "confirmata" ? "text-ok" : f.saga_status === "eroare" ? "text-red-700" : ""}>{ETICHETE_STARE[f.saga_status]}</b></span>
        </div>
        {poate && modificabila && (
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditez(!editez)} className="rounded-xl border-2 border-line px-4 py-2 text-sm font-semibold hover:border-acc">{editez ? "Renunță" : "Modifică"}</button>
            {f.saga_status === "de_trimis" && <button type="button" onClick={retrage} disabled={lucru} className="rounded-xl border-2 border-red-200 text-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-50">Retrage</button>}
          </div>
        )}
      </div>

      {f.saga_eroare && <div className="card p-3 text-sm border-2 border-red-300 bg-red-50 text-red-800">Ultima eroare SAGA: {f.saga_eroare}</div>}
      {!modificabila && <p className="text-xs text-mut">Factura a plecat spre SAGA: nu se mai modifică aici. Corecturile se fac în SAGA, iar în aplicație rămâne stornarea.</p>}
      {msg && <div className={`card p-3 text-sm ${msg.bun ? "text-ok" : "border-2 border-red-300 bg-red-50 text-red-800"}`}>{msg.text}</div>}

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <div className="card p-5 text-sm">
          <b className="font-disp font-semibold text-[13px]">Client</b>
          {editez ? (
            <div className="grid sm:grid-cols-2 gap-2 mt-2">
              {CAMPURI_CLIENT.map(([k, l]) => (
                <div className="fld" key={k}><label>{l}</label>
                  <input value={client[k] ?? ""} onChange={(e) => setClient({ ...client, [k]: e.target.value })} /></div>
              ))}
            </div>
          ) : (
            <dl className="mt-2 grid grid-cols-[auto,1fr] gap-x-3 gap-y-1">
              {CAMPURI_CLIENT.filter(([k]) => f.client?.[k]).flatMap(([k, l]) => [
                <dt className="text-mut" key={`t${k}`}>{l}</dt>, <dd key={`d${k}`}>{f.client[k]}</dd>])}
              <dt className="text-mut">Cod județ</dt><dd>{f.client?.cod_judet}</dd>
            </dl>
          )}
        </div>
        <div className="card p-5 text-sm">
          <b className="font-disp font-semibold text-[13px]">Furnizor <span className="font-normal text-mut">(copia din Setări, la emitere)</span></b>
          <p className="mt-2">{f.furnizor?.denumire} · {f.furnizor?.cui} · {f.furnizor?.reg_com}</p>
          <p className="text-mut">{f.furnizor?.adresa}{f.furnizor?.cod_judet ? ` · ${f.furnizor.cod_judet}` : ""}</p>
          <p className="text-mut">{f.furnizor?.banca} · {f.furnizor?.iban} · capital {f.furnizor?.capital}</p>
          {f.mentiune_plata && <p className="mt-2">Plata: <b>{f.mentiune_plata}</b></p>}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm md:min-w-[760px]">
          <thead><tr className="text-left text-mut text-xs border-b border-line">
            <th className="px-3 py-2">#</th><th className="px-3 py-2">Pe site</th><th className="px-3 py-2">Articol SAGA</th>
            <th className="px-3 py-2">Cant.</th><th className="px-3 py-2">Preț fără TVA</th><th className="px-3 py-2">Valoare</th>
            <th className="px-3 py-2">TVA</th><th className="px-3 py-2">Total</th></tr></thead>
          <tbody className="divide-y divide-line">
            {linii.map((l) => (
              <tr key={l.id}>
                <td className="px-3 py-2 text-mut">{l.nr_crt}</td>
                <td className="px-3 py-2">{l.denumire_site}{l.cod_intern && <span className="text-mut"> · {l.cod_intern}</span>}</td>
                <td className="px-3 py-2">{editez ? (
                  <div className="flex gap-1">
                    <input className="w-20 rounded border-2 border-line px-1" value={art[l.id]?.cod ?? ""} onChange={(e) => setArt({ ...art, [l.id]: { ...art[l.id], cod: e.target.value } })} />
                    <input className="w-36 rounded border-2 border-line px-1" value={art[l.id]?.den ?? ""} onChange={(e) => setArt({ ...art, [l.id]: { ...art[l.id], den: e.target.value } })} />
                    <input className="w-14 rounded border-2 border-line px-1" value={art[l.id]?.um ?? ""} onChange={(e) => setArt({ ...art, [l.id]: { ...art[l.id], um: e.target.value } })} />
                  </div>) : <>{l.descriere} <span className="text-mut">· {l.cod_articol_saga} · {l.um}</span></>}</td>
                <td className="px-3 py-2">{Number(l.cantitate)}</td>
                <td className="px-3 py-2">{Number(l.pret_fara_tva).toFixed(4)}</td>
                <td className="px-3 py-2">{Number(l.valoare).toFixed(2)}</td>
                <td className="px-3 py-2">{Number(l.tva).toFixed(2)} <span className="text-mut">({Number(l.cota_tva)}%)</span></td>
                <td className="px-3 py-2 font-semibold">{Number(l.total).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr className="border-t-2 border-line font-semibold">
            <td colSpan={5} className="px-3 py-2 text-right">Total</td>
            <td className="px-3 py-2">{Number(f.total_fara_tva).toFixed(2)}</td><td className="px-3 py-2">{Number(f.total_tva).toFixed(2)}</td>
            <td className="px-3 py-2">{Number(f.total).toFixed(2)}</td></tr></tfoot>
        </table>
      </div>
      {editez && <button type="button" className="btn-acc" disabled={lucru} onClick={salveazaModificari}>{lucru ? "Se salvează…" : "Salvează corecturile"}</button>}

      <div className="card p-5 text-sm grid gap-2">
        <b className="font-disp font-semibold text-[13px]">Descarcă XML pentru SAGA</b>
        <p className="text-xs text-mut">Fișierul se importă manual în SAGA WEB, la Diverse → Import date, FĂRĂ validare — ca probă a formatului
          (planul, D.4). Formatele nesetate în Integrări se aleg aici doar pentru descărcarea asta.</p>
        <div className="grid sm:grid-cols-2 gap-2">
          {sel("format_numar", FORMATE_NUMAR)}{sel("format_data", FORMATE_DATA)}
          {sel("tva_la_incasare", ["da", "nu"])}{sel("cif_persoana_fizica", VARIANTE_CIF_PF)}
        </div>
        <button type="button" className="btn-dark !py-2 text-xs" disabled={!xmlGata} onClick={descarca}>Descarcă XML</button>
      </div>
    </div>
  );
}
