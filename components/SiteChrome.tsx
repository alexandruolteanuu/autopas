"use client";
// Îmbrăcămintea site-ului public (header/footer/cookies) — NU se aplică în /admin,
// care are propriul schelet de lucru.
import { usePathname } from "next/navigation";
import Header from "./Header";
import Footer from "./Footer";
import CookieBanner from "./CookieBanner";
import type { Firma, Vacanta } from "@/lib/settings";
import WhatsAppFloat from "./WhatsAppFloat";
import { VacantaProvider } from "./VacantaContext";
import Analytics from "./Analytics";
import BaraProgres from "./BaraProgres";

export default function SiteChrome({ children, waPhone, firma, vacanta, marciTop }:
  { children: React.ReactNode; waPhone: string; firma?: Firma; vacanta?: Vacanta;
    marciTop?: { slug: string; nume: string; nr_piese: number }[] }) {
  const path = usePathname();
  if (path.startsWith("/admin")) return <>{children}</>;
  return (
    <VacantaProvider vacanta={vacanta}>
      {/* Prima în arbore: trebuie să poată apărea peste orice altceva. */}
      <BaraProgres />
      <Header vacanta={vacanta} />
      <main className="min-h-[60vh]">{children}</main>
      <Footer firma={firma} marciTop={marciTop} />
      <CookieBanner />
      <WhatsAppFloat phone={waPhone} />
      {/* Montat AICI, nu în layout: `SiteChrome` iese devreme pentru /admin, deci
          traficul echipei nu ajunge niciodată în statistici. */}
      <Analytics />
    </VacantaProvider>
  );
}
