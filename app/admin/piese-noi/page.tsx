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
// O ciornă care dispare din CSV înainte de a fi completată (vândută între timp)
// iese singură din listă: sincronizarea îi pune `sursa_activ = false`.
// ============================================================
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { sbBrowser, citesteTot } from "@/lib/supabase";
import { lei, tipareCautare } from "@/lib/format";

type Ciorna = {
  id: number; nume: string; cod_intern: string | null; pret_lei: number;
  poze: string[] | null; stare_nota: string | null; categorie_id: number | null;
  model_ids: number[] | null; ani: string | null; compat: string[] | null;
  sursa_url: string | null; created_at: string;
};

export default function PieseNoi() {
  const [piese, setPiese] = useState<Ciorna[] | null>(null);
  const [q, setQ] = useState("");
  const [eroare, setEroare] = useState("");

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
