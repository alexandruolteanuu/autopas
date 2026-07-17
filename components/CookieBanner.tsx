"use client";
// Bannerul de consimțământ cookies — cerut explicit de client ("cmsi cookes").
import { useEffect, useState } from "react";
import Link from "next/link";

export default function CookieBanner() {
  const [vizibil, setVizibil] = useState(false);
  useEffect(() => { if (!localStorage.getItem("autopas_cookies")) setVizibil(true); }, []);
  const alege = (v: string) => { localStorage.setItem("autopas_cookies", v); setVizibil(false); };
  if (!vizibil) return null;
  return (
    <div className="fixed bottom-0 inset-x-0 z-50 bg-ink text-white shadow-2xl border-t border-white/10">
      <div className="mx-auto max-w-6xl px-4 py-4 flex flex-col md:flex-row md:items-center gap-3">
        <p className="text-sm text-white/85 flex-1">
          Folosim cookie-uri strict necesare (coșul tău) și, doar cu acordul tău, cookie-uri de statistică.
          Detalii în <Link href="/legal/politica-de-cookies" className="underline underline-offset-2">Politica de cookies</Link>.
        </p>
        <div className="flex gap-2">
          <button onClick={() => alege("necesare")} className="rounded-lg border border-white/30 px-4 py-2 text-sm font-semibold hover:bg-white/10">Doar necesare</button>
          <button onClick={() => alege("toate")} className="rounded-lg bg-acc px-4 py-2 text-sm font-bold">Accept toate</button>
        </div>
      </div>
    </div>
  );
}
