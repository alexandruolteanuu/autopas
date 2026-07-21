"use client";
// Butonul „inimă" — pe cardul de produs și pe pagina de produs.
import { useFavorites } from "./FavoritesContext";

export default function FavButton({ id, variant = "card" }: { id: number; variant?: "card" | "line" }) {
  const { are, comuta } = useFavorites();
  const activ = are(id);
  const eticheta = activ ? "Elimină de la favorite" : "Adaugă la favorite";

  if (variant === "line")
    return (
      <button onClick={() => comuta(id)} aria-pressed={activ} title={eticheta}
        className={`inline-flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition
          ${activ ? "border-acc text-acc bg-acc/5" : "border-line text-steel hover:border-acc"}`}>
        <Inima plina={activ} /> {activ ? "La favorite" : "Adaugă la favorite"}
      </button>
    );

  return (
    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); comuta(id); }}
      aria-pressed={activ} title={eticheta}
      className={`absolute top-2 left-2 z-10 w-8 h-8 rounded-full grid place-items-center backdrop-blur transition
        ${activ ? "bg-acc text-white" : "bg-white/85 text-steel hover:text-acc"}`}>
      <Inima plina={activ} />
    </button>
  );
}

function Inima({ plina }: { plina: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill={plina ? "currentColor" : "none"}
      stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20s-7-4.4-7-9.3A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7 3.1C19 15.6 12 20 12 20z" />
    </svg>
  );
}
