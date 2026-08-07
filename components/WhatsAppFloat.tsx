"use client";
// Butonul plutitor de WhatsApp — pe tot site-ul (integrarea WhatsApp e activă din prima zi).
// Stă în colțul din stânga-jos, ca să nu acopere butoanele de acțiune din dreapta
// („Adaugă în coș" pe mobil) și rămâne fix la derulare.
// wa.me deschide singur aplicația pe telefon și WhatsApp Web pe calculator.
import { usePathname } from "next/navigation";
import WhatsAppIcon from "./WhatsAppIcon";

export default function WhatsAppFloat({ phone }: { phone: string }) {
  const path = usePathname();
  if (path.startsWith("/admin")) return null;
  return (
    <a href={`https://wa.me/${(phone || "").replace(/\D/g, "")}?text=${encodeURIComponent("Bună! Am o întrebare despre o piesă.")}`}
      target="_blank" rel="noopener noreferrer" aria-label="Scrie-ne pe WhatsApp"
      data-strat-fix className="fixed bottom-5 left-5 z-40 w-14 h-14 rounded-full bg-[#25D366] text-white shadow-lg grid place-items-center hover:scale-105 transition">
      <WhatsAppIcon className="w-8 h-8" />
    </a>
  );
}
