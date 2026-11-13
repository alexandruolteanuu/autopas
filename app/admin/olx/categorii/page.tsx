"use client";
// ANUNȚURI OLX → CATEGORII (pasul 1 din docs/olx-plan.md, 13 noiembrie 2026).
//
// Potrivirea categorie / subcategorie de pe site → categoria FINALĂ de pe OLX, plus
// valorile atributelor pe care OLX le cere obligatoriu acolo. Ordinea folosită la
// anunț (pasul 2): subcategoria piesei → categoria ei → fără potrivire (piesa nu se
// publică pe OLX). Ca la „Articole SAGA”.
//
// Catalogul OLX se aduce cu un buton (prin /api/olx); atributele unei categorii se
// cer la alegerea ei și se păstrează lângă ea. „Propune” cere OLX-ului o sugestie
// după titlul unei piese din categorie.
// Scrierea potrivirilor: doar administratorul (RLS pe `olx_mapari`).
import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { sbBrowser, scrieVerificat, citesteTot } from "@/lib/supabase";

type Categorie = { id: number; nume: string; parent_id: number | null; nr_piese: number };
type Atribut = { code: string; label: string; validation?: { required?: boolean; allow_multiple_values?: boolean; numeric?: boolean; type?: string };
                 values?: { code: string; label: string }[] };
type CatOlx = { id: number; nume: string; cale: string | null; is_leaf: boolean; photos_limit: number | null; atribute: Atribut[] | null };
type Potrivire = { categorie_id: number; olx_categorie_id: number; atribute: { code: string; value: string }[] };

async function olx(corp: Record<string, unknown>) {
  const sb = sbBrowser();
  const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
  const r = await fetch("/api/olx", { method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` }, body: JSON.stringify(corp) });
  return r.json().catch(() => ({ ok: false, eroare: `Răspuns neașteptat (HTTP ${r.status}).` }));
}

/** Atributele de completat: cele obligatorii, fără preț / salariu (vin din piesă). */
const deCompletat = (a: Atribut[] | null | undefined) =>
  (a ?? []).filter((x) => x.validation?.required && !["price", "salary"].includes(x.validation?.type ?? "") && x.code !== "price");

export default function CategoriiOlx() {
  const [categorii, setCategorii] = useState<Categorie[]>([]);
  const [olxCat, setOlxCat] = useState<CatOlx[]>([]);
  const [potriviri, setPotriviri] = useState<Record<number, Potrivire>>({});
  const [filtru, setFiltru] = useState("");
  const [msg, setMsg] = useState<{ bun: boolean; text: string } | null>(null);
  const [aduc, setAduc] = useState(false);

  const incarca = useCallback(async () => {
    const sb = sbBrowser(); if (!sb) return;
    try {
      const [c, o, p] = await Promise.all([
        sb.from("categorii_cu_numar").select("id,nume,parent_id,nr_piese").order("nume"),
        citesteTot<CatOlx>(() => sb.from("olx_categorii").select("id,nume,cale,is_leaf,photos_limit,atribute", { count: "exact" }).order("id"), { eticheta: "categoriile OLX" }),
        sb.from("olx_mapari").select("categorie_id,olx_categorie_id,atribute"),
      ]);
      if (c.error || p.error) throw new Error((c.error ?? p.error)!.message);
      setCategorii((c.data ?? []) as Categorie[]);
      setOlxCat(o);
      const m: Record<number, Potrivire> = {};
      for (const r of (p.data ?? []) as Potrivire[]) m[r.categorie_id] = r;
      setPotriviri(m);
    } catch (e) { setMsg({ bun: false, text: `Nu pot citi datele: ${(e as Error).message}. (Pagina e pentru administrator.)` }); }
  }, []);
  useEffect(() => { incarca(); }, [incarca]);

  async function aduCategorii() {
    setAduc(true); setMsg(null);
    const j = await olx({ actiune: "aduce-categorii" });
    setAduc(false);
    setMsg({ bun: !!j.ok && !j.incomplet, text: j.mesaj ?? j.eroare ?? "?" });
    incarca();
  }

  const frunze = useMemo(() => olxCat.filter((c) => c.is_leaf), [olxCat]);
  const dupaId = useMemo(() => new Map(olxCat.map((c) => [c.id, c])), [olxCat]);

  const arbore = useMemo(() => {
    const f = filtru.trim().toLowerCase();
    const copii = new Map<number, Categorie[]>();
    for (const c of categorii) if (c.parent_id) copii.set(c.parent_id, [...(copii.get(c.parent_id) ?? []), c]);
    return categorii.filter((c) => !c.parent_id)
      .map((p) => ({ p, copii: (copii.get(p.id) ?? []).sort((a, b) => b.nr_piese - a.nr_piese) }))
      .filter(({ p, copii }) => !f || p.nume.toLowerCase().includes(f) || copii.some((c) => c.nume.toLowerCase().includes(f)))
      .sort((a, b) => b.p.nr_piese - a.p.nr_piese);
  }, [categorii, filtru]);

  // Câte piese ajung pe OLX cu potrivirile de acum (subcategorie → categorie).
  const acoperire = useMemo(() => {
    let cu = 0, tot = 0;
    for (const { p, copii } of arbore) {
      const piesePeCopii = copii.reduce((s, c) => s + c.nr_piese, 0);
      tot += Math.max(p.nr_piese, piesePeCopii);
      for (const c of copii) if (potriviri[c.id] || potriviri[p.id]) cu += c.nr_piese;
      if (potriviri[p.id]) cu += Math.max(0, p.nr_piese - piesePeCopii);
    }
    return { cu, tot };
  }, [arbore, potriviri]);

  return (
    <div className="space-y-4">
      <div>
        <div className="dim"><Link href="/admin/integrari#olx" className="hover:text-acc">Integrări → OLX</Link> → Categorii</div>
        <h1 className="font-disp font-bold text-2xl mt-1">Categoriile OLX</h1>
        <p className="text-sm text-mut mt-1">
          În ce categorie OLX intră piesele fiecărei categorii de pe site. Ordinea: subcategoria piesei, apoi categoria ei.
          Fără potrivire, piesa nu se publică pe OLX. Pe OLX se poate alege doar o categorie finală (fără subcategorii).
        </p>
      </div>

      <div className="card p-4 text-sm flex flex-wrap items-center gap-3">
        <button type="button" onClick={aduCategorii} disabled={aduc} className="btn-dark !py-2 text-xs">
          {aduc ? "Se aduce catalogul (până la un minut)…" : olxCat.length ? "Reîmprospătează categoriile OLX" : "Adu categoriile OLX"}</button>
        <span className="text-xs text-mut">{olxCat.length} categorii OLX ({frunze.length} finale) · {Object.keys(potriviri).length} potriviri ·
          aprox. {acoperire.cu} din {acoperire.tot} piese au categorie OLX</span>
        {msg && <p className={`w-full text-xs ${msg.bun ? "text-ok" : "text-red-700"}`}>{msg.text}</p>}
      </div>

      <input value={filtru} onChange={(e) => setFiltru(e.target.value)} placeholder="Caută o categorie de pe site…"
        className="w-full rounded-xl border-2 border-line px-3 py-2 text-sm outline-none focus:border-acc" />

      <div className="card divide-y divide-line">
        {arbore.map(({ p, copii }) => (
          <div key={p.id} className="p-3 space-y-2">
            <Rand c={p} potrivire={potriviri[p.id]} parinte={null} frunze={frunze} dupaId={dupaId} dupaSalvare={incarca} />
            {copii.map((c) => (
              <div key={c.id} className="pl-4 sm:pl-8 border-l-2 border-line">
                <Rand c={c} potrivire={potriviri[c.id]} parinte={potriviri[p.id] ?? null} frunze={frunze} dupaId={dupaId} dupaSalvare={incarca} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Rand({ c, potrivire, parinte, frunze, dupaId, dupaSalvare }: {
  c: Categorie; potrivire?: Potrivire; parinte: Potrivire | null; frunze: CatOlx[]; dupaId: Map<number, CatOlx>; dupaSalvare: () => void;
}) {
  const [deschis, setDeschis] = useState(false);
  const [cauta, setCauta] = useState("");
  const [ales, setAles] = useState<number | null>(potrivire?.olx_categorie_id ?? null);
  const [atribute, setAtribute] = useState<Atribut[] | null>(null);
  const [valori, setValori] = useState<Record<string, string>>({});
  const [sugestii, setSugestii] = useState<{ id: number; cale: string }[]>([]);
  const [lucru, setLucru] = useState("");
  const [msg, setMsg] = useState("");

  const numeOlx = (id: number) => dupaId.get(id)?.cale || dupaId.get(id)?.nume || `#${id}`;
  const efectiv = potrivire ? <b>{numeOlx(potrivire.olx_categorie_id)}</b>
    : parinte ? <span className="text-mut">ca la categorie: {numeOlx(parinte.olx_categorie_id)}</span>
    : <span className="text-amber-700">fără potrivire — nu se publică pe OLX</span>;

  // La alegerea unei categorii: atributele (din tabel sau cerute la OLX), cu valorile salvate / propuse.
  async function alege(id: number) {
    setAles(id); setMsg(""); setAtribute(null);
    let at = dupaId.get(id)?.atribute ?? null;
    if (!at) {
      setLucru("atribute");
      const j = await olx({ actiune: "atribute", id });
      setLucru("");
      if (!j.ok) { setMsg(j.eroare); setAles(null); return; }
      at = j.atribute as Atribut[];
    }
    setAtribute(at);
    const salvate = Object.fromEntries((potrivire?.olx_categorie_id === id ? potrivire.atribute : []).map((a) => [a.code, a.value]));
    const v: Record<string, string> = {};
    for (const a of deCompletat(at)) {
      // Propunere: „folosit” la starea piesei, dacă OLX are o asemenea valoare. Omul confirmă cu „Salvează”.
      const folosit = a.values?.find((x) => /^used$|folosit|second/i.test(x.code + " " + x.label));
      v[a.code] = salvate[a.code] ?? (a.code === "state" && folosit ? folosit.code : "");
    }
    setValori(v);
  }

  async function propune() {
    const sb = sbBrowser(); if (!sb) return;
    setLucru("sugestie"); setMsg(""); setSugestii([]);
    const { data } = await sb.from("products").select("nume").or(`categorie_id.eq.${c.id},subcategorie_id.eq.${c.id}`).eq("publicat", true).limit(1);
    const titlu = data?.[0]?.nume ?? c.nume;
    const j = await olx({ actiune: "sugestie", q: titlu });
    setLucru("");
    if (!j.ok) { setMsg(j.eroare); return; }
    setSugestii((j.sugestii ?? []).map((s: any) => ({ id: s.id, cale: dupaId.get(s.id)?.cale || s.cale })));
    if (!j.sugestii?.length) setMsg(`OLX n-a propus nimic pentru „${titlu}”.`);
  }

  async function salveaza() {
    if (!ales || !atribute) return;
    const lipsa = deCompletat(atribute).filter((a) => !valori[a.code]?.trim());
    if (lipsa.length) { setMsg(`Completează: ${lipsa.map((a) => a.label).join(", ")}.`); return; }
    const sb = sbBrowser(); if (!sb) return;
    setLucru("salvez"); setMsg("");
    const rand = { categorie_id: c.id, olx_categorie_id: ales, actualizat_la: new Date().toISOString(),
      atribute: deCompletat(atribute).map((a) => ({ code: a.code, value: valori[a.code].trim() })) };
    // upsert + .select(): un UPDATE oprit de RLS întoarce zero rânduri, fără eroare.
    const { data, error } = await sb.from("olx_mapari").upsert(rand, { onConflict: "categorie_id" }).select("categorie_id");
    setLucru("");
    if (error || !data?.length) { setMsg(`NU s-a salvat: ${error?.message ?? "nicio linie scrisă (drepturi?)"}`); return; }
    setDeschis(false); dupaSalvare();
  }

  async function sterge() {
    if (!potrivire || !confirm(`Scoți potrivirea OLX a categoriei „${c.nume}”?`)) return;
    const sb = sbBrowser(); if (!sb) return;
    const r = await scrieVerificat(sb.from("olx_mapari").delete().eq("categorie_id", c.id));
    if (!r.ok) { setMsg(`NU s-a șters: ${r.eroare}`); return; }
    dupaSalvare();
  }

  const gasite = useMemo(() => {
    const cuv = cauta.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!cuv.length) return [];
    return frunze.filter((f) => cuv.every((w) => (f.cale ?? f.nume).toLowerCase().includes(w))).slice(0, 30);
  }, [cauta, frunze]);

  return (
    <div className="text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <b className="font-disp">{c.nume}</b>
        <span className="text-xs text-mut">{c.nr_piese} piese</span>
        <span className="text-xs">→ {efectiv}</span>
        <button type="button" onClick={() => { setDeschis(!deschis); if (!deschis && potrivire) alege(potrivire.olx_categorie_id); }}
          className="ml-auto inline-flex items-center min-h-[44px] text-xs font-semibold text-acc hover:underline">
          {deschis ? "Închide" : potrivire ? "Modifică" : "Alege categoria OLX"}</button>
      </div>
      {deschis && (
        <div className="mt-2 grid gap-2 rounded-xl border-2 border-line p-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="fld flex-1 min-w-[200px]"><label>Caută în categoriile finale OLX</label>
              <input value={cauta} onChange={(e) => setCauta(e.target.value)} placeholder="ex. faruri, motor, oglinzi" /></div>
            <button type="button" onClick={propune} disabled={!!lucru} className="rounded-xl border-2 border-line px-3 py-2 text-xs font-semibold hover:border-acc">
              {lucru === "sugestie" ? "Întreb OLX…" : "Propune (OLX)"}</button>
          </div>
          {[...sugestii.map((s) => ({ id: s.id, text: `★ ${s.cale}` })), ...gasite.map((f) => ({ id: f.id, text: f.cale ?? f.nume }))].map((o, i) => (
            <button key={`${o.id}-${i}`} type="button" onClick={() => alege(o.id)}
              className={`text-left text-xs underline-offset-2 hover:underline ${ales === o.id ? "font-bold text-acc" : ""}`}>{o.text}</button>
          ))}
          {ales && <p className="text-xs">Aleasă: <b>{numeOlx(ales)}</b>{dupaId.get(ales)?.photos_limit ? ` · max. ${dupaId.get(ales)!.photos_limit} poze` : ""}</p>}
          {lucru === "atribute" && <p className="text-xs text-mut">Cer atributele de la OLX…</p>}
          {atribute && deCompletat(atribute).map((a) => (
            <div key={a.code} className="fld"><label>{a.label} (obligatoriu pe OLX)</label>
              {a.values?.length ? (
                <select value={valori[a.code] ?? ""} onChange={(e) => setValori({ ...valori, [a.code]: e.target.value })}>
                  <option value="">— alege —</option>
                  {a.values.map((v) => <option key={v.code} value={v.code}>{v.label}</option>)}
                </select>
              ) : <input value={valori[a.code] ?? ""} onChange={(e) => setValori({ ...valori, [a.code]: e.target.value })} />}
            </div>
          ))}
          {atribute && !deCompletat(atribute).length && <p className="text-xs text-mut">Categoria nu cere atribute în plus (prețul vine din piesă).</p>}
          <div className="flex gap-2">
            <button type="button" className="btn-acc !py-2 text-xs" disabled={!!lucru || !ales || !atribute} onClick={salveaza}>{lucru === "salvez" ? "…" : "Salvează"}</button>
            {potrivire && <button type="button" className="rounded-xl border-2 border-line px-3 py-2 text-xs font-semibold hover:border-red-400" onClick={sterge}>Scoate</button>}
          </div>
        </div>
      )}
      {msg && <p className="text-xs text-red-700 mt-1">{msg}</p>}
    </div>
  );
}
