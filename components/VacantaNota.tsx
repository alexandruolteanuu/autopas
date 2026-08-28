// ============================================================
// MOD VACANȚĂ — cele două forme în care se arată pe site-ul public.
//
// `VacantaStareGoala` ia locul stării goale obișnuite în listări: acolo unde
// altfel ar scrie „nicio piesă găsită, încearcă alt filtru", ceea ce ar trimite
// clientul să caute mai departe degeaba.
//
// `VacantaBanner` e banda de avertizare din coș, de la checkout și de pe pagina
// unei piese deschise direct pe URL.
//
// Mesajul e scris de proprietar. Ajunge aici ca TEXT, niciodată prin
// `dangerouslySetInnerHTML` — React îl escapează singur — iar rândurile și
// spațiile se strâng, ca o apăsare de Enter în formular să nu spargă așezarea.
// ============================================================
import { mesajVacanta, type Vacanta } from "@/lib/settings";
import { CONFIG, telLink } from "@/lib/config";
import StareGoala from "./StareGoala";

const curat = (v: Vacanta) => mesajVacanta(v).replace(/\s+/g, " ").trim();

/** Iconița de pauză — două bare, desenate de mână ca toate celelalte din proiect. */
function IconPauza({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true"
      fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M10 9v6M14 9v6" />
    </svg>
  );
}

/** În locul listei goale obișnuite. Are întotdeauna o cale mai departe: telefonul.
 *  O piesă căutată în vacanță e tot o vânzare, dacă omul poate suna. */
export function VacantaStareGoala({ vacanta, titlu = "Suntem în pauză" }:
  { vacanta: Vacanta; titlu?: string }) {
  return (
    <StareGoala
      icon={<IconPauza />}
      titlu={titlu}
      text={curat(vacanta)}
      copii={
        <a href={telLink()} className="btn-acc inline-flex">
          Sună-ne: {CONFIG.telefonAfisat}
        </a>
      }
    />
  );
}

/** Banda de avertizare. `bg-accent` cu `text-accentContrast` — aceleași două
 *  culori pe ambele teme, iar galbenul nu e niciodată text (vezi CLAUDE.md). */
export function VacantaBanner({ vacanta, className = "" }:
  { vacanta: Vacanta; className?: string }) {
  return (
    <div role="status"
      className={`rounded-xl bg-accent text-accentContrast px-4 py-3 flex items-start gap-3 ${className}`}>
      <IconPauza className="w-5 h-5 shrink-0 mt-0.5" />
      <div className="text-[15px] leading-relaxed">
        <b className="block font-disp font-semibold">Comenzile sunt oprite temporar</b>
        <span>{curat(vacanta)}</span>{" "}
        <a href={telLink()} className="underline font-semibold whitespace-nowrap">
          sună-ne la {CONFIG.telefonAfisat}
        </a>
      </div>
    </div>
  );
}
