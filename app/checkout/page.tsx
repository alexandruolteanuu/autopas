"use client";
// CHECKOUT — comanda se scrie REAL în Supabase (orders + order_items).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/CartContext";
import { sbBrowser } from "@/lib/supabase";
import { lei, CURIERI, nrComanda } from "@/lib/format";
import Link from "next/link";

export default function Checkout() {
  const { items, total, clear } = useCart();
  const router = useRouter();
  const [tip, setTip] = useState<"pf" | "firma">("pf");
  const [curier, setCurier] = useState("fan");
  const [plata, setPlata] = useState("ramburs");
  const [stare, setStare] = useState<"idle" | "trimit" | "eroare">("idle");
  const [msg, setMsg] = useState("");

  const livrare = CURIERI.find((c) => c.id === curier)!.pret;

  async function trimite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const sb = sbBrowser();
    if (!sb) { setStare("eroare"); setMsg("Baza de date nu e configurată (vezi README)."); return; }
    if (items.length === 0) { router.push("/cos"); return; }
    setStare("trimit");
    const numar = nrComanda();
    const { data: ord, error } = await sb.from("orders").insert({
      numar, tip_client: tip,
      nume: f.get("nume"), email: f.get("email"), telefon: f.get("telefon"),
      firma: tip === "firma" ? f.get("firma") : null, cui: tip === "firma" ? f.get("cui") : null,
      adresa: f.get("adresa"), oras: f.get("oras"), judet: f.get("judet"),
      curier, plata, subtotal: total, livrare, total: total + livrare,
      gdpr: f.get("gdpr") === "on",
    }).select("id").single();
    if (error || !ord) { setStare("eroare"); setMsg(error?.message ?? "Eroare la salvare."); return; }
    const { error: e2 } = await sb.from("order_items").insert(
      items.map((i) => ({ order_id: ord.id, product_id: i.id, nume: i.nume, pret: i.pret, cantitate: i.cantitate })));
    if (e2) { setStare("eroare"); setMsg(e2.message); return; }
    clear();
    router.push(`/comanda-plasata?nr=${numar}&email=${encodeURIComponent(String(f.get("email")))}`);
  }

  if (items.length === 0 && stare === "idle")
    return <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="font-disp font-bold text-2xl">Coșul e gol</h1>
      <Link href="/piese" className="btn-acc mt-5">Vezi piesele</Link></div>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="dim">Coș → <b className="text-ink">Livrare și plată</b> → Confirmare</div>
      <h1 className="font-disp font-bold text-3xl mt-2 mb-6">Finalizează comanda</h1>
      <form onSubmit={trimite} className="grid lg:grid-cols-[1fr,340px] gap-6 items-start">
        <div className="space-y-5">
          {/* 1. Datele tale */}
          <div className="card p-5">
            <b className="font-disp font-semibold text-[13px]">1 · Datele tale</b>
            <div className="flex gap-2 mt-3">
              {(["pf","firma"] as const).map((t) => (
                <button type="button" key={t} onClick={() => setTip(t)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold border-2 ${tip === t ? "border-acc bg-acc/5 text-acc" : "border-line"}`}>
                  {t === "pf" ? "Persoană fizică" : "Firmă (B2B)"}</button>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-3 mt-4">
              <div className="fld"><label>Nume complet *</label><input name="nume" required /></div>
              <div className="fld"><label>Telefon *</label><input name="telefon" required /></div>
              <div className="fld sm:col-span-2"><label>E-mail * <span className="font-normal text-mut">(aici primești confirmarea)</span></label><input name="email" type="email" required /></div>
              {tip === "firma" && (<>
                <div className="fld"><label>Denumirea firmei *</label><input name="firma" required /></div>
                <div className="fld"><label>CUI * <span className="font-normal text-mut">(nu cerem CNP)</span></label><input name="cui" required placeholder="RO…" /></div>
              </>)}
              <div className="fld sm:col-span-2"><label>Adresa de livrare *</label><input name="adresa" required /></div>
              <div className="fld"><label>Oraș *</label><input name="oras" required /></div>
              <div className="fld"><label>Județ *</label><input name="judet" required /></div>
            </div>
          </div>
          {/* 2. Curier */}
          <div className="card p-5">
            <b className="font-disp font-semibold text-[13px]">2 · Alege curierul</b>
            <div className="mt-3 space-y-2">
              {CURIERI.map((c) => (
                <label key={c.id} className={`flex items-center gap-3 rounded-lg border-2 px-4 py-3 cursor-pointer ${curier === c.id ? "border-acc bg-acc/5" : "border-line"}`}>
                  <input type="radio" name="curier" checked={curier === c.id} onChange={() => setCurier(c.id)} />
                  <span className="flex-1"><b>{c.nume}</b> <span className="text-mut text-sm">· {c.detalii}</span></span>
                  <b className="font-disp">{lei(c.pret)}</b>
                </label>
              ))}
              <p className="text-xs text-mut">Piesele voluminoase (motoare, cutii) se livrează paletizat — te contactăm cu costul exact. Detalii în <Link href="/legal/livrare" className="text-acc font-semibold">pagina Livrare</Link>.</p>
            </div>
          </div>
          {/* 3. Plata */}
          <div className="card p-5">
            <b className="font-disp font-semibold text-[13px]">3 · Metoda de plată</b>
            <div className="mt-3 space-y-2">
              {[["ramburs","Ramburs la curier","plătești când primești piesa"],["transfer","Transfer bancar","primești proforma pe e-mail"]].map(([id,t,d]) => (
                <label key={id} className={`flex items-center gap-3 rounded-lg border-2 px-4 py-3 cursor-pointer ${plata === id ? "border-acc bg-acc/5" : "border-line"}`}>
                  <input type="radio" name="plata" checked={plata === id} onChange={() => setPlata(id)} />
                  <span><b>{t}</b> <span className="text-mut text-sm">· {d}</span></span>
                </label>
              ))}
              <p className="text-xs text-mut">Plata cu cardul online va fi activată după conectarea procesatorului de plăți.</p>
            </div>
          </div>
          {/* 4. GDPR */}
          <div className="card p-5 space-y-2 text-sm">
            <label className="flex gap-3 items-start"><input type="checkbox" required className="mt-1" />
              <span>Am citit și sunt de acord cu <Link href="/legal/termeni-si-conditii" className="text-acc font-semibold">Termenii și condițiile</Link> și cu <Link href="/legal/politica-de-retur" className="text-acc font-semibold">Politica de retur</Link>. *</span></label>
            <label className="flex gap-3 items-start"><input type="checkbox" name="gdpr" className="mt-1" />
              <span className="text-mut">Sunt de acord să primesc, ocazional, oferte pe e-mail (opțional).</span></label>
          </div>
        </div>
        {/* Sumar */}
        <div className="card p-5 space-y-3 text-sm lg:sticky lg:top-24">
          <b className="font-disp font-semibold text-[13px]">Comanda ta</b>
          {items.map((i) => (
            <div key={i.id} className="flex justify-between gap-3"><span className="text-mut">{i.nume.slice(0, 42)}…</span><b className="whitespace-nowrap">{lei(i.pret)}</b></div>
          ))}
          <div className="flex justify-between border-t border-line pt-3"><span>Livrare — {CURIERI.find(c=>c.id===curier)!.nume}</span><b>{lei(livrare)}</b></div>
          <div className="flex justify-between text-base"><span>Total {plata === "ramburs" ? "de plată la livrare" : ""}</span>
            <b className="font-disp text-2xl text-acc">{lei(total + livrare)}</b></div>
          <button disabled={stare === "trimit"} className="btn-acc w-full">{stare === "trimit" ? "Se plasează…" : "Plasează comanda"}</button>
          {stare === "eroare" && <p className="text-red-600 text-xs">{msg}</p>}
          <p className="text-xs text-mut text-center">Comanda se salvează securizat. Nu cerem date de card.</p>
        </div>
      </form>
    </div>
  );
}
