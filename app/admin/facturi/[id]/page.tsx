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
//   · „Trimite în SAGA” / „Reîncearcă” (pasul 8) — prin ruta /api/saga, cu formatele
//     SALVATE în Integrări (nu cu cele alese aici pentru descărcare); blocat cât lipsesc;
//   · „Marchează confirmată” — după ce omul a validat importul în SAGA (Diverse → Import date);
//   · jurnalul trimiterilor (`saga_trimiteri`), cu raportul SAGA întreg;
//   · „Stornează” (pasul 10) — doar pe o factură trimisă / confirmată, fără storno
//     (`storneaza_factura`); stornoul se trimite apoi ca orice factură. Un storno netrimis,
//     ultimul din serie, se retrage cu `retrage_storno` (nu cu `retrage_factura`);
//   · „Ascunde din listă” / „Arată din nou” — DOAR pe seriile de probă (PROBA…, TEST…).
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { sbBrowser } from "@/lib/supabase";
import { lei } from "@/lib/format";
import { construiesteXml, numeFisier, numarPentruSaga, FORMATE_NUMAR, FORMATE_DATA, VARIANTE_CIF_PF } from "@/lib/saga-xml.mjs";
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
  // Pasul 8: dacă trimiterea e posibilă (setările din Integrări) și jurnalul apelurilor.
  const [lipsaTrimitere, setLipsaTrimitere] = useState<string[]>([]);
  const [automat, setAutomat] = useState(false);
  type Apel = { id: number; created_at: string; http_status: number | null; durata_ms: number | null;
    cheie_rotita: boolean; eroare: string | null; raspuns: string | null; fisier: string | null };
  const [apeluri, setApeluri] = useState<Apel[]>([]);
  // Pasul 10: legătura factură ↔ storno și ascunderea facturilor de probă.
  const [legat, setLegat] = useState<{ id: number; serie: string; numar: number } | null>(null);
  const [ascunsa, setAscunsa] = useState(false);

  const incarca = useCallback(async () => {
    const sb = sbBrowser(); if (!sb) return;
    const [fa, li, rol, s, ap] = await Promise.all([
      sb.from("facturi").select("*").eq("id", id).maybeSingle(),
      sb.from("facturi_linii").select("*").eq("factura_id", id).order("nr_crt"),
      sb.rpc("is_facturare"),
      sb.from("settings").select("valoare").eq("cheie", "integrari").maybeSingle(),
      sb.from("saga_trimiteri").select("id,created_at,http_status,durata_ms,cheie_rotita,eroare,raspuns,fisier")
        .contains("factura_ids", [Number(id)]).order("id", { ascending: false }).limit(20),
    ]);
    setApeluri((ap.data ?? []) as Apel[]);
    {
      const fx0 = fa.data as Factura | null;
      const [lg, asc] = await Promise.all([
        fx0?.tip === "storno" && fx0.storno_pentru
          ? sb.from("facturi").select("id,serie,numar").eq("id", fx0.storno_pentru).maybeSingle()
          : sb.from("facturi").select("id,serie,numar").eq("storno_pentru", Number(id)).maybeSingle(),
        sb.from("facturi_ascunse").select("factura_id").eq("factura_id", Number(id)).maybeSingle(),
      ]);
      setLegat((lg.data ?? null) as { id: number; serie: string; numar: number } | null);
      setAscunsa(!!asc.data);
    }
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
    // Aceleași condiții ca `optiuniDinSetari` din lib/saga-trimitere.mjs (serverul decide oricum).
    const lipsa: string[] = [];
    if (!din.format_numar) lipsa.push("formatul numărului");
    if (!din.format_data) lipsa.push("formatul datei");
    if (din.tva_la_incasare !== "da" && din.tva_la_incasare !== "nu") lipsa.push("„TVA la încasare”");
    setLipsaTrimitere(lipsa);
    setAutomat(String(saga.import_automat ?? "").trim().toLowerCase() === "da");
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

  async function catreSaga(corp: Record<string, unknown>) {
    const sb = sbBrowser();
    const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
    const r = await fetch("/api/saga", { method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` }, body: JSON.stringify(corp) });
    return r.json().catch(() => ({ ok: false, eroare: `Răspuns neașteptat (HTTP ${r.status}).` }));
  }

  async function trimite() {
    if (!f) return;
    const cum = automat
      ? "IMPORT AUTOMAT („import_automat” = da): SAGA o finalizează singură."
      : "Doar se ÎNCARCĂ în SAGA; o validezi apoi de mână, în SAGA WEB → Diverse → Import date.";
    if (!confirm(`Trimiți factura ${f.serie} ${f.numar} în SAGA? ${cum} După trimitere nu se mai modifică și nu se mai retrage aici.`)) return;
    setLucru(true); setMsg(null);
    const j = await catreSaga({ actiune: "trimite", factura_id: f.id });
    setLucru(false);
    if (!j?.ok) setMsg({ bun: false, text: `NU s-a trimis: ${j?.eroare ?? "eroare necunoscută"}` });
    else setMsg({ bun: j.stare !== "eroare", text: j.stare === "eroare"
      ? `SAGA nu a primit-o: ${j.nota}`
      : `✓ ${j.stare === "confirmata" ? "Importată și finalizată în SAGA" : "Încărcată în SAGA — valideaz-o în SAGA WEB → Diverse → Import date, apoi apasă „Marchează confirmată”"} (fișierul ${j.fisier}).${j.nota ? ` ${j.nota}` : ""}` });
    incarca();
  }

  async function confirma() {
    if (!f || !confirm(`Ai validat factura ${f.serie} ${f.numar} în SAGA (Diverse → Import date) și arată corect — seria, numărul, clientul, liniile, cota și TVA-ul, totalul?`)) return;
    setLucru(true); setMsg(null);
    const j = await catreSaga({ actiune: "confirma", factura_id: f.id });
    setLucru(false);
    setMsg(j?.ok ? { bun: true, text: j.mesaj } : { bun: false, text: `NU s-a marcat: ${j?.eroare ?? "eroare necunoscută"}` });
    incarca();
  }

  async function retrage() {
    const eStorno = f?.tip === "storno";
    if (!f || !confirm(eStorno
      ? `Retragi stornoul ${f.serie} ${f.numar}? Se șterge, numărul ${f.numar} se refolosește, iar factura stornată rămâne valabilă. Merge doar pentru ultimul document din serie, netrimis.`
      : `Retragi factura ${f.serie} ${f.numar}? Se șterge, iar numărul ${f.numar} va fi folosit de următoarea factură. Merge doar pentru ultima factură din serie, netrimisă.`)) return;
    const sb = sbBrowser(); if (!sb) return;
    setLucru(true); setMsg(null);
    // `retrage_factura` (49) refuză stornările; pentru ele există `retrage_storno` (53).
    const { error } = await sb.rpc(eStorno ? "retrage_storno" : "retrage_factura", { p_id: f.id });
    setLucru(false);
    if (error) { setMsg({ bun: false, text: `NU s-a retras: ${error.message}` }); return; }
    router.push(`/admin/comenzi/${f.order_id}`);
  }

  async function storneaza() {
    if (!f) return;
    const motiv = prompt(`Stornezi factura ${f.serie} ${f.numar} (${lei(Number(f.total))})? Se emite un document STORNO în seria ${f.serie}, cu număr nou și sumele cu minus, care se trimite apoi în SAGA ca orice factură. Comanda devine „stornată” și NU mai poate primi o factură nouă din aplicație.\n\nMotivul (opțional, apare pe storno):`, "");
    if (motiv === null) return;
    const sb = sbBrowser(); if (!sb) return;
    setLucru(true); setMsg(null);
    const { data, error } = await sb.rpc("storneaza_factura", { p_id: f.id, p_motiv: motiv });
    setLucru(false);
    if (error) { setMsg({ bun: false, text: `NU s-a stornat: ${error.message}` }); return; }
    router.push(`/admin/facturi/${(data as { id: number }).id}`);
  }

  async function comutaAscunderea() {
    if (!f) return;
    if (!ascunsa && !confirm(`Ascunzi factura de probă ${f.serie} ${f.numar} din lista din Facturi? Nu se șterge nimic; o vezi din nou cu bifa „Arată și facturile de probă ascunse”.`)) return;
    const sb = sbBrowser(); if (!sb) return;
    setLucru(true); setMsg(null);
    const { error } = ascunsa
      ? await sb.rpc("reafiseaza_factura", { p_id: f.id })
      : await sb.rpc("ascunde_factura", { p_id: f.id, p_motiv: "factură de probă" });
    setLucru(false);
    if (error) { setMsg({ bun: false, text: `NU s-a putut: ${error.message}` }); return; }
    setMsg({ bun: true, text: ascunsa ? "✓ Factura apare din nou în listă." : "✓ Factura e ascunsă din listă." });
    incarca();
  }

  const deProba = /^(PROBA|TEST)/i.test(f.serie.trim());
  const sePoateStorna = poate && f.tip === "factura" && (f.saga_status === "trimisa" || f.saga_status === "confirmata") && !legat;

  // Ce va scrie efectiv în XML formatul de număr ales — la proba din 11 noiembrie 2026 s-a
  // ales din listă „serie_lipita” fără să se vadă că dă „PROBA1”, nu „PROBA 1”.
  const exempluNumar = opt.format_numar ? numarPentruSaga(f.serie, f.numar, opt.format_numar) : "";
  const exempluFisier = opt.format_numar ? numeFisier(f, opt) : "";

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
            <b className={f.saga_status === "confirmata" ? "text-ok" : f.saga_status === "eroare" ? "text-red-700" : ""}>{ETICHETE_STARE[f.saga_status]}</b>
            {ascunsa && <> · <span className="text-amber-800">ascunsă din listă</span></>}</span>
          {legat && <div className="text-sm mt-1">{f.tip === "storno" ? "Stornează factura " : "Stornată de "}
            <Link href={`/admin/facturi/${legat.id}`} className="font-semibold text-acc hover:underline">{f.tip === "storno" ? "" : "storno "}{legat.serie} {legat.numar}</Link></div>}
        </div>
        {(sePoateStorna || (poate && deProba)) && (
          <div className="flex gap-2">
            {sePoateStorna && <button type="button" onClick={storneaza} disabled={lucru} className="rounded-xl border-2 border-red-200 text-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-50">Stornează</button>}
            {poate && deProba && <button type="button" onClick={comutaAscunderea} disabled={lucru} className="rounded-xl border-2 border-line px-4 py-2 text-sm font-semibold hover:border-acc">{ascunsa ? "Arată din nou în listă" : "Ascunde din listă (probă)"}</button>}
          </div>
        )}
        {poate && modificabila && (
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditez(!editez)} className="rounded-xl border-2 border-line px-4 py-2 text-sm font-semibold hover:border-acc">{editez ? "Renunță" : "Modifică"}</button>
            {f.saga_status === "de_trimis" && <button type="button" onClick={retrage} disabled={lucru} className="rounded-xl border-2 border-red-200 text-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-50">Retrage</button>}
          </div>
        )}
      </div>

      {f.saga_eroare && (f.saga_status === "eroare" || f.saga_status === "de_trimis"
        ? <div className="card p-3 text-sm border-2 border-red-300 bg-red-50 text-red-800">Ultima eroare SAGA: {f.saga_eroare}</div>
        : <div className="card p-3 text-sm border-2 border-amber-300 bg-amber-50 text-amber-900">Nota SAGA: {f.saga_eroare}</div>)}

      {poate && (
        <div className="card p-5 text-sm grid gap-2">
          <b className="font-disp font-semibold text-[13px]">Trimiterea în SAGA</b>
          {(f.saga_status === "de_trimis" || f.saga_status === "eroare") && (lipsaTrimitere.length ? (
            <p className="text-xs text-red-700">Trimiterea e blocată până se aleg în Integrări → Saga: {lipsaTrimitere.join(", ")}.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn-acc !py-2 text-xs" disabled={lucru || editez} onClick={trimite}>
                {lucru ? "Se trimite…" : f.saga_status === "eroare" ? "Reîncearcă trimiterea" : "Trimite în SAGA"}</button>
              <span className="text-xs text-mut">{automat ? "Import AUTOMAT (setarea „import_automat” = da)." : "Doar încărcare — validarea se face de mână în SAGA (Diverse → Import date)."}</span>
            </div>
          ))}
          {f.saga_status === "in_curs" && <p className="text-xs text-mut">Se trimite… Dacă rămâne așa peste 3 minute, trimiterea s-a întrerupt: reîncarcă pagina și apasă din nou — SAGA spune singur dacă o are deja.</p>}
          {f.saga_status === "in_curs" && !lipsaTrimitere.length && (
            <button type="button" className="rounded-xl border-2 border-line px-3 py-1.5 text-xs font-semibold w-fit" disabled={lucru} onClick={trimite}>Reîncearcă (doar dacă a trecut de 3 minute)</button>)}
          {f.saga_status === "trimisa" && (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn-acc !py-2 text-xs" disabled={lucru} onClick={confirma}>Marchează confirmată</button>
              <span className="text-xs text-mut">După validarea în SAGA WEB → Diverse → Import date. Verifică acolo seria, numărul, clientul, cota și TVA-ul, totalul.</span>
            </div>)}
          {f.saga_status === "confirmata" && <p className="text-xs text-ok">Confirmată în SAGA{f.confirmata_la ? ` la ${new Date(f.confirmata_la).toLocaleString("ro-RO", { timeZone: "Europe/Bucharest" })}` : ""}.</p>}
          {apeluri.length > 0 && (
            <details className="text-xs mt-1"><summary className="cursor-pointer text-mut">Jurnalul trimiterilor ({apeluri.length})</summary>
              <ul className="mt-2 space-y-2">
                {apeluri.map((a) => (
                  <li key={a.id} className="rounded-lg border-2 border-line p-2">
                    <div>{new Date(a.created_at).toLocaleString("ro-RO", { timeZone: "Europe/Bucharest" })} · HTTP {a.http_status ?? "—"} · {a.durata_ms ?? "—"} ms
                      {a.fisier ? ` · ${a.fisier}` : ""}{a.cheie_rotita ? " · cheie rotită" : ""}</div>
                    {a.eroare && <div className="text-red-700">{a.eroare}</div>}
                    {a.raspuns && <pre className="whitespace-pre-wrap break-words text-[11px] text-mut mt-1">{a.raspuns}</pre>}
                  </li>
                ))}
              </ul></details>
          )}
        </div>
      )}
      {!modificabila && <p className="text-xs text-mut">Factura a plecat spre SAGA: nu se mai modifică aici. Corecturile se fac în SAGA, iar în aplicație rămâne stornarea.</p>}
      {!f.mentiune_plata && (
        <div className="card p-3 text-sm border-2 border-amber-300 bg-amber-50 text-amber-900">
          ⚠ Factura NU are mențiunea de plată (pe factura reală: „ramburs in cont”) — la emitere, câmpul „Mențiunea de plată” din
          Integrări → Saga era gol. Mențiunea se copiază în factură la emitere și nu se poate adăuga prin „Modifică”: completeaz-o în
          Integrări, apoi {modificabila && f.saga_status === "de_trimis" ? "retrage factura și emite-o din nou (merge doar pentru ultima din serie)" : "corectura se face în SAGA"}.
        </div>
      )}
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
        {exempluNumar && <p className="text-xs">În XML: <b>&lt;FacturaNumar&gt;{exempluNumar}&lt;/FacturaNumar&gt;</b> · fișierul <b>{exempluFisier}</b></p>}
        {!f.mentiune_plata && <p className="text-xs text-red-700">Atenție: XML-ul pleacă fără mențiunea de plată (vezi avertismentul de mai sus).</p>}
        <button type="button" className="btn-dark !py-2 text-xs" disabled={!xmlGata} onClick={descarca}>Descarcă XML</button>
      </div>
    </div>
  );
}
