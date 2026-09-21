"use client";
// ============================================================
// BUTONUL DE DISTRIBUIRE de pe pagina de piesă (cerut de proprietar, 21 septembrie 2026).
//
// Pe telefon (și pe browserele care au meniul sistemului — Safari, Chrome pe Android,
// Edge pe Windows) deschide direct foaia de distribuire a telefonului: WhatsApp,
// Messenger, SMS, orice aplicație are omul. Acolo e cel mai des folosit butonul.
// Unde meniul sistemului nu există (Chrome/Firefox pe desktop), se deschide o listă
// scurtă: copiază linkul, WhatsApp, Facebook, e-mail.
//
// Adresa trimisă e cea CANONICĂ a piesei (fără parametri de filtrare sau de reclamă),
// ca un link distribuit să ducă mereu la aceeași pagină. Evenimentul `share` e cel
// standard din GA4; pleacă doar dacă vizitatorul a acceptat măsurarea (vezi `ev`).
// ============================================================
import { useEffect, useRef, useState } from "react";
import { IconDistribuie, IconLink, IconMail } from "./Icoane";
import WhatsAppIcon from "./WhatsAppIcon";
import { ev } from "@/lib/analytics";

type Props = {
  url: string; titlu: string; pret: string; codIntern?: string | null;
  /** „peste-poza": pe telefon stă peste colțul pozei, deci are fundal propriu și umbră,
   *  ca să se vadă pe orice fotografie. „linie": lângă titlu, pe desktop. */
  varianta?: "linie" | "peste-poza";
};

export default function DistribuiePiesa({ url, titlu, pret, codIntern, varianta = "linie" }: Props) {
  const [deschis, setDeschis] = useState(false);
  const [copiat, setCopiat] = useState(false);
  const cutie = useRef<HTMLDivElement>(null);
  const text = `${titlu} — ${pret}`;
  const masoara = (metoda: string) => ev("share", { method: metoda, content_type: "piesa", item_id: codIntern ?? url });

  // Lista se închide la clic în afara ei și la Escape.
  useEffect(() => {
    if (!deschis) return;
    const afara = (e: MouseEvent) => { if (!cutie.current?.contains(e.target as Node)) setDeschis(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setDeschis(false); };
    document.addEventListener("mousedown", afara);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", afara); document.removeEventListener("keydown", esc); };
  }, [deschis]);

  async function apasa() {
    // Meniul telefonului, dacă există. Dacă omul îl închide fără să aleagă ceva,
    // browserul aruncă AbortError — nu e o eroare, nu deschidem nimic în loc.
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try { await navigator.share({ title: titlu, text, url }); masoara("sistem"); return; }
      catch (e: any) { if (e?.name === "AbortError") return; }
    }
    setDeschis((d) => !d);
  }

  async function copiaza() {
    try { await navigator.clipboard.writeText(url); }
    catch {
      // Plasă pentru browserele care refuză clipboard-ul (pagină fără HTTPS, permisiuni).
      const t = document.createElement("textarea"); t.value = url; document.body.appendChild(t);
      t.select(); document.execCommand("copy"); t.remove();
    }
    masoara("copiere");
    setCopiat(true);
    setTimeout(() => { setCopiat(false); setDeschis(false); }, 1500);
  }

  const u = encodeURIComponent(url);
  const optiuni = [
    { nume: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, icon: <WhatsAppIcon className="w-[18px] h-[18px]" /> },
    { nume: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}`, icon: <span className="w-[18px] text-center font-bold leading-none">f</span> },
    { nume: "E-mail", href: `mailto:?subject=${encodeURIComponent(titlu)}&body=${encodeURIComponent(`${text}\n${url}`)}`, icon: <IconMail /> },
  ];

  return (
    <div ref={cutie} className="relative shrink-0">
      <button type="button" onClick={apasa} aria-haspopup="menu" aria-expanded={deschis}
        aria-label="Distribuie piesa" title="Distribuie piesa"
        className={varianta === "peste-poza"
          ? "w-11 h-11 rounded-full grid place-items-center bg-suprafata/95 text-text border border-chenar shadow-md active:scale-95 transition"
          : "w-11 h-11 rounded-full grid place-items-center border-2 border-[rgb(var(--chenar-puternic))] text-text accentuat-hover hover:border-accentChenar transition"}>
        <IconDistribuie className="w-5 h-5" />
      </button>

      {deschis && (
        <div role="menu" className="absolute right-0 top-full mt-2 z-30 w-56 rounded-xl border border-chenar bg-suprafata shadow-xl p-1.5 text-sm">
          <button type="button" role="menuitem" onClick={copiaza}
            className="w-full flex items-center gap-2.5 rounded-lg px-3 min-h-[44px] text-left hover:bg-suprafata2">
            <IconLink /> {copiat ? "✓ Link copiat" : "Copiază linkul"}
          </button>
          {optiuni.map((o) => (
            <a key={o.nume} role="menuitem" href={o.href} target="_blank" rel="noopener noreferrer"
              onClick={() => { masoara(o.nume.toLowerCase()); setDeschis(false); }}
              className="flex items-center gap-2.5 rounded-lg px-3 min-h-[44px] hover:bg-suprafata2">
              {o.icon} {o.nume}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
