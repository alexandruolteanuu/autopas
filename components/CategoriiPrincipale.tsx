// ============================================================
// CATEGORII PRINCIPALE — trei registre de volum
//
// DE CE S-AU SCOS ILUSTRAȚIILE
// `PartArt` are 13 desene, categoriile foloseau 10, iar ce nu se potrivea cădea
// pe desenul implicit — blocul motor. Rezultatul: 8 din 17 categorii arătau
// același desen (Motor și anexe, pe drept, plus Filtre, Accesorii, Car audio,
// Tuning, Navigație GPS, Diverse, Scule auto). Un icon care nu distinge nimic e
// mai rău decât lipsa lui: cititorul îl caută, nu-l găsește, și încetează să se
// mai uite la iconuri. Se pun la loc doar când există un set complet și distinct.
// `PartArt` rămâne neatins — se folosește în continuare pentru PIESE.
//
// CE ÎNLOCUIEȘTE DESENUL
// Volumul. Cele trei categorii mari nu mai arată la fel ca „Scule auto — 1
// piesă": primesc carduri mari, cu numărul scris mare. Cele mijlocii rămân
// carduri obișnuite, iar cele mici devin rânduri compacte. Numărul de piese e
// informația după care omul decide unde să intre, deci se scrie în culoarea
// textului, nu gri mic.
//
// PRAGURILE
// 1.000 și 100, alese pe distribuția reală (3 / 6 / 8 din 17). Registrul mare e
// însă ținut la EXACT trei: dacă mâine niciuna sau doar una trece de 1.000, un
// rând cu un singur card mare și două goluri ar arăta ca un defect. Se completează
// atunci cu următoarele ca mărime, iar dacă trec mai mult de trei, cardurile mari
// le iau pe cele mai mari trei — ierarhia rămâne adevărată în ambele sensuri.
//
// ORDINEA
// După numărul de piese, descrescător, nu după `categories.ordine`. Ordinea
// editorială din admin descrie o preferință; aici structura ÎNSEAMNĂ volum, iar
// un card mare așezat sub unul mic ar contrazice exact ce spune dimensiunea lui.
// ============================================================
import Link from "next/link";
import type { Category } from "@/lib/types";
import { cuvantPiese } from "@/lib/format";

const PRAG_MARE = 1000;
const PRAG_MIC = 100;
/** Câte carduri mari intră pe un rând întreg, la orice lățime. */
const CATE_MARI = 3;

const nr = (c: Category) => c.nr_piese ?? 0;

/** Numărul, scris mare, plus cuvântul acordat, scris mic. */
function Numar({ n, mare }: { n: number; mare?: boolean }) {
  return (
    <span className={`flex items-baseline gap-1.5 text-textSecundar ${mare ? "text-[13px]" : "text-[12px]"}`}>
      <b className={`font-disp font-bold text-text tabular-nums leading-none
        ${mare ? "text-[26px] sm:text-[30px]" : "text-[17px]"}`}>{n}</b>
      {cuvantPiese(n)}
    </span>
  );
}

export default function CategoriiPrincipale({ cats }: { cats: Category[] }) {
  // O categorie fără piese ar duce într-o listare goală. Nu e o eroare — e o
  // grupă în care încă n-am listat nimic — dar n-are ce căuta într-un meniu.
  const cu = cats.filter((c) => nr(c) > 0).sort((a, b) => nr(b) - nr(a));
  if (cu.length === 0) return null;

  const peste = cu.filter((c) => nr(c) >= PRAG_MARE);
  // Exact CATE_MARI, completate sau tăiate — vezi „PRAGURILE" de mai sus.
  const mari = (peste.length >= CATE_MARI ? peste : cu).slice(0, Math.min(CATE_MARI, cu.length));
  const rest = cu.slice(mari.length);
  const medii = rest.filter((c) => nr(c) >= PRAG_MIC);
  const mici = rest.filter((c) => nr(c) < PRAG_MIC);
  const maxim = nr(mari[0]) || 1;

  return (
    <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="dim">Categorii piese auto</div>
      <h2 className="t-sectiune mt-2 mb-6">Categorii principale</h2>

      {/* REGISTRUL 1 — carduri mari.
          Pe telefon cardul e pe toată lățimea și se citește pe orizontală
          (denumire | număr), ca să nu ocupe trei ecrane; de la `sm` devine card
          înalt, cu numărul lipit de bază. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {mari.map((c) => (
          <Link key={c.id} href={`/piese/categorie/${c.slug}`}
            className="card p-4 sm:p-5 flex flex-col gap-3 sm:gap-4 sm:min-h-[152px]
                       hover:border-accentChenar transition">
            <div className="flex items-baseline justify-between gap-3
                            sm:flex-col sm:items-start sm:justify-start sm:gap-2 sm:flex-1">
              <b className="font-disp font-bold leading-tight text-[17px] sm:text-[19px] tracking-[-0.01em]">
                {c.nume}
              </b>
              <span className="shrink-0 sm:mt-auto"><Numar n={nr(c)} mare /></span>
            </div>
            {/* Cât de mare e categoria față de cea mai mare. Singurul element
                decorativ din secțiune, și codează o informație adevărată.
                `aria-hidden`: cifra de deasupra o spune deja, în cuvinte. */}
            <div aria-hidden className="h-[3px] rounded-full bg-chenar overflow-hidden">
              <div className="h-full bg-accent rounded-full"
                style={{ width: `${Math.max(6, Math.round((nr(c) / maxim) * 100))}%` }} />
            </div>
          </Link>
        ))}
      </div>

      {/* REGISTRUL 2 — carduri obișnuite. Două coloane de la 320px (denumirile
          se rup pe mai multe rânduri, dar cardul are înălțime minimă, deci
          rândul rămâne aliniat), trei de la `sm`, șase de la `lg` — unde cele
          șase încap într-un singur rând sub cele trei mari. */}
      {medii.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mt-3 sm:mt-4">
          {medii.map((c) => (
            <Link key={c.id} href={`/piese/categorie/${c.slug}`}
              className="card p-3.5 flex flex-col gap-2 min-h-[88px] hover:border-accentChenar transition">
              <b className="font-disp font-semibold text-[14px] leading-tight">{c.nume}</b>
              <span className="mt-auto"><Numar n={nr(c)} /></span>
            </Link>
          ))}
        </div>
      )}

      {/* REGISTRUL 3 — rânduri compacte. O categorie cu 7 piese n-are nevoie de
          un card cât una cu 3.087. Rămân ținte de atingere de cel puțin 44px. */}
      {mici.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-3 sm:mt-4">
          {mici.map((c) => (
            <Link key={c.id} href={`/piese/categorie/${c.slug}`}
              className="card px-3.5 py-2.5 min-h-[44px] flex items-center justify-between gap-2
                         hover:border-accentChenar transition">
              <span className="text-[13px] leading-tight">{c.nume}</span>
              <b className="shrink-0 font-disp font-bold text-[13px] text-textSecundar tabular-nums">{nr(c)}</b>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
