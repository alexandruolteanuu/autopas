"use client";
// RETUR — FAN COURIER: AWB-ul de ridicare de la client, într-un singur panou.
//
// Pașii, în ordinea în care îi face omul:
//   1. deschide panoul — adresa vine singură din comanda la care se referă
//      cererea (formularul de retur NU cere adresa) și se poate corecta;
//   2. scrie coletele, kilogramele și dimensiunile, pe care le află de la client
//      la telefon -> „Cât costă” -> vede tariful FAN defalcat;
//   3. „Generează AWB de retur” -> se plasează automat și comanda de curier,
//      pentru ziua aleasă. Curierul aduce eticheta printată, fiindcă clientul
//      n-are de ce să aibă imprimantă.
//
// Panoul NU cheamă FAN la deschidere: se cere doar ce știe baza noastră. API-ul
// lor e chemat numai la apăsarea unui buton.
import { useCallback, useEffect, useState } from "react";
import { sbBrowser } from "@/lib/supabase";
import AlegeAdresa from "@/components/AlegeAdresa";

type Tarif = { greutate: number; kmSuplimentari: number; combustibil: number; optiuni: number;
  asigurare: number; faraTva: number; tva: number; total: number; serviciu: string };
type Adresa = { nume: string; telefon: string; judet: string; localitate: string; strada: string };
type Colet = { colete: string; greutate: string; lungime: string; latime: string; inaltime: string };

const camp = "w-full mt-0.5 rounded-lg border-2 border-line px-2.5 py-1.5 text-sm text-ink outline-none focus:border-acc";
const bani = (n: number) => `${n.toFixed(2).replace(".", ",")} lei`;

async function cere(corp: object) {
  const sb = sbBrowser();
  const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
  if (!token) return { ok: false, eroare: "Sesiunea a expirat. Autentifică-te din nou." };
  const r = await fetch("/api/awb-retur", { method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(corp) });
  return r.json().catch(() => ({ ok: false, eroare: `Serverul a răspuns cu ${r.status}.` }));
}

export default function AwbReturFan({ cerere, onSchimbare }: {
  cerere: { id: number; numar_comanda: string; nume: string; telefon: string | null;
            awb?: string | null; awb_curier_id?: string | null; awb_date?: any };
  onSchimbare?: () => void;
}) {
  const [deschis, setDeschis] = useState(false);
  const [gata, setGata] = useState(false);
  const [configurat, setConfigurat] = useState(true);
  const [adresa, setAdresa] = useState<Adresa>({ nume: "", telefon: "", judet: "", localitate: "", strada: "" });
  const [comanda, setComanda] = useState<{ numar: string } | null>(null);
  const [colet, setColet] = useState<Colet>({ colete: "1", greutate: "", lungime: "", latime: "", inaltime: "" });
  const [dataRidicare, setDataRidicare] = useState("");
  const [interval, setInterval] = useState({ first: "09:00", second: "14:00" });
  const [tarif, setTarif] = useState<Tarif | null>(null);
  const [awb, setAwb] = useState<string | null>(cerere.awb ?? null);
  const [curierId, setCurierId] = useState<string | null>(cerere.awb_curier_id ?? null);
  const [lucru, setLucru] = useState("");
  const [msg, setMsg] = useState<{ t: "ok" | "rau"; x: string } | null>(null);
  const [poateDoarAdmin, setPoateDoarAdmin] = useState(false);

  const pregateste = useCallback(async () => {
    const r = await cere({ actiune: "pregateste", cerere_id: cerere.id });
    if (!r.ok) { setMsg({ t: "rau", x: r.eroare }); setGata(true); return; }
    setConfigurat(r.configurat);
    setAdresa(r.adresa);
    setComanda(r.comanda);
    setAwb(r.awb);
    setCurierId(r.awb_curier_id);
    setInterval(r.interval);
    setDataRidicare((d) => d || r.azi);
    // La un AWB deja generat, câmpurile arată ce s-a declarat atunci.
    if (r.awb_date) {
      const d = r.awb_date;
      setColet({ colete: String(d.colete ?? 1), greutate: String(d.greutate ?? ""),
        lungime: String(d.lungime ?? ""), latime: String(d.latime ?? ""), inaltime: String(d.inaltime ?? "") });
    }
    setGata(true);
  }, [cerere.id]);

  useEffect(() => { if (deschis && !gata) pregateste(); }, [deschis, gata, pregateste]);

  const f = (k: keyof Colet) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setColet({ ...colet, [k]: e.target.value });
    setTarif(null);   // orice schimbare de colet face tariful vechi mincinos
  };
  const schimbaAdresa = (k: keyof Adresa, v: string) => { setAdresa({ ...adresa, [k]: v }); setTarif(null); };

  async function calculeaza() {
    setLucru("tarif"); setMsg(null);
    const r = await cere({ actiune: "tarif", cerere_id: cerere.id, colet, adresa });
    setLucru("");
    if (!r.ok) { setTarif(null); setMsg({ t: "rau", x: r.eroare }); return; }
    setTarif(r.tarif);
  }

  async function salveazaAdresa() {
    setLucru("adresa"); setMsg(null);
    const r = await cere({ actiune: "salveaza_adresa", cerere_id: cerere.id, adresa });
    setLucru("");
    setMsg(r.ok ? { t: "ok", x: "Adresa de ridicare s-a salvat." } : { t: "rau", x: r.eroare });
    if (r.ok) onSchimbare?.();
  }

  async function genereaza() {
    if (!confirm(`Generezi AWB-ul de retur și comanzi curierul pentru ${dataRidicare}?\n\nCurierul merge la ${adresa.localitate}, jud. ${adresa.judet}, între ${interval.first} și ${interval.second}.`)) return;
    setLucru("awb"); setMsg(null); setPoateDoarAdmin(false);
    const r = await cere({ actiune: "genereaza", cerere_id: cerere.id, colet, adresa, data_ridicare: dataRidicare });
    setLucru("");
    if (!r.ok) {
      // AWB-ul poate exista la FAN chiar dacă salvarea a picat — îl arătăm.
      if (r.awb) setAwb(r.awb);
      setMsg({ t: "rau", x: r.eroare });
      return;
    }
    setAwb(r.awb); setCurierId(r.comanda_curier);
    setMsg({ t: r.eroare_curier ? "rau" : "ok",
      x: r.eroare_curier
        ? `AWB ${r.awb} generat, DAR curierul nu s-a comandat: ${r.eroare_curier} Comandă ridicarea din selfawb.ro, altfel nu vine nimeni la client.`
        : `AWB ${r.awb} generat, curierul comandat pentru ${dataRidicare} (${interval.first}–${interval.second}).` });
    onSchimbare?.();
  }

  async function sterge(doarAdmin = false) {
    if (!confirm(doarAdmin
      ? "Scoți AWB-ul doar din admin? La FAN rămâne — anuleaz-l tu din selfawb.ro."
      : "Ștergi AWB-ul de retur la FAN și anulezi comanda de curier?")) return;
    setLucru("sterge"); setMsg(null);
    const r = await cere({ actiune: "sterge", cerere_id: cerere.id, doar_admin: doarAdmin });
    setLucru("");
    if (!r.ok) { setMsg({ t: "rau", x: r.eroare }); setPoateDoarAdmin(!!r.poate_doar_admin); return; }
    setAwb(null); setCurierId(null); setTarif(null); setPoateDoarAdmin(false);
    setMsg({ t: "ok", x: `AWB-ul de retur a fost scos.${r.nota ? ` ${r.nota}` : ""}` });
    onSchimbare?.();
  }

  async function eticheta() {
    const sb = sbBrowser();
    const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
    if (!token) { setMsg({ t: "rau", x: "Sesiunea a expirat." }); return; }
    setLucru("eticheta");
    const r = await fetch(`/api/awb-retur?cerere_id=${cerere.id}`, { headers: { Authorization: `Bearer ${token}` } });
    setLucru("");
    if (!r.ok) { setMsg({ t: "rau", x: (await r.json().catch(() => null))?.eroare ?? "Eticheta n-a putut fi luată." }); return; }
    window.open(URL.createObjectURL(await r.blob()), "_blank");
  }

  if (!deschis)
    return (
      <button type="button" onClick={() => setDeschis(true)}
        className="rounded-lg border-2 border-line px-3 py-1.5 text-xs font-semibold hover:border-acc">
        {awb ? `AWB retur ${awb}` : "AWB de retur (FAN)"}
      </button>
    );

  return (
    <div className="mt-3 rounded-xl border-2 border-line p-3.5 text-sm">
      <div className="flex items-center justify-between gap-2">
        <b className="text-[13px]">Retur prin FAN Courier{comanda ? ` · comanda ${comanda.numar}` : ""}</b>
        <button type="button" onClick={() => setDeschis(false)} className="text-xs text-mut hover:text-ink">Închide</button>
      </div>

      {!gata && <p className="mt-2 text-xs text-mut">Se încarcă…</p>}

      {gata && !configurat && (
        <p className="mt-2 rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2 text-xs text-yellow-800">
          Contul FAN de retur nu e configurat încă. E un cont selfAWB <b>ocazional</b>, diferit de cel
          de livrare — se completează în Admin → Integrări, după ce FAN îl creează și trimite Client
          ID-ul și valoarea pentru „payment”.
        </p>
      )}

      {gata && !comanda && (
        <p className="mt-2 rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2 text-xs text-yellow-800">
          N-am găsit comanda <b>{cerere.numar_comanda}</b> (așa a scris-o clientul), deci adresa nu s-a
          putut completa singură. Scrie-o mai jos.
        </p>
      )}

      {gata && (<>
        {/* ---------- adresa de la care se ridică ---------- */}
        <div className="mt-3">
          <div className="text-[11px] font-semibold text-mut uppercase tracking-wide">De unde se ridică</div>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <label className="text-[11px] text-mut">Nume client
              <input value={adresa.nume} onChange={(e) => schimbaAdresa("nume", e.target.value)} className={camp} /></label>
            <label className="text-[11px] text-mut">Telefon
              <input value={adresa.telefon} onChange={(e) => schimbaAdresa("telefon", e.target.value)} className={camp} /></label>
          </div>
          {/* Aceeași componentă ca la checkout și la adresa comenzii: județul și
              localitatea trebuie să existe în nomenclatorul FAN, altfel AWB-ul e refuzat. */}
          <div className="mt-2">
            <AlegeAdresa stil="admin" cuStrada={false}
              value={{ judet: adresa.judet, localitate: adresa.localitate, strada: "", numar: "" }}
              onChange={(a) => { setAdresa((v) => ({ ...v, judet: a.judet, localitate: a.localitate })); setTarif(null); }} />
          </div>
          <label className="mt-2 block text-[11px] text-mut">Strada, număr, bloc
            <input value={adresa.strada} onChange={(e) => schimbaAdresa("strada", e.target.value)} className={camp} /></label>
          <button type="button" onClick={salveazaAdresa} disabled={!!lucru}
            className="mt-2 rounded-lg border-2 border-line px-3 py-1.5 text-xs font-semibold hover:border-acc">
            {lucru === "adresa" ? "Se salvează…" : "Salvează adresa"}
          </button>
        </div>

        {/* ---------- coletul ---------- */}
        <div className="mt-4">
          <div className="text-[11px] font-semibold text-mut uppercase tracking-wide">Coletul returnat</div>
          <p className="mt-1 text-[11px] text-mut">
            Întreabă clientul la telefon. Dimensiunile sunt <b>obligatorii</b> la retur: FAN le cere
            la comanda de curier.
          </p>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <label className="text-[11px] text-mut">Colete
              <input type="number" min={1} step={1} value={colet.colete} onChange={f("colete")} className={camp} /></label>
            <label className="text-[11px] text-mut">Greutate (kg)
              <input inputMode="decimal" value={colet.greutate} onChange={f("greutate")} placeholder="ex. 4.5" className={camp} /></label>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <label className="text-[11px] text-mut">Lungime (cm)
              <input inputMode="numeric" value={colet.lungime} onChange={f("lungime")} className={camp} /></label>
            <label className="text-[11px] text-mut">Lățime (cm)
              <input inputMode="numeric" value={colet.latime} onChange={f("latime")} className={camp} /></label>
            <label className="text-[11px] text-mut">Înălțime (cm)
              <input inputMode="numeric" value={colet.inaltime} onChange={f("inaltime")} className={camp} /></label>
          </div>
        </div>

        {/* ---------- tariful ---------- */}
        {!awb && (
          <div className="mt-3">
            <button type="button" onClick={calculeaza} disabled={!!lucru || !configurat}
              className="btn-acc w-full !py-2 text-sm">
              {lucru === "tarif" ? "Se calculează la FAN…" : "Cât costă returul"}
            </button>
            {tarif && (
              <div className="mt-2 rounded-lg bg-paper border border-line px-3 py-2 text-xs space-y-0.5">
                <div className="flex justify-between"><span>Greutate</span><b>{bani(tarif.greutate)}</b></div>
                {tarif.kmSuplimentari > 0 &&
                  <div className="flex justify-between"><span>Km suplimentari</span><b>{bani(tarif.kmSuplimentari)}</b></div>}
                <div className="flex justify-between"><span>Combustibil</span><b>{bani(tarif.combustibil)}</b></div>
                <div className="flex justify-between"><span>TVA</span><b>{bani(tarif.tva)}</b></div>
                <div className="flex justify-between border-t border-line pt-1 mt-1 text-sm">
                  <b>Total retur</b><b>{bani(tarif.total)}</b></div>
                <p className="text-mut pt-1">
                  Cine suportă costul ăsta ține de motivul returului: la retragerea în 14 zile îl
                  plătește clientul (politica de retur), la o piesă neconformă îl suportăm noi.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ---------- generarea ---------- */}
        {!awb ? (
          <div className="mt-3 border-t border-line pt-3">
            <label className="text-[11px] text-mut block">Ziua în care vine curierul la client
              <input type="date" value={dataRidicare} onChange={(e) => setDataRidicare(e.target.value)} className={camp} /></label>
            <p className="mt-1 text-[11px] text-mut">
              Interval {interval.first}–{interval.second} — singura fereastră validă oriunde în țară.
              Curierul aduce eticheta printată, clientul n-are nevoie de imprimantă.
            </p>
            <button type="button" onClick={genereaza} disabled={!!lucru || !configurat}
              className="btn-acc w-full !py-2.5 text-sm mt-2">
              {lucru === "awb" ? "Se generează la FAN…" : "Generează AWB de retur + comandă curierul"}
            </button>
          </div>
        ) : (
          <div className="mt-3 border-t border-line pt-3 space-y-2">
            <div className="rounded-lg bg-ok/10 border border-ok/30 px-3 py-2 text-xs">
              <b>AWB retur {awb}</b>
              {curierId
                ? <span className="block text-mut">Curier comandat · comanda {curierId}</span>
                : <span className="block text-red-700">Fără comandă de curier — nimeni nu vine la client. Comand-o din selfawb.ro.</span>}
              {cerere.awb_date?.data_ridicare &&
                <span className="block text-mut">Ridicare {cerere.awb_date.data_ridicare}</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={eticheta} disabled={!!lucru}
                className="btn-acc !py-2 text-xs">{lucru === "eticheta" ? "Se ia…" : "Eticheta PDF"}</button>
              <a href={`https://www.fancourier.ro/awb-tracking/?tracking=${awb}`} target="_blank" rel="noopener noreferrer"
                className="rounded-lg border-2 border-line px-3 py-1.5 text-xs font-semibold hover:border-acc">Urmărește</a>
              <button type="button" onClick={() => sterge(false)} disabled={!!lucru}
                className="rounded-lg border-2 border-line px-3 py-1.5 text-xs font-semibold text-red-700 hover:border-red-300">
                {lucru === "sterge" ? "Se șterge…" : "Șterge AWB-ul"}
              </button>
              {poateDoarAdmin && (
                <button type="button" onClick={() => sterge(true)} disabled={!!lucru}
                  className="rounded-lg border-2 border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700">
                  Scoate AWB-ul doar din admin
                </button>
              )}
            </div>
          </div>
        )}

        {msg && (
          <p className={`mt-3 rounded-lg px-3 py-2 text-xs ${msg.t === "ok" ? "bg-ok/10 text-ok" : "bg-red-50 text-red-700"}`}>
            {msg.x}
          </p>
        )}
      </>)}
    </div>
  );
}
