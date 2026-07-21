"use client";
// Săgeata de întoarcere — revine la pagina anterioară; dacă intri direct pe link, duce la listare.
import { useRouter } from "next/navigation";

export default function BackLink({ fallback = "/piese" }: { fallback?: string }) {
  const router = useRouter();
  return (
    <button onClick={() => { if (window.history.length > 1) router.back(); else router.push(fallback); }}
      aria-label="Înapoi"
      className="inline-flex items-center gap-1.5 rounded-lg border-2 border-line px-2.5 py-1.5 text-[13px] font-medium text-steel hover:border-acc hover:text-acc transition">
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 18l-6-6 6-6" /></svg>
      Înapoi
    </button>
  );
}
