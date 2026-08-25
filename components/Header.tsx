"use client";
// HEADER — logo text, căutare, iconuri (favorite / cont / coș) cu numărători,
// buton spre panoul de administrare pentru conturile de echipă, meniu mobil.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "./CartContext";
import { useFavorites } from "./FavoritesContext";
import { sbBrowser } from "@/lib/supabase";
import { CONFIG, PROGRAM, PROGRAM_SCURT, LIVRARE, telLink } from "@/lib/config";
import HartiLinks from "./HartiLinks";
import Logo from "./Logo";
import ComutatorTema from "./ComutatorTema";
import { IconTelefon } from "./Icoane";

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
        <span className="absolute top-0 right-0 bg-accent text-accentContrast text-[12px] font-bold rounded-full min-w-[20px] h-[20px] px-1 grid place-items-center">
          {badge}</span>
      ) : null}
    </Link>
  );

  return (
    <header className={`text-headerText sticky top-0 z-40 transition-colors duration-200 ${defilat ? "sticla-header" : "bg-headerBg"}`}>
      {/* Bara de sus: telefonul (țintă de atingere proprie), programul și hărțile.
          Pe telefon programul apare în formă scurtă („L–V 8:30–17:30"), lipit de
          număr, ca lumea să nu sune noaptea. Costă zero înălțime: bara rămâne la
          44px, cât ținta de atingere a numărului. Textul despre livrare rămâne
          ascuns până la lg — nu încape și oricum e repetat în subsol.
          Programul NU e link; doar numărul este. */}
      <div className="bg-black/25 text-[12px]">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-2 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-3 min-w-0 flex-1">
            <a href={telLink()} className="inline-flex items-center gap-1.5 min-h-[44px] font-semibold hover:text-accent">
              <IconTelefon className="w-[15px] h-[15px]" />{CONFIG.telefonAfisat}
            </a>
            {/* Sub 360px (iPhone SE) fiecare pixel contează: separatorul „·" pică,
                spațierea scade, iar programul rămâne întreg. Așa bara stă pe un
                singur rând de 44px până la 320px inclusiv. */}
            <span className="sm:hidden text-headerText/70 whitespace-nowrap">
              <span className="hidden min-[360px]:inline">· </span>{PROGRAM_SCURT}</span>
            <span className="hidden sm:inline text-headerText/70">Program: {PROGRAM}</span>
            <span className="hidden lg:inline text-headerText/70">{LIVRARE}</span>
          </div>
          <div className="flex items-center shrink-0">
            <HartiLinks />
          </div>
        </div>
      </div>

      {/* Spațiile dintre elementele barei se strâng pe ecran mic și se lărgesc pe
          cel mare. Comutatorul de temă a adăugat o a cincea iconiță de 44px, iar
          la 320px bara ieșea din ecran cu 26px (la un cont de echipă, cu butonul
          „Admin", cu 40px la 360px și cu 33px la 768px). Țintele rămân toate de
          44px — se strânge doar aerul dintre ele, nu ele.

          Punctul cel mai strâns e md (768px): acolo apare bara de căutare, care
          nu coboară sub 360px, lângă cinci iconițe și butonul „Admin". De aceea
          spațierea scade din nou la md și se lărgește abia la lg. */}
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-1 sm:gap-2 md:gap-1 lg:gap-4 min-w-0">
        <Link href="/" aria-label="Autopas Dezmembrări — pagina principală"
          className="flex items-center shrink-0 min-h-[44px]">
          {/* Înălțimea logo-ului: aici o schimbi dacă vrei marca mai mare sau mai mică.
              Din 24 august 2026 fișierul e tăiat la conținut, deci înălțimea de aici
              e chiar înălțimea logoului vizibil — nu mai există margine transparentă.
              Desktop: 64px = înălțimea rândului (88px) minus 24px de aer.
              Sub 768px: plafon de 36px, ca bara să nu mănânce ecranul telefonului. */}
          <Logo className="h-8 min-[360px]:h-9 md:h-16" eager />
        </Link>

        {/* Bara de căutare, CENTRATĂ în golul dintre logo și iconițe.
            Zona din mijloc ia tot spațiul elastic (`flex-1 min-w-0`) și își
            centrează conținutul; bara umple zona până la plafonul de 520px, care
            se aplică abia de la 1280px. Între 768 și 1280 `w-full` o face să
            ocupe toată zona, deci centrarea nu are ce muta — exact ce trebuie:
            acolo lățimea contează mai mult decât simetria.
            `min-w-[360px]` rămâne: sub atât nu mai încape un cod OEM de tipul
            63117338709. Dacă golul ar scădea sub 360px, bara nu se strânge sub
            prag — lizibilitatea bate simetria. */}
        <div className="hidden md:flex flex-1 min-w-0 justify-center">
          <form action="/piese" className="flex w-full min-w-[360px] xl:max-w-[520px]">
            <input name="q" placeholder="Caută piesă…"
              className="flex-1 min-w-0 rounded-l-xl bg-suprafata px-4 min-h-[44px] text-text text-base md:text-sm outline-none" />
            <button className="bg-accent text-accentContrast rounded-r-xl px-5 min-h-[44px] font-semibold text-sm shrink-0">Caută</button>
          </form>
        </div>

        <nav className="ml-auto flex items-center gap-0 sm:gap-1 lg:gap-2 shrink-0">
          {staff && (
            /* Sub 360px butonul nu încape lângă cele patru iconițe — headerul ieșea
               din ecran (340px pe un ecran de 320px). Acolo calea de acces e intrarea
               „Panou de administrare" din meniul mobil, de mai jos. */
            <Link href="/admin" title="Panou de administrare"
              /* `px-2` până la lg: între 768 și 1023, cu bara de căutare de minimum
                 360px și cinci iconițe, cei 4px în plus scoteau headerul din ecran
                 cu 1px la un cont de echipă. De la lg, unde apare și eticheta
                 „Admin", butonul își recapătă aerul. */
              className="hidden min-[360px]:flex items-center gap-1.5 rounded-lg bg-accent text-accentContrast px-2 lg:px-2.5 min-h-[44px] text-[12px] font-semibold hover:brightness-110 transition">
              <Ic kind="admin" className="w-[18px] h-[18px]" />
              {/* Eticheta apare abia de la lg. Între 768 și 1023, pe un cont de
                  echipă, cuvântul „Admin" (~51px) plus bara de căutare de minimum
                  360px nu încăpeau — headerul ieșea cu 28px din ecran la 768px.
                  Butonul rămâne țintă de 44px și păstrează `title`, deci nu pierde
                  nimic funcțional. */}
              <span className="hidden lg:block">Admin</span>
            </Link>
          )}
          {/* Comutatorul de temă stă lângă grupul cont/coș, pe toate lățimile: e o
              singură iconiță de 44px, deci nu lățește bara nici la 320px. */}
          <ComutatorTema />
          <IconLink href="/favorite" kind="inima" eticheta="Favorite" badge={nr} />
          <IconLink href={logat ? "/cont" : "/autentificare"} kind="cont" eticheta="Contul meu" />
          <IconLink href="/cos" kind="cos" eticheta="Coșul meu" badge={items.length} />
          <button onClick={() => setOpen(!open)} aria-label="meniu"
            className="md:hidden grid place-items-center min-w-[44px] min-h-[44px] rounded-lg hover:bg-white/10"><Ic kind="meniu" /></button>
        </nav>
      </div>

      {/* căutare pe mobil */}
      <form action="/piese" className="md:hidden px-4 sm:px-6 pb-3 flex min-w-0">
        <input name="q" placeholder="Caută piesă…"
          className="flex-1 min-w-0 rounded-l-xl bg-suprafata px-4 min-h-[44px] text-text text-base md:text-sm outline-none" />
        <button className="bg-accent text-accentContrast rounded-r-xl px-4 min-h-[44px] font-semibold text-sm shrink-0">Caută</button>
      </form>

      <nav className={`bg-steel/60 ${open ? "block" : "hidden"} md:block`}>
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row gap-x-1 text-[13.5px] font-medium">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)}
              className={`px-3 flex items-center min-h-[44px] ${path === n.href ? "bg-accent text-accentContrast" : "hover:bg-white/10"}`}>{n.t}</Link>
          ))}
          {/* Panoul de administrare, doar în meniul mobil și doar pentru echipă.
              Pe desktop există butonul „Admin" din bara de sus; sub 360px acela e
              ascuns fiindcă nu încape, deci asta rămâne singura cale de acces din
              header. Clienții nu văd intrarea — `staff` e fals pentru ei. */}
          {staff && (
            <Link href="/admin" onClick={() => setOpen(false)}
              className="md:hidden px-3 flex items-center gap-2 min-h-[44px] border-t border-white/10 text-accent font-semibold">
              <Ic kind="admin" className="w-[18px] h-[18px]" />Panou de administrare
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
