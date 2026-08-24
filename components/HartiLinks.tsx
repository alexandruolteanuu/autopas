// LINKURI HĂRȚI — Waze și Google Maps.
//
// Glifele sunt cele oficiale, monocrome, din colecția publică Simple Icons
// (`public/icons/waze.svg`, `public/icons/google-maps.svg`). NU sunt desenate
// de mână: mărcile altor companii nu se redesenează, regula proiectului cu
// „iconuri SVG scrise de mână" se aplică doar iconurilor funcționale.
//
// Se colorează din `currentColor` printr-o mască CSS — un `<img>` n-ar putea
// prelua culoarea temei. Nu le punem într-un cerc sau pătrat colorat inventat
// de noi: sunt butoane obișnuite ale site-ului, cu text vizibil.
//
// Adresele vin din `HARTI` (lib/config.ts). Coordonatele NU sunt încă în
// Admin → Setări: tabela `settings` nu are câmpuri de latitudine/longitudine.
import { HARTI } from "@/lib/config";

// `stransSub360` = se ascunde în bara de sus pe ecranele foarte mici.
// La 320px hello bar-ul are nevoie de 296px într-un spațiu de 288: telefonul (101),
// programul (87) și cele două hărți (92) nu încap, iar bara s-ar rupe pe două rânduri
// (62px, peste plafonul de 52px pe care îl are banda asta). Waze iese primul, fiindcă
// rămâne în subsol cu etichetă completă („Navighează cu Waze"), la fel ca textul
// despre livrare, ascuns tot acolo din același motiv. În subsol se afișează ambele,
// la orice lățime.
const HARTI_ITEMS = [
  { nume: "Waze", scurt: "Waze", lung: "Navighează cu Waze", href: HARTI.waze, glif: "/icons/waze.svg", stransSub360: true },
  { nume: "Google Maps", scurt: "Google Maps", lung: "Deschide în Google Maps", href: HARTI.gmaps, glif: "/icons/google-maps.svg", stransSub360: false },
];

function Glif({ src, className = "w-5 h-5" }: { src: string; className?: string }) {
  return (
    <span aria-hidden="true" className={`${className} shrink-0 inline-block bg-current`}
      style={{
        maskImage: `url(${src})`, WebkitMaskImage: `url(${src})`,
        maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat",
        maskSize: "contain", WebkitMaskSize: "contain",
        maskPosition: "center", WebkitMaskPosition: "center",
      }} />
  );
}

export default function HartiLinks({ variant = "bara" }: { variant?: "bara" | "footer" }) {
  const footer = variant === "footer";
  return (
    <div className={footer ? "flex flex-wrap gap-2" : "flex items-center gap-1"}>
      {HARTI_ITEMS.map((h) => {
        const provizoriu = h.href === "#";
        return (
          <a
            key={h.nume}
            href={h.href}
            {...(provizoriu ? {} : { target: "_blank", rel: "noopener noreferrer" })}
            aria-label={h.lung}
            className={
              footer
                ? "inline-flex items-center gap-2 rounded-lg bg-white/10 hover:bg-white/20 px-3 min-h-[44px] text-sm transition"
                : `${h.stransSub360 ? "hidden min-[360px]:inline-flex" : "inline-flex"} items-center justify-center gap-2 rounded-md hover:bg-white/10 px-2 min-w-[44px] min-h-[44px] transition`
            }
          >
            <Glif src={h.glif} className={footer ? "w-5 h-5" : "w-[18px] h-[18px]"} />
            {footer
              ? <span>{h.lung}</span>
              : <span className="hidden sm:inline text-[12px] whitespace-nowrap">{h.scurt}</span>}
          </a>
        );
      })}
    </div>
  );
}
