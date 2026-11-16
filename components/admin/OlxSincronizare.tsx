"use client";
// SINCRONIZAREA AUTOMATĂ OLX (pasul 3 din docs/olx-plan.md, migrarea 58) — cardul din
// Admin → Anunțuri OLX: pornit / oprit, ce așteaptă în coadă, ce s-a blocat și de ce,
// plasa de 20%, „Adu la zi” (diferențele strânse înainte de pornire) și golirea manuală.
// Coada nu are voie să fie invizibilă (lecția cozii de e-mail, 7 septembrie 2026).
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { sbBrowser } from "@/lib/supabase";

type Stare = {
  ok: boolean; eroare?: string; mesaj?: string;
  sincronizare: { activ: boolean; webhook_url: string | null; pornit_la: string | null; mesaj: string | null; mesaj_la: string | null } | null;
  coada: { total: number; de_facut: number; blocate: number; cel_mai_vechi: string | null; o_eroare: string | null; anunturi_vii: number; de_retras: number } | null;
  erori: { id: number; product_id: number | null; advert_id: number | null; motiv: string; incercari: number; eroare: string; cerut_la: string }[];
  de_retras_pe_motiv: Record<string, number>;
  prag: { vii: number; deRetras: number; procent: number; depasit: boolean };
};

async function cerere(cale: string, corp: Record<string, unknown>) {
  const sb = sbBrowser();
  const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
  const r = await fetch(cale, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` }, body: JSON.stringify(corp) });
  return r.json().catch(() => ({ ok: false, eroare: `Răspuns neașteptat (HTTP ${r.status}).` }));
}

const ora = (t: string | null) => (t ? new Date(t).toLocaleString("ro-RO", { timeZone: "Europe/Bucharest", dateStyle: "short", timeStyle: "short" }) : "—");

export default function OlxSincronizare({ laSchimbare }: { laSchimbare?: () => void }) {
  const [s, setS] = useState<Stare | null>(null);
  const [lucru, setLucru] = useState<string | null>(null);
  const [mesaj, setMesaj] = useState<{ ok: boolean; text: string } | null>(null);

  const citeste = useCallback(async () => {
    const r = await cerere("/api/olx", { actiune: "sincronizare-stare" });
    setS(r);
  }, []);
  useEffect(() => { citeste(); }, [citeste]);

  async function fa(eticheta: string, cale: string, corp: Record<string, unknown>) {
    setLucru(eticheta); setMesaj(null);
    const r = await cerere(cale, corp);
    if (cale === "/api/olx-coada") {
      const parti = [r.publicate && `${r.publicate} publicate`, r.actualizate && `${r.actualizate} actualizate`, r.reactivate && `${r.reactivate} reactivate`,
        r.retrase && `${r.retrase} retrase`, r.nimic && `${r.nimic} fără schimbare`].filter(Boolean).join(", ");
      setMesaj({ ok: !!r.ok && !r.oprit && !r.cereConfirmare,
        text: !r.ok ? r.eroare : r.nota ?? (r.oprit ? `Oprit: ${r.oprit}` : `✓ Lot trimis${parti ? `: ${parti}` : ""}${r.erori?.length ? `, ${r.erori.length} erori` : ""}. ` +
          (r.continua ? `Mai sunt ${r.ramase} — continuă singur.` : r.ramase ? `Mai sunt ${r.ramase}.` : "Coada e goală.")) });
    } else setMesaj({ ok: !!r.ok, text: r.ok ? r.mesaj : r.eroare });
    setLucru(null);
    await citeste(); laSchimbare?.();
  }

  if (!s) return <div className="card p-4 text-sm text-mut">Se citește sincronizarea OLX…</div>;
  if (!s.ok) return (
    <div className="card p-4 text-sm">
      <b className="font-disp">Sincronizarea automată</b>
      <p className="text-xs text-red-700 mt-1">{s.eroare ?? "Nu s-a putut citi."} (Migrarea 58, <code>supabase/olx-coada.sql</code>, trebuie rulată în Supabase.)</p>
    </div>
  );

  const activ = !!s.sincronizare?.activ;
  const c = s.coada;
  const retras = Object.entries(s.de_retras_pe_motiv).map(([m, n]) => `${n} ${m === "vândută" ? "vândute" : m === "ascunsă" ? "ascunse" : "șterse"}`).join(", ");

  return (
    <div className="card p-4 text-sm space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <b className="font-disp">Sincronizarea automată</b>
        <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${activ ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"}`}>
          {activ ? "● Pornită" : "○ Oprită"}</span>
        {activ && <span className="text-xs text-mut">din {ora(s.sincronizare?.pornit_la ?? null)}</span>}
        <button type="button" onClick={citeste} className="text-xs underline ml-auto">Reîncarcă</button>
      </div>

      <p className="text-xs text-mut">
        {activ
          ? "Orice piesă adăugată, modificată, vândută, ascunsă sau ștearsă pe site pleacă singură la OLX, în câteva secunde: piesa nouă primește anunț, prețul schimbat se actualizează, anunțul piesei vândute sau ascunse se retrage (dezactivat, sau trecut la „terminate” dacă e neplătit). Nu se șterge și nu se plătește nimic."
          : "Cât e oprită, schimbările pieselor se strâng în coadă și nu pleacă nimic la OLX. La pornire pleacă toate."}
      </p>

      {s.sincronizare?.mesaj && (
        <p className="text-xs rounded-lg border-2 border-amber-300 bg-amber-50 text-amber-900 p-2">
          ⚠ {s.sincronizare.mesaj} <span className="text-mut">({ora(s.sincronizare.mesaj_la)})</span></p>
      )}

      <div className="grid sm:grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg border border-line p-2"><div className="text-mut">În coadă</div>
          <b className="text-lg">{c?.de_facut ?? 0}</b>{c?.cel_mai_vechi && c.de_facut > 0 && <div className="text-mut">cel mai vechi: {ora(c.cel_mai_vechi)}</div>}</div>
        <div className={`rounded-lg border p-2 ${c?.blocate ? "border-red-300 bg-red-50" : "border-line"}`}><div className="text-mut">Blocate (5 eșecuri)</div>
          <b className={`text-lg ${c?.blocate ? "text-red-700" : ""}`}>{c?.blocate ?? 0}</b></div>
        <div className="rounded-lg border border-line p-2"><div className="text-mut">Anunțuri de retras</div>
          <b className="text-lg">{c?.de_retras ?? 0}</b> <span className="text-mut">din {c?.anunturi_vii ?? 0} vii</span>
          {retras && <div className="text-mut">{retras}</div>}</div>
      </div>

      {s.prag.depasit && (
        <div className="text-xs rounded-lg border-2 border-red-300 bg-red-50 text-red-800 p-2 space-y-2">
          <p>⚠ Ar trebui retrase {s.prag.deRetras} din {s.prag.vii} anunțuri ({(s.prag.procent * 100).toFixed(1)}%), peste pragul de 20%.
            Sincronizarea NU retrage nimic până nu confirmi — verifică întâi că piesele chiar au fost vândute / ascunse intenționat.</p>
          <button type="button" disabled={!!lucru || !activ} className="btn-dark !py-1.5 text-xs"
            onClick={() => { if (confirm(`Confirmi retragerea a ${s.prag.deRetras} anunțuri OLX?`)) fa("prag", "/api/olx-coada", { confirmatPrag: true }); }}>
            Confirm retragerea</button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {activ
          ? <button type="button" disabled={!!lucru} className="btn-sec !py-2 text-xs" onClick={() => fa("opreste", "/api/olx", { actiune: "sincronizare-opreste" })}>Oprește sincronizarea</button>
          : <button type="button" disabled={!!lucru} className="btn-dark !py-2 text-xs" onClick={() => fa("porneste", "/api/olx", { actiune: "sincronizare-porneste" })}>
              {lucru === "porneste" ? "Se pornește…" : "Pornește sincronizarea automată"}</button>}
        <button type="button" disabled={!!lucru} className="btn-sec !py-2 text-xs" title="Compară tot catalogul cu anunțurile OLX și pune în coadă ce diferă"
          onClick={() => fa("la-zi", "/api/olx", { actiune: "aduce-la-zi" })}>{lucru === "la-zi" ? "Se compară catalogul…" : "Adu OLX la zi cu site-ul"}</button>
        <button type="button" disabled={!!lucru || !activ || !c?.de_facut} className="btn-sec !py-2 text-xs"
          onClick={() => fa("acum", "/api/olx-coada", {})}>{lucru === "acum" ? "Se trimite un lot…" : "Trimite acum ce e în coadă"}</button>
        {!!c?.blocate && <button type="button" disabled={!!lucru} className="btn-sec !py-2 text-xs"
          onClick={() => fa("repune", "/api/olx", { actiune: "repune-blocate" })}>Reîncearcă blocatele</button>}
      </div>
      {mesaj && <p className={`text-xs ${mesaj.ok ? "text-ok" : "text-red-700"}`}>{mesaj.text}</p>}

      {s.erori.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer"><b>{s.erori.length}</b> {s.erori.length === 1 ? "rând cu eroare" : "rânduri cu erori"} în coadă</summary>
          <ul className="mt-1 space-y-1">
            {s.erori.map((e) => (
              <li key={e.id} className={e.incercari >= 5 ? "text-red-700" : ""}>
                {e.product_id ? <Link className="underline" href={`/admin/produse/${e.product_id}`}>piesa #{e.product_id}</Link> : <>anunțul #{e.advert_id} (piesă ștearsă)</>}
                {" "}· {e.incercari} {e.incercari === 1 ? "încercare" : "încercări"} · {e.eroare}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
