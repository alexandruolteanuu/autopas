"use client";
// AWB FAN COURIER — cardul „Expediere" din pagina comenzii.
//
// Gândit să fie RAPID: operatorul scrie doar ce cere FAN la un colet — câte
// colete, kilograme și cele trei dimensiuni — și apasă un buton. Restul vine
// din comandă: destinatarul, rambursul (totalul comenzii, cu transportul) și
// conținutul (numele pieselor).
//
// Greutatea NU se ia din piese (decizia proprietarului, 15 septembrie 2026):
// piesele importate au 1 kg pus automat, iar un colet se cântărește. Dacă
// operatorul a scris deja greutatea și dimensiunile la „Cost livrare" pentru
// comanda ASTA, câmpurile pornesc de la ele — tot o valoare scrisă de om.
import { useState } from "react";
import { sbBrowser } from "@/lib/supabase";
import { lei } from "@/lib/format";
import type { OrderFull } from "@/lib/types";

type Props = { o: OrderFull; continut: string; laSchimbare: () => void; salveazaManual: (awb: string) => void };

async function token() {
  const sb = sbBrowser();
  return sb ? (await sb.auth.getSession()).data.session?.access_token ?? null : null;
}

/** „40×30×25", „40x30x25", „40 30 25" -> [40, 30, 25]. */
function dimensiuni(text: string | null) {
  const n = (text ?? "").match(/\d+([.,]\d+)?/g) ?? [];
  return [n[0] ?? "", n[1] ?? "", n[2] ?? ""];
}

const camp = "w-full mt-0.5 rounded-lg border-2 border-line px-2.5 py-1.5 text-sm text-ink outline-none focus:border-acc";

export default function AwbFan({ o, continut, laSchimbare, salveazaManual }: Props) {
  const [lucru, setLucru] = useState<"" | "genereaza" | "eticheta" | "sterge">("");
  const [msg, setMsg] = useState<{ text: string; bun: boolean } | null>(null);
  const [adresa, setAdresa] = useState(false);
  const [L, l, h] = dimensiuni(o.livrare_dimensiuni);
  const livrareStabilita = Boolean(o.livrare_stabilit_la);

  async function trimite(corp: object) {
    const t = await token();
    if (!t) { setMsg({ text: "Sesiunea a expirat. Autentifică-te din nou.", bun: false }); return null; }
    const r = await fetch("/api/awb", { method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` }, body: JSON.stringify(corp) });
    return r.json().catch(() => ({ ok: false, eroare: `Serverul a răspuns cu ${r.status}.` }));
  }

  async function genereaza(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (lucru) return;
    const f = Object.fromEntries(new FormData(e.currentTarget).entries());
    setLucru("genereaza"); setMsg(null);
    const j = await trimite({
      actiune: "genereaza", comanda_id: o.id,
      colet: { colete: f.colete, greutate: f.greutate, lungime: f.lungime, latime: f.latime, inaltime: f.inaltime,
               ramburs: f.ramburs, continut: f.continut, observatii: f.observatii },
      // Adresa se trimite doar dacă omul a deschis-o: altfel serverul o ia din comandă.
      destinatar: adresa ? { telefon: f.telefon, judet: f.judet, localitate: f.localitate, strada: f.strada } : undefined,
    });
    setLucru("");
    if (j?.ok) { setMsg({ text: `✓ AWB ${j.awb} generat.`, bun: true }); laSchimbare(); }
    else if (j) setMsg({ text: j.eroare ?? "Nu s-a putut genera AWB-ul.", bun: false });
  }

  async function eticheta() {
    if (lucru) return;
    // Fereastra se deschide ÎNAINTE de cerere: deschisă după un `await`,
    // browserul o consideră pop-up nesolicitat și o blochează.
    const w = window.open("", "_blank");
    setLucru("eticheta"); setMsg(null);
    const t = await token();
    const r = t ? await fetch(`/api/awb?comanda_id=${o.id}`, { headers: { Authorization: `Bearer ${t}` } }) : null;
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

  async function sterge() {
    if (lucru || !confirm(`Ștergi AWB-ul ${o.awb} la FAN Courier? Coletul nu mai poate fi ridicat pe el; poți genera altul după.`)) return;
    setLucru("sterge"); setMsg(null);
    const j = await trimite({ actiune: "sterge", comanda_id: o.id });
    setLucru("");
    if (j?.ok) { setMsg({ text: "✓ AWB șters.", bun: true }); laSchimbare(); }
    else if (j) setMsg({ text: j.eroare ?? "Nu s-a putut șterge.", bun: false });
  }

  const d = o.awb_date;
  return (
    <div className="card p-5 text-sm">
      <b className="font-disp font-semibold text-[13px]">Expediere — FAN Courier</b>

      {/* ---------- AWB generat ---------- */}
      {o.awb && (
        <div className="mt-3 space-y-3">
          <div className="rounded-lg bg-ok/5 border border-ok/30 px-3 py-2.5">
            <span className="text-[11px] text-mut block">AWB</span>
            <b className="font-disp text-lg text-ok tracking-wide">{o.awb}</b>
            {d && (
              <span className="block text-[12px] text-mut mt-1">
                {d.colete} {d.colete === 1 ? "colet" : "colete"} · {d.greutate} kg · {d.lungime}×{d.latime}×{d.inaltime} cm
                · ramburs {lei(Number(d.ramburs))}
                {d.tarif > 0 && <> · tarif FAN {lei(d.tarif + d.tva)} cu TVA</>}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={eticheta} disabled={!!lucru} className="btn-acc !py-2 text-xs">
              {lucru === "eticheta" ? "Se descarcă…" : "🖨 Printează eticheta"}</button>
            <a href={d?.tracking ?? `https://www.fancourier.ro/awb-tracking/?tracking=${o.awb}`} target="_blank" rel="noopener noreferrer"
              className="rounded-xl border-2 border-line px-3 py-2 text-xs font-bold text-center hover:border-acc">Urmărește coletul</a>
          </div>
          <button onClick={sterge} disabled={!!lucru} className="text-[12px] text-red-600 font-semibold">
            {lucru === "sterge" ? "Se șterge…" : "Șterge AWB-ul (greșit)"}</button>
        </div>
      )}

      {/* ---------- transportul nu e stabilit ---------- */}
      {!o.awb && !livrareStabilita && o.status !== "anulata" && (
        <p className="mt-3 rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2 text-xs text-yellow-800">
          Stabilește întâi costul livrării și confirmă-l cu clientul. Altfel rambursul de pe AWB
          ar fi altul decât suma pe care a acceptat-o.
        </p>
      )}

      {/* ---------- formularul ---------- */}
      {!o.awb && livrareStabilita && o.status !== "anulata" && (
        <form onSubmit={genereaza} className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] text-mut">Colete
              <input name="colete" type="number" min={1} step={1} defaultValue={1} required className={camp} /></label>
            <label className="text-[11px] text-mut">Greutate totală (kg)
              <input name="greutate" inputMode="decimal" required defaultValue={o.livrare_greutate_kg ?? ""} placeholder="ex. 4.5" className={camp} /></label>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <label className="text-[11px] text-mut">Lungime (cm)
              <input name="lungime" inputMode="numeric" required defaultValue={L} className={camp} /></label>
            <label className="text-[11px] text-mut">Lățime (cm)
              <input name="latime" inputMode="numeric" required defaultValue={l} className={camp} /></label>
            <label className="text-[11px] text-mut">Înălțime (cm)
              <input name="inaltime" inputMode="numeric" required defaultValue={h} className={camp} /></label>
          </div>
          <label className="block text-[11px] text-mut">Ramburs (lei) <span className="text-mut">— ce încasează curierul de la client</span>
            <input name="ramburs" inputMode="decimal" required defaultValue={o.plata === "ramburs" ? Number(o.total) : 0} className={camp} /></label>
          <label className="block text-[11px] text-mut">Conținut (apare pe AWB)
            <input name="continut" defaultValue={continut} maxLength={200} className={camp} /></label>
          <label className="block text-[11px] text-mut">Observații pentru curier <span className="text-mut">(opțional)</span>
            <input name="observatii" maxLength={200} placeholder="ex. sunați înainte cu 30 de minute" className={camp} /></label>

          {/* Adresa vine din comandă. Se deschide doar când FAN refuză o
              localitate sau clientul a dat la telefon altă adresă. */}
          <button type="button" onClick={() => setAdresa(!adresa)} className="text-[12px] text-acc font-semibold">
            {adresa ? "▾" : "▸"} Adresa destinatarului: {o.oras}, jud. {o.judet}</button>
          {adresa && (
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-paper p-2.5">
              <label className="text-[11px] text-mut">Telefon<input name="telefon" defaultValue={o.telefon} className={camp} /></label>
              <label className="text-[11px] text-mut">Județ<input name="judet" defaultValue={o.judet} className={camp} /></label>
              <label className="text-[11px] text-mut col-span-2">Localitate<input name="localitate" defaultValue={o.oras} className={camp} /></label>
              <label className="text-[11px] text-mut col-span-2">Strada, număr, bloc<input name="strada" defaultValue={o.adresa} className={camp} /></label>
            </div>
          )}

          <button disabled={!!lucru} className="btn-acc w-full !py-2.5 text-sm">
            {lucru === "genereaza" ? "Se generează la FAN…" : "Generează AWB"}</button>

          <details className="text-[12px] text-mut">
            <summary className="cursor-pointer">Ai făcut AWB-ul direct pe selfawb.ro?</summary>
            <div className="mt-2 flex gap-2">
              <input id={`awb-manual-${o.id}`} placeholder="Numărul AWB" className="flex-1 rounded-xl border-2 border-line px-3 py-1.5 outline-none focus:border-acc" />
              <button type="button" className="rounded-xl border-2 border-line px-3 text-xs font-bold hover:border-acc"
                onClick={() => { const v = (document.getElementById(`awb-manual-${o.id}`) as HTMLInputElement | null)?.value.trim(); if (v) salveazaManual(v); }}>
                Salvează</button>
            </div>
          </details>
        </form>
      )}

      {msg && <p className={`mt-2 text-[13px] ${msg.bun ? "text-ok" : "text-red-600"}`}>{msg.text}</p>}
    </div>
  );
}
