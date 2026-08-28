// ============================================================
// EVENIMENTE GOOGLE ANALYTICS 4
//
// Un singur loc prin care pleacă orice eveniment. Dacă `gtag` nu există —
// fiindcă n-avem ID configurat, fiindcă vizitatorul n-a acceptat statistica,
// fiindcă suntem în dezvoltare sau în /admin — funcția nu face nimic și nu
// aruncă. Așa componentele pot chema `ev(...)` fără nicio verificare proprie.
//
// REGULA DE AUR: **niciun dat personal**. Fără nume, telefon, e-mail, adresă.
// Doar identificatori de piese, categorii, cantități și valori. Un `purchase`
// pleacă cu numărul comenzii, care e un cod intern (AP-2026-01000), nu o
// identitate.
// ============================================================
import type { Product } from "./types";

declare global {
  interface Window { gtag?: (...args: any[]) => void; dataLayer?: any[] }
}

// ---- COADA ----
// `gtag` apare în pagină abia după ce se încarcă scriptul de la Google
// (`afterInteractive`), iar efectele React rulează ÎNAINTE de asta. Fără coadă,
// fiecare eveniment de la PRIMA încărcare a unei pagini se pierdea tăcut:
// `view_item` la deschiderea unei piese dintr-un link, `view_cart`, și — cel mai
// grav — `purchase`, care în plus se marca drept trimis și nu mai reveni
// niciodată. Măsurat în browser la 28 august 2026: pe navigare din interiorul
// aplicației evenimentele plecau, la încărcare directă nu.
//
// Plafon mic: dacă analytics-ul nu pornește niciodată (vizitatorul a refuzat),
// coada n-are voie să crească la nesfârșit într-o filă lăsată deschisă.
const coada: [string, Record<string, unknown>][] = [];
const MAX_COADA = 50;

/** Trimite un eveniment. Dacă `gtag` nu e încă în pagină, îl păstrează pentru
 *  momentul în care apare; dacă nu apare niciodată, nu se întâmplă nimic. */
export function ev(nume: string, parametri: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  if (typeof window.gtag !== "function") {
    if (coada.length < MAX_COADA) coada.push([nume, parametri]);
    return;
  }
  trimite(nume, parametri);
}

function trimite(nume: string, parametri: Record<string, unknown>) {
  try { window.gtag!("event", nume, parametri); }
  catch { /* niciodată nu stricăm pagina pentru o statistică */ }
}

/** Chemată de `components/Analytics.tsx` imediat ce `gtag` e gata. */
export function golesteCoada() {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  while (coada.length) {
    const [nume, parametri] = coada.shift()!;
    trimite(nume, parametri);
  }
}

/** Forma pe care o așteaptă GA4 pentru o piesă. Prețul e cel afișat, cu TVA. */
export function piesaGa(p: Pick<Product, "id" | "nume" | "pret_lei"> & {
  cod_intern?: string | null; categories?: { nume?: string } | null;
}, extra: Record<string, unknown> = {}) {
  return {
    item_id: p.cod_intern || String(p.id),
    item_name: p.nume,
    price: Number(p.pret_lei),
    quantity: 1,
    ...(p.categories?.nume ? { item_category: p.categories.nume } : {}),
    ...extra,
  };
}

export const MONEDA = "RON";
