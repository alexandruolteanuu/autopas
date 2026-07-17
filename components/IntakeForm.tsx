"use client";
// Formular comun: predare mașină / Programul Rabla — scrie REAL în car_intake_requests.
import { useState } from "react";
import { sbBrowser } from "@/lib/supabase";

export default function IntakeForm({ tip }: { tip: "predare" | "rabla" }) {
  const [stare, setStare] = useState<"idle" | "trimit" | "ok" | "eroare">("idle");
  async function trimite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const sb = sbBrowser(); if (!sb) { setStare("eroare"); return; }
    setStare("trimit");
    const { error } = await sb.from("car_intake_requests").insert({
      tip, nume: f.get("nume"), telefon: f.get("telefon"), email: f.get("email") || null,
      masina: f.get("masina"), an: f.get("an") || null, vin: f.get("vin") || null, mesaj: f.get("mesaj") || null,
    });
    setStare(error ? "eroare" : "ok");
  }
  if (stare === "ok")
    return <div className="card p-8 text-center"><b className="text-ok text-lg">✓ Cererea a fost trimisă!</b>
      <p className="text-mut text-sm mt-1">Te sunăm în aceeași zi lucrătoare.</p></div>;
  return (
    <form onSubmit={trimite} className="card p-5 grid sm:grid-cols-2 gap-3">
      <div className="fld"><label>Nume *</label><input name="nume" required /></div>
      <div className="fld"><label>Telefon *</label><input name="telefon" required /></div>
      <div className="fld sm:col-span-2"><label>E-mail</label><input name="email" type="email" /></div>
      <div className="fld"><label>Mașina (marcă, model) *</label><input name="masina" required /></div>
      <div className="fld"><label>Anul fabricației</label><input name="an" /></div>
      <div className="fld sm:col-span-2"><label>Seria de șasiu (VIN) — opțional</label><input name="vin" /></div>
      <div className="fld sm:col-span-2"><label>Detalii (stare, dacă pornește, unde se află)</label><textarea name="mesaj" rows={2} /></div>
      <button disabled={stare === "trimit"} className="btn-acc sm:col-span-2">{stare === "trimit" ? "Se trimite…" : tip === "rabla" ? "Vreau certificatul Rabla" : "Cere evaluarea"}</button>
      {stare === "eroare" && <p className="text-red-600 text-sm sm:col-span-2">Eroare la trimitere — sună-ne direct: 0740 123 456.</p>}
    </form>
  );
}
