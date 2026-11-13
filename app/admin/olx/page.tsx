"use client";
// ANUNȚURI OLX: (1) anunțurile create de aplicație, cu starea lor (`olx_anunturi`, citit
// de echipă prin RLS); (2) raportul generatorului pe tot catalogul publicat cu stoc — câte
// piese ar pleca, de ce nu și ce s-a corectat automat. Raportul nu cheamă OLX.
// Publicarea se face deocamdată din pagina fiecărei piese; automat + în masă la pasul 3
// din docs/olx-plan.md. Potrivirea categoriilor e făcută — linkul stă discret, la final.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { sbBrowser } from "@/lib/supabase";
import { eticheta, STARI } from "@/components/admin/OlxPiesa";

type Grup = Record<string, { n: number; exemple: { id: number; cod: string; nume: string }[] }>;
type Raport = { ok: boolean; eroare?: string; total: number; gata: number; cuIncalcariBrute: number; setariLipsa: string[];
                motive: Grup; brute: Grup; corectari: Grup; riscuri: Grup };
type Anunt = { product_id: number | null; cod_intern: string; advert_id: number | null; status: string; url: string | null;
               valid_to: string | null; eroare: string | null; motiv_moderare: string | null; actualizat_la: string };

/** Stările care cer atenția omului (respinse, neplătite, erori). */
const DE_URMARIT = ["limited", "unpaid", "moderated", "blocked", "disabled", "removed_by_moderator", "eroare"];

function Tabel({ titlu, g, nota, eti = (k: string) => k }: { titlu: string; g: Grup; nota?: string; eti?: (k: string) => string }) {
  const r = Object.entries(g).sort((a, b) => b[1].n - a[1].n);
  return (
    <div className="card p-4 text-sm">
      <b className="font-disp">{titlu}</b>{nota && <p className="text-xs text-mut mt-1">{nota}</p>}
      {!r.length ? <p className="text-xs text-ok mt-2">✓ Niciuna.</p> : (
        <ul className="mt-2 space-y-1">
          {r.map(([k, v]) => (
            <li key={k}><details><summary className="cursor-pointer"><b>{v.n}</b> — {eti(k)}</summary>
              <ul className="pl-4 mt-1 text-xs space-y-0.5">
                {v.exemple.map((e) => <li key={e.id}><Link className="underline" href={`/admin/produse/${e.id}`}>{e.cod}</Link> {e.nume}</li>)}
                {v.n > v.exemple.length && <li className="text-mut">… și încă {v.n - v.exemple.length}</li>}
              </ul></details></li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AnunturiOlx() {
  const [anunturi, setAnunturi] = useState<Anunt[] | null>(null);
  const [total, setTotal] = useState(0);
  const [r, setR] = useState<Raport | null>(null);
  const [lucru, setLucru] = useState(false);

  // Ultimele 100 de anunțuri + totalul. Lista completă, cu filtre, vine la pasul 3.
  const citeste = useCallback(async () => {
    const sb = sbBrowser(); if (!sb) return;
    const { data, count } = await sb.from("olx_anunturi")
      .select("product_id,cod_intern,advert_id,status,url,valid_to,eroare,motiv_moderare,actualizat_la", { count: "exact" })
      .order("actualizat_la", { ascending: false }).limit(100);
    setAnunturi((data as Anunt[]) ?? []); setTotal(count ?? 0);
  }, []);
  useEffect(() => { citeste(); }, [citeste]);

  async function genereaza() {
    setLucru(true);
    const sb = sbBrowser();
    const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
    const x = await fetch("/api/olx", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
      body: JSON.stringify({ actiune: "raport" }) });
    setR(await x.json().catch(() => ({ ok: false, eroare: `Răspuns neașteptat (HTTP ${x.status}).` })));
    setLucru(false);
  }

  const peStare: Record<string, number> = {};
  for (const a of anunturi ?? []) peStare[a.status] = (peStare[a.status] ?? 0) + 1;
  const neplatite = (peStare.limited ?? 0) + (peStare.unpaid ?? 0);

  return (
    <div className="space-y-4 max-w-5xl">
      <div>
        <div className="dim">Administrare</div>
        <h1 className="font-disp font-bold text-2xl mt-1">Anunțuri OLX</h1>
        <p className="text-sm text-mut mt-1">
          Deocamdată anunțurile se publică din pagina fiecărei piese (caseta „OLX”). Trimiterea automată și publicarea
          întregului catalog vin la pasul următor. Conexiunea cu contul: <Link href="/admin/integrari#olx" className="underline">Integrări → OLX</Link>.
        </p>
      </div>

      {/* Anunțurile existente */}
      <div className="card p-4 text-sm">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <b className="font-disp">Anunțurile create din aplicație</b>
          <span className="text-xs text-mut">{anunturi === null ? "Se citesc…" : `${total} în total`}
            {Object.entries(peStare).map(([s, n]) => ` · ${n} ${STARI[s]?.split(" — ")[0] ?? s}`).join("")}</span>
          <button type="button" onClick={citeste} className="text-xs underline ml-auto">Reîncarcă</button>
        </div>
        {neplatite > 0 && (
          <p className="mt-2 text-xs rounded-lg border-2 border-amber-300 bg-amber-50 text-amber-900 p-2">
            ⚠ {neplatite} {neplatite === 1 ? "anunț e neplătit" : "anunțuri sunt neplătite"} (peste limita gratuită a categoriei) — nu
            se văd pe OLX până nu se cumpără un pachet și se activează din contul OLX. Aplicația nu plătește nimic.</p>
        )}
        {anunturi && anunturi.length === 0 && <p className="text-xs text-mut mt-2">Niciun anunț încă.</p>}
        {!!anunturi?.length && (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-left text-mut"><th className="py-1 pr-3">Piesa</th><th className="pr-3">Stare</th><th className="pr-3">Valabil până la</th><th>OLX</th></tr></thead>
              <tbody className="divide-y divide-line">
                {anunturi.map((a) => (
                  <tr key={a.cod_intern + (a.advert_id ?? "")}>
                    <td className="py-1.5 pr-3 whitespace-nowrap">{a.product_id
                      ? <Link href={`/admin/produse/${a.product_id}`} className="underline font-semibold">{a.cod_intern}</Link>
                      : <span title="Piesa a fost ștearsă de pe site">{a.cod_intern} (ștearsă)</span>}</td>
                    <td className={`pr-3 ${DE_URMARIT.includes(a.status) ? "text-red-700 font-semibold" : ""}`}>
                      {STARI[a.status] ?? a.status}
                      {(a.motiv_moderare || a.eroare) && <div className="font-normal text-red-700">{a.motiv_moderare ?? a.eroare}</div>}</td>
                    <td className="pr-3 whitespace-nowrap">{a.valid_to ? new Date(a.valid_to).toLocaleDateString("ro-RO") : "—"}</td>
                    <td className="whitespace-nowrap">{a.url ? <a href={a.url} target="_blank" rel="noreferrer" className="underline">#{a.advert_id}</a> : a.advert_id ? `#${a.advert_id}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {total > anunturi.length && <p className="text-xs text-mut mt-1">Se arată ultimele {anunturi.length} actualizate.</p>}
          </div>
        )}
      </div>

      {/* Raportul pe catalog */}
      <div className="card p-4 text-sm flex flex-wrap items-center gap-3">
        <button type="button" onClick={genereaza} disabled={lucru} className="btn-dark !py-2 text-xs">
          {lucru ? "Se generează anunțurile (câteva secunde)…" : "Raport pe tot catalogul"}</button>
        <span className="text-xs text-mut">Verifică anunțul fiecărei piese publicate cu stoc, fără să trimită nimic la OLX.</span>
      </div>
      {r && !r.ok && <p className="text-sm text-red-700">{r.eroare}</p>}
      {r?.ok && (<>
        <div className="card p-4 text-sm grid gap-1">
          <p><b>{r.total}</b> piese publicate cu stoc: <b className="text-ok">{r.gata}</b> au anunțul gata
            {r.total - r.gata > 0 && <>, <b className="text-red-700">{r.total - r.gata}</b> nu se pot publica încă (motivele mai jos)</>}.</p>
          {r.setariLipsa.length > 0 && <p className="text-amber-800">⚠ Pentru tot catalogul: {r.setariLipsa.join("; ")}.</p>}
        </div>
        {r.total - r.gata > 0 && <Tabel titlu="De ce nu se pot publica" g={r.motive} nota="Piesele de aici nu pleacă la OLX până nu se rezolvă motivul." />}
        <Tabel titlu="Corectat automat în anunț" g={r.corectari} eti={eticheta}
          nota="Textul de pe site încălca o regulă OLX și a fost corectat doar în anunț; pe site rămâne neatins." />
        <Tabel titlu="De urmărit" g={r.riscuri} nota="Nu blochează publicarea." />
      </>)}

      <p className="text-xs text-mut">
        <Link href="/admin/olx/categorii" className="underline">Potrivirea categoriilor OLX</Link> — făcută pentru toate categoriile
        cu piese; se deschide doar dacă apare o categorie nouă pe site sau vrei să muți una.</p>
    </div>
  );
}
