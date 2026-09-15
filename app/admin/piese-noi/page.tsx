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
// din browserul operatorului la /api/preia-anunt, iar /admin/preia-anunt le completează
// în piesă. Vezi `codButon` mai jos.
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
 *   · deschide `/admin/preia-anunt#p=<cod>` într-un tab nou, cu un cod aleator;
 *   · trimite la `/api/preia-anunt` (fetch + CORS, cu cheia butonului) HTML-ul paginii,
 *     primește înapoi lista pozelor (extrasă pe server, cu regula importului), le ia
 *     din browser una câte una și le trimite, apoi anunță „gata";
 *   · arată pe pagina anunțului, în colț, ce face și dacă a reușit.
 * NU prin `window.opener`/`postMessage`: pieseauto.ro trimite
 * `Cross-Origin-Opener-Policy: same-origin`, care taie legătura cu tabul deschis.
 * Codul nu conține `%` și se pune în `href` codificat, ca browserul să nu-l strice.
 */
function codButon(site: string, cheie: string) {
  const cod = `(function(){
var S=${JSON.stringify(site)},K=${JSON.stringify(cheie)},A=S+'/api/preia-anunt';
if(!/(^|\\.)pieseauto\\.ro$/.test(location.hostname)){alert('Butonul merge doar pe o pagină de anunț de pe pieseauto.ro.');return}
var o=new Uint8Array(16);crypto.getRandomValues(o);
var P=Date.now().toString(36)+'-'+Array.prototype.map.call(o,function(x){return x.toString(36)}).join('');
var T=S+'/admin/preia-anunt#p='+P;
var w=window.open(T,'_blank');
var b=document.createElement('div');
b.style.cssText='position:fixed;z-index:2147483647;top:12px;right:12px;max-width:380px;color:#fff;font:14px/1.45 system-ui,sans-serif;padding:12px 14px;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.35);background:#111';
document.body.appendChild(b);
function m(t,c,l){b.textContent=t;b.style.background=c||'#111';if(l){var a=document.createElement('a');a.href=T;a.target='_blank';a.textContent=' Deschide tabul Autopas';a.style.cssText='color:#fff;font-weight:700;text-decoration:underline';b.appendChild(a)}}
function cere(q,corp,tip){return fetch(A+'?actiune='+q+'&p='+P,{method:'POST',headers:{'x-autopas-cheie':K,'content-type':tip},body:corp}).then(function(x){return x.json().catch(function(){return{ok:false,eroare:'HTTP '+x.status}})}).then(function(j){if(!j.ok)throw new Error(j.eroare||'eroare necunoscută');return j})}
function mic(x){if(x.size<=3500000)return x;return createImageBitmap(x).then(function(im){var f=Math.min(1,2000/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*f);c.height=Math.round(im.height*f);c.getContext('2d').drawImage(im,0,0,c.width,c.height);return new Promise(function(ok){c.toBlob(ok,'image/jpeg',0.88)})})}
m('Autopas: se trimite anunțul…');
var er=[],n=0;
cere('trimite',JSON.stringify({url:location.href,html:document.documentElement.outerHTML}),'text/plain').then(function(j){
var poze=j.poze||[];
return poze.reduce(function(pr,u,i){return pr.then(function(){
m('Autopas ('+j.piesa+'): poza '+(i+1)+' din '+poze.length+'…');
var x;try{x=new URL(u,location.href)}catch(e){er.push('poza '+(i+1)+': adresă greșită');return}
if(!/(^|\\.)pieseauto\\.ro$/.test(x.hostname)){er.push('poza '+(i+1)+': adresă din afara pieseauto.ro');return}
return fetch(x.href).then(function(y){if(!y.ok)throw new Error('HTTP '+y.status);return y.blob()}).then(mic)
.then(function(z){return cere('trimite-poza&i='+i,z,'application/octet-stream')}).then(function(){n++})
.catch(function(e){er.push('poza '+(i+1)+': '+(e&&e.message||e))})})},Promise.resolve())
.then(function(){return cere('trimite-gata',JSON.stringify({erori:er}),'text/plain')})
.then(function(){m('✓ '+j.piesa+' trimisă la Autopas: '+n+' din '+poze.length+' poze'+(er.length?' ('+er.length+' cu probleme)':'')+'. Continuă în tabul Autopas.','#15803d',!w)})
}).catch(function(e){m('✗ Autopas: '+(e&&e.message||e),'#b91c1c')});
})();`;
  if (cod.includes("%")) throw new Error("codul butonului nu are voie să conțină %");
  return "javascript:" + encodeURIComponent(cod.replace(/\n/g, ""));
}

export default function PieseNoi() {
  const [piese, setPiese] = useState<Ciorna[] | null>(null);
  const [q, setQ] = useState("");
  const [eroare, setEroare] = useState("");
  // `href` pus din efect, nu din JSX: React avertizează la adrese `javascript:`,
  // iar adresa site-ului se află abia în browser (merge și pe localhost).
  const buton = useRef<HTMLAnchorElement>(null);
  const [butonGata, setButonGata] = useState<"" | "da" | string>("");
  useEffect(() => {
    // Cheia butonului o dă serverul, doar echipei; fără ea butonul n-are ce trimite.
    (async () => {
      const sb = sbBrowser(); if (!sb) return;
      const token = (await sb.auth.getSession()).data.session?.access_token;
      try {
        const r = await fetch("/api/preia-anunt", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ actiune: "buton" }) });
        const j = await r.json();
        if (!j.ok) throw new Error(j.eroare);
        buton.current?.setAttribute("href", codButon(window.location.origin, j.cheie));
        setButonGata("da");
      } catch (e: any) { setButonGata(`Butonul nu s-a putut pregăti: ${e?.message ?? e}`); }
    })();
  }, []);

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
          <p className="text-xs font-semibold">
            Ai pus deja butonul înainte de 15 septembrie seara? Șterge-l din bara de favorite și trage-l din nou — varianta veche nu merge.
          </p>
          {butonGata && butonGata !== "da" && <p className="text-red-700">{butonGata}</p>}
          <div className="flex items-center gap-3 flex-wrap">
            <a ref={buton} onClick={(e) => { e.preventDefault(); alert("Nu-l apăsa aici: trage-l cu mouse-ul în bara de favorite a browserului."); }}
              className={`btn-acc cursor-grab select-none ${butonGata === "da" ? "" : "opacity-40 pointer-events-none"}`} draggable>⭳ Preia în Autopas</a>
            <span className="text-xs text-mut">← trage-l cu mouse-ul în bara de favorite (o singură dată)</span>
          </div>
          <ol className="list-decimal pl-5 space-y-1 max-w-2xl">
            <li>Dacă nu vezi bara de favorite: <b>Ctrl+Shift+B</b> (pe Mac <b>Cmd+Shift+B</b>).</li>
            <li>La o piesă de mai jos apasă „Vezi pe pieseauto.ro ↗".</li>
            <li>Pe anunțul lor, apasă „Preia în Autopas" din bara de favorite. În colțul paginii lor vezi cum se trimit pozele; se deschide și un tab Autopas care le așteaptă.</li>
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
