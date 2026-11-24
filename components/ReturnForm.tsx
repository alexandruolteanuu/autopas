"use client";
// FORMULARUL DE RETUR — fără cont, fără confirmare din partea echipei.
// Clientul scrie comanda, datele lui și adresa de ridicare; serverul
// (app/api/retur) generează AWB-ul de retur și comandă curierul, iar clientul
// primește totul pe e-mail. Adresa se alege din nomenclatorul FAN, ca la
// checkout — altfel FAN ar refuza localitatea.
import { useEffect, useState } from "react";
import AlegeAdresa, { type Adresa } from "@/components/AlegeAdresa";
// Aceleași reguli ca serverul (lib/retur.ts): lista de motive și cine plătește.
import { MOTIVE_RETUR as MOTIVE, plataDupaMotiv } from "@/lib/retur";
const plataFirma = (m: string) => plataDupaMotiv(m) === "firma";

/** „2026-11-26” -> „joi, 26 noiembrie” */
function ziua(d: string) {
  const [a, l, z] = d.split("-").map(Number);
  return new Intl.DateTimeFormat("ro-RO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
    .format(new Date(Date.UTC(a, l - 1, z)));
}
const lei = (n: number) => `${n.toFixed(2).replace(".", ",")} lei`;

type Rezultat = { awb: string | null; total?: number; plata?: "client" | "firma"; data_ridicare?: string;
  interval?: { first: string; second: string }; curier?: boolean; tracking?: string };

export default function ReturnForm() {
  const [stare, setStare] = useState<"idle" | "trimit" | "ok">("idle");
  const [eroare, setEroare] = useState("");
  const [rez, setRez] = useState<Rezultat | null>(null);
  const [adresa, setAdresa] = useState<Adresa>({ judet: "", localitate: "", strada: "", numar: "" });
  const [motiv, setMotiv] = useState("");
  const [zile, setZile] = useState<string[]>([]);
  const [interval, setInterval] = useState({ first: "09:00", second: "14:00" });
  // Câmpurile de colet apar doar dacă serverul nu le găsește în AWB-ul livrării.
  const [cereColet, setCereColet] = useState<{ greutate: boolean; dimensiuni: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/retur").then((r) => r.json()).then((j) => {
      if (j?.zile) setZile(j.zile);
      if (j?.interval) setInterval(j.interval);
    }).catch(() => {});
  }, []);

  async function trimite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setStare("trimit"); setEroare("");
    const g = (k: string) => String(f.get(k) ?? "");
    let j: any = null;
    try {
      const r = await fetch("/api/retur", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numar_comanda: g("numar_comanda"), nume: g("nume"), email: g("email"), telefon: g("telefon"),
          produs: g("produs"), motiv, iban: g("iban"), adresa, data_ridicare: g("data_ridicare"),
          colet: { greutate: g("greutate"), lungime: g("lungime"), latime: g("latime"), inaltime: g("inaltime") },
        }),
      });
      j = await r.json();
    } catch { /* rețea */ }
    if (!j) { setStare("idle"); setEroare("Nu ne-am putut conecta. Verifică internetul și încearcă din nou."); return; }
    if (!j.ok) {
      setStare("idle"); setEroare(j.eroare ?? "Cererea nu a putut fi trimisă.");
      if (j.cere_colet) setCereColet(j.cere_colet);
      return;
    }
    setRez(j); setStare("ok");
  }

  if (stare === "ok" && rez) {
    if (!rez.awb) return (
      <div className="card p-8 text-center">
        <b className="text-ok text-lg">✓ Cererea de retur a fost înregistrată</b>
        <p className="text-textSecundar text-sm mt-2">AWB-ul de retur nu s-a putut genera automat acum. Te sunăm noi
          ca să programăm ridicarea; confirmarea o primești pe e-mail.</p>
      </div>
    );
    return (
      <div className="card p-6 sm:p-8">
        <b className="text-ok text-lg">✓ Returul e programat</b>
        <dl className="mt-4 grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-textSecundar">AWB retur</dt><dd className="font-semibold">{rez.awb}</dd>
          {rez.data_ridicare && <>
            <dt className="text-textSecundar">Ridicare</dt>
            <dd>{ziua(rez.data_ridicare)}, {rez.interval?.first}–{rez.interval?.second}</dd>
          </>}
          <dt className="text-textSecundar">Transport</dt>
          <dd>{rez.plata === "firma"
            ? "îl plătim noi"
            : <>îl plătești curierului, cash, la ridicare{rez.total ? <>: <b>{lei(rez.total)}</b></> : null}</>}</dd>
        </dl>
        <p className="text-sm mt-4 leading-relaxed">
          {rez.curier
            ? "Curierul FAN Courier vine la adresa ta și aduce eticheta printată — n-ai nevoie de imprimantă. "
            : "Te sunăm noi ca să stabilim ora ridicării. "}
          Ambalează piesa bine și pune în colet o copie a facturii. Toate detaliile ți le-am trimis și pe e-mail.
        </p>
        {rez.tracking && <a href={rez.tracking} target="_blank" rel="noopener noreferrer"
          className="accentuat font-semibold text-sm inline-block mt-3">Urmărește coletul →</a>}
      </div>
    );
  }

  return (
    <form onSubmit={trimite} className="card p-5 grid sm:grid-cols-2 gap-3">
      <div className="fld"><label>Numărul comenzii * <span className="font-normal text-textSecundar">(ex. AP-2026-01847)</span></label><input name="numar_comanda" required /></div>
      <div className="fld"><label>Nume *</label><input name="nume" required autoComplete="name" /></div>
      <div className="fld"><label>E-mail * <span className="font-normal text-textSecundar">(aici primești AWB-ul)</span></label><input name="email" type="email" required inputMode="email" autoComplete="email" /></div>
      <div className="fld"><label>Telefon * <span className="font-normal text-textSecundar">(pentru curier)</span></label><input name="telefon" type="tel" required inputMode="numeric" autoComplete="tel" /></div>
      <div className="fld sm:col-span-2"><label>Piesa returnată *</label><input name="produs" required /></div>
      <div className="fld sm:col-span-2"><label>Motivul returului *</label>
        <select name="motiv" required value={motiv} onChange={(e) => setMotiv(e.target.value)}>
          <option value="">Alege…</option>
          {MOTIVE.map((m) => <option key={m}>{m}</option>)}
        </select>
        {motiv && <p className="text-xs text-textSecundar mt-1">
          {plataFirma(motiv)
            ? "Transportul returului îl plătim noi."
            : "Transportul returului îl plătești curierului, cash, la ridicare. Suma o vezi după trimitere și pe e-mail."}
        </p>}
      </div>

      {/* Adresa de ridicare — din nomenclatorul FAN, ca la checkout */}
      <div className="sm:col-span-2 mt-2">
        <b className="font-disp font-semibold text-[13px]">Adresa de la care ridică curierul piesa</b>
        <div className="mt-2"><AlegeAdresa value={adresa} onChange={setAdresa} /></div>
      </div>

      <div className="fld sm:col-span-2"><label>Ziua în care vine curierul *</label>
        <select name="data_ridicare" required>
          {zile.length === 0 && <option value="">Prima zi lucrătoare</option>}
          {zile.map((z) => <option key={z} value={z}>{ziua(z)}, {interval.first}–{interval.second}</option>)}
        </select></div>

      {cereColet && (
        <div className="sm:col-span-2 rounded-lg border border-chenar p-3 bg-suprafata2">
          <b className="text-sm">Mărimea coletului (aproximativ)</b>
          <p className="text-xs text-textSecundar mt-0.5">Curierul are nevoie de ea ca să știe ce ridică.</p>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {cereColet.greutate && <div className="fld"><label>Greutate (kg) *</label><input name="greutate" inputMode="decimal" required /></div>}
            {cereColet.dimensiuni && <>
              <div className="fld"><label>Lungime (cm) *</label><input name="lungime" inputMode="numeric" required /></div>
              <div className="fld"><label>Lățime (cm) *</label><input name="latime" inputMode="numeric" required /></div>
              <div className="fld"><label>Înălțime (cm) *</label><input name="inaltime" inputMode="numeric" required /></div>
            </>}
          </div>
        </div>
      )}

      <div className="fld sm:col-span-2"><label>IBAN pentru rambursare <span className="font-normal text-textSecundar">(dacă ai plătit ramburs)</span></label><input name="iban" placeholder="RO…" /></div>
      <button disabled={stare === "trimit"} className="btn-acc sm:col-span-2">
        {stare === "trimit" ? "Se programează returul…" : "Trimite cererea și programează curierul"}
      </button>
      {eroare && <p className="text-red-600 text-sm sm:col-span-2">{eroare}</p>}
    </form>
  );
}
