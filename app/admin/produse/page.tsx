"use client";
// PRODUSE / INVENTAR — Sprint A: lista cu stoc + adăugarea completă (cu greutate, pentru AWB).
// Editarea, duplicarea și importul CSV sosesc în Sprint B.
import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { sbBrowser } from "@/lib/supabase";
import { lei } from "@/lib/format";
import type { Category, Vehicle, Brand, Model } from "@/lib/types";

type Prod = { id: number; nume: string; oem: string; pret_lei: number; stoc: number; publicat: boolean; slug: string;
  vizualizari: number; stare: string; stare_nota: string | null; ani: string | null; art: string;
  categorie_id: number | null; vehicul_id: number | null; compat: string[]; model_ids: number[];
  greutate_kg: number | null; cost_lei: number | null };

function ProduseInner() {
  const sp = useSearchParams();
  const [prods, setProds] = useState<Prod[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [cars, setCars] = useState<Vehicle[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [arataForm, setArataForm] = useState(sp.get("adauga") === "1");
  const [edit, setEdit] = useState<Prod | null>(null);

  const incarca = useCallback(async () => {
    const sb = sbBrowser(); if (!sb) return;
    let query = sb.from("products").select("*").order("created_at", { ascending: false }).limit(300);
    if (q.trim()) query = query.or(`oem.ilike.%${q}%,nume.ilike.%${q}%`);
    setProds(((await query).data ?? []) as Prod[]);
  }, [q]);
  useEffect(() => { const t = setTimeout(incarca, q ? 300 : 0); return () => clearTimeout(t); }, [incarca, q]);
  useEffect(() => {
    const sb = sbBrowser(); if (!sb) return;
    (async () => {
      setCats(((await sb.from("categories").select("*").order("ordine")).data ?? []) as Category[]);
      setCars(((await sb.from("vehicles").select("*").order("intrare", { ascending: false })).data ?? []) as Vehicle[]);
      setBrands(((await sb.from("brands").select("*").order("ordine")).data ?? []) as Brand[]);
      setModels(((await sb.from("models").select("*").order("nume")).data ?? []) as Model[]);
    })();
  }, []);

  async function comuta(p: Prod) {
    const sb = sbBrowser()!; await sb.from("products").update({ publicat: !p.publicat }).eq("id", p.id); incarca();
  }

  async function salveaza(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setMsg("");
    const f = new FormData(e.currentTarget); const sb = sbBrowser()!;
    const nume = String(f.get("nume"));
    const date = {
      nume, oem: f.get("oem"), stare: f.get("stare"), stare_nota: f.get("stare_nota") || null,
      pret_lei: Number(f.get("pret")), ani: f.get("ani") || null, art: f.get("art"),
      greutate_kg: Number(f.get("greutate")) || null, cost_lei: Number(f.get("cost")) || null,
      categorie_id: Number(f.get("categorie")) || null, vehicul_id: Number(f.get("vehicul")) || null,
      compat: String(f.get("compat") || "").split("\n").map((s) => s.trim()).filter(Boolean),
      model_ids: Array.from((e.currentTarget.elements.namedItem("modele") as HTMLSelectElement)?.selectedOptions ?? []).map((o) => Number(o.value)),
      stoc: Number(f.get("stoc") || 1),
    };
    let error;
    if (edit) ({ error } = await sb.from("products").update(date).eq("id", edit.id));
    else {
      const slug = nume.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Math.floor(Math.random() * 999);
      ({ error } = await sb.from("products").insert({ ...date, slug, publicat: true }));
    }
    setMsg(error ? "Eroare: " + error.message : edit ? "✓ Piesa a fost actualizată." : "✓ Piesa e live pe site — apare instant în catalog și în filtru.");
    if (!error) { if (!edit) (e.target as HTMLFormElement).reset(); setEdit(null); incarca(); }
  }

  // duplicare — „încă un alternator identic", cu un click
  async function duplica(p: Prod) {
    const sb = sbBrowser()!;
    const { id, slug, vizualizari, ...rest } = p as any;
    const nou = { ...rest, slug: slug.replace(/-\d+$/, "") + "-" + Math.floor(Math.random() * 9999), stoc: 1, publicat: false };
    const { error } = await sb.from("products").insert(nou);
    setMsg(error ? "Eroare: " + error.message : "✓ Copie creată (ascunsă) — editeaz-o și public-o.");
    incarca();
  }

  // ștergere protejată — dacă piesa apare într-o comandă, e doar ascunsă
  async function sterge(p: Prod) {
    if (!confirm(`Ștergi definitiv „${p.nume}"?`)) return;
    const sb = sbBrowser()!;
    const { data, error } = await sb.rpc("sterge_produs", { p_id: p.id });
    setMsg(error ? "Eroare: " + error.message : (data as any)?.mesaj ?? "Gata.");
    incarca();
  }

  // IMPORT CSV — coloane: nume;oem;pret;stare;stoc;greutate;cost;ani;categorie_slug
  async function importCsv(file: File) {
    const sb = sbBrowser()!; setMsg("Se importă…");
    const text = await file.text();
    const linii = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
    const cap = linii[0].split(/[;,]/).map((s) => s.trim().toLowerCase());
    const idx = (n: string) => cap.indexOf(n);
    const randuri = linii.slice(1);
    let ok = 0, erori = 0;
    for (const l of randuri) {
      const c = l.split(/[;,]/).map((s) => s.trim());
      const nume = c[idx("nume")]; if (!nume) { erori++; continue; }
      const catSlug = idx("categorie_slug") >= 0 ? c[idx("categorie_slug")] : "";
      const cat = cats.find((x) => x.slug === catSlug);
      const slug = nume.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Math.floor(Math.random() * 9999);
      const { error } = await sb.from("products").insert({
        slug, nume, oem: idx("oem") >= 0 ? c[idx("oem")] : "-",
        stare: (idx("stare") >= 0 && ["A", "B", "C"].includes(c[idx("stare")].toUpperCase())) ? c[idx("stare")].toUpperCase() : "B",
        pret_lei: Number((c[idx("pret")] || "0").replace(",", ".")) || 0,
        stoc: Number(c[idx("stoc")] || 1) || 1,
        greutate_kg: idx("greutate") >= 0 ? Number((c[idx("greutate")] || "").replace(",", ".")) || null : null,
        cost_lei: idx("cost") >= 0 ? Number((c[idx("cost")] || "").replace(",", ".")) || null : null,
        ani: idx("ani") >= 0 ? c[idx("ani")] || null : null,
        categorie_id: cat?.id ?? null, art: "engine", compat: [], model_ids: [], publicat: false,
      });
      error ? erori++ : ok++;
    }
    setMsg(`✓ Import terminat: ${ok} piese adăugate (ascunse, ca să le verifici)${erori ? `, ${erori} rânduri cu erori` : ""}.`);
    incarca();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div><div className="dim">Administrare</div><h1 className="font-disp font-bold text-2xl mt-1">Produse / Inventar</h1></div>
        <button onClick={() => setArataForm(!arataForm)} className="btn-acc !py-2 !px-4 text-sm">{arataForm ? "Ascunde formularul" : "+ Adaugă piesă"}</button>
      </div>

      <div className={`grid gap-4 items-start ${arataForm ? "lg:grid-cols-[1fr,400px]" : ""}`}>
        <div className="space-y-3">
          <div className="flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Caută după cod OEM sau denumire…"
              className="flex-1 rounded-xl border-2 border-line px-4 py-2.5 text-sm outline-none focus:border-acc" />
            <label className="rounded-xl border-2 border-line px-4 py-2.5 text-sm font-semibold cursor-pointer hover:border-acc whitespace-nowrap"
              title="Coloane: nume;oem;pret;stare;stoc;greutate;cost;ani;categorie_slug">
              Import CSV
              <input type="file" accept=".csv,text/csv" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv(f); e.target.value = ""; }} />
            </label>
          </div>
          <div className="card divide-y divide-line">
            {prods.map((p) => (
              <div key={p.id} className="px-4 py-3 flex items-center gap-3 text-sm">
                <div className="flex-1 min-w-0">
                  <Link href={`/piese/${p.slug}`} className="font-semibold hover:text-acc">{p.nume}</Link>
                  <div className="text-[11px] text-mut">OEM {p.oem} · {p.vizualizari} vizualizări</div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${p.stoc > 0 ? "bg-ok/10 text-ok" : "bg-red-100 text-red-600"}`}>
                  {p.stoc > 0 ? `stoc ${p.stoc}` : "vândută"}</span>
                <button onClick={() => comuta(p)} className={`px-2 py-0.5 rounded-full text-[11px] font-bold border-2 ${p.publicat ? "border-ok/40 text-ok" : "border-line text-mut"}`}>
                  {p.publicat ? "publicată" : "ascunsă"}</button>
                <b className="font-disp text-acc whitespace-nowrap">{lei(Number(p.pret_lei))}</b>
                <div className="flex gap-2 text-xs whitespace-nowrap">
                  <button onClick={() => { setEdit(p); setArataForm(true); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="text-acc font-semibold">Editează</button>
                  <button onClick={() => duplica(p)} className="text-mut hover:text-ink">Duplică</button>
                  <button onClick={() => sterge(p)} className="text-mut hover:text-red-600">Șterge</button>
                </div>
              </div>
            ))}
            {prods.length === 0 && <p className="p-8 text-center text-mut text-sm">Nicio piesă găsită.</p>}
          </div>
        </div>

        {arataForm && (
          <form key={edit?.id ?? "nou"} onSubmit={salveaza} className="card p-5 grid gap-3 text-sm lg:sticky lg:top-20">
            <div className="flex items-center justify-between">
              <b className="font-disp font-semibold text-[13px]">{edit ? "Editezi piesa" : "Adaugă piesă nouă"}</b>
              {edit && <button type="button" onClick={() => setEdit(null)} className="text-xs text-mut hover:text-acc">+ piesă nouă</button>}
            </div>
            <div className="fld"><label>Denumire *</label><input name="nume" required defaultValue={edit?.nume} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="fld"><label>Cod OEM *</label><input name="oem" required defaultValue={edit?.oem} /></div>
              <div className="fld"><label>Preț (lei) *</label><input name="pret" type="number" step="0.01" required defaultValue={edit?.pret_lei} /></div>
              <div className="fld"><label>Stare *</label><select name="stare" defaultValue={edit?.stare ?? "A"}><option>A</option><option>B</option><option>C</option></select></div>
              <div className="fld"><label>Stoc</label><input name="stoc" type="number" defaultValue={edit?.stoc ?? 1} /></div>
              <div className="fld"><label>Greutate (kg)</label><input name="greutate" type="number" step="0.1" defaultValue={edit?.greutate_kg ?? ""} placeholder="pt. AWB" /></div>
              <div className="fld"><label>Cost (lei, intern)</label><input name="cost" type="number" step="0.01" defaultValue={edit?.cost_lei ?? ""} placeholder="opțional" /></div>
            </div>
            <div className="fld"><label>Notă stare</label><input name="stare_nota" defaultValue={edit?.stare_nota ?? ""} placeholder="ex. testat pe stand" /></div>
            <div className="fld"><label>Ani compatibili</label><input name="ani" defaultValue={edit?.ani ?? ""} placeholder="ex. 2009–2013" /></div>
            <div className="fld"><label>Categorie</label><select name="categorie" defaultValue={edit?.categorie_id ?? ""}>{cats.map((c) => <option key={c.id} value={c.id}>{c.nume}</option>)}</select></div>
            <div className="fld"><label>Mașina-sursă</label><select name="vehicul" defaultValue={edit?.vehicul_id ?? ""}><option value="">—</option>{cars.map((v) => <option key={v.id} value={v.id}>{v.nume} · {v.an}</option>)}</select></div>
            <div className="fld"><label>Ilustrație</label><select name="art" defaultValue={edit?.art ?? "engine"}>{["engine","alternator","headlight","gearbox","turbo","mirror","egr","compressor","wheel","suspension","brake","seat","panel"].map((a) => <option key={a}>{a}</option>)}</select></div>
            <div className="fld"><label>Modele compatibile * <span className="font-normal text-mut">(Ctrl+click — alimentează filtrul)</span></label>
              <select name="modele" multiple size={6} defaultValue={(edit?.model_ids ?? []).map(String)}>
                {brands.map((b) => (
                  <optgroup key={b.id} label={b.nume}>
                    {models.filter((m) => m.brand_id === b.id).map((m) => <option key={m.id} value={m.id}>{m.nume}</option>)}
                  </optgroup>))}
              </select></div>
            <div className="fld"><label>Compatibilitate afișată (un rând pe model)</label><textarea name="compat" rows={3} defaultValue={(edit?.compat ?? []).join("\n")} /></div>
            <button className="btn-acc">{edit ? "Salvează modificările" : "Publică piesa"}</button>
            {msg && <p className="text-xs text-center">{msg}</p>}
          </form>
        )}
      </div>
    </div>
  );
}

export default function Produse() {
  return <Suspense fallback={<div className="text-mut">Se încarcă…</div>}><ProduseInner /></Suspense>;
}
