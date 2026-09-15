"use client";
// ============================================================
// PREIA ANUNȚUL — tabul pe care îl deschide butonul „Preia în Autopas" de pe pieseauto.ro.
//
// DE CE (cerut de proprietar, 15 septembrie 2026)
// pieseauto.ro refuză cererile serverului nostru, deci ciornele din „Piese noi din
// CSV" nu-și mai pot aduce singure pozele și descrierea. Anunțul îl deschide
// operatorul, în browserul lui; butonul trimite pagina și pozele la server, sub un
// cod aleator pe care îl pune și în adresa tabului ăstuia (`#p=<cod>`).
//
// Tabul NU vorbește cu pagina pieseauto.ro: aceea trimite
// `Cross-Origin-Opener-Policy: same-origin`, care taie orice legătură între taburi
// (prima variantă, prin `window.opener`, nu primea nimic). Tabul doar întreabă
// serverul, cu sesiunea echipei, până când butonul a terminat de trimis.
//
// Pașii: așteaptă → arată ce a sosit (titlu, descriere, poze) → „Preia și publică",
// care completează piesa pe server cu ACELEAȘI reguli ca importul (`piesaDinPagina`).
// ============================================================
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { sbBrowser } from "@/lib/supabase";
import { lei } from "@/lib/format";

type Stare = {
  ok: boolean; eroare?: string; gata?: boolean; pagina?: boolean; poze_sosite?: number;
  problema?: string | null; piesa?: { id: number; cod_intern: string; pret_lei: number; sursa_id: string } | null;
  ext?: { titlu: string | null; descriere: string | null; oem: string | null; compat: string[]; categorie_sursa: string | null; poze: number };
  poze?: (string | null)[]; erori?: string[];
};
type Rezultat = { ok: boolean; eroare?: string; publicata?: boolean; piesa?: any; rezumat?: any; revizuire?: string[] };

const COD = /^[a-z0-9]{6,12}-[a-z0-9]{16,64}$/;
/** Cât așteaptă tabul butonul: o pagină cu 20 de poze pe o conexiune lentă. */
const ASTEPTARE_MS = 4 * 60 * 1000;

async function cere(corp: any) {
  const sb = sbBrowser();
  const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
  if (!token) return { ok: false, eroare: "Sesiunea a expirat. Intră din nou în admin." };
  try {
    const r = await fetch("/api/preia-anunt", {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(corp),
    });
    return await r.json().catch(() => ({ ok: false, eroare: `HTTP ${r.status}` }));
  } catch (e: any) { return { ok: false, eroare: e?.message ?? String(e) }; }
}

export default function PreiaAnunt() {
  const [cod, setCod] = useState<string | null | undefined>(undefined);
  const [stare, setStare] = useState<Stare | null>(null);
  const [expirat, setExpirat] = useState(false);
  const [lucru, setLucru] = useState(false);
  const [rezultat, setRezultat] = useState<Rezultat | null>(null);
  const [urmatoarea, setUrmatoarea] = useState<{ url: string; ramase: number } | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.hash.slice(1)).get("p");
    setCod(p && COD.test(p) ? p : null);
  }, []);

  // ---------- așteptarea: întreabă serverul până a sosit tot ----------
  useEffect(() => {
    if (!cod) return;
    let oprit = false;
    const start = Date.now();
    (async function bucla() {
      while (!oprit) {
        const s: Stare = await cere({ actiune: "stare", p: cod });
        if (oprit) return;
        setStare(s);
        if (s.gata || !s.ok) return;
        if (Date.now() - start > ASTEPTARE_MS) { setExpirat(true); return; }
        await new Promise((r) => setTimeout(r, 1500));
      }
    })();
    return () => { oprit = true; };
  }, [cod]);

  const urmatoareaCiorna = useCallback(async (dupaId: number) => {
    const sb = sbBrowser(); if (!sb) return;
    const { data, count } = await sb.from("products").select("id,sursa_url", { count: "exact" })
      .eq("sursa", "pieseauto.ro").eq("sursa_activ", true).filter("import_erori->>ciorna", "eq", "true")
      .neq("id", dupaId).not("sursa_url", "is", null).order("id").limit(1);
    setUrmatoarea(data?.[0]?.sursa_url ? { url: data[0].sursa_url, ramase: count ?? 0 } : null);
  }, []);

  async function preia() {
    if (!cod || !stare?.piesa || lucru) return;
    setLucru(true);
    const j: Rezultat = await cere({ actiune: "salveaza", p: cod });
    setRezultat(j); setLucru(false);
    if (j.ok) urmatoareaCiorna(stare.piesa.id);
  }

  async function renunta() {
    if (cod) await cere({ actiune: "renunta", p: cod });
    window.close();
  }

  const ext = stare?.ext;
  const pozeVenite = stare?.poze?.filter(Boolean).length ?? 0;

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <div className="dim">Administrare · Piese noi din CSV</div>
        <h1 className="font-disp font-bold text-2xl mt-1">Preia anunțul de pe pieseauto.ro</h1>
      </div>

      {cod === null && (
        <div className="card p-6 text-sm space-y-2">
          <p><b>Tabul ăsta nu a primit niciun anunț.</b> Se deschide singur, din butonul „Preia în Autopas" apăsat pe o pagină de anunț pieseauto.ro.</p>
          <p className="text-mut">Butonul și instrucțiunile sunt în <Link href="/admin/piese-noi" className="underline">Piese noi din CSV</Link>. Dacă ai pus butonul mai demult, șterge-l din bara de favorite și trage-l din nou.</p>
        </div>
      )}

      {cod && !stare?.gata && !rezultat && (
        <div className="card p-6 text-sm space-y-1">
          {stare && !stare.ok ? (
            <p className="text-red-700"><b>Nu pot citi preluarea:</b> {stare.eroare}</p>
          ) : expirat ? (
            <>
              <p className="text-red-700"><b>Anunțul n-a sosit în 4 minute.</b></p>
              <p className="text-mut">Uită-te în colțul paginii pieseauto.ro: acolo scrie ce s-a întâmplat. Dacă scrie „Butonul e vechi", ia-l din nou din Piese noi din CSV.</p>
            </>
          ) : (
            <>
              <p><b>Aștept anunțul…</b></p>
              <p className="text-mut">
                {stare?.pagina ? `✓ Pagina a sosit · poze sosite: ${stare.poze_sosite ?? 0}` : "Butonul trimite pagina de pe pieseauto.ro. Progresul se vede și în colțul paginii lor."}
              </p>
            </>
          )}
        </div>
      )}

      {stare?.gata && !rezultat && (
        <>
          {stare.problema && <div className="card p-4 text-sm border-2 border-red-300 bg-red-50 text-red-800">{stare.problema}</div>}

          {stare.piesa && (
            <div className="card p-4 text-sm flex flex-wrap gap-x-6 gap-y-1">
              <span>Piesa: <b>{stare.piesa.cod_intern}</b></span>
              <span>Preț: <b>{lei(Number(stare.piesa.pret_lei))}</b></span>
              <span className="text-mut">Anunț {stare.piesa.sursa_id}</span>
            </div>
          )}

          {ext && (
            <div className="card p-4 space-y-3">
              <h2 className="font-disp font-semibold">{ext.titlu ?? "(fără titlu)"}</h2>
              <div className="text-xs text-mut flex flex-wrap gap-x-4 gap-y-1">
                {ext.categorie_sursa && <span>Categoria lor: {ext.categorie_sursa}</span>}
                {ext.oem && <span>Cod: {ext.oem}</span>}
                {ext.compat.length > 0 && <span>Compatibil: {ext.compat.join(" · ")}</span>}
              </div>
              {ext.descriere
                ? <p className="text-sm whitespace-pre-line bg-paper rounded-lg p-3 max-h-64 overflow-auto">{ext.descriere}</p>
                : <p className="text-sm text-amber-700">Anunțul n-are descriere.</p>}
            </div>
          )}

          <div className="card p-4 space-y-2">
            <div className="text-sm font-semibold">Poze primite: {pozeVenite} din {ext?.poze ?? 0}</div>
            {pozeVenite === 0 && <p className="text-sm text-amber-700">N-a sosit nicio poză. Piesa se completează, dar rămâne nepublicată până pui pozele de mână.</p>}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {(stare.poze ?? []).map((u, i) => (
                <div key={i} className="aspect-square rounded-lg border-2 border-line bg-paper overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {u && <img src={u} alt={`Poza ${i + 1}`} className="w-full h-full object-cover" />}
                </div>
              ))}
            </div>
            {!!stare.erori?.length && (
              <ul className="list-disc pl-5 text-xs text-red-700">{stare.erori.map((e, i) => <li key={i}>{e}</li>)}</ul>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!stare.problema && stare.piesa && (
              <button onClick={preia} disabled={lucru} className="btn-acc disabled:opacity-40">
                {lucru ? "Se completează piesa…" : pozeVenite > 0 ? "Preia și publică" : "Preia fără poze (rămâne nepublicată)"}
              </button>
            )}
            <button onClick={renunta} disabled={lucru} className="rounded-lg border-2 border-line px-3 py-2 text-sm font-semibold hover:border-acc">Renunță</button>
            <span className="text-xs text-mut">Categoria, modelele compatibile și codul se completează cu regulile importului.</span>
          </div>
        </>
      )}

      {rezultat && (
        rezultat.ok ? (
          <div className="card p-5 space-y-3 text-sm">
            <p className="text-base"><b className="text-ok">✓ {rezultat.piesa?.cod_intern} {rezultat.publicata ? "a fost completată și publicată" : "a fost completată, dar rămâne nepublicată (fără poze)"}.</b></p>
            <ul className="text-mut space-y-0.5">
              <li>Poze: {rezultat.rezumat?.poze} · Descriere: {rezultat.rezumat?.descriere ? `${rezultat.rezumat.descriere} caractere` : "lipsă"} · Cod: {rezultat.rezumat?.oem ?? "—"}</li>
              <li>Categorie: {rezultat.rezumat?.categorie ?? (rezultat.rezumat?.categorie_id ? `#${rezultat.rezumat.categorie_id}` : "necompletată")} · Modele compatibile: {rezultat.rezumat?.modele}</li>
            </ul>
            {!!rezultat.revizuire?.length && (
              <details><summary className="cursor-pointer text-xs text-mut">De verificat ({rezultat.revizuire.length})</summary>
                <ul className="list-disc pl-5 text-xs text-mut mt-1">{rezultat.revizuire.map((r, i) => <li key={i}>{r}</li>)}</ul>
              </details>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <Link href={`/admin/produse/${rezultat.piesa?.id}`} className="rounded-lg border-2 border-line px-3 py-2 font-semibold hover:border-acc">Deschide piesa în editor</Link>
              {rezultat.publicata && <a href={`/piese/${rezultat.piesa?.slug}`} target="_blank" rel="noopener noreferrer" className="rounded-lg border-2 border-line px-3 py-2 font-semibold hover:border-acc">Vezi pe site ↗</a>}
              {urmatoarea && (
                <a href={urmatoarea.url} target="_blank" rel="noopener noreferrer" className="btn-acc">Următorul anunț ({urmatoarea.ramase} rămase) ↗</a>
              )}
              <button onClick={() => window.close()} className="rounded-lg border-2 border-line px-3 py-2 font-semibold hover:border-acc">Închide tabul</button>
            </div>
            {!urmatoarea && <p className="text-mut">Nu mai sunt ciorne de preluat.</p>}
          </div>
        ) : (
          <div className="card p-4 text-sm border-2 border-red-300 bg-red-50 text-red-800 space-y-2">
            <p><b>Piesa NU a fost completată.</b> {rezultat.eroare}</p>
            <p>Nimic nu s-a schimbat la piesă. Poți reîncerca apăsând din nou butonul pe anunț.</p>
          </div>
        )
      )}
    </div>
  );
}
