"use client";
// ============================================================
// ECRANUL DE POTRIVIRI — puntea dintre catalogul nostru și cel de pe dez.ro.
//
// Se arată DOAR ce are nevoie de om: rândurile fără mapare și cele potrivite
// automat cu scor mic. Cele 373 de modele identice la literă n-au ce căuta aici;
// într-o listă de 543 de rânduri, cele 20 care contează s-ar pierde.
//
// Fiecare salvare scrie `sursa = 'om'`, iar potrivirea automată nu mai calcă
// niciodată peste ea. De asta butonul „Nu are corespondent" e o alegere, nu o
// lipsă: scrie explicit „am hotărât că nu există", iar rândul dispare din listă.
// ============================================================
import { memo, useCallback, useEffect, useState } from "react";

type Rand = {
  local_id: number;
  nume: string;
  context: string;
  curent: number | null;
  curentNume: string;
  sursa: string | null;
  scor: number | null;
  candidati: { dezro_id: number; nume: string; scor: number }[];
  toate?: { dezro_id: number; nume: string }[];
};

type Fel = "categorie" | "model" | "marca";

const ETICHETE: Record<Fel, string> = {
  categorie: "Categorii",
  model: "Modele",
  marca: "Mărci",
};

/**
 * `memo` NU e o optimizare de rutină aici (7 septembrie 2026, semnalat de
 * avertizarea INP din Chrome: 221ms de interfață blocată la un clic).
 *
 * Tabelul are un `select` pe rând, iar lista de categorii de la ei are 557 de
 * intrări: 63 de rânduri de confirmat înseamnă ~35.000 de elemente `<option>`.
 * Bucla de reîmprospătare a stării anunțurilor cheamă `setMsg` la fiecare pagină
 * citită, deci pagina se redesena de zeci de ori — și cu ea tot tabelul ăsta,
 * care n-are nicio legătură cu ce se schimbase.
 *
 * Funcționează pentru că amândouă props-urile vin din `useCallback` stabile.
 * Dacă cineva le trece vreodată ca funcții create în render, memo-ul devine
 * inutil fără să dea vreun semn.
 */
const DezroPotriviri = memo(function DezroPotriviri({
  cere,
  laSalvare,
}: {
  cere: (corp: any) => Promise<any>;
  laSalvare?: () => void;
}) {
  const [fel, setFel] = useState<Fel>("categorie");
  const [randuri, setRanduri] = useState<Rand[]>([]);
  const [alegeri, setAlegeri] = useState<{ dezro_id: number; nume: string }[]>([]);
  const [toate, setToate] = useState(false);
  const [incarc, setIncarc] = useState(false);
  const [msg, setMsg] = useState("");
  const [salvez, setSalvez] = useState<number | null>(null);
  const [q, setQ] = useState("");

  const incarca = useCallback(async () => {
    setIncarc(true); setMsg("");
    const d = await cere({ actiune: "propuneri", fel, toate });
    setIncarc(false);
    if (!d.ok) { setMsg(d.eroare ?? "Nu s-au putut citi propunerile."); return; }
    setRanduri(d.randuri ?? []);
    setAlegeri(d.alegeri ?? []);
  }, [cere, fel, toate]);

  useEffect(() => { incarca(); }, [incarca]);

  // `useCallback` aici e ce face `memo`-ul de pe rând să funcționeze cu adevărat.
  // Cu o funcție creată la fiecare randare, fiecare literă scrisă în căutare ar
  // fi redesenat toate rândurile, cu tot cu `select`-urile lor.
  const salveaza = useCallback(async (rand: Rand, dezroId: number | null) => {
    setSalvez(rand.local_id);
    const d = await cere({ actiune: "salveaza-mapare", fel, local_id: rand.local_id, dezro_id: dezroId });
    setSalvez(null);
    if (!d.ok) { setMsg(d.eroare ?? "Nu s-a salvat."); return; }
    // Rândul dispare din listă: e rezolvat. Dacă e nevoie să fie revăzut, se
    // apasă „Arată-le pe toate".
    setRanduri((v) => v.filter((x) => x.local_id !== rand.local_id));
    laSalvare?.();
  }, [cere, fel, laSalvare]);

  const cautat = q.trim().toLowerCase();
  const vizibile = cautat
    ? randuri.filter((r) => `${r.nume} ${r.context}`.toLowerCase().includes(cautat))
    : randuri;

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <b className="font-disp text-base">Potriviri de confirmat</b>
          <p className="text-sm text-mut mt-1">
            Cât timp un rând de aici n-are corespondent, piesele lui nu se pot publica pe dez.ro.
            Ce confirmi aici rămâne confirmat: potrivirea automată nu mai schimbă niciodată o alegere făcută de om.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs cursor-pointer whitespace-nowrap">
          <input type="checkbox" checked={toate} onChange={(e) => setToate(e.target.checked)} />
          Arată-le pe toate
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {(Object.keys(ETICHETE) as Fel[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFel(f)}
            className={`rounded-xl border-2 px-3 py-2 text-xs font-semibold ${
              fel === f ? "border-acc bg-acc/10" : "border-line hover:border-acc"
            }`}
          >
            {ETICHETE[f]}
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Caută în listă…"
          className="flex-1 min-w-[180px] rounded-xl border-2 border-line px-3 py-2 text-sm"
        />
      </div>

      {msg && <p className="text-sm text-red-600 mt-3">{msg}</p>}

      {incarc ? (
        <p className="text-sm text-mut mt-4">Se încarcă…</p>
      ) : vizibile.length === 0 ? (
        <p className="text-sm text-ok mt-4">
          ✓ Nimic de confirmat la {ETICHETE[fel].toLowerCase()}.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-mut">
                <th className="py-2 pr-3">La noi</th>
                <th className="py-2 pr-3">Propunere</th>
                <th className="py-2 pr-3">Alege pe dez.ro</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {vizibile.map((r) => (
                <RandPotrivire
                  key={r.local_id}
                  rand={r}
                  alegeri={r.toate ?? alegeri}
                  salvez={salvez === r.local_id}
                  onSalveaza={salveaza}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!incarc && vizibile.length > 0 && (
        <p className="text-xs text-mut mt-3">
          {vizibile.length} {vizibile.length === 1 ? "rând" : "rânduri"}
          {randuri.length !== vizibile.length ? ` (din ${randuri.length})` : ""}
        </p>
      )}
    </div>
  );
});

export default DezroPotriviri;

const RandPotrivire = memo(function RandPotrivire({
  rand, alegeri, salvez, onSalveaza,
}: {
  rand: Rand;
  alegeri: { dezro_id: number; nume: string }[];
  salvez: boolean;
  onSalveaza: (rand: Rand, id: number | null) => void;
}) {
  const propunere = rand.candidati[0] ?? null;
  const [ales, setAles] = useState<string>(String(rand.curent ?? propunere?.dezro_id ?? ""));
  // Lista întreagă se desenează abia când omul atinge chiar acest `select`.
  // Până atunci e nevoie de o singură opțiune: cea afișată. Altfel fiecare rând
  // ar aduce în pagină toate cele 557 de categorii ale lor, iar deschiderea
  // ecranului ar dura secunde.
  const [desfasurat, setDesfasurat] = useState(false);
  const optiuni = desfasurat ? alegeri : alegeri.filter((a) => String(a.dezro_id) === ales);

  return (
    <tr className="border-t border-line align-top">
      <td className="py-2 pr-3">
        <b>{rand.nume}</b>
        {rand.context && <span className="block text-xs text-mut">{rand.context}</span>}
      </td>
      <td className="py-2 pr-3 text-xs">
        {propunere ? (
          <>
            <span className="text-mut">{propunere.nume}</span>
            {/* Scorul e arătat pentru că el spune CÂT de sigură e propunerea.
                Fără el, „Range Rover" pentru „Range Rover Evoque" arată la fel
                de convingător ca o potrivire perfectă. */}
            <span className="ml-1 text-[11px] text-mut">({propunere.scor}%)</span>
          </>
        ) : (
          <span className="text-mut">— nicio propunere</span>
        )}
        {rand.curent && rand.sursa === "om" && (
          <span className="block text-[11px] text-ok">confirmat: {rand.curentNume}</span>
        )}
      </td>
      <td className="py-2 pr-3">
        <select
          value={ales}
          onChange={(e) => setAles(e.target.value)}
          onFocus={() => setDesfasurat(true)}
          onPointerDown={() => setDesfasurat(true)}
          className="w-full min-w-[220px] rounded-xl border-2 border-line px-2 py-2 text-sm"
        >
          <option value="">— nu are corespondent —</option>
          {optiuni.map((a) => (
            <option key={a.dezro_id} value={a.dezro_id}>{a.nume}</option>
          ))}
        </select>
      </td>
      <td className="py-2 whitespace-nowrap">
        <button
          type="button"
          disabled={salvez}
          onClick={() => onSalveaza(rand, ales === "" ? null : Number(ales))}
          className="rounded-xl border-2 border-line px-3 py-2 text-xs font-semibold hover:border-acc disabled:opacity-40"
        >
          {salvez ? "Se salvează…" : "Salvează"}
        </button>
      </td>
    </tr>
  );
});
