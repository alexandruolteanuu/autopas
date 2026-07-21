// BANDA DE ÎNCREDERE — un singur loc pentru texte și pictograme; apare pe tot site-ul.
// Fiecare element are pictograma lui, desenată în același stil (fără bife identice).
export const TRUST = [
  { t: "Garanție 30 de zile", d: "conform regulament", ic: "scut" },
  { t: "Livrare 1–3 zile lucrătoare", d: "prin curier", ic: "camion" },
  { t: "Retur în 14 zile", d: "conform OUG 34/2014", ic: "retur" },
  { t: "Piese testate", d: "și verificate înainte de livrare", ic: "lupa" },
];

export function TrustIcon({ kind, className = "w-5 h-5" }: { kind: string; className?: string }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {kind === "scut" && (<g {...p}><path d="M12 3l7 3v5.5c0 4.3-2.9 7.9-7 9.5-4.1-1.6-7-5.2-7-9.5V6l7-3z" /><path d="M9 12l2.2 2.2L15.5 10" /></g>)}
      {kind === "camion" && (<g {...p}><path d="M3 7h11v9H3z" /><path d="M14 10h3.5l2.5 3v3h-6" /><circle cx="7" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></g>)}
      {kind === "retur" && (<g {...p}><path d="M4 9h11a5 5 0 0 1 0 10H8" /><path d="M8 5L4 9l4 4" /></g>)}
      {kind === "lupa" && (<g {...p}><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l4.5 4.5" /><path d="M8 10.5l1.8 1.8L13 9" /></g>)}
      {kind === "wrench" && (<g {...p}><path d="M15.5 4a5 5 0 0 0-4.9 6l-6 6 3.4 3.4 6-6A5 5 0 1 0 15.5 4z" /></g>)}
    </svg>
  );
}

export default function TrustBar({ variant = "light" }: { variant?: "light" | "dark" }) {
  return (
    <section className={variant === "dark" ? "bg-ink text-white" : "bg-white border-b border-line"}>
      <div className="mx-auto max-w-6xl px-4 py-5 grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
        {TRUST.map((x) => (
          <div key={x.t} className="flex items-center gap-3">
            <span className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${variant === "dark" ? "bg-white/10 text-acc" : "bg-acc/10 text-acc"}`}>
              <TrustIcon kind={x.ic} className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <b className="block leading-tight">{x.t}</b>
              <span className={`text-xs ${variant === "dark" ? "text-white/60" : "text-mut"}`}>{x.d}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
