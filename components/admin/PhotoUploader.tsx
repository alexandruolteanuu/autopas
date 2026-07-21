"use client";
// Încărcarea pozelor reale în Supabase Storage (bucket „poze-piese").
// Prima poză e cea principală; se poate reordona și șterge.
import { useState } from "react";
import { sbBrowser } from "@/lib/supabase";

export default function PhotoUploader({ poze, setPoze }: { poze: string[]; setPoze: (p: string[]) => void }) {
  const [lucru, setLucru] = useState(false);
  const [msg, setMsg] = useState("");

  async function incarca(files: FileList) {
    const sb = sbBrowser(); if (!sb) return;
    setLucru(true); setMsg("");
    const noi: string[] = [];
    for (const f of Array.from(files)) {
      if (f.size > 8 * 1024 * 1024) { setMsg(`„${f.name}" depășește 8 MB — sărită.`); continue; }
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const cale = `${new Date().getFullYear()}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await sb.storage.from("poze-piese").upload(cale, f, { cacheControl: "31536000", upsert: false });
      if (error) { setMsg("Eroare la încărcare: " + error.message); continue; }
      noi.push(sb.storage.from("poze-piese").getPublicUrl(cale).data.publicUrl);
    }
    setPoze([...poze, ...noi]); setLucru(false);
  }

  async function sterge(url: string) {
    const sb = sbBrowser(); if (!sb) return;
    const cale = url.split("/poze-piese/")[1];
    if (cale) await sb.storage.from("poze-piese").remove([cale]);
    setPoze(poze.filter((p) => p !== url));
  }

  function muta(i: number, dir: -1 | 1) {
    const n = [...poze]; const j = i + dir;
    if (j < 0 || j >= n.length) return;
    [n[i], n[j]] = [n[j], n[i]]; setPoze(n);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {poze.map((u, i) => (
          <div key={u} className="relative w-24 group">
            <img src={u} alt="" className="w-24 h-20 object-cover rounded-lg border-2 border-line" />
            {i === 0 && <span className="absolute top-1 left-1 bg-acc text-white text-[9px] font-bold px-1.5 py-0.5 rounded">principală</span>}
            <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition bg-ink/70 rounded-b-lg py-0.5">
              <button type="button" onClick={() => muta(i, -1)} className="text-white text-xs px-1">←</button>
              <button type="button" onClick={() => sterge(u)} className="text-white text-xs px-1">✕</button>
              <button type="button" onClick={() => muta(i, 1)} className="text-white text-xs px-1">→</button>
            </div>
          </div>
        ))}
        <label className={`w-24 h-20 rounded-lg border-2 border-dashed border-line grid place-items-center cursor-pointer hover:border-acc text-center ${lucru ? "opacity-50" : ""}`}>
          <span className="text-xs text-mut leading-tight">{lucru ? "se încarcă…" : "+ adaugă poze"}</span>
          <input type="file" accept="image/*" multiple className="hidden" disabled={lucru}
            onChange={(e) => { if (e.target.files?.length) incarca(e.target.files); e.target.value = ""; }} />
        </label>
      </div>
      <p className="text-[11px] text-mut mt-1.5">Poți face pozele direct cu telefonul. Prima poză apare pe card și în listări. Max. 8 MB/poză.</p>
      {msg && <p className="text-xs text-red-600 mt-1">{msg}</p>}
    </div>
  );
}
