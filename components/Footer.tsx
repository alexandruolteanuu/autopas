import Link from "next/link";
import type { Firma } from "@/lib/settings";
import { FIRMA_IMPLICITA } from "@/lib/settings";
// Footer complet — modelul cerut de client: toate paginile legale + bannere ANPC/SOL vizibile.
export default function Footer({ firma = FIRMA_IMPLICITA }: { firma?: Firma }) {
  return (
    <footer className="bg-ink text-white mt-16">
      <div className="mx-auto max-w-6xl px-4 py-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 text-sm">
        <div>
          <span className="block font-disp font-bold text-[24px]">AUTOPAS</span>
          <span className="block font-disp text-[9px] tracking-[0.5em] text-white/60 mb-3">DEZMEMBRĂRI</span>
          <p className="text-white/70 leading-relaxed">Piese auto second-hand testate, din dezmembrări autorizate. Garanție 30 de zile la toate piesele, livrare rapidă în toată România.</p>
          <p className="mt-3 text-white/70">📍 Piatra-Neamț, jud. Neamț</p>
        </div>
        <div>
          <h4 className="font-disp font-semibold tracking-wide text-[12px] text-white/50 mb-3">Pagini principale</h4>
          <ul className="space-y-1.5 text-white/80">
            <li><Link href="/piese" className="hover:text-acc">Piese auto</Link></li>
            <li><Link href="/cauta-dupa-masina" className="hover:text-acc">Caută după mașină</Link></li>
            <li><Link href="/preda-masina" className="hover:text-acc">Predă mașina la dezmembrat</Link></li>
            <li><Link href="/programul-rabla" className="hover:text-acc">Programul Rabla</Link></li>
            <li><Link href="/cos" className="hover:text-acc">Coș cumpărături</Link></li>
            <li><Link href="/faq" className="hover:text-acc">Întrebări frecvente</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-disp font-semibold tracking-wide text-[12px] text-white/50 mb-3">Informații</h4>
          <ul className="space-y-1.5 text-white/80">
            <li><Link href="/contact" className="hover:text-acc">Contact</Link></li>
            <li><Link href="/despre-noi" className="hover:text-acc">Despre noi</Link></li>
            <li><Link href="/legal/politica-de-confidentialitate" className="hover:text-acc">Politica de confidențialitate</Link></li>
            <li><Link href="/legal/termeni-si-conditii" className="hover:text-acc">Termeni și condiții</Link></li>
            <li><Link href="/legal/livrare" className="hover:text-acc">Livrare</Link></li>
            <li><Link href="/legal/politica-de-cookies" className="hover:text-acc">Politica de cookies</Link></li>
            <li><Link href="/legal/setari-cookie-uri" className="hover:text-acc">Setări cookie-uri</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-disp font-semibold tracking-wide text-[12px] text-white/50 mb-3">Retur și garanție</h4>
          <ul className="space-y-1.5 text-white/80">
            <li><Link href="/legal/certificat-garantie" className="hover:text-acc">Certificat de garanție</Link></li>
            <li><Link href="/legal/politica-de-retur" className="hover:text-acc">Politica de retur — 14 zile</Link></li>
            <li><Link href="/formular-retur" className="hover:text-acc">Formular de retur</Link></li>
            <li><Link href="/legal/anpc-si-sol" className="hover:text-acc">A.N.P.C.</Link></li>
            <li><Link href="/legal/anpc-si-sol" className="hover:text-acc">A.N.P.C. — SAL</Link></li>
          </ul>
          {/* Bannerele ANPC/SOL — imagini standard pe fundal alb.
              IMPORTANT: înlocuiește public/anpc-sal.png și public/anpc-sol.png cu fișierele oficiale (pași în README). */}
          <div className="mt-4 space-y-2">
            <a href="https://anpc.ro/ce-este-sal/" target="_blank" rel="noopener noreferrer" className="block w-[250px]">
              <img src="/anpc-sal.png" alt="ANPC — Soluționarea Alternativă a Litigiilor" className="w-full rounded-md" /></a>
            <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" className="block w-[250px]">
              <img src="/anpc-sol.png" alt="SOL — Soluționarea Online a Litigiilor" className="w-full rounded-md" /></a>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 text-[12px] text-white/50">
        <div className="mx-auto max-w-6xl px-4 py-4 flex flex-wrap gap-2 justify-between">
          <span>© {new Date().getFullYear()} {firma.denumire}{firma.cui ? ` · CUI ${firma.cui}` : ""}{firma.reg_com ? ` · Reg. Com. ${firma.reg_com}` : ""} · Autorizat pentru tratarea vehiculelor scoase din uz</span>
          <span>VISA · Mastercard · Ramburs</span>
        </div>
      </div>
    </footer>
  );
}
