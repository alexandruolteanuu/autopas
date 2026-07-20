"use client";
// Autentificare + creare cont — Supabase Auth (email + parolă), 100% real.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { sbBrowser } from "@/lib/supabase";

export default function Autentificare() {
  const [mod, setMod] = useState<"login" | "register">("login");
  const [stare, setStare] = useState<"idle" | "trimit">("idle");
  const [msg, setMsg] = useState("");
  const router = useRouter();

  async function trimite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const sb = sbBrowser(); if (!sb) { setMsg("Baza de date nu e configurată."); return; }
    setStare("trimit"); setMsg("");
    const email = String(f.get("email")), password = String(f.get("parola"));
    if (mod === "register") {
      const { error } = await sb.auth.signUp({ email, password, options: { data: { nume: f.get("nume") } } });
      if (error) { setMsg(error.message); setStare("idle"); return; }
      setMsg("Cont creat! Dacă e cerută confirmarea, verifică e-mailul; altfel intră direct.");
      setMod("login"); setStare("idle");
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) { setMsg("E-mail sau parolă greșite."); setStare("idle"); return; }
      router.push("/cont");
    }
  }
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="dim justify-center">Contul meu</div>
      <h1 className="font-disp font-bold text-3xl mt-2 text-center">{mod === "login" ? "Autentificare" : "Creează cont"}</h1>
      <div className="flex gap-2 justify-center mt-4">
        {(["login","register"] as const).map((m) => (
          <button key={m} onClick={() => { setMod(m); setMsg(""); }}
            className={`px-4 py-2 rounded-lg text-sm font-bold border-2 ${mod === m ? "border-acc text-acc bg-acc/5" : "border-line"}`}>
            {m === "login" ? "Am cont" : "Sunt client nou"}</button>
        ))}
      </div>
      <form onSubmit={trimite} className="card p-5 mt-5 grid gap-3">
        {mod === "register" && <div className="fld"><label>Nume complet *</label><input name="nume" required /></div>}
        <div className="fld"><label>E-mail *</label><input name="email" type="email" required /></div>
        <div className="fld"><label>Parolă * <span className="font-normal text-mut">(min. 6 caractere)</span></label><input name="parola" type="password" minLength={6} required /></div>
        <button disabled={stare === "trimit"} className="btn-acc">{stare === "trimit" ? "Un moment…" : mod === "login" ? "Intră în cont" : "Creează contul"}</button>
        {msg && <p className="text-sm text-center text-steel">{msg}</p>}
        <p className="text-xs text-mut text-center">Comenzile plasate cu acest e-mail apar automat în contul tău.</p>
      </form>
    </div>
  );
}
