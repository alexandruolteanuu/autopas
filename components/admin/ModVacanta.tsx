"use client";
// ============================================================
// ADMIN → SETĂRI → MOD VACANȚĂ
//
// Comutatorul care oprește vânzarea pe site, fără să atingă catalogul.
// Ce se întâmplă în bază e explicat în supabase/mod-vacanta.sql; pe scurt:
// `products.publicat` NU se atinge niciodată, fiindcă la dezactivare n-am mai
// avea cum să știm care piesă era ascunsă din vacanță și care din alt motiv.
// ============================================================
import { useEffect, useState, useCallback } from "react";
import { sbBrowser, scrieVerificat } from "@/lib/supabase";
import { LIMITA_MESAJ_VACANTA, MESAJ_VACANTA_IMPLICIT, golesteCachePublic,
         type VacantaAdmin } from "@/lib/settings";

const GOL: VacantaAdmin = { activ: false, mesaj: "", data_activarii: null, activat_de: null };

const dataRo = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("ro-RO", { dateStyle: "long", timeStyle: "short" }) : "—";

export default function ModVacanta({ eAdmin }: { eAdmin: boolean }) {
  const [v, setV] = useState<VacantaAdmin>(GOL);
  const [mesaj, setMesaj] = useState("");
  const [salvez, setSalvez] = useState(false);
  const [nota, setNota] = useState("");
  const [gata, setGata] = useState(false);

  const incarca = useCallback(async () => {
    const sb = sbBrowser(); if (!sb) return;
    // Rândul întreg, nu funcția publică: aici avem nevoie și de „cine" și „când",
    // iar echipa are drept de citire pe `settings`.
    const { data } = await sb.from("settings").select("valoare").eq("cheie", "vacanta").maybeSingle();
    const d = { ...GOL, ...((data?.valoare as any) ?? {}) } as VacantaAdmin;
    setV(d); setMesaj(d.mesaj ?? ""); setGata(true);
  }, []);
  useEffect(() => { incarca(); }, [incarca]);

  async function scrie(activ: boolean, textul: string) {
    const sb = sbBrowser(); if (!sb) return;
    setSalvez(true); setNota("");
    const { data: u } = await sb.auth.getUser();
    const valoare: VacantaAdmin = {
      activ,
      mesaj: textul.replace(/\s+/g, " ").trim().slice(0, LIMITA_MESAJ_VACANTA),
      // Data și autorul se rescriu doar la ACTIVARE. La dezactivare rămân cele
      // vechi, ca să se poată vedea cât a ținut ultima pauză.
      data_activarii: activ ? new Date().toISOString() : v.data_activarii,
      activat_de: activ ? (u.user?.email ?? null) : v.activat_de,
    };
    // `scrieVerificat`, nu `error === null`: un UPDATE oprit de RLS întoarce zero
    // rânduri și NICIO eroare, deci varianta naivă ar scrie „✓ Salvat" peste o
    // operațiune care n-a atins nimic.
    const r = await scrieVerificat(sb.from("settings").update({ valoare }).eq("cheie", "vacanta"));
    if (r.ok) await golesteCachePublic();
    setSalvez(false);
    setNota(r.ok
      ? (activ ? "✓ Mod vacanță ACTIV — site-ul nu mai primește comenzi." : "✓ Dezactivat — piesele au revenit exact cum erau.")
      : `Nu s-a salvat: ${r.eroare}`);
    if (r.ok) incarca();
  }

  function comuta() {
    if (!v.activ) {
      // Confirmare explicită doar la ACTIVARE. Dezactivarea nu strică nimic,
      // deci n-are rost s-o îngreunăm.
      if (!confirm("Toate piesele vor dispărea de pe site și nu se vor putea plasa comenzi. Continui?")) return;
      scrie(true, mesaj);
    } else {
      scrie(false, mesaj);
    }
  }

  const previzualizare = (mesaj.replace(/\s+/g, " ").trim() || MESAJ_VACANTA_IMPLICIT);
  const ramase = LIMITA_MESAJ_VACANTA - mesaj.length;

  return (
    <div className={`card p-5 grid gap-3 text-sm ${v.activ ? "ring-2 ring-amber-400" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <b className="font-disp font-semibold text-[13px]">Mod vacanță</b>
          <p className="text-xs text-mut mt-0.5">
            Oprește vânzarea fără să atingă catalogul. Piesele își păstrează starea exactă
            și revin toate la dezactivare — nici una în plus, nici una în minus.
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold tracking-wide ${
          v.activ ? "bg-amber-400 text-black" : "bg-line text-mut"}`}>
          {v.activ ? "ACTIV" : "inactiv"}
        </span>
      </div>

      {!gata && <p className="text-mut text-xs">Se încarcă…</p>}

      {gata && (
        <>
          <div className="fld">
            <label>Mesajul afișat pe site</label>
            <textarea rows={2} value={mesaj} maxLength={LIMITA_MESAJ_VACANTA}
              onChange={(e) => setMesaj(e.target.value)}
              placeholder="În perioada 15–30 august suntem în concediu. Comenzile se reiau pe 31 august."
              className="w-full rounded-xl border-2 border-line px-3 py-2 outline-none focus:border-acc" />
            <span className={`text-xs ${ramase < 0 ? "text-red-600" : "text-mut"}`}>
              {ramase} caractere rămase din {LIMITA_MESAJ_VACANTA}
            </span>
          </div>

          {/* Previzualizarea barei de sus, cu aceleași culori ca pe site.
              Un singur rând, tăiat cu „…", exact ca acolo: plafonul de 52px pe
              telefon nu se negociază. */}
          <div>
            <span className="text-xs text-mut">Așa va arăta bara de sus a site-ului:</span>
            <div className="mt-1 rounded-lg overflow-hidden border border-line">
              <div className="bg-[#F2B705] text-[#101010] text-[12px] px-3 flex items-center gap-2 min-h-[44px]">
                <span aria-hidden="true" className="shrink-0 font-bold">●</span>
                <span className="font-semibold truncate">{previzualizare}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <button type="button" onClick={comuta} disabled={!eAdmin || salvez}
              className={`min-h-[44px] px-5 rounded-xl font-bold text-sm disabled:opacity-50 ${
                v.activ ? "bg-ink text-white" : "bg-amber-400 text-black"}`}>
              {salvez ? "Se salvează…" : v.activ ? "Dezactivează modul vacanță" : "Activează modul vacanță"}
            </button>
            {v.activ && (
              <button type="button" onClick={() => scrie(true, mesaj)} disabled={!eAdmin || salvez}
                className="min-h-[44px] px-4 rounded-xl border-2 border-line text-sm font-semibold disabled:opacity-50">
                Salvează doar mesajul
              </button>
            )}
          </div>

          {v.activ && (
            <p className="text-xs text-mut">
              Activ din <b>{dataRo(v.data_activarii)}</b>
              {v.activat_de ? <> · activat de <b>{v.activat_de}</b></> : null}
            </p>
          )}
          {!v.activ && v.data_activarii && (
            <p className="text-xs text-mut">Ultima activare: {dataRo(v.data_activarii)}</p>
          )}
          {!eAdmin && <p className="text-xs text-mut">Doar administratorul poate comuta modul vacanță.</p>}
          {nota && <p className="text-sm">{nota}</p>}
        </>
      )}
    </div>
  );
}
