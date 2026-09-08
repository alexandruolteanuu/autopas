"use client";
// Galeria piesei: pozele reale încărcate din admin; dacă nu există, ilustrația desenată.
//
// Aceeași galerie servește și paginile de mașină dezmembrată (`/masini/[slug]`),
// care n-au `art` fiindcă nu sunt piese. De aceea ilustrația de rezervă poate fi
// trimisă din afară, prin `rezerva`; fără ea se desenează `PartArt`, ca înainte.
//
// Clic pe poza mare o deschide pe tot ecranul, cu săgeți stânga/dreapta.
// Acolo imaginea e `object-contain` (se vede întreagă, nu tăiată ca în card):
// piesele sunt fotografiate din unghiuri diferite, iar detaliul pe care îl caută
// clientul — o urmă de lovitură, un conector rupt — stă adesea pe margine.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import PartArt from "./PartArt";

export default function ProductGallery({ poze, art = "engine", nume, rezerva }:
  { poze: string[]; art?: string; nume: string; rezerva?: ReactNode }) {
  const [activ, setActiv] = useState(0);
  const [marit, setMarit] = useState(false);
  const butonPoza = useRef<HTMLButtonElement>(null);
  const butonInchide = useRef<HTMLButtonElement>(null);

  const n = poze?.length ?? 0;
  // Trecerea e circulară: de pe ultima poză, „înainte" duce la prima.
  const muta = useCallback((pas: number) => {
    setActiv((i) => (n === 0 ? 0 : (i + pas + n) % n));
  }, [n]);

  // Cât e deschisă poza mare: tastele o conduc, iar pagina din spate nu se defilează.
  useEffect(() => {
    if (!marit) return;
    const laTasta = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMarit(false);
      else if (e.key === "ArrowRight") muta(1);
      else if (e.key === "ArrowLeft") muta(-1);
    };
    const scrollVechi = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", laTasta);
    butonInchide.current?.focus();
    return () => {
      document.body.style.overflow = scrollVechi;
      window.removeEventListener("keydown", laTasta);
    };
  }, [marit, muta]);

  // Pozele vecine se aduc din timp, ca săgeata să nu lase un dreptunghi gol.
  useEffect(() => {
    if (!marit || n < 2) return;
    for (const p of [1, -1]) {
      const img = new Image();
      img.src = poze[(activ + p + n) % n];
    }
  }, [marit, activ, n, poze]);

  // Glisarea cu degetul, pe telefon: doar orizontal și doar peste 40px.
  const start = useRef<{ x: number; y: number } | null>(null);
  const laStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY };
  };
  const laFinal = (e: React.TouchEvent) => {
    if (!start.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.current.x, dy = t.clientY - start.current.y;
    start.current = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) muta(dx < 0 ? 1 : -1);
  };

  const inchide = () => {
    setMarit(false);
    butonPoza.current?.focus();
  };

  if (n === 0)
    return (
      <div className="card overflow-hidden">
        {rezerva ?? <PartArt kind={art} className="w-full aspect-[100/72]" />}
      </div>
    );

  return (
    <div>
      <div className="card overflow-hidden">
        {/* fundalul zonei de imagine: --imagine-bg din app/globals.css */}
        {/* Imaginea mare e elementul LCP al paginii de produs (măsurat: 876 ms).
            Era deja încărcată devreme, dar fără prioritate declarată. */}
        <button type="button" ref={butonPoza} onClick={() => setMarit(true)}
          className="block w-full cursor-zoom-in" aria-label={`Vezi poza mare: ${nume}`}>
          <img src={poze[activ]} alt={nume} className="w-full aspect-[100/72] object-cover bg-imagineBg"
            fetchPriority="high" decoding="sync" />
        </button>
      </div>
      {n > 1 && (
        <div className="grid grid-cols-5 gap-2 mt-2">
          {poze.map((u, i) => (
            <button key={u} onClick={() => setActiv(i)} aria-label={`Poza ${i + 1} din ${n}`}
              className={`rounded-lg overflow-hidden border-2 ${i === activ ? "border-accentChenar" : "border-chenar"}`}>
              <img src={u} alt="" className="w-full aspect-[100/72] object-cover bg-imagineBg" />
            </button>
          ))}
        </div>
      )}

      {marit && (
        // Fundal negru OPAC, nu `bg-black/95`: la 95% se citeau prin el header-ul și
        // bannerul de cookie-uri, iar poza părea suprapusă peste pagină, nu deschisă mare.
        <div role="dialog" aria-modal="true" aria-label={`Poze: ${nume}`} data-strat-fix
          className="fixed inset-0 z-[70] bg-black flex flex-col"
          onTouchStart={laStart} onTouchEnd={laFinal}>
          <div className="flex items-center justify-between gap-3 px-3 py-2 shrink-0 text-white">
            <span className="text-sm tabular-nums">{n > 1 ? `${activ + 1} / ${n}` : ""}</span>
            <button type="button" ref={butonInchide} onClick={inchide} aria-label="Închide poza"
              className="grid place-items-center min-w-[44px] min-h-[44px] rounded-lg hover:bg-white/15">
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <div className="relative flex-1 min-h-0">
            {/* apăsarea pe fundalul din jurul pozei închide; pe poză, nu */}
            <div className="absolute inset-0" onClick={inchide} aria-hidden="true" />
            <img src={poze[activ]} alt={nume}
              className="relative pointer-events-none w-full h-full object-contain select-none" />

            {n > 1 && (
              <>
                <button type="button" onClick={() => muta(-1)} aria-label="Poza anterioară"
                  className="absolute left-2 top-1/2 -translate-y-1/2 grid place-items-center w-11 h-11 rounded-full bg-black/60 text-white border border-white/25 hover:bg-black/80">
                  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M15 5l-7 7 7 7" />
                  </svg>
                </button>
                <button type="button" onClick={() => muta(1)} aria-label="Poza următoare"
                  className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center w-11 h-11 rounded-full bg-black/60 text-white border border-white/25 hover:bg-black/80">
                  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}
          </div>

          {n > 1 && (
            // Miniaturile rămân la îndemână și în ecranul mare: cu 8 poze, săgeata
            // singură ar însemna 7 apăsări ca să ajungi la ultima.
            <div className="shrink-0 flex gap-2 overflow-x-auto px-3 py-3">
              {poze.map((u, i) => (
                <button key={u} onClick={() => setActiv(i)} aria-label={`Poza ${i + 1} din ${n}`}
                  className={`shrink-0 w-16 rounded-lg overflow-hidden border-2 ${i === activ ? "border-white" : "border-white/25"}`}>
                  <img src={u} alt="" className="w-full aspect-[100/72] object-cover bg-imagineBg" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
