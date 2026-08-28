"use client";
// ============================================================
// BARA DE PROGRES LA NAVIGARE
//
// DE CE EXISTĂ
// Rutele de catalog randează pe server, deci după un click pagina veche rămâne
// pe ecran ~1,2 secunde fără niciun semn. Măsurat: navigarea era de fapt mai
// RAPIDĂ decât încărcarea directă a adresei (1,2 s față de 1,5 s) — deci
// problema nu era viteza, ci lipsa unui răspuns la apăsare.
//
// DE CE NU UN SCHELET DE ÎNCĂRCARE, PE LISTĂRI
// Am încercat întâi `loading.tsx` cu schelete. Pe listări anula încărcarea
// leneșă a imaginilor: toate cele 24 de poze se descărcau deodată, 1.475 KB în
// loc de 338 pe telefon. Bara nu poate produce efectul acela — e `fixed`, nu
// ocupă spațiu în flux și nu schimbă poziția niciunui card.
//
// CUM SE OPREȘTE
// Next 14 n-are evenimente de router, iar `useSearchParams` într-o componentă
// din layout ar scoate paginile statice din randarea la build. Deci: pornim la
// click pe un link intern și ne uităm la `location.href` până se schimbă.
// ============================================================
import { useCallback, useEffect, useRef, useState } from "react";

/** Sub atâta, navigarea se simte instantanee și o bară ar clipi inutil. */
const INTARZIERE_MS = 150;
/** Plasă: dacă ceva o ia razna, bara nu rămâne pe ecran la nesfârșit. */
const MAXIM_MS = 15000;
const PAS_MS = 80;

export default function BaraProgres() {
  const [activ, setActiv] = useState(false);
  const cronometre = useRef<number[]>([]);

  const curata = useCallback(() => {
    cronometre.current.forEach((t) => window.clearTimeout(t));
    cronometre.current = [];
  }, []);

  const opreste = useCallback(() => { curata(); setActiv(false); }, [curata]);

  const porneste = useCallback((deLa: string) => {
    curata();
    // Apare abia după prag: navigările rapide nu clipesc deloc.
    cronometre.current.push(window.setTimeout(() => setActiv(true), INTARZIERE_MS));
    const start = Date.now();
    const verifica = () => {
      if (window.location.href !== deLa) return opreste();
      if (Date.now() - start > MAXIM_MS) return opreste();
      cronometre.current.push(window.setTimeout(verifica, PAS_MS));
    };
    cronometre.current.push(window.setTimeout(verifica, PAS_MS));
  }, [curata, opreste]);

  useEffect(() => {
    const laClick = (e: MouseEvent) => {
      // Click stânga simplu, fără taste de modificare: restul deschid alt tab
      // sau altă fereastră, unde pagina curentă nu se schimbă.
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a) return;
      const href = a.getAttribute("href");
      // Doar navigări interne: „/piese", nu „https://…", „#ancora" sau „tel:".
      if (!href || !href.startsWith("/")) return;
      if (a.hasAttribute("download") || (a.target && a.target !== "_self")) return;
      const destinatie = new URL(href, window.location.origin).href;
      if (destinatie === window.location.href) return;   // aceeași adresă
      porneste(window.location.href);
    };
    // Faza de capturare: prindem clickul înaintea lui `Link`, ca să pornim
    // cronometrul chiar în momentul apăsării.
    document.addEventListener("click", laClick, true);
    // Butonul „înapoi" schimbă adresa fără click pe link.
    window.addEventListener("popstate", opreste);
    return () => {
      document.removeEventListener("click", laClick, true);
      window.removeEventListener("popstate", opreste);
      curata();
    };
  }, [porneste, opreste, curata]);

  if (!activ) return null;

  return (
    // `z-[70]`: peste sertarul de filtre (60) și peste bannerul de cookie-uri
    // (50) — bara trebuie să se vadă indiferent ce e deschis.
    // `bg-accent` merge pe ambele teme: e singura culoare care nu se schimbă
    // între ele, iar bara stă pe fundalul paginii, nu pe text.
    <div
      data-strat-fix
      role="progressbar"
      aria-label="Se încarcă pagina"
      className="fixed top-0 inset-x-0 z-[70] h-[3px] bg-accent/25 pointer-events-none"
    >
      {/* Animația e decorativă: nu arată progres real, fiindcă nu-l putem ști.
          `prefers-reduced-motion` din globals.css o reduce la nimic — atunci
          rămâne banda statică, care tot spune „se lucrează". */}
      <div className="h-full bg-accent origin-left animate-[bara-progres_1.4s_ease-out_infinite]" />
    </div>
  );
}
