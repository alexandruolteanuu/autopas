"use client";
// SETĂRI — datele firmei și prețurile curierilor se salvează în baza de date
// și sunt folosite automat în footer, la checkout și în exportul pentru Saga.
// Tot aici se administrează rolurile echipei.
import { useEffect, useState, useCallback } from "react";
import { sbBrowser } from "@/lib/supabase";
import { getSetariBrowser, type Firma, type Curier, FIRMA_IMPLICITA, CURIERI_IMPLICITI } from "@/lib/settings";

type Profil = { id: string; email: string; nume: string | null; role: string };
const ROLURI = [
  { id: "client", t: "Client", d: "doar contul lui de pe site" },
  { id: "operator", t: "Operator depozit", d: "comenzi, produse, cereri, expedieri" },
  { id: "contabil", t: "Contabil", d: "doar comenzi și facturi" },
  { id: "admin", t: "Administrator", d: "acces complet, inclusiv setări" },
];

export default function Setari() {
  const [firma, setFirma] = useState<Firma>(FIRMA_IMPLICITA);
  const [curieri, setCurieri] = useState<Curier[]>(CURIERI_IMPLICITI);
  const [useri, setUseri] = useState<Profil[]>([]);
  const [msg, setMsg] = useState("");
  const [eAdmin, setEAdmin] = useState(false);

  const incarca = useCallback(async () => {
    const s = await getSetariBrowser(); setFirma(s.firma); setCurieri(s.curieri);
    const sb = sbBrowser(); if (!sb) return;
    const { data: u } = await sb.auth.getUser();
    if (u.user) {
      const { data: p } = await sb.from("profiles").select("role").eq("id", u.user.id).single();
      setEAdmin(p?.role === "admin");
    }
    const { data } = await sb.from("profiles").select("id,email,nume,role").order("created_at");
    setUseri((data ?? []) as Profil[]);
  }, []);
  useEffect(() => { incarca(); }, [incarca]);

  async function salveaza(cheie: string, valoare: unknown) {
    const sb = sbBrowser()!; setMsg("");
    const { error } = await sb.from("settings").update({ valoare }).eq("cheie", cheie);
    setMsg(error ? "Eroare: " + error.message + " (doar administratorul poate salva setările)" : "✓ Salvat — se aplică imediat pe site.");
  }
  async function schimbaRol(p: Profil, role: string) {
    const sb = sbBrowser()!;
    const { error } = await sb.from("profiles").update({ role }).eq("id", p.id);
    setMsg(error ? "Eroare: " + error.message : `✓ ${p.email} are acum rolul „${role}".`);
    incarca();
  }

  return (
    <div className="space-y-4">
      <div><div className="dim">Administrare</div><h1 className="font-disp font-bold text-2xl mt-1">Setări</h1>
        {!eAdmin && <p className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2 mt-2">Doar administratorul poate salva modificările de aici.</p>}</div>

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        {/* Firma */}
        <form onSubmit={(e) => { e.preventDefault();
          const f = new FormData(e.currentTarget);
          const nou: Firma = { denumire: String(f.get("denumire")), cui: String(f.get("cui")), reg_com: String(f.get("reg_com")),
            iban: String(f.get("iban")), serie_factura: String(f.get("serie")), telefon: String(f.get("telefon")),
            email: String(f.get("email")), whatsapp: String(f.get("whatsapp")).replace(/\D/g, "") };
          setFirma(nou); salveaza("firma", nou); }}
          className="card p-5 grid gap-3 text-sm">
          <b className="font-disp font-semibold text-[13px]">Date firmă și fiscale</b>
          <p className="text-xs text-mut -mt-1">Apar în subsolul site-ului, pe documentele legale și în exportul pentru Saga.</p>
          <div className="fld"><label>Denumire</label><input name="denumire" defaultValue={firma.denumire} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="fld"><label>CUI</label><input name="cui" defaultValue={firma.cui} placeholder="RO…" /></div>
            <div className="fld"><label>Reg. Com.</label><input name="reg_com" defaultValue={firma.reg_com} placeholder="J27/…" /></div>
            <div className="fld"><label>Serie facturi</label><input name="serie" defaultValue={firma.serie_factura} /></div>
            <div className="fld"><label>Telefon afișat</label><input name="telefon" defaultValue={firma.telefon} /></div>
          </div>
          <div className="fld"><label>IBAN</label><input name="iban" defaultValue={firma.iban} placeholder="RO…" /></div>
          <div className="fld"><label>E-mail comenzi</label><input name="email" type="email" defaultValue={firma.email} /></div>
          <div className="fld"><label>Număr WhatsApp <span className="font-normal text-mut">(format internațional, ex. 40740123456)</span></label>
            <input name="whatsapp" defaultValue={firma.whatsapp} placeholder="40740123456" /></div>
          <p className="text-[11px] text-mut -mt-1">Se aplică instant pe tot site-ul: butonul plutitor, pagina de produs, butoanele din admin.</p>
          <button className="btn-acc" disabled={!eAdmin}>Salvează datele firmei</button>
        </form>

        <div className="space-y-4">
          {/* Curieri */}
          <form onSubmit={(e) => { e.preventDefault(); salveaza("curieri", curieri); }} className="card p-5 grid gap-3 text-sm">
            <b className="font-disp font-semibold text-[13px]">Curieri și prețuri de livrare</b>
            <p className="text-xs text-mut -mt-1">Se folosesc la checkout — modificarea se vede instant pe site.</p>
            {curieri.map((c, i) => (
              <div key={c.id} className="grid grid-cols-[1fr,90px] gap-2 items-end">
                <div className="fld"><label>{c.nume}</label>
                  <input value={c.detalii} onChange={(e) => { const n = [...curieri]; n[i] = { ...c, detalii: e.target.value }; setCurieri(n); }} /></div>
                <div className="fld"><label>lei</label>
                  <input type="number" step="0.1" value={c.pret}
                    onChange={(e) => { const n = [...curieri]; n[i] = { ...c, pret: Number(e.target.value) }; setCurieri(n); }} /></div>
              </div>
            ))}
            <button className="btn-acc" disabled={!eAdmin}>Salvează curierii</button>
          </form>

          {/* Roluri */}
          <div className="card p-5 text-sm">
            <b className="font-disp font-semibold text-[13px]">Echipa și rolurile</b>
            <p className="text-xs text-mut mt-1">Conturile se creează prin înregistrare pe site; aici le atribui rolul.</p>
            {useri.length <= 1 && (
              <p className="text-[11px] text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-2.5 py-2 mt-2">
                Dacă vezi doar contul tău, rulează migrarea <b>admin-fix.sql</b> — până atunci baza de date nu îi arată adminului ceilalți utilizatori.</p>
            )}
            <div className="mt-3 divide-y divide-line">
              {useri.map((u) => (
                <div key={u.id} className="py-2.5 flex items-center gap-3">
                  <span className="flex-1 min-w-0 truncate">{u.email}{u.nume ? <span className="text-mut"> · {u.nume}</span> : null}</span>
                  <select value={u.role} onChange={(e) => schimbaRol(u, e.target.value)} disabled={!eAdmin}
                    className="rounded-lg border-2 border-line px-2 py-1 text-xs bg-white disabled:opacity-50">
                    {ROLURI.map((r) => <option key={r.id} value={r.id}>{r.t}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <ul className="mt-3 space-y-0.5 text-[11px] text-mut">
              {ROLURI.map((r) => <li key={r.id}>• <b>{r.t}</b> — {r.d}</li>)}
            </ul>
          </div>
        </div>
      </div>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
