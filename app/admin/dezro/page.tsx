"use client";
// ============================================================
// dez.ro — ecranul operatorului
//
// Publicarea a ~8.700 de anunțuri, cu o pauză politicoasă între ele, ține ore.
// Nimeni nu ține un tab deschis atâta, deci starea NU stă în pagină: stă în
// `dezro_jobs`. Pagina cere lot după lot și arată progresul; dacă tabul se
// închide, jobul rămâne pe loc și, la redeschidere, apare „Continuă".
// Exact tiparul de la Import pieseauto.ro.
//
// Toată logica e în lib/dezro/ — ecranul ăsta doar comandă și afișează.
//
// ORDINEA PAȘILOR e și ordinea de pe ecran, fiindcă fiecare pas depinde de cel
// dinainte: fără catalogul lor nu se poate potrivi, fără potriviri nu se poate
// publica, iar fără o probă reușită n-are rost să pornească 8.700 de anunțuri.
// ============================================================
import { useCallback, useEffect, useRef, useState } from "react";
import { sbBrowser } from "@/lib/supabase";
import DezroPotriviri from "@/components/admin/DezroPotriviri";

type Job = {
  id: number; actiune: string; status: string; faza: string;
  pozitie: number; total: number; procesate: number;
  publicate: number; actualizate: number; neschimbate: number; retrase: number;
  poze_urcate: number; nr_erori: number;
  erori: { id?: number; cod?: string; eroare: string }[] | null;
  jurnal: { la: string; text: string }[] | null;
  optiuni: any; mesaj: string | null;
  inceput_la: string; actualizat_la: string; terminat_la: string | null;
};

type Stare = {
  config: { areCheie: boolean; areCont: boolean; utilizator: string; activ: boolean;
            sesiuneValabila: boolean; sesiuneExpira: string | null };
  cifre: any;
  retrageri: { active: number; deRetras: number; procent: number } | null;
  catalog: { marci: number; modele: number; categorii: number };
  mapari: { marci: number; modele: number; categorii: number; deConfirmat: number };
  job: Job | null;
  istoric: Job[];
  anunturi: Anunt[];
};

type Anunt = {
  product_id: number; ad_id: number | null; url: string | null;
  status: string; aprobat: boolean | null; eroare: string | null;
  trimis_la: string | null; nume: string; cod_intern: string | null;
};

/** De câte ori reîncearcă singură pagina un lot picat. Are voie: progresul se
 *  salvează pe server la fiecare lot, deci fiecare reîncercare pornește de unde
 *  a rămas. */
const INCERCARI_LOT = 3;
/** Cât se așteaptă înainte de o reîncercare. Ca la import, nu 2 secunde ci 20:
 *  când cererea e tăiată de un proxy, funcția de pe server poate încă lucra, iar
 *  două loturi în paralel ar trimite aceleași anunțuri de două ori. */
const ASTEPTARE_REINCERCARE_MS = 20_000;

const nr = (n: number) => new Intl.NumberFormat("ro-RO").format(n || 0);

export default function Dezro() {
  const [stare, setStare] = useState<Stare | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [msg, setMsg] = useState("");
  const [lucru, setLucru] = useState("");
  const [ruleaza, setRuleaza] = useState(false);
  const [confirmare, setConfirmare] = useState<string | null>(null);
  // Unde a ajuns proba. Fără el, apăsând a doua oară „Publică o piesă de probă"
  // s-ar relua exact aceleași 25 de piese — care sunt deja trimise, deci n-ar mai
  // pleca nimic și butonul ar părea stricat.
  const [probaPozitie, setProbaPozitie] = useState(0);
  const opreste = useRef(false);

  // ---------- comunicarea cu ruta ----------
  const cere = useCallback(async (corp: any) => {
    const sb = sbBrowser();
    const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
    if (!token) return { ok: false, eroare: "Sesiunea a expirat. Autentifică-te din nou." };
    const r = await fetch("/api/dezro", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(corp),
    });
    // Un 502/504 nu vine de la ruta noastră, ci de la proxy-ul din fața ei.
    // Corpul nu e JSON, deci fără explicația asta s-ar vedea doar „HTTP 504".
    return await r.json().catch(() => ({
      ok: false,
      eroare: r.status === 504 || r.status === 502
        ? `Serverul a tăiat cererea (HTTP ${r.status}): lotul a ținut prea mult. Ce s-a apucat e salvat.`
        : `HTTP ${r.status}`,
    }));
  }, []);

  const incarcaStarea = useCallback(async () => {
    const d = await cere({ actiune: "stare" });
    if (!d.ok) { setMsg(d.eroare ?? "Nu s-a putut citi starea."); return; }
    setStare(d);
    if (d.job) setJob(d.job);
  }, [cere]);

  useEffect(() => { incarcaStarea(); }, [incarcaStarea]);

  // ---------- bucla de loturi ----------
  const ruleazaLoturi = useCallback(async (jobId: number, actiune: "lot" | "catalog") => {
    opreste.current = false;
    setRuleaza(true); setMsg("");
    try {
      let esecuri = 0;
      for (;;) {
        if (opreste.current) break;
        const d = await cere(actiune === "catalog" ? { actiune: "catalog" } : { actiune: "lot", jobId });
        if (!d.ok) {
          esecuri++;
          if (esecuri >= INCERCARI_LOT) { setMsg(d.eroare ?? "Lotul a picat de prea multe ori."); break; }
          setMsg(`${d.eroare} — reîncerc peste 20 de secunde (${esecuri}/${INCERCARI_LOT}).`);
          await new Promise((r) => setTimeout(r, ASTEPTARE_REINCERCARE_MS));
          continue;
        }
        esecuri = 0;
        if (d.job) setJob(d.job);
        if (d.cereConfirmare) {
          setConfirmare(d.job?.mesaj ?? "S-ar retrage prea multe anunțuri. Confirmi?");
          break;
        }
        if (d.gata) break;
      }
    } finally {
      setRuleaza(false);
      incarcaStarea();
    }
  }, [cere, incarcaStarea]);

  // Reîmprospătarea stării de aprobare: paginile lor, una după alta.
  // Anunțurile trimise prin API NU sunt publicate pe loc, deși ghidul lor spune
  // altfel — adresa publică apare abia după ce le aprobă cineva la ei.
  const improspateaza = useCallback(async () => {
    setRuleaza(true); setMsg("");
    try {
      let pagina = 1, actualizate = 0, aprobate = 0, inAsteptare = 0;
      for (;;) {
        const d = await cere({ actiune: "improspateaza", pagina });
        if (!d.ok) { setMsg(d.eroare ?? "Nu s-a putut citi lista de la dez.ro."); break; }
        actualizate += d.actualizate; aprobate += d.aprobate; inAsteptare += d.inAsteptare;
        setMsg(`${nr(actualizate)} anunțuri verificate · ${nr(aprobate)} publicate · ${nr(inAsteptare)} în așteptare…`);
        if (d.gata) { setMsg(`✓ ${nr(actualizate)} anunțuri verificate · ${nr(aprobate)} publicate la ei · ${nr(inAsteptare)} încă în așteptarea aprobării.`); break; }
        pagina = d.pagina;
      }
    } finally {
      setRuleaza(false);
      incarcaStarea();
    }
  }, [cere, incarcaStarea]);

  // ---------- acțiuni simple ----------
  async function actiune(a: string, corp: any = {}) {
    setLucru(a); setMsg("");
    const d = await cere({ actiune: a, ...corp });
    setLucru("");
    if (!d.ok) { setMsg(d.eroare ?? "Nu a mers."); return null; }
    if (d.mesaj) setMsg(d.mesaj);
    if (d.job) setJob(d.job);
    await incarcaStarea();
    return d;
  }

  const c = stare?.config;
  const cifre = stare?.cifre;
  const catalogAdus = (stare?.catalog.categorii ?? 0) > 0;
  const jobActiv = job && (job.status === "in_curs" || job.status === "in_pauza");

  return (
    <div className="space-y-5">
      <div>
        <div className="dim">Administrare</div>
        <h1 className="font-disp font-bold text-2xl mt-1">dez.ro — anunțuri</h1>
        <p className="text-sm text-mut mt-1">
          Piesele publicate de pe site ajung ca anunțuri pe dez.ro. Prețul și descrierea se țin la zi singure,
          iar anunțul unei piese vândute se retrage automat.
        </p>
      </div>

      {msg && <p className="text-sm">{msg}</p>}

      {/* ---------- 1. CONEXIUNEA ---------- */}
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <b className="font-disp text-base">1. Conexiunea</b>
            <ul className="mt-2 text-sm space-y-1">
              <li>{c?.areCheie ? "✓" : "✗"} Cheia API {c?.areCheie ? "e pusă" : "lipsește — Admin → Integrări"}</li>
              <li>
                {c?.areCont ? "✓" : "✗"} Contul dez.ro{" "}
                {c?.areCont ? `„${c.utilizator}”` : "lipsește (utilizator și parolă) — Admin → Integrări"}
              </li>
              <li>
                {c?.activ ? "✓" : "✗"} Integrarea e {c?.activ ? "pornită" : "oprită din Integrări"}
              </li>
              {c?.sesiuneValabila && (
                <li className="text-mut text-xs">
                  Sesiune valabilă până la {new Date(c.sesiuneExpira!).toLocaleDateString("ro-RO")}
                </li>
              )}
            </ul>
          </div>
          <button
            type="button"
            disabled={lucru !== "" || !c?.areCheie || !c?.areCont}
            onClick={() => actiune("test")}
            className="rounded-xl border-2 border-line px-3 py-2 text-xs font-semibold hover:border-acc disabled:opacity-40"
          >
            {lucru === "test" ? "Se verifică…" : "Testează conexiunea"}
          </button>
        </div>
      </div>

      {/* ---------- 2. CATALOGUL LOR ---------- */}
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <b className="font-disp text-base">2. Catalogul dez.ro</b>
            <p className="text-sm text-mut mt-1">
              Mărcile, modelele și categoriile lor, aduse la noi. Fără ele nu se poate potrivi nimic.
              Se aduc în trepte, fiindcă arborele întreg într-o singură cerere pică la ei.
            </p>
            <p className="text-sm mt-2">
              {catalogAdus
                ? `${nr(stare!.catalog.marci)} mărci · ${nr(stare!.catalog.modele)} modele · ${nr(stare!.catalog.categorii)} categorii`
                : "Încă neadus."}
            </p>
          </div>
          <button
            type="button"
            disabled={ruleaza || !c?.areCheie}
            onClick={async () => {
              const d = await cere({ actiune: "catalog" });
              if (!d.ok) { setMsg(d.eroare); return; }
              setJob(d.job);
              if (!d.gata) await ruleazaLoturi(d.job.id, "catalog");
              else await incarcaStarea();
            }}
            className="btn-dark !py-2 text-xs"
          >
            {ruleaza && job?.actiune === "catalog" ? "Se aduce…" : catalogAdus ? "Reîmprospătează catalogul" : "Adu catalogul dez.ro"}
          </button>
        </div>
        {job?.actiune === "catalog" && job.total > 0 && (
          <Progres facut={job.pozitie} total={job.total} eticheta="pași" />
        )}
      </div>

      {/* ---------- 3. POTRIVIRILE ---------- */}
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <b className="font-disp text-base">3. Potrivirile</b>
            <p className="text-sm text-mut mt-1">
              Catalogul nostru și al lor sunt scrise altfel („Casetă direcție" / „Caseta directie",
              „Passat B6" / „Passat"). Potrivirea automată le leagă pe cele sigure; restul le confirmi tu, mai jos.
            </p>
            {stare && (
              <p className="text-sm mt-2">
                {nr(stare.mapari.marci)} mărci · {nr(stare.mapari.modele)} modele · {nr(stare.mapari.categorii)} categorii legate
              </p>
            )}
          </div>
          <button
            type="button"
            disabled={lucru !== "" || !catalogAdus}
            onClick={() => actiune("potriveste")}
            className="rounded-xl border-2 border-line px-3 py-2 text-xs font-semibold hover:border-acc disabled:opacity-40"
          >
            {lucru === "potriveste" ? "Se potrivește…" : "Potrivește automat"}
          </button>
        </div>
      </div>

      {catalogAdus && <DezroPotriviri cere={cere} laSalvare={incarcaStarea} />}

      {/* ---------- 4. CE SE POATE PUBLICA ---------- */}
      {cifre && (
        <div className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <b className="font-disp text-base">4. Ce se poate publica</b>
            <button
              type="button"
              disabled={ruleaza || !c?.areCont}
              onClick={improspateaza}
              className="rounded-xl border-2 border-line px-3 py-2 text-xs font-semibold hover:border-acc disabled:opacity-40"
            >
              Actualizează starea anunțurilor
            </button>
          </div>
          {/* „Trimise" și „publicate la ei" NU sunt același lucru: anunțurile trec
              printr-o aprobare la dez.ro. Un singur contor, numit „active", ar fi
              spus că sunt pe site piese care de fapt așteaptă la moderare. */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-3">
            <Cifra t="Gata de trimis" v={cifre.gata} bun />
            <Cifra t="Trimise la dez.ro" v={cifre.anunturi_active} />
            <Cifra t="Publicate la ei" v={cifre.anunturi_aprobate ?? 0} bun />
            <Cifra t="Așteaptă aprobarea" v={cifre.anunturi_in_asteptare ?? 0} />
            <Cifra t="Cu eroare" v={cifre.anunturi_eroare} rau={cifre.anunturi_eroare > 0} />
          </div>
          {(cifre.anunturi_in_asteptare ?? 0) > 0 && (
            <p className="text-xs text-mut mt-3">
              Anunțurile trimise prin API trec printr-o aprobare la ei, deși documentația lor spune că
              apar pe loc. Până la aprobare n-au adresă publică. Nu e nimic de făcut din partea noastră —
              se așteaptă, apoi se apasă „Actualizează starea anunțurilor".
            </p>
          )}
          {cifre.gata < cifre.eligibile && (
            <div className="mt-3 text-sm">
              <p className="text-mut">
                {nr(cifre.eligibile - cifre.gata)} din {nr(cifre.eligibile)} de piese nu se pot publica încă:
              </p>
              <ul className="mt-1 text-xs text-mut space-y-0.5">
                {cifre.fara_poza > 0 && <li>· {nr(cifre.fara_poza)} fără poză</li>}
                {cifre.fara_model > 0 && <li>· {nr(cifre.fara_model)} fără model de mașină</li>}
                {cifre.model_nemapat > 0 && <li>· {nr(cifre.model_nemapat)} cu model nepotrivit la ei (vezi pasul 3)</li>}
                {cifre.fara_categorie > 0 && <li>· {nr(cifre.fara_categorie)} fără categorie</li>}
                {cifre.categorie_nemapata > 0 && <li>· {nr(cifre.categorie_nemapata)} cu categorie nepotrivită la ei (vezi pasul 3)</li>}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ---------- 4b. SINCRONIZAREA AUTOMATĂ ---------- */}
      <SincronizareAutomata activ={!!c?.activ && !!c?.areCont} />

      {/* ---------- 5. PUBLICAREA ---------- */}
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <b className="font-disp text-base">5. Publicarea</b>
            <p className="text-sm text-mut mt-1">
              Trimite piesele care nu sunt încă la ei, actualizează ce s-a schimbat, și retrage anunțurile
              pieselor vândute. Ce n-are nimic schimbat nu se atinge deloc.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              disabled={lucru !== "" || ruleaza || !!jobActiv || !cifre?.gata}
              onClick={async () => {
                const d = await actiune("proba", { dupaId: probaPozitie });
                if (d?.rezultat?.pozitie) setProbaPozitie(d.rezultat.pozitie);
                if (d?.proba)
                  setMsg(`✓ Trimis: ${d.proba.cod ?? d.proba.id} — ${d.proba.nume}${d.proba.url ? ` · ${d.proba.url}` : ""}`);
              }}
              className="rounded-xl border-2 border-line px-3 py-2 text-xs font-semibold hover:border-acc disabled:opacity-40"
            >
              {lucru === "proba" ? "Se trimite…" : "Publică o piesă de probă"}
            </button>
            {!jobActiv && (
              <button
                type="button"
                disabled={ruleaza || !cifre?.gata || !catalogAdus}
                onClick={async () => {
                  const d = await cere({ actiune: "start" });
                  if (!d.ok) { setMsg(d.eroare); return; }
                  setJob(d.job);
                  await ruleazaLoturi(d.job.id, "lot");
                }}
                className="btn-dark !py-2 text-xs"
              >
                Pornește publicarea
              </button>
            )}
            {jobActiv && job.actiune === "publicare" && !ruleaza && (
              <button
                type="button"
                onClick={async () => {
                  await cere({ actiune: "reia", jobId: job.id });
                  await ruleazaLoturi(job.id, "lot");
                }}
                className="btn-dark !py-2 text-xs"
              >
                Continuă
              </button>
            )}
            {ruleaza && (
              <button
                type="button"
                onClick={async () => {
                  opreste.current = true;
                  if (job) await cere({ actiune: "pauza", jobId: job.id });
                }}
                className="rounded-xl border-2 border-line px-3 py-2 text-xs font-semibold hover:border-acc"
              >
                Oprește
              </button>
            )}
            {jobActiv && !ruleaza && (
              <button
                type="button"
                onClick={async () => { await actiune("anuleaza", { jobId: job.id }); setJob(null); }}
                className="rounded-xl border-2 border-line px-3 py-2 text-xs font-semibold hover:border-red-400"
              >
                Anulează jobul
              </button>
            )}
          </div>
        </div>

        {/* Pragul de retragere: se cere confirmare separată, ca la import. */}
        {confirmare && (
          <div className="mt-4 rounded-xl border-2 border-yellow-300 bg-yellow-50 p-3 text-sm">
            <p className="text-yellow-800">{confirmare}</p>
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                className="btn-dark !py-2 text-xs"
                onClick={async () => {
                  if (!job) return;
                  setConfirmare(null);
                  await cere({ actiune: "reia", jobId: job.id, confirmatPrag: true });
                  await ruleazaLoturi(job.id, "lot");
                }}
              >
                Da, retrage-le
              </button>
              <button
                type="button"
                className="rounded-xl border-2 border-line px-3 py-2 text-xs font-semibold"
                onClick={() => setConfirmare(null)}
              >
                Nu acum
              </button>
            </div>
          </div>
        )}

        {job?.actiune === "publicare" && (
          <>
            <Progres
              facut={job.procesate}
              total={job.total}
              eticheta={job.faza === "retragere" ? "piese parcurse (acum se retrag anunțuri)" : "piese parcurse"}
            />
            <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-3 text-xs">
              <Mica t="Anunțuri noi" v={job.publicate} />
              <Mica t="Actualizate" v={job.actualizate} />
              <Mica t="Neschimbate" v={job.neschimbate} />
              <Mica t="Retrase" v={job.retrase} />
              <Mica t="Poze urcate" v={job.poze_urcate} />
              <Mica t="Erori" v={job.nr_erori} rau={job.nr_erori > 0} />
            </div>
            {job.mesaj && <p className="text-sm text-yellow-700 mt-3">{job.mesaj}</p>}
            {!!job.optiuni?.motive && Object.keys(job.optiuni.motive).length > 0 && (
              <div className="mt-3 text-xs text-mut">
                <p>Piese sărite:</p>
                <ul className="mt-1 space-y-0.5">
                  {Object.entries(job.optiuni.motive).map(([m, n]) => (
                    <li key={m}>· {nr(n as number)} — {m}</li>
                  ))}
                </ul>
              </div>
            )}
            {!!job.erori?.length && (
              <details className="mt-3">
                <summary className="text-xs cursor-pointer text-red-600">
                  {nr(job.nr_erori)} erori — vezi primele {Math.min(job.erori.length, 20)}
                </summary>
                <ul className="mt-2 text-xs space-y-1">
                  {job.erori.slice(0, 20).map((e, i) => (
                    <li key={i}>· {e.cod ?? e.id}: {e.eroare}</li>
                  ))}
                </ul>
              </details>
            )}
            {!!job.jurnal?.length && (
              <details className="mt-3" open>
                <summary className="text-xs cursor-pointer text-mut">Jurnal</summary>
                <ul className="mt-2 text-xs text-mut space-y-1">
                  {job.jurnal.slice(-8).map((j, i) => (
                    <li key={i}>
                      {new Date(j.la).toLocaleTimeString("ro-RO")} — {j.text}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </div>

      {/* ---------- ANUNȚURILE ---------- */}
      {!!stare?.anunturi?.length && (
        <div className="card p-5">
          <b className="font-disp text-base">Ultimele anunțuri trimise</b>
          <p className="text-sm text-mut mt-1">
            Starea vine din ce ne-au răspuns ei. „Așteaptă aprobarea" nu e o eroare de-a noastră —
            e coada lor de moderare; adresa publică apare abia după ce trece.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-mut">
                  <th className="py-2 pr-3">Piesa</th>
                  <th className="py-2 pr-3">Anunț</th>
                  <th className="py-2 pr-3">Stare</th>
                  <th className="py-2">Trimis</th>
                </tr>
              </thead>
              <tbody>
                {stare.anunturi.map((a) => (
                  <tr key={a.product_id} className="border-t border-line align-top">
                    <td className="py-2 pr-3">
                      <a href={`/admin/produse/${a.product_id}`} className="hover:underline">{a.nume}</a>
                      {a.cod_intern && <span className="block text-xs text-mut">{a.cod_intern}</span>}
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      {a.url
                        ? <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-acc hover:underline">vezi anunțul</a>
                        : <span className="text-mut">{a.ad_id ? `#${a.ad_id}` : "—"}</span>}
                    </td>
                    <td className="py-2 pr-3 text-xs"><StareAnunt a={a} /></td>
                    <td className="py-2 text-xs text-mut">
                      {a.trimis_la ? new Date(a.trimis_la).toLocaleString("ro-RO") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------- ISTORIC ---------- */}
      {!!stare?.istoric?.length && (
        <div className="card p-5">
          <b className="font-disp text-base">Ce s-a întâmplat până acum</b>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-mut">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Ce</th>
                  <th className="py-2 pr-3">Când</th>
                  <th className="py-2 pr-3">Stare</th>
                  <th className="py-2">Rezultat</th>
                </tr>
              </thead>
              <tbody>
                {stare.istoric.map((j) => (
                  <tr key={j.id} className="border-t border-line">
                    <td className="py-2 pr-3">{j.id}</td>
                    <td className="py-2 pr-3">{j.actiune === "catalog" ? "Catalog" : "Publicare"}</td>
                    <td className="py-2 pr-3 text-xs text-mut">
                      {new Date(j.inceput_la).toLocaleString("ro-RO")}
                    </td>
                    <td className="py-2 pr-3 text-xs">{j.status}</td>
                    <td className="py-2 text-xs text-mut">
                      {j.actiune === "catalog"
                        ? `${nr(j.procesate)} pași`
                        : `${nr(j.publicate)} noi · ${nr(j.actualizate)} actualizate · ${nr(j.retrase)} retrase`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/** Starea unui anunț, în cuvintele operatorului. Se citește din DOUĂ câmpuri:
 *  `status` (ce am făcut noi) și `aprobat` (ce spun ei). Fără al doilea, un
 *  anunț aflat în coada lor de moderare ar arăta identic cu unul publicat. */
function StareAnunt({ a }: { a: Anunt }) {
  if (a.status === "eroare")
    return <span className="text-red-600" title={a.eroare ?? ""}>eroare: {(a.eroare ?? "").slice(0, 60)}</span>;
  if (a.status === "retras") return <span className="text-mut">retras (piesa nu mai e pe site)</span>;
  if (a.status === "nou") return <span className="text-mut">pregătit, încă netrimis</span>;
  if (a.aprobat) return <span className="text-ok">publicat la ei ✓</span>;
  return <span className="text-yellow-700">așteaptă aprobarea lor</span>;
}

function Progres({ facut, total, eticheta }: { facut: number; total: number; eticheta: string }) {
  const p = total > 0 ? Math.min(100, Math.round((facut / total) * 100)) : 0;
  return (
    <div className="mt-4">
      <div className="flex justify-between text-xs text-mut mb-1">
        <span>{nr(facut)} din {nr(total)} {eticheta}</span>
        <span>{p}%</span>
      </div>
      <div className="h-2 rounded-full bg-line overflow-hidden">
        <div className="h-full bg-acc transition-all" style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

function Cifra({ t, v, bun, rau }: { t: string; v: number; bun?: boolean; rau?: boolean }) {
  return (
    <div className="rounded-xl border-2 border-line p-3">
      <div className={`font-disp text-2xl ${rau ? "text-red-600" : bun ? "text-ok" : ""}`}>{nr(v)}</div>
      <div className="text-xs text-mut mt-0.5">{t}</div>
    </div>
  );
}

function Mica({ t, v, rau }: { t: string; v: number; rau?: boolean }) {
  return (
    <div className="rounded-lg border border-line px-2 py-1.5">
      <div className={`font-semibold ${rau ? "text-red-600" : ""}`}>{nr(v)}</div>
      <div className="text-[11px] text-mut">{t}</div>
    </div>
  );
}

// ============================================================
// SINCRONIZAREA AUTOMATĂ (migrarea 39)
//
// Cifrele vin din view-ul `dezro_coada_stare`, numărate în bază. Caseta asta
// există dintr-un motiv măsurat pe coada de e-mailuri, la 7 septembrie 2026: o
// coadă blocată care nu se vede nicăieri e descoperită abia când sună clientul.
// Aici ar fi și mai rău — nimeni n-are cum să observe singur că un anunț n-a
// plecat.
//
// Butonul „Sincronizează acum" e cârligul de recuperare, ca „Trimite ce a rămas"
// de la e-mail: trezirea din baza de date e fire-and-forget, deci dacă site-ul
// era în timpul unui deploy exact atunci, rândul rămâne în coadă și n-are cine
// să-l ia.
// ============================================================
function SincronizareAutomata({ activ }: { activ: boolean }) {
  const [coada, setCoada] = useState<{ total: number; de_facut: number; blocate: number; de_sters: number; o_eroare: string | null } | null>(null);
  const [mesajPrag, setMesajPrag] = useState<string | null>(null);
  const [lucru, setLucru] = useState(false);
  const [rez, setRez] = useState("");

  const vezi = useCallback(async () => {
    const sb = sbBrowser(); if (!sb) return;
    const [c, cfg] = await Promise.all([
      sb.from("dezro_coada_stare").select("*").maybeSingle(),
      sb.from("settings").select("valoare").eq("cheie", "integrari").maybeSingle(),
    ]);
    setCoada((c.data as any) ?? null);
    setMesajPrag(((cfg.data?.valoare as any)?.dezro?.coada_mesaj as string) ?? null);
  }, []);
  useEffect(() => { vezi(); }, [vezi]);

  async function goleste(confirmatPrag = false) {
    const sb = sbBrowser(); if (!sb) return;
    setLucru(true); setRez("");
    const { data: { session } } = await sb.auth.getSession();
    let facute = 0, treceri = 0;
    // Se cheamă până se golește: ruta face un lot pe cerere, iar din panou vrem
    // rezultatul acum, nu peste încă o trezire. Plafonul de treceri e ca butonul
    // să nu poată ține pagina ocupată la infinit dacă ceva se blochează.
    for (; treceri < 20; treceri++) {
      const r = await fetch("/api/dezro-coada", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
        body: JSON.stringify({ confirmatPrag }),
      }).then((x) => x.json()).catch(() => ({ ok: false, eroare: "Nu s-a putut chema ruta." }));
      if (!r.ok) { setRez(r.eroare ?? "Nu a mers."); break; }
      facute += r.facute ?? 0;
      if (r.cereConfirmare) { setRez(r.nota); break; }
      if (!r.continua) { setRez(r.nota ?? `Gata · ${facute} rânduri lucrate.`); break; }
    }
    setLucru(false);
    vezi();
  }

  const n = coada?.de_facut ?? 0;
  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <b className="font-disp text-base">4b. Sincronizarea automată</b>
          <p className="text-sm text-mut mt-1">
            Baza de date anunță ruta la fiecare piesă adăugată, modificată, vândută sau ștearsă.
            Nu trebuie apăsat nimic; butonul e doar pentru ce a rămas în urmă.
          </p>
        </div>
        <button
          type="button" disabled={lucru || !activ} onClick={() => goleste(false)}
          className="rounded-xl border-2 border-line px-3 py-2 text-xs font-semibold hover:border-acc disabled:opacity-40"
        >
          {lucru ? "Se sincronizează…" : "Sincronizează acum"}
        </button>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mt-3">
        <Cifra t="Așteaptă în coadă" v={n} />
        <Cifra t="Blocate (5 încercări)" v={coada?.blocate ?? 0} rau={(coada?.blocate ?? 0) > 0} />
        <Cifra t="Anunțuri de șters" v={coada?.de_sters ?? 0} />
      </div>

      {!activ && (
        <p className="text-xs text-mut mt-3">
          Integrarea e oprită sau fără cont. Coada se strânge oricum și pleacă întreagă când o pornești —
          nu se pierde nimic.
        </p>
      )}
      {coada?.o_eroare && (
        <p className="text-xs text-red-600 mt-3">Ultima eroare din coadă: {coada.o_eroare}</p>
      )}
      {mesajPrag && (
        <div className="mt-3 rounded-xl border-2 border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800">
          <b className="block">Sincronizarea s-a oprit singură.</b>
          <p className="mt-1">{mesajPrag}</p>
          <button
            type="button" disabled={lucru} onClick={() => goleste(true)}
            className="mt-2 rounded-lg border-2 border-yellow-300 px-3 py-1.5 font-semibold hover:bg-yellow-100 disabled:opacity-40"
          >
            Am verificat, retrage anunțurile
          </button>
        </div>
      )}
      {rez && <p className="text-xs mt-3">{rez}</p>}
    </div>
  );
}
