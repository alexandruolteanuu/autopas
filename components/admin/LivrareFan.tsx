"use client";
// LIVRARE — FAN COURIER: calculatorul de transport + AWB-ul, într-un singur card.
//
// Pașii, în ordinea în care îi face omul:
//   1. scrie câte colete, kilogramele și (opțional) dimensiunile -> „Calculează transportul"
//      -> vede prețul FAN defalcat (greutate, km suplimentari, combustibil,
//      TVA);
//   2. sună clientul și îi spune totalul; dacă acceptă -> „Clientul a acceptat"
//      (costul intră în comandă, totalul se recalculează pe server);
//   3. „Generează AWB" -> „Printează eticheta".
//
// Prețul NU se scrie de mână (cerut de proprietar, 15 septembrie 2026): îl dă FAN,
// pentru contul firmei, cu același serviciu și aceleași opțiuni ca pe AWB. Suma
// pentru client rămâne editabilă — se poate rotunji sau pune 0 la ridicare personală.
//
// Greutatea NU se ia din piese: piesele importate au 1 kg pus automat.
import { useState } from "react";
import { sbBrowser } from "@/lib/supabase";
import { lei } from "@/lib/format";
import type { OrderFull } from "@/lib/types";
import AlegeAdresa from "@/components/AlegeAdresa";

type Tarif = { greutate: number; kmSuplimentari: number; combustibil: number; optiuni: number; asigurare: number;
  faraTva: number; tva: number; total: number; serviciu: string };
type Colet = { colete: string; greutate: string; lungime: string; latime: string; inaltime: string };

const camp = "w-full mt-0.5 rounded-lg border-2 border-line px-2.5 py-1.5 text-sm text-ink outline-none focus:border-acc";
const bani = (n: number) => `${n.toFixed(2).replace(".", ",")} lei`;

async function cere(corp: object) {
  const sb = sbBrowser();
  const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
  if (!token) return { ok: false, eroare: "Sesiunea a expirat. Autentifică-te din nou." };
  const r = await fetch("/api/awb", { method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(corp) });
  return r.json().catch(() => ({ ok: false, eroare: `Serverul a răspuns cu ${r.status}.` }));
}

/** „40×30×25", „40x30x25", „40 30 25" -> ["40", "30", "25"]. */
function dimensiuni(text: string | null | undefined) {
  const n = (text ?? "").match(/\d+([.,]\d+)?/g) ?? [];
  return [n[0] ?? "", n[1] ?? "", n[2] ?? ""];
}

/** „40×30×25" dacă sunt scrise toate trei, altfel `null` (coletul pleacă fără dimensiuni). */
function textDimensiuni(c: Colet) {
  const v = [c.lungime, c.latime, c.inaltime].map((x) => x.trim());
  return v.every((x) => Number(x.replace(",", ".")) >= 1) ? v.join("×") : null;
}

function CampuriColet({ v, set }: { v: Colet; set: (c: Colet) => void }) {
  const f = (k: keyof Colet) => (e: React.ChangeEvent<HTMLInputElement>) => set({ ...v, [k]: e.target.value });
  return (<>
    <div className="grid grid-cols-2 gap-2">
      <label className="text-[11px] text-mut">Colete
        <input type="number" min={1} step={1} value={v.colete} onChange={f("colete")} className={camp} /></label>
      <label className="text-[11px] text-mut">Greutate totală (kg)
        <input inputMode="decimal" value={v.greutate} onChange={f("greutate")} placeholder="ex. 4.5" className={camp} /></label>
    </div>
    {/* Dimensiunile sunt OPȚIONALE (16 septembrie 2026): așa lucrează firma și în selfAWB.
        Ori toate trei, ori niciuna — serverul refuză doar un set pe jumătate. */}
    <p className="text-[11px] text-mut -mb-1">Dimensiuni colet <span className="italic">(opțional)</span></p>
    <div className="grid grid-cols-3 gap-2">
      <label className="text-[11px] text-mut">Lungime (cm)<input inputMode="numeric" value={v.lungime} onChange={f("lungime")} className={camp} /></label>
      <label className="text-[11px] text-mut">Lățime (cm)<input inputMode="numeric" value={v.latime} onChange={f("latime")} className={camp} /></label>
      <label className="text-[11px] text-mut">Înălțime (cm)<input inputMode="numeric" value={v.inaltime} onChange={f("inaltime")} className={camp} /></label>
    </div>
  </>);
}

/** Prețul FAN, rând cu rând, cum îl spui la telefon. */
export function DefalcareTarif({ t }: { t: Tarif }) {
  const rand = (eticheta: string, suma: number, evident = false) => (
    <div className={`flex justify-between ${evident ? "font-semibold text-ink" : "text-mut"}`}><span>{eticheta}</span><span className="tabular-nums">{bani(suma)}</span></div>
  );
  return (
    <div className="rounded-lg border-2 border-acc/40 bg-acc/5 px-3 py-2.5 text-[13px] space-y-0.5">
      {rand("Transport (după greutate și volum)", t.greutate)}
      {t.kmSuplimentari > 0 ? rand("Km suplimentari (localitate îndepărtată)", t.kmSuplimentari, true) : rand("Km suplimentari", 0)}
      {rand("Taxă combustibil", t.combustibil)}
      {t.optiuni > 0 && rand("Opțiuni FAN", t.optiuni)}
      {t.asigurare > 0 && rand("Asigurare", t.asigurare)}
      {rand("TVA", t.tva)}
      <div className="flex justify-between border-t border-line pt-1 mt-1 text-base font-bold text-ink">
        <span>Transport</span><span className="tabular-nums">{bani(t.total)}</span></div>
    </div>
  );
}

/** Calculatorul fără comandă — pentru clientul care sună să întrebe „cât costă la Cluj?". */
export function CalculatorTransport() {
  const [c, setC] = useState<Colet>({ colete: "1", greutate: "", lungime: "", latime: "", inaltime: "" });
  const [judet, setJudet] = useState(""); const [localitate, setLocalitate] = useState("");
  const [ramburs, setRamburs] = useState(true);
  const [t, setT] = useState<Tarif | null>(null);
  const [lucru, setLucru] = useState(false); const [msg, setMsg] = useState("");
  const schimba = (fn: () => void) => { fn(); setT(null); };
  async function calculeaza(e: React.FormEvent) {
    e.preventDefault(); setLucru(true); setMsg("");
    const j = await cere({ actiune: "tarif", colet: { ...c, cu_ramburs: ramburs }, destinatar: { judet, localitate } });
    setLucru(false);
    if (j.ok) setT(j.tarif); else setMsg(j.eroare ?? "Nu s-a putut calcula.");
  }
  return (
    <form onSubmit={calculeaza} className="space-y-2 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <AlegeAdresa stil="admin" cuStrada={false} value={{ judet, localitate, strada: "", numar: "" }}
          onChange={(a) => schimba(() => { setJudet(a.judet); setLocalitate(a.localitate); })} />
      </div>
      <CampuriColet v={c} set={(v) => schimba(() => setC(v))} />
      <label className="flex items-center gap-2 text-xs cursor-pointer">
        <input type="checkbox" checked={ramburs} onChange={(e) => schimba(() => setRamburs(e.target.checked))} /> Plata ramburs</label>
      <button disabled={lucru} className="btn-acc w-full !py-2 text-sm">{lucru ? "Se calculează la FAN…" : "Calculează transportul"}</button>
      {t && <DefalcareTarif t={t} />}
      {msg && <p className="text-[13px] text-red-600">{msg}</p>}
    </form>
  );
}

type Props = { o: OrderFull; laSchimbare: () => void; salveazaManual: (awb: string) => void };

// TRANSPORTUL ÎL ÎNCASEAZĂ FAN, NU FIRMA (decizia proprietarului, 15 septembrie 2026).
// Operatorul calculează transportul și îl spune clientului, dar pe AWB rambursul e
// DOAR valoarea pieselor, iar transportul îl plătește destinatarul direct la FAN
// (`payment: "recipient"` în lib/fancourier.ts). Rubrica „Conținut" rămâne goală.
export default function LivrareFan({ o, laSchimbare, salveazaManual }: Props) {
  const [L, l, h] = dimensiuni(o.livrare_dimensiuni);
  const [colet, setColet] = useState<Colet>({ colete: "1", greutate: o.livrare_greutate_kg ? String(o.livrare_greutate_kg) : "", lungime: L, latime: l, inaltime: h });
  const [adresaDeschisa, setAdresaDeschisa] = useState(false);
  const [adresa, setAdresa] = useState({ telefon: o.telefon, judet: o.judet, localitate: o.oras, strada: o.adresa });
  const [tarif, setTarif] = useState<Tarif | null>(null);
  const [pret, setPret] = useState("");
  const [recalculez, setRecalculez] = useState(false);
  const [observatii, setObservatii] = useState("");
  // După un refuz al FAN la ștergere: operatorul poate scoate AWB-ul doar din admin.
  const [potDoarAdmin, setPotDoarAdmin] = useState(false);
  const [ramburs, setRamburs] = useState<string | null>(null);
  const [lucru, setLucru] = useState<"" | "tarif" | "accept" | "awb" | "eticheta" | "sterge">("");
  const [msg, setMsg] = useState<{ text: string; bun: boolean } | null>(null);

  const livrareStabilita = Boolean(o.livrare_stabilit_la);
  const la = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const adresaModificata = adresa.telefon !== o.telefon || la(adresa.judet) !== la(o.judet) || la(adresa.localitate) !== la(o.oras) || adresa.strada !== o.adresa;
  // Orice schimbare în colet sau adresă face prețul calculat vechi: altfel s-ar
  // putea salva un preț calculat pentru alte kilograme decât cele scrise acum.
  const schimbaColet = (c: Colet) => { setColet(c); setTarif(null); };
  const schimbaAdresa = (k: keyof typeof adresa, v: string) => { setAdresa({ ...adresa, [k]: v }); setTarif(null); };
  // Valoarea pieselor = ce încasează firma = rambursul de pe AWB.
  const produse = Number(o.subtotal) - Number(o.discount_valoare || 0);

  async function calculeaza() {
    setLucru("tarif"); setMsg(null);
    const j = await cere({ actiune: "tarif", comanda_id: o.id, colet,
      destinatar: adresaModificata ? { judet: adresa.judet, localitate: adresa.localitate } : undefined });
    setLucru("");
    if (j.ok) { setTarif(j.tarif); setPret(String(j.tarif.total)); }
    else setMsg({ text: j.eroare ?? "Nu s-a putut calcula transportul.", bun: false });
  }

  /** Costul acceptat de client se salvează în comandă prin `seteaza_cost_livrare`,
   *  doar ca informație: totalul comenzii rămâne valoarea pieselor (migrarea 45),
   *  fiindcă transportul îl încasează FAN. Suma se împarte pe rubricile existente, cu TVA:
   *  km suplimentari separat (clientul întreabă de ei), eventualele opțiuni FAN la
   *  „alte taxe", restul la transport. */
  async function accepta() {
    if (!tarif) return;
    const sumaClient = Number(pret.replace(",", "."));
    if (!(sumaClient >= 0)) { setMsg({ text: "Scrie suma de transport pentru client.", bun: false }); return; }
    const cuTva = 1 + (tarif.faraTva ? tarif.tva / tarif.faraTva : 0.21);
    const r2 = (n: number) => Math.round(n * 100) / 100;
    let km = r2(tarif.kmSuplimentari * cuTva), alte = r2((tarif.optiuni + tarif.asigurare) * cuTva);
    let baza = r2(sumaClient - km - alte);
    if (baza < 0) { baza = sumaClient; km = 0; alte = 0; } // sumă rotunjită mult în jos sau 0
    const dim = textDimensiuni(colet);
    const nota = `${colet.colete} ${colet.colete === "1" ? "colet" : "colete"}, ${colet.greutate} kg${dim ? `, ${dim} cm` : ""}` +
      (km > 0 ? ` · include ${bani(km)} km suplimentari` : "");
    setLucru("accept"); setMsg(null);
    const sb = sbBrowser()!;
    const { data, error } = await sb.rpc("seteaza_cost_livrare", {
      p_order_id: o.id, p_baza: baza, p_km_extra: km, p_alte: alte,
      p_greutate: Number(colet.greutate.replace(",", ".")), p_dimensiuni: dim, p_nota: nota,
    });
    setLucru("");
    const r = data as { ok: boolean; mesaj?: string } | null;
    if (error || !r?.ok) { setMsg({ text: error?.message ?? r?.mesaj ?? "Nu s-a salvat costul.", bun: false }); return; }
    setTarif(null); setRecalculez(false); setRamburs(null);
    setMsg({ text: "✓ Transportul a fost salvat în comandă (îl încasează FAN de la client). Poți genera AWB-ul.", bun: true });
    laSchimbare();
  }

  async function genereaza() {
    setLucru("awb"); setMsg(null);
    const j = await cere({
      actiune: "genereaza", comanda_id: o.id,
      // Rambursul implicit = doar piesele; conținutul pleacă gol.
      colet: { ...colet, ramburs: ramburs ?? (o.plata === "ramburs" ? produse : 0), continut: "", observatii },
      destinatar: adresaModificata ? adresa : undefined,
    });
    setLucru("");
    if (j.ok) { setMsg({ text: `✓ AWB ${j.awb} generat.`, bun: true }); laSchimbare(); }
    else setMsg({ text: j.eroare ?? "Nu s-a putut genera AWB-ul.", bun: false });
  }

  async function eticheta() {
    // Fereastra se deschide ÎNAINTE de cerere: deschisă după un `await`,
    // browserul o consideră pop-up nesolicitat și o blochează.
    const w = window.open("", "_blank");
    setLucru("eticheta"); setMsg(null);
    const sb = sbBrowser();
    const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
    const r = token ? await fetch(`/api/awb?comanda_id=${o.id}`, { headers: { Authorization: `Bearer ${token}` } }) : null;
    setLucru("");
    if (!r || !r.ok || !(r.headers.get("content-type") ?? "").includes("pdf")) {
      w?.close();
      const j = r ? await r.json().catch(() => null) : null;
      setMsg({ text: j?.eroare ?? "Eticheta nu s-a putut descărca.", bun: false });
      return;
    }
    const url = URL.createObjectURL(await r.blob());
    if (w) w.location.href = url;
    else { const a = document.createElement("a"); a.href = url; a.download = `AWB-${o.awb}.pdf`; a.click(); }
  }

  async function sterge(doarAdmin = false) {
    const intrebare = doarAdmin
      ? `Scoți AWB-ul ${o.awb} doar din admin? La FAN rămâne cum e — șterge-l acolo din selfawb.ro dacă mai există.`
      : `Ștergi AWB-ul ${o.awb} la FAN Courier și din comandă? Poți genera altul după.`;
    if (!confirm(intrebare)) return;
    setLucru("sterge"); setMsg(null);
    const j = await cere({ actiune: "sterge", comanda_id: o.id, doar_admin: doarAdmin });
    setLucru("");
    if (j.ok) {
      setPotDoarAdmin(false);
      setMsg({ text: j.rezultat === "nu_exista" ? "✓ AWB-ul nu mai exista la FAN; a fost scos din comandă."
        : j.rezultat === "doar_admin" ? "✓ AWB-ul a fost scos din admin." : "✓ AWB șters la FAN și din comandă.", bun: true });
      laSchimbare();
    } else {
      setPotDoarAdmin(!!j.poate_doar_admin);
      setMsg({ text: j.eroare ?? "Nu s-a putut șterge.", bun: false });
    }
  }

  const panouAdresa = (
    <>
      <button type="button" onClick={() => setAdresaDeschisa(!adresaDeschisa)} className="text-[12px] text-acc font-semibold text-left">
        {adresaDeschisa ? "▾" : "▸"} Adresa: {adresa.localitate}, jud. {adresa.judet}{adresaModificata ? " (corectată)" : ""}</button>
      {adresaDeschisa && (
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-paper p-2.5">
          {/* Din nomenclatorul FAN: o localitate aleasă de aici nu mai poate fi refuzată la AWB. */}
          <AlegeAdresa stil="admin" cuStrada={false} value={{ judet: adresa.judet, localitate: adresa.localitate, strada: "", numar: "" }}
            onChange={(a) => { setAdresa((v) => ({ ...v, judet: a.judet, localitate: a.localitate })); setTarif(null); }} />
          <label className="text-[11px] text-mut col-span-2">Strada, număr, bloc<input value={adresa.strada} onChange={(e) => schimbaAdresa("strada", e.target.value)} className={camp} /></label>
          <label className="text-[11px] text-mut col-span-2">Telefon<input value={adresa.telefon} onChange={(e) => schimbaAdresa("telefon", e.target.value)} className={camp} /></label>
        </div>
      )}
    </>
  );

  const d = o.awb_date;
  const pasCalcul = !o.awb && o.status !== "anulata" && (!livrareStabilita || recalculez);
  const pasAwb = !o.awb && o.status !== "anulata" && livrareStabilita && !recalculez;
  // Kilogramele de la AWB trebuie să fie cele din calcul, altfel FAN facturează
  // altceva decât i s-a spus clientului.
  const altaGreutate = pasAwb && (Number(colet.greutate.replace(",", ".")) !== Number(o.livrare_greutate_kg)
    || (textDimensiuni(colet) ?? "") !== (o.livrare_dimensiuni ?? ""));

  return (
    <div className={`card p-5 text-sm ${pasCalcul && !recalculez ? "border-2 border-yellow-300" : ""}`}>
      <b className="font-disp font-semibold text-[13px]">Livrare — FAN Courier</b>

      {/* ---------- 1. calculatorul ---------- */}
      {pasCalcul && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-mut">Scrie coletul și calculează. Prețul e cel al FAN pentru contul firmei, pentru adresa clientului.</p>
          <CampuriColet v={colet} set={schimbaColet} />
          {panouAdresa}
          <button type="button" onClick={calculeaza} disabled={!!lucru} className="btn-acc w-full !py-2.5 text-sm">
            {lucru === "tarif" ? "Se calculează la FAN…" : "Calculează transportul"}</button>

          {tarif && (
            <div className="space-y-2 pt-1">
              <DefalcareTarif t={tarif} />
              <label className="block text-[11px] text-mut">Transport pentru client (lei) <span>— poți rotunji, sau 0 dacă ridică personal</span>
                <input inputMode="decimal" value={pret} onChange={(e) => setPret(e.target.value)} className={camp} /></label>
              <div className="rounded-lg bg-ink/5 px-3 py-2 text-[13px]">
                <div className="flex justify-between text-mut"><span>Piese — ramburs, încasați voi</span><span>{bani(produse)}</span></div>
                <div className="flex justify-between text-mut"><span>Transport — îl încasează FAN</span><span>{bani(Number(pret.replace(",", ".")) || 0)}</span></div>
                <div className="flex justify-between font-bold text-ink text-base"><span>Clientul plătește curierului</span>
                  <span>{bani(produse + (Number(pret.replace(",", ".")) || 0))}</span></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <a href={`tel:${o.telefon}`} className="rounded-xl border-2 border-line px-3 py-2 text-xs font-bold text-center hover:border-acc">📞 Sună {o.telefon}</a>
                <button type="button" onClick={accepta} disabled={!!lucru} className="btn-acc !py-2 text-xs">
                  {lucru === "accept" ? "Se salvează…" : "✓ Clientul a acceptat"}</button>
              </div>
              <p className="text-[11px] text-mut">Nu e de acord? Anulează comanda din butonul de sus — piesele revin pe site.</p>
            </div>
          )}
          {recalculez && <button type="button" onClick={() => { setRecalculez(false); setTarif(null); }} className="text-[12px] text-mut">← Renunț, păstrez costul salvat</button>}
        </div>
      )}

      {/* ---------- 2. AWB-ul ---------- */}
      {pasAwb && (
        <div className="mt-3 space-y-2">
          <div className="rounded-lg bg-ok/5 border border-ok/30 px-3 py-2 text-[13px]">
            <div className="flex justify-between"><span className="text-mut">Piese — ramburs pe AWB</span><b>{lei(produse)}</b></div>
            <div className="flex justify-between"><span className="text-mut">Transport acceptat — îl încasează FAN</span><b>{lei(Number(o.livrare))}</b></div>
            <div className="flex justify-between"><span className="text-mut">Clientul plătește curierului</span><b>{lei(produse + Number(o.livrare))}</b></div>
            {o.livrare_nota && <div className="text-[11px] text-mut mt-0.5">{o.livrare_nota}</div>}
            <button type="button" onClick={() => setRecalculez(true)} className="text-[12px] text-acc font-semibold mt-1">↺ Recalculează transportul</button>
          </div>
          <CampuriColet v={colet} set={setColet} />
          {altaGreutate && (
            <p className="text-[12px] text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-lg px-2.5 py-1.5">
              Coletul diferă de cel din calcul ({o.livrare_greutate_kg} kg{o.livrare_dimensiuni ? `, ${o.livrare_dimensiuni} cm` : ", fără dimensiuni"}). FAN va factura după ce scrii aici — recalculează dacă prețul se schimbă.</p>
          )}
          <label className="block text-[11px] text-mut">Ramburs (lei) — doar piesele; transportul îl plătește clientul direct la FAN
            <input inputMode="decimal" value={ramburs ?? (o.plata === "ramburs" ? String(produse) : "0")} onChange={(e) => setRamburs(e.target.value)} className={camp} /></label>
          <label className="block text-[11px] text-mut">Observații pentru curier (opțional)
            <input value={observatii} onChange={(e) => setObservatii(e.target.value)} maxLength={200} placeholder="ex. sunați înainte cu 30 de minute" className={camp} /></label>
          {panouAdresa}
          <button type="button" onClick={genereaza} disabled={!!lucru} className="btn-acc w-full !py-2.5 text-sm">
            {lucru === "awb" ? "Se generează la FAN…" : "Generează AWB"}</button>
          <details className="text-[12px] text-mut">
            <summary className="cursor-pointer">Ai făcut AWB-ul direct pe selfawb.ro?</summary>
            <div className="mt-2 flex gap-2">
              <input id={`awb-manual-${o.id}`} placeholder="Numărul AWB" className="flex-1 rounded-xl border-2 border-line px-3 py-1.5 outline-none focus:border-acc" />
              <button type="button" className="rounded-xl border-2 border-line px-3 text-xs font-bold hover:border-acc"
                onClick={() => { const v = (document.getElementById(`awb-manual-${o.id}`) as HTMLInputElement | null)?.value.trim(); if (v) salveazaManual(v); }}>
                Salvează</button>
            </div>
          </details>
        </div>
      )}

      {/* ---------- 3. AWB generat ---------- */}
      {o.awb && (
        <div className="mt-3 space-y-3">
          <div className="rounded-lg bg-ok/5 border border-ok/30 px-3 py-2.5">
            <span className="text-[11px] text-mut block">AWB</span>
            <b className="font-disp text-lg text-ok tracking-wide">{o.awb}</b>
            {d && (
              <span className="block text-[12px] text-mut mt-1">
                {d.colete} {d.colete === 1 ? "colet" : "colete"} · {d.greutate} kg{d.lungime ? <> · {d.lungime}×{d.latime}×{d.inaltime} cm</> : null}
                · ramburs {lei(Number(d.ramburs))}{d.tarif > 0 && <> · FAN a taxat {bani(d.tarif + d.tva)}</>}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={eticheta} disabled={!!lucru} className="btn-acc !py-2 text-xs">
              {lucru === "eticheta" ? "Se descarcă…" : "🖨 Printează eticheta"}</button>
            <a href={d?.tracking ?? `https://www.fancourier.ro/awb-tracking/?tracking=${o.awb}`} target="_blank" rel="noopener noreferrer"
              className="rounded-xl border-2 border-line px-3 py-2 text-xs font-bold text-center hover:border-acc">Urmărește coletul</a>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <button type="button" onClick={() => sterge(false)} disabled={!!lucru} className="text-[12px] text-red-600 font-semibold">
              {lucru === "sterge" ? "Se șterge…" : "Șterge AWB-ul (greșit)"}</button>
            {/* Apare doar după ce FAN a refuzat ștergerea (ex. AWB de pe alt cont). */}
            {potDoarAdmin && (
              <button type="button" onClick={() => sterge(true)} disabled={!!lucru} className="text-[12px] text-steel font-semibold underline underline-offset-2">
                Scoate AWB-ul doar din admin</button>
            )}
          </div>
        </div>
      )}

      {o.status === "anulata" && !o.awb && <p className="mt-2 text-xs text-mut">Comanda e anulată.</p>}
      {msg && <p className={`mt-2 text-[13px] ${msg.bun ? "text-ok" : "text-red-600"}`}>{msg.text}</p>}
    </div>
  );
}
