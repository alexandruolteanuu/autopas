// Formatarea prețurilor în stil românesc: 1.150 lei
export function lei(n: number, sufix?: string | null) {
  const s = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 }).format(n);
  return `${s} lei${sufix ?? ""}`;
}
// Numărul comenzii NU se mai generează în browser: venea din Math.random și
// putea produce duplicate pe coloana `numar unique` (comandă pierdută).
// Acum îl dă serverul, dintr-un contor — vezi supabase/comanda-server.sql.
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
