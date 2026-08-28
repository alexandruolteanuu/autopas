// ============================================================
// CONSIMȚĂMÂNTUL PENTRU COOKIE-URI DE STATISTICĂ — o singură sursă
//
// Alegerea vizitatorului stă de mult în `localStorage`, cheia `autopas_cookies`,
// cu trei stări: lipsă (încă n-a ales), „necesare" (a refuzat), „toate" (a
// acceptat). Scriu în ea două locuri — bannerul de la prima vizită și panoul din
// „Setări cookie-uri" — iar de acum o CITEȘTE și Google Analytics.
//
// De ce un modul separat și un eveniment propriu:
// `localStorage` nu anunță pe nimeni când se schimbă în aceeași filă. Evenimentul
// nativ `storage` se declanșează doar în CELELALTE file. Fără `anunta()`, omul ar
// apăsa „Accept toate" și nu s-ar întâmpla nimic până la următoarea reîncărcare —
// adică exact vizita pe care voiam s-o măsurăm s-ar pierde.
// ============================================================

export const CHEIE = "autopas_cookies";
export const EVENIMENT = "autopas:consimtamant";

export type Consimtamant = "nesetat" | "necesare" | "toate";

/** Citește alegerea. Pe server, sau cu stocarea blocată, întoarce „nesetat" —
 *  adică cea mai prudentă variantă: fără statistică. */
export function citesteConsimtamant(): Consimtamant {
  if (typeof window === "undefined") return "nesetat";
  try {
    const v = localStorage.getItem(CHEIE);
    return v === "toate" || v === "necesare" ? v : "nesetat";
  } catch {
    return "nesetat";
  }
}

/** Scrie alegerea ȘI anunță pagina, ca analytics-ul să reacționeze pe loc. */
export function scrieConsimtamant(v: "necesare" | "toate") {
  try { localStorage.setItem(CHEIE, v); } catch { /* stocare blocată: alegerea ține doar cât pagina */ }
  anunta(v);
}

function anunta(v: Consimtamant) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENIMENT, { detail: v }));
}

/** Se abonează la schimbări: din aceeași filă (evenimentul nostru) și din
 *  celelalte file ale aceluiași browser (evenimentul nativ `storage`). */
export function ascultaConsimtamant(cb: (v: Consimtamant) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const local = (e: Event) => cb((e as CustomEvent).detail as Consimtamant);
  const altaFila = (e: StorageEvent) => { if (e.key === CHEIE) cb(citesteConsimtamant()); };
  window.addEventListener(EVENIMENT, local);
  window.addEventListener("storage", altaFila);
  return () => {
    window.removeEventListener(EVENIMENT, local);
    window.removeEventListener("storage", altaFila);
  };
}

/** Singura întrebare care contează pentru analytics. */
export const areVoieStatistica = (v: Consimtamant) => v === "toate";
