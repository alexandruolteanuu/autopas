"use client";
// FORMULARUL COMPLET DE PIESĂ — pagină separată, pentru adăugare și editare.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { sbBrowser } from "@/lib/supabase";
import PhotoUploader from "./PhotoUploader";
import type { Category, Vehicle, Brand, Model, Product } from "@/lib/types";

export default function ProductForm({ produs }: { produs?: Product }) {
  const router = useRouter();
  const [cats, setCats] = useState<Category[]>([]);
  const [cars, setCars] = useState<Vehicle[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [poze, setPoze] = useState<string[]>(produs?.poze ?? []);
  const [catId, setCatId] = useState<string>(String(produs?.categorie_id ?? ""));
  const [modeleSel, setModeleSel] = useState<number[]>(produs?.model_ids ?? []);
  const [marcaFiltru, setMarcaFiltru] = useState<string>("");
  const [subcatId, setSubcatId] = useState<string>(String(produs?.subcategorie_id ?? ""));
  const [msg, setMsg] = useState("");
  const [salvez, setSalvez] = useState(false);

  useEffect(() => {
    const sb = sbBrowser(); if (!sb) return;
    (async () => {
      setCats(((await sb.from("categories").select("*").order("ordine")).data ?? []) as Category[]);
      setCars(((await sb.from("vehicles").select("*").order("intrare", { ascending: false })).data ?? []) as Vehicle[]);
      setBrands(((await sb.from("brands").select("*").order("ordine")).data ?? []) as Brand[]);
      setModels(((await sb.from("models").select("*").order("nume")).data ?? []) as Model[]);
    })();
  }, []);

  const principale = cats.filter((c) => !c.parent_id);
  const subcats = cats.filter((c) => String(c.parent_id ?? "") === catId);
  const modeleAfisate = marcaFiltru ? models.filter((m) => String(m.brand_id) === marcaFiltru) : models;

  async function salveaza(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setMsg(""); setSalvez(true);
    const f = new FormData(e.currentTarget); const sb = sbBrowser()!;
    const nume = String(f.get("nume"));
    const date = {
      nume, oem: String(f.get("oem") || "") || null,
      pret_lei: Number(f.get("pret")), pret_sufix: String(f.get("sufix") || "") || null,
      ani: String(f.get("ani") || "") || null, art: f.get("art"),
      greutate_kg: Number(f.get("greutate")) || null, cost_lei: Number(f.get("cost")) || null,
      categorie_id: Number(f.get("categorie")) || null,
      subcategorie_id: Number(f.get("subcategorie")) || null,
      vehicul_id: Number(f.get("vehicul")) || null,
      originala: f.get("originala") === "on",
      compat: String(f.get("compat") || "").split("\n").map((s) => s.trim()).filter(Boolean),
      model_ids: modeleSel, poze,
      stoc: Number(f.get("stoc") || 1),
      publicat: f.get("publicat") === "on",
      stare_nota: String(f.get("descriere") || "") || null,
    };
    let error;
    if (produs) ({ error } = await sb.from("products").update(date).eq("id", produs.id));
    else {
      const slug = nume.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Math.floor(Math.random() * 9999);
      ({ error } = await sb.from("products").insert({ ...date, slug }));
    }
    setSalvez(false);
    if (error) { setMsg("Eroare: " + error.message); return; }
    router.push("/admin/produse");
    router.refresh();
  }

  return (
    <form onSubmit={salveaza} className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href="/admin/produse" className="text-sm text-mut hover:text-acc">← Produse</Link>
          <h1 className="font-disp font-bold text-2xl">{produs ? "Editează piesa" : "Adaugă o piesă nouă"}</h1>
          {produs?.cod_intern && <span className="text-sm text-mut">Cod intern: <b>{produs.cod_intern}</b></span>}
        </div>
        <div className="flex gap-2">
          <Link href="/admin/produse" className="rounded-xl border-2 border-line px-4 py-2 text-sm font-semibold">Renunț</Link>
          <button disabled={salvez} className="btn-acc !py-2 !px-5 text-sm">{salvez ? "Se salvează…" : produs ? "Salvează modificările" : "Publică piesa"}</button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.4fr,1fr] gap-4 items-start">
        <div className="space-y-4">
          <div className="card p-5 grid gap-3 text-sm">
            <b className="font-disp font-semibold text-[13px]">Informații de bază</b>
            <div className="fld"><label>Denumirea piesei *</label>
              <input name="nume" required defaultValue={produs?.nume} placeholder="ex. Far stânga xenon — BMW Seria 3 F30" /></div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="fld"><label>Cod OEM</label><input name="oem" defaultValue={produs?.oem ?? ""} placeholder="ex. 63117338709" /></div>
              <div className="fld"><label>Preț (lei) *</label><input name="pret" type="number" step="0.01" required defaultValue={produs?.pret_lei} /></div>
              <div className="fld"><label>Sufix preț</label><input name="sufix" defaultValue={produs?.pret_sufix ?? ""} placeholder="ex. / set" /></div>
            </div>
            <div className="fld"><label>Descriere / observații</label>
              <textarea name="descriere" rows={3} defaultValue={produs?.stare_nota ?? ""} placeholder="ex. testat pe stand, sticlă impecabilă" /></div>
          </div>

          <div className="card p-5 grid gap-3 text-sm">
            <b className="font-disp font-semibold text-[13px]">Fotografii reale</b>
            <PhotoUploader poze={poze} setPoze={setPoze} />
            <div className="fld"><label>Ilustrație de rezervă <span className="font-normal text-mut">(se afișează doar dacă nu ai poze)</span></label>
              <select name="art" defaultValue={produs?.art ?? "engine"}>
                {["engine","alternator","headlight","gearbox","turbo","mirror","egr","compressor","wheel","suspension","brake","seat","panel"].map((a) => <option key={a}>{a}</option>)}
              </select></div>
          </div>

          <div className="card p-5 grid gap-3 text-sm">
            <b className="font-disp font-semibold text-[13px]">Compatibilitate</b>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="fld"><label>Filtrează modelele după marcă</label>
                <select value={marcaFiltru} onChange={(e) => setMarcaFiltru(e.target.value)}>
                  <option value="">Toate mărcile</option>
                  {brands.map((b) => <option key={b.id} value={b.id}>{b.nume}</option>)}
                </select></div>
              <div className="fld"><label>Ani</label><input name="ani" defaultValue={produs?.ani ?? ""} placeholder="ex. 2012–2015" /></div>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-steel mb-1">Modele compatibile <span className="font-normal text-mut">(bifează — alimentează filtrul de pe site)</span></label>
              <div className="border-2 border-line rounded-xl p-2 max-h-56 overflow-y-auto grid sm:grid-cols-2 gap-x-3">
                {modeleAfisate.map((m) => {
                  const b = brands.find((x) => x.id === m.brand_id);
                  return (
                    <label key={m.id} className="flex items-center gap-2 py-1 cursor-pointer text-[13px]">
                      <input type="checkbox" checked={modeleSel.includes(m.id)}
                        onChange={(e) => setModeleSel(e.target.checked ? [...modeleSel, m.id] : modeleSel.filter((x) => x !== m.id))} />
                      <span className="text-mut">{b?.nume}</span> {m.nume}
                    </label>
                  );
                })}
              </div>
              <p className="text-[11px] text-mut mt-1">{modeleSel.length} modele bifate · lipsește un model? <Link href="/admin/marci" className="text-acc font-semibold">adaugă-l aici</Link></p>
            </div>
            <div className="fld"><label>Compatibilitate afișată pe site <span className="font-normal text-mut">(un rând pe model)</span></label>
              <textarea name="compat" rows={3} defaultValue={(produs?.compat ?? []).join("\n")} placeholder="BMW Seria 3 F30 / F31 · 2012–2015" /></div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5 grid gap-3 text-sm">
            <b className="font-disp font-semibold text-[13px]">Clasificare</b>
            <div className="fld"><label>Categorie *</label>
              <select name="categorie" required value={catId} onChange={(e) => { setCatId(e.target.value); setSubcatId(""); }}>
                <option value="">— alege —</option>
                {principale.map((c) => <option key={c.id} value={c.id}>{c.nume}</option>)}
              </select></div>
            <div className="fld"><label>Subcategorie</label>
              <select name="subcategorie" value={subcatId} onChange={(e) => setSubcatId(e.target.value)} disabled={subcats.length === 0}>
                <option value="">{subcats.length ? "— fără —" : "alege întâi categoria"}</option>
                {subcats.map((s) => <option key={s.id} value={s.id}>{s.nume}</option>)}
              </select></div>
            <p className="text-[11px] text-mut -mt-1">Lipsește o categorie? <Link href="/admin/categorii" className="text-acc font-semibold">Adaug-o aici</Link>.</p>
            <div className="fld"><label>Mașina-sursă</label>
              <select name="vehicul" defaultValue={produs?.vehicul_id ?? ""}>
                <option value="">— fără —</option>
                {cars.map((v) => <option key={v.id} value={v.id}>{v.nume}{v.an ? ` · ${v.an}` : ""}</option>)}
              </select></div>
          </div>

          <div className="card p-5 grid gap-3 text-sm">
            <b className="font-disp font-semibold text-[13px]">Stoc și logistică</b>
            <div className="grid grid-cols-2 gap-3">
              <div className="fld"><label>Stoc (buc)</label><input name="stoc" type="number" defaultValue={produs?.stoc ?? 1} /></div>
              <div className="fld"><label>Greutate (kg)</label><input name="greutate" type="number" step="0.1" defaultValue={produs?.greutate_kg ?? ""} placeholder="pt. AWB" /></div>
            </div>
            <div className="fld"><label>Cost intern (lei) <span className="font-normal text-mut">— nu apare pe site</span></label>
              <input name="cost" type="number" step="0.01" defaultValue={produs?.cost_lei ?? ""} /></div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" name="originala" defaultChecked={produs?.originala ?? true} />
              <span>Piesă auto <b>originală</b> din dezmembrări</span></label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" name="publicat" defaultChecked={produs?.publicat ?? true} />
              <span>Publicată pe site</span></label>
          </div>
        </div>
      </div>
      {msg && <p className="text-sm text-red-600">{msg}</p>}
    </form>
  );
}
