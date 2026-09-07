// ============================================================
// CLIENTUL api.dez.ro — singurul loc din proiect care vorbește cu ei.
//
// Modul COMUN (`.mjs`), ca `lib/import/`: aceleași apeluri merg și în ruta
// /api/dezro, și în scriptul din terminal. Nicio regulă despre dez.ro n-are voie
// să existe în altă parte.
//
// CE S-A MĂSURAT PE API-UL LOR (7 septembrie 2026, cu cheia reală)
//
//   1. `GET /brands?with_models` și `GET /parts?with_children` — arborele întreg
//      într-o cerere — răspund cu 504 de la gateway. Ghidul lor le recomandă
//      („fetch the full trees in one response each"), dar în practică pică.
//      DE ACEEA catalogul se aduce mereu în trepte: /brands, apoi
//      /brands/{tip}/{id}/models pentru fiecare marcă; /parts/{tip}, apoi
//      /parts/{tip}/{id}/children?with_children pentru fiecare grupă.
//      Măsurat: 28 de cereri pentru tot arborele de categorii auto, 573 de
//      noduri; 39 de cereri pentru modelele mărcilor pe care le avem, 2.134 de
//      modele.
//
//   2. Răspund INTERMITENT cu 500 și 504 pe cereri perfect valide. Aceeași
//      adresă, cerută din nou după câteva secunde, întoarce 200. De aici scara
//      de reîncercări; fără ea, o sincronizare de catalog pică la primul hop.
//
//   3. Cererile dese sunt încetinite: prima cerere ~0,2s, a zecea la rând ~8s.
//      De aceea există PAUZA_MS între cereri — aceeași politețe ca la importul
//      din pieseauto.ro, și din același motiv practic: cine lovește tare e
//      încetinit sau blocat.
//
//   4. Fără `User-Agent` propriu, cererea primește 403 de la Cloudflare-ul din
//      fața lor. Nu e scris nicăieri în ghid; s-a văzut la prima rulare din Node.
//
//   5. Erorile de dinainte de validarea antetelor sunt în engleză
//      („Unauthorized", „Missing required 'X-MEDIUM' header"), restul în română,
//      gata traduse. Ghidul spune limpede: pe cele în engleză NU le arăți
//      clientului, sunt defecte de-ale noastre.
// ============================================================

export const BAZA = "https://api.dez.ro";

/** Un singur mediu, hotărât la construcție, trimis pe FIECARE cerere. Ghidul lor
 *  spune explicit: o aplicație țintește exact un mediu și nu îl schimbă la
 *  execuție. Al nostru e „dezro" — piese auto, în română. */
export const MEDIUM = "dezro";

/** Tipul de catalog pe care îl folosim. Ei au `car`, `truck` și `tire`; noi
 *  vindem piese de mașini, deci `car`. Constanta există ca să nu fie scris „car"
 *  în zece locuri. */
export const TIP = "car";

/** Anunț de tip „Piese Auto". Cere `idBrand`, `idModel` ȘI `idPart`.
 *  Celelalte tipuri (1 Dezmembrări, 2 Mașini avariate, 3 Anvelope, 4 Piese
 *  camioane) nu ni se potrivesc: noi trimitem piese, bucată cu bucată. */
export const TIP_ANUNT = 0;

/** Pauza dintre două cereri către ei. Vezi punctul 3 din antet. */
export const PAUZA_MS = 900;

/** Cât așteptăm un răspuns înainte să renunțăm la o încercare, ÎNTR-O FUNCȚIE
 *  SERVERLESS. Nu poate fi mai mare: funcția însăși trăiește 60 de secunde, iar
 *  peste ea cererea e tăiată din afară, cu 504, exact acolo unde n-am mai apuca
 *  să scriem în bază ce s-a întâmplat. */
export const TIMEOUT_MS = 30_000;

/** Cât așteptăm ÎN TERMINAL, unde nu există limita de 60 de secunde.
 *
 *  DE CE EXISTĂ (măsurat la 7 septembrie 2026, pe contul real)
 *  API-ul lor nu e doar cu hopuri, ci și lent la ore de vârf: `GET /ads?page=1`
 *  a răspuns în 23s, apoi în 98s, apoi deloc — pentru UN SINGUR anunț. O
 *  actualizare de anunț a expirat de partea noastră la 30 de secunde, dar
 *  anunțul citit după aceea AVEA schimbarea: cererea ajunsese, doar răspunsul
 *  întârziase.
 *  Cu 30 de secunde, publicarea din panou ar da eroare după eroare la orele în
 *  care ei sunt încărcați. Scriptul din terminal n-are limita aia, deci are voie
 *  să aștepte cât trebuie. */
export const TIMEOUT_LUNG_MS = 150_000;

/** Scara de reîncercări, în milisecunde. Trei încercări în plus, cu pauze
 *  crescătoare: acoperă hopurile de la punctul 2 fără să încurce un API care e
 *  cu adevărat căzut. Suma (1+4+9 = 14s) intră în bugetul unui lot. */
export const REINCERCARI_MS = [1000, 4000, 9000];

const asteapta = (ms) => new Promise((r) => setTimeout(r, ms));

/** Eroare de la ei, cu tot ce trebuie ca să se decidă ce se face mai departe. */
export class EroareDezro extends Error {
  constructor(mesaj, { stare = 0, cale = "", corp = "" } = {}) {
    super(mesaj);
    this.name = "EroareDezro";
    this.stare = stare;
    this.cale = cale;
    this.corp = corp;
  }
  /** Sesiunea a expirat sau lipsește: se cere alt token și se reîncearcă O DATĂ. */
  get sesiuneExpirata() {
    return this.stare === 401;
  }
  /** Merită reîncercat: hopurile lor de server și rețeaua. 4xx nu se reîncearcă
   *  niciodată — un 422 reîncercat de trei ori tot 422 rămâne. */
  get tranzitorie() {
    return this.stare === 0 || this.stare === 429 || this.stare >= 500;
  }
}

/**
 * O cerere, cu reîncercări. Nu știe nimic despre sesiuni — cine cheamă pune
 * `token`, dacă e nevoie.
 *
 * @param {object} cfg  { cheie, jurnal? }
 * @param {string} cale ex. „/brands/car/5/models"
 * @param {object} opt  { metoda, token, corp (obiect sau FormData), pauza }
 */
export async function cere(cfg, cale, opt = {}) {
  if (!cfg?.cheie) throw new EroareDezro("Lipsește cheia API dez.ro (Admin → Integrări).", { cale });

  const antete = {
    Authorization: `Bearer ${cfg.cheie}`,
    "X-MEDIUM": MEDIUM,
    Accept: "application/json",
    // Fără asta, Cloudflare-ul lor răspunde 403 (punctul 4 din antet).
    "User-Agent": "AutopasDezmembrari/1.0 (+https://autopas-dezmembrari.ro)",
  };
  if (opt.token) antete["X-Session-Token"] = opt.token;

  let corp;
  if (opt.corp instanceof FormData) {
    corp = opt.corp;                       // `fetch` pune singur boundary-ul
  } else if (opt.corp) {
    corp = JSON.stringify(opt.corp);
    antete["Content-Type"] = "application/json";
  }

  const incercari = [0, ...REINCERCARI_MS];
  let ultima = null;

  // TERMENUL LOTULUI. Fără el, o singură cerere poate ține 30s + scara de
  // reîncercări (1+4+9) + încă trei timeouturi — peste 100 de secunde, adică
  // dublul cât trăiește o funcție pe Vercel. Cererea ar fi tăiată din afară, cu
  // 504, exact în locul unde noi n-am mai putea scrie nimic în bază despre ce
  // s-a întâmplat. Cu `pana`, motorul spune „ai atâta timp": nu se începe o
  // încercare care oricum n-ar apuca să se termine, iar ultima încercare se
  // scurtează la timpul rămas.
  const pana = opt.pana ?? null;

  for (let i = 0; i < incercari.length; i++) {
    if (incercari[i]) await asteapta(incercari[i]);
    else if (opt.pauza !== false) await asteapta(PAUZA_MS);

    let limita = opt.timeout ?? TIMEOUT_MS;
    if (pana) {
      const ramas = pana - Date.now();
      if (ramas <= 1000) throw ultima ?? new EroareDezro("nu mai e timp în lotul curent", { cale });
      limita = Math.min(limita, ramas);
    }
    const stop = AbortSignal.timeout ? AbortSignal.timeout(limita) : undefined;
    let r;
    try {
      r = await fetch(BAZA + cale, {
        method: opt.metoda ?? "GET",
        headers: antete,
        body: corp,
        signal: stop,
      });
    } catch (e) {
      ultima = new EroareDezro(`nu s-a putut ajunge la dez.ro: ${e?.message ?? e}`, { cale });
      continue;   // rețea sau timeout — se reîncearcă
    }

    const text = await r.text().catch(() => "");
    let date = null;
    try { date = text ? JSON.parse(text) : null; } catch { /* nu e JSON */ }

    if (r.ok) return date?.data ?? date ?? {};

    const mesaj = date?.error || `HTTP ${r.status}`;
    ultima = new EroareDezro(mesaj, { stare: r.status, cale, corp: text.slice(0, 300) });
    // 4xx (în afară de 429) e vina cererii, nu a momentului: nu se reîncearcă.
    if (!ultima.tranzitorie) throw ultima;
  }
  throw ultima ?? new EroareDezro("cerere eșuată fără motiv cunoscut", { cale });
}

// ------------------------------------------------------------
// SESIUNEA
//
// Token-ul e valabil 30 de zile de la emitere, NU se prelungește la folosire, și
// fiecare autentificare emite altul, independent. Deci: se ține minte, se
// refolosește, și se ia altul doar când ei îl refuză.
//
// Autentificările EȘUATE sunt limitate la 5 la 15 minute pe identificator+IP. De
// aceea un 401 la login NU se reîncearcă niciodată automat: a treia încercare
// automată ne-ar bloca contul pentru un sfert de oră fără ca nimeni să înțeleagă
// de ce.
// ------------------------------------------------------------

/** @returns {Promise<{token:string, expira:string}>} */
export async function autentifica(cfg) {
  if (!cfg?.utilizator || !cfg?.parola)
    throw new EroareDezro("Lipsesc utilizatorul sau parola de dez.ro (Admin → Integrări).");

  let d;
  try {
    d = await cere(cfg, "/user/login", {
      metoda: "POST",
      corp: { identifier: cfg.utilizator, password: cfg.parola },
    });
  } catch (e) {
    if (e instanceof EroareDezro && e.stare === 429)
      throw new EroareDezro(
        "Prea multe autentificări eșuate la dez.ro. Verifică utilizatorul și parola și încearcă din nou peste 15 minute.",
        { stare: 429 },
      );
    if (e instanceof EroareDezro && e.stare === 401)
      throw new EroareDezro(
        `dez.ro a refuzat autentificarea: ${e.message}. Verifică utilizatorul și parola din Admin → Integrări.`,
        { stare: 401 },
      );
    throw e;
  }

  const token = d?.token;
  if (!token) throw new EroareDezro("dez.ro nu a întors niciun token de sesiune.");
  // 30 de zile de la emitere. Scădem o zi ca să nu ne prindă expirarea în
  // mijlocul unei publicări de câteva ore.
  const expira = new Date(Date.now() + 29 * 24 * 3600 * 1000).toISOString();
  return { token, expira };
}

/**
 * O sesiune refolosibilă.
 *
 * `iaToken` primește token-ul salvat (dacă mai e valabil) și îl scrie înapoi
 * când se ia unul nou — ca să nu ne autentificăm la fiecare lot. Cine o
 * construiește hotărăște unde se salvează (la noi: `settings.integrari.dezro`).
 */
export function creeazaSesiune(cfg, { token = null, expira = null, salveaza = null } = {}) {
  let curent = token && expira && new Date(expira) > new Date() ? token : null;

  async function asigura() {
    if (curent) return curent;
    const nou = await autentifica(cfg);
    curent = nou.token;
    if (salveaza) await salveaza(nou);
    return curent;
  }

  return {
    get token() { return curent; },
    asigura,
    /**
     * Cerere cu sesiune. Dacă ei răspund 401 („Invalid or expired session
     * token"), se ia UN token nou și se reîncearcă o singură dată. A doua oară
     * nu mai insistăm: dacă și token-ul proaspăt e refuzat, problema e la cont,
     * nu la token, iar reîncercările ne-ar bloca autentificarea.
     */
    async cere(cale, opt = {}) {
      const t = await asigura();
      try {
        return await cere(cfg, cale, { ...opt, token: t });
      } catch (e) {
        if (!(e instanceof EroareDezro) || !e.sesiuneExpirata) throw e;
        curent = null;
        const t2 = await asigura();
        return await cere(cfg, cale, { ...opt, token: t2 });
      }
    },
  };
}

// ------------------------------------------------------------
// CATALOGUL LOR (fără sesiune — doar cheia de aplicație)
// ------------------------------------------------------------

/** Mărcile unui tip. Fără `with_models`: vezi punctul 1 din antet. */
export async function marci(cfg, tip = TIP, opt = {}) {
  const d = await cere(cfg, `/brands/${tip}`, opt);
  return (d?.brands ?? []).map((b) => ({ dezro_id: b.id, nume: b.name, alias: b.alias ?? null }));
}

/** Modelele unei mărci. La `tire` ei răspund 400 — n-au modele deloc. */
export async function modele(cfg, idMarca, tip = TIP, opt = {}) {
  const d = await cere(cfg, `/brands/${tip}/${idMarca}/models`, opt);
  return (d?.models ?? []).map((m) => ({
    dezro_id: m.id, nume: m.name, alias: m.alias ?? null, parinte: Number(idMarca),
  }));
}

/** Categoriile de nivel întâi. */
export async function categoriiRadacina(cfg, tip = TIP, opt = {}) {
  const d = await cere(cfg, `/parts/${tip}`, opt);
  return (d?.parts ?? []).map((p) => ({
    dezro_id: p.id, nume: p.name, alias: p.alias ?? null,
    parinte: null, selectabil: p.selectable === 1 || p.selectable === true,
  }));
}

/** Tot subarborele unei categorii, aplatizat. Un singur apel pe grupă —
 *  `with_children` pe UN nod merge (0,2s măsurat), pe tot arborele nu. */
export async function categoriiCopii(cfg, idCategorie, tip = TIP, opt = {}) {
  const d = await cere(cfg, `/parts/${tip}/${idCategorie}/children?with_children=1`, opt);
  const out = [];
  const plat = (nod, parinte) => {
    out.push({
      dezro_id: nod.id, nume: nod.name, alias: nod.alias ?? null,
      parinte, selectabil: nod.selectable === 1 || nod.selectable === true,
    });
    for (const c of nod.children ?? []) plat(c, nod.id);
  };
  for (const c of d?.children ?? []) plat(c, Number(idCategorie));
  return out;
}

/** Tipurile de anunț, cu etichetele lor. Nu se codează niciodată în cod:
 *  ghidul spune că sunt specifice mediului și se pot schimba. */
export async function tipuriAnunt(cfg) {
  const d = await cere(cfg, "/ads/types");
  return d?.types ?? [];
}

// ------------------------------------------------------------
// ANUNȚURILE (cer sesiune)
// ------------------------------------------------------------

/** Câte anunțuri avem la ei, pe stări. Cea mai ieftină verificare a legăturii. */
export async function numaraAnunturi(sesiune) {
  const d = await sesiune.cere("/ads?count=1");
  return d?.counts ?? { total: 0, approved: 0, pending: 0 };
}

/** O pagină din anunțurile noastre (10 pe pagină, la ei). */
export async function listeazaAnunturi(sesiune, pagina = 1) {
  const d = await sesiune.cere(`/ads?page=${pagina}`);
  return { anunturi: d?.ads ?? [], paginare: d?.pagination ?? null };
}

export async function citesteAnunt(sesiune, idAnunt) {
  const d = await sesiune.cere(`/ads/${idAnunt}`);
  return d?.ad ?? null;
}

/** Creează un anunț. `campuri` e obiectul plat, `poze` sunt {nume, tip, date}. */
export async function creeazaAnunt(sesiune, campuri, poze = [], opt = {}) {
  const d = await sesiune.cere("/ads", { ...opt, metoda: "POST", corp: formular(campuri, poze) });
  return d?.ad ?? null;
}

/** Actualizează un anunț. Se trimit DOAR câmpurile date; restul rămân neatinse.
 *  Pozele din `poze` se ADAUGĂ peste cele existente (până la 10 în total). */
export async function actualizeazaAnunt(sesiune, idAnunt, campuri, poze = [], opt = {}) {
  const d = await sesiune.cere(`/ads/${idAnunt}`, { ...opt, metoda: "POST", corp: formular(campuri, poze) });
  return d?.ad ?? null;
}

export async function stergeAnunt(sesiune, idAnunt, opt = {}) {
  return await sesiune.cere(`/ads/${idAnunt}`, { ...opt, metoda: "DELETE" });
}

export async function stergePoza(sesiune, idAnunt, idPoza, opt = {}) {
  return await sesiune.cere(`/ads/${idAnunt}/image/${idPoza}`, { ...opt, metoda: "DELETE" });
}

/** Câte poze acceptă un anunț, cu totul. Peste atât, ei le ignoră tăcut. */
export const MAX_POZE = 10;
/** Cât poate avea o poză. Ale noastre, în WebP, au sub 100 KB — dar regula
 *  trebuie să existe undeva, ca să nu trimitem niciodată un fișier respins. */
export const MAX_OCTETI_POZA = 8 * 1024 * 1024;

/** Corpul multipart al unui anunț. Câmpurile goale NU se trimit: la actualizare,
 *  un câmp lipsă înseamnă „lasă-l cum e", iar unul gol ar șterge ce era acolo. */
function formular(campuri, poze) {
  const f = new FormData();
  for (const [k, v] of Object.entries(campuri)) {
    if (v === undefined || v === null || v === "") continue;
    f.append(k, String(v));
  }
  for (const p of poze.slice(0, MAX_POZE)) {
    f.append("images[]", new Blob([p.date], { type: p.tip }), p.nume);
  }
  return f;
}
