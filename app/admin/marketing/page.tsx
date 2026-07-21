"use client";
// MARKETING — coduri de reducere reale: se creează aici, se validează în coș, se scad la checkout.
import { useEffect, useState, useCallback } from "react";
import { sbBrowser } from "@/lib/supabase";
import { lei } from "@/lib/format";
import type { Discount } from "@/lib/types";

export default function Marketing() {
  const [coduri, setCoduri] = useState<Discount[]>([]);
  const [msg, setMsg] = useState("");

  const incarca = useCallback(async () => {
    const sb = sbBrowser(); if (!sb) return;
    setCoduri(((await sb.from("discount_codes").select("*").order("created_at", { ascending: false })).data ?? []) as Discount[]);
  }, []);
  useEffect(() => { incarca(); }, [incarca]);

  async function adauga(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setMsg("");
    const f = new FormData(e.currentTarget); const sb = sbBrowser()!;
    const { error } = await sb.from("discount_codes").insert({
      cod: String(f.get("cod")).toUpperCase().trim(), tip: f.get("tip"),
      valoare: Number(f.get("valoare")), minim_comanda: Number(f.get("minim") || 0),
      expira_la: f.get("expira") || null, activ: true,
    });
    setMsg(error ? "Eroare: " + error.message : "✓ Codul e activ — clienții îl pot folosi în coș.");
    if (!error) { (e.target as HTMLFormElement).reset(); incarca(); }
  }
  async function comuta(c: Discount) {
    const sb = sbBrowser()!; await sb.from("discount_codes").update({ activ: !c.activ }).eq("id", c.id); incarca();
  }
  async function sterge(c: Discount) {
    if (!confirm(`Ștergi codul ${c.cod}?`)) return;
    const sb = sbBrowser()!; await sb.from("discount_codes").delete().eq("id", c.id); incarca();
  }

  return (
    <div className="space-y-4">
      <div><div className="dim">Administrare</div><h1 className="font-disp font-bold text-2xl mt-1">Marketing</h1></div>

      <div className="grid lg:grid-cols-[1fr,360px] gap-4 items-start">
        <div className="card">
          <b className="font-disp font-semibold text-[13px] block px-5 py-3.5 border-b border-line">Coduri de reducere</b>
          <div className="divide-y divide-line">
            {coduri.map((c) => {
              const expirat = c.expira_la && new Date(c.expira_la) < new Date();
              return (
                <div key={c.id} className="px-5 py-3 flex items-center gap-3 text-sm flex-wrap">
                  <b className="font-disp text-base bg-paper px-2.5 py-1 rounded-lg border border-line">{c.cod}</b>
                  <span>{c.tip === "procent" ? `−${c.valoare}%` : `−${lei(Number(c.valoare))}`}
                    {Number(c.minim_comanda) > 0 && <span className="text-mut"> · min. {lei(Number(c.minim_comanda))}</span>}</span>
                  <span className="text-xs text-mut">{c.expira_la ? `expiră ${new Date(c.expira_la).toLocaleDateString("ro-RO")}` : "fără expirare"} · folosit de {c.folosiri} ori</span>
                  <div className="ml-auto flex gap-2">
                    <button onClick={() => comuta(c)} className={`px-2.5 py-1 rounded-full text-[11px] font-bold border-2 ${c.activ && !expirat ? "border-ok/40 text-ok" : "border-line text-mut"}`}>
                      {expirat ? "expirat" : c.activ ? "activ" : "oprit"}</button>
                    <button onClick={() => sterge(c)} className="text-mut hover:text-red-600 text-xs">Șterge</button>
                  </div>
                </div>
              );
            })}
            {coduri.length === 0 && <p className="p-8 text-center text-mut text-sm">Niciun cod încă. Creează primul din dreapta.</p>}
          </div>
        </div>

        <div className="space-y-4">
          <form onSubmit={adauga} className="card p-5 grid gap-3 text-sm">
            <b className="font-disp font-semibold text-[13px]">Cod nou</b>
            <div className="fld"><label>Codul * <span className="font-normal text-mut">(îl scrie clientul în coș)</span></label>
              <input name="cod" required placeholder="ex. TOAMNA10" className="uppercase" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="fld"><label>Tip</label><select name="tip"><option value="procent">Procent (%)</option><option value="fix">Sumă fixă (lei)</option></select></div>
              <div className="fld"><label>Valoare *</label><input name="valoare" type="number" step="0.01" required /></div>
              <div className="fld"><label>Comandă minimă (lei)</label><input name="minim" type="number" step="0.01" defaultValue={0} /></div>
              <div className="fld"><label>Expiră la</label><input name="expira" type="date" /></div>
            </div>
            <button className="btn-acc">Creează codul</button>
            {msg && <p className="text-xs text-center">{msg}</p>}
          </form>

          <div className="card p-5 text-sm">
            <b className="font-disp font-semibold text-[13px]">În pregătire</b>
            <ul className="mt-2 space-y-1.5 text-mut text-xs">
              <li>• E-mail automat „coș abandonat" — necesită serviciu de e-mail (Resend/Brevo)</li>
              <li>• Alertă „piesa căutată a intrat pe stoc" — se leagă de cererile din Inbox</li>
              <li>• Feed Google Shopping / Meta — se activează la deschiderea conturilor</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
