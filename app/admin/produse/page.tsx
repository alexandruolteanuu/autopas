"use client";
// PRODUSE / INVENTAR — Sprint A: lista cu stoc + adăugarea completă (cu greutate, pentru AWB).
// Editarea, duplicarea și importul CSV sosesc în Sprint B.
import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { sbBrowser } from "@/lib/supabase";
import { lei } from "@/lib/format";

type Prod = { id: number; nume: string; oem: string | null; cod_intern: string | null; poze: string[] | null; pret_lei: number; stoc: number; publicat: boolean; slug: string;
  vizualizari: number; stare: string; stare_nota: string | null; ani: string | null; art: string;
  categorie_id: number | null; vehicul_id: number | null; compat: string[]; model_ids: number[];
  greutate_kg: number | null; cost_lei: number | null };

function ProduseInner() {
  const sp = useSearchParams();
  const [prods, setProds] = useState<Prod[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [cats, setCats] = useState<{ id: number; slug: string; nume: string; parent_id: number | null }[]>([]);
  useEffect(() => {
    const sb = sbBrowser(); if (!sb) return;
    sb.from("categories").select("id,slug,nume,parent_id").order("ordine")
      .then(({ data }) => setCats((data ?? []) as any[]));
  }, []);


  const incarca = useCallback(async () => {
    const sb = sbBrowser(); if (!sb) return;
    let query = sb.from("products").select("*").order("created_at", { ascending: false }).limit(300);
    if (q.trim()) query = query.or(`oem.ilike.%${q}%,nume.ilike.%${q}%`);
    setProds(((await query).data ?? []) as Prod[]);
  }, [q]);
  useEffect(() => { const t = setTimeout(incarca, q ? 300 : 0); return () => clearTimeout(t); }, [incarca, q]);


  async function comuta(p: Prod) {
    const sb = sbBrowser()!; await sb.from("products").update({ publicat: !p.publicat }).eq("id", p.id); incarca();
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

  // IMPORT CSV — coloane: nume;oem;pret;stoc;greutate;cost;ani;categorie_slug
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
        slug, nume, oem: idx("oem") >= 0 ? (c[idx("oem")] || null) : null,
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
        <Link href="/admin/produse/nou" className="btn-acc !py-2 !px-4 text-sm">+ Adaugă piesă</Link>
      </div>

      <div className="grid gap-4 items-start">
        <div className="space-y-3">
          <div className="flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Caută după cod OEM sau denumire…"
              className="flex-1 rounded-xl border-2 border-line px-4 py-2.5 text-sm outline-none focus:border-acc" />
            <label className="rounded-xl border-2 border-line px-4 py-2.5 text-sm font-semibold cursor-pointer hover:border-acc whitespace-nowrap"
              title="Coloane: nume;oem;pret;stoc;greutate;cost;ani;categorie_slug">
              Import CSV
              <input type="file" accept=".csv,text/csv" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv(f); e.target.value = ""; }} />
            </label>
          </div>
          <div className="card divide-y divide-line">
            {prods.map((p) => (
              <div key={p.id} className="px-4 py-3 flex items-center gap-3 text-sm">
                {p.poze && p.poze.length > 0
                  ? <img src={p.poze[0]} alt="" className="w-12 h-10 object-cover rounded-lg border border-line shrink-0" />
                  : <span className="w-12 h-10 rounded-lg border border-line bg-paper grid place-items-center text-[9px] text-mut shrink-0">fără poză</span>}
                <div className="flex-1 min-w-0">
                  <Link href={`/piese/${p.slug}`} className="font-semibold hover:text-acc">{p.nume}</Link>
                  <div className="text-[11px] text-mut">{p.cod_intern ?? ""}{p.oem ? ` · OEM ${p.oem}` : ""} · {p.vizualizari} vizualizări</div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${p.stoc > 0 ? "bg-ok/10 text-ok" : "bg-red-100 text-red-600"}`}>
                  {p.stoc > 0 ? `stoc ${p.stoc}` : "vândută"}</span>
                <button onClick={() => comuta(p)} className={`px-2 py-0.5 rounded-full text-[11px] font-bold border-2 ${p.publicat ? "border-ok/40 text-ok" : "border-line text-mut"}`}>
                  {p.publicat ? "publicată" : "ascunsă"}</button>
                <b className="font-disp text-acc whitespace-nowrap">{lei(Number(p.pret_lei))}</b>
                <div className="flex gap-2 text-xs whitespace-nowrap">
                  <Link href={`/admin/produse/${p.id}`} className="text-acc font-semibold">Editează</Link>
                  <button onClick={() => duplica(p)} className="text-mut hover:text-ink">Duplică</button>
                  <button onClick={() => sterge(p)} className="text-mut hover:text-red-600">Șterge</button>
                </div>
              </div>
            ))}
            {prods.length === 0 && <p className="p-8 text-center text-mut text-sm">Nicio piesă găsită.</p>}
          </div>
        </div>

        
      </div>
    </div>
  );
}

export default function Produse() {
  return <Suspense fallback={<div className="text-mut">Se încarcă…</div>}><ProduseInner /></Suspense>;
}
