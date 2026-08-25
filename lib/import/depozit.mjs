// ============================================================
// DEPOZITUL — singurul loc care vorbește cu Supabase în timpul importului.
//
// Modul COMUN, prin REST, nu prin `@supabase/supabase-js`: aceleași apeluri
// funcționează identic în scriptul rulat cu `node` și în ruta /api/import, fără
// să depindă de un client care se inițializează altfel în fiecare.
//
// Trece prin cheia de service, fiindcă `products` n-are politică de insert pentru
// `anon` — a fost ștearsă intenționat (vezi CLAUDE.md). Cheia stă în variabilele
// de mediu, niciodată în cod, și nu ajunge niciodată în browser.
// ============================================================

const PAGINA = 1000;   // PostgREST întoarce cel mult atât fără paginare

export function creeazaDepozit({ url, key }) {
  if (!url || !key) throw new Error("Lipsesc NEXT_PUBLIC_SUPABASE_URL sau SUPABASE_SERVICE_ROLE_KEY.");
  const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

  async function cere(cale, opt = {}) {
    const r = await fetch(`${url}/rest/v1/${cale}`, { ...opt, headers: { ...h, ...(opt.headers ?? {}) } });
    if (!r.ok) throw new Error(`${opt.method ?? "GET"} ${cale.split("?")[0]}: HTTP ${r.status} ${(await r.text()).slice(0, 300)}`);
    if (r.status === 204) return null;
    const t = await r.text();
    return t ? JSON.parse(t) : null;
  }

  /** Citește tot dintr-o tabelă, pagină cu pagină. Peste 1.000 de rânduri
   *  PostgREST taie tăcut, iar un import care crede că are 1.000 de piese în bază
   *  când are 8.000 ar depublica 7.000 de rânduri bune. */
  async function tot(cale) {
    const out = [];
    for (let de = 0; ; de += PAGINA) {
      const lot = await cere(`${cale}${cale.includes("?") ? "&" : "?"}limit=${PAGINA}&offset=${de}`);
      out.push(...lot);
      if (lot.length < PAGINA) return out;
    }
  }

  return {
    // ---------- taxonomia proprie ----------
    async citesteTaxonomia() {
      const [brands, models, categories] = await Promise.all([
        tot("brands?select=id,nume,slug"),
        tot("models?select=id,nume,brand_id"),
        tot("categories?select=id,nume,slug,parent_id,art"),
      ]);
      return { brands, models, categories };
    },

    // ---------- produse ----------
    /** Ce știm deja despre piesele din lotul curent, după `sursa_id`. */
    async citesteExistente(sursa, ids) {
      const map = new Map();
      for (let i = 0; i < ids.length; i += 100) {
        const lista = ids.slice(i, i + 100).map((x) => `"${x}"`).join(",");
        const d = await cere(`products?sursa=eq.${encodeURIComponent(sursa)}&sursa_id=in.(${lista})&select=id,sursa_id,nume,pret_lei,editat_manual,publicat,sursa_activ,poze`);
        for (const x of d) map.set(x.sursa_id, x);
      }
      return map;
    },

    /** Toate piesele venite de la sursa asta. Cerute de calculul depublicării ȘI
     *  de previzualizare, care compară prețurile din CSV cu cele din bază fără
     *  nicio cerere către sursă. De aceea se iau și `pret_lei`, `nume` și
     *  `editat_manual`: fără ele, orice piesă ar părea „de actualizat". */
    async citesteToateDeLaSursa(sursa) {
      return tot(`products?sursa=eq.${encodeURIComponent(sursa)}&select=id,sursa_id,nume,pret_lei,editat_manual,publicat,sursa_activ`);
    },

    async insereazaPiesa(rand) {
      const d = await cere("products", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify([rand]),
      });
      return d?.[0] ?? null;
    },

    async actualizeazaPiesa(id, patch) {
      await cere(`products?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    },

    /** Depublicarea pieselor dispărute din feed. NU se șterge nimic: rândurile pot
     *  avea comenzi în istoric. `sursa_activ=false` + `publicat=false`. */
    async depublica(ids) {
      for (let i = 0; i < ids.length; i += 200) {
        const lot = ids.slice(i, i + 200).join(",");
        await cere(`products?id=in.(${lot})`, {
          method: "PATCH",
          body: JSON.stringify({ sursa_activ: false, publicat: false }),
        });
      }
    },

    // ---------- stocare ----------
    /** Urcă o poză în bucketul public de piese și întoarce adresa ei. */
    async urcaPoza(cale, date, tip) {
      const r = await fetch(`${url}/storage/v1/object/poze-piese/${cale}`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": tip, "Cache-Control": "31536000" },
        body: date,
      });
      if (!r.ok) throw new Error(`urcare poză: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
      return `${url}/storage/v1/object/public/poze-piese/${cale}`;
    },

    /** Fișierul CSV al jobului, în bucketul PRIVAT. Fără el, un import întrerupt
     *  n-ar putea fi reluat decât reîncărcând fișierul din browser. */
    async urcaCsv(cale, text) {
      const r = await fetch(`${url}/storage/v1/object/import-csv/${cale}`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "text/csv", "x-upsert": "true" },
        body: text,
      });
      if (!r.ok) throw new Error(`urcare CSV: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
      return cale;
    },

    async citesteCsv(cale) {
      const r = await fetch(`${url}/storage/v1/object/import-csv/${cale}`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (!r.ok) throw new Error(`citire CSV: HTTP ${r.status}`);
      return r.text();
    },

    // ---------- joburi ----------
    async jobActiv(sursa) {
      const d = await cere(`import_jobs?sursa=eq.${encodeURIComponent(sursa)}&status=in.(in_curs,in_pauza)&select=*&order=id.desc&limit=1`);
      return d?.[0] ?? null;
    },
    async jobCiteste(id) {
      const d = await cere(`import_jobs?id=eq.${id}&select=*`);
      return d?.[0] ?? null;
    },
    async jobNou(rand) {
      const d = await cere("import_jobs", {
        method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify([rand]),
      });
      return d?.[0] ?? null;
    },
    async jobActualizeaza(id, patch) {
      const d = await cere(`import_jobs?id=eq.${id}`, {
        method: "PATCH", headers: { Prefer: "return=representation" },
        body: JSON.stringify({ ...patch, actualizat_la: new Date().toISOString() }),
      });
      return d?.[0] ?? null;
    },
  };
}

/** Depozitul construit din variabilele de mediu — forma folosită de rutele /api. */
export function depozitDinMediu() {
  return creeazaDepozit({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}
