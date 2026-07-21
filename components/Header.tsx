"use client";
// HEADER — logo text, căutare, iconuri (favorite / cont / coș) cu numărători,
// buton spre panoul de administrare pentru conturile de echipă, meniu mobil.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "./CartContext";
import { useFavorites } from "./FavoritesContext";
import { sbBrowser } from "@/lib/supabase";

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

  const IconLink = ({ href, kind, eticheta, badge }: { href: string; kind: string; eticheta: string; badge?: number }) => (
    <Link href={href} title={eticheta} aria-label={eticheta}
      className="relative flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg hover:bg-white/10 transition">
      <Ic kind={kind} />
      <span className="hidden lg:block text-[10px] leading-none text-white/70">{eticheta}</span>
      {badge ? (
        <span className="absolute -top-0.5 right-0.5 bg-acc text-white text-[10px] font-bold rounded-full min-w-[17px] h-[17px] px-1 grid place-items-center">
          {badge}</span>
      ) : null}
    </Link>
  );

  return (
    <header className="bg-ink text-white sticky top-0 z-40">
      <div className="bg-black/25 text-[12px]">
        <div className="mx-auto max-w-6xl px-4 py-1.5 flex justify-between gap-3">
          <span>☎ {process.env.NEXT_PUBLIC_PHONE_DISPLAY ?? "0740 123 456"} · L–V 08–17, S 09–13</span>
          <span className="hidden sm:block">Livrare 1–3 zile lucrătoare în toată România</span>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-3 sm:gap-4">
        <Link href="/" className="leading-none shrink-0">
          <span className="block font-disp font-bold text-[24px] sm:text-[26px] tracking-wide">AUTOPAS</span>
          <span className="block font-disp font-medium text-[9px] sm:text-[10px] tracking-[0.45em] text-white/60">DEZMEMBRĂRI</span>
        </Link>

        <form action="/piese" className="hidden md:flex flex-1 min-w-0">
          <input name="q" placeholder="Caută piesă sau cod OEM…"
            className="flex-1 min-w-0 rounded-l-xl px-4 py-2.5 text-ink text-sm outline-none" />
          <button className="bg-acc rounded-r-xl px-5 font-semibold text-sm">Caută</button>
        </form>

        <nav className="ml-auto flex items-center gap-0.5 sm:gap-1">
          {staff && (
            <Link href="/admin" title="Panou de administrare"
              className="flex items-center gap-1.5 rounded-lg bg-acc px-2.5 py-2 text-[12px] font-semibold hover:brightness-110 transition">
              <Ic kind="admin" className="w-[18px] h-[18px]" />
              <span className="hidden sm:block">Admin</span>
            </Link>
          )}
          <IconLink href="/favorite" kind="inima" eticheta="Favorite" badge={nr} />
          <IconLink href={logat ? "/cont" : "/autentificare"} kind="cont" eticheta="Contul meu" />
          <IconLink href="/cos" kind="cos" eticheta="Coșul meu" badge={items.length} />
          <button onClick={() => setOpen(!open)} aria-label="meniu"
            className="md:hidden px-2 py-1 rounded-lg hover:bg-white/10"><Ic kind="meniu" /></button>
        </nav>
      </div>

      {/* căutare pe mobil */}
      <form action="/piese" className="md:hidden px-4 pb-3 flex">
        <input name="q" placeholder="Caută piesă sau cod OEM…"
          className="flex-1 min-w-0 rounded-l-xl px-4 py-2.5 text-ink text-sm outline-none" />
        <button className="bg-acc rounded-r-xl px-4 font-semibold text-sm">Caută</button>
      </form>

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
