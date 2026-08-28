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

export default function SiteChrome({ children, waPhone, firma, vacanta }:
  { children: React.ReactNode; waPhone: string; firma?: Firma; vacanta?: Vacanta }) {
  const path = usePathname();
  if (path.startsWith("/admin")) return <>{children}</>;
  return (
    <VacantaProvider vacanta={vacanta}>
      <Header vacanta={vacanta} />
      <main className="min-h-[60vh]">{children}</main>
      <Footer firma={firma} />
      <CookieBanner />
      <WhatsAppFloat phone={waPhone} />
      {/* Montat AICI, nu în layout: `SiteChrome` iese devreme pentru /admin, deci
          traficul echipei nu ajunge niciodată în statistici. */}
      <Analytics />
    </VacantaProvider>
  );
}
