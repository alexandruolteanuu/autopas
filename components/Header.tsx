"use client";
// HEADER — logo text, căutare, iconuri (favorite / cont / coș) cu numărători,
// buton spre panoul de administrare pentru conturile de echipă, meniu mobil.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "./CartContext";
import { useFavorites } from "./FavoritesContext";
import { sbBrowser } from "@/lib/supabase";
import { CONFIG, PROGRAM, LIVRARE, telLink } from "@/lib/config";
import HartiLinks from "./HartiLinks";
import Logo from "./Logo";
import { IconTelefon } from "./Icoane";
// TEMPORAR — selector teme pentru client. Vezi instrucțiunile de ștergere din CLAUDE.md
import SelectorTeme from "./SelectorTeme";

const NAV = [
  { href: "/", t: "Acasă" },
  { href: "/piese", t: "Piese auto" },
  { href: "/cauta-dupa-masina", t: "Caută după mașină" },
  { href: "/preda-masina", t: "Predă mașina" },
  { href: "/programul-rabla", t: "Programul Rabla" },
  { href: "/despre-noi", t: "Despre noi" },
  { href: "/contact", t: "Contact" },
];

function Ic({ kind, className = "w-[22px] h-[22px]" }: { kind: string; className?: string }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {kind === "inima" && <path {...p} d="M12 20s-7-4.4-7-9.3A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7 3.1C19 15.6 12 20 12 20z" />}
      {kind === "cont" && <g {...p}><circle cx="12" cy="8.5" r="3.5" /><path d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" /></g>}
      {kind === "cos" && <g {...p}><path d="M3.5 5h2l2.2 9.4a2 2 0 0 0 2 1.6h6.7a2 2 0 0 0 2-1.5L20 8H6.2" /><circle cx="10" cy="19.5" r="1.3" /><circle cx="17" cy="19.5" r="1.3" /></g>}
      {kind === "admin" && <g {...p}><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><path d="M3.5 9h17M8 9v10.5" /></g>}
      {kind === "meniu" && <g {...p}><path d="M4 7h16M4 12h16M4 17h16" /></g>}
    </svg>
  );
}

export default function Header() {
  const path = usePathname();
  const { items } = useCart();
  const { nr } = useFavorites();
  const [open, setOpen] = useState(false);
  const [staff, setStaff] = useState(false);
  const [logat, setLogat] = useState(false);
  // Headerul devine sticlă doar după ce s-a defilat: în stare inițială e opac,
  // ca textul de sub el să nu treacă prin bară.
  const [defilat, setDefilat] = useState(false);
  useEffect(() => {
    const la = () => setDefilat(window.scrollY > 8);
    la(); window.addEventListener("scroll", la, { passive: true });
    return () => window.removeEventListener("scroll", la);
  }, []);

  useEffect(() => {
    const sb = sbBrowser(); if (!sb) return;
    const verifica = async () => {
      const { data } = await sb.auth.getUser();
      if (!data.user) { setStaff(false); setLogat(false); return; }
      setLogat(true);
      const { data: p } = await sb.from("profiles").select("role").eq("id", data.user.id).single();
      setStaff(["admin", "operator", "contabil"].includes(p?.role ?? ""));
    };
    verifica();
    const { data: sub } = sb.auth.onAuthStateChange(() => verifica());
    return () => sub.subscription.unsubscribe();
  }, []);

  // Ținta de atingere e de minimum 44x44: sub atât, degetul ratează.
  const IconLink = ({ href, kind, eticheta, badge }: { href: string; kind: string; eticheta: string; badge?: number }) => (
    <Link href={href} title={eticheta} aria-label={eticheta}
      className="relative flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] px-2 rounded-lg hover:bg-white/10 transition">
      <Ic kind={kind} />
      <span className="hidden lg:block text-[12px] leading-none text-headerText/70">{eticheta}</span>
      {badge ? (
        <span className="absolute top-0 right-0 bg-accent text-accentText text-[12px] font-bold rounded-full min-w-[20px] h-[20px] px-1 grid place-items-center">
          {badge}</span>
      ) : null}
    </Link>
  );

  return (
    <>
    <header className={`text-headerText sticky top-0 z-40 transition-colors duration-200 ${defilat ? "sticla-header" : "bg-headerBg"}`}>
      {/* Bara de sus: telefonul (țintă de atingere proprie) și hărțile.
          Programul și textul despre livrare apar doar de la sm/lg în sus — pe
          telefon nu încap lângă hărți și oricum sunt repetate în subsol. */}
      <div className="bg-black/25 text-[12px]">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-2 min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 min-w-0 flex-1">
            <a href={telLink()} className="inline-flex items-center gap-1.5 min-h-[44px] font-semibold hover:text-accent">
              <IconTelefon className="w-[15px] h-[15px]" />{CONFIG.telefonAfisat}
            </a>
            <span className="hidden sm:inline text-headerText/70">Program: {PROGRAM}</span>
            <span className="hidden lg:inline text-headerText/70">{LIVRARE}</span>
          </div>
          <div className="flex items-center shrink-0">
            <HartiLinks />
            {/* TEMPORAR — selector teme pentru client. Vezi instrucțiunile de ștergere din CLAUDE.md.
                Pe telefon stă în fâșia proprie de sub header, nu aici. */}
            <span className="hidden md:inline-flex ml-3"><SelectorTeme /></span>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-2 sm:gap-4 min-w-0">
        <Link href="/" aria-label="Autopas Dezmembrări — pagina principală"
          className="flex items-center shrink-0 min-h-[44px]">
          {/* Înălțimea logo-ului: aici o schimbi dacă vrei marca mai mare sau mai mică. */}
          <Logo className="h-10 min-[360px]:h-12 sm:h-16" eager />
        </Link>

        <form action="/piese" className="hidden md:flex flex-1 min-w-0">
          <input name="q" placeholder="Caută piesă sau cod OEM…"
            className="flex-1 min-w-0 rounded-l-xl bg-suprafata px-4 min-h-[44px] text-text text-base md:text-sm outline-none" />
          <button className="bg-accent text-accentText rounded-r-xl px-5 min-h-[44px] font-semibold text-sm shrink-0">Caută</button>
        </form>

        <nav className="ml-auto flex items-center gap-2 shrink-0">
          {staff && (
            <Link href="/admin" title="Panou de administrare"
              className="flex items-center gap-1.5 rounded-lg bg-accent text-accentText px-2.5 min-h-[44px] text-[12px] font-semibold hover:brightness-110 transition">
              <Ic kind="admin" className="w-[18px] h-[18px]" />
              <span className="hidden sm:block">Admin</span>
            </Link>
          )}
          <IconLink href="/favorite" kind="inima" eticheta="Favorite" badge={nr} />
          <IconLink href={logat ? "/cont" : "/autentificare"} kind="cont" eticheta="Contul meu" />
          <IconLink href="/cos" kind="cos" eticheta="Coșul meu" badge={items.length} />
          <button onClick={() => setOpen(!open)} aria-label="meniu"
            className="md:hidden grid place-items-center min-w-[44px] min-h-[44px] rounded-lg hover:bg-white/10"><Ic kind="meniu" /></button>
        </nav>
      </div>

      {/* căutare pe mobil */}
      <form action="/piese" className="md:hidden px-4 sm:px-6 pb-3 flex min-w-0">
        <input name="q" placeholder="Caută piesă sau cod OEM…"
          className="flex-1 min-w-0 rounded-l-xl bg-suprafata px-4 min-h-[44px] text-text text-base md:text-sm outline-none" />
        <button className="bg-accent text-accentText rounded-r-xl px-4 min-h-[44px] font-semibold text-sm shrink-0">Caută</button>
      </form>

      <nav className={`bg-steel/60 ${open ? "block" : "hidden"} md:block`}>
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row gap-x-1 text-[13.5px] font-medium">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)}
              className={`px-3 flex items-center min-h-[44px] ${path === n.href ? "bg-accent text-accentText" : "hover:bg-white/10"}`}>{n.t}</Link>
          ))}
        </div>
      </nav>
    </header>

    {/* TEMPORAR — selector teme pentru client. Vezi instrucțiunile de ștergere din CLAUDE.md.
        Sub 768px are fâșia lui pe toată lățimea, imediat sub header, ca să nu se
        mai suprapună cu nimic din bara de sus. */}
    <div className="md:hidden relative z-20 bg-headerBg text-headerText border-t border-white/10">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-2 flex items-center justify-end min-w-0">
        <SelectorTeme />
      </div>
    </div>
    </>
  );
}
