"use client";
// ============================================================
// PIESE NOI DIN CSV — ciornele create de sincronizarea cu pieseauto.ro.
//
// DE CE EXISTĂ (cerut de proprietar, 15 septembrie 2026)
// pieseauto.ro blochează cererile de pagini, deci sincronizarea citește DOAR
// CSV-ul: de acolo avem titlul, prețul și adresa anunțului, dar nu pozele și nu
// descrierea. Piesele noi intră nepublicate, marcate `import_erori.ciorna`
// (lib/import/rand.mjs), și stau aici până le completează cineva.
//
// Fluxul, pentru fiecare piesă:
//   1. „Vezi pe pieseauto.ro" — anunțul lor se deschide în browserul tău (pe tine
//      nu te blochează), de unde iei pozele și descrierea;
//   2. „Completează" — formularul piesei; categoria și subcategoria se completează
//      singure din titlu, modelul și anii sunt deja deduși;
//   3. bifezi „Publicată pe site" și salvezi — piesa pleacă de aici.
//
// Din 15 septembrie 2026 pașii 1–3 se fac dintr-un clic: butonul „Preia în Autopas"
// (un bookmarklet pus o dată în bara de favorite) trimite pagina anunțului și pozele
// din browserul operatorului către /admin/preia-anunt. Vezi `codButon` mai jos.
//
// O ciornă care dispare din CSV înainte de a fi completată (vândută între timp)
// iese singură din listă: sincronizarea îi pune `sursa_activ = false`.
// ============================================================
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { sbBrowser, citesteTot } from "@/lib/supabase";
import { lei, tipareCautare } from "@/lib/format";

type Ciorna = {
  id: number; nume: string; cod_intern: string | null; pret_lei: number;
  poze: string[] | null; stare_nota: string | null; categorie_id: number | null;
  model_ids: number[] | null; ani: string | null; compat: string[] | null;
  sursa_url: string | null; created_at: string;
};


/**
 * Codul butonului din bara de favorite („bookmarklet"). Rulează pe pagina anunțului
 * de pe pieseauto.ro, în browserul operatorului, și:
 *   · deschide `/admin/preia-anunt` într-un tab nou (tab nou la fiecare apăsare —
 *     un tab refolosit ar păstra ca „deschizător" anunțul de data trecută);
 *   · la „autopas-gata" venit de pe site-ul NOSTRU, răspunde cu adresa și HTML-ul paginii;
 *   · la „autopas-poza", ia poza cerută (doar de pe pieseauto.ro; e deja în memoria
 *     browserului, fiindcă pagina a afișat-o) și o trimite înapoi.
 * Nu ocolește nimic: e exact pagina pe care omul o vede. Regulile de extragere NU
 * sunt aici, ci în `lib/import/extragere.mjs`, rulate de tabul nostru.
 */
function codButon(site: string) {
  const S = JSON.stringify(site);
  return "javascript:(function(){var S=" + S + ";" +
    "if(!/(^|\\.)pieseauto\\.ro$/.test(location.hostname)){alert('Butonul merge doar pe o pagină de anunț de pe pieseauto.ro.');return}" +
    "var w=window.open(S+'/admin/preia-anunt','_blank');" +
    "if(!w){alert('Browserul a blocat tabul nou. Permite ferestrele pop-up pentru pieseauto.ro și apasă din nou.');return}" +
    "if(window.__autopasPreia)return;window.__autopasPreia=1;" +
    "window.addEventListener('message',function(e){if(e.origin!==S||!e.data||!e.source)return;var d=e.data,r=e.source;" +
    "if(d.tip==='autopas-gata'){r.postMessage({tip:'autopas-anunt',url:location.href,html:document.documentElement.outerHTML},S)}" +
    "else if(d.tip==='autopas-poza'){var t=function(m){r.postMessage({tip:'autopas-poza',k:d.k,i:d.i,eroare:m},S)},u;" +
    "try{u=new URL(d.url,location.href)}catch(x){t('adresă greșită');return}" +
    "if(!/(^|\\.)pieseauto\\.ro$/.test(u.hostname)){t('adresă din afara pieseauto.ro');return}" +
    "fetch(u.href).then(function(x){if(!x.ok)throw new Error('HTTP '+x.status);return x.blob()})" +
    ".then(function(b){r.postMessage({tip:'autopas-poza',k:d.k,i:d.i,blob:b},S)})" +
    ".catch(function(x){t(String(x&&x.message||x))})}})})();";
}

export default function PieseNoi() {
  const [piese, setPiese] = useState<Ciorna[] | null>(null);
  const [q, setQ] = useState("");
  const [eroare, setEroare] = useState("");
  // `href` pus din efect, nu din JSX: React avertizează la adrese `javascript:`,
  // iar adresa site-ului se află abia în browser (merge și pe localhost).
  const buton = useRef<HTMLAnchorElement>(null);
  useEffect(() => { buton.current?.setAttribute("href", codButon(window.location.origin)); }, []);

  const incarca = useCallback(async () => {
    const sb = sbBrowser(); if (!sb) return;
    try {
      // Toate, nu primele 1.000: după o sincronizare mare pot fi sute sau mii.
      const lista = await citesteTot<Ciorna>(() => {
        let cerere = sb.from("products")
          .select("id,nume,cod_intern,pret_lei,poze,stare_nota,categorie_id,model_ids,ani,compat,sursa_url,created_at", { count: "exact" })
          .eq("sursa", "pieseauto.ro")
          .eq("sursa_activ", true)
          .filter("import_erori->>ciorna", "eq", "true");
        for (const tipar of tipareCautare(q)) cerere = cerere.filter("cautare", "imatch", tipar);
        return cerere.order("id", { ascending: false });
      }, { eticheta: "piesele noi" });
      setPiese(lista); setEroare("");
    } catch (e: any) {
      setEroare(e?.message ?? "Nu s-au putut citi piesele.");
    }
  }, [q]);
  useEffect(() => { const t = setTimeout(incarca, q ? 300 : 0); return () => clearTimeout(t); }, [incarca, q]);

  const lipsuri = (p: Ciorna) => [
    !p.poze?.length && "poze",
    !p.stare_nota?.trim() && "descriere",
    !p.categorie_id && "categorie",
    !p.model_ids?.length && "model",
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="dim">Administrare</div>
          <h1 className="font-disp font-bold text-2xl mt-1">
            Piese noi din CSV {piese && <span className="text-acc">· {piese.length}</span>}
          </h1>
          <p className="text-sm text-mut mt-1 max-w-2xl">
            Piese găsite în CSV-ul de la pieseauto.ro care nu erau încă pe site. Sunt <b>nepublicate</b>:
            deschide anunțul lor, ia pozele și descrierea, apoi „Completează" și bifează „Publicată pe site".
          </p>
        </div>
        <Link href="/admin/import" className="rounded-lg border-2 border-line px-3 py-2 text-sm font-semibold hover:border-acc">
          Sincronizare CSV
        </Link>
      </div>

      <details className="card p-4 text-sm" open={piese !== null && piese.length > 0}>
        <summary className="cursor-pointer font-disp font-semibold">⚡ Preluare dintr-un clic: pozele și descrierea direct de pe anunț</summary>
        <div className="mt-3 space-y-3">
          <p className="text-mut max-w-2xl">
            pieseauto.ro blochează serverul nostru, dar nu browserul tău. Butonul de mai jos ia din anunțul deschis
            la tine pozele și descrierea și le pune în piesa potrivită, cu categoria și modelele completate ca la import.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <a ref={buton} onClick={(e) => { e.preventDefault(); alert("Nu-l apăsa aici: trage-l cu mouse-ul în bara de favorite a browserului."); }}
              className="btn-acc cursor-grab select-none" draggable>⭳ Preia în Autopas</a>
            <span className="text-xs text-mut">← trage-l cu mouse-ul în bara de favorite (o singură dată)</span>
          </div>
          <ol className="list-decimal pl-5 space-y-1 max-w-2xl">
            <li>Dacă nu vezi bara de favorite: <b>Ctrl+Shift+B</b> (pe Mac <b>Cmd+Shift+B</b>).</li>
            <li>La o piesă de mai jos apasă „Vezi pe pieseauto.ro ↗".</li>
            <li>Pe anunțul lor, apasă „Preia în Autopas" din bara de favorite. Se deschide un tab cu ce s-a găsit.</li>
            <li>Verifici și apeși „Preia și publică". De acolo, „Următorul anunț" te duce la piesa următoare.</li>
          </ol>
          <p className="text-xs text-mut">Dacă browserul spune că a blocat o fereastră pop-up, permite-le pentru pieseauto.ro.</p>
        </div>
      </details>

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Caută în piesele noi…"
        className="w-full max-w-md rounded-xl border-2 border-line px-3 py-2 text-sm outline-none focus:border-acc" />

      {eroare && <div className="card p-3 text-sm text-red-600">{eroare}</div>}
      {!piese && !eroare && <p className="text-mut text-sm">Se încarcă…</p>}
      {piese && piese.length === 0 && (
        <div className="card p-8 text-center text-sm text-mut">
          {q ? "Nicio piesă nouă nu se potrivește căutării." : "Nicio piesă nouă de completat. Toate piesele din CSV sunt deja pe site."}
        </div>
      )}

      {piese && piese.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="tabel-carduri w-full text-sm md:min-w-[760px]">
            <thead>
              <tr className="text-left text-mut text-xs border-b border-line">
                <th className="px-4 py-3">Piesă</th><th className="px-4 py-3">Preț</th>
                <th className="px-4 py-3">Lipsește</th><th className="px-4 py-3 text-right">Acțiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {piese.map((p) => (
                <tr key={p.id} className="hover:bg-paper">
                  <td data-eticheta="Piesă" className="px-4 py-3">
                    <b className="font-semibold">{p.nume}</b>
                    <div className="text-[11px] text-mut">
                      {p.cod_intern ?? `#${p.id}`}
                      {p.compat?.[0] ? ` · ${p.compat[0]}` : ""}{p.ani ? ` · ${p.ani}` : ""}
                      {" · intrată "}{new Date(p.created_at).toLocaleDateString("ro-RO")}
                    </div>
                  </td>
                  <td data-eticheta="Preț" className="px-4 py-3 whitespace-nowrap font-semibold">{lei(Number(p.pret_lei))}</td>
                  <td data-eticheta="Lipsește" className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {lipsuri(p).map((l) => (
                        <span key={l} className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${l === "poze" || l === "descriere" ? "bg-amber-100 text-amber-800" : "bg-paper text-mut"}`}>{l}</span>
                      ))}
                    </div>
                  </td>
                  <td data-eticheta="Acțiuni" className="px-4 py-3">
                    <div className="flex gap-2 justify-end flex-wrap">
                      {p.sursa_url && (
                        <a href={p.sursa_url} target="_blank" rel="noopener noreferrer"
                          className="rounded-lg border-2 border-line px-3 py-1.5 text-xs font-bold hover:border-acc">Vezi pe pieseauto.ro ↗</a>
                      )}
                      <Link href={`/admin/produse/${p.id}`} className="btn-acc !py-1.5 !px-3 text-xs">Completează</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
