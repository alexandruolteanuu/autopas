// Ilustrația de rezervă a unei mașini la dezmembrat, pentru când nu are încă poze.
//
// De ce nu o casetă gri: aceeași cerință ca la piese (vezi `PartArt`) — un spațiu
// gol arată a pagină stricată, nu a fotografie care lipsește.
//
// Culorile, fundalul și `viewBox`-ul sunt IDENTICE cu ale lui `PartArt`, ca cele
// două să poată sta una lângă alta în aceeași grilă fără să se vadă o muchie.
// Dacă se schimbă acolo, se schimbă și aici — sunt aceeași suprafață.
const INK = "#2A2F36", ST = "#3A4048", AC = "rgb(var(--accent))", LT = "#535B65";
const FUNDAL = "#E9EAEA", FUNDAL_2 = "#E0E1E1";

export default function MasinaArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 84" className={className} role="img" aria-label="ilustrație mașină">
      <rect width="100" height="84" fill={FUNDAL} />
      <circle cx="82" cy="14" r="26" fill={FUNDAL_2} />
      {/* Caroseria: o siluetă de break văzută din lateral. */}
      <path d="M14 54c0-3 2-5 5-6l6-1 8-12c1-2 3-3 5-3h26c2 0 4 1 5 3l7 12 6 1c3 1 4 3 4 6v6c0 2-1 3-3 3H17c-2 0-3-1-3-3z"
        fill={INK} />
      {/* Geamurile, în tușa deschisă — despart capota de habitaclu. */}
      <path d="M38 36h9v11H31zM51 36h11l6 11H51z" fill={LT} />
      {/* Farul din față, singurul element în accent: e piesa pe care o caută omul. */}
      <path d="M84 48h5c2 0 3 1 3 3s-1 3-3 3h-5z" fill={AC} />
      {/* Roțile, cu butuc deschis ca la `wheel` din PartArt. */}
      <circle cx="31" cy="63" r="8" fill={ST} /><circle cx="31" cy="63" r="3.5" fill={FUNDAL} />
      <circle cx="71" cy="63" r="8" fill={ST} /><circle cx="71" cy="63" r="3.5" fill={FUNDAL} />
    </svg>
  );
}
