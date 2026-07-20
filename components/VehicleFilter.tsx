"use client";
// FILTRUL PRINCIPAL: Marcă → Model → Piesă — doar liste fixe, nimic scris de mână.
// Modelele se filtrează automat după marca aleasă.
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Brand, Model, Category } from "@/lib/types";

export default function VehicleFilter({ brands, models, cats, counts = {}, compact = false }:
  { brands: Brand[]; models: Model[]; cats: Category[]; counts?: Record<string, number>; compact?: boolean }) {
  // counts: numărul de piese pe modele ("m<id>") și pe mărci ("b<id>") — ghidează alegerea, fără fundături ascunse
  const router = useRouter();
  const [marca, setMarca] = useState("");
  const [model, setModel] = useState("");
  const brandSel = brands.find((b) => b.slug === marca);
  const modeleMarca = brandSel ? models.filter((m) => m.brand_id === brandSel.id) : [];

  function cauta(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const p = new URLSearchParams();
    if (marca) p.set("marca", marca);
    if (model) p.set("model", model);
    const cat = String(f.get("categorie") || "");
    if (cat) p.set("categorie", cat);
    router.push(`/piese?${p.toString()}`);
  }

  return (
    <form onSubmit={cauta}
      className={`bg-white rounded-xl p-4 grid gap-3 text-ink shadow-card ${compact ? "sm:grid-cols-[1fr,1fr,1fr,auto]" : "sm:grid-cols-2 lg:grid-cols-[1fr,1fr,1fr,auto]"}`}>
      <div className="fld">
        <label>1 · Marca</label>
        <select value={marca} onChange={(e) => { setMarca(e.target.value); setModel(""); }}>
          <option value="">Toate mărcile</option>
          {brands.map((b) => { const n = counts[`b${b.id}`] ?? 0;
            return <option key={b.id} value={b.slug}>{b.nume}{Object.keys(counts).length ? ` · ${n} piese` : ""}</option>; })}
        </select>
      </div>
      <div className="fld">
        <label>2 · Modelul</label>
        <select value={model} onChange={(e) => setModel(e.target.value)} disabled={!marca}>
          <option value="">{marca ? "Toate modelele" : "Alege întâi marca"}</option>
          {modeleMarca.map((m) => { const n = counts[`m${m.id}`] ?? 0;
            return <option key={m.id} value={m.slug}>{m.nume}{Object.keys(counts).length ? ` · ${n} piese` : ""}</option>; })}
        </select>
      </div>
      <div className="fld">
        <label>3 · Piesa</label>
        <select name="categorie">
          <option value="">Toate categoriile</option>
          {cats.map((c) => <option key={c.id} value={c.slug}>{c.nume}</option>)}
        </select>
      </div>
      <button className="btn-acc self-end h-[46px]">Caută piese</button>
    </form>
  );
}
