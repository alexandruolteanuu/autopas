// ============================================================
// REDIRECȚIONĂRILE FILTRELOR VECHI CĂTRE RUTELE PROPRII
//
// Marca și categoria au acum adrese proprii — `/piese/marca/skoda`,
// `/piese/categorie/faruri` — în loc de filtre `?marca=`, `?categorie=`.
// Adresele vechi există însă în linkuri salvate, în istoricul browserelor și,
// eventual, în indexul Google, deci trebuie să ducă undeva.
//
// **301, nu 302.** O redirecționare temporară i-ar spune lui Google să păstreze
// adresa veche în index și să nu transfere nimic către cea nouă. Aici mutarea e
// definitivă.
//
// DE CE MIDDLEWARE ȘI NU `redirects()` DIN next.config
// `redirects()` potrivește căi și parametri ficși. Aici decizia depinde de CÂȚI
// parametri de filtrare există: `?marca=skoda` se traduce într-o rută, dar
// `?marca=skoda&categorie=faruri` NU — ar însemna o rută pentru fiecare
// combinație, adică mii de pagini generate combinatoriu, exact problema opusă
// celei pe care o rezolvăm. Combinațiile rămân filtre, marcate `noindex`.
//
// Parametrii care nu țin de filtrare (`pagina`, `sort`) se păstrează în adresa
// nouă: `/piese?marca=skoda&pagina=2` -> `/piese/marca/skoda?pagina=2`.
// ============================================================
import { NextResponse, type NextRequest } from "next/server";

/** Parametrii care descriu CE se filtrează. Cei de prezentare (`pagina`,
 *  `sort`) nu intră la socoteală: nu schimbă mulțimea de piese, doar felia. */
const FILTRE = ["marca", "model", "categorie", "subcategorie", "vehicul", "q", "oem"];

/** Un singur filtru dintre acestea se poate traduce într-o rută proprie. */
const TRADUCERI: Record<string, (v: string) => string> = {
  marca: (v) => `/piese/marca/${v}`,
  categorie: (v) => `/piese/categorie/${v}`,
  // Subcategoriile stau în aceeași tabelă ca grupele, cu slug-uri distincte pe
  // tot tabelul, deci împart același spațiu de rute.
  subcategorie: (v) => `/piese/categorie/${v}`,
  // O mașină are deja pagina ei, mai bogată decât o listare filtrată.
  vehicul: (v) => `/masini/${v}`,
};

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  if (pathname !== "/piese") return NextResponse.next();

  const active = FILTRE.filter((f) => (searchParams.get(f) ?? "").trim() !== "");

  // Exact UN filtru, și unul care are rută proprie.
  if (active.length === 1 && TRADUCERI[active[0]]) {
    const cheie = active[0];
    const valoare = (searchParams.get(cheie) ?? "").trim();
    // Slug curat: litere mici, cifre și cratime. Orice altceva înseamnă adresă
    // fabricată, iar o redirecționare ar duce-o oricum într-un 404.
    if (/^[a-z0-9-]+$/.test(valoare)) {
      const url = req.nextUrl.clone();
      url.pathname = TRADUCERI[cheie](valoare);
      url.searchParams.delete(cheie);
      // `pagina` și `sort` rămân; `/masini/[slug]` nu le folosește, dar nici nu
      // strică — pagina le ignoră.
      return NextResponse.redirect(url, 301);
    }
  }

  return NextResponse.next();
}

export const config = {
  // Doar catalogul. Nimic altceva nu trece prin middleware, ca să nu punem un
  // pas în plus pe fiecare cerere din site.
  matcher: ["/piese"],
};
