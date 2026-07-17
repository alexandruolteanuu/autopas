"use client";
import { useState } from "react";
import { sbBrowser } from "@/lib/supabase";

export default function ContactForm() {
  const [stare, setStare] = useState<"idle" | "trimit" | "ok" | "eroare">("idle");
  async function trimite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const sb = sbBrowser(); if (!sb) { setStare("eroare"); return; }
    setStare("trimit");
    const { error } = await sb.from("contact_messages").insert({
      nume: f.get("nume"), email: f.get("email"), telefon: f.get("telefon") || null, mesaj: f.get("mesaj"),
    });
    setStare(error ? "eroare" : "ok");
  }
  if (stare === "ok") return <div className="card p-6 text-center"><b className="text-ok">✓ Mesajul a fost trimis!</b><p className="text-mut text-sm mt-1">Răspundem în aceeași zi lucrătoare.</p></div>;
  return (
    <form onSubmit={trimite} className="card p-5 grid gap-3">
      <div className="fld"><label>Nume *</label><input name="nume" required /></div>
      <div className="fld"><label>E-mail *</label><input name="email" type="email" required /></div>
      <div className="fld"><label>Telefon</label><input name="telefon" /></div>
      <div className="fld"><label>Mesaj *</label><textarea name="mesaj" rows={4} required /></div>
      <button disabled={stare === "trimit"} className="btn-acc">{stare === "trimit" ? "Se trimite…" : "Trimite mesajul"}</button>
      {stare === "eroare" && <p className="text-red-600 text-sm">Eroare — încearcă din nou sau sună-ne.</p>}
    </form>
  );
}
