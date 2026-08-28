// ============================================================
// CITIRE COMPLETĂ PRIN REST, PAGINĂ CU PAGINĂ — varianta pentru scripturi
//
// Geamănul lui `citesteTot()` din `lib/supabase.ts`. Există separat fiindcă
// scripturile din `scripts/` nu folosesc `supabase-js`: vorbesc direct cu REST,
// cu cheia de service, și n-au nevoie de sesiune sau de RLS.
//
// Capcana e aceeași, și era deja scrisă în `lib/import/depozit.mjs`:
//
//   „Citește tot dintr-o tabelă, pagină cu pagină. Peste 1.000 de rânduri
//    PostgREST taie tăcut, iar un import care crede că are 1.000 de piese în bază
//    când are 8.000 ar depublica 7.000 de rânduri bune."
//
// Aici, spre deosebire de `depozit.mjs`, totalul NU se ghicește din lungimea
// lotului: se citește din antetul `content-range`, iar dacă antetul lipsește
// funcția aruncă. Un script care șterge fișiere nu are voie să presupună.
//
// Cele trei module rămân separate intenționat: `depozit.mjs` e motorul de import
// și are propriile reguli; astea două sunt unelte generale. Dacă schimbi regula
// într-unul, verifică-le pe toate trei.
// ============================================================

/** Cât cere o pagină. Egal cu plafonul PostgREST: mai mult n-are efect. */
export const PAGINA = 1000;

/**
 * Citește TOATE rândurile de la o cale REST, urmărind `content-range`.
 *
 * @param urlBaza  https://…supabase.co
 * @param antete   apikey + Authorization
 * @param cale     ex. `products?select=id,poze&order=id` — pune ordine pe o
 *                 coloană UNICĂ, altfel paginile se pot suprapune sau sări
 * @param optiuni  { plafon, eticheta }
 */
export async function citesteTotRest(urlBaza, antete, cale, optiuni = {}) {
  const plafon = optiuni.plafon ?? 50_000;
  const ce = optiuni.eticheta ?? cale.split("?")[0];
  const out = [];

  for (let de = 0; ; de += PAGINA) {
    const r = await fetch(`${urlBaza}/rest/v1/${cale}`, {
      headers: {
        ...antete,
        // `count=exact` face PostgREST să pună totalul în content-range.
        // Fără el antetul vine cu `*` în loc de număr și n-am ști niciodată
        // dacă am primit tot.
        Prefer: "count=exact",
        Range: `${de}-${de + PAGINA - 1}`,
        "Range-Unit": "items",
      },
    });
    if (!r.ok) throw new Error(`${ce}: HTTP ${r.status} ${(await r.text()).slice(0, 300)}`);

    const antet = r.headers.get("content-range");
    if (!antet) throw new Error(`${ce}: răspuns fără content-range — nu pot ști dacă e complet.`);
    const total = Number(antet.split("/")[1]);
    if (!Number.isFinite(total))
      throw new Error(`${ce}: content-range fără total („${antet}") — nu pot ști dacă e complet.`);
    if (total > plafon)
      throw new Error(
        `${ce}: ${total} rânduri, peste plafonul de siguranță de ${plafon}. ` +
        `Ridică plafonul conștient sau filtrează mai strâns — nu tai tăcut.`,
      );

    const lot = await r.json();
    out.push(...lot);
    if (out.length >= total || lot.length < PAGINA) return out;
  }
}
