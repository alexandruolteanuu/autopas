"use client";
// MĂRCI ȘI MODELE — administrate din interfață (până acum se puteau schimba doar din SQL).
import { useEffect, useState, useCallback } from "react";
import { sbBrowser } from "@/lib/supabase";
import type { Brand, Model } from "@/lib/types";

const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export default function Marci() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [nrPiese, setNrPiese] = useState<Record<number, number>>({});
  const [sel, setSel] = useState<number | null>(null);
  const [editB, setEditB] = useState<Brand | null>(null);
  const [editM, setEditM] = useState<Model | null>(null);
  const [msg, setMsg] = useState("");

  const incarca = useCallback(async () => {
    const sb = sbBrowser(); if (!sb) return;
    const [b, m, p] = await Promise.all([
      sb.from("brands").select("*").order("ordine"),
      sb.from("models").select("*").order("nume"),
      sb.from("products").select("model_ids").eq("publicat", true),
    ]);
    setBrands((b.data ?? []) as Brand[]); setModels((m.data ?? []) as Model[]);
    const c: Record<number, number> = {};
    ((p.data ?? []) as any[]).forEach((x) => (x.model_ids ?? []).forEach((id: number) => { c[id] = (c[id] ?? 0) + 1; }));
    setNrPiese(c);
  }, []);
  useEffect(() => { incarca(); }, [incarca]);

  async function salveazaMarca(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setMsg("");
    const f = new FormData(e.currentTarget); const sb = sbBrowser()!;
    const nume = String(f.get("nume"));
    const date = { nume, ordine: Number(f.get("ordine") || 99) };
    let error;
    if (editB) ({ error } = await sb.from("brands").update(date).eq("id", editB.id));
    else ({ error } = await sb.from("brands").insert({ ...date, slug: slugify(nume) }));
    setMsg(error ? "Eroare: " + error.message : "✓ Salvat.");
    if (!error) { setEditB(null); (e.target as HTMLFormElement).reset(); incarca(); }
  }

  async function salveazaModel(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setMsg("");
    const f = new FormData(e.currentTarget); const sb = sbBrowser()!;
    const nume = String(f.get("nume")); const brand_id = Number(f.get("brand"));
    let error;
    if (editM) ({ error } = await sb.from("models").update({ nume, brand_id }).eq("id", editM.id));
    else {
      const b = brands.find((x) => x.id === brand_id);
      ({ error } = await sb.from("models").insert({ nume, brand_id, slug: `${b?.slug ?? "x"}-${slugify(nume)}` }));
    }
    setMsg(error ? "Eroare: " + error.message : "✓ Salvat.");
    if (!error) { setEditM(null); (e.target as HTMLFormElement).reset(); incarca(); }
  }

  async function stergeMarca(b: Brand) {
    const n = models.filter((m) => m.brand_id === b.id).length;
    if (!confirm(`Ștergi „${b.nume}"?${n ? ` Se șterg și cele ${n} modele.` : ""}`)) return;
    const sb = sbBrowser()!;
    const { error } = await sb.from("brands").delete().eq("id", b.id);
    setMsg(error ? "Eroare: " + error.message : "✓ Șters."); setSel(null); incarca();
  }
  async function stergeModel(m: Model) {
    if (nrPiese[m.id]) { alert(`„${m.nume}" e folosit de ${nrPiese[m.id]} piese. Scoate-l întâi de pe ele.`); return; }
    if (!confirm(`Ștergi modelul „${m.nume}"?`)) return;
    const sb = sbBrowser()!;
    const { error } = await sb.from("models").delete().eq("id", m.id);
    setMsg(error ? "Eroare: " + error.message : "✓ Șters."); incarca();
  }

  const modeleSel = sel ? models.filter((m) => m.brand_id === sel) : [];

  return (
    <div className="space-y-4">
      <div><div className="dim">Administrare</div><h1 className="font-disp font-bold text-2xl mt-1">Mărci și modele</h1>
        <p className="text-sm text-mut mt-1">Alimentează filtrul Marcă → Model → Piesă de pe site și lista de compatibilitate de la piese.</p></div>

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        {/* Mărci */}
        <div className="card">
          <b className="font-disp font-semibold text-[13px] block px-4 py-3 border-b border-line">Mărci ({brands.length})</b>
          <div className="divide-y divide-line max-h-[460px] overflow-y-auto">
            {brands.map((b) => (
              <div key={b.id} className={`px-4 py-2.5 flex items-center gap-2 text-sm ${sel === b.id ? "bg-acc/5" : ""}`}>
                <button onClick={() => setSel(b.id)} className="flex-1 text-left font-semibold hover:text-acc">{b.nume}</button>
                <span className="text-xs text-mut">{models.filter((m) => m.brand_id === b.id).length} modele</span>
                <button onClick={() => setEditB(b)} className="text-mut hover:text-ink text-xs">✎</button>
                <button onClick={() => stergeMarca(b)} className="text-mut hover:text-red-600 text-xs">✕</button>
              </div>
            ))}
          </div>
          <form key={editB?.id ?? "b-nou"} onSubmit={salveazaMarca} className="p-4 border-t border-line grid gap-2 text-sm">
            <b className="text-[12px]">{editB ? `Editezi: ${editB.nume}` : "Marcă nouă"}</b>
            <div className="grid grid-cols-[1fr,70px] gap-2">
              <input name="nume" required placeholder="ex. Mercedes-Benz" defaultValue={editB?.nume}
                className="rounded-xl border-2 border-line px-3 py-2 outline-none focus:border-acc" />
              <input name="ordine" type="number" defaultValue={editB?.ordine ?? 99} title="ordine"
                className="rounded-xl border-2 border-line px-2 py-2 outline-none focus:border-acc" />
            </div>
            <div className="flex gap-2">
              <button className="btn-acc flex-1 !py-2 text-xs">{editB ? "Salvează" : "Adaugă marca"}</button>
              {editB && <button type="button" onClick={() => setEditB(null)} className="rounded-xl border-2 border-line px-3 text-xs">Renunț</button>}
            </div>
          </form>
        </div>

        {/* Modele */}
        <div className="card lg:col-span-2">
          <b className="font-disp font-semibold text-[13px] block px-4 py-3 border-b border-line">
            {sel ? `Modele — ${brands.find((b) => b.id === sel)?.nume}` : "Alege o marcă din stânga"}</b>
          <div className="divide-y divide-line max-h-[460px] overflow-y-auto">
            {modeleSel.map((m) => (
              <div key={m.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                <span className="flex-1">{m.nume}</span>
                <span className="text-xs text-mut">{nrPiese[m.id] ?? 0} piese</span>
                <button onClick={() => setEditM(m)} className="text-mut hover:text-ink text-xs">✎</button>
                <button onClick={() => stergeModel(m)} className="text-mut hover:text-red-600 text-xs">✕</button>
              </div>
            ))}
            {sel && modeleSel.length === 0 && <p className="p-6 text-center text-mut text-sm">Nicio model pentru această marcă.</p>}
          </div>
          <form key={editM?.id ?? "m-nou"} onSubmit={salveazaModel} className="p-4 border-t border-line grid sm:grid-cols-[160px,1fr,auto] gap-2 text-sm">
            <select name="brand" required defaultValue={editM?.brand_id ?? sel ?? ""}
              className="rounded-xl border-2 border-line px-3 py-2 outline-none focus:border-acc">
              <option value="">Marca…</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.nume}</option>)}
            </select>
            <input name="nume" required placeholder="ex. Clasa C W205 (2014–2021)" defaultValue={editM?.nume}
              className="rounded-xl border-2 border-line px-3 py-2 outline-none focus:border-acc" />
            <div className="flex gap-2">
              <button className="btn-acc !py-2 !px-4 text-xs">{editM ? "Salvează" : "Adaugă"}</button>
              {editM && <button type="button" onClick={() => setEditM(null)} className="rounded-xl border-2 border-line px-3 text-xs">Renunț</button>}
            </div>
          </form>
        </div>
      </div>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
