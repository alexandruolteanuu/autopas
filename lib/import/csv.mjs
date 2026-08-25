// ============================================================
// CSV — parser RFC 4180, scris de mână.
//
// Tratează ghilimelele, virgulele și newline-urile din interiorul câmpurilor,
// plus ghilimelele duble escapate (""). Titlurile de piese chiar le conțin.
//
// Modul COMUN: îl folosesc și scriptul din terminal, și ruta /api/import.
// Vezi lib/import/README.md pentru de ce.
// ============================================================

/** @param {string} text @returns {Record<string,string>[]} */
export function parseCSV(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);   // BOM UTF-8
  const randuri = [];
  let camp = "", rand = [], inGhilimele = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inGhilimele) {
      if (c === '"') {
        if (text[i + 1] === '"') { camp += '"'; i++; }        // "" => un singur "
        else inGhilimele = false;
      } else camp += c;
      continue;
    }
    if (c === '"') { inGhilimele = true; continue; }
    if (c === ",") { rand.push(camp); camp = ""; continue; }
    if (c === "\r") continue;                                  // CRLF
    if (c === "\n") { rand.push(camp); randuri.push(rand); rand = []; camp = ""; continue; }
    camp += c;
  }
  if (camp !== "" || rand.length) { rand.push(camp); randuri.push(rand); }
  if (!randuri.length) return [];
  const cap = randuri[0].map((h) => h.trim());
  return randuri.slice(1)
    .filter((r) => r.some((v) => v.trim() !== ""))            // sare peste rânduri goale
    .map((r) => Object.fromEntries(cap.map((h, i) => [h, (r[i] ?? "").trim()])));
}

/** Coloanele pe care le așteptăm de la exportul pieseauto.ro. Dacă lipsesc,
 *  fișierul nu e un feed — mai bine spunem asta din prima decât să importăm gol. */
export const COLOANE_CERUTE = ["ID", "URL", "Titlu", "Pret"];

/** @param {Record<string,string>[]} randuri @returns {string|null} eroarea, dacă e cazul */
export function verificaColoane(randuri) {
  if (!randuri.length) return "Fișierul nu conține niciun rând.";
  const cap = Object.keys(randuri[0]);
  const lipsa = COLOANE_CERUTE.filter((c) => !cap.includes(c));
  if (lipsa.length) return `Fișierului îi lipsesc coloanele: ${lipsa.join(", ")}. Coloane găsite: ${cap.join(", ")}.`;
  return null;
}
