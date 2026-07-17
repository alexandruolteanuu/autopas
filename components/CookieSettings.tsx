"use client";
// Panoul din pagina "Setări cookie-uri" — schimbi alegerea oricând.
import { useEffect, useState } from "react";

export default function CookieSettings() {
  const [val, setVal] = useState<string>("");
  useEffect(() => { setVal(localStorage.getItem("autopas_cookies") ?? "nesetat"); }, []);
  const set = (v: string) => { localStorage.setItem("autopas_cookies", v); setVal(v); };
  return (
    <div className="bg-white border border-line rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-4 pb-3 border-b border-line">
        <div><b>Strict necesare</b><p className="text-sm text-mut">Coșul de cumpărături și sesiunea. Nu pot fi oprite.</p></div>
        <span className="text-ok font-bold text-sm">Mereu active</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <div><b>Statistică</b><p className="text-sm text-mut">Măsurarea anonimă a vizitelor.</p></div>
        <button onClick={() => set(val === "toate" ? "necesare" : "toate")}
          className={`w-12 h-7 rounded-full relative transition ${val === "toate" ? "bg-ok" : "bg-line"}`} aria-label="comută statistică">
          <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${val === "toate" ? "right-1" : "left-1"}`} />
        </button>
      </div>
      <p className="text-xs text-mut">Alegerea curentă: <b>{val === "toate" ? "toate cookie-urile" : val === "necesare" ? "doar cele necesare" : "încă nealeasă"}</b> — salvată instant.</p>
    </div>
  );
}
