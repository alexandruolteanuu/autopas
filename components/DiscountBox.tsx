"use client";
// Câmpul pentru codul de reducere — validarea se face pe SERVER (funcția valideaza_cod),
// ca valoarea să nu poată fi modificată din browser.
import { useState } from "react";
import { sbBrowser } from "@/lib/supabase";
import { lei } from "@/lib/format";

export type Reducere = { cod: string; valoare: number } | null;

export default function DiscountBox({ subtotal, reducere, setReducere }:
  { subtotal: number; reducere: Reducere; setReducere: (r: Reducere) => void }) {
  const [cod, setCod] = useState("");
  const [msg, setMsg] = useState("");
  const [lucru, setLucru] = useState(false);

  async function aplica(e: React.FormEvent) {
    e.preventDefault();
    const sb = sbBrowser(); if (!sb || !cod.trim()) return;
    setLucru(true); setMsg("");
    const { data, error } = await sb.rpc("valideaza_cod", { p_cod: cod.trim(), p_subtotal: subtotal });
    setLucru(false);
    if (error) { setMsg("Nu am putut verifica codul. Încearcă din nou."); return; }
    const r = data as { ok: boolean; mesaj: string; cod?: string; valoare?: number };
    if (r.ok && r.cod) { setReducere({ cod: r.cod, valoare: Number(r.valoare) }); setMsg(r.mesaj); setCod(""); }
    else { setReducere(null); setMsg(r.mesaj); }
  }

  if (reducere)
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl bg-ok/10 border border-ok/30 px-3 py-2 text-sm">
        <span className="min-w-0 break-words text-ok font-semibold">✓ {reducere.cod} — {lei(reducere.valoare)} reducere</span>
        <button onClick={() => { setReducere(null); setMsg(""); }} className="shrink-0 inline-flex items-center min-h-[44px] px-2 text-textSecundar hover:text-red-600 text-[13px]">elimină</button>
      </div>
    );
  return (
    <form onSubmit={aplica} className="space-y-1">
      <div className="flex gap-2">
        {/* `min-w-0` e obligatoriu: fără el, inputul nu coboară sub lățimea lui
            implicită (~180px), iar cardul de sumar nu se mai putea strânge —
            de acolo venea pagina împinsă în lateral pe telefon. */}
        <input value={cod} onChange={(e) => setCod(e.target.value.toUpperCase())} placeholder="Cod de reducere"
          autoComplete="off" aria-label="Cod de reducere"
          className="flex-1 min-w-0 rounded-lg border border-[rgb(var(--chenar-puternic))] bg-[rgb(var(--camp-bg))] px-3 min-h-[44px] text-base outline-none focus:border-accent uppercase" />
        <button disabled={lucru} className="shrink-0 rounded-lg border border-[rgb(var(--chenar-puternic))] px-4 min-h-[44px] text-sm font-semibold hover:border-accent">{lucru ? "…" : "Aplică"}</button>
      </div>
      {msg && <p className="text-[13px] text-textSecundar">{msg}</p>}
    </form>
  );
}
