"use client";
// ============================================================
// Bannerul de consimțământ — trei butoane, fiindcă sunt trei răspunsuri reale
//
// „Doar necesare" / „Doar statistică" / „Accept toate". Al doilea buton nu e
// politețe: din 4 septembrie 2026 site-ul poate încărca și Google Ads, și
// pixelul Meta, iar acelea sunt urmărire pentru reclame, nu măsurare de trafic.
// Un singur buton „Accept toate" ar fi cerut acordul pentru amândouă deodată,
// ceea ce nu e un consimțământ valabil pentru niciunul.
//
// Butonul de refuz e la fel de vizibil ca cel de acceptare, iar cât timp omul
// n-a apăsat nimic, tratăm asta ca pe un refuz: nu se încarcă niciun script.
// ============================================================
import { useEffect, useState } from "react";
import Link from "next/link";
import { citesteConsimtamant, scrieConsimtamant, type Alegere } from "@/lib/consimtamant";

export default function CookieBanner() {
  const [vizibil, setVizibil] = useState(false);
  useEffect(() => { if (citesteConsimtamant() === "nesetat") setVizibil(true); }, []);
  // `scrieConsimtamant` anunță și pagina, nu doar `localStorage`: fără asta,
  // „Accept toate" n-ar porni măsurarea decât la următoarea reîncărcare,
  // adică exact vizita pe care voiam s-o măsurăm s-ar pierde.
  const alege = (v: Alegere) => { scrieConsimtamant(v); setVizibil(false); };
  if (!vizibil) return null;
  return (
    <div data-strat-fix className="fixed bottom-0 inset-x-0 z-50 bg-headerBg text-headerText shadow-2xl border-t border-white/10">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-4 flex flex-col lg:flex-row lg:items-center gap-3">
        <p className="text-sm text-headerText/85 flex-1 min-w-0 break-words">
          Folosim cookie-uri strict necesare (coșul tău) și, doar cu acordul tău, cookie-uri de
          statistică (Google Analytics) și de publicitate (Google Ads, Meta). Detalii în{" "}
          <Link href="/legal/politica-de-cookies" className="underline underline-offset-2">Politica de cookies</Link>{" "}
          — alegerea o poți schimba oricând din{" "}
          <Link href="/legal/setari-cookie-uri" className="underline underline-offset-2">Setări cookie-uri</Link>.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
          <button onClick={() => alege("necesare")} className="rounded-lg border border-white/30 px-4 min-h-[44px] text-sm font-semibold hover:bg-white/10">Doar necesare</button>
          <button onClick={() => alege("statistica")} className="rounded-lg border border-white/30 px-4 min-h-[44px] text-sm font-semibold hover:bg-white/10">Doar statistică</button>
          <button onClick={() => alege("toate")} className="rounded-lg bg-accent text-accentContrast px-4 min-h-[44px] text-sm font-bold">Accept toate</button>
        </div>
      </div>
    </div>
  );
}
