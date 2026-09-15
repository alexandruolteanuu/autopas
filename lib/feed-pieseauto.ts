// ============================================================
// FEED-UL PENTRU pieseauto.ro — site-ul nostru e sursa, ei importă zilnic
//
// DE CE (15 septembrie 2026)
// Fluxul s-a întors: piesele se pun ÎNTÂI pe site-ul nostru, iar pieseauto.ro le
// preia dintr-un fișier CSV aflat la o adresă fixă, pe care îl importă automat în
// fiecare zi (instrucțiunile lor: „contul meu → utile → vezi format csv"). Tot ce
// se schimbă la noi — preț, stoc, piese noi, piese vândute — ajunge la ei a doua zi.
//
// FORMATUL LOR (verificat pe fișierul-exemplu primit, `exemplu-import-piese.csv`)
//   · FĂRĂ rând de antet; separator `;`, ghilimele `"` dublate înăuntru, rânduri CRLF
//   · 8 coloane: ID (întreg pe 64 de biți, ≠ 0) · titlu · categorie · descriere HTML ·
//     monedă · preț · cantitate (întreg ≥ 0) · poze, separate prin `[,]`
//   · un singur fișier cu TOT; orice import nou actualizează ce era importat înainte
//
// SCENARIILE, MĂSURATE PE BAZA REALĂ (15 septembrie 2026, 8.866 de piese)
//   · ID: 8.847 de piese au venit DE LA ei și au ID-ul lor (`sursa_id`, 243.160 …
//     2.146.524.021). Se trimite ACELA — dacă importul lor leagă după ID-ul
//     anunțului, nu apar 8.847 de anunțuri dublate. Piesele născute pe site
//     primesc 1.000.000.000.000 + id-ul nostru: o plajă în care un ID de-al lor
//     nu poate cădea niciodată, oricât ar crește catalogul.
//   · CATEGORIA: textul categoriei LOR, nu al nostru. 8.785 de piese știu exact
//     categoria originală, din adresa anunțului lor. Piesele noi o primesc din
//     subcategoria noastră, după categoria-sursă cea mai frecventă a pieselor din
//     ea (286 din 293 de subcategorii au una singură). Apoi potrivire după nume.
//     Ce nu se poate verifica pleacă cu numele nostru și e numărat în panou.
//   · POZELE: 20.147 din 20.220 sunt WebP. Exemplul lor are `.jpg`, iar un
//     importator vechi poate refuza WebP, deci pozele pleacă prin
//     `/feed/poze/…jpg`, care le convertește în JPEG (app/feed/poze).
//   · VÂNDUTE (stoc 0) și ASCUNSE de operator: pleacă cu cantitate 0, ca anunțul lor
//     să se stingă. Omise din fișier, n-am ști dacă importul lor le șterge sau le
//     lasă active — iar o piesă unicat rămasă activă e un telefon degeaba.
//   · CIORNELE (62, piese venite din CSV-ul lor, fără poze și descriere) NU pleacă:
//     trimise, ar goli pozele și descrierea anunțurilor lor existente.
//   · TEXT: 51 de titluri au ghilimele (se dublează), 3 texte au backslash (se
//     scoate — `fgetcsv` din PHP îl tratează drept caracter de escape), rândurile
//     noi din descriere devin `<br>` (un rând nou crud rupe unele importatoare).
//
// CITIREA se face cu cheia de server (`sbAdmin`): vizitatorul anonim nu vede
// piesele ascunse, iar ele trebuie trimise cu cantitate 0. În fișier NU ajunge
// nimic intern — costul, vizualizările, datele de import rămân în bază.
// ============================================================
import { sbAdmin, citesteTot } from "./supabase";
import { SITE_URL } from "./config";
import { paragrafe } from "./format";
import TAXONOMIE_SURSA from "./import/taxonomie-sursa.mjs";
import { taxonomieDinUrl } from "./import/extragere.mjs";
import { cheieLaxa, normalizeaza, GRUPE_LA_PARINTE } from "./import/potrivire.mjs";

/** Plaja ID-urilor pieselor născute pe site. Peste orice ID de anunț pieseauto
 *  (cel mai mare văzut: 2.146.524.021) și departe de limita de 64 de biți. */
export const BAZA_ID_SITE = 1_000_000_000_000;
export const MONEDA = "RON";
/** Câte compatibilități se scriu în descriere. Peste atât devine perete de text. */
const MAX_COMPAT = 12;
const MAX_TITLU = 200;

export type Provenienta = "anunt" | "mapare" | "nume" | "apropiata" | "neverificata";

export type RandPieseauto = {
  id: string; id_baza: number; titlu: string; categorie: string; provenienta: Provenienta;
  descriere: string; pret: string; cantitate: number; poze: string[];
};

export type RaportPieseauto = {
  total_baza: number; trimise: number; in_stoc: number; cantitate_zero: number;
  excluse_ciorne: number; excluse_fara_pret: number; fara_poze: number;
  id_de_la_pieseauto: number; id_nou: number;
  categorii: Record<Provenienta, number>;
  /** Categoriile trimise cu numele nostru, necunoscute în catalogul lor, cu câte piese. */
  neverificate: Record<string, number>;
};

type Produs = {
  id: number; nume: string; stare_nota: string | null; pret_lei: number; stoc: number; publicat: boolean;
  poze: string[] | null; categorie_id: number | null; subcategorie_id: number | null;
  sursa_id: string | null; sursa_url: string | null; compat: string[] | null; ani: string | null;
  oem: string | null; cod_intern: string | null; import_erori: { ciorna?: boolean } | null;
};

// ------------------------------------------------------------
// TEXT
// ------------------------------------------------------------
/** Scoate ce strică un CSV citit cu `fgetcsv`: backslash-ul (caracter de escape
 *  în PHP) și caracterele de control. Rândurile noi le tratează fiecare câmp. */
const curat = (t: string) => (t ?? "").replace(/\\/g, "/").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
const unRand = (t: string) => curat(t).replace(/\s+/g, " ").trim();
const html = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Descrierea HTML: textul vânzătorului pe paragrafe, apoi ce știm sigur despre
 *  piesă. Fără niciun link către site-ul nostru — pe un portal de anunțuri e
 *  motiv de respingere (aceeași regulă ca la dez.ro). */
export function descriereHtml(p: Pick<Produs, "nume" | "stare_nota" | "compat" | "ani" | "oem" | "cod_intern">) {
  const bucati: string[] = [];
  const text = curat(p.stare_nota ?? "");
  const par = paragrafe(text);
  if (par.length) {
    for (const x of par) bucati.push(`<p>${x.split("\n").map((l) => html(l.trim())).filter(Boolean).join("<br>")}</p>`);
  } else {
    bucati.push(`<p>${html(unRand(p.nume))}</p>`);
  }
  const compat = (p.compat ?? []).map(unRand).filter(Boolean);
  if (compat.length) bucati.push(`<p><strong>Compatibilă cu:</strong> ${compat.slice(0, MAX_COMPAT).map(html).join("; ")}</p>`);
  if (p.ani?.trim()) bucati.push(`<p><strong>Ani:</strong> ${html(unRand(p.ani))}</p>`);
  // Codul OEM doar dacă nu e deja în textul vânzătorului: acolo stă de obicei
  // chiar pe rândul „COD: …", iar un al doilea rând identic arată a greșeală.
  const oem = unRand(p.oem ?? "");
  if (oem && !text.toLowerCase().includes(oem.toLowerCase().split(" / ")[0])) bucati.push(`<p><strong>Cod OEM:</strong> ${html(oem)}</p>`);
  if (p.cod_intern) bucati.push(`<p><strong>Cod piesă:</strong> ${html(p.cod_intern)}</p>`);
  return bucati.join("");
}

/** Prețul: „350" sau „350.50". Punct zecimal, fără separator de mii. */
export const pretCsv = (n: number) => (Number.isInteger(Number(n)) ? String(Number(n)) : Number(n).toFixed(2));

/** Adresa pozei, prin conversia în JPEG. Calea din bucket se păstrează întreagă
 *  (inclusiv extensia originală), iar `.jpg` se adaugă la final ca importatorul
 *  să vadă o poză obișnuită. Bara dublă din adresele vechi (vezi CLAUDE.md) se
 *  scoate aici, nu în bază. */
export function pozaCsv(url: string) {
  const m = url.match(/\/storage\/v1\/object\/public\/poze-piese\/+(.+)$/);
  if (!m) return url.replace(/([^:])\/{2,}/g, "$1/");
  const cale = m[1].replace(/\/{2,}/g, "/");
  return `${SITE_URL}/feed/poze/${cale.split("/").map(encodeURIComponent).join("/")}.jpg`;
}

// ------------------------------------------------------------
// ID
// ------------------------------------------------------------
const INT64_MAX = BigInt("9223372036854775807");
/** ID-ul trimis: al anunțului lor, dacă piesa a venit de acolo; altfel plaja site-ului. */
export function idPieseauto(p: Pick<Produs, "id" | "sursa_id">): { id: string; deLaEi: boolean } {
  const s = (p.sursa_id ?? "").trim();
  if (/^\d{1,19}$/.test(s)) {
    const n = BigInt(s);
    if (n > BigInt(0) && n < BigInt(BAZA_ID_SITE) && n <= INT64_MAX) return { id: n.toString(), deLaEi: true };
  }
  return { id: String(BAZA_ID_SITE + p.id), deLaEi: false };
}

// ------------------------------------------------------------
// CSV
// ------------------------------------------------------------
/** Un câmp, cum îl scrie `fputcsv($f, $coloane, ';', '"')`: între ghilimele când
 *  conține separatorul, ghilimele, spații sau rânduri noi; ghilimelele dublate. */
export function campCsv(v: string | number) {
  const s = String(v);
  if (s === "") return "";
  return /[;"\s]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const randCsv = (r: RandPieseauto) =>
  [r.id, r.titlu, r.categorie, r.descriere, MONEDA, r.pret, String(r.cantitate),
   r.poze.map((u) => u.replace(/\[,\]/g, "[%2C]")).join("[,]")].map(campCsv).join(";") + "\r\n";

// ------------------------------------------------------------
// CATALOGUL
// ------------------------------------------------------------
export async function citesteCatalogPieseauto(): Promise<{ randuri: RandPieseauto[]; raport: RaportPieseauto }> {
  const sb = sbAdmin();
  if (!sb) throw new Error("Serverul nu are cheia bazei de date (SUPABASE_SERVICE_ROLE_KEY).");

  const [produse, categorii] = await Promise.all([
    citesteTot<Produs>(() => sb.from("products")
      .select("id,nume,stare_nota,pret_lei,stoc,publicat,poze,categorie_id,subcategorie_id,sursa_id,sursa_url,compat,ani,oem,cod_intern,import_erori", { count: "exact" })
      .order("id") as any, { eticheta: "piesele pentru pieseauto", plafon: 200_000 }),
    citesteTot<{ id: number; nume: string; parent_id: number | null }>(() =>
      sb.from("categories").select("id,nume,parent_id", { count: "exact" }).order("id") as any, { eticheta: "categoriile" }),
  ]);

  const raport: RaportPieseauto = {
    total_baza: produse.length, trimise: 0, in_stoc: 0, cantitate_zero: 0,
    excluse_ciorne: 0, excluse_fara_pret: 0, fara_poze: 0, id_de_la_pieseauto: 0, id_nou: 0,
    categorii: { anunt: 0, mapare: 0, nume: 0, apropiata: 0, neverificata: 0 }, neverificate: {},
  };

  const tax = TAXONOMIE_SURSA as Record<string, { nume: string; grup: string }>;
  const slugDin = (p: Produs) => {
    const s = p.sursa_url ? taxonomieDinUrl(p.sursa_url).categorie : null;
    return s && tax[s] ? s : null;
  };
  const cheieCat = (p: Produs) => `${p.categorie_id ?? ""}|${p.subcategorie_id ?? ""}`;

  // Maparea (categoria noastră -> categoria lor), MĂSURATĂ din piesele care au
  // venit de la ei: pentru fiecare pereche categorie/subcategorie, categoria-sursă
  // cea mai frecventă. Se recalculează la fiecare generare, deci ține pasul
  // singură cu mutările de categorii făcute în admin.
  const voturi = new Map<string, Map<string, number>>();
  for (const p of produse) {
    const s = slugDin(p); if (!s) continue;
    const m = voturi.get(cheieCat(p)) ?? new Map<string, number>();
    m.set(s, (m.get(s) ?? 0) + 1);
    voturi.set(cheieCat(p), m);
  }
  const mapare = new Map<string, string>();
  voturi.forEach((m, k) => {
    const top = Array.from(m.entries()).sort((a, b) => b[1] - a[1])[0];
    if (top) mapare.set(k, tax[top[0]].nume);
  });
  const dupaNume = new Map<string, string>();
  for (const slug of Object.keys(tax)) dupaNume.set(cheieLaxa(tax[slug].nume), tax[slug].nume);
  const catDupaId = new Map(categorii.map((c) => [c.id, c]));

  // Categoria APROPIATĂ, pentru o categorie de-a noastră fără nicio piesă venită de
  // la ei și fără nume identic („Stop stânga" -> „Stopuri"). Cuvintele noastre de
  // cel puțin 3 litere se potrivesc la ÎNCEPUT cu ale lor; la egalitate câștigă
  // categoria din grupa care corespunde părintelui nostru (GRUPE_LA_PARINTE),
  // apoi cea cu mai puține cuvinte, adică mai specifică.
  const cuvinte = (t: string) => (normalizeaza(t) as string).split(" ").filter((c: string) => c.length >= 3);
  const lor = Object.values(tax).map((x) => ({ ...x, cuv: cuvinte(x.nume) }));
  const apropiata = (nume: string, numeParinte: string | null) => {
    const ale = cuvinte(nume);
    if (!ale.length) return null;
    let best: { nume: string; scor: number; grup: boolean; lung: number } | null = null;
    for (const x of lor) {
      const scor = ale.filter((a) => x.cuv.some((b) => b.startsWith(a.slice(0, 4)) || a.startsWith(b.slice(0, 4)))).length;
      if (!scor) continue;
      const grup = !!numeParinte && GRUPE_LA_PARINTE[x.grup as keyof typeof GRUPE_LA_PARINTE] === numeParinte;
      const cand = { nume: x.nume, scor, grup, lung: x.cuv.length };
      if (!best || cand.scor > best.scor || (cand.scor === best.scor && (cand.grup && !best.grup
          || (cand.grup === best.grup && cand.lung < best.lung)))) best = cand;
    }
    return best?.nume ?? null;
  };

  const categoriaLor = (p: Produs): { nume: string; provenienta: Provenienta } => {
    const s = slugDin(p);
    if (s) return { nume: tax[s].nume, provenienta: "anunt" };
    const m = mapare.get(cheieCat(p));
    if (m) return { nume: m, provenienta: "mapare" };
    const noastra = catDupaId.get(p.subcategorie_id ?? -1) ?? catDupaId.get(p.categorie_id ?? -1);
    if (noastra) {
      const n = dupaNume.get(cheieLaxa(noastra.nume));
      if (n) return { nume: n, provenienta: "nume" };
      const parinte = noastra.parent_id ? catDupaId.get(noastra.parent_id)?.nume ?? null : noastra.nume;
      const a = apropiata(noastra.nume, parinte);
      if (a) return { nume: a, provenienta: "apropiata" };
      return { nume: noastra.nume, provenienta: "neverificata" };
    }
    return { nume: "Diverse", provenienta: "neverificata" };
  };

  const idVazute = new Set<string>();
  const randuri: RandPieseauto[] = [];
  for (const p of produse) {
    if (p.import_erori?.ciorna === true) { raport.excluse_ciorne++; continue; }
    if (!(Number(p.pret_lei) > 0)) { raport.excluse_fara_pret++; continue; }
    const { id, deLaEi } = idPieseauto(p);
    if (idVazute.has(id)) continue;   // imposibil prin construcție; plasă pentru date stricate
    idVazute.add(id);

    const cat = categoriaLor(p);
    const poze = (p.poze ?? []).filter(Boolean).map(pozaCsv);
    // Cantitatea: stocul, dar numai pentru piesele pe care operatorul le vrea pe site.
    const cantitate = p.publicat && p.stoc > 0 ? Math.max(0, Math.floor(p.stoc)) : 0;

    randuri.push({
      id, id_baza: p.id,
      titlu: unRand(p.nume).slice(0, MAX_TITLU).trim(),
      categorie: cat.nume, provenienta: cat.provenienta,
      descriere: descriereHtml(p),
      pret: pretCsv(Number(p.pret_lei)),
      cantitate, poze,
    });

    raport.trimise++;
    if (cantitate > 0) raport.in_stoc++; else raport.cantitate_zero++;
    if (!poze.length) raport.fara_poze++;
    if (deLaEi) raport.id_de_la_pieseauto++; else raport.id_nou++;
    raport.categorii[cat.provenienta]++;
    if (cat.provenienta === "neverificata") raport.neverificate[cat.nume] = (raport.neverificate[cat.nume] ?? 0) + 1;
  }
  return { randuri, raport };
}
