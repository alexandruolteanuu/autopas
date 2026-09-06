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
  return `${n} ${cuvantPiese(n)}`;
}

// Doar cuvântul, fără cifră. Există separat fiindcă pe cardurile de categorie
// numărul se scrie mare, iar cuvântul mic — două elemente cu stiluri diferite,
// deci nu poate veni ca un singur șir. Regula de acord stă într-un singur loc.
export function cuvantPiese(n: number) {
  if (n === 1) return "piesă";
  if (n === 0) return "piese";
  const ultimele = n % 100;
  return ultimele === 0 || ultimele >= 20 ? "de piese" : "piese";
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

/**
 * Numele modelului fără anii dintre paranteze: „Fabia 2 (2007–2014)" -> „Fabia 2".
 *
 * Anii stau de la migrarea 24 în `an_start`/`an_final`, dar au rămas scriși și
 * în numele a 69 de modele, ca text de afișare. Când numele intră într-un titlu
 * de pagină sau într-o comparație, parantezele n-au ce căuta.
 */
export function numeModelFaraAni(nume: string) {
  return nume.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Intervalul de ani al unei generații, scris pentru om: „2008–2015", „2019 +".
 * Șir gol dacă modelul n-are anii completați (marcat „⚠ fără ani" în admin).
 */
export function aniiModelului(m: { an_start?: number | null; an_final?: number | null }) {
  if (!m.an_start) return "";
  return m.an_final ? `${m.an_start}–${m.an_final}` : `${m.an_start} +`;
}

/**
 * Numerele de pagină de arătat: primele, ultimele și vecinii paginii curente,
 * cu „…" în locul golurilor. `null` = gol.
 *
 * La 365 de pagini nu se pot afișa toate — pe telefon ar fi un perete de cifre
 * lung cât pagina. Se arată mereu prima și ultima, ca saltul la capăt să fie la
 * un clic, plus câte una de-o parte și de alta a celei curente: maximum 7
 * elemente, deci încape și la 320px.
 *
 * Stă aici, nu în pagină, fiindcă o folosesc și `/piese`, și pagina unei mașini
 * dezmembrate. Două copii ale aceleiași funcții s-ar despărți la prima corectură.
 */
export function numerePaginare(pagina: number, ultima: number): (number | null)[] {
  // Fără `Set`: `tsconfig` țintește ES5, unde răspândirea unui Set n-are voie.
  const brute = [1, ultima, pagina - 1, pagina, pagina + 1];
  const n = brute
    .filter((x, i) => x >= 1 && x <= ultima && brute.indexOf(x) === i)
    .sort((a, b) => a - b);
  const out: (number | null)[] = [];
  for (let i = 0; i < n.length; i++) {
    if (i > 0 && n[i] - n[i - 1] > 1) out.push(null);
    out.push(n[i]);
  }
  return out;
}

/**
 * SUGESTIE de marcă și generație, citită din denumirea pe care a scris-o
 * operatorul: „Vw Passat B6 2.0 TDI BMP" -> Volkswagen · Passat B6.
 *
 * ATENȚIE, ce NU e funcția asta: nu e potrivirea din import și n-are voie să
 * devină. Aceea trăiește exclusiv în `lib/import/potrivire.mjs` (vezi
 * lib/import/README.md) și lucrează pe titluri de PIESĂ scrise de altcineva.
 * Aici textul e scris de omul nostru, iar rezultatul îl confirmă tot el, cu un
 * clic, înainte să se salveze ceva. De asta poate fi atât de simplă.
 *
 * Cum alege:
 *   · marca — numele SAU slug-ul mărcii, ca un cuvânt întreg în denumire.
 *     Slug-ul contează: marca e „Volkswagen", dar nimeni nu scrie asta pe o
 *     mașină din curte — scrie „VW", care e chiar slug-ul ei.
 *   · generația — cel mai LUNG nume de model al mărcii care apare în denumire.
 *     Lungimea e criteriul care desparte „Golf 5 Plus" de „Golf 5" și „Zafira B"
 *     de „Zafira"; invers, cel mai scurt ar da mereu răspunsul greșit.
 *
 * `aviz` nu blochează nimic, doar spune operatorului ce n-a putut confirma —
 * de exemplu un an în afara generației propuse („Duster 1.5 dCi", 2018, lângă
 * „Duster (2010–2017)": e Duster 2, nu Duster 1).
 *
 * Măsurată pe cele 23 de mașini din bază la 6 septembrie 2026: marca corectă la
 * toate 23, generația la 21. Cele două rămase („Mercedes Citan", „Skoda Superb 1
 * 1U") n-au model în tabelă — nu greșește, tace.
 */
export function ghicesteMarcaModel(
  nume: string,
  an: number | null | undefined,
  brands: Brand[],
  models: Model[],
): { marca?: Brand; model?: Model; aviz?: string } {
  const n = textCautare(nume);
  if (!n) return {};
  // Cuvânt întreg, ca „mg" din „MG 3" să nu se aprindă în „Damage".
  const cuvantIntreg = (ac: string) =>
    new RegExp(`(^|[^a-z0-9])${ac.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(n);

  let marca: Brand | undefined;
  for (const b of brands) {
    if (!cuvantIntreg(textCautare(b.nume)) && !cuvantIntreg(textCautare(b.slug))) continue;
    // Cea mai lungă potrivire câștigă: „Land Rover" bate „Rover" dacă apar amândouă.
    if (!marca || b.nume.length > marca.nume.length) marca = b;
  }
  if (!marca) return {};

  const aleMarcii = models.filter((m) => m.brand_id === marca.id);
  let model: Model | undefined;
  for (const m of aleMarcii) {
    const curat = textCautare(numeModelFaraAni(m.nume));
    if (!curat || !n.includes(curat)) continue;
    if (!model || curat.length > textCautare(numeModelFaraAni(model.nume)).length) model = m;
  }

  // Plasă, pentru cazul invers: denumirea scrie „Mercedes Citan 1.5 CDI", iar
  // generația din tabelă e „Citan W415" — numele modelului e mai LUNG decât ce a
  // scris operatorul, deci potrivirea de mai sus n-are cum să-l găsească.
  //
  // Se caută doar după primul cuvânt al modelului, și numai dacă rămâne UN
  // singur candidat. „Golf" ar prinde Golf 4, 5, 6 și 7 deodată — patru
  // generații între care nu putem alege noi, deci tăcem și alege omul. Regula
  // asta e chiar cea din import: nu se propune niciodată un model generic când
  // există mai multe generații pentru numele acela.
  if (!model) {
    const candidate = aleMarcii.filter((m) => {
      const primul = textCautare(numeModelFaraAni(m.nume).split(/\s+/)[0] ?? "");
      return primul.length >= 3 && cuvantIntreg(primul);
    });
    if (candidate.length === 1) model = candidate[0];
  }

  if (!model) return { marca, aviz: "n-am găsit nicio generație a mărcii în denumire" };

  // Anul e doar un avertisment, niciodată un veto: generația poate fi scrisă
  // corect, iar anul greșit — sau invers. Omul decide, are amândouă în față.
  if (an && model.an_start) {
    const pana = model.an_final ?? 9999;
    if (an < model.an_start || an > pana)
      return { marca, model, aviz: `anul ${an} e în afara generației ${numeModelFaraAni(model.nume)} (${aniiModelului(model)})` };
  }
  return { marca, model };
}
