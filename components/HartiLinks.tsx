// LINKURI HĂRȚI — Waze și Google Maps, cu logourile oficiale din `public/`.
// Adresele reale se pun într-un singur loc: `HARTI` din `lib/config.ts`.
// Cât timp linkul e „#” (provizoriu), nu deschidem o filă nouă goală.
import { HARTI } from "@/lib/config";

const HARTI_ITEMS = [
  { nume: "Waze", href: HARTI.waze, logo: "/waze.svg" },
  { nume: "Google Maps", href: HARTI.gmaps, logo: "/google-maps.svg" },
];

export default function HartiLinks({ variant = "bara" }: { variant?: "bara" | "footer" }) {
  const footer = variant === "footer";
  return (
    <div className={footer ? "flex flex-wrap gap-2" : "flex items-center gap-2 sm:gap-3"}>
      {HARTI_ITEMS.map((h) => {
        const provizoriu = h.href === "#";
        return (
          <a
            key={h.nume}
            href={h.href}
            {...(provizoriu ? {} : { target: "_blank", rel: "noopener noreferrer" })}
            title={`Deschide locația în ${h.nume}`}
            aria-label={`Deschide locația în ${h.nume}`}
            className={
              footer
                ? "inline-flex items-center gap-2 rounded-lg bg-white/10 hover:bg-white/20 px-3 py-2 transition"
                : "inline-flex items-center gap-1.5 rounded-md hover:bg-white/10 px-1.5 py-1 transition"
            }
          >
            <img
              src={h.logo}
              alt={h.nume}
              width={footer ? 20 : 16}
              height={footer ? 20 : 16}
              className={footer ? "w-5 h-5" : "w-4 h-4"}
            />
            <span className={footer ? "text-sm" : "text-[12px]"}>{h.nume}</span>
          </a>
        );
      })}
    </div>
  );
}
