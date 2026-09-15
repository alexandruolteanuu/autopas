"use client";
// ADRESA DIN NOMENCLATORUL FAN — județ, localitate, stradă, alese din liste.
//
// DE CE (15 septembrie 2026, cerut de proprietar)
// O localitate scrisă liber („Piatra Neamț", „Bistrița") nu e întotdeauna cea din
// nomenclatorul FAN, iar atunci AWB-ul și calculul de tarif pică. Alegând din
// lista lor (`fan_localitati`, `fan_strazi`, migrarea 44), adresa comenzii e din
// start una pe care FAN o acceptă.
//
// · Județul: listă. Se afișează cu diacritice („Neamț"), fiindcă așa îl caută
//   omul și așa îl completează automat browserul; spre FAN pleacă fără
//   (`faraDiacritice` din lib/fancourier.ts).
// · Localitatea: se tastează și se alege din listă; o localitate care nu e în
//   listă nu trece de validare — la FAN n-ar exista.
// · Strada: sugestii din nomenclatorul FAN, dar NU obligatorie și nici obligatoriu
//   din listă: nomenclatorul poate rămâne în urmă, iar la satele mici adresa e
//   doar un număr.
//
// Dacă nomenclatorul nu se poate citi (tabele goale, rețea), câmpurile devin
// text liber: o comandă pierdută costă mai mult decât o adresă de corectat.
import { useEffect, useMemo, useRef, useState } from "react";
import { sbBrowser, citesteTot } from "@/lib/supabase";
import { tipareCautare } from "@/lib/format";

export type Adresa = { judet: string; localitate: string; strada: string; numar: string };
type Localitate = { localitate: string; km_extra: number; are_strazi: boolean };

/** Județele cu diacritice. Cheia e forma din nomenclatorul FAN. */
const DIACRITICE: Record<string, string> = {
  Arges: "Argeș", Bacau: "Bacău", "Bistrita-Nasaud": "Bistrița-Năsăud", Botosani: "Botoșani", Braila: "Brăila",
  Brasov: "Brașov", Bucuresti: "București", Buzau: "Buzău", Calarasi: "Călărași", "Caras-Severin": "Caraș-Severin",
  Constanta: "Constanța", Dambovita: "Dâmbovița", Galati: "Galați", Ialomita: "Ialomița", Iasi: "Iași",
  Maramures: "Maramureș", Mehedinti: "Mehedinți", Mures: "Mureș", Neamt: "Neamț", Salaj: "Sălaj", Timis: "Timiș",
  Valcea: "Vâlcea",
};
export const numeJudet = (fan: string) => DIACRITICE[fan] ?? fan;

/** Cheia de comparație: fără diacritice, fără majuscule, cratima = spațiu. */
const cheie = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[-\s]+/g, " ").trim();

type Props = {
  value: Adresa;
  onChange: (a: Adresa) => void;
  /** Fără stradă/număr: calculatorul de transport are nevoie doar de localitate. */
  cuStrada?: boolean;
  /** „site" = câmpurile `.fld` ale checkout-ului; „admin" = câmpurile mici din panou. */
  stil?: "site" | "admin";
};

export default function AlegeAdresa({ value, onChange, cuStrada = true, stil = "site" }: Props) {
  const [judete, setJudete] = useState<string[] | null>(null);
  const [localitati, setLocalitati] = useState<Localitate[]>([]);
  const [strazi, setStrazi] = useState<{ id: number; nume: string }[]>([]);
  const [indisponibil, setIndisponibil] = useState(false);
  const [deschisLoc, setDeschisLoc] = useState(false);
  const [deschisStr, setDeschisStr] = useState(false);
  const [activ, setActiv] = useState(0);
  const refLoc = useRef<HTMLInputElement>(null);

  // Forma FAN a județului ales („Neamt"), oricum ar fi scris în `value`.
  const judetFan = useMemo(
    () => judete?.find((j) => cheie(j) === cheie(value.judet)) ?? "",
    [judete, value.judet],
  );
  const aleasa = localitati.find((l) => l.localitate === value.localitate);

  // ---- județele ----
  useEffect(() => {
    const sb = sbBrowser(); if (!sb) { setIndisponibil(true); return; }
    sb.from("fan_judete").select("judet").order("judet").then(({ data, error }) => {
      if (error || !data?.length) { setIndisponibil(true); return; }
      setJudete(data.map((d: { judet: string }) => d.judet));
    });
  }, []);

  // O valoare venită din afară („Neamț", „neamt") se aduce la forma afișată.
  useEffect(() => {
    if (judetFan && value.judet !== numeJudet(judetFan)) onChange({ ...value, judet: numeJudet(judetFan) });
  }, [judetFan]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- localitățile județului ----
  useEffect(() => {
    if (!judetFan) { setLocalitati([]); return; }
    const sb = sbBrowser(); if (!sb) return;
    let anulat = false;
    citesteTot<Localitate>(() => sb.from("fan_localitati").select("localitate,km_extra,are_strazi", { count: "exact" })
      .eq("judet", judetFan).order("localitate"), { eticheta: "localitățile" })
      .then((l) => {
        if (anulat) return;
        setLocalitati(l);
        // București are o singură localitate: se alege singură.
        if (l.length === 1 && value.localitate !== l[0].localitate) onChange({ ...value, judet: numeJudet(judetFan), localitate: l[0].localitate });
        // Localitatea venită din afară („Piatra Neamț") se potrivește pe forma FAN.
        else if (value.localitate && !l.some((x) => x.localitate === value.localitate)) {
          const gasita = l.filter((x) => cheie(x.localitate) === cheie(value.localitate));
          if (gasita.length === 1) onChange({ ...value, judet: numeJudet(judetFan), localitate: gasita[0].localitate });
        }
      })
      .catch(() => { if (!anulat) setIndisponibil(true); });
    return () => { anulat = true; };
  }, [judetFan]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- validarea localității: trebuie să fie din listă ----
  useEffect(() => {
    const el = refLoc.current; if (!el || indisponibil) return;
    el.setCustomValidity(value.localitate && !aleasa && localitati.length ? "Alege localitatea din listă." : "");
  }, [value.localitate, aleasa, localitati.length, indisponibil]);

  // ---- sugestiile de stradă ----
  useEffect(() => {
    if (!cuStrada || !aleasa?.are_strazi || value.strada.trim().length < 2) { setStrazi([]); return; }
    const sb = sbBrowser(); if (!sb) return;
    let anulat = false;
    const t = setTimeout(async () => {
      let q = sb.from("fan_strazi").select("id,strada,tip").eq("judet", judetFan).eq("localitate", aleasa.localitate);
      for (const tipar of tipareCautare(value.strada, 4)) q = q.filter("cautare", "imatch", tipar);
      const { data } = await q.order("strada").limit(12);
      if (!anulat) setStrazi((data ?? []).map((s: { id: number; strada: string; tip: string | null }) =>
        ({ id: s.id, nume: s.tip ? `${s.tip} ${s.strada}` : s.strada })));
    }, 200);
    return () => { anulat = true; clearTimeout(t); };
  }, [value.strada, aleasa, judetFan, cuStrada]);

  const potrivite = useMemo(() => {
    const k = cheie(value.localitate);
    if (!k) return localitati.slice(0, 60);
    const incep = localitati.filter((l) => cheie(l.localitate).startsWith(k));
    const contin = localitati.filter((l) => !cheie(l.localitate).startsWith(k) && cheie(l.localitate).includes(k));
    return [...incep, ...contin].slice(0, 60);
  }, [localitati, value.localitate]);

  // ---- așezarea, pe cele două stiluri ----
  const admin = stil === "admin";
  const cls = admin ? "w-full mt-0.5 rounded-lg border-2 border-line px-2.5 py-1.5 text-sm text-ink outline-none focus:border-acc" : "";
  // Funcție, NU componentă: o componentă definită aici ar fi alt tip la fiecare
  // randare, iar React ar recrea câmpul la fiecare literă — cursorul ar sări afară.
  const camp = (eticheta: string, continut: React.ReactNode, lat = false) => admin
    ? <label className={`relative block text-[11px] text-mut ${lat ? "col-span-2" : ""}`}>{eticheta}{continut}</label>
    : <div className={`fld relative ${lat ? "sm:col-span-2" : ""}`}><label>{eticheta}</label>{continut}</div>;
  const lista = admin
    ? "absolute z-30 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-lg border-2 border-line bg-white shadow-card text-sm text-ink"
    : "absolute z-30 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-lg border border-chenar bg-suprafata shadow-card text-[15px] text-text";
  const rand = (sel: boolean) => `block w-full text-left px-3 py-2 min-h-[40px] ${sel ? (admin ? "bg-paper" : "bg-suprafata2") : ""}`;

  if (indisponibil) {
    return (<>
      {camp("Județ *", <><input required value={value.judet} onChange={(e) => onChange({ ...value, judet: e.target.value })} autoComplete="address-level1" className={cls} /></>)}
      {camp("Localitate *", <><input required value={value.localitate} onChange={(e) => onChange({ ...value, localitate: e.target.value })} autoComplete="address-level2" className={cls} /></>)}
      {cuStrada && camp("Adresa (stradă, număr, bloc, ap.) *", <><input required value={value.strada} onChange={(e) => onChange({ ...value, strada: e.target.value, numar: "" })} autoComplete="address-line1" className={cls} /></>, true)}
    </>);
  }

  const alege = (l: Localitate) => { onChange({ ...value, localitate: l.localitate, strada: value.localitate === l.localitate ? value.strada : "" }); setDeschisLoc(false); };

  return (<>
    {camp("Județ *", <>
      <select required value={judetFan} disabled={!judete} autoComplete="address-level1" className={cls}
        onChange={(e) => onChange({ judet: numeJudet(e.target.value), localitate: "", strada: "", numar: value.numar })}>
        <option value="">{judete ? "Alege județul" : "Se încarcă…"}</option>
        {(judete ?? []).map((j) => <option key={j} value={j}>{numeJudet(j)}</option>)}
      </select>
    </>)}

    {camp("Localitate *", <>
      <input ref={refLoc} required value={value.localitate} disabled={!judetFan} autoComplete="address-level2"
        placeholder={judetFan ? "Scrie și alege din listă" : "Alege întâi județul"} className={cls}
        role="combobox" aria-expanded={deschisLoc} aria-autocomplete="list"
        onFocus={() => { setDeschisLoc(true); setActiv(0); }}
        onBlur={() => setTimeout(() => {
          setDeschisLoc(false);
          // Scris complet, dar neales din listă: dacă o singură localitate se
          // potrivește exact (fără diacritice/cratime), se alege ea.
          if (!aleasa) { const g = localitati.filter((l) => cheie(l.localitate) === cheie(value.localitate)); if (g.length === 1) alege(g[0]); }
        }, 150)}
        onChange={(e) => { onChange({ ...value, localitate: e.target.value, strada: "" }); setDeschisLoc(true); setActiv(0); }}
        onKeyDown={(e) => {
          if (!deschisLoc || !potrivite.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActiv((a) => Math.min(a + 1, potrivite.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActiv((a) => Math.max(a - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); alege(potrivite[activ]); }
          else if (e.key === "Escape") setDeschisLoc(false);
        }} />
      {deschisLoc && judetFan && !aleasa && potrivite.length > 0 && (
        <div role="listbox" className={lista}>
          {potrivite.map((l, i) => (
            <button type="button" key={l.localitate} role="option" aria-selected={i === activ} className={rand(i === activ)}
              onMouseDown={(e) => { e.preventDefault(); alege(l); }}>{l.localitate}</button>
          ))}
        </div>
      )}
      {value.localitate && !aleasa && localitati.length > 0 && !deschisLoc && (
        <span className={admin ? "block text-[11px] text-red-600 mt-0.5" : "eroare-camp"}>Alege localitatea din listă.</span>
      )}
    </>)}

    {cuStrada && (<>
      {/* Strada NU e obligatorie: FAN are nomenclator pentru 13.827 din 13.833 de
          localități, dar la satele mici e doar „Strada Principala" de umplutură,
          iar adresa reală e „nr. 181". Numărul rămâne obligatoriu. */}
      {camp("Strada", <>
        <input value={value.strada} autoComplete="address-line1" className={cls}
          placeholder="Scrie numele străzii (dacă are)"
          onFocus={() => setDeschisStr(true)} onBlur={() => setTimeout(() => setDeschisStr(false), 150)}
          onChange={(e) => { onChange({ ...value, strada: e.target.value }); setDeschisStr(true); }} />
        {deschisStr && strazi.length > 0 && (
          <div role="listbox" className={lista}>
            {strazi.map((s) => (
              <button type="button" key={s.id} role="option" aria-selected={false} className={rand(false)}
                onMouseDown={(e) => { e.preventDefault(); onChange({ ...value, strada: s.nume }); setDeschisStr(false); }}>{s.nume}</button>
            ))}
          </div>
        )}
      </>)}
      {camp("Număr, bloc, scară, apartament *", <>
        <input required value={value.numar} autoComplete="address-line2" placeholder="ex. nr. 12, bl. A3, ap. 5" className={cls}
          onChange={(e) => onChange({ ...value, numar: e.target.value })} />
      </>)}
    </>)}
  </>);
}

/** Adresa, într-un singur rând, cum se salvează în `orders.adresa`. */
export const adresaText = (a: Adresa) => [a.strada.trim(), a.numar.trim()].filter(Boolean).join(", ");
