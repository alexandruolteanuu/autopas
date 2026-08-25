// ============================================================
// CONVERSIA POZELOR ADUSE DE LA SURSĂ
//
// C.5 cere WebP la calitate 80, lățime maximă 1600px. Măsurat pe eșantion,
// originalele de pe pieseauto.ro au cel mult 1024px lățime, deci NU se
// redimensionează nimic — o imagine nu se mărește niciodată. Rămâne doar
// conversia. Măsurat pe o poză reală de la sursă: 1024×576, 168,9 KB JPEG →
// 41,7 KB WebP, adică 75% mai mic.
//
// Node nu are codec WebP în biblioteca standard, iar proiectul are intenționat
// puține dependințe. `sharp` se încarcă dinamic: dacă există, se face conversia;
// dacă nu, poza se urcă așa cum a venit și se scrie limpede în jurnal ce s-a
// întâmplat. Nicio conversie tăcută, nicio surpriză.
//
// La 8.000 de piese × 1,54 poze, asta înseamnă ~514 MB în loc de ~2,2 GB —
// diferența dintre a încăpea comod în planul gratuit Supabase de 1 GB și a-l
// depăși. `sharp` e instalat din 25 august 2026 (e biblioteca pe care o
// folosește Next.js însuși pentru optimizarea imaginilor).
// ============================================================

export const LATIME_MAXIMA = 1600;
export const CALITATE = 80;

/** Extensia se deduce din tipul returnat de `converteste`, nu dintr-o variabilă
 *  globală: așa fișierul din bucket nu poate ajunge niciodată să aibă o extensie
 *  care nu se potrivește cu conținutul lui. */
export const extensiaPentru = (tip: string) => (tip === "image/webp" ? "webp" : "jpg");

let sharpModul: any | null = null;
let sharpVerificat = false;

async function iaSharp() {
  if (sharpVerificat) return sharpModul;
  sharpVerificat = true;
  try {
    // `eval("require")`, nu `import("sharp")`: webpack analizează importurile
    // statice chiar și dintr-un `try`, iar build-ul ar cădea cu „Module not
    // found" cât timp pachetul nu e instalat. Așa proiectul compilează și fără
    // el, iar dacă cineva îl instalează, conversia pornește singură.
    const cere = eval("require") as NodeRequire;
    sharpModul = cere("sharp");
  } catch {
    sharpModul = null;
    console.warn(
      "[imagini] `sharp` nu e instalat: pozele se urcă neconvertite (JPEG). " +
      "Funcțional, dar de ~2,5 ori mai mari. Instalează `sharp` înainte de importul complet."
    );
  }
  return sharpModul;
}

/** Primește octeții originali, întoarce ce trebuie urcat în bucket. */
export async function converteste(brut: Buffer): Promise<{ date: Buffer; tip: string }> {
  const sharp = await iaSharp();
  if (!sharp) return { date: brut, tip: "image/jpeg" };

  const im = sharp(brut, { failOn: "none" });
  const meta = await im.metadata();
  // `withoutEnlargement` e esențial: fără el, o poză de 800px ar fi întinsă la
  // 1600 și ar arăta mai prost decât originalul, ocupând și mai mult loc.
  const iesire = await im
    .resize({ width: LATIME_MAXIMA, withoutEnlargement: true })
    .rotate()                       // aplică orientarea din EXIF, apoi o scoate
    .webp({ quality: CALITATE })
    .toBuffer();

  // Dacă „optimizarea" a ieșit mai mare decât originalul (se întâmplă la poze
  // deja bine comprimate), păstrăm originalul.
  if (iesire.length >= brut.length && meta.format === "jpeg")
    return { date: brut, tip: "image/jpeg" };

  return { date: iesire, tip: "image/webp" };
}
