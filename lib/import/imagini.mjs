// ============================================================
// CONVERSIA POZELOR ADUSE DE LA SURSĂ
//
// C.5 cere WebP la calitate 80, lățime maximă 1600px. Măsurat pe eșantion,
// originalele de pe pieseauto.ro au cel mult 1024px lățime, deci NU se
// redimensionează nimic — o imagine nu se mărește niciodată. Rămâne doar
// conversia. Măsurat pe o poză reală de la sursă: 1024×576, 168,9 KB JPEG →
// 41,7 KB WebP, adică 75% mai mic.
//
// Modul COMUN: îl folosesc ruta /api/import, ruta /api/publica-piesa (prin
// lib/imagini.ts, care doar re-exportă de aici) și scriptul din terminal.
//
// `sharp` e dependință a proiectului din 25 august 2026 (e biblioteca pe care o
// folosește Next.js însuși pentru optimizarea imaginilor). Se încarcă totuși
// leneș, cu `await import`: așa merge la fel și în pachetul de server al lui
// Next, și rulat direct cu `node`, iar dacă lipsește din node_modules poza se
// urcă neconvertită în loc să cadă tot importul.
// ============================================================

export const LATIME_MAXIMA = 1600;
export const CALITATE = 80;

/** Extensia se deduce din tipul returnat de `converteste`, nu dintr-o variabilă
 *  globală: așa fișierul din bucket nu poate ajunge niciodată să aibă o extensie
 *  care nu se potrivește cu conținutul lui. */
export const extensiaPentru = (tip) => (tip === "image/webp" ? "webp" : "jpg");

let sharpModul = null;
let sharpVerificat = false;

async function iaSharp() {
  if (sharpVerificat) return sharpModul;
  sharpVerificat = true;
  try {
    sharpModul = (await import("sharp")).default;
  } catch {
    sharpModul = null;
    console.warn(
      "[imagini] `sharp` nu e disponibil: pozele se urcă neconvertite (JPEG). " +
      "Funcțional, dar de ~2,5 ori mai mari."
    );
  }
  return sharpModul;
}

/** Primește octeții originali, întoarce ce trebuie urcat în bucket.
 *  @param {Buffer} brut @returns {Promise<{date: Buffer, tip: string}>} */
export async function converteste(brut) {
  const sharp = await iaSharp();
  if (!sharp) return { date: brut, tip: "image/jpeg" };

  try {
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
  } catch (e) {
    // O poză stricată nu are voie să oprească un import de 8.000. Se urcă așa
    // cum a venit; dacă nici așa nu e bună, se vede în ecranul de piese.
    console.warn("[imagini] conversie eșuată, urc originalul:", e instanceof Error ? e.message : e);
    return { date: brut, tip: "image/jpeg" };
  }
}
