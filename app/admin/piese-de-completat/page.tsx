"use client";
// ============================================================
// PIESE DE COMPLETAT — piesele venite din import, încă nepublicate.
//
// Fără ecranul ăsta, piesele importate sunt un morman: apar în „Produse", dar
// amestecate cu restul și fără să se vadă ce le lipsește. Aici se vede dintr-o
// privire ce împiedică publicarea fiecăreia și se publică în masă cele gata.
//
// Publicarea NU se face din browser: pozele se descarcă de pe pieseauto.ro, iar
// browserul n-are voie (CORS). Ruta /api/publica-piesa face descărcarea,
// conversia și urcarea în bucketul propriu, apoi trece piesa pe `publicat`.
// ============================================================
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { sbBrowser } from "@/lib/supabase";
import { lei } from "@/lib/format";

type Piesa = {
  id: number; nume: string; slug: string; cod_intern: string | null; pret_lei: number;
  poze: string[] | null; poze_sursa: string[] | null;
  categorie_id: number | null; subcategorie_id: number | null;
  greutate_kg: number | null; greutate_estimata: boolean;
  model_ids: number[]; sursa: string | null; sursa_url: string | null;
  import_erori: { revizuire?: string[] } | null;
};

/** Ce îi lipsește unei piese ca să poată fi publicată, plus ce merită completat
 *  chiar dacă nu blochează. Ordinea contează: prima e cea mai gravă. */
function lipsuri(p: Piesa) {
  const blocante: string[] = [];
  const atentionari: string[] = [];
  if (!(p.poze?.length) && !(p.poze_sursa?.length)) blocante.push("poză");
  if (!p.categorie_id) blocante.push("categorie");
  if (!p.subcategorie_id) atentionari.push("subcategorie");
  if (p.greutate_estimata) atentionari.push("greutate estimată");
  if (!p.model_ids?.length) atentionari.push("model");
  return { blocante, atentionari, gata: blocante.length === 0 };
}

export default function PieseDeCompletat() {
  const [piese, setPiese] = useState<Piesa[]>([]);
  const [cats, setCats] = useState<Record<number, string>>({});
  const [sel, setSel] = useState<number[]>([]);
  const [q, setQ] = useState("");
  const [doarGata, setDoarGata] = useState(false);
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
    let query = sb.from("products").select("*")
      .not("sursa", "is", null).eq("publicat", false)
      .order("created_at", { ascending: false }).limit(500);
    if (q.trim()) query = query.or(`nume.ilike.%${q}%,cod_intern.ilike.%${q}%`);
    const { data } = await query;
    setPiese((data ?? []) as Piesa[]); setSel([]);
  }, [q]);
  useEffect(() => { const t = setTimeout(incarca, q ? 300 : 0); return () => clearTimeout(t); }, [incarca, q]);

  const vizibile = doarGata ? piese.filter((p) => lipsuri(p).gata) : piese;
  const gata = piese.filter((p) => lipsuri(p).gata);

  // ---------- modul rapid de greutăți ----------
  // Operatorul o să facă asta de mii de ori, deci fiecare click în plus contează.
  // O piesă pe ecran, câmpul deja focalizat, Enter salvează și trece mai departe.
  // Fără mouse, fără scroll, fără deschis formulare.
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
    await sb.from("products").update({ greutate_kg: g, greutate_estimata: false }).eq("id", curenta.id);
    setPiese((v) => v.map((x) => (x.id === curenta.id ? { ...x, greutate_kg: g, greutate_estimata: false } : x)));
    setSalvezG(false);
    urmatoarea();
  }

  /** Publicarea merge în loturi de 10: fiecare piesă înseamnă 1–5 descărcări de
   *  imagini, iar o singură cerere cu 50 de piese ar depăși limita de timp. */
  async function publica(ids: number[]) {
    if (!ids.length || lucru) return;
    const sb = sbBrowser();
    const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
    if (!token) { setMsg("Sesiunea a expirat. Autentifică-te din nou."); return; }

    setLucru(true); setMsg(""); setProgres({ facut: 0, total: ids.length });
    let publicate = 0; const esecuri: string[] = [];
    for (let i = 0; i < ids.length; i += 10) {
      const lot = ids.slice(i, i + 10);
      try {
        const r = await fetch("/api/publica-piesa", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ids: lot }),
        });
        const j = await r.json();
        if (!j.ok) { esecuri.push(j.eroare ?? `HTTP ${r.status}`); }
        else {
          publicate += j.publicate ?? 0;
          for (const e of j.esuate ?? []) {
            const p = piese.find((x) => x.id === e.id);
            esecuri.push(`${p?.nume?.slice(0, 40) ?? e.id}: ${e.eroare}`);
          }
        }
      } catch (e: any) { esecuri.push(e.message); }
      setProgres({ facut: Math.min(i + 10, ids.length), total: ids.length });
    }
    setLucru(false); setProgres(null);
    setMsg(`✓ ${publicate} ${publicate === 1 ? "piesă publicată" : "piese publicate"}.` +
      (esecuri.length ? ` ${esecuri.length} au eșuat: ${esecuri.slice(0, 3).join(" · ")}${esecuri.length > 3 ? " …" : ""}` : ""));
    incarca();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-disp font-bold text-xl">Piese de completat</h1>
          <p className="text-sm text-mut mt-1">
            Piese venite din import, încă nepublicate. Publicarea descarcă pozele de la sursă
            și le mută în stocarea proprie — durează câteva secunde pe piesă.
          </p>
        </div>
        <Link href="/admin/produse" className="rounded-lg border-2 border-line px-3 py-2 text-sm font-semibold hover:border-acc">
          Toate produsele
        </Link>
      </div>

      {/* Rezumat */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { k: "În așteptare", v: piese.length },
          { k: "Gata de publicat", v: gata.length, acc: true },
          { k: "Fără poză", v: piese.filter((p) => lipsuri(p).blocante.includes("poză")).length },
          { k: "Greutate estimată", v: piese.filter((p) => p.greutate_estimata).length },
        ].map((c) => (
          <div key={c.k} className="card p-4">
            <div className={`font-disp font-bold text-2xl ${c.acc ? "text-acc" : ""}`}>{c.v}</div>
            <div className="text-xs text-mut mt-0.5">{c.k}</div>
          </div>
        ))}
      </div>

      {/* Bara de acțiuni */}
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Caută după nume sau cod intern…"
          className="flex-1 min-w-[220px] rounded-lg border-2 border-line px-3 min-h-[44px] text-sm" />
        <label className="flex items-center gap-2 text-sm min-h-[44px] cursor-pointer">
          <input type="checkbox" checked={doarGata} onChange={(e) => setDoarGata(e.target.checked)} className="w-4 h-4" />
          Doar cele gata de publicat
        </label>
        <button onClick={() => setSel(sel.length === vizibile.length ? [] : vizibile.map((p) => p.id))}
          className="rounded-lg border-2 border-line px-3 min-h-[44px] text-sm font-semibold hover:border-acc">
          {sel.length === vizibile.length && vizibile.length > 0 ? "Deselectează tot" : "Selectează tot"}
        </button>
        {/* Publicarea în masă: 50 de click-uri individuale ar fi acceptabile, 8.000 nu. */}
        <button onClick={() => publica(sel.filter((id) => lipsuri(piese.find((p) => p.id === id)!).gata))}
          disabled={lucru || !sel.length}
          className="rounded-lg bg-acc text-white px-4 min-h-[44px] text-sm font-bold disabled:opacity-40">
          {lucru ? "Se publică…" : `Publică selecția (${sel.filter((id) => { const p = piese.find((x) => x.id === id); return p && lipsuri(p).gata; }).length})`}
        </button>
        <button onClick={() => publica(gata.map((p) => p.id))} disabled={lucru || !gata.length}
          className="rounded-lg border-2 border-acc text-acc px-4 min-h-[44px] text-sm font-bold disabled:opacity-40">
          Publică toate cele gata ({gata.length})
        </button>
        <button onClick={porneste} disabled={lucru || !piese.some((p) => p.greutate_estimata)}
          className="rounded-lg border-2 border-line px-4 min-h-[44px] text-sm font-semibold hover:border-acc disabled:opacity-40">
          Completează greutățile ({piese.filter((p) => p.greutate_estimata).length})
        </button>
      </div>

      {/* ===== Completarea rapidă a greutăților =====
          O piesă pe ecran, câmpul focalizat, Enter salvează și trece la următoarea.
          Operatorul face asta de mii de ori: fără mouse, fără scroll, fără formulare. */}
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
            {/* Poza de la sursă, doar pentru uz intern: ajută operatorul să
                recunoască piesa fără s-o deschidă. Nu se servește niciodată public. */}
            {curenta.poze_sursa?.[0] && (
              <img src={curenta.poze_sursa[0]} alt="" className="w-32 h-24 object-cover rounded-lg border-2 border-line shrink-0" />
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
            <span>Se publică… {progres.facut} din {progres.total}</span>
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
                <tr key={p.id} className={l.gata ? "" : "bg-paper/60"}>
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
                      {l.blocante.map((x) => (
                        <span key={x} className="rounded px-1.5 py-0.5 text-[11px] font-bold bg-red-100 text-red-700">{x}</span>
                      ))}
                      {l.atentionari.map((x) => (
                        <span key={x} className="rounded px-1.5 py-0.5 text-[11px] bg-line text-mut">{x}</span>
                      ))}
                      {l.gata && !l.atentionari.length && (
                        <span className="rounded px-1.5 py-0.5 text-[11px] font-bold bg-green-100 text-green-700">gata</span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 pr-4 text-right whitespace-nowrap">
                    <Link href={`/admin/produse?editeaza=${p.id}`}
                      className="inline-flex items-center min-h-[36px] px-2.5 rounded-lg border border-line text-xs font-semibold hover:border-acc">
                      Editează
                    </Link>
                    <button onClick={() => publica([p.id])} disabled={lucru || !l.gata}
                      className="ml-2 inline-flex items-center min-h-[36px] px-2.5 rounded-lg bg-acc text-white text-xs font-bold disabled:opacity-30">
                      Publică
                    </button>
                  </td>
                </tr>
              );
            })}
            {vizibile.length === 0 && (
              <tr><td colSpan={6} className="py-10 text-center text-mut">
                {piese.length === 0 ? "Nicio piesă în așteptare. Rulează importul din terminal." : "Nicio piesă nu corespunde filtrului."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
