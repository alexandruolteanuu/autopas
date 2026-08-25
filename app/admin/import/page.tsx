"use client";
// ============================================================
// IMPORT DIN pieseauto.ro — ecranul operatorului
//
// Importul complet înseamnă ~8.000 de pagini și ~4,5 ore de descărcare. Nimeni nu
// ține un tab deschis atâta, deci starea NU stă în pagină: stă în `import_jobs` și
// în bucketul privat cu fișierul CSV. Pagina cere loturi mici, unul după altul, și
// arată progresul. Dacă tabul se închide, jobul rămâne pe loc și, la redeschidere,
// apare butonul „Continuă importul".
//
// Toată logica de import e în lib/import/ — ecranul ăsta doar comandă și afișează.
// ============================================================
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { sbBrowser } from "@/lib/supabase";

type Job = {
  id: number; status: string; total: number; procesate: number;
  noi: number; actualizate: number; neschimbate: number; disparute: number;
  pagini: number; poze_salvate: number; octeti_poze: number; nr_erori: number;
  erori: { id?: string; eroare: string }[] | null;
  jurnal: { la: string; text: string }[] | null;
  categorii_sursa: Record<string, number> | null;
  optiuni: any; mesaj: string | null; nume_fisier: string | null;
  inceput_la: string; actualizat_la: string; terminat_la: string | null;
};

type Plan = {
  total: number; inBaza: number; noi: number; deActualizat: number; neschimbate: number;
  disparute: number; procentDisparute: number; pragDepasit: boolean; pragProcent: number;
  minuteEstimate: number; exempleNoi: string[];
  exempleActualizate: { titlu: string; vechi: number; nou: number }[];
};

const mb = (o: number) => `${(o / 1024 / 1024).toFixed(1)} MB`;
const durata = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : m ? `${m}m ${s % 60}s` : `${s}s`;
};

export default function ImportPieseauto() {
  const [fisier, setFisier] = useState<{ nume: string; text: string } | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [depublica, setDepublica] = useState(true);
  const [job, setJob] = useState<Job | null>(null);
  const [istoric, setIstoric] = useState<Job[]>([]);
  const [lucru, setLucru] = useState(false);
  const [ruleaza, setRuleaza] = useState(false);
  const [msg, setMsg] = useState("");
  const [confirmare, setConfirmare] = useState<string | null>(null);
  const opreste = useRef(false);

  // ---------- comunicarea cu ruta ----------
  const cere = useCallback(async (corp: any) => {
    const sb = sbBrowser();
    const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
    if (!token) throw new Error("Sesiunea a expirat. Autentifică-te din nou.");
    const r = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(corp),
    });
    const j = await r.json().catch(() => ({ ok: false, eroare: `HTTP ${r.status}` }));
    return j as any;
  }, []);

  // ---------- ce s-a întâmplat până acum ----------
  const incarcaIstoric = useCallback(async () => {
    const sb = sbBrowser(); if (!sb) return;
    const { data } = await sb.from("import_jobs").select("*").order("id", { ascending: false }).limit(10);
    const lista = (data ?? []) as Job[];
    setIstoric(lista);
    const activ = lista.find((j) => j.status === "in_curs" || j.status === "in_pauza");
    if (activ) setJob(activ);
  }, []);
  useEffect(() => { incarcaIstoric(); }, [incarcaIstoric]);

  // Bucla de loturi. Se oprește când jobul nu mai e `in_curs`, când operatorul
  // apasă „Oprește" sau când pagina se închide (atunci jobul rămâne pe loc și se
  // reia data viitoare — de asta poziția stă în bază, nu aici).
  const ruleazaLoturi = useCallback(async (jobId: number) => {
    opreste.current = false;
    setRuleaza(true); setMsg("");
    try {
      for (;;) {
        if (opreste.current) break;
        const j = await cere({ actiune: "lot", jobId });
        if (!j.ok) { setMsg(j.eroare ?? "Eroare la lot."); break; }
        setJob(j.job);
        if (j.gata || j.job.status !== "in_curs") break;
      }
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setRuleaza(false);
      incarcaIstoric();
    }
  }, [cere, incarcaIstoric]);

  useEffect(() => () => { opreste.current = true; }, []);

  // ---------- pașii operatorului ----------
  async function alegeFisier(f: File | null) {
    if (!f) return;
    setPlan(null); setMsg("");
    const text = await f.text();
    setFisier({ nume: f.name, text });
  }

  async function previzualizeaza() {
    if (!fisier || lucru) return;
    setLucru(true); setMsg("");
    const j = await cere({ actiune: "previzualizare", csv: fisier.text });
    setLucru(false);
    if (!j.ok) { setMsg(j.eroare); return; }
    setPlan(j.plan);
    setDepublica(true);
  }

  async function porneste(confirmatTrunchiat = false) {
    if (!fisier || lucru) return;
    setLucru(true); setMsg(""); setConfirmare(null);
    const j = await cere({
      actiune: "start", csv: fisier.text, numeFisier: fisier.nume,
      depublica, confirmatTrunchiat,
    });
    setLucru(false);
    if (!j.ok) {
      if (j.cereConfirmare) { setConfirmare(j.eroare); return; }
      setMsg(j.eroare); return;
    }
    setJob(j.job); setPlan(null); setFisier(null);
    ruleazaLoturi(j.job.id);
  }

  async function comanda(actiune: string) {
    if (!job) return;
    opreste.current = true;
    setLucru(true);
    const j = await cere({ actiune, jobId: job.id });
    setLucru(false);
    if (!j.ok) { setMsg(j.eroare); return; }
    setJob(j.job);
    incarcaIstoric();
    if (actiune === "reia") ruleazaLoturi(j.job.id);
  }

  async function reiaEsecuri() {
    if (!job) return;
    setLucru(true);
    const j = await cere({ actiune: "reia-esecuri", jobId: job.id });
    setLucru(false);
    if (!j.ok) { setMsg(j.eroare); return; }
    setJob(j.job);
    ruleazaLoturi(j.job.id);
  }

  // ---------- calcule de afișat ----------
  const activ = job && (job.status === "in_curs" || job.status === "in_pauza");
  const proc = job && job.total ? Math.min(100, (job.procesate / job.total) * 100) : 0;
  const scurs = job ? new Date(job.actualizat_la).getTime() - new Date(job.inceput_la).getTime() : 0;
  const ramas = job && job.procesate > 0 && job.procesate < job.total
    ? (scurs / job.procesate) * (job.total - job.procesate) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-disp font-bold text-xl">Import din pieseauto.ro</h1>
          <p className="text-sm text-mut mt-1 max-w-2xl">
            Încarcă feed-ul complet exportat din pieseauto.ro. Piesele noi se descarcă de la sursă,
            cu poze, și intră publicate pe site. Prețurile pieselor deja importate se actualizează
            instant, din fișier. Piesele care nu mai apar în feed se depublică.
          </p>
        </div>
        <Link href="/admin/piese-de-completat" className="rounded-lg border-2 border-line px-3 py-2 text-sm font-semibold hover:border-acc">
          Piese de completat
        </Link>
      </div>

      {/* ===== Job activ sau tocmai terminat ===== */}
      {job && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="font-disp font-bold">
                Import #{job.id}
                <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-bold ${
                  job.status === "gata" ? "bg-green-100 text-green-700"
                  : job.status === "in_curs" ? "bg-amber-100 text-amber-800"
                  : job.status === "in_pauza" ? "bg-line text-mut"
                  : "bg-red-100 text-red-700"}`}>
                  {job.status === "in_curs" ? (ruleaza ? "în curs" : "întrerupt") : job.status.replace("_", " ")}
                </span>
              </div>
              <div className="text-xs text-mut mt-0.5">
                {job.nume_fisier} · pornit {new Date(job.inceput_la).toLocaleString("ro-RO")}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {activ && ruleaza && (
                <button onClick={() => comanda("pauza")} disabled={lucru}
                  className="rounded-lg border-2 border-line px-4 min-h-[44px] text-sm font-semibold hover:border-acc disabled:opacity-40">
                  Oprește
                </button>
              )}
              {activ && !ruleaza && (
                <button onClick={() => comanda("reia")} disabled={lucru}
                  className="rounded-lg bg-acc text-white px-4 min-h-[44px] text-sm font-bold disabled:opacity-40">
                  Continuă importul ({job.procesate} din {job.total})
                </button>
              )}
              {activ && !ruleaza && (
                <button onClick={() => comanda("anuleaza")} disabled={lucru}
                  className="rounded-lg border-2 border-line px-4 min-h-[44px] text-sm font-semibold hover:border-red-400 disabled:opacity-40">
                  Anulează
                </button>
              )}
              {job.status !== "in_curs" && job.status !== "in_pauza" && (
                <button onClick={() => { setJob(null); setPlan(null); }}
                  className="rounded-lg border-2 border-line px-4 min-h-[44px] text-sm font-semibold hover:border-acc">
                  Închide
                </button>
              )}
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-semibold">{job.procesate} din {job.total} rânduri</span>
              <span className="text-mut numar">{proc.toFixed(1)}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-line overflow-hidden">
              <div className="h-full bg-acc transition-all" style={{ width: `${proc}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
            {[
              ["Piese noi", job.noi],
              ["Actualizate", job.actualizate],
              ["Neschimbate", job.neschimbate],
              ["Depublicate", job.disparute],
              ["Poze aduse", job.poze_salvate],
              ["Erori", job.nr_erori],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded-lg bg-paper p-2.5">
                <div className={`font-disp font-bold text-lg ${k === "Erori" && (v as number) > 0 ? "text-red-600" : ""}`}>{v as number}</div>
                <div className="text-[11px] text-mut">{k as string}</div>
              </div>
            ))}
          </div>

          <div className="text-xs text-mut flex flex-wrap gap-x-4 gap-y-1">
            <span>Timp scurs: <b className="text-ink">{durata(scurs)}</b></span>
            {activ && ramas > 0 && <span>Estimat rămas: <b className="text-ink">{durata(ramas)}</b></span>}
            <span>Pagini descărcate: <b className="text-ink">{job.pagini}</b></span>
            <span>Stocare folosită: <b className="text-ink">{mb(Number(job.octeti_poze ?? 0))}</b></span>
            {job.pagini > 0 && (
              <span>Estimare pentru 8.000 de piese:{" "}
                <b className="text-ink">{mb((Number(job.octeti_poze ?? 0) / Math.max(1, job.noi)) * 8000)}</b></span>
            )}
          </div>

          {ruleaza && (
            <p className="text-xs text-mut">
              Lucrează. Poți lăsa fila deschisă și face altceva — dacă o închizi, importul se oprește
              aici și îl continui de unde a rămas.
            </p>
          )}

          {job.mesaj && (
            <div className="rounded-lg border-2 border-red-300 bg-red-50 p-3 text-sm text-red-800">{job.mesaj}</div>
          )}

          {/* Erorile: se sar, nu opresc importul. La final se pot relua. */}
          {job.nr_erori > 0 && (
            <div className="rounded-lg border border-line p-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <b className="text-sm">{job.nr_erori} rânduri au eșuat și au fost sărite</b>
                {!activ && (
                  <button onClick={reiaEsecuri} disabled={lucru}
                    className="rounded-lg border-2 border-acc text-acc px-3 min-h-[40px] text-sm font-bold disabled:opacity-40">
                    Reia eșuările
                  </button>
                )}
              </div>
              <ul className="mt-2 text-xs text-mut space-y-0.5 max-h-40 overflow-y-auto">
                {(job.erori ?? []).slice(0, 20).map((e, i) => (
                  <li key={i}>{e.id ? `${e.id}: ` : ""}{e.eroare}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Categoriile-sursă întâlnite: de aici se decide ce subcategorii merită create. */}
          {job.categorii_sursa && Object.keys(job.categorii_sursa).length > 0 && (
            <details className="rounded-lg border border-line p-3">
              <summary className="text-sm font-semibold cursor-pointer">
                Categorii-sursă întâlnite ({Object.keys(job.categorii_sursa).length})
              </summary>
              <ul className="mt-2 text-xs text-mut grid sm:grid-cols-2 gap-x-6">
                {Object.entries(job.categorii_sursa).sort((a, b) => b[1] - a[1]).map(([s, n]) => (
                  <li key={s} className="flex justify-between gap-2 border-b border-line/60 py-0.5">
                    <span>{s}</span><b className="text-ink numar">{n}</b>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {job.jurnal && job.jurnal.length > 0 && (
            <details className="rounded-lg border border-line p-3">
              <summary className="text-sm font-semibold cursor-pointer">Jurnal</summary>
              <ul className="mt-2 text-xs text-mut space-y-1">
                {job.jurnal.map((l, i) => (
                  <li key={i}><span className="numar">{new Date(l.la).toLocaleTimeString("ro-RO")}</span> · {l.text}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* ===== Fișier nou ===== */}
      {!activ && (
        <div className="card p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Fișierul CSV exportat din pieseauto.ro</label>
            <input type="file" accept=".csv,text/csv" onChange={(e) => alegeFisier(e.target.files?.[0] ?? null)}
              className="block w-full text-sm border-2 border-line rounded-lg p-2.5" />
            <p className="text-xs text-mut mt-1">
              Coloane așteptate: ID, URL, Titlu, Moneda, Pret. Feed-ul se generează întotdeauna complet —
              piesele lipsă din el sunt considerate vândute.
            </p>
          </div>

          {fisier && !plan && (
            <button onClick={previzualizeaza} disabled={lucru}
              className="rounded-lg bg-acc text-white px-5 min-h-[44px] text-sm font-bold disabled:opacity-40">
              {lucru ? "Se citește…" : `Previzualizează ${fisier.nume}`}
            </button>
          )}

          {plan && (
            <div className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded-lg border-2 border-line p-3">
                  <div className="font-disp font-bold text-lg">{plan.deActualizat} de actualizat</div>
                  <div className="text-xs text-mut">preț schimbat · instant, fără nicio descărcare</div>
                  {plan.exempleActualizate.length > 0 && (
                    <ul className="mt-2 text-[11px] text-mut space-y-0.5">
                      {plan.exempleActualizate.map((x, i) => (
                        <li key={i} className="truncate">{x.titlu}: {x.vechi} → <b className="text-ink">{x.nou}</b> lei</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="rounded-lg border-2 border-acc p-3">
                  <div className="font-disp font-bold text-lg text-acc">{plan.noi} noi</div>
                  <div className="text-xs text-mut">
                    necesită descărcarea paginii și a pozelor ·{" "}
                    {plan.minuteEstimate < 1 ? "sub un minut" : `~${plan.minuteEstimate} minute`}
                  </div>
                  {plan.exempleNoi.length > 0 && (
                    <ul className="mt-2 text-[11px] text-mut space-y-0.5">
                      {plan.exempleNoi.map((t, i) => <li key={i} className="truncate">{t}</li>)}
                    </ul>
                  )}
                </div>
              </div>

              <div className="text-sm text-mut">
                {plan.total} rânduri în fișier · {plan.inBaza} piese de la sursa asta în bază ·{" "}
                {plan.neschimbate} rămân neatinse
              </div>

              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={depublica} onChange={(e) => setDepublica(e.target.checked)} className="w-4 h-4 mt-0.5" />
                <span>
                  Depublică cele <b>{plan.disparute}</b> piese care nu mai apar în feed ({plan.procentDisparute}%)
                  <span className="block text-xs text-mut">
                    Rândurile rămân în bază, cu istoricul lor — se sting doar de pe site.
                  </span>
                </span>
              </label>

              {depublica && plan.pragDepasit && (
                <div className="rounded-lg border-2 border-red-300 bg-red-50 p-3 text-sm text-red-800">
                  <b>Verifică fișierul.</b> Ar depublica {plan.disparute} din {plan.inBaza} piese
                  ({plan.procentDisparute}%), peste pragul de {plan.pragProcent}%. Pare un export incomplet.
                  Un magazin de dezmembrări vinde constant, dar nu atât într-un interval între importuri.
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                <button onClick={() => porneste(false)} disabled={lucru}
                  className="rounded-lg bg-acc text-white px-5 min-h-[44px] text-sm font-bold disabled:opacity-40">
                  {lucru ? "Se pornește…" : "Pornește importul"}
                </button>
                <button onClick={() => { setPlan(null); setFisier(null); }}
                  className="rounded-lg border-2 border-line px-4 min-h-[44px] text-sm font-semibold hover:border-acc">
                  Renunță
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {confirmare && (
        <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4 space-y-3">
          <b className="text-red-800 block">{confirmare}</b>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => porneste(true)} disabled={lucru}
              className="rounded-lg bg-red-600 text-white px-4 min-h-[44px] text-sm font-bold disabled:opacity-40">
              Da, continuă și depublică
            </button>
            <button onClick={() => setConfirmare(null)}
              className="rounded-lg border-2 border-line px-4 min-h-[44px] text-sm font-semibold bg-white">
              Nu, verific fișierul
            </button>
          </div>
        </div>
      )}

      {msg && <div className="card p-3 text-sm">{msg}</div>}

      {/* ===== Istoric ===== */}
      {istoric.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm tabel-carduri">
            <thead>
              <tr className="text-left text-mut text-xs border-b border-line">
                <th className="py-2 pl-4">Import</th><th className="py-2">Stare</th>
                <th className="py-2">Rânduri</th><th className="py-2">Noi</th>
                <th className="py-2">Poze</th><th className="py-2 pr-4">Stocare</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {istoric.map((j) => (
                <tr key={j.id}>
                  <td className="py-2 pl-4" data-eticheta="Import">
                    <button onClick={() => setJob(j)} className="font-semibold hover:text-acc">#{j.id}</button>
                    <div className="text-[11px] text-mut">{new Date(j.inceput_la).toLocaleString("ro-RO")}</div>
                  </td>
                  <td className="py-2" data-eticheta="Stare">{j.status.replace("_", " ")}</td>
                  <td className="py-2 numar" data-eticheta="Rânduri">{j.procesate}/{j.total}</td>
                  <td className="py-2 numar" data-eticheta="Noi">{j.noi}</td>
                  <td className="py-2 numar" data-eticheta="Poze">{j.poze_salvate}</td>
                  <td className="py-2 pr-4 numar" data-eticheta="Stocare">{mb(Number(j.octeti_poze ?? 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
