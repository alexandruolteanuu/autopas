"use client";
import { useState } from "react";
import { sbBrowser } from "@/lib/supabase";

export default function ReturnForm() {
  const [stare, setStare] = useState<"idle" | "trimit" | "ok" | "eroare">("idle");
  async function trimite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const sb = sbBrowser(); if (!sb) { setStare("eroare"); return; }
    setStare("trimit");
    const { error } = await sb.from("return_requests").insert({
      numar_comanda: f.get("numar_comanda"), nume: f.get("nume"), email: f.get("email"),
      telefon: f.get("telefon") || null, produs: f.get("produs"), motiv: f.get("motiv"), iban: f.get("iban") || null,
    });
    setStare(error ? "eroare" : "ok");
  }
  if (stare === "ok") return <div className="card p-8 text-center"><b className="text-ok text-lg">✓ Cererea de retur a fost înregistrată!</b>
    <p className="text-mut text-sm mt-1">Primești pe e-mail confirmarea și instrucțiunile de expediere.</p></div>;
  return (
    <form onSubmit={trimite} className="card p-5 grid sm:grid-cols-2 gap-3">
      <div className="fld"><label>Numărul comenzii * <span className="font-normal text-mut">(ex. AP-2026-01847)</span></label><input name="numar_comanda" required /></div>
      <div className="fld"><label>Nume *</label><input name="nume" required /></div>
      <div className="fld"><label>E-mail *</label><input name="email" type="email" required /></div>
      <div className="fld"><label>Telefon</label><input name="telefon" /></div>
      <div className="fld sm:col-span-2"><label>Produsul returnat *</label><input name="produs" required /></div>
      <div className="fld sm:col-span-2"><label>Motivul returului *</label>
        <select name="motiv" required>
          <option value="">Alege…</option>
          <option>Renunț la cumpărare (14 zile, OUG 34/2014)</option>
          <option>Piesa nu se potrivește pe mașină</option>
          <option>Piesa este neconformă / nefuncțională</option>
          <option>Alt motiv</option>
        </select></div>
      <div className="fld sm:col-span-2"><label>IBAN pentru rambursare <span className="font-normal text-mut">(dacă ai plătit ramburs)</span></label><input name="iban" placeholder="RO…" /></div>
      <button disabled={stare === "trimit"} className="btn-acc sm:col-span-2">{stare === "trimit" ? "Se trimite…" : "Trimite cererea de retur"}</button>
      {stare === "eroare" && <p className="text-red-600 text-sm sm:col-span-2">Eroare la trimitere — scrie-ne la comenzi@autopas.ro.</p>}
    </form>
  );
}
