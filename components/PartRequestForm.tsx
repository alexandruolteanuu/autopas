"use client";
// Formularul „Caut o piesă" — scrie REAL în tabela part_requests din Supabase.
import { useState } from "react";
import { sbBrowser } from "@/lib/supabase";

export default function PartRequestForm({ sursa, dark = false }: { sursa: string; dark?: boolean }) {
  const [stare, setStare] = useState<"idle" | "trimit" | "ok" | "eroare">("idle");
  async function trimite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const sb = sbBrowser();
    if (!sb) { setStare("eroare"); return; }
    setStare("trimit");
    const { error } = await sb.from("part_requests").insert({
      nume: f.get("nume"), telefon: f.get("telefon"), email: f.get("email") || null,
      masina: f.get("masina"), piesa: f.get("piesa"), mesaj: f.get("mesaj") || null, sursa,
    });
    setStare(error ? "eroare" : "ok");
    if (!error) (e.target as HTMLFormElement).reset();
  }
  if (stare === "ok")
    return <div className={`rounded-xl p-6 text-center ${dark ? "bg-white/10" : "card"}`}>
      <b className="text-ok text-lg">✓ Cererea a fost trimisă!</b>
      <p className={`text-sm mt-1 ${dark ? "text-white/70" : "text-mut"}`}>Îți verificăm stocul și revenim în cel mai scurt timp.</p></div>;
  return (
    <form onSubmit={trimite} className={`rounded-xl p-5 grid sm:grid-cols-2 gap-3 ${dark ? "bg-white text-ink shadow-card" : "card"}`}>
      <div className="fld"><label>Nume *</label><input name="nume" required /></div>
      <div className="fld"><label>Telefon *</label><input name="telefon" required /></div>
      <div className="fld"><label>E-mail</label><input name="email" type="email" /></div>
      <div className="fld"><label>Mașina (marcă, model, an, motor) *</label><input name="masina" required placeholder="ex. Dacia Duster 1.5 dCi 2016" /></div>
      <div className="fld sm:col-span-2"><label>Piesa căutată *</label><input name="piesa" required placeholder="ex. electromotor / cod OEM" /></div>
      <div className="fld sm:col-span-2"><label>Detalii</label><textarea name="mesaj" rows={2} /></div>
      <button disabled={stare === "trimit"} className="btn-acc sm:col-span-2">{stare === "trimit" ? "Se trimite…" : "Trimite cererea"}</button>
      {stare === "eroare" && <p className="text-red-600 text-sm sm:col-span-2">A apărut o eroare — verifică datele sau sună-ne direct.</p>}
    </form>
  );
}
