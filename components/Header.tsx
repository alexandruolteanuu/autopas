"use client";
// Header-ul site-ului: logo DOAR TEXT (decizia curentă), meniu fără Blog, coș cu numărător live.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useCart } from "./CartContext";

const NAV = [
  { href: "/", t: "Acasă" },
  { href: "/piese", t: "Piese auto" },
  { href: "/cauta-dupa-masina", t: "Caută după mașină" },
  { href: "/preda-masina", t: "Predă mașina" },
  { href: "/programul-rabla", t: "Programul Rabla" },
  { href: "/despre-noi", t: "Despre noi" },
  { href: "/contact", t: "Contact" },
];

export default function Header() {
  const path = usePathname();
  const { items } = useCart();
  const [open, setOpen] = useState(false);
  return (
    <header className="bg-ink text-white sticky top-0 z-40">
      <div className="bg-black/25 text-[12px]">
        <div className="mx-auto max-w-6xl px-4 py-1.5 flex justify-between gap-3">
          <span>☎ {process.env.NEXT_PUBLIC_PHONE_DISPLAY ?? "0740 123 456"} · L–V 08–17, S 09–13</span>
          <span className="hidden sm:block">Livrare 24–48h în toată România · <Link href="/cont" className="underline underline-offset-2">Contul meu</Link></span>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-4">
        {/* LOGO — doar text, fără simbol (deocamdată) */}
        <Link href="/" className="leading-none shrink-0">
          <span className="block font-disp font-bold text-[26px] tracking-wide">AUTOPAS</span>
          <span className="block font-disp font-medium text-[10px] tracking-[0.5em] text-white/60">DEZMEMBRĂRI</span>
        </Link>
        <form action="/piese" className="hidden md:flex flex-1">
          <input name="q" placeholder="Caută piesă, cod OEM sau descrie liber… ex. «far stânga golf 6»"
            className="flex-1 rounded-l-lg px-4 py-2.5 text-ink text-sm outline-none" />
          <button className="bg-acc rounded-r-lg px-5 font-disp font-bold text-sm uppercase">Caută</button>
        </form>
        <Link href="/cos" className="relative ml-auto md:ml-0 font-semibold text-sm">
          Coșul meu
          {items.length > 0 && (
            <span className="absolute -top-2 -right-4 bg-acc text-[11px] font-bold rounded-full w-5 h-5 grid place-items-center">{items.length}</span>
          )}
        </Link>
        <button onClick={() => setOpen(!open)} className="md:hidden text-2xl leading-none" aria-label="meniu">≡</button>
      </div>
      <nav className={`bg-steel/60 ${open ? "block" : "hidden"} md:block`}>
        <div className="mx-auto max-w-6xl px-4 flex flex-col md:flex-row gap-x-1 text-[13.5px] font-medium">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)}
              className={`px-3 py-2.5 ${path === n.href ? "bg-acc text-white" : "hover:bg-white/10"}`}>{n.t}</Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
