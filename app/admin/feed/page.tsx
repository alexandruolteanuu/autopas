"use client";
// ============================================================
// FEED ȘI EXPORT — adresele pe care le citesc Google și Meta, plus exportul CSV
//
// Ecranul are trei părți, în ordinea în care le folosește omul:
//   1. ADRESELE feed-urilor, de copiat în Merchant Center și în Commerce
//      Manager. Se generează din adresa deschisă acum în browser, nu dintr-o
//      constantă: dacă cineva lucrează pe un deploy de test, copiază adresa
//      acelui deploy, nu una care duce în altă parte.
//   2. DIAGNOSTICUL: câte piese intră efectiv în reclame și câte sunt lăsate
//      afară, cu motivul. Google nu doar că nu afișează un produs fără poză —
//      îl trece la erori, iar un cont cu prea multe erori poate fi suspendat.
//   3. EXPORTUL manual, cu filtre și cu alegerea coloanelor.
//
// TOT ce se vede aici vine din `lib/feed.ts`, exact aceleași rânduri care pleacă
// în feed-uri. Un ecran care ar număra altfel decât feed-ul ar fi mai rău decât
// niciun ecran: ar da încredere într-o cifră greșită.
// ============================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import { sbBrowser } from "@/lib/supabase";
import { SITE_URL } from "@/lib/config";
import { citesteCatalog, doarPentruReclame, type Catalog, type RandFeed } from "@/lib/feed";
import { csvGeneric, csvMeta, xmlGeneric, xmlGoogle } from "@/lib/feed-formate";

type Cuprindere = "reclame" | "vandabile" | "tot";

const FEEDURI = [
  { cale: "/feed/google.xml", nume: "Google Merchant Center",
    unde: "Merchant Center → Produse → Feeduri → Adaugă → „Preluare programată”",
    ce: "RSS 2.0. Doar piesele publicate, cu stoc, poză și preț." },
  { cale: "/feed/meta.csv", nume: "Meta — Facebook și Instagram",
    unde: "Commerce Manager → Catalog → Surse de date → Feed programat",
    ce: "CSV cu coloanele catalogului Meta. Aceleași produse ca la Google." },
  { cale: "/feed/produse.csv", nume: "Orice altă platformă (CSV)",
    unde: "Se dă oricărui marketplace sau partener care cere un feed",
    ce: "Toate coloanele, nume românești. Include și piesele fără poză." },
  { cale: "/feed/produse.xml", nume: "Orice altă platformă (XML)",
    unde: "Pentru importatoarele care cer XML",
    ce: "Același conținut ca fișierul CSV de mai sus." },
];

export default function FeedExport() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [incarc, setIncarc] = useState(true);
  const [eroare, setEroare] = useState("");
  const [copiat, setCopiat] = useState("");

  // filtrele exportului
  const [cuprindere, setCuprindere] = useState<Cuprindere>("vandabile");
  const [marca, setMarca] = useState("");
  const [categorie, setCategorie] = useState("");
  const [interne, setInterne] = useState(false);
  const [separator, setSeparator] = useState(";");

  const incarca = useCallback(async () => {
    setIncarc(true); setEroare("");
    try {
      // `doarVandabile: false` — panoul vrea să vadă TOT, inclusiv ce e
      // depublicat sau epuizat, ca să poți exporta și să știi ce lipsește.
      // Feed-urile publice cer separat doar ce e vandabil.
      const c = await citesteCatalog({ sb: sbBrowser(), doarVandabile: false, cuDateInterne: true });
      setCatalog(c);
    } catch (e: any) {
      setEroare(e?.message ?? "Nu am putut citi catalogul.");
    }
    setIncarc(false);
  }, []);
  useEffect(() => { incarca(); }, [incarca]);

  const toate = catalog?.randuri ?? [];
  const vandabile = useMemo(() => toate.filter((r) => r.publicat && r.stoc > 0), [toate]);
  const pentruReclame = useMemo(() => doarPentruReclame(vandabile), [vandabile]);

  // Listele de filtrare se construiesc din chiar rândurile citite, nu dintr-o
  // interogare separată: altfel ar putea oferi o marcă pentru care exportul
  // iese gol.
  const marci = useMemo(
    () => Array.from(new Set(toate.map((r) => r.marca).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ro")),
    [toate]);
  const categorii = useMemo(
    () => Array.from(new Set(toate.map((r) => r.categorie).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ro")),
    [toate]);

  const selectie: RandFeed[] = useMemo(() => {
    const baza = cuprindere === "tot" ? toate : cuprindere === "vandabile" ? vandabile : pentruReclame;
    return baza.filter((r) => (!marca || r.marca === marca) && (!categorie || r.categorie === categorie));
  }, [cuprindere, marca, categorie, toate, vandabile, pentruReclame]);

  function descarca(continut: string, nume: string, tip: string) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([continut], { type: `${tip};charset=utf-8` }));
    a.download = nume;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const azi = new Date().toISOString().slice(0, 10);
  // BOM pornit: fișierul ăsta îl deschide un om, în Excel.
  const optiuniCsv = { separator, bom: true, cuDateInterne: interne };

  // Adresa de pe care se servesc feed-urile e cea deschisă ACUM. `SITE_URL` e
  // adresa care ajunge în linkurile din interiorul feed-ului. Când cele două
  // diferă, produsele ar duce în altă parte decât site-ul pe care îl vede
  // Google — de asta se compară mai jos, explicit.
  const gazda = typeof window === "undefined" ? SITE_URL : window.location.origin;
  const siteUrlBun = /^https:\/\/[^/]+\.[a-z]{2,}$/i.test(SITE_URL) && !SITE_URL.includes(".vercel.app");

  const copiaza = async (text: string, cheie: string) => {
    try { await navigator.clipboard.writeText(text); setCopiat(cheie); setTimeout(() => setCopiat(""), 2000); }
    catch { /* browser fără clipboard: rămâne textul vizibil, se copiază cu mâna */ }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="dim">Administrare</div>
          <h1 className="font-disp font-bold text-2xl mt-1">Feed și export</h1>
          <p className="text-sm text-mut mt-1 max-w-3xl">
            Adresele de mai jos se dau o singură dată platformelor de reclame. De acolo încolo se
            reîmprospătează singure, la 3 ore, cu prețurile și stocul de atunci. Nu trebuie încărcat
            niciun fișier cu mâna.
          </p>
        </div>
        <button onClick={incarca} disabled={incarc} className="btn-dark !py-2 text-sm">
          {incarc ? "Se citește…" : "Recitește catalogul"}
        </button>
      </div>

      {eroare && <div className="card p-3 text-sm border-2 border-red-300 bg-red-50 text-red-800">{eroare}</div>}

      {/* ---------- AVERTIZĂRI ---------- */}
      {!siteUrlBun && (
        <div className="card p-4 border-2 border-yellow-300 bg-yellow-50 text-yellow-900 text-sm">
          <b>NEXT_PUBLIC_SITE_URL nu e setată pe domeniul real.</b>{" "}
          Linkurile către produse din feed vor arăta spre <code>{SITE_URL}</code>. Google Merchant
          Center respinge produsele al căror link nu e pe domeniul revendicat, iar Meta la fel.
          Se pune în Vercel → Settings → Environment Variables și se redeployează.
        </div>
      )}
      {gazda !== SITE_URL && siteUrlBun && (
        <div className="card p-4 border-2 border-yellow-300 bg-yellow-50 text-yellow-900 text-sm">
          Ești pe <code>{gazda}</code>, dar linkurile din feed duc spre <code>{SITE_URL}</code>.
          E normal pe un deploy de test; dă platformelor adresa de pe domeniul real.
        </div>
      )}

      {/* ---------- DIAGNOSTIC ---------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ["Piese în catalog", toate.length, "tot ce există, inclusiv depublicate"],
          ["Publicate, cu stoc", vandabile.length, "ce se vede pe site"],
          ["Intră în reclame", pentruReclame.length, "au poză, preț și stoc"],
          ["Lăsate afară", vandabile.length - pentruReclame.length, "ar fi respinse de Google"],
        ].map(([t, v, sub]) => (
          <div key={String(t)} className="card p-4">
            <span className="text-xs text-mut">{t}</span>
            <b className="block font-disp text-2xl mt-1">{incarc ? "…" : Number(v).toLocaleString("ro-RO")}</b>
            <span className="text-[11px] text-mut">{sub}</span>
          </div>
        ))}
      </div>

      {catalog && (
        <div className="card p-4">
          <b className="font-disp text-base">Ce lipsește pieselor</b>
          <p className="text-xs text-mut mt-1">
            Numărate pe tot catalogul citit. Poza și prețul sunt obligatorii pentru reclame;
            categoria și modelul nu blochează nimic, dar fără ele produsul apare la mai puține căutări.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2 mt-3 text-sm">
            {([
              ["fără poză", catalog.excluderi.fara_poza, true],
              ["fără preț", catalog.excluderi.fara_pret, true],
              ["fără stoc", catalog.excluderi.fara_stoc, false],
              ["fără categorie", catalog.excluderi.fara_categorie, false],
              ["fără model", catalog.excluderi.fara_model, false],
            ] as [string, number, boolean][]).map(([t, n, grav]) => (
              <div key={t} className={`rounded-lg border-2 px-3 py-2 ${n === 0 ? "border-line text-mut" : grav ? "border-red-200 bg-red-50 text-red-800" : "border-line"}`}>
                <b className="font-disp text-lg">{n.toLocaleString("ro-RO")}</b>
                <span className="block text-xs">{t}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-mut mt-3">
            Piesele fără poză sau fără categorie se completează din{" "}
            <a href="/admin/piese-de-completat" className="text-acc underline underline-offset-2">Piese de completat</a>.
          </p>
        </div>
      )}

      {/* ---------- ADRESELE ---------- */}
      <div>
        <div className="dim mb-2">Adresele feed-urilor</div>
        <div className="grid lg:grid-cols-2 gap-3">
          {FEEDURI.map((f) => {
            const adresa = `${gazda}${f.cale}`;
            return (
              <div key={f.cale} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <b className="font-disp text-base">{f.nume}</b>
                  <a href={f.cale} target="_blank" rel="noreferrer"
                    className="text-xs text-acc underline underline-offset-2 whitespace-nowrap">Deschide ↗</a>
                </div>
                <p className="text-sm text-mut mt-1">{f.ce}</p>
                <p className="text-xs text-steel mt-1">Unde se lipește: {f.unde}</p>
                <div className="mt-3 flex gap-2">
                  <input readOnly value={adresa} onFocus={(e) => e.currentTarget.select()}
                    className="flex-1 min-w-0 rounded-lg border-2 border-line px-2.5 py-1.5 text-xs font-mono bg-paper" />
                  <button onClick={() => copiaza(adresa, f.cale)}
                    className="rounded-lg border-2 border-line px-3 py-1.5 text-xs font-semibold hover:border-acc whitespace-nowrap">
                    {copiat === f.cale ? "Copiat ✓" : "Copiază"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---------- EXPORT MANUAL ---------- */}
      <div className="card p-5">
        <b className="font-disp text-base">Export manual</b>
        <p className="text-sm text-mut mt-1">
          Pentru încărcări unice, pentru contabilitate sau pentru o platformă care nu acceptă o
          adresă. Fișierul se face din aceleași date ca feed-urile.
        </p>

        <div className="grid md:grid-cols-2 gap-4 mt-4">
          <div className="fld">
            <label>Ce cuprinde</label>
            <select value={cuprindere} onChange={(e) => setCuprindere(e.target.value as Cuprindere)}>
              <option value="vandabile">Publicate și în stoc ({vandabile.length})</option>
              <option value="reclame">Doar ce intră în reclame ({pentruReclame.length})</option>
              <option value="tot">Tot catalogul, inclusiv depublicate ({toate.length})</option>
            </select>
          </div>
          <div className="fld">
            <label>Separator (Excel românesc folosește „;”)</label>
            <select value={separator} onChange={(e) => setSeparator(e.target.value)}>
              <option value=";">punct și virgulă ;</option>
              <option value=",">virgulă ,</option>
            </select>
          </div>
          <div className="fld">
            <label>Marca</label>
            <select value={marca} onChange={(e) => setMarca(e.target.value)}>
              <option value="">toate mărcile</option>
              {marci.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="fld">
            <label>Categoria</label>
            <select value={categorie} onChange={(e) => setCategorie(e.target.value)}>
              <option value="">toate categoriile</option>
              {categorii.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <label className="flex items-start gap-2 text-sm mt-3 cursor-pointer">
          <input type="checkbox" checked={interne} onChange={(e) => setInterne(e.target.checked)} className="mt-1" />
          <span>
            <b>Include coloanele interne</b> — cost de achiziție, marjă în lei și în procente, sursa,
            vizualizări.
            <span className="block text-xs text-red-700 font-semibold mt-0.5">
              Fișierul nu se trimite nimănui din afara firmei: conține cât ai plătit pe fiecare piesă.
            </span>
          </span>
        </label>

        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-line">
          <button disabled={incarc || selectie.length === 0}
            onClick={() => descarca(csvGeneric(selectie, optiuniCsv), `autopas-produse-${azi}.csv`, "text/csv")}
            className="btn-acc !py-2 text-sm">
            Descarcă CSV ({selectie.length.toLocaleString("ro-RO")})
          </button>
          <button disabled={incarc || selectie.length === 0}
            onClick={() => descarca(xmlGeneric(selectie), `autopas-produse-${azi}.xml`, "application/xml")}
            className="rounded-xl border-2 border-line px-4 py-2 text-sm font-semibold hover:border-acc">
            Descarcă XML
          </button>
          <button disabled={incarc}
            onClick={() => descarca(xmlGoogle(doarPentruReclame(selectie)), `google-merchant-${azi}.xml`, "application/xml")}
            className="rounded-xl border-2 border-line px-4 py-2 text-sm font-semibold hover:border-acc">
            În formatul Google ({doarPentruReclame(selectie).length.toLocaleString("ro-RO")})
          </button>
          <button disabled={incarc}
            onClick={() => descarca(csvMeta(doarPentruReclame(selectie)), `meta-catalog-${azi}.csv`, "text/csv")}
            className="rounded-xl border-2 border-line px-4 py-2 text-sm font-semibold hover:border-acc">
            În formatul Meta ({doarPentruReclame(selectie).length.toLocaleString("ro-RO")})
          </button>
        </div>
        <p className="text-xs text-mut mt-2">
          Ultimele două butoane sar peste piesele fără poză sau fără preț, exact ca feed-urile
          automate: Google și Meta le-ar respinge oricum, iar produsele respinse strică reputația contului.
        </p>
      </div>
    </div>
  );
}
