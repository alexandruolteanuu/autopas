// ============================================================
// CONSIMȚĂMÂNTUL PENTRU COOKIE-URI — o singură sursă
//
// Alegerea vizitatorului stă în `localStorage`, cheia `autopas_cookies`. O
// citesc și o scriu bannerul de la prima vizită, panoul din „Setări cookie-uri",
// Google Analytics, Google Ads și pixelul Meta.
//
// DOUĂ SCOPURI, DOUĂ ÎNTREBĂRI SEPARATE (28 august 2026 → 4 septembrie 2026)
// Până acum exista un singur lucru de acceptat: statistica. Odată cu Google Ads
// și Facebook Ads apare al doilea, cu totul altă natură — urmărirea pentru
// reclame. Legea (și bunul-simț) cer ca omul să poată accepta unul fără
// celălalt, nu să i se dea un buton „toate" care înghite și ce n-a cerut.
//
// De aceea cheia are acum PATRU valori scrise, nu două:
//   „necesare"   → nici statistică, nici marketing
//   „statistica" → doar măsurarea traficului (GA4)
//   „marketing"  → doar reclamele (Google Ads, Meta Pixel)
//   „toate"      → și una, și alta
//
// Cele două scopuri sunt independente, fiecare cu comutatorul lui în „Setări
// cookie-uri". Combinația „marketing fără statistică" e ciudată, dar e alegerea
// omului, nu a noastră; un comutator care aprinde tăcut și un altul e exact
// genul de tipar pe care legea îl numește manipulare.
//
// Valorile vechi rămân valabile: „necesare" și „toate" înseamnă exact ce
// însemnau. Nimeni nu e întrebat din nou fiindcă am adăugat o treaptă la
// mijloc — doar cei care aleg de acum au opțiunea în plus.
//
// De ce un modul separat și un eveniment propriu:
// `localStorage` nu anunță pe nimeni când se schimbă în aceeași filă. Evenimentul
// nativ `storage` se declanșează doar în CELELALTE file. Fără `anunta()`, omul ar
// apăsa „Accept toate" și nu s-ar întâmpla nimic până la următoarea reîncărcare —
// adică exact vizita pe care voiam s-o măsurăm s-ar pierde.
// ============================================================

export const CHEIE = "autopas_cookies";
export const EVENIMENT = "autopas:consimtamant";

export type Consimtamant = "nesetat" | "necesare" | "statistica" | "marketing" | "toate";
/** Ce se poate alege efectiv (fără „nesetat", care e doar starea inițială). */
export type Alegere = "necesare" | "statistica" | "marketing" | "toate";

/** Citește alegerea. Pe server, sau cu stocarea blocată, întoarce „nesetat" —
 *  adică cea mai prudentă variantă: fără statistică și fără reclame. */
export function citesteConsimtamant(): Consimtamant {
  if (typeof window === "undefined") return "nesetat";
  try {
    const v = localStorage.getItem(CHEIE);
    return v === "toate" || v === "necesare" || v === "statistica" || v === "marketing" ? v : "nesetat";
  } catch {
    return "nesetat";
  }
}

/** Scrie alegerea ȘI anunță pagina, ca măsurarea să reacționeze pe loc. */
export function scrieConsimtamant(v: Alegere) {
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

/** Măsurarea traficului (Google Analytics 4). */
export const areVoieStatistica = (v: Consimtamant) => v === "toate" || v === "statistica";
/** Urmărirea pentru reclame (Google Ads, Meta Pixel).
 *  „Încă n-a ales" se tratează, ca întotdeauna, drept refuz. */
export const areVoieMarketing = (v: Consimtamant) => v === "toate" || v === "marketing";

/** Alegerea care corespunde unei perechi de comutatoare. Există ca să nu se
 *  scrie tabelul ăsta în două locuri (bannerul și panoul de setări). */
export function alegereDin(statistica: boolean, marketing: boolean): Alegere {
  if (statistica && marketing) return "toate";
  if (statistica) return "statistica";
  if (marketing) return "marketing";
  return "necesare";
}

/**
 * Șterge cookie-urile lăsate de instrumentele de măsurare, la retragerea
 * acordului.
 *
 * Oprirea măsurării (`consent update: denied`) împiedică scrierea unor cookie-uri
 * NOI, dar nu le atinge pe cele existente: `_ga` are 2 ani, `_gcl_au` și `_fbp`
 * câte 90 de zile. Ar rămâne în browser mult după ce omul s-a răzgândit.
 * Politica de cookies îi spune cum să le șteargă singur; e mai corect să le
 * ștergem noi.
 *
 * Un cookie se șterge punându-i o dată de expirare din trecut, dar NUMAI dacă
 * nimerim exact perechea domeniu+cale cu care a fost pus. Google și Meta le pun
 * pe domeniul de bază (`.autopas-dezmembrari.ro`), ca să meargă și pe
 * subdomenii, așa că încercăm toate variantele plauzibile — o ștergere care nu
 * nimerește nimic nu strică nimic.
 *
 * `_fbc` (clickul venit dintr-o reclamă Facebook) și `_fbp` (identificatorul de
 * browser) sunt puse de pixel; `_gcl_*` de Google Ads. Toate sunt cookie-uri de
 * primă parte, scrise de JavaScript, deci le putem chiar șterge — spre deosebire
 * de cele puse de facebook.com în domeniul lor, pe care nu le putem atinge și
 * despre care politica de cookies spune explicit că se sting din setările Meta.
 */
export function stergeCookieuriMasurare(grupuri: { statistica?: boolean; marketing?: boolean }) {
  if (typeof document === "undefined") return;

  // Se șterge NUMAI grupul retras. Cine acceptă statistica dar refuză reclamele
  // trebuie să rămână cu `_ga` și fără `_fbp` — o ștergere „pe tot" ar reseta la
  // fiecare pagină exact măsurarea pe care omul a acceptat-o.
  const statistica = (n: string) => n === "_ga" || n.startsWith("_ga_") || n === "_gid";
  const marketing = (n: string) =>
    n === "_gcl_au" || n === "_gcl_aw" || n === "_gcl_dc" || n.startsWith("_gac_") || // Google Ads
    n === "_fbp" || n === "_fbc";                                                     // Meta Pixel
  const desters = (n: string) =>
    (grupuri.statistica === true && statistica(n)) || (grupuri.marketing === true && marketing(n));

  const nume = document.cookie
    .split(";")
    .map((c) => c.split("=")[0].trim())
    .filter(desters);
  if (nume.length === 0) return;

  const gazda = location.hostname;
  const parti = gazda.split(".");
  const domenii: (string | null)[] = [null, gazda, "." + gazda];
  // domeniul de bază, pentru cazul cu subdomeniu (www.exemplu.ro -> .exemplu.ro)
  if (parti.length > 2) domenii.push("." + parti.slice(-2).join("."));

  for (const n of nume)
    for (const d of domenii)
      document.cookie =
        `${n}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/` + (d ? `; domain=${d}` : "");
}
