// ============================================================
// EVENIMENTELE DE MĂSURARE — Google Analytics 4, Google Ads și Meta Pixel
//
// Un singur loc prin care pleacă orice eveniment, către toate cele trei. Dacă
// un instrument lipsește — n-are id configurat, vizitatorul n-a acceptat, suntem
// în /admin sau în dezvoltare — funcția nu face nimic și nu aruncă. Așa
// componentele pot chema `ev(...)` fără nicio verificare proprie.
//
// DE CE UN SINGUR APEL, ȘI NU CÂTE UNUL PENTRU FIECARE INSTRUMENT
// Locurile din care se trimit evenimente sunt aceleași opt: vizualizare piesă,
// coș, adăugare, ștergere, checkout, comandă, cerere de piesă, cerere de
// predare. Dacă fiecare ar trebui să știe și de gtag, și de fbq, atunci fiecare
// eveniment nou adăugat de aici înainte ar pleca, în practică, doar la unul
// dintre ele — iar diferența nu se vede niciodată din cod, doar în rapoarte,
// peste săptămâni. Traducerea GA4 → Meta se face O DATĂ, mai jos, în `LA_META`.
//
// REGULA DE AUR: **niciun dat personal**. Fără nume, telefon, e-mail, adresă.
// Doar identificatori de piese, categorii, cantități și valori. Un `purchase`
// pleacă cu numărul comenzii, care e un cod intern (AP-2026-01000), nu o
// identitate.
//
// ID-UL UNEI PIESE E ACELAȘI PESTE TOT: `cod_intern` (AP-000123). Același cod
// stă în `g:id` din feed-ul Merchant Center și în `id` din catalogul Meta (vezi
// lib/feed.ts). Dacă cele două s-ar despărți vreodată, reclamele dinamice ar
// arăta altă piesă decât cea privită — defect invizibil în cod și scump în bani.
// ============================================================
import type { Product } from "./types";

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
    fbq?: (...args: any[]) => void;
  }
}

// ---- COZILE ----
// `gtag` și `fbq` apar în pagină abia după ce se încarcă scripturile
// (`afterInteractive`), iar efectele React rulează ÎNAINTE de asta. Fără coadă,
// fiecare eveniment de la PRIMA încărcare a unei pagini se pierdea tăcut:
// `view_item` la deschiderea unei piese dintr-un link, `view_cart`, și — cel mai
// grav — `purchase`, care în plus se marca drept trimis și nu mai revenea
// niciodată. Măsurat în browser la 28 august 2026: pe navigare din interiorul
// aplicației evenimentele plecau, la încărcare directă nu.
//
// Două cozi, nu una: cele două scripturi pornesc independent (unul poate fi
// blocat de un ad-blocker, celălalt nu) și au voie prin consimțăminte diferite —
// statistica se poate accepta fără reclame.
//
// Plafon mic: dacă un instrument nu pornește niciodată, coada n-are voie să
// crească la nesfârșit într-o filă lăsată deschisă.
const MAX_COADA = 50;
const coadaGa: [string, Record<string, unknown>][] = [];
const coadaMeta: [string, string, Record<string, unknown>][] = [];
const coadaAds: Record<string, unknown>[] = [];

/** Eticheta de conversie Google Ads pentru „comandă plasată", sub forma
 *  `AW-123456789/AbC-D_efGh`. O pune `components/Analytics.tsx` după ce
 *  citește configurarea; cât e goală, nu se trimite nicio conversie. */
let conversieAds = "";
export function seteazaConversiaAds(v: string) { conversieAds = v; }

/**
 * Trimite un eveniment. Numele sunt cele din GA4 (`view_item`, `add_to_cart`,
 * `purchase`…), fiindcă acolo se uită omul în rapoarte; traducerea către Meta o
 * face funcția.
 */
export function ev(nume: string, parametri: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  laGa(nume, parametri);
  laMeta(nume, parametri);
  laAds(nume, parametri);
}

// ---- GOOGLE ANALYTICS 4 ----
function laGa(nume: string, parametri: Record<string, unknown>) {
  if (typeof window.gtag !== "function") {
    if (coadaGa.length < MAX_COADA) coadaGa.push([nume, parametri]);
    return;
  }
  try { window.gtag("event", nume, parametri); }
  catch { /* niciodată nu stricăm pagina pentru o statistică */ }
}

/** Chemată de `components/Analytics.tsx` imediat ce `gtag` e gata. Golește și
 *  conversiile Google Ads: ambele au nevoie de același `gtag`, deci ar fi două
 *  apeluri cu exact aceeași condiție de pornire. */
export function golesteCoada() {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  while (coadaGa.length) {
    const [nume, parametri] = coadaGa.shift()!;
    laGa(nume, parametri);
  }
  if (!conversieAds) return;
  while (coadaAds.length) trimiteConversia(coadaAds.shift()!);
}

// ---- GOOGLE ADS ----
/**
 * Conversia „comandă plasată".
 *
 * Google Ads nu are nevoie de restul evenimentelor: audiențele de remarketing
 * vin prin legătura GA4 ↔ Google Ads (se face o singură dată, din interfață),
 * iar acolo ajung deja `view_item`, `add_to_cart` și celelalte. Ce NU poate veni
 * de acolo e conversia, care trebuie raportată explicit, cu eticheta ei, ca
 * licitarea automată să știe ce a produs bani.
 *
 * `transaction_id` e numărul comenzii: Google îl folosește ca să nu numere de
 * două ori aceeași comandă dacă pagina de mulțumire e reîncărcată. (Noi oprim
 * asta oricum, în `GaPurchase`, dar apărarea dublă nu costă nimic.)
 */
function laAds(nume: string, p: Record<string, unknown>) {
  if (nume !== "purchase") return;
  // Coadă PROPRIE, nu cea a lui GA. O conversie pusă în coada GA s-ar goli mai
  // târziu prin `laGa` și ar pleca la Google Analytics ca eveniment cu numele
  // ăsta, nu la Google Ads ca o conversie — adică o conversie pierdută și un
  // eveniment inventat în rapoarte. Coada trebuie să existe și aici pentru că
  // `purchase` pleacă la prima încărcare a paginii de mulțumire, adesea înainte
  // ca gtag să fi ajuns în pagină.
  if (typeof window.gtag !== "function" || !conversieAds) {
    if (coadaAds.length < MAX_COADA) coadaAds.push(p);
    return;
  }
  trimiteConversia(p);
}

function trimiteConversia(p: Record<string, unknown>) {
  try {
    window.gtag!("event", "conversion", {
      send_to: conversieAds,
      value: p.value,
      currency: p.currency,
      transaction_id: p.transaction_id,
    });
  } catch { /* la fel: o conversie neraportată nu are voie să strice pagina */ }
}

// ---- META PIXEL (FACEBOOK + INSTAGRAM) ----

/**
 * Traducerea numelor. Meta are o listă închisă de „evenimente standard", pe care
 * le înțelege algoritmul de optimizare; ce nu e în listă ajunge „eveniment
 * personalizat" și nu se poate folosi la licitare.
 *
 * Ce NU are corespondent rămâne netrimis, intenționat: `view_cart`,
 * `remove_from_cart` și `select_item` n-au echivalent standard, iar un eveniment
 * personalizat inventat de noi ar umple contul cu date pe care nimeni nu le va
 * folosi niciodată.
 */
const LA_META: Record<string, string> = {
  view_item: "ViewContent",
  add_to_cart: "AddToCart",
  begin_checkout: "InitiateCheckout",
  purchase: "Purchase",
  generate_lead: "Lead",
};

/** Forma pe care o așteaptă Meta, construită din parametrii GA4. */
function parametriMeta(p: Record<string, unknown>) {
  const items = Array.isArray(p.items) ? (p.items as Record<string, unknown>[]) : [];
  const out: Record<string, unknown> = {};
  if (items.length) {
    out.content_type = "product";
    out.content_ids = items.map((i) => String(i.item_id ?? ""));
    out.contents = items.map((i) => ({ id: String(i.item_id ?? ""), quantity: Number(i.quantity ?? 1) }));
    out.num_items = items.reduce((s, i) => s + Number(i.quantity ?? 1), 0);
  }
  if (p.value !== undefined) out.value = p.value;
  if (p.currency !== undefined) out.currency = p.currency;
  // Numărul comenzii, ca Meta să nu numere de două ori aceeași vânzare.
  if (p.transaction_id !== undefined) out.order_id = p.transaction_id;
  return out;
}

function laMeta(nume: string, parametri: Record<string, unknown>) {
  const std = LA_META[nume];
  if (!std) return;
  const p = parametriMeta(parametri);
  if (typeof window.fbq !== "function") {
    if (coadaMeta.length < MAX_COADA) coadaMeta.push(["track", std, p]);
    return;
  }
  try { window.fbq("track", std, p); }
  catch { /* la fel ca la GA */ }
}

/** Chemată de `components/MetaPixel.tsx` imediat ce `fbq` e gata. */
export function golesteCoadaMeta() {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  while (coadaMeta.length) {
    const [tip, nume, p] = coadaMeta.shift()!;
    try { window.fbq!(tip, nume, p); } catch { /* ignorat */ }
  }
}

// ---- FORME COMUNE ----

/** Forma pe care o așteaptă GA4 pentru o piesă. Prețul e cel afișat, cu TVA.
 *
 *  `item_id` = `cod_intern`. E ACELAȘI id ca în feed-urile de produse (vezi
 *  antetul fișierului) — condiția fără de care reclamele dinamice nu funcționează. */
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
