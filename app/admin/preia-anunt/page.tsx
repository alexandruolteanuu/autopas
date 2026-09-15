"use client";
// ============================================================
// PREIA ANUNȚUL — tabul pe care îl deschide butonul „Preia în Autopas" de pe pieseauto.ro.
//
// DE CE (cerut de proprietar, 15 septembrie 2026)
// pieseauto.ro refuză cererile serverului nostru, deci ciornele din „Piese noi din
// CSV" nu-și mai pot aduce singure pozele și descrierea. Anunțul îl deschide
// operatorul, în browserul lui; butonul din bara de favorite deschide tabul ăsta
// și îi dă, prin `postMessage`, pagina și — la cerere — pozele deja încărcate acolo.
// Nicio cerere nu pleacă de la serverul nostru către pieseauto.ro.
//
// Pașii:
//   1. tabul se anunță la fereastra care l-a deschis („autopas-gata");
//   2. primește pagina, găsește piesa după ID-ul anunțului (`sursa_id`), extrage
//      datele cu ACEEAȘI funcție ca importul (`extrage`), cere pozele una câte una;
//   3. operatorul vede ce s-a găsit și apasă „Preia și publică": pozele se urcă
//      pe rând (`/api/preia-anunt?actiune=poza`), apoi serverul completează piesa.
//
// Mesajele se acceptă DOAR de la fereastra care a deschis tabul și DOAR dacă ea e
// pe pieseauto.ro — altfel orice site ar putea împinge o „pagină" în admin.
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { sbBrowser } from "@/lib/supabase";
import { lei } from "@/lib/format";
import { extrage, urlCanonic, idAnuntDinAdresa } from "@/lib/import/extragere.mjs";

type Piesa = {
  id: number; nume: string; cod_intern: string | null; pret_lei: number; slug: string;
  sursa_id: string; sursa_url: string | null; import_erori: any; publicat: boolean;
};
type Poza = { url: string; blob?: Blob; previzualizare?: string; eroare?: string };
type Rezultat = { ok: boolean; eroare?: string; publicata?: boolean; piesa?: any; rezumat?: any; revizuire?: string[] };

const ORIGINE_SURSA = /^https:\/\/([a-z0-9-]+\.)*pieseauto\.ro$/;
/** Sub plafonul rutei (4 MB): o poză mai mare se micșorează în browser. */
const PRAG_MICSORARE = 3.5 * 1024 * 1024;

/** Poză prea mare → JPEG de cel mult 2.000 px pe latura lungă. Serverul o face
 *  oricum WebP de 1.600 px, deci nu se pierde nimic din ce ajunge pe site. */
async function micsoreaza(b: Blob): Promise<Blob> {
  if (b.size <= PRAG_MICSORARE) return b;
  const bmp = await createImageBitmap(b);
  const f = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * f); c.height = Math.round(bmp.height * f);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((ok, nu) => c.toBlob((x) => (x ? ok(x) : nu(new Error("conversie eșuată"))), "image/jpeg", 0.88));
}

async function token() {
  const sb = sbBrowser();
  return sb ? (await sb.auth.getSession()).data.session?.access_token ?? null : null;
}

export default function PreiaAnunt() {
  const [stare, setStare] = useState<"astept" | "fara-sursa" | "primit" | "lucru" | "gata">("astept");
  const [adresa, setAdresa] = useState("");
  const [html, setHtml] = useState("");
  const [piesa, setPiesa] = useState<Piesa | null>(null);
  const [problema, setProblema] = useState("");
  const [poze, setPoze] = useState<Poza[]>([]);
  const [progres, setProgres] = useState("");
  const [rezultat, setRezultat] = useState<Rezultat | null>(null);
  const [urmatoarea, setUrmatoarea] = useState<{ url: string; ramase: number } | null>(null);
  const sursa = useRef<{ fereastra: Window; origine: string } | null>(null);
  const cheie = useRef(Math.random().toString(36).slice(2));

  // Ce s-a extras din pagină — calculat o dată, cu regulile importului.
  const ext = useMemo(() => (html ? extrage(html, urlCanonic(html, adresa)) : null), [html, adresa]);

  // ---------- 1. legătura cu tabul de pe pieseauto.ro ----------
  useEffect(() => {
    const deschizator = window.opener as Window | null;
    if (!deschizator) { setStare("fara-sursa"); return; }

    function laMesaj(e: MessageEvent) {
      if (e.source !== deschizator || !ORIGINE_SURSA.test(e.origin)) return;
      const d = e.data;
      if (!d || typeof d !== "object") return;
      if (d.tip === "autopas-anunt" && typeof d.html === "string" && typeof d.url === "string") {
        sursa.current = { fereastra: deschizator!, origine: e.origin };
        setAdresa(d.url); setHtml(d.html); setStare("primit");
      } else if (d.tip === "autopas-poza" && d.k === cheie.current && Number.isInteger(d.i)) {
        setPoze((v) => v.map((p, i) => i !== d.i ? p
          : d.blob instanceof Blob && d.blob.size > 0
            ? { ...p, blob: d.blob, previzualizare: URL.createObjectURL(d.blob) }
            : { ...p, eroare: String(d.eroare ?? "poza n-a venit") }));
      }
    }
    window.addEventListener("message", laMesaj);
    // Mesajul ăsta nu conține nimic, deci poate pleca la „*"; butonul verifică
    // el că vine de pe site-ul nostru înainte să răspundă cu pagina.
    deschizator.postMessage({ tip: "autopas-gata" }, "*");
    const t = setTimeout(() => setStare((s) => (s === "astept" ? "fara-sursa" : s)), 10000);
    return () => { window.removeEventListener("message", laMesaj); clearTimeout(t); };
  }, []);

  // ---------- 2. piesa, și cererea pozelor ----------
  useEffect(() => {
    if (stare !== "primit" || !ext) return;
    const id = idAnuntDinAdresa(adresa);
    (async () => {
      const sb = sbBrowser(); if (!sb) return;
      if (!id) { setProblema("Adresa tabului nu e un anunț pieseauto.ro (lipsește ID-ul din adresă)."); return; }
      const { data } = await sb.from("products")
        .select("id,nume,cod_intern,pret_lei,slug,sursa_id,sursa_url,import_erori,publicat")
        .eq("sursa", "pieseauto.ro").eq("sursa_id", id).maybeSingle();
      if (!data) { setProblema(`Anunțul ${id} nu e în baza noastră. Rulează întâi sincronizarea CSV, ca să apară ca piesă nouă.`); return; }
      setPiesa(data as Piesa);
      if (data.import_erori?.ciorna !== true) { setProblema(`Piesa ${data.cod_intern} nu mai e ciornă — e deja completată. Nu o suprascriu.`); return; }
      if (!ext.titlu || (!ext.descriere && !ext.poze.length)) {
        setProblema("Pagina primită nu pare anunțul (fără titlu, descriere și poze). Poate pieseauto.ro ți-a arătat altă pagină — reîncarcă anunțul și apasă din nou butonul.");
        return;
      }
      setPoze(ext.poze.map((url) => ({ url })));
      ext.poze.forEach((url, i) =>
        sursa.current?.fereastra.postMessage({ tip: "autopas-poza", k: cheie.current, i, url }, sursa.current.origine));
    })();
    // Declanșatorul e sosirea paginii; `stare` trece apoi în „lucru", deci nu se repetă.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ext]);

  // Pozele care nu vin în 30 de secunde se marchează, ca butonul să nu aștepte la nesfârșit.
  useEffect(() => {
    if (!poze.length) return;
    const t = setTimeout(() => setPoze((v) => v.map((p) => (p.blob || p.eroare ? p : { ...p, eroare: "n-a venit în 30 de secunde" }))), 30000);
    return () => clearTimeout(t);
  }, [poze.length]);

  const urmatoareaCiorna = useCallback(async (dupaId: number) => {
    const sb = sbBrowser(); if (!sb) return;
    const { data, count } = await sb.from("products").select("id,sursa_url", { count: "exact" })
      .eq("sursa", "pieseauto.ro").eq("sursa_activ", true).filter("import_erori->>ciorna", "eq", "true")
      .neq("id", dupaId).not("sursa_url", "is", null).order("id").limit(1);
    setUrmatoarea(data?.[0]?.sursa_url ? { url: data[0].sursa_url, ramase: count ?? 0 } : null);
  }, []);

  // ---------- 3. preluarea ----------
  async function preia() {
    if (!piesa || !ext || stare === "lucru") return;
    const t = await token();
    if (!t) { setProblema("Sesiunea a expirat. Intră din nou în admin, apoi apasă iar butonul pe anunț."); return; }
    setStare("lucru");
    const urcate: string[] = [], erori: string[] = [];
    for (let i = 0; i < poze.length; i++) {
      const p = poze[i];
      if (!p.blob) { erori.push(`poza ${i + 1}: ${p.eroare ?? "n-a venit"}`); continue; }
      setProgres(`Se urcă poza ${i + 1} din ${poze.length}…`);
      try {
        const corp = await micsoreaza(p.blob);
        const r = await fetch(`/api/preia-anunt?actiune=poza&id=${piesa.id}&i=${i}`, {
          method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": corp.type || "application/octet-stream" }, body: corp,
        });
        const j = await r.json().catch(() => ({ ok: false, eroare: `HTTP ${r.status}` }));
        if (j.ok) urcate.push(j.url); else erori.push(`poza ${i + 1}: ${j.eroare}`);
      } catch (e: any) { erori.push(`poza ${i + 1}: ${e?.message ?? e}`); }
    }

    setProgres("Se completează piesa…");
    let j: Rezultat;
    try {
      const r = await fetch("/api/preia-anunt", {
        method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({ actiune: "salveaza", id: piesa.id, url: adresa, html, poze: urcate, erori_poze: erori }),
      });
      j = await r.json().catch(() => ({ ok: false, eroare: `HTTP ${r.status}` }));
    } catch (e: any) { j = { ok: false, eroare: e?.message ?? String(e) }; }

    if (!j.ok && urcate.length) {
      // Pozele urcate degeaba se șterg, ca să nu rămână orfane în bucket.
      await fetch("/api/preia-anunt", {
        method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({ actiune: "renunta", id: piesa.id, poze: urcate }),
      }).catch(() => {});
    }
    setRezultat(j); setProgres(""); setStare("gata");
    if (j.ok) urmatoareaCiorna(piesa.id);
  }

  const pozeVenite = poze.filter((p) => p.blob).length;
  const pozeInAsteptare = poze.filter((p) => !p.blob && !p.eroare).length;

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <div className="dim">Administrare · Piese noi din CSV</div>
        <h1 className="font-disp font-bold text-2xl mt-1">Preia anunțul de pe pieseauto.ro</h1>
      </div>

      {stare === "astept" && <div className="card p-6 text-sm text-mut">Aștept pagina de la tabul cu anunțul…</div>}

      {stare === "fara-sursa" && (
        <div className="card p-6 text-sm space-y-2">
          <p><b>Tabul ăsta nu a primit niciun anunț.</b> Se deschide singur, din butonul „Preia în Autopas" apăsat pe o pagină de anunț pieseauto.ro.</p>
          <p className="text-mut">Butonul și instrucțiunile sunt în <Link href="/admin/piese-noi" className="underline">Piese noi din CSV</Link>.</p>
        </div>
      )}

      {problema && <div className="card p-4 text-sm border-2 border-red-300 bg-red-50 text-red-800">{problema}</div>}

      {(stare === "primit" || stare === "lucru") && piesa && ext && !problema && (
        <>
          <div className="card p-4 text-sm flex flex-wrap gap-x-6 gap-y-1">
            <span>Piesa: <b>{piesa.cod_intern}</b></span>
            <span>Preț: <b>{lei(Number(piesa.pret_lei))}</b></span>
            <span className="text-mut">Anunț {piesa.sursa_id}</span>
          </div>

          <div className="card p-4 space-y-3">
            <h2 className="font-disp font-semibold">{ext.titlu}</h2>
            <div className="text-xs text-mut flex flex-wrap gap-x-4 gap-y-1">
              {ext.categorie_sursa && <span>Categoria lor: {ext.categorie_sursa}</span>}
              {ext.oem && <span>Cod: {ext.oem}</span>}
              {ext.compat.length > 0 && <span>Compatibil: {ext.compat.join(" · ")}</span>}
            </div>
            {ext.descriere
              ? <p className="text-sm whitespace-pre-line bg-paper rounded-lg p-3 max-h-64 overflow-auto">{ext.descriere}</p>
              : <p className="text-sm text-amber-700">Anunțul n-are descriere.</p>}
          </div>

          <div className="card p-4 space-y-2">
            <div className="text-sm font-semibold">
              Poze: {pozeVenite} din {poze.length}
              {pozeInAsteptare > 0 && <span className="text-mut font-normal"> · se aduc din tabul anunțului…</span>}
            </div>
            {poze.length === 0 && <p className="text-sm text-amber-700">Anunțul n-are poze. Piesa se completează, dar rămâne nepublicată până pui pozele de mână.</p>}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {poze.map((p, i) => (
                <div key={i} className="aspect-square rounded-lg border-2 border-line bg-paper overflow-hidden flex items-center justify-center text-[11px] text-mut text-center p-1">
                  {p.previzualizare
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={p.previzualizare} alt={`Poza ${i + 1}`} className="w-full h-full object-cover" />
                    : p.eroare ? <span className="text-red-700">Poza {i + 1}: {p.eroare}</span> : <span>…</span>}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button onClick={preia} disabled={stare === "lucru" || pozeInAsteptare > 0} className="btn-acc disabled:opacity-40">
              {stare === "lucru" ? progres || "Se lucrează…" : pozeVenite > 0 ? "Preia și publică" : "Preia fără poze (rămâne nepublicată)"}
            </button>
            <span className="text-xs text-mut">Categoria, modelele compatibile și codul se completează cu regulile importului.</span>
          </div>
        </>
      )}

      {stare === "gata" && rezultat && (
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
                <a href={urmatoarea.url} target="_blank" rel="noopener noreferrer" className="btn-acc">
                  Următorul anunț ({urmatoarea.ramase} rămase) ↗
                </a>
              )}
              <button onClick={() => window.close()} className="rounded-lg border-2 border-line px-3 py-2 font-semibold hover:border-acc">Închide tabul</button>
            </div>
            {!urmatoarea && <p className="text-mut">Nu mai sunt ciorne de preluat.</p>}
          </div>
        ) : (
          <div className="card p-4 text-sm border-2 border-red-300 bg-red-50 text-red-800 space-y-2">
            <p><b>Piesa NU a fost completată.</b> {rezultat.eroare}</p>
            <p>Pozele urcate au fost șterse. Poți reîncerca apăsând din nou butonul pe anunț.</p>
          </div>
        )
      )}
    </div>
  );
}
