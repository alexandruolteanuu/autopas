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
import type { Brand, Model } from "./types";

/**
 * Mărcile care merită arătate în filtru: cele cu cel puțin o piesă publicată.
 *
 * Tabela `brands` e completă intenționat — are și mărcile de care nu avem încă
 * piese (BYD, Cherry, OMODA, JAECOO, rămase din lista de dealer). Curățenia se
 * face la afișare, nu prin ștergere: dacă mâine intră o piesă de BYD, marca apare
 * singură, fără nicio migrare. Invers, o marcă rămasă fără piese dispare din
 * meniu, dar nu și din bază, deci istoricul nu se pierde.
 *
 * `counts` vine din `counturiPeModel`, care numără DOAR piesele publicate — deci
 * regula ține cont automat și de piesele depublicate, și de cele epuizate.
 */
export function marciCuPiese(brands: Brand[], counts: Record<string, number>) {
  return brands.filter((b) => (counts[`b${b.id}`] ?? 0) > 0);
}
/**
 * Contoarele pentru filtru: „m<id>" = piese pe model, „b<id>" = piese pe marcă.
 *
 * Rândurile vin din view-ul `numar_piese_pe_model` (supabase/numar-piese-pe-model.sql),
 * NU din `products`. Varianta veche, `fitmentCounts`, primea toate piesele
 * publicate și le număra aici — dar PostgREST taie tăcut la 1.000 de rânduri,
 * deci numărătoarea se făcea pe 1.000 din 8.754 de piese. Nu ieșeau cifre puțin
 * greșite, ci mărci dispărute: `marciCuPiese` de mai jos citește ACELEAȘI
 * contoare, așa că din 38 de mărci cu piese se vedeau 16 (fără Dacia, fără
 * Toyota, fără Volvo).
 *
 * Funcția s-a redenumit intenționat: schimbarea de semnătură face compilatorul
 * să arate fiecare loc care mai folosea varianta veche, în loc să treacă tăcut.
 *
 * Modelele fără nicio piesă primesc explicit 0, ca `VehicleFilter` să scrie
 * „· 0 piese" în loc să nu scrie nimic.
 */
export function counturiPeModel(
  randuri: { model_id: number; brand_id: number; nr_piese: number }[],
  models: Model[],
) {
  const counts: Record<string, number> = {};
  models.forEach((m) => { counts[`m${m.id}`] = 0; });
  for (const r of randuri) {
    counts[`m${r.model_id}`] = (counts[`m${r.model_id}`] ?? 0) + r.nr_piese;
    counts[`b${r.brand_id}`] = (counts[`b${r.brand_id}`] ?? 0) + r.nr_piese;
  }
  return counts;
}

/**
 * Numele modelului fără codul generației de la final: „Golf 5" -> „Golf",
 * „A4 B7" -> „A4", „A3 8P (2003–2012)" -> „A3", „Seria 1 E87" -> „Seria 1".
 *
 * Folosită de paginile de mașină ca să știe ce generații sunt ale ACELUIAȘI
 * model (nivelul 2 de relevanță din caruselul de piese compatibile). În proiect,
 * o generație e un rând separat în `models` — „Golf 5" și „Golf 6" sunt două
 * modele, nu unul cu două generații — deci fără regula asta n-ar exista nicio
 * cale de a le lega.
 *
 * Codul generației se recunoaște după FORMĂ, nu dintr-o listă: ultimul cuvânt,
 * de cel mult 3 caractere, care ori conține o cifră („5", „B7", „8P", „9N",
 * „E87"), ori e numai majuscule („FY", „CR", „III"). Se taie doar dacă mai
 * rămâne ceva înaintea lui.
 *
 * Așa „Seria 1 E87" dă „Seria 1", nu „Seria" — altfel Seria 1, Seria 3 și
 * Seria 5 ar fi ajuns toate același model. „Land Cruiser" și „A4 B9 Allroad"
 * rămân întregi: ultimul cuvânt e prea lung ca să fie cod de generație.
 *
 * Verificată pe toate cele 540 de modele din bază la 28 august 2026: dă 56 de
 * grupuri, toate corecte („Caddy III/IV/V", „Logan MCV" lângă „Logan 1/2/3",
 * „Passat CC" lângă „Passat B5…B9"). Cine schimbă regula reia verificarea aia.
 */
export function bazaModel(nume: string) {
  const fara = nume.replace(/\([^)]*\)/g, "").trim();   // anii dintre paranteze
  const parti = fara.split(/\s+/).filter(Boolean);
  if (parti.length < 2) return fara;
  const ultim = parti[parti.length - 1];
  if (ultim.length <= 3 && (/\d/.test(ultim) || /^[A-Z]+$/.test(ultim)))
    return parti.slice(0, -1).join(" ");
  return fara;
}
