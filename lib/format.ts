// Formatarea prețurilor în stil românesc: 1.150 lei
export function lei(n: number, sufix?: string | null) {
  const s = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 }).format(n);
  return `${s} lei${sufix ?? ""}`;
}
export function nrComanda() {
  const an = new Date().getFullYear();
  const r = Math.floor(10000 + Math.random() * 89999);
  return `AP-${an}-${r}`;
}
export const CURIERI = [
  { id: "fan",     nume: "FAN Courier",     detalii: "livrare 24–48h, ramburs inclus", pret: 19.9 },
  { id: "cargus",  nume: "Cargus",          detalii: "livrare 24–48h",                 pret: 21.5 },
  { id: "sameday", nume: "Sameday easybox", detalii: "ridici din locker",              pret: 14.9 },
];

// Numărătorile pentru filtru: câte piese publicate există per model ("m<id>") și per marcă ("b<id>").
import type { Model } from "./types";
export function fitmentCounts(rows: { model_ids: number[] | null }[], models: Model[]) {
  const counts: Record<string, number> = {};
  const brandOf: Record<number, number> = {};
  models.forEach((m) => { brandOf[m.id] = m.brand_id; counts[`m${m.id}`] = 0; });
  for (const r of rows) for (const id of r.model_ids ?? []) {
    counts[`m${id}`] = (counts[`m${id}`] ?? 0) + 1;
    const b = brandOf[id]; if (b) counts[`b${b}`] = (counts[`b${b}`] ?? 0) + 1;
  }
  return counts;
}
