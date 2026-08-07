// Formatarea prețurilor în stil românesc: 1.150 lei
export function lei(n: number, sufix?: string | null) {
  const s = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 }).format(n);
  return `${s} lei${sufix ?? ""}`;
}
// Numărul comenzii NU se mai generează în browser: venea din Math.random și
// putea produce duplicate pe coloana `numar unique` (comandă pierdută).
// Acum îl dă serverul, dintr-un contor — vezi supabase/comanda-server.sql.
// Acordul corect în română pentru numărul de piese: „1 piesă", „3 piese",
// „20 de piese". Regula: singular la 1, iar „de" când ultimele două cifre
// sunt 00 sau de la 20 în sus (20 de piese, dar 101 piese). Zero face
// excepție — se spune „0 piese", nu „0 de piese".
export function nrPiese(n: number) {
  if (n === 1) return "1 piesă";
  if (n === 0) return "0 piese";
  const ultimele = n % 100;
  return `${n}${ultimele === 0 || ultimele >= 20 ? " de" : ""} piese`;
}

// Textul de căutare fără diacritice și cu litere mici, ca „turbina" să
// găsească „Turbină" și „skoda" să găsească „Škoda". Trebuie să dea același
// rezultat ca funcția text_cautare din bază (supabase/cautare-fara-diacritice.sql),
// care folosește `unaccent`.
//
// normalize("NFD") desparte litera de semnul ei (ă -> a + căciulă), iar apoi
// ștergem semnele. Așa prindem toate diacriticele, nu doar cele românești.
export function textCautare(t: string) {
  return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

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
