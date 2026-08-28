"use client";
// INTEGRĂRI — starea reală a fiecărei conexiuni + ce trebuie făcut ca s-o activezi.
import { useEffect, useState, useCallback } from "react";
import { sbBrowser, scrieVerificat } from "@/lib/supabase";
import { golesteCachePublic } from "@/lib/settings";

type Stare = { nume: string; grup: string; stare: "activ" | "pregatit" | "viitor"; desc: string; pasi: string[] };

const INTEGRARI: Stare[] = [
  { nume: "WhatsApp Business", grup: "Comunicare", stare: "activ",
    desc: "Buton plutitor pe tot site-ul + mesaje precompletate cu numele piesei și codul OEM. Din admin: buton direct pe fiecare comandă și cerere.",
    pasi: ["Schimbi numărul din Vercel → Settings → Environment Variables → NEXT_PUBLIC_WHATSAPP_PHONE (format 40722XXXXXX)"] },
  { nume: "Saga — facturare", grup: "Facturare", stare: "activ",
    desc: "Saga nu are API public; fluxul standard e importul de fișiere. Exportul CSV conține clientul, CUI-ul, produsele și prețurile defalcate bază + TVA 19%.",
    pasi: ["Admin → Facturi → alegi intervalul → Export Saga (CSV)", "În Saga: Operații → Import → alegi fișierul", "Notezi seria facturii înapoi în comandă"] },
  { nume: "FAN Courier (SelfAWB)", grup: "Curieri", stare: "pregatit",
    desc: "Butonul de generare AWB și ruta de server există; se activează la primirea contului de la FAN.",
    pasi: ["Clientul semnează contractul FAN și primește client ID, user, parolă (selfawb.ro)",
           "Adaugi în Vercel: FANCOURIER_CLIENT_ID, FANCOURIER_USER, FANCOURIER_PASS", "Ne anunți — activăm apelul API (10 minute)"] },
  { nume: "Plată cu cardul (Netopia / Stripe)", grup: "Plăți", stare: "viitor",
    desc: "Acum: ramburs și transfer bancar. Cardul online necesită contract cu procesatorul și verificare KYC.",
    pasi: ["Clientul deschide cont la procesator", "Primim cheile API", "Adăugăm pasul de plată în checkout"] },
  { nume: "e-Factura ANAF (SPV)", grup: "Facturare", stare: "viitor",
    desc: "Transmiterea în SPV se face din Saga, care are modulul e-Factura inclus. Nu dublăm funcția — evităm facturi transmise de două ori.",
    pasi: ["Se folosește modulul e-Factura din Saga", "Certificat digital pe firmă", "Statusul se notează în comandă"] },
  { nume: "Google Analytics 4", grup: "Analiză", stare: "pregatit",
    desc: "Codul e scris și așteaptă doar ID-ul. Cât timp câmpul de mai jos e gol, în site NU se încarcă niciun script și nu pleacă nicio cerere către Google. Evenimentele de comerț (vizualizare piesă, adăugare în coș, comandă) sunt deja legate. Măsurarea pornește doar pentru vizitatorii care apasă „Accept toate” în bannerul de cookie-uri; traficul din /admin nu se numără niciodată.",
    pasi: ["Cont GA4 → ID de măsurare (G-XXXXXXX)", "Îl lipești în câmpul de mai jos și salvezi — atât", "Verifici în GA4 → Rapoarte → Timp real că apari", "⚠ Înainte de a-l activa: Politica de cookies trebuie actualizată (vezi docs/google-analytics.md)"] },
];

const CULORI = { activ: ["bg-ok/10 text-ok border-ok/30", "Activ ✓"], pregatit: ["bg-yellow-50 text-yellow-700 border-yellow-200", "Pregătit — așteaptă cont"], viitor: ["bg-paper text-mut border-line", "Fază următoare"] } as const;

// câmpurile de configurare salvate în baza de date (settings → integrari)
const CAMPURI: Record<string, { k: string; l: string; tip?: string }[]> = {
  "WhatsApp Business": [{ k: "numar", l: "Număr WhatsApp (format 40722…)" }],
  "Saga — facturare": [{ k: "serie", l: "Seria facturilor (ex. AUTP)" }],
  "FAN Courier (SelfAWB)": [{ k: "client_id", l: "Client ID" }, { k: "user", l: "Utilizator" }, { k: "parola", l: "Parolă", tip: "password" }],
  "Plată cu cardul (Netopia / Stripe)": [{ k: "pos_id", l: "POS Signature / ID" }, { k: "signature", l: "Cheie privată", tip: "password" }],
  "Google Analytics 4": [{ k: "id", l: "ID de măsurare (G-XXXXXXX)" }],
};
const CHEI: Record<string, string> = {
  "WhatsApp Business": "whatsapp", "Saga — facturare": "saga", "FAN Courier (SelfAWB)": "fancourier",
  "Plată cu cardul (Netopia / Stripe)": "netopia", "Google Analytics 4": "ga4",
};

export default function Integrari() {
  const [env, setEnv] = useState<Record<string, boolean>>({});
  const [conf, setConf] = useState<Record<string, any>>({});
  const [msg, setMsg] = useState("");
  const [salvez, setSalvez] = useState<string | null>(null);

  const incarca = useCallback(async () => {
    const sb = sbBrowser(); if (!sb) return;
    const { data } = await sb.from("settings").select("valoare").eq("cheie", "integrari").single();
    setConf((data?.valoare as any) ?? {});
  }, []);
  useEffect(() => { fetch("/api/integrari").then((r) => r.json()).then(setEnv).catch(() => {}); incarca(); }, [incarca]);

  async function salveaza(cheie: string, valori: any) {
    const sb = sbBrowser()!; setMsg(""); setSalvez(cheie);
    const nou = { ...conf, [cheie]: valori };
    // Ca la Setări: un UPDATE oprit de RLS nu dă eroare, dă zero rânduri. Aici
    // conta dublu — credențialele de curier salvate „cu succes" în gol înseamnă
    // AWB-uri care nu se generează, descoperite abia la primul colet.
    const r = await scrieVerificat(sb.from("settings").update({ valoare: nou }).eq("cheie", "integrari"));
    setSalvez(null);
    if (!r.ok) { setMsg(`Nu s-a salvat: ${r.eroare}`); return; }
    // Aceeași regulă ca la Setări și la modul vacanță: după o salvare confirmată
    // se golește cache-ul paginilor publice. Google Analytics nu depinde de el —
    // își cere id-ul din browser, tocmai ca să nu rămână prins în HTML-ul static —
    // dar orice altă valoare de aici care ar ajunge vreodată pe site are nevoie.
    await golesteCachePublic();
    setConf(nou);
    setMsg("✓ Salvat.");
    incarca();
  }

  const grupuri = Array.from(new Set(INTEGRARI.map((i) => i.grup)));

  return (
    <div className="space-y-5">
      <div><div className="dim">Administrare</div><h1 className="font-disp font-bold text-2xl mt-1">Integrări</h1>
        <p className="text-sm text-mut mt-1">Starea reală a fiecărei conexiuni. Nimic nu e „pe jumătate": ce e activ funcționează, ce e pregătit așteaptă doar credențialele clientului.</p></div>

      {msg && <p className="text-sm">{msg}</p>}
      {grupuri.map((g) => (
        <div key={g}>
          <div className="dim mb-2">{g}</div>
          <div className="grid md:grid-cols-2 gap-3">
            {INTEGRARI.filter((i) => i.grup === g).map((i) => {
              const conectat = i.nume.includes("FAN") ? env.fan : undefined;
              const stare = conectat === true ? "activ" : i.stare;
              const [cls, txt] = CULORI[stare as keyof typeof CULORI];
              return (
                <div key={i.nume} className="card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <b className="font-disp text-base">{i.nume}</b>
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${cls} whitespace-nowrap`}>
                      {conectat === true ? "Conectat ✓" : txt}</span>
                  </div>
                  <p className="text-sm text-mut mt-2">{i.desc}</p>
                  <ol className="mt-3 space-y-1 text-xs text-steel">
                    {i.pasi.map((p, n) => <li key={n} className="flex gap-2"><span className="text-acc font-bold">{n + 1}.</span>{p}</li>)}
                  </ol>
                  {CAMPURI[i.nume] && (
                    <form onSubmit={(e) => { e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      const cheie = CHEI[i.nume];
                      const v: any = { ...(conf[cheie] ?? {}) };
                      CAMPURI[i.nume].forEach((c) => { v[c.k] = String(f.get(c.k) ?? ""); });
                      v.activ = f.get("activ") === "on";
                      salveaza(cheie, v); }}
                      className="mt-4 pt-3 border-t border-line grid gap-2 text-sm">
                      {CAMPURI[i.nume].map((c) => (
                        <div className="fld" key={c.k}><label>{c.l}</label>
                          <input name={c.k} type={c.tip ?? "text"} defaultValue={conf[CHEI[i.nume]]?.[c.k] ?? ""} /></div>
                      ))}
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input type="checkbox" name="activ" defaultChecked={conf[CHEI[i.nume]]?.activ ?? false} />
                        Activă (folosește această integrare)</label>
                      <button className="btn-dark !py-2 text-xs" disabled={salvez !== null}>
                        {salvez === CHEI[i.nume] ? "Se salvează…" : "Salvează configurarea"}</button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
