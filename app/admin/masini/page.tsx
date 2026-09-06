"use client";
// MAȘINI LA DEZMEMBRAT — fiecare mașină e un mini-business:
// cost de achiziție vs. încasat din piesele ei = profit + zile până la amortizare.
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { sbBrowser, scrieVerificat, citesteTot } from "@/lib/supabase";
import { lei, ghicesteMarcaModel, numeModelFaraAni, aniiModelului } from "@/lib/format";
import PhotoUploader from "@/components/admin/PhotoUploader";
import type { VehiculAdmin, Brand, Model } from "@/lib/types";

type Randament = { listate: number; vandute: number; incasat: number };

export default function Masini() {
  const [cars, setCars] = useState<VehiculAdmin[]>([]);
  const [rand, setRand] = useState<Record<number, Randament>>({});
  const [edit, setEdit] = useState<VehiculAdmin | null>(null);
  const [form, setForm] = useState(false);
  const [msg, setMsg] = useState("");
  const [marci, setMarci] = useState<Brand[]>([]);
  const [modele, setModele] = useState<Model[]>([]);
  // Pozele și marca nu pot fi lăsate pe seama lui `FormData`: pozele se urcă în
  // Storage înainte de salvare, iar lista de modele depinde de marca aleasă.
  const [poze, setPoze] = useState<string[]>([]);
  const [marcaSel, setMarcaSel] = useState<number | "">("");
  // Modelul, denumirea și anul sunt controlate (nu `defaultValue`) fiindcă
  // sugestia de mai jos trebuie să le poată completa cu un clic, iar denumirea
  // și anul sunt chiar datele din care se calculează sugestia.
  const [modelSel, setModelSel] = useState<number | "">("");
  const [numeForm, setNumeForm] = useState("");
  const [anForm, setAnForm] = useState("");
  // Câte piese se potrivesc pe fiecare mașină — exact cifra pe care o vede
  // clientul pe /masini/[slug]. Vine din view, un rând pe mașină.
  const [peSite, setPeSite] = useState<Record<number, number>>({});

  const incarca = useCallback(async () => {
    const sb = sbBrowser(); if (!sb) return;
    const [v, p, it, b, m, cp] = await Promise.all([
      citesteTot<VehiculAdmin>(() => sb.from("vehicles").select("*", { count: "exact" }).order("intrare", { ascending: false }).order("id"), { eticheta: "mașinile" }),
      // Doar piesele care CHIAR au o mașină-sursă. Înainte se aduceau toate cele
      // 8.895 (9 cereri paginate) ca să se numere piesele a 23 de mașini — datoria
      // tehnică notată în CLAUDE.md. Filtrul îl face acum baza: restul rândurilor
      // n-ar fi trecut oricum de `if (!x.vehicul_id) return;` de mai jos.
      // PAGINAT rămâne: PostgREST taie la 1.000. Vezi `citesteTot`.
      citesteTot<any>(() => sb.from("products")
        .select("id,vehicul_id,stoc,pret_lei", { count: "exact" })
        .not("vehicul_id", "is", null).order("id"),
        { eticheta: "piesele legate de o mașină" }),
      citesteTot<any>(() => sb.from("order_items").select("pret,cantitate,product_id,orders!inner(status)", { count: "exact" }).neq("orders.status", "anulata").order("id"), { eticheta: "liniile comenzilor" }),
      citesteTot<Brand>(() => sb.from("brands").select("*", { count: "exact" }).order("nume").order("id"), { eticheta: "mărcile" }),
      citesteTot<Model>(() => sb.from("models").select("*", { count: "exact" }).order("nume").order("id"), { eticheta: "modelele" }),
      citesteTot<{ vehicul_id: number; nr_piese: number }>(() => sb.from("numar_piese_compatibile_pe_masina")
        .select("*", { count: "exact" }).order("vehicul_id"), { eticheta: "piesele compatibile pe mașină" }),
    ]);
    setCars(v);
    setMarci(b);
    setModele(m);
    const ps: Record<number, number> = {};
    for (const r of cp) ps[r.vehicul_id] = r.nr_piese;
    setPeSite(ps);
    const pieseDupaId = new Map<number, any>((p as any[]).map((x) => [x.id, x]));
    const r: Record<number, Randament> = {};
    (p as any[]).forEach((x) => {
      if (!x.vehicul_id) return;
      r[x.vehicul_id] ??= { listate: 0, vandute: 0, incasat: 0 };
      r[x.vehicul_id].listate++;
      if (x.stoc <= 0) r[x.vehicul_id].vandute++;
    });
    (it as any[]).forEach((i) => {
      const p = pieseDupaId.get(i.product_id); if (!p?.vehicul_id) return;
      r[p.vehicul_id] ??= { listate: 0, vandute: 0, incasat: 0 };
      r[p.vehicul_id].incasat += Number(i.pret) * i.cantitate;
    });
    setRand(r);
  }, []);
  useEffect(() => { incarca(); }, [incarca]);

  async function salveaza(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setMsg("");
    const f = new FormData(e.currentTarget); const sb = sbBrowser()!;
    const nume = String(f.get("nume"));
    const text = (k: string) => { const s = String(f.get(k) ?? "").trim(); return s === "" ? null : s; };
    const date = {
      nume, an: Number(f.get("an")) || null, vin_masca: f.get("vin") || null,
      cost_achizitie: Number(f.get("cost")) || null, status: String(f.get("status")),
      intrare: String(f.get("intrare") || new Date().toISOString().slice(0, 10)),
      // Coloanele adăugate de supabase/pagini-masini.sql, pentru pagina publică.
      poze, descriere: text("descriere"), publicat: f.get("publicat") === "on",
      motorizare: text("motorizare"), caroserie: text("caroserie"),
      culoare: text("culoare"), cutie_viteze: text("cutie"),
      km: Number(f.get("km")) || null,
      marca_id: marcaSel || null,
      model_id: modelSel || null,
    };
    let eroare: string | undefined;
    if (edit) {
      const r = await scrieVerificat(sb.from("vehicles").update(date).eq("id", edit.id));
      if (!r.ok) eroare = r.eroare;
    } else {
      const slug = nume.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Math.floor(Math.random() * 999);
      const { error } = await sb.from("vehicles").insert({ ...date, slug, piese_listate: 0 });
      if (error) eroare = error.message;
    }
    setMsg(eroare ? "Nu s-a salvat: " + eroare
      : edit ? "✓ Mașina a fost actualizată." : "✓ Mașina a fost adăugată — o poți alege acum la piese.");
    if (!eroare) { setEdit(null); setForm(false); incarca(); }
  }

  /** Deschide formularul pe o mașină existentă. Pozele și marca ies din
   *  `FormData` (una se urcă înainte de salvare, cealaltă filtrează modelele),
   *  deci trebuie duse explicit în stare la fiecare deschidere — altfel ar
   *  rămâne cele ale mașinii editate anterior. */
  function deschideEdit(v: VehiculAdmin) {
    setEdit(v); setForm(false); setMsg("");
    setPoze(v.poze ?? []); setMarcaSel(v.marca_id ?? ""); setModelSel(v.model_id ?? "");
    setNumeForm(v.nume); setAnForm(v.an ? String(v.an) : "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function deschideNou() {
    const deschis = !form;
    setEdit(null); setForm(deschis); setMsg("");
    setPoze([]); setMarcaSel(""); setModelSel(""); setNumeForm(""); setAnForm("");
  }

  async function sterge(v: VehiculAdmin) {
    if (!confirm(`Ștergi „${v.nume}"? Piesele rămân, dar nu vor mai fi legate de o mașină.`)) return;
    const sb = sbBrowser()!;
    await sb.from("products").update({ vehicul_id: null }).eq("vehicul_id", v.id);
    const r = await scrieVerificat(sb.from("vehicles").delete().eq("id", v.id));
    setMsg(r.ok ? "✓ Mașina a fost ștearsă." : `Nu s-a șters: ${r.eroare}`); incarca();
  }

  // Sugestia de marcă/generație, recalculată la fiecare tastă din denumire.
  // `ghicesteMarcaModel` e în lib/format.ts, cu explicația de ce n-are voie să
  // devină potrivirea din import.
  const sugestie = ghicesteMarcaModel(numeForm, Number(anForm) || null, marci, modele);
  const sugestieDiferita = !!sugestie.marca
    && (marcaSel !== sugestie.marca.id || (!!sugestie.model && modelSel !== sugestie.model.id));
  function aplicaSugestia() {
    if (sugestie.marca) setMarcaSel(sugestie.marca.id);
    setModelSel(sugestie.model ? sugestie.model.id : "");
  }

  const totalCost = cars.reduce((s, c) => s + Number(c.cost_achizitie || 0), 0);
  const totalIncasat = Object.values(rand).reduce((s, r) => s + r.incasat, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div><div className="dim">Administrare</div><h1 className="font-disp font-bold text-2xl mt-1">Mașini la dezmembrat</h1>
          <p className="text-sm text-mut mt-1">Metrica-cheie a afacerii: cât a costat mașina vs. cât ai încasat din piesele ei.</p></div>
        <button onClick={deschideNou} className="btn-acc !py-2 !px-4 text-sm">{form ? "Închide" : "+ Înregistrează vehicul"}</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[["Vehicule în evidență", String(cars.length)],
          ["Investit în achiziții", lei(totalCost)],
          ["Încasat din piese", lei(totalIncasat)],
          ["Rezultat", lei(totalIncasat - totalCost)]].map(([t, v]) => (
          <div key={t} className="card p-4"><span className="text-xs text-mut">{t}</span>
            <b className={`block font-disp text-xl mt-1 ${t === "Rezultat" ? (totalIncasat - totalCost >= 0 ? "text-ok" : "text-red-600") : ""}`}>{v}</b></div>
        ))}
      </div>

      {(form || edit) && (
        <form onSubmit={salveaza} className="card p-5 grid sm:grid-cols-3 gap-3 text-sm">
          <b className="font-disp font-semibold text-[13px] sm:col-span-3">{edit ? `Editezi: ${edit.nume}` : "Vehicul nou"}</b>
          <div className="fld sm:col-span-2"><label>Denumire * <span className="font-normal text-mut">(ex. VW Passat B7 2.0 TDI)</span></label>
            <input name="nume" required value={numeForm} onChange={(e) => setNumeForm(e.target.value)} /></div>
          <div className="fld"><label>An</label>
            <input name="an" type="number" value={anForm} onChange={(e) => setAnForm(e.target.value)} /></div>
          <div className="fld"><label>VIN mascat <span className="font-normal text-mut">(public, parțial)</span></label>
            <input name="vin" defaultValue={edit?.vin_masca ?? ""} placeholder="WVWZZZ…9917" /></div>
          <div className="fld"><label>Cost achiziție (lei)</label><input name="cost" type="number" step="0.01" defaultValue={edit?.cost_achizitie ?? ""} /></div>
          <div className="fld"><label>Data intrării</label><input name="intrare" type="date" defaultValue={(edit?.intrare ?? new Date().toISOString()).slice(0, 10)} /></div>
          <div className="fld sm:col-span-2"><label>Status</label>
            <select name="status" defaultValue={edit?.status ?? "in_dezmembrare"}>
              <option value="in_dezmembrare">În dezmembrare</option>
              <option value="amortizata">Amortizată</option>
              <option value="finalizata">Finalizată</option>
            </select></div>
          <label className="flex items-center gap-2 text-sm self-end pb-2">
            <input type="checkbox" name="publicat" defaultChecked={edit?.publicat ?? true} />
            Publicată pe site
          </label>

          {/* ---- pagina publică: /masini/[slug] ---- */}
          <b className="font-disp font-semibold text-[13px] sm:col-span-3 pt-2 border-t border-line">
            Pagina publică
            {edit && <Link href={`/masini/${edit.slug}`} target="_blank" className="ml-2 font-normal text-acc">vezi pagina ↗</Link>}
          </b>

          {/* Marca și GENERAȚIA ca date, nu ca text în denumire. De la 6 septembrie
              2026 nu mai sunt un moft: generația e SINGURA cheie prin care pagina
              publică a mașinii își găsește piesele (`products.model_ids`). O mașină
              fără ea rămâne o pagină fără nicio piesă, oricât de plin ar fi
              catalogul. Vezi supabase/piese-compatibile-masini.sql.

              Anul NU filtrează piesele. Servește o singură dată, aici, ca să te
              ajute să alegi generația — pe „Audi A4 · 2014" e A4 B8 (2008–2015).
              Filtrarea pieselor pe an ar arunca 131 din 221 de piese bune, fiindcă
              anii scriși pe o piesă sunt ai mașinii de pe care a fost demontată. */}
          <div className="fld"><label>Marca</label>
            <select name="marca" value={marcaSel}
              onChange={(e) => { setMarcaSel(Number(e.target.value) || ""); setModelSel(""); }}>
              <option value="">— alege —</option>
              {marci.map((b) => <option key={b.id} value={b.id}>{b.nume}</option>)}
            </select></div>
          <div className="fld"><label>Modelul <span className="font-normal text-mut">(generația)</span></label>
            <select name="model" value={modelSel} onChange={(e) => setModelSel(Number(e.target.value) || "")}>
              <option value="">— alege —</option>
              {modele.filter((m) => m.brand_id === marcaSel).map((m) => <option key={m.id} value={m.id}>{m.nume}</option>)}
            </select></div>

          {/* SUGESTIA din denumire. Nu se aplică singură: propune, omul confirmă.
              De asta poate fi o potrivire simplă pe text — spre deosebire de
              importul de piese, unde nimeni nu verifică rezultatul și de asta
              deducerea din titlu s-a dovedit greșită. */}
          {sugestie.marca && (
            <div className="sm:col-span-3 -mt-1 text-[12px] flex flex-wrap items-center gap-2">
              <span className="text-mut">Din denumire pare a fi:</span>
              <b>{sugestie.marca.nume}{sugestie.model ? ` · ${numeModelFaraAni(sugestie.model.nume)}` : ""}</b>
              {sugestie.model && aniiModelului(sugestie.model) &&
                <span className="text-mut">({aniiModelului(sugestie.model)})</span>}
              {sugestieDiferita && (
                <button type="button" onClick={aplicaSugestia}
                  className="rounded-lg border-2 border-line px-2.5 py-1 font-semibold hover:border-acc">
                  Completează
                </button>
              )}
              {sugestie.aviz && <span className="text-red-600">⚠ {sugestie.aviz}</span>}
            </div>
          )}
          <div className="fld"><label>Motorizare</label><input name="motorizare" defaultValue={edit?.motorizare ?? ""} placeholder="2.0 TDI 140 CP" /></div>
          <div className="fld"><label>Caroserie</label><input name="caroserie" defaultValue={edit?.caroserie ?? ""} placeholder="break / berlină / hatchback" /></div>
          <div className="fld"><label>Cutie de viteze</label><input name="cutie" defaultValue={edit?.cutie_viteze ?? ""} placeholder="manuală 6 trepte" /></div>
          <div className="fld"><label>Culoare</label><input name="culoare" defaultValue={edit?.culoare ?? ""} placeholder="negru metalizat" /></div>
          <div className="fld"><label>Kilometri</label><input name="km" type="number" defaultValue={edit?.km ?? ""} placeholder="248000" /></div>
          <div className="fld sm:col-span-3"><label>Descriere <span className="font-normal text-mut">(apare pe pagina mașinii)</span></label>
            <textarea name="descriere" rows={3} defaultValue={edit?.descriere ?? ""}
              placeholder="Mașină adusă din Germania, fără accidente în față. Motorul și cutia sunt funcționale și testate." /></div>

          <div className="sm:col-span-3">
            <label className="text-sm font-semibold block mb-2">Poze cu mașina</label>
            <PhotoUploader poze={poze} setPoze={setPoze} />
          </div>

          <div className="flex gap-2 items-end sm:col-span-3">
            <button className="btn-acc flex-1">{edit ? "Salvează" : "Adaugă"}</button>
            {edit && <button type="button" onClick={() => setEdit(null)} className="rounded-xl border-2 border-line px-4">Renunț</button>}
          </div>
        </form>
      )}
      {msg && <p className="text-sm">{msg}</p>}

      <div className="card overflow-x-auto">
        <table className="tabel-carduri w-full text-sm md:min-w-[820px]">
          <thead><tr className="text-left text-mut text-xs border-b border-line">
            <th className="px-4 py-3">Vehicul</th><th className="px-4 py-3">Intrare</th><th className="px-4 py-3">Piese</th>
            <th className="px-4 py-3">Cost</th><th className="px-4 py-3">Încasat</th><th className="px-4 py-3">Profit</th>
            <th className="px-4 py-3">Amortizare</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th></tr></thead>
          <tbody className="divide-y divide-line">
            {cars.map((v) => {
              const r = rand[v.id] ?? { listate: 0, vandute: 0, incasat: 0 };
              const cost = Number(v.cost_achizitie || 0);
              const profit = r.incasat - cost;
              const zile = Math.round((Date.now() - new Date(v.intrare).getTime()) / 86400000);
              return (
                <tr key={v.id} className="hover:bg-paper">
                  <td data-eticheta="Mașina" className="px-4 py-3"><b>{v.nume}</b>{v.an ? ` · ${v.an}` : ""}
                    <div className="text-[11px] text-mut">{v.vin_masca ?? ""}</div>
                    {/* Semnalăm ce lipsește pentru pagina publică, la fel ca „⚠ fără ani"
                        din Mărci și modele. Fără generație, pagina mașinii rămâne
                        goală oricât de plin ar fi catalogul: `products.model_ids` e
                        singura cheie prin care își găsește piesele. */}
                    <div className="text-[11px] mt-0.5 flex gap-2 flex-wrap">
                      {!v.publicat && <span className="text-mut">nepublicată</span>}
                      {!v.marca_id && <span className="text-red-600">⚠ fără marcă</span>}
                      {v.marca_id && !v.model_id && <span className="text-red-600">⚠ fără model</span>}
                      {(v.poze?.length ?? 0) === 0 && <span className="text-mut">fără poze</span>}
                    </div></td>
                  <td data-eticheta="Intrare" className="px-4 py-3 text-mut">{new Date(v.intrare).toLocaleDateString("ro-RO")}</td>
                  {/* Cifra mare e cea pe care o vede clientul: piesele care se
                      potrivesc pe generația mașinii. Sub ea, cifra internă —
                      piesele demontate chiar de aici, adică baza profitului. */}
                  <td data-eticheta="Piese" className="px-4 py-3">
                    <Link href={`/masini/${v.slug}`} target="_blank" className="text-acc font-semibold">
                      {peSite[v.id] ?? 0} pe pagină
                    </Link>
                    <div className="text-[11px] text-mut">{r.listate} demontate de aici · {r.vandute} vândute</div></td>
                  <td data-eticheta="Cost achiziție" className="px-4 py-3">{cost ? lei(cost) : <span className="text-mut">—</span>}</td>
                  <td data-eticheta="Încasat" className="px-4 py-3">{lei(r.incasat)}</td>
                  <td data-eticheta="Profit" className={`px-4 py-3 font-semibold ${profit >= 0 ? "text-ok" : "text-red-600"}`}>{cost ? (profit >= 0 ? "+" : "") + lei(profit) : "—"}</td>
                  <td data-eticheta="Amortizare" className="px-4 py-3 text-xs">{cost ? (r.incasat >= cost ? <span className="text-ok font-semibold">amortizată în {zile} zile</span> : <span className="text-mut">în curs · {zile} zile</span>) : "—"}</td>
                  <td data-eticheta="Status" className="px-4 py-3 text-xs">{v.status.replace("_", " ")}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button onClick={() => deschideEdit(v)} className="text-acc font-semibold mr-3">Editează</button>
                    <button onClick={() => sterge(v)} className="text-mut hover:text-red-600">Șterge</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {cars.length === 0 && <p className="p-8 text-center text-mut text-sm">Niciun vehicul înregistrat încă.</p>}
      </div>
    </div>
  );
}
