"use client";
// ANUNȚURI OLX (pasul 2 din docs/olx-plan.md): raportul generatorului pe tot
// catalogul publicat cu stoc — câte piese ar pleca, câte nu și de ce, ce reguli de
// text ar fi încălcat textul BRUT și ce s-a corectat automat. Doar citire, nu cheamă
// OLX. Lista anunțurilor și publicarea în masă vin la pasul 3.
import { useState } from "react";
import Link from "next/link";
import { sbBrowser } from "@/lib/supabase";
import { eticheta } from "@/components/admin/OlxPiesa";

type Grup = Record<string, { n: number; exemple: { id: number; cod: string; nume: string }[] }>;
type Raport = { ok: boolean; eroare?: string; total: number; gata: number; cuIncalcariBrute: number; setariLipsa: string[];
                motive: Grup; brute: Grup; corectari: Grup; riscuri: Grup };

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

const etiRegula = (k: string) => { const [camp, r] = k.split(": "); return `${camp}: ${eticheta(r)}`; };

export default function AnunturiOlx() {
  const [r, setR] = useState<Raport | null>(null);
  const [lucru, setLucru] = useState(false);

  async function genereaza() {
    setLucru(true);
    const sb = sbBrowser();
    const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
    const x = await fetch("/api/olx", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
      body: JSON.stringify({ actiune: "raport" }) });
    setR(await x.json().catch(() => ({ ok: false, eroare: `Răspuns neașteptat (HTTP ${x.status}).` })));
    setLucru(false);
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="dim">Administrare</div>
        <h1 className="font-disp font-bold text-2xl mt-1">Anunțuri OLX</h1>
        <p className="text-sm text-mut mt-1">Deocamdată: raportul anunțurilor pe tot catalogul. Publicarea începe după aprobarea aplicației de către OLX.
          {" "}<Link href="/admin/olx/categorii" className="underline font-semibold">Potrivirea categoriilor →</Link></p>
      </div>
      <div className="card p-4 text-sm flex flex-wrap items-center gap-3">
        <button type="button" onClick={genereaza} disabled={lucru} className="btn-dark !py-2 text-xs">
          {lucru ? "Se generează anunțurile (câteva secunde)…" : "Raport pe tot catalogul"}</button>
        <span className="text-xs text-mut">Generează anunțul pentru fiecare piesă publicată cu stoc, fără să trimită nimic.</span>
      </div>
      {r && !r.ok && <p className="text-sm text-red-700">{r.eroare}</p>}
      {r?.ok && (<>
        <div className="card p-4 text-sm grid gap-1">
          <p><b>{r.total}</b> piese publicate cu stoc. <b className="text-ok">{r.gata}</b> au anunțul gata; <b className="text-red-700">{r.total - r.gata}</b> nu se pot publica încă (vezi mai jos).</p>
          <p><b>{r.cuIncalcariBrute}</b> piese au textul brut (titlu sau descriere) care ar fi fost REFUZAT de OLX; după curățarea automată, toate trec regulile de text.</p>
          {r.setariLipsa.length > 0 && <p className="text-amber-800">⚠ Pentru tot catalogul: {r.setariLipsa.join("; ")}.</p>}
        </div>
        <Tabel titlu="De ce nu se pot publica" g={r.motive} nota="Piesele de aici nu pleacă la OLX până nu se rezolvă motivul." />
        <Tabel titlu="Textul brut ar fi fost refuzat de OLX — pe reguli" g={r.brute} eti={etiRegula}
          nota="Ce ar fi încălcat titlul sau descrierea așa cum sunt pe site. O piesă poate apărea la mai multe reguli." />
        <Tabel titlu="Corectat automat în anunț" g={r.corectari} eti={eticheta} nota="Doar în anunțul OLX; textul de pe site rămâne neatins." />
        <Tabel titlu="De urmărit la proba reală" g={r.riscuri}
          nota="Nu blochează publicarea. Un cod de 10 cifre care începe cu 0 (ex. Bosch) poate fi luat de OLX drept telefon." />
      </>)}
    </div>
  );
}
