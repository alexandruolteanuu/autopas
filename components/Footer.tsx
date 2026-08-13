import Link from "next/link";
import type { Firma } from "@/lib/settings";
import { FIRMA_IMPLICITA } from "@/lib/settings";
import { CONFIG, PROGRAM, ADRESA, telLink } from "@/lib/config";
import HartiLinks from "./HartiLinks";
import Logo from "./Logo";
import { IconTelefon, IconPin } from "./Icoane";
// Footer complet — modelul cerut de client: toate paginile legale + bannere ANPC/SOL vizibile.
export default function Footer({ firma = FIRMA_IMPLICITA }: { firma?: Firma }) {
  return (
    <footer className="bg-footerBg text-footerText mt-16">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 text-sm">
        <div>
          <Logo className="h-[68px] mb-3" />
          <p className="text-footerText/70 leading-relaxed">Piese auto second-hand testate, din dezmembrări autorizate. Garanție 90 de zile conform OUG 140/2021, livrare în 1–3 zile lucrătoare în toată România.</p>
          <p className="mt-3 text-footerText/70 flex gap-2"><IconPin className="w-[16px] h-[16px] shrink-0 mt-0.5" /><span>{ADRESA.scurt}<br />
            <span className="text-footerText/50 text-[12px]">{ADRESA.reper}</span></span></p>
          {/* Contact — telefon și program, aceleași valori ca în header (lib/config.ts) */}
          <p className="mt-1">
            <a href={telLink()} className="inline-flex items-center gap-2 min-h-[44px] font-semibold hover:text-accent"><IconTelefon className="w-[16px] h-[16px]" />{CONFIG.telefonAfisat}</a>
          </p>
          <p className="text-footerText/70">Program: {PROGRAM}</p>
          {/* Waze și Google Maps — linkuri către locație */}
          <div className="mt-3"><HartiLinks variant="footer" /></div>
        </div>
        <div>
          <h4 className="font-disp font-semibold tracking-wide text-[12px] text-footerText/50 mb-3">Pagini principale</h4>
          <ul className="space-y-1.5 text-footerText/80">
            <li><Link href="/piese" className="hover:text-accent">Piese auto</Link></li>
            <li><Link href="/cauta-dupa-masina" className="hover:text-accent">Caută după mașină</Link></li>
            <li><Link href="/preda-masina" className="hover:text-accent">Predă mașina la dezmembrat</Link></li>
            <li><Link href="/programul-rabla" className="hover:text-accent">Programul Rabla</Link></li>
            <li><Link href="/cos" className="hover:text-accent">Coș cumpărături</Link></li>
            <li><Link href="/faq" className="hover:text-accent">Întrebări frecvente</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-disp font-semibold tracking-wide text-[12px] text-footerText/50 mb-3">Informații</h4>
          <ul className="space-y-1.5 text-footerText/80">
            <li><Link href="/contact" className="hover:text-accent">Contact</Link></li>
            <li><Link href="/despre-noi" className="hover:text-accent">Despre noi</Link></li>
            <li><Link href="/legal/politica-de-confidentialitate" className="hover:text-accent">Politica de confidențialitate</Link></li>
            <li><Link href="/legal/termeni-si-conditii" className="hover:text-accent">Termeni și condiții</Link></li>
            <li><Link href="/legal/livrare" className="hover:text-accent">Livrare</Link></li>
            <li><Link href="/legal/politica-de-cookies" className="hover:text-accent">Politica de cookies</Link></li>
            <li><Link href="/legal/setari-cookie-uri" className="hover:text-accent">Setări cookie-uri</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-disp font-semibold tracking-wide text-[12px] text-footerText/50 mb-3">Retur și garanție</h4>
          <ul className="space-y-1.5 text-footerText/80">
            <li><Link href="/legal/certificat-garantie" className="hover:text-accent">Certificat de garanție</Link></li>
            <li><Link href="/legal/politica-de-retur" className="hover:text-accent">Politica de retur — 14 zile</Link></li>
            <li><Link href="/formular-retur" className="hover:text-accent">Formular de retur</Link></li>
            <li><Link href="/legal/anpc-si-sol" className="hover:text-accent">A.N.P.C.</Link></li>
            <li><Link href="/legal/anpc-si-sol" className="hover:text-accent">A.N.P.C. — SAL</Link></li>
          </ul>
          {/* Bannerele oficiale ANPC — dimensiunea legală 250×50 px (Ordinul 449/2022).
              Fișierele din public/anpc-sal.png și public/anpc-sol.png trebuie să fie cele OFICIALE,
              descărcate de pe anpc.ro/ce-este-sal. */}
          {/* Pe subsolul negru, cele două fișiere (care au fundal deschis) ar apărea ca
              două pete răsărite din senin. Containerul deschis de mai jos le adună într-o
              zonă delimitată, ca să arate intenționat, nu accidental. Fișierele rămân
              neatinse: fără redimensionare, fără filtre CSS — sunt materiale oficiale. */}
          <div className="mt-4 inline-flex flex-wrap gap-2 justify-center sm:justify-start
                          bg-imagineBg/10 border border-white/10 rounded-[var(--r-mediu)] p-3">
            <a href="https://anpc.ro/ce-este-sal/" target="_blank" rel="noopener noreferrer"
              className="block w-[250px] max-w-full">
              <img src="/anpc-sal.png" alt="ANPC — Soluționarea Alternativă a Litigiilor"
                width={250} height={50} className="w-[250px] max-w-full h-auto" /></a>
            <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer"
              className="block w-[250px] max-w-full">
              <img src="/anpc-sol.png" alt="SOL — Soluționarea Online a Litigiilor"
                width={250} height={50} className="w-[250px] max-w-full h-auto" /></a>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 text-[12px] text-footerText/50">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap gap-2 justify-between">
          {/* Datele firmei vin din Admin → Setări → Date firmă (tabela settings), nu din cod. */}
          <span>© {new Date().getFullYear()} {firma.denumire}{firma.cui ? ` · CUI ${firma.cui}` : ""}{firma.reg_com ? ` · Reg. Com. ${firma.reg_com}` : ""}{firma.adresa ? ` · Sediu social: ${firma.adresa}` : ""} · Autorizat pentru tratarea vehiculelor scoase din uz</span>
          <span>VISA · Mastercard · Ramburs</span>
        </div>
      </div>
    </footer>
  );
}
