// ============================================================
// OLX PE SERVER (pasul 1 din docs/olx-plan.md) — depozitul clientului din
// lib/olx-api.mjs: tabelele din migrarea 56, prin cheia de serviciu. Aici nu se
// folosește niciun token: doar se citesc și se scriu rândurile.
// DOAR pe server. Nicio funcție de aici nu întoarce tokenii sau client_secret.
// ============================================================
import { sbAdmin } from "@/lib/supabase";
import { creeazaClientOlx, EroareOlx } from "@/lib/olx-api.mjs";
import { SITE_URL } from "@/lib/config";
import { pozaCsv } from "@/lib/feed-pieseauto";

export { EroareOlx };

/** Setările anunțurilor (în `olx_cont.setari`, nu în `settings.integrari`). */
export type SetariOlx = {
  city_id?: number | null; district_id?: number | null; oras?: string;
  contact_nume?: string; contact_telefon?: string;
  /** false după ce OLX a refuzat „external_url” pentru contul nostru (pasul 2). */
  external_url?: boolean;
};

/** Ce vede panoul despre cont — niciodată tokenii sau secretul. */
export type StareOlx = {
  aplicatie: boolean; client_id: string | null; conectat: boolean;
  conectat_la: string | null; reinnoit_la: string | null; access_expira: string | null; folosit_la: string | null;
  deconectat_la: string | null; deconectat_motiv: string | null;
  utilizator: { id?: number; name?: string; email?: string; is_business?: boolean } | null;
  setari: SetariOlx;
  apeluri: { id: number; created_at: string; tip: string; metoda: string | null; cale: string | null; http_status: number | null; durata_ms: number | null; eroare: string | null }[];
  categorii: number; mapari: number;
};

export function admin() {
  const sb = sbAdmin();
  if (!sb) throw new EroareOlx("Lipsește SUPABASE_SERVICE_ROLE_KEY pe server — legătura cu OLX nu poate porni.", { cod: "config" });
  return sb;
}

export const cere = async <T,>(p: PromiseLike<{ data: T; error: { message: string } | null }>, ce: string): Promise<T> => {
  const { data, error } = await p;
  if (error) throw new EroareOlx(`Baza de date (${ce}): ${error.message}`, { cod: "baza" });
  return data;
};

/** Clientul OLX cu depozitul real. */
export function clientOlx() {
  const sb = admin();
  const depozit = {
    citesteCont: async () =>
      (await cere(sb.from("olx_cont").select("client_id,client_secret,access_token,access_expira,refresh_token").eq("unic", true).maybeSingle(), "cont")) as any,
    salveazaTokenii: async (t: { access_token: string; access_expira: string; refresh_token: string | null; scope: string | null }, conectare: { de: string | null } | null) => {
      const camp: Record<string, unknown> = {
        access_token: t.access_token, access_expira: t.access_expira, scope: t.scope, reinnoit_la: new Date().toISOString(),
        deconectat_la: null, deconectat_motiv: null,
      };
      if (t.refresh_token) camp.refresh_token = t.refresh_token;
      if (conectare) { camp.conectat_la = new Date().toISOString(); camp.conectat_de = conectare.de; }
      const r = await cere(sb.from("olx_cont").update(camp).eq("unic", true).select("unic"), "tokeni");
      return Array.isArray(r) && r.length === 1;
    },
    marcheazaDeconectat: async (motiv: string) => {
      await cere(sb.from("olx_cont").update({ deconectat_la: new Date().toISOString(), deconectat_motiv: motiv, access_token: null, access_expira: null }).eq("unic", true), "cont");
    },
    marcheazaFolosit: async () => { await cere(sb.from("olx_cont").update({ folosit_la: new Date().toISOString() }).eq("unic", true), "cont"); },
    iaBlocarea: async (id: string, secunde: number) => (await cere(sb.rpc("olx_ia_blocarea", { p_detinator: id, p_secunde: secunde }), "lacăt")) === true,
    elibereaza: async (id: string) => { await cere(sb.rpc("olx_elibereaza", { p_detinator: id }), "lacăt"); },
    jurnal: async (r: Record<string, unknown>) => { await cere(sb.from("olx_apeluri").insert(r), "jurnal"); },
  };
  return creeazaClientOlx({ depozit });
}

/** Starea pentru panou. Fără tokeni, fără secret. */
export async function stareOlx(): Promise<StareOlx> {
  const sb = admin();
  const [c, j, nc, nm] = await Promise.all([
    cere(sb.from("olx_cont").select("client_id,client_secret,refresh_token,conectat_la,reinnoit_la,access_expira,folosit_la,deconectat_la,deconectat_motiv,utilizator,setari").eq("unic", true).maybeSingle(), "cont"),
    cere(sb.from("olx_apeluri").select("id,created_at,tip,metoda,cale,http_status,durata_ms,eroare").order("id", { ascending: false }).limit(8), "jurnal"),
    sb.from("olx_categorii").select("id", { count: "exact", head: true }),
    sb.from("olx_mapari").select("categorie_id", { count: "exact", head: true }),
  ]);
  const r = (c ?? {}) as any;
  return {
    aplicatie: !!(r.client_id && r.client_secret), client_id: r.client_id ?? null,
    conectat: !!r.refresh_token && !r.deconectat_la,
    conectat_la: r.conectat_la ?? null, reinnoit_la: r.reinnoit_la ?? null, access_expira: r.access_expira ?? null,
    folosit_la: r.folosit_la ?? null, deconectat_la: r.deconectat_la ?? null, deconectat_motiv: r.deconectat_motiv ?? null,
    utilizator: r.utilizator ?? null, setari: (r.setari ?? {}) as SetariOlx,
    apeluri: (j as any[]) ?? [], categorii: nc.count ?? 0, mapari: nm.count ?? 0,
  };
}

/** Adresa de întoarcere după autorizare. Trebuie să fie EXACT cea înregistrată la OLX
 *  („Callback URL”). Implicit: domeniul pe care e deschis adminul + /api/olx/callback. */
export function adresaCallback(req: Request) {
  return `${new URL(req.url).origin}/api/olx/callback`;
}

// ------------------------------------------------------------
// PASUL 2 — contextul generatorului (lib/olx-anunt.mjs): potrivirile, categoriile
// OLX folosite de ele și setările anunțurilor. Citit o dată, folosit pe multe piese.
// ------------------------------------------------------------

/** Coloanele piesei de care are nevoie generatorul. */
export const COLOANE_PIESA = "id,nume,slug,stare_nota,ani,compat,oem,cod_intern,pret_lei,pret_sufix,poze,stoc,publicat,categorie_id,subcategorie_id";

export async function contextAnunt() {
  const sb = admin();
  const [m, c] = await Promise.all([
    cere(sb.from("olx_mapari").select("categorie_id,olx_categorie_id,atribute"), "potrivirile OLX"),
    cere(sb.from("olx_cont").select("setari").eq("unic", true).maybeSingle(), "setările OLX"),
  ]);
  const mapari = new Map<number, { olx_categorie_id: number; atribute: { code: string; value: string }[] }>(
    ((m as any[]) ?? []).map((r) => [Number(r.categorie_id), r]));
  const ids = Array.from(new Set(Array.from(mapari.values()).map((r) => r.olx_categorie_id)));
  const cats = ids.length
    ? ((await cere(sb.from("olx_categorii").select("id,cale,nume,photos_limit,atribute").in("id", ids), "categoriile OLX")) as any[])
    : [];
  return {
    mapari,
    categoriiOlx: new Map<number, any>(cats.map((r) => [Number(r.id), { ...r, cale: r.cale ?? r.nume }])),
    setari: (((c as any)?.setari ?? {}) as SetariOlx),
    siteUrl: SITE_URL,
    // Pozele pleacă prin conversia în JPEG (ca la pieseauto.ro): în bucket sunt WebP.
    poza: (u: string) => pozaCsv(u),
  };
}
