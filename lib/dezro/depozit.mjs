// ============================================================
// DEPOZITUL — singurul loc care vorbește cu Supabase în timpul lucrului cu dez.ro.
//
// Prin REST, cu cheia de service, exact ca `lib/import/depozit.mjs`: aceleași
// apeluri merg identic în ruta /api/dezro și în scriptul din terminal, fără să
// depindă de un client care se inițializează altfel în fiecare.
//
// PLAFONUL DE 1.000 DE RÂNDURI
// Fiecare citire de listă trece prin `tot()`, care urmărește `content-range` și
// ARUNCĂ dacă antetul lipsește. Nu e prudență teoretică: catalogul lor are 2.700
// de rânduri, al nostru 8.965 de piese, iar o citire tăiată la 1.000 ar retrage
// 7.900 de anunțuri bune crezând că piesele au dispărut. Exact defectul din
// 28 august 2026, dar cu consecințe la ei, unde nu putem repara nimic înapoi.
// ============================================================

const PAGINA = 1000;

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

  /** Citire completă, pagină cu pagină, cu totalul luat din `content-range`. */
  async function tot(cale, plafon = 50_000) {
    const out = [];
    for (let de = 0; ; de += PAGINA) {
      const r = await fetch(`${url}/rest/v1/${cale}`, {
        headers: { ...h, Prefer: "count=exact", Range: `${de}-${de + PAGINA - 1}`, "Range-Unit": "items" },
      });
      if (!r.ok) throw new Error(`${cale.split("?")[0]}: HTTP ${r.status} ${(await r.text()).slice(0, 300)}`);
      const antet = r.headers.get("content-range");
      if (!antet) throw new Error(`${cale.split("?")[0]}: răspuns fără content-range — nu pot ști dacă e complet.`);
      const total = Number(antet.split("/")[1]);
      if (!Number.isFinite(total))
        throw new Error(`${cale.split("?")[0]}: content-range fără total („${antet}") — nu pot ști dacă e complet.`);
      if (total > plafon)
        throw new Error(`${cale.split("?")[0]}: ${total} rânduri, peste plafonul de siguranță de ${plafon}.`);
      const lot = await r.json();
      out.push(...lot);
      if (out.length >= total || lot.length < PAGINA) return out;
    }
  }

  const q = encodeURIComponent;

  return {
    // ---------- setările integrării ----------
    /** Configurarea dez.ro din `settings.integrari`. Secretele stau acolo, nu în cod. */
    async citesteConfig() {
      const d = await cere("settings?cheie=eq.integrari&select=valoare");
      return (d?.[0]?.valoare ?? {}).dezro ?? {};
    },

    /** Scrie înapoi DOAR cheile date din `dezro`, fără să atingă restul
     *  integrărilor. Se folosește ca să memorăm token-ul de sesiune: fără asta
     *  ne-am autentifica la fiecare lot, iar ei limitează autentificările. */
    async salveazaConfig(patch) {
      const d = await cere("settings?cheie=eq.integrari&select=valoare");
      const tot_ = d?.[0]?.valoare ?? {};
      const nou = { ...tot_, dezro: { ...(tot_.dezro ?? {}), ...patch } };
      await cere("settings?cheie=eq.integrari", {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ valoare: nou }),
      });
    },

    // ---------- catalogul lor ----------
    async citesteCatalog(fel = null) {
      const filtru = fel ? `fel=eq.${q(fel)}&` : "";
      return tot(`dezro_catalog?${filtru}select=fel,tip,dezro_id,nume,alias,parinte,selectabil&order=fel,tip,dezro_id`);
    },

    /**
     * Scrie noduri de catalog. UPSERT, niciodată ștergere.
     *
     * Un nod care dispare la ei rămâne la noi, iar maparea care arată spre el
     * rămâne validă până când cineva o schimbă. Alternativa — ștergerea — ar
     * lăsa mapări orfane și ar rupe publicarea fără niciun mesaj. Așa,
     * publicarea eșuează cu eroarea LOR („Invalid part id"), care spune exact ce
     * s-a întâmplat.
     */
    async scrieCatalog(randuri) {
      const acum = new Date().toISOString();
      // TOATE rândurile trimise într-un lot trebuie să aibă exact aceleași chei.
      // PostgREST refuză altfel lotul întreg, cu „All object keys must match" —
      // iar mărcile n-au `selectabil`, categoriile-rădăcină n-au marcă-părinte.
      // De aceea forma se completează aici, o dată, în loc să fie ținută minte
      // de fiecare apelant.
      const normalizat = randuri.map((r) => ({
        fel: r.fel, tip: r.tip, dezro_id: r.dezro_id, nume: r.nume,
        alias: r.alias ?? null,
        parinte: r.parinte ?? null,
        selectabil: r.selectabil ?? null,
        actualizat_la: acum,
      }));
      for (let i = 0; i < normalizat.length; i += 500) {
        const lot = normalizat.slice(i, i + 500);
        await cere("dezro_catalog?on_conflict=fel,tip,dezro_id", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify(lot),
        });
      }
    },

    // ---------- taxonomia noastră ----------
    async citesteTaxonomiaNoastra() {
      const [brands, models, categories] = await Promise.all([
        tot("brands?select=id,nume,slug&order=id"),
        tot("models?select=id,nume,slug,brand_id&order=id"),
        tot("categories?select=id,nume,slug,parent_id&order=id"),
      ]);
      return { brands, models, categories };
    },

    // ---------- mapările ----------
    async citesteMapari(fel = null) {
      const filtru = fel ? `fel=eq.${q(fel)}&` : "";
      return tot(`dezro_mapari?${filtru}select=fel,local_id,dezro_id,sursa,scor,nota&order=fel,local_id`);
    },

    /** Scrie mapări. `sursa` decide dacă are voie să calce peste ce e deja acolo
     *  — regula e în motor, nu aici; depozitul doar scrie ce i se cere. */
    async scrieMapari(randuri, autor = null) {
      const acum = new Date().toISOString();
      // Aceeași regulă ca la `scrieCatalog`: toate rândurile dintr-un lot trebuie
      // să aibă exact aceleași chei, altfel PostgREST refuză lotul întreg cu
      // „All object keys must match". Aici se vedea la potrivirea automată, unde
      // rândurile de categorie primesc `nota` („traducere aprobată") iar cele de
      // marcă și model nu.
      const normalizat = randuri.map((r) => ({
        fel: r.fel, local_id: r.local_id,
        dezro_id: r.dezro_id ?? null,
        sursa: r.sursa ?? "auto",
        scor: r.scor ?? null,
        nota: r.nota ?? null,
        actualizat_la: acum, actualizat_de: autor,
      }));
      for (let i = 0; i < normalizat.length; i += 500) {
        const lot = normalizat.slice(i, i + 500);
        await cere("dezro_mapari?on_conflict=fel,local_id", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify(lot),
        });
      }
    },

    // ---------- piesele ----------
    /**
     * Următoarea felie de piese eligibile, după `dupaId`.
     *
     * Se cer doar coloanele care ajung într-un anunț. Greutatea NU e printre
     * ele: la ei nu există câmp pentru ea, iar 8.700 de rânduri × două coloane
     * degeaba se adună.
     *
     * Filtrele sunt ACELEAȘI cu cele din view-ul `dezro_stare_piese`: dacă
     * ecranul spune „8.704 gata" și lotul lucrează pe altă mulțime, cifra devine
     * o minciună și nimeni nu observă. Ordinea pe `id` e obligatorie: fără ea,
     * paginarea poate sări peste piese și le poate repeta.
     */
    async pieseEligibile(dupaId, cate) {
      return cere(
        `products?publicat=eq.true&stoc=gt.0&id=gt.${dupaId}` +
        `&select=id,slug,nume,pret_lei,pret_sufix,ani,oem,stoc,stare_nota,compat,poze,` +
        `cod_intern,model_ids,categorie_id,subcategorie_id` +
        `&order=id&limit=${cate}`,
      );
    },

    /** Câte piese eligibile sunt cu totul (pentru `total`-ul jobului). */
    async numaraEligibile() {
      const r = await fetch(`${url}/rest/v1/products?publicat=eq.true&stoc=gt.0&select=id`, {
        headers: { ...h, Prefer: "count=exact", Range: "0-0", "Range-Unit": "items" },
      });
      if (!r.ok) throw new Error(`numaraEligibile: HTTP ${r.status}`);
      const antet = r.headers.get("content-range");
      const total = Number(String(antet).split("/")[1]);
      if (!Number.isFinite(total)) throw new Error("numaraEligibile: content-range fără total.");
      return total;
    },

    // ---------- anunțurile ----------
    async citesteAnunturiPentru(ids) {
      if (!ids.length) return new Map();
      const map = new Map();
      for (let i = 0; i < ids.length; i += 200) {
        const lista = ids.slice(i, i + 200).join(",");
        const d = await cere(
          `dezro_anunturi?product_id=in.(${lista})` +
          `&select=product_id,ad_id,alias,url,aprobat,status,amprenta,poze_trimise,poze_dezro,incercari,eroare`,
        );
        for (const x of d) map.set(x.product_id, x);
      }
      return map;
    },

    /** Anunțurile ACTIVE ale unor piese care nu mai sunt eligibile — de retras.
     *  Se citesc în ordinea `product_id`, cu cursor, din același motiv ca la piese. */
    async anunturiDeRetras(dupaId, cate) {
      const active = await cere(
        `dezro_anunturi?status=eq.activ&product_id=gt.${dupaId}` +
        `&select=product_id,ad_id,url&order=product_id&limit=${cate}`,
      );
      if (!active.length) return [];
      const ids = active.map((a) => a.product_id).join(",");
      const inca = await cere(`products?id=in.(${ids})&publicat=eq.true&stoc=gt.0&select=id`);
      const eligibile = new Set(inca.map((p) => p.id));
      // Rândurile parcurse rămân „parcurse" chiar dacă nu se retrag: cursorul
      // avansează la ultimul citit, nu la ultimul retras.
      return active.map((a) => ({ ...a, deRetras: !eligibile.has(a.product_id) }));
    },

    async scrieAnunt(productId, patch) {
      const rand = { product_id: productId, ...patch, actualizat_la: new Date().toISOString() };
      await cere("dezro_anunturi?on_conflict=product_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify([rand]),
      });
    },

    /** Actualizează rândul nostru după id-ul LOR. Se folosește la
     *  reîmprospătarea stării de aprobare: acolo pornim de la ce ne dau ei,
     *  nu de la piesele noastre. */
    async scrieAnuntDupaAdId(adId, patch) {
      await cere(`dezro_anunturi?ad_id=eq.${Number(adId)}`, {
        method: "PATCH",
        body: JSON.stringify({ ...patch, actualizat_la: new Date().toISOString() }),
      });
    },

    async citesteAnunturi({ status = null, limita = 100, dupa = 0 } = {}) {
      const f = status ? `status=eq.${q(status)}&` : "";
      return cere(
        `dezro_anunturi?${f}product_id=gt.${dupa}` +
        `&select=product_id,ad_id,url,status,aprobat,eroare,trimis_la&order=product_id&limit=${limita}`,
      );
    },

    // ---------- joburi ----------
    async jobActiv() {
      const d = await cere("dezro_jobs?status=in.(in_curs,in_pauza)&select=*&order=id.desc&limit=1");
      return d?.[0] ?? null;
    },
    async jobCiteste(id) {
      const d = await cere(`dezro_jobs?id=eq.${Number(id)}&select=*`);
      return d?.[0] ?? null;
    },
    async jobNou(rand) {
      const d = await cere("dezro_jobs", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify([rand]),
      });
      return d?.[0];
    },
    async jobActualizeaza(id, patch) {
      const d = await cere(`dezro_jobs?id=eq.${Number(id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ ...patch, actualizat_la: new Date().toISOString() }),
      });
      return d?.[0];
    },
    async jobUltimele(cate = 10) {
      return cere(`dezro_jobs?select=*&order=id.desc&limit=${cate}`);
    },

    // ---------- cifrele ecranului ----------
    /**
     * Câte rânduri are catalogul și câte mapări sunt făcute.
     *
     * Se numără ÎN BAZĂ, cu `count=exact` și `Range: 0-0`, nu aducând rândurile
     * și numărându-le în Node. La 2.700 de noduri de catalog și 900 de mapări,
     * ecranul de admin ar căra 3,6 MB prin rețea la fiecare deschidere, ca să
     * afișeze șase numere — exact tiparul reparat la 28 august 2026 (contoarele
     * nu se calculează în Node).
     */
    async numaraRanduri(tabela, filtre = {}) {
      const q2 = Object.entries(filtre).map(([k, v]) => `${k}=${v}`).join("&");
      const r = await fetch(`${url}/rest/v1/${tabela}?select=1${q2 ? "&" + q2 : ""}`, {
        headers: { ...h, Prefer: "count=exact", Range: "0-0", "Range-Unit": "items" },
      });
      if (!r.ok) throw new Error(`${tabela}: HTTP ${r.status}`);
      const total = Number(String(r.headers.get("content-range")).split("/")[1]);
      if (!Number.isFinite(total)) throw new Error(`${tabela}: content-range fără total.`);
      return total;
    },

    async stare() {
      const d = await cere("dezro_stare_piese?select=*");
      return d?.[0] ?? null;
    },

    /** Câte anunțuri active n-au piesă eligibilă. Numărat în bază, nu în Node:
     *  altfel ar trebui aduse toate anunțurile prin rețea ca să se compare. */
    async pragRetragere() {
      const d = await cere("dezro_de_retras?select=active,de_retras");
      const active = Number(d?.[0]?.active) || 0;
      const deRetras = Number(d?.[0]?.de_retras) || 0;
      const procent = active ? deRetras / active : 0;
      return { active, deRetras, procent };
    },
  };
}

export function depozitDinMediu() {
  return creeazaDepozit({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}
