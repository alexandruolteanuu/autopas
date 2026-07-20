"use client";
// Butonul plutitor de WhatsApp — pe tot site-ul (integrarea WhatsApp e activă din prima zi).
import { usePathname } from "next/navigation";

export default function WhatsAppFloat({ phone }: { phone: string }) {
  const path = usePathname();
  if (path.startsWith("/admin")) return null;
  return (
    <a href={`https://wa.me/${phone}?text=${encodeURIComponent("Bună! Am o întrebare despre o piesă.")}`}
      target="_blank" rel="noopener noreferrer" aria-label="Scrie-ne pe WhatsApp"
      className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-[#25D366] shadow-lg grid place-items-center hover:scale-105 transition">
      <svg viewBox="0 0 32 32" className="w-8 h-8" fill="#fff"><path d="M16 3C9.4 3 4 8.4 4 15c0 2.6.8 5 2.3 7L4 29l7.2-2.3c1.9 1 4 1.6 6.3 1.6 6.6 0 12-5.4 12-12S22.6 3 16 3zm0 21.8c-2 0-3.9-.6-5.5-1.6l-.4-.2-4.3 1.4 1.4-4.1-.3-.4C5.7 18.3 5 16.7 5 15 5 9 9.9 4 16 4s11 5 11 11-4.9 9.8-11 9.8zm6-7.3c-.3-.2-1.9-1-2.2-1.1-.3-.1-.5-.2-.7.2-.2.3-.8 1.1-1 1.3-.2.2-.4.2-.7.1-.3-.2-1.4-.5-2.6-1.6-1-.9-1.6-1.9-1.8-2.2-.2-.3 0-.5.1-.7l.5-.6c.2-.2.2-.3.3-.6.1-.2 0-.4 0-.6-.1-.2-.7-1.8-1-2.4-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.1 1.1-1.1 2.7s1.2 3.1 1.3 3.4c.2.2 2.3 3.6 5.7 5 3.4 1.4 3.4.9 4 .9.6-.1 1.9-.8 2.2-1.5.3-.8.3-1.4.2-1.5-.1-.2-.3-.2-.6-.4z"/></svg>
    </a>
  );
}
