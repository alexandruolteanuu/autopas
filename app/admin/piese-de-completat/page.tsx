"use client";
// ============================================================
// PIESE DE COMPLETAT — lista de lucru a operatorului.
//
// ROLUL ECRANULUI S-A SCHIMBAT (25 august 2026)
// Înainte era o poartă: piesele importate stăteau nepublicate până le completa
// cineva. Acum piesele se publică direct la import, cu pozele descărcate atunci,
// deci ecranul nu mai blochează nimic. Arată piesele care SUNT pe site, dar
// cărora le lipsește ceva — poză, categorie, greutate cântărită, model — ca să
// poată fi îmbunătățite când e timp, în ordinea gravității.
//
// Singurul lucru care rămâne blocant e în altă parte: detaliul comenzii
// avertizează cu bandă galbenă dacă vreo piesă comandată are încă greutatea
// estimată, fiindcă de acolo iese AWB-ul și factura de la curier.
// ============================================================
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { sbBrowser, scrieVerificat } from "@/lib/supabase";
import { lei } from "@/lib/format";

type Piesa = {
  id: number; nume: string; slug: string; cod_intern: string | null; pret_lei: number;
  poze: string[] | null; poze_sursa: string[] | null;
  categorie_id: number | null; subcategorie_id: number | null;
  greutate_kg: number | null; greutate_estimata: boolean;
  model_ids: number[]; sursa: string | null; sursa_url: string | null;
  publicat: boolean; sursa_activ: boolean;
  import_erori: { revizuire?: string[] } | null;
};

// Ce îi lipsește unei piese, în ordinea gravității. Prima din listă e cea mai
// gravă: o piesă publicată fără poză o vede clientul goală chiar acum.
const LIPSURI = [
  { cheie: "poza",      eticheta: "poză",              grav: true,  are: (p: Piesa) => !(p.poze?.length) },
  { cheie: "categorie", eticheta: "categorie",         grav: true,  are: (p: Piesa) => !p.categorie_id },
  { cheie: "greutate",  eticheta: "greutate estimată", grav: false, are: (p: Piesa) => p.greutate_estimata },
  { cheie: "model",     eticheta: "model",             grav: false, are: (p: Piesa) => !p.model_ids?.length },
  { cheie: "subcat",    eticheta: "subcategorie",      grav: false, are: (p: Piesa) => !p.subcategorie_id },
];

const lipsuri = (p: Piesa) => LIPSURI.filter((l) => l.are(p));
/** Scor de sortare: cu cât mai mic, cu atât mai urgent. */
const urgenta = (p: Piesa) => {
  const l = lipsuri(p);
  if (!l.length) return 99;
  return LIPSURI.findIndex((x) => x.cheie === l[0].cheie);
};

export default function PieseDeCompletat() {
  const [piese, setPiese] = useState<Piesa[]>([]);
  const [cats, setCats] = useState<Record<number, string>>({});
  const [sel, setSel] = useState<number[]>([]);
  const [q, setQ] = useState("");
  const [filtru, setFiltru] = useState("toate");
  const [lucru, setLucru] = useState(false);
  const [progres, setProgres] = useState<{ facut: number; total: number } | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const sb = sbBrowser(); if (!sb) return;
    sb.from("categories").select("id,nume").then(({ data }) =>
      setCats(Object.fromEntries((data ?? []).map((c: any) => [c.id, c.nume]))));
  }, []);

  const incarca = useCallback(async () => {
    const sb = sbBrowser(); if (!sb) return;
    // Piesele venite din import cărora le lipsește ceva. Cele complete nu apar
    // deloc: n-au ce căuta într-o listă de lucru.
    let query = sb.from("products").select("*")
      .not("sursa", "is", null)
      .or("poze.eq.{},categorie_id.is.null,greutate_estimata.eq.true,model_ids.eq.{},publicat.eq.false")
      .order("created_at", { ascending: false }).limit(500);
    if (q.trim()) query = query.or(`nume.ilike.%${q}%,cod_intern.ilike.%${q}%`);
    const { data } = await query;
    setPiese((data ?? []) as Piesa[]); setSel([]);
  }, [q]);
  useEffect(() => { const t = setTimeout(incarca, q ? 300 : 0); return () => clearTimeout(t); }, [incarca, q]);

  const vizibile = piese
    .filter((p) => filtru === "toate" || lipsuri(p).some((l) => l.cheie === filtru))
    .sort((a, b) => urgenta(a) - urgenta(b));

  // Piese LIVE pe site fără nicio poză: cel mai grav caz din ecran. Au URL-urile
  // de la sursă intacte, deci pozele se pot aduce acum, fără reimport.
  const faraPoze = piese.filter((p) => !(p.poze?.length) && (p.poze_sursa?.length ?? 0) > 0);
  const nepublicate = piese.filter((p) => !p.publicat && p.sursa_activ);

  // ---------- modul rapid de greutăți ----------
  // Operatorul o să facă asta de mii de ori, deci fiecare click în plus contează.
  // O piesă pe ecran, câmpul deja focalizat, Enter salvează și trece mai departe.
  // Lista se FIXEAZĂ la intrarea în mod. Dacă am recalcula-o la fiecare salvare,
  // piesa tocmai cântărită ar dispărea din listă, iar indexul ar sări peste
  // următoarea — operatorul ar rămâne cu piese necântărite fără să înțeleagă de ce.
  const [modGreutati, setModGreutati] = useState<Piesa[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [valoare, setValoare] = useState("");
  const [salvezG, setSalvezG] = useState(false);
  const campRef = useRef<HTMLInputElement>(null);
  const curenta = modGreutati?.[idx] ?? null;

  useEffect(() => { if (curenta) { setValoare(""); campRef.current?.focus(); } }, [curenta]);

  function porneste() {
    const lista = piese.filter((p) => p.greutate_estimata);
    if (!lista.length) { setMsg("Nicio piesă cu greutate estimată."); return; }
    setIdx(0); setValoare(""); setModGreutati(lista);
  }

  function urmatoarea() {
    if (!modGreutati) return;
    if (idx + 1 >= modGreutati.length) {
      setModGreutati(null); setIdx(0);
      setMsg("✓ Gata — ai trecut prin toate piesele cu greutate estimată.");
      incarca();
      return;
    }
    setIdx(idx + 1);
  }

  async function salveazaGreutate() {
    if (!curenta || salvezG) return;
    const g = Number(valoare.replace(",", "."));
    if (!g || g <= 0) { campRef.current?.focus(); return; }
    setSalvezG(true);
    const sb = sbBrowser()!;
    // Greutatea e singurul lucru care ține AWB-ul corect. O salvare picată în
    // tăcere aici ar însemna colete cântărite greșit, descoperite la factura de
    // la curier — de asta se verifică rândul atins, nu doar lipsa erorii.
    const r = await scrieVerificat(
      sb.from("products").update({ greutate_kg: g, greutate_estimata: false }).eq("id", curenta.id));
    setSalvezG(false);
    if (!r.ok) { setMsg(`Greutatea NU s-a salvat: ${r.eroare}`); return; }
    setPiese((v) => v.map((x) => (x.id === curenta.id ? { ...x, greutate_kg: g, greutate_estimata: false } : x)));
    urmatoarea();
  }

  /** Aducerea pozelor merge în loturi de 10: fiecare piesă înseamnă 1–5
   *  descărcări de imagini, iar o singură cerere cu 50 ar depăși limita de timp.
   *  Ruta e aceeași cu cea de la publicare — descarcă, convertește, urcă. */
  async function aduPoze(ids: number[]) {
    if (!ids.length || lucru) return;
    const sb = sbBrowser();
    const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
    if (!token) { setMsg("Sesiunea a expirat. Autentifică-te din nou."); return; }

    setLucru(true); setMsg(""); setProgres({ facut: 0, total: ids.length });
    let reparate = 0; const esecuri: string[] = [];
    for (let i = 0; i < ids.length; i += 10) {
      const lot = ids.slice(i, i + 10);
      try {
        const r = await fetch("/api/publica-piesa", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ids: lot }),
        });
        const j = await r.json();
        if (!j.ok) esecuri.push(j.eroare ?? `HTTP ${r.status}`);
        else {
          reparate += j.publicate ?? 0;
          for (const e of j.esuate ?? []) {
            const p = piese.find((x) => x.id === e.id);
            esecuri.push(`${p?.nume?.slice(0, 40) ?? e.id}: ${e.eroare}`);
          }
        }
      } catch (e: any) { esecuri.push(e.message); }
      setProgres({ facut: Math.min(i + 10, ids.length), total: ids.length });
    }
    setLucru(false); setProgres(null);
    setMsg(`✓ ${reparate} ${reparate === 1 ? "piesă rezolvată" : "piese rezolvate"}.` +
      (esecuri.length ? ` ${esecuri.length} au eșuat: ${esecuri.slice(0, 3).join(" · ")}${esecuri.length > 3 ? " …" : ""}` : ""));
    incarca();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-disp font-bold text-xl">Piese de completat</h1>
          <p className="text-sm text-mut mt-1 max-w-2xl">
            Piese venite din import care sunt deja pe site, dar cărora le lipsește ceva.
            Nu blochează nimic — sunt de îmbunătățit când ai timp. Cele mai grave stau primele.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/import" className="rounded-lg border-2 border-line px-3 py-2 text-sm font-semibold hover:border-acc">
            Import
          </Link>
          <Link href="/admin/produse" className="rounded-lg border-2 border-line px-3 py-2 text-sm font-semibold hover:border-acc">
            Toate produsele
          </Link>
        </div>
      </div>

      {/* Rezumat */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { k: "De completat", v: piese.length },
          { k: "Fără poze", v: faraPoze.length, rau: faraPoze.length > 0 },
          { k: "Fără categorie", v: piese.filter((p) => !p.categorie_id).length },
          { k: "Greutate estimată", v: piese.filter((p) => p.greutate_estimata).length },
        ].map((c) => (
          <div key={c.k} className="card p-4">
            <div className={`font-disp font-bold text-2xl ${c.rau ? "text-red-600" : ""}`}>{c.v}</div>
            <div className="text-xs text-mut mt-0.5">{c.k}</div>
          </div>
        ))}
      </div>

      {/* ===== Piese LIVE pe site, dar fără poze =====
          Clientul le vede goale chiar acum. Banda apare doar când există. */}
      {faraPoze.length > 0 && (
        <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <b className="text-red-800 block">
                {faraPoze.length} {faraPoze.length === 1 ? "piesă e pe site fără nicio poză" : "piese sunt pe site fără nicio poză"}
              </b>
              <span className="text-xs text-red-800/80">
                Descărcarea a eșuat la import. URL-urile de la sursă sunt intacte, deci pozele se pot aduce acum.
              </span>
            </div>
            <button onClick={() => aduPoze(faraPoze.map((p) => p.id))} disabled={lucru}
              className="rounded-lg bg-red-600 text-white px-4 min-h-[44px] text-sm font-bold disabled:opacity-40">
              Reia pozele eșuate ({faraPoze.length})
            </button>
          </div>
        </div>
      )}

      {/* Bara de acțiuni */}
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Caută după nume sau cod intern…"
          className="flex-1 min-w-[220px] rounded-lg border-2 border-line px-3 min-h-[44px] text-sm" />
        <select value={filtru} onChange={(e) => setFiltru(e.target.value)}
          className="rounded-lg border-2 border-line px-3 min-h-[44px] text-sm font-semibold">
          <option value="toate">Ce lipsește: tot</option>
          {LIPSURI.map((l) => (
            <option key={l.cheie} value={l.cheie}>
              Lipsă: {l.eticheta} ({piese.filter(l.are).length})
            </option>
          ))}
        </select>
        <button onClick={porneste} disabled={lucru || !piese.some((p) => p.greutate_estimata)}
          className="rounded-lg bg-acc text-white px-4 min-h-[44px] text-sm font-bold disabled:opacity-40">
          Completează greutățile ({piese.filter((p) => p.greutate_estimata).length})
        </button>
        {sel.length > 0 && (
          <button onClick={() => aduPoze(sel)} disabled={lucru}
            className="rounded-lg border-2 border-acc text-acc px-4 min-h-[44px] text-sm font-bold disabled:opacity-40">
            Adu pozele pentru selecție ({sel.length})
          </button>
        )}
      </div>

      {/* Piese depublicate (dispărute din feed și revenite manual) — se pot repune pe site. */}
      {nepublicate.length > 0 && (
        <div className="card p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm">
            <b>{nepublicate.length}</b> piese importate nu sunt publicate.
            <span className="block text-xs text-mut">
              Fie au fost depublicate manual, fie a eșuat inserarea lor. Verifică-le înainte de a le repune.
            </span>
          </div>
          <Link href="/admin/produse?f=nepublicate"
            className="rounded-lg border-2 border-line px-3 min-h-[40px] flex items-center text-sm font-semibold hover:border-acc">
            Vezi în Produse
          </Link>
        </div>
      )}

      {/* ===== Completarea rapidă a greutăților ===== */}
      {curenta && modGreutati && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-mut font-semibold">
              Greutăți · {idx + 1} din {modGreutati.length}
            </div>
            <button onClick={() => { setModGreutati(null); incarca(); }}
              className="text-xs text-mut hover:text-acc min-h-[32px] px-2">Închide</button>
          </div>
          <div className="h-1.5 rounded-full bg-line overflow-hidden mb-4">
            <div className="h-full bg-acc transition-all" style={{ width: `${(idx / modGreutati.length) * 100}%` }} />
          </div>

          <div className="flex gap-4 items-start flex-wrap">
            {(curenta.poze?.[0] || curenta.poze_sursa?.[0]) && (
              <img src={curenta.poze?.[0] || curenta.poze_sursa![0]} alt=""
                className="w-32 h-24 object-cover rounded-lg border-2 border-line shrink-0" />
            )}
            <div className="flex-1 min-w-[260px]">
              <div className="font-disp font-bold text-lg leading-snug">{curenta.nume}</div>
              <div className="text-xs text-mut mt-1">
                {curenta.cod_intern} · {lei(curenta.pret_lei)}
                {curenta.categorie_id ? ` · ${cats[curenta.subcategorie_id ?? curenta.categorie_id] ?? ""}` : ""}
              </div>
              <form onSubmit={(e) => { e.preventDefault(); salveazaGreutate(); }} className="mt-4 flex items-end gap-2 flex-wrap">
                <div>
                  <label className="block text-xs text-mut mb-1">Greutate reală (kg)</label>
                  <input ref={campRef} value={valoare} onChange={(e) => setValoare(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Escape") { setModGreutati(null); incarca(); } }}
                    type="text" inputMode="decimal" autoFocus placeholder="ex. 2,4"
                    className="w-40 rounded-lg border-2 border-line px-3 min-h-[48px] text-lg font-semibold" />
                </div>
                <button type="submit" disabled={salvezG}
                  className="rounded-lg bg-acc text-white px-5 min-h-[48px] font-bold disabled:opacity-40">
                  {salvezG ? "Se salvează…" : "Salvează · Enter"}
                </button>
                <button type="button" onClick={urmatoarea}
                  className="rounded-lg border-2 border-line px-4 min-h-[48px] text-sm font-semibold hover:border-acc">
                  Sari peste
                </button>
              </form>
              <p className="text-[11px] text-mut mt-2">
                Enter salvează și trece la următoarea · Esc închide · acum are 1 kg estimat
              </p>
            </div>
          </div>
        </div>
      )}

      {progres && (
        <div className="card p-4">
          <div className="flex justify-between text-sm mb-2">
            <span>Se aduc pozele… {progres.facut} din {progres.total}</span>
            <span className="text-mut">nu închide pagina</span>
          </div>
          <div className="h-2 rounded-full bg-line overflow-hidden">
            <div className="h-full bg-acc transition-all" style={{ width: `${(progres.facut / progres.total) * 100}%` }} />
          </div>
        </div>
      )}

      {msg && <div className="card p-3 text-sm">{msg}</div>}

      {/* Lista */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm md:min-w-[860px]">
          <thead>
            <tr className="text-left text-mut text-xs border-b border-line">
              <th className="py-2 pl-4 w-10"></th>
              <th className="py-2">Piesă</th>
              <th className="py-2">Categorie</th>
              <th className="py-2">Preț</th>
              <th className="py-2">Ce lipsește</th>
              <th className="py-2 pr-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {vizibile.map((p) => {
              const l = lipsuri(p);
              return (
                <tr key={p.id} className={l.some((x) => x.grav) ? "bg-paper/60" : ""}>
                  <td className="py-2 pl-4">
                    <input type="checkbox" checked={sel.includes(p.id)} className="w-4 h-4"
                      onChange={(e) => setSel(e.target.checked ? [...sel, p.id] : sel.filter((x) => x !== p.id))} />
                  </td>
                  <td className="py-2">
                    <Link href={`/admin/produse?editeaza=${p.id}`} className="font-semibold hover:text-acc">
                      {p.nume}
                    </Link>
                    <div className="text-[11px] text-mut">
                      {p.cod_intern}
                      {p.publicat ? "" : " · nepublicată"}
                      {p.poze_sursa?.length ? ` · ${p.poze_sursa.length} ${p.poze_sursa.length === 1 ? "poză la sursă" : "poze la sursă"}` : ""}
                    </div>
                  </td>
                  <td className="py-2 text-mut">
                    {p.categorie_id ? cats[p.categorie_id] ?? "—" : <span className="text-red-600 font-semibold">lipsă</span>}
                    {p.subcategorie_id ? <span className="block text-[11px]">{cats[p.subcategorie_id]}</span> : null}
                  </td>
                  <td className="py-2 whitespace-nowrap">{lei(p.pret_lei)}</td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1">
                      {l.map((x) => (
                        <span key={x.cheie} className={`rounded px-1.5 py-0.5 text-[11px] ${
                          x.grav ? "font-bold bg-red-100 text-red-700" : "bg-line text-mut"}`}>{x.eticheta}</span>
                      ))}
                    </div>
                  </td>
                  <td className="py-2 pr-4 text-right whitespace-nowrap">
                    <Link href={`/piese/${p.slug}`} target="_blank"
                      className="inline-flex items-center min-h-[36px] px-2.5 rounded-lg border border-line text-xs font-semibold hover:border-acc">
                      Vezi
                    </Link>
                    <Link href={`/admin/produse?editeaza=${p.id}`}
                      className="ml-2 inline-flex items-center min-h-[36px] px-2.5 rounded-lg bg-acc text-white text-xs font-bold">
                      Completează
                    </Link>
                  </td>
                </tr>
              );
            })}
            {vizibile.length === 0 && (
              <tr><td colSpan={6} className="py-10 text-center text-mut">
                {piese.length === 0
                  ? "Nicio piesă de completat. Tot ce s-a importat are poză, categorie și greutate cântărită."
                  : "Nicio piesă nu corespunde filtrului."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
