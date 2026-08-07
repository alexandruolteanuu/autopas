// Iconuri funcționale, desenate de mână, într-un singur loc.
// Mărcile altor companii NU se desenează aici — vezi regula din CLAUDE.md.
// Se colorează din `currentColor`, deci urmează tema aleasă.

type Props = { className?: string };
const baza = { fill: "none", stroke: "currentColor", strokeWidth: 1.7,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function Svg({ className = "w-[18px] h-[18px]", children }: Props & { children: React.ReactNode }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">{children}</svg>;
}

export const IconTelefon = (p: Props) => (
  <Svg {...p}><path {...baza} d="M6.5 3.5h3l1.5 4-2 1.4a12 12 0 0 0 6.1 6.1l1.4-2 4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.5 5.7 2 2 0 0 1 6.5 3.5z" /></Svg>
);
export const IconMail = (p: Props) => (
  <Svg {...p}><g {...baza}><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="M3.5 7l8.5 6 8.5-6" /></g></Svg>
);
export const IconPin = (p: Props) => (
  <Svg {...p}><g {...baza}><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z" /><circle cx="12" cy="10" r="2.6" /></g></Svg>
);
export const IconCamion = (p: Props) => (
  <Svg {...p}><g {...baza}><path d="M3 7h10v9H3z" /><path d="M13 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></g></Svg>
);
export const IconCos = (p: Props) => (
  <Svg {...p}><g {...baza}><path d="M3.5 5h2l2.2 9.4a2 2 0 0 0 2 1.6h6.7a2 2 0 0 0 2-1.5L20 8H6.2" /><circle cx="10" cy="19.5" r="1.3" /><circle cx="17" cy="19.5" r="1.3" /></g></Svg>
);
export const IconInima = (p: Props) => (
  <Svg {...p}><path {...baza} d="M12 20s-7-4.4-7-9.3A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7 3.1C19 15.6 12 20 12 20z" /></Svg>
);
export const IconLupa = (p: Props) => (
  <Svg {...p}><g {...baza}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></g></Svg>
);
export const IconMesaj = (p: Props) => (
  <Svg {...p}><path {...baza} d="M20.5 12.5c0 3.9-3.8 7-8.5 7-1 0-2-.1-2.9-.4L4 21l1.2-3.6C4.1 16.1 3.5 14.4 3.5 12.5c0-3.9 3.8-7 8.5-7s8.5 3.1 8.5 7z" /></Svg>
);
