"use client";
// Filtrele de catalog pe telefon și tabletă.
//
// Sub 1024px coloana laterală nu încape, așa că filtrele intră într-un sertar
// care urcă de jos, cu „Aplică" fixat la baza lui. De la 1024px în sus rămâne
// coloana laterală dinainte. Conținutul filtrelor e același în ambele locuri —
// vine ca `children` din pagina de server, ca să nu-l scriem de două ori.
import { useEffect, useState, type ReactNode } from "react";

export default function FiltreSertar({ children, nrFiltre = 0 }: { children: ReactNode; nrFiltre?: number }) {
  const [deschis, setDeschis] = useState(false);

  // Escape închide sertarul, iar cât e deschis pagina din spate nu se defilează.
  useEffect(() => {
    if (!deschis) return;
    const laTasta = (e: KeyboardEvent) => { if (e.key === "Escape") setDeschis(false); };
    const scrollVechi = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", laTasta);
    return () => { document.body.style.overflow = scrollVechi; window.removeEventListener("keydown", laTasta); };
  }, [deschis]);

  return (
    <>
      {/* butonul, lipit sub header (scara de z-index: 10 pentru elemente lipite în pagină) */}
      <div className="lg:hidden sticky top-[68px] z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 bg-fundal/95">
        <button type="button" onClick={() => setDeschis(true)}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg border-2 border-chenar bg-suprafata min-h-[44px] px-4 font-semibold text-sm">
          <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          Filtre{nrFiltre > 0 ? ` (${nrFiltre})` : ""}
        </button>
      </div>

      {deschis && (
        <>
          {/* fundalul de sub sertar — închide la apăsare */}
          <div data-strat-fix className="lg:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setDeschis(false)} aria-hidden="true" />
          <div role="dialog" aria-modal="true" aria-label="Filtre"
            data-strat-fix className="lg:hidden fixed inset-x-0 bottom-0 z-[60] flex flex-col max-h-[85vh] rounded-t-2xl bg-suprafata border-t border-chenar">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-chenar shrink-0">
              <b className="font-disp font-semibold">Filtre</b>
              <button type="button" onClick={() => setDeschis(false)} aria-label="Închide filtrele"
                className="grid place-items-center min-w-[44px] min-h-[44px] rounded-lg hover:bg-suprafata2">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-2 py-2">{children}</div>
            <div className="shrink-0 border-t border-chenar p-3">
              <button type="button" onClick={() => setDeschis(false)} className="btn-acc w-full">Aplică filtrele</button>
            </div>
          </div>
        </>
      )}

      {/* De la 1024px în sus, aceleași filtre stau în coloana laterală, ca înainte */}
      <aside className="hidden lg:block card overflow-hidden h-fit lg:sticky lg:top-24">
        <div className="bg-suprafata2 px-4 py-3 border-b border-chenar">
          <b className="font-disp font-semibold text-[13px]">Categorii</b>
        </div>
        <div className="p-2 max-h-[70vh] overflow-y-auto">{children}</div>
      </aside>
    </>
  );
}
