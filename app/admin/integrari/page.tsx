"use client";
// INTEGRĂRI — starea reală a fiecărei conexiuni + ce trebuie făcut ca s-o activezi.
import { useEffect, useState, useCallback } from "react";
import { sbBrowser } from "@/lib/supabase";

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
  { nume: "Sameday", grup: "Curieri", stare: "pregatit",
    desc: "Identic cu FAN: infrastructura e gata, lipsesc doar credențialele.",
    pasi: ["Contract Sameday → user + parolă API", "Adaugi în Vercel: SAMEDAY_USER, SAMEDAY_PASS", "Ne anunți — activăm"] },
  { nume: "Plată cu cardul (Netopia / Stripe)", grup: "Plăți", stare: "viitor",
    desc: "Acum: ramburs și transfer bancar. Cardul online necesită contract cu procesatorul și verificare KYC.",
    pasi: ["Clientul deschide cont la procesator", "Primim cheile API", "Adăugăm pasul de plată în checkout"] },
  { nume: "e-Factura ANAF (SPV)", grup: "Facturare", stare: "viitor",
    desc: "Transmiterea în SPV se face din Saga, care are modulul e-Factura inclus. Nu dublăm funcția — evităm facturi transmise de două ori.",
    pasi: ["Se folosește modulul e-Factura din Saga", "Certificat digital pe firmă", "Statusul se notează în comandă"] },
  { nume: "Google Analytics 4", grup: "Analiză", stare: "viitor",
    desc: "Măsurarea traficului și a conversiilor. Se activează după acceptul pentru cookie-uri de statistică (bannerul e deja funcțional).",
    pasi: ["Cont GA4 → ID de măsurare (G-XXXXXXX)", "Îl adaugi în Vercel ca NEXT_PUBLIC_GA_ID", "Ne anunți — legăm evenimentele de e-commerce"] },
];

const CULORI = { activ: ["bg-ok/10 text-ok border-ok/30", "Activ ✓"], pregatit: ["bg-yellow-50 text-yellow-700 border-yellow-200", "Pregătit — așteaptă cont"], viitor: ["bg-paper text-mut border-line", "Fază următoare"] } as const;

// câmpurile de configurare salvate în baza de date (settings → integrari)
const CAMPURI: Record<string, { k: string; l: string; tip?: string }[]> = {
  "WhatsApp Business": [{ k: "numar", l: "Număr WhatsApp (format 40722…)" }],
  "Saga — facturare": [{ k: "serie", l: "Seria facturilor (ex. AUTP)" }],
  "FAN Courier (SelfAWB)": [{ k: "client_id", l: "Client ID" }, { k: "user", l: "Utilizator" }, { k: "parola", l: "Parolă", tip: "password" }],
  "Sameday": [{ k: "user", l: "Utilizator" }, { k: "parola", l: "Parolă", tip: "password" }],
  "Plată cu cardul (Netopia / Stripe)": [{ k: "pos_id", l: "POS Signature / ID" }, { k: "signature", l: "Cheie privată", tip: "password" }],
  "Google Analytics 4": [{ k: "id", l: "ID de măsurare (G-XXXXXXX)" }],
};
const CHEI: Record<string, string> = {
  "WhatsApp Business": "whatsapp", "Saga — facturare": "saga", "FAN Courier (SelfAWB)": "fancourier",
  "Sameday": "sameday", "Plată cu cardul (Netopia / Stripe)": "netopia", "Google Analytics 4": "ga4",
};

export default function Integrari() {
  const [env, setEnv] = useState<Record<string, boolean>>({});
  const [conf, setConf] = useState<Record<string, any>>({});
  const [msg, setMsg] = useState("");

  const incarca = useCallback(async () => {
    const sb = sbBrowser(); if (!sb) return;
    const { data } = await sb.from("settings").select("valoare").eq("cheie", "integrari").single();
    setConf((data?.valoare as any) ?? {});
  }, []);
  useEffect(() => { fetch("/api/integrari").then((r) => r.json()).then(setEnv).catch(() => {}); incarca(); }, [incarca]);

  async function salveaza(cheie: string, valori: any) {
    const sb = sbBrowser()!; setMsg("");
    const nou = { ...conf, [cheie]: valori };
    const { error } = await sb.from("settings").update({ valoare: nou }).eq("cheie", "integrari");
    setConf(nou);
    setMsg(error ? "Eroare: " + error.message + " (doar administratorul poate salva)" : "✓ Salvat.");
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
              const conectat = i.nume.includes("FAN") ? env.fan : i.nume.includes("Sameday") ? env.sameday : undefined;
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
                      <button className="btn-dark !py-2 text-xs">Salvează configurarea</button>
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
