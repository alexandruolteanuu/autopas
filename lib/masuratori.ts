// ============================================================
// ID-URILE DE MĂSURARE, CITITE DIN BROWSER — o singură cerere pentru toate
//
// DE CE DIN BROWSER, ȘI NU PE PROPS DE LA LAYOUT
// Motivul e măsurat, nu teoretic (28 august 2026): `/cos`, `/checkout` și
// `/favorite` sunt pagini STATICE, iar tot ce randează layout-ul pentru ele —
// inclusiv un id venit pe props — rămâne prins în HTML-ul generat la build.
// Rezultatul era că analytics-ul pornea pe paginile dinamice și tăcea exact pe
// cele unde se întâmplă vânzarea. Verificat în browser: `/piese` avea scriptul,
// `/cos` nu. Cu Google Ads și Meta ar fi fost și mai grav: conversia se petrece
// tocmai pe paginile acelea.
//
// DE CE UN SINGUR MODUL
// Le cer două componente (`Analytics` și `MetaPixel`), din locuri diferite ale
// arborelui, la momente diferite. Fără promisiunea reținută mai jos, fiecare ar
// fi trimis propria cerere REST, la fiecare navigare — două cereri identice a
// căror singură menire e să afle două șiruri care nu se schimbă niciodată în
// timpul unei vizite.
//
// Cererea pleacă DOAR după ce vizitatorul a acceptat ceva (componentele o cer
// abia atunci), deci pentru cine refuză nu se întâmplă absolut nimic în plus.
// `masuratori_publice()` întoarce exclusiv id-uri publice — parola FAN Courier
// și cheia Netopia stau în același rând și rămân închise (vezi migrarea 33).
// ============================================================
import { sbBrowser } from "./supabase";

export type Masuratori = {
  /** Google Analytics 4 — „G-XXXXXXXXXX". */
  ga4: string;
  /** Google Ads — „AW-XXXXXXXXX". */
  google_ads: string;
  /** Eticheta conversiei „comandă plasată", partea de după bară. */
  ads_conversie: string;
  /** Meta Pixel — 15 cifre. */
  meta_pixel: string;
  /** Codul de verificare a domeniului din Meta Business Manager. */
  meta_domeniu: string;
};

const GOL: Masuratori = { ga4: "", google_ads: "", ads_conversie: "", meta_pixel: "", meta_domeniu: "" };

let cerere: Promise<Masuratori> | null = null;

/** Citește id-urile o singură dată pe încărcare de pagină. Dacă apelul cade din
 *  orice motiv, întoarce totul gol — adică nu se încarcă nimic. Un site care nu
 *  poate citi configurarea nu are voie să presupună că are acordul. */
export function citesteMasuratori(): Promise<Masuratori> {
  if (cerere) return cerere;
  cerere = (async () => {
    const sb = sbBrowser();
    if (!sb) return GOL;
    try {
      const { data, error } = await sb.rpc("masuratori_publice");
      if (error || !data || typeof data !== "object") return GOL;
      const d = data as Record<string, unknown>;
      const s = (k: string) => (typeof d[k] === "string" ? (d[k] as string).trim() : "");
      return {
        ga4: s("ga4"),
        google_ads: s("google_ads"),
        ads_conversie: s("ads_conversie"),
        meta_pixel: s("meta_pixel"),
        meta_domeniu: s("meta_domeniu"),
      };
    } catch {
      return GOL;
    }
  })();
  return cerere;
}

/** Eticheta completă de conversie, `AW-123456789/AbC-D_efGh`.
 *
 *  Se compune AICI, din id-ul contului și din etichetă, nu se lipește întreagă
 *  în Setări: așa nu se poate ajunge la o etichetă care aparține altui cont
 *  Google Ads decât cel configurat — o greșeală de copiere care ar raporta
 *  vânzările noastre în contul altcuiva și n-ar da niciun semn. */
export const conversieCompleta = (m: Masuratori) =>
  m.google_ads && m.ads_conversie ? `${m.google_ads}/${m.ads_conversie}` : "";
