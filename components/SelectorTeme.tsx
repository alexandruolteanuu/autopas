"use client";
// ============================================================
// TEMPORAR — dropdown pentru ales tema de culoare a site-ului.
// Se șterge după ce clientul se decide. Instrucțiunile de ștergere:
// CLAUDE.md, secțiunea „TEMPORAR — selector teme".
//
// `select` nativ, fără librării: pe telefon deschide rotița sistemului,
// e accesibil din start și nu poate strica layoutul headerului.
// ============================================================
import { useEffect, useState } from "react";
import { SELECTOR_TEME_ACTIV } from "@/lib/config";
import { TEME, GRUPURI, TEMA_IMPLICITA, CHEIE_TEMA } from "@/lib/teme";

function aplica(id: string) {
  // Tema „actuală" e cea din :root, deci nu are atribut — îl ștergem.
  if (id === TEMA_IMPLICITA) delete document.documentElement.dataset.tema;
  else document.documentElement.dataset.tema = id;
}

export default function SelectorTeme() {
  const [tema, setTema] = useState(TEMA_IMPLICITA);

  // La montare luăm alegerea salvată, ca selectul să arate ce e pe ecran.
  // (Tema însăși e pusă mai devreme, de scriptul din <head>, ca să nu pâlpâie.)
  useEffect(() => {
    try {
      const salvat = localStorage.getItem(CHEIE_TEMA);
      if (salvat && TEME.some((t) => t.id === salvat)) { setTema(salvat); aplica(salvat); }
    } catch { /* localStorage blocat (navigare privată) — rămâne tema implicită */ }
  }, []);

  if (!SELECTOR_TEME_ACTIV) return null;

  function schimba(id: string) {
    setTema(id);
    aplica(id);
    try { localStorage.setItem(CHEIE_TEMA, id); } catch { /* nu putem salva, dar tema tot se vede */ }
  }

  return (
    <div className="flex items-center gap-2 min-w-0">
      {/* Eticheta stă în afara containerului îngust: altfel, fiind scrisă pe un
          singur rând, ar împinge selectul peste marginea de 160px. */}
      <span className="hidden sm:inline text-[12px] leading-tight text-white/60 whitespace-nowrap">Temă (temporar)</span>
      <div className="min-w-0 max-w-[160px] shrink-0">
      <select
        aria-label="Alege tema de culoare a site-ului"
        value={tema}
        onChange={(e) => schimba(e.target.value)}
        className="w-full min-w-0 max-w-[160px] shrink-0 rounded-lg bg-white/10 text-white text-[12px] px-2 min-h-[44px] outline-none border border-white/20"
      >
        {GRUPURI.map((g) => (
          <optgroup key={g} label={g}>
            {TEME.filter((t) => t.grup === g).map((t) => (
              <option key={t.id} value={t.id} className="text-ink bg-white">{t.nume}</option>
            ))}
          </optgroup>
        ))}
      </select>
      </div>
    </div>
  );
}
