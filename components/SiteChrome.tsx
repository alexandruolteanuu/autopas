"use client";
// Îmbrăcămintea site-ului public (header/footer/cookies) — NU se aplică în /admin,
// care are propriul schelet de lucru.
import { usePathname } from "next/navigation";
import Header from "./Header";
import Footer from "./Footer";
import CookieBanner from "./CookieBanner";
import type { Firma } from "@/lib/settings";
import WhatsAppFloat from "./WhatsAppFloat";

export default function SiteChrome({ children, waPhone, firma }: { children: React.ReactNode; waPhone: string; firma?: Firma }) {
  const path = usePathname();
  if (path.startsWith("/admin")) return <>{children}</>;
  return (
    <>
      <Header />
      <main className="min-h-[60vh]">{children}</main>
      <Footer firma={firma} />
      <CookieBanner />
      <WhatsAppFloat phone={waPhone} />
    </>
  );
}
