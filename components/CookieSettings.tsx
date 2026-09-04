"use client";
// ============================================================
// Panoul din pagina „Setări cookie-uri" — schimbi alegerea oricând.
//
// Două comutatoare independente, fiindcă sunt două scopuri diferite:
// măsurarea traficului (Google Analytics) și urmărirea pentru reclame (Google
// Ads, Meta Pixel). Fiecare pornește și oprește pe loc instrumentul lui, în
// ambele sensuri — la oprire pleacă un `consent update: denied` și se șterg
// cookie-urile grupului retras.
// ============================================================
import { useEffect, useState } from "react";
import { citesteConsimtamant, scrieConsimtamant, areVoieStatistica, areVoieMarketing,
         alegereDin, type Consimtamant } from "@/lib/consimtamant";

export default function CookieSettings() {
  const [val, setVal] = useState<Consimtamant>("nesetat");
  useEffect(() => { setVal(citesteConsimtamant()); }, []);

  const statistica = areVoieStatistica(val);
  const marketing = areVoieMarketing(val);
  const set = (s: boolean, m: boolean) => { const v = alegereDin(s, m); scrieConsimtamant(v); setVal(v); };

  const eticheta =
    val === "toate" ? "toate cookie-urile"
    : val === "statistica" ? "doar statistică"
    : val === "marketing" ? "doar publicitate"
    : val === "necesare" ? "doar cele necesare"
    : "încă nealeasă";

  const Comutator = ({ pornit, actiune, nume }: { pornit: boolean; actiune: () => void; nume: string }) => (
    <button onClick={actiune} aria-label={nume} aria-pressed={pornit}
      className={`w-12 h-7 rounded-full relative transition shrink-0 ${pornit ? "bg-ok" : "bg-chenar"}`}>
      <span className={`absolute top-1 w-5 h-5 rounded-full bg-suprafata shadow transition-all ${pornit ? "right-1" : "left-1"}`} />
    </button>
  );

  return (
    <div className="bg-suprafata border border-chenar rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-4 pb-3 border-b border-chenar">
        <div><b>Strict necesare</b><p className="text-sm text-textSecundar">Coșul de cumpărături și sesiunea. Nu pot fi oprite.</p></div>
        <span className="text-ok font-bold text-sm">Mereu active</span>
      </div>
      <div className="flex items-center justify-between gap-4 pb-3 border-b border-chenar">
        <div><b>Statistică</b><p className="text-sm text-textSecundar">Măsurarea anonimă a vizitelor, cu Google Analytics.</p></div>
        <Comutator pornit={statistica} nume="comută statistică" actiune={() => set(!statistica, marketing)} />
      </div>
      <div className="flex items-center justify-between gap-4">
        <div><b>Publicitate</b><p className="text-sm text-textSecundar">Google Ads și Meta (Facebook, Instagram), ca reclamele să fie relevante și ca să știm care dintre ele aduc comenzi.</p></div>
        <Comutator pornit={marketing} nume="comută publicitate" actiune={() => set(statistica, !marketing)} />
      </div>
      <p className="text-xs text-textSecundar">Alegerea curentă: <b>{eticheta}</b> — salvată instant.</p>
    </div>
  );
}
