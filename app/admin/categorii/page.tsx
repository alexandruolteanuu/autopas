"use client";
// CATEGORII ȘI SUBCATEGORII — adăugare, editare, ștergere, ordonare.
// Meniul și filtrele de pe site se construiesc din ce e aici.
import { useEffect, useState, useCallback } from "react";
import { sbBrowser } from "@/lib/supabase";
import type { Category } from "@/lib/types";

const ARTE = ["engine","alternator","headlight","gearbox","turbo","mirror","egr","compressor","wheel","suspension","brake","seat","panel"];
const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export default function Categorii() {
  const [cats, setCats] = useState<Category[]>([]);
  const [nrPiese, setNrPiese] = useState<Record<number, number>>({});
  const [edit, setEdit] = useState<Category | null>(null);
  const [parinteNou, setParinteNou] = useState<number | null>(null);
  const [msg, setMsg] = useState("");

  const incarca = useCallback(async () => {
    const sb = sbBrowser(); if (!sb) return;
    const [c, v] = await Promise.all([
      sb.from("categories").select("*").order("ordine"),
      sb.from("categorii_cu_numar").select("id,nr_piese"),
    ]);
    setCats((c.data ?? []) as Category[]);
    const m: Record<number, number> = {};
    ((v.data ?? []) as any[]).forEach((x) => { m[x.id] = x.nr_piese; });
    setNrPiese(m);
  }, []);
  useEffect(() => { incarca(); }, [incarca]);

  async function salveaza(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setMsg("");
    const f = new FormData(e.currentTarget); const sb = sbBrowser()!;
    const nume = String(f.get("nume"));
    const parent = f.get("parent") ? Number(f.get("parent")) : null;
    const date: any = { nume, parent_id: parent, ordine: Number(f.get("ordine") || 0), art: String(f.get("art") || "engine") };
    let error;
    if (edit) ({ error } = await sb.from("categories").update(date).eq("id", edit.id));
    else {
      const baza = parent ? (cats.find((c) => c.id === parent)?.slug ?? "") + "-" : "";
      ({ error } = await sb.from("categories").insert({ ...date, slug: baza + slugify(nume), display_count: 0 }));
    }
    setMsg(error ? "Eroare: " + error.message : edit ? "✓ Categorie actualizată." : "✓ Categorie adăugată — apare imediat pe site.");
    if (!error) { setEdit(null); setParinteNou(null); (e.target as HTMLFormElement).reset(); incarca(); }
  }

  async function sterge(c: Category) {
    const copii = cats.filter((x) => x.parent_id === c.id).length;
    if (!confirm(`Ștergi „${c.nume}"?${copii ? ` Se șterg și cele ${copii} subcategorii.` : ""} Piesele rămân, dar fără categorie.`)) return;
    const sb = sbBrowser()!;
    await sb.from("products").update({ categorie_id: null }).eq("categorie_id", c.id);
    await sb.from("products").update({ subcategorie_id: null }).eq("subcategorie_id", c.id);
    const { error } = await sb.from("categories").delete().eq("id", c.id);
    setMsg(error ? "Eroare: " + error.message : "✓ Șters."); incarca();
  }

  const principale = cats.filter((c) => !c.parent_id);

  return (
    <div className="space-y-4">
      <div><div className="dim">Administrare</div><h1 className="font-disp font-bold text-2xl mt-1">Categorii</h1>
        <p className="text-sm text-mut mt-1">Categoriile și subcategoriile de aici alimentează meniul, filtrele și formularul de adăugare a pieselor.</p></div>

      <div className="grid lg:grid-cols-[1fr,340px] gap-4 items-start">
        <div className="card divide-y divide-line">
          {principale.map((c) => (
            <div key={c.id}>
              <div className="px-4 py-3 flex items-center gap-3 text-sm">
                <b className="flex-1">{c.nume}</b>
                <span className="text-xs text-mut">{nrPiese[c.id] ?? 0} piese</span>
                <button onClick={() => { setParinteNou(c.id); setEdit(null); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="text-acc text-xs font-semibold">+ subcategorie</button>
                <button onClick={() => { setEdit(c); setParinteNou(null); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="text-mut hover:text-ink text-xs">Editează</button>
                <button onClick={() => sterge(c)} className="text-mut hover:text-red-600 text-xs">Șterge</button>
              </div>
              {cats.filter((s) => s.parent_id === c.id).map((s) => (
                <div key={s.id} className="pl-10 pr-4 py-2 flex items-center gap-3 text-[13px] bg-paper/40 border-t border-line">
                  <span className="flex-1 text-steel">↳ {s.nume}</span>
                  <span className="text-xs text-mut">{nrPiese[s.id] ?? 0}</span>
                  <button onClick={() => { setEdit(s); setParinteNou(null); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="text-mut hover:text-ink text-xs">Editează</button>
                  <button onClick={() => sterge(s)} className="text-mut hover:text-red-600 text-xs">Șterge</button>
                </div>
              ))}
            </div>
          ))}
          {principale.length === 0 && <p className="p-8 text-center text-mut text-sm">Nicio categorie. Adaugă prima din dreapta.</p>}
        </div>

        <form key={edit?.id ?? parinteNou ?? "nou"} onSubmit={salveaza} className="card p-5 grid gap-3 text-sm lg:sticky lg:top-20">
          <b className="font-disp font-semibold text-[13px]">
            {edit ? `Editezi: ${edit.nume}` : parinteNou ? `Subcategorie în „${cats.find((c) => c.id === parinteNou)?.nume}"` : "Categorie nouă"}</b>
          <div className="fld"><label>Denumire *</label><input name="nume" required defaultValue={edit?.nume} /></div>
          <div className="fld"><label>Categoria-părinte</label>
            <select name="parent" defaultValue={edit?.parent_id ?? parinteNou ?? ""}>
              <option value="">— categorie principală —</option>
              {principale.filter((c) => c.id !== edit?.id).map((c) => <option key={c.id} value={c.id}>{c.nume}</option>)}
            </select></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="fld"><label>Ordine</label><input name="ordine" type="number" defaultValue={edit?.ordine ?? 99} /></div>
            <div className="fld"><label>Ilustrație</label>
              <select name="art" defaultValue={edit?.art ?? "engine"}>{ARTE.map((a) => <option key={a}>{a}</option>)}</select></div>
          </div>
          <div className="flex gap-2">
            <button className="btn-acc flex-1">{edit ? "Salvează" : "Adaugă"}</button>
            {(edit || parinteNou) && <button type="button" onClick={() => { setEdit(null); setParinteNou(null); }} className="rounded-xl border-2 border-line px-4">Renunț</button>}
          </div>
          {msg && <p className="text-xs text-center">{msg}</p>}
        </form>
      </div>
    </div>
  );
}
