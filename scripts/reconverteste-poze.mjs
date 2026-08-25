// ============================================================
// RECONVERTIREA POZELOR RĂMASE JPEG
//
// DE CE EXISTĂ
// Primele piese importate au ajuns în bucket ca JPEG, nu ca WebP: la momentul
// acela `sharp` nu era instalat, iar `lib/import/imagini.mjs` urcă originalul
// când codecul lipsește (intenționat — mai bine o poză mare decât niciuna).
// Măsurat pe cele 28 de poze din bucket: JPEG-urile au 212 KB în medie, WebP-urile
// 97 KB. La 8.000 de piese diferența ar fi de ordinul gigabaiților, și — mai rău —
// catalogul ar avea două feluri de fișiere fără niciun motiv.
//
// CE FACE, pe fiecare poză `.jpg` din `products.poze`:
//   1. o aduce din bucketul nostru
//   2. o trece prin ACEEAȘI conversie ca importul (lib/import/imagini.mjs)
//   3. urcă varianta WebP
//   4. înlocuiește adresa în `products.poze`, păstrând ordinea
//   5. șterge fișierul vechi
//
// Ordinea contează: fișierul vechi se șterge ABIA după ce rândul din bază arată
// spre cel nou. Dacă scriptul cade la mijloc, în cel mai rău caz rămâne un fișier
// orfan în stocare — niciodată o piesă cu poză moartă.
//
// Se poate rula de câte ori vrei: pozele deja WebP sunt sărite.
//
//   node scripts/reconverteste-poze.mjs --uscat   # doar raportează
//   node scripts/reconverteste-poze.mjs
// ============================================================
import { readFileSync, existsSync } from "node:fs";
import { creeazaDepozit } from "../lib/import/depozit.mjs";
import { converteste, extensiaPentru } from "../lib/import/imagini.mjs";

const USCAT = process.argv.includes("--uscat");

function citesteEnv() {
  const out = {};
  for (const f of [".env.local", ".env"]) {
    if (!existsSync(f)) continue;
    for (const l of readFileSync(f, "utf8").split("\n")) {
      const m = l.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m && !(m[1] in out)) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  return out;
}

const env = citesteEnv();
const BAZA = env.NEXT_PUBLIC_SUPABASE_URL;
const depozit = creeazaDepozit({ url: BAZA, key: env.SUPABASE_SERVICE_ROLE_KEY });

/** Din adresa publică scoatem calea din bucket: tot ce urmează după numele lui. */
const PREFIX = `${BAZA}/storage/v1/object/public/poze-piese/`;
const calea = (u) => (u.startsWith(PREFIX) ? u.slice(PREFIX.length) : null);

const r = await fetch(`${BAZA}/rest/v1/products?select=id,nume,poze&poze=not.eq.{}`, {
  headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
});
const piese = await r.json();

let deFacut = 0, facute = 0, sarite = 0, inainte = 0, dupa = 0;
const erori = [];

for (const p of piese) {
  const poze = [...(p.poze ?? [])];
  let schimbat = false;

  for (let i = 0; i < poze.length; i++) {
    const cale = calea(poze[i]);
    if (!cale) { sarite++; continue; }                  // poză care nu e în bucketul nostru
    if (!/\.jpe?g$/i.test(cale)) { sarite++; continue; } // deja WebP

    deFacut++;
    if (USCAT) { console.log(`  ar reconverti  ${cale}`); continue; }

    try {
      const rr = await fetch(poze[i]);
      if (!rr.ok) throw new Error(`descărcare: HTTP ${rr.status}`);
      const brut = Buffer.from(await rr.arrayBuffer());
      const { date, tip } = await converteste(brut);

      if (tip !== "image/webp") {
        // Conversia a preferat originalul (poză deja bine comprimată). Nu forțăm.
        console.log(`  ↷ ${cale} — conversia n-a redus dimensiunea, rămâne JPEG`);
        sarite++; continue;
      }

      const caleNoua = cale.replace(/\.jpe?g$/i, `.${extensiaPentru(tip)}`);
      const adresaNoua = await depozit.urcaPoza(caleNoua, date, tip);

      poze[i] = adresaNoua;
      schimbat = true;
      inainte += brut.length; dupa += date.length;
      console.log(`  ✓ ${cale}  ${(brut.length / 1024).toFixed(0)} KB → ${(date.length / 1024).toFixed(0)} KB`);
      facute++;
    } catch (e) {
      erori.push(`${p.id} · ${cale}: ${e.message}`);
      console.log(`  ✗ ${cale}: ${e.message}`);
    }
  }

  if (schimbat) {
    // Întâi rândul, apoi ștergerea fișierelor vechi — niciodată invers.
    await depozit.actualizeazaPiesa(p.id, { poze });
    for (const veche of (p.poze ?? [])) {
      const c = calea(veche);
      if (c && /\.jpe?g$/i.test(c) && !poze.includes(veche)) {
        try { await depozit.stergePoza(c); } catch (e) { erori.push(`ștergere ${c}: ${e.message}`); }
      }
    }
  }
}

console.log("\n" + "═".repeat(56));
console.log(`  poze JPEG găsite      ${deFacut}`);
console.log(`  reconvertite          ${facute}`);
console.log(`  sărite (deja WebP)    ${sarite}`);
if (facute) {
  console.log(`  înainte               ${(inainte / 1024).toFixed(0)} KB`);
  console.log(`  după                  ${(dupa / 1024).toFixed(0)} KB  (−${(100 - (dupa / inainte) * 100).toFixed(0)}%)`);
}
if (erori.length) { console.log(`  erori:`); erori.forEach((e) => console.log(`    ${e}`)); }
