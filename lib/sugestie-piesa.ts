// SUGESTIA DIN TITLU — pentru formularul „Adaugă piesă" din admin.
//
// Operatorul scrie titlul, iar formularul își completează singur câmpurile
// GOALE: marca, modelul, anii, compatibilitatea afișată, categoria,
// subcategoria și ilustrația de rezervă. Nimic nu se salvează fără „Publică
// piesa", iar ce a ales omul nu se suprascrie niciodată.
//
// DE UNDE VINE FIECARE
//   · marca, modelul, anii — `sugestieDinTitlu` din lib/import/potrivire.mjs,
//     adică exact regulile importului (CLAUDE.md: potrivirea din titluri nu
//     are voie să existe în altă parte). Măsurat pe cele 8.687 de piese cu
//     model: sugerează la 91,4%, și din sugestii 99,5% sunt bune.
//   · categoria, subcategoria, ilustrația — din piesele pe care le AVEM deja:
//     se caută cele cu aceleași cuvinte de piesă („oglinda stanga") și câștigă
//     categoria cea mai frecventă printre ele. Catalogul de 8.800 de piese e
//     cel mai bun dicționar pe care îl avem: cine a scris „Usa" a pus-o de
//     fiecare dată la „Ușă față" sau „Ușă spate".
//
// Numărătoarea se face în bază (`sugestie_clasificare`, migrarea 42), nu aici:
// „bara" se potrivește pe aproape 1.000 de piese, iar PostgREST ar tăia tăcut la
// 1.000 de rânduri (vezi CLAUDE.md).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Brand, Model } from "./types";
import { textCautare, tipareCautare } from "./format";

export type Sugestie = {
  brand: Brand | null;
  model: Model | null;
  ani: string | null;
  categorie_id: number | null;
  subcategorie_id: number | null;
  art: string | null;
  /** Câte piese asemănătoare au votat, și câte dintre ele au categoria aleasă. */
  voturi: { total: number; categoria: number; cuvinte: string[] } | null;
};

/** Sub atâtea piese asemănătoare, căutarea se lărgește (se renunță la ultimul cuvânt). */
const MINIM_VOTURI = 3;

// Cuvinte care nu spun nimic despre CE piesă e: de legătură, și motorizările
// („Motor CRL Vw Passat B8 2.0 TDI" trebuie să voteze după „motor", nu după „tdi").
const DE_LEGATURA = new Set([
  "cu", "si", "de", "din", "pentru", "fara", "la", "pe", "sau", "buc", "set", "facelift", "original", "originala",
  "tdi", "tsi", "tfsi", "fsi", "dci", "cdi", "hdi", "crdi", "tdci", "cdti", "jtd", "jtdm", "vtec", "benzina", "diesel", "motorina",
]);

/** Cuvintele care descriu PIESA: titlul fără marcă, model, ani, coduri de motor. */
export function cuvintePiesa(titlu: string, cuvinteMasina: string[]): string[] {
  const masina = new Set(cuvinteMasina);
  return textCautare(titlu).replace(/[^a-z0-9]+/g, " ").split(" ")
    .filter((c) => c.length >= 3 && !/\d/.test(c) && !masina.has(c) && !DE_LEGATURA.has(c))
    .filter((c, i, v) => v.indexOf(c) === i)
    .slice(0, 4);
}

type Vot = { categorie_id: number; subcategorie_id: number | null; art: string | null; nr: number };

/** Categoria cu cele mai multe voturi, apoi subcategoria cea mai votată DIN ea. */
export function alegeClasificarea(voturi: Vot[]) {
  const suma = <K extends string | number>(chei: [K, number][]) => {
    const m = new Map<K, number>();
    for (const [k, n] of chei) m.set(k, (m.get(k) ?? 0) + n);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1])[0] ?? null;
  };
  const total = voturi.reduce((s, v) => s + Number(v.nr), 0);
  const cat = suma(voturi.map((v) => [v.categorie_id, Number(v.nr)] as [number, number]));
  if (!cat) return null;
  const dinCat = voturi.filter((v) => v.categorie_id === cat[0]);
  // „0" ține locul lui „fără subcategorie", ca să poată câștiga și varianta asta.
  const sub = suma(dinCat.map((v) => [v.subcategorie_id ?? 0, Number(v.nr)] as [number, number]));
  const art = suma(voturi.filter((v) => v.art).map((v) => [v.art as string, Number(v.nr)] as [string, number]));
  return {
    categorie_id: cat[0], categoria: cat[1], total,
    subcategorie_id: sub && sub[0] !== 0 ? sub[0] : null,
    art: art?.[0] ?? null,
  };
}

export async function sugereaza(
  sb: SupabaseClient, titlu: string, taxonomie: { brands: Brand[]; models: Model[] },
): Promise<Sugestie> {
  // Import la cerere: modulul trage după el catalogul pieseauto.ro (~3.000 de
  // rânduri), de care formularul are nevoie doar când chiar se cere o sugestie.
  const { sugestieDinTitlu } = await import("./import/potrivire.mjs");
  const s = sugestieDinTitlu(titlu, taxonomie) as {
    brand: Brand | null; model: Model | null; an_min: number | null; an_max: number | null; cuvinteMasina: string[];
  };
  const rez: Sugestie = {
    brand: s.brand, model: s.model,
    // Aceeași formă ca la import (lib/import/rand.mjs): „2008–2012" sau „2010".
    ani: s.an_min ? (s.an_min === s.an_max ? String(s.an_min) : `${s.an_min}–${s.an_max}`) : null,
    categorie_id: null, subcategorie_id: null, art: null, voturi: null,
  };

  // Se pleacă de la toate cuvintele de piesă și se renunță pe rând la ultimul,
  // până când există destule piese asemănătoare. Primul cuvânt spune aproape
  // mereu ce e piesa („Oglinda", „Far", „Bara"), cele de la coadă o îngustează.
  const cuvinte = cuvintePiesa(titlu, s.cuvinteMasina ?? []);
  for (let n = cuvinte.length; n >= 1; n--) {
    const folosite = cuvinte.slice(0, n);
    const { data, error } = await sb.rpc("sugestie_clasificare", { p_tipare: tipareCautare(folosite.join(" ")) });
    if (error) break;
    const ales = alegeClasificarea((data ?? []) as Vot[]);
    if (ales && (ales.total >= MINIM_VOTURI || n === 1)) {
      rez.categorie_id = ales.categorie_id;
      rez.subcategorie_id = ales.subcategorie_id;
      rez.art = ales.art;
      rez.voturi = { total: ales.total, categoria: ales.categoria, cuvinte: folosite };
      break;
    }
  }
  return rez;
}
