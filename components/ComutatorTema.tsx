"use client";
// ============================================================
// COMUTATORUL DE TEMĂ — „Întunecat" (implicit) / „Luminos".
//
// Alegerea se ține în localStorage, cheia `autopas-tema`, și se aplică punând
// `data-tema="luminos"` pe <html>. Restul e treaba variabilelor din globals.css:
// nicio componentă nu știe pe ce temă e.
//
// IMPLICIT rămâne întunecatul, indiferent de setarea sistemului. `prefers-color-scheme`
// NU se folosește: clientul a cerut întunecatul ca standard, iar un site care se
// deschide altfel decât cum l-a gândit proprietarul nu e „adaptare", e surpriză.
//
// ICOANELE se comută din CSS, nu din JavaScript (vezi `.ic-soare`/`.ic-luna` în
// globals.css). Așa iconița corectă e desenată din primul cadru, împreună cu
// scriptul anti-flash din app/layout.tsx — dacă ar depinde de starea React, ar
// apărea o clipă cea greșită la fiecare încărcare.
// ============================================================
import { useEffect, useState } from "react";

const CHEIE = "autopas-tema";

export default function ComutatorTema() {
  const [luminos, setLuminos] = useState(false);

  // Sincronizează starea React cu ce a pus deja scriptul anti-flash pe <html>.
  useEffect(() => {
    setLuminos(document.documentElement.getAttribute("data-tema") === "luminos");
  }, []);

  function comuta() {
    const nou = document.documentElement.getAttribute("data-tema") !== "luminos";
    if (nou) document.documentElement.setAttribute("data-tema", "luminos");
    else document.documentElement.removeAttribute("data-tema");
    try { localStorage.setItem(CHEIE, nou ? "luminos" : "intunecat"); } catch { /* navigare privată */ }
    setLuminos(nou);
  }

  return (
    <button onClick={comuta} type="button"
      aria-pressed={luminos}
      title="Schimbă tema — întunecat sau luminos"
      aria-label="Schimbă tema — întunecat sau luminos"
      className="shrink-0 grid place-items-center min-w-[44px] min-h-[44px] rounded-lg hover:bg-white/10 transition">
      {/* soare = „treci pe luminos", vizibil cât timp tema e întunecată */}
      <svg viewBox="0 0 24 24" className="ic-soare w-[22px] h-[22px]" aria-hidden="true"
        fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
      </svg>
      {/* lună = „treci pe întunecat", vizibilă cât timp tema e luminoasă */}
      <svg viewBox="0 0 24 24" className="ic-luna w-[22px] h-[22px]" aria-hidden="true"
        fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 13.5A8 8 0 0 1 10.5 4a8 8 0 1 0 9.5 9.5z" />
      </svg>
    </button>
  );
}
