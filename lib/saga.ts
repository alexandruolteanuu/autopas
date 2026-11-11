// ============================================================
// SAGA PE SERVER (pasul 7 din docs/saga-plan.md) — legătura dintre clientul API
// (`lib/saga-api.mjs`, singurul care folosește și ROTEȘTE cheia) și tabelele din
// migrarea 52. Aici NU se citește niciun antet SAGA și nu se ia nicio decizie
// despre cheie: doar se dă depozitul (lacătul, cheia, jurnalul).
//
// DOAR pe server: folosește cheia de serviciu Supabase (`sbAdmin`). Cheia SAGA
// nu iese niciodată din funcțiile de aici spre browser.
// ============================================================
import { sbAdmin } from "@/lib/supabase";
import { creeazaClientSaga, EroareSaga, adresaApi } from "@/lib/saga-api.mjs";
import { cifCurat } from "@/lib/saga-xml.mjs";

export { EroareSaga };

/** Ce vede panoul despre cheie — niciodată cheia însăși. */
export type StareCheieSaga = {
  setata: boolean; salvata_la: string | null; rotita_la: string | null; rotiri: number;
  folosita_la: string | null; blocata_la: string | null; blocata_motiv: string | null;
};

function admin() {
  const sb = sbAdmin();
  if (!sb) throw new EroareSaga("Lipsește SUPABASE_SERVICE_ROLE_KEY pe server — legătura cu SAGA nu poate porni.", { cod: "config" });
  return sb;
}

const cere = async <T,>(p: PromiseLike<{ data: T; error: { message: string } | null }>, ce: string): Promise<T> => {
  const { data, error } = await p;
  if (error) throw new EroareSaga(`Baza de date (${ce}): ${error.message}`, { cod: "baza" });
  return data;
};

/** Clientul SAGA cu depozitul real. `de` = id-ul omului care a pornit operația. */
export async function clientSaga() {
  const sb = admin();
  const [integrari, firma] = await Promise.all([
    cere(sb.from("settings").select("valoare").eq("cheie", "integrari").maybeSingle(), "setări"),
    cere(sb.from("settings").select("valoare").eq("cheie", "firma").maybeSingle(), "date firmă"),
  ]);
  const saga = ((integrari as any)?.valoare?.saga ?? {}) as Record<string, string | undefined>;
  const cif = cifCurat((firma as any)?.valoare?.cui);

  const depozit = {
    iaBlocarea: async (id: string, secunde: number) =>
      (await cere(sb.rpc("saga_ia_blocarea", { p_detinator: id, p_secunde: secunde }), "lacăt")) === true,
    elibereaza: async (id: string) => { await cere(sb.rpc("saga_elibereaza", { p_detinator: id }), "lacăt"); },
    citesteCheia: async () =>
      ((await cere(sb.from("saga_cheie").select("cheie").eq("unic", true).maybeSingle(), "cheie")) as any)?.cheie ?? null,
    // Cheia merge în CORPUL cererii (RPC), nu în adresă: un filtru `?cheie=eq.…` ar rămâne în jurnalele de acces.
    rotesteCheia: async (veche: string, noua: string) =>
      (await cere(sb.rpc("saga_roteste_cheia", { p_veche: veche, p_noua: noua }), "rotire")) === true,
    salveazaCheia: async (cheie: string, de: string | null) => {
      await cere(sb.rpc("saga_salveaza_cheia", { p_cheie: cheie, p_de: de }), "salvarea cheii");
    },
    marcheazaFolosita: async () => {
      await cere(sb.from("saga_cheie").update({ folosita_la: new Date().toISOString() }).eq("unic", true), "cheie");
    },
    marcheazaBlocata: async (motiv: string) => {
      await cere(sb.from("saga_cheie").update({ blocata_la: new Date().toISOString(), blocata_motiv: motiv }).eq("unic", true), "cheie");
    },
    jurnal: async (r: Record<string, unknown>) => { await cere(sb.from("saga_trimiteri").insert(r), "jurnal"); },
  };

  return { client: creeazaClientSaga({ depozit, url: saga.url_api, cif }), articolImplicit: saga.articol_implicit ?? "",
           adresa: adresaApi(saga.url_api), cif, setariSaga: saga };
}

/** Starea cheii și ultimele apeluri, pentru panou. Fără cheie, fără corpul răspunsurilor. */
export async function stareSaga(): Promise<{ cheie: StareCheieSaga; apeluri: Record<string, unknown>[] }> {
  const sb = admin();
  const [k, j] = await Promise.all([
    cere(sb.from("saga_cheie").select("salvata_la,rotita_la,rotiri,folosita_la,blocata_la,blocata_motiv").eq("unic", true).maybeSingle(), "cheie"),
    cere(sb.from("saga_trimiteri").select("id,created_at,tip,http_status,durata_ms,cheie_rotita,eroare").order("id", { ascending: false }).limit(5), "jurnal"),
  ]);
  const r = k as any;
  return {
    cheie: {
      setata: !!r, salvata_la: r?.salvata_la ?? null, rotita_la: r?.rotita_la ?? null, rotiri: r?.rotiri ?? 0,
      folosita_la: r?.folosita_la ?? null, blocata_la: r?.blocata_la ?? null, blocata_motiv: r?.blocata_motiv ?? null,
    },
    apeluri: (j as any[]) ?? [],
  };
}

// ------------------------------------------------------------
// FACTURILE (pasul 8): depozitul pentru lib/saga-trimitere.mjs. Starea facturii o scrie
// DOAR serverul (cheia de serviciu); triggerul `facturi_pazeste` din migrarea 49 decide
// în continuare ce trecere e permisă (o factură trimisă nu mai dă înapoi).
// ------------------------------------------------------------
export function depozitFacturi() {
  const sb = admin();
  return {
    citesteFactura: async (id: number) => {
      const f = await cere(sb.from("facturi").select("*").eq("id", id).maybeSingle(), "factura");
      if (!f) return null;
      const linii = await cere(sb.from("facturi_linii").select("*").eq("factura_id", id).order("nr_crt"), "liniile facturii");
      return { ...(f as any), linii: linii ?? [] };
    },
    // Atomic: scrie „in_curs” doar dacă starea e încă cea văzută (un „in_curs” doar dacă
    // e cel uitat — `updated_at` neschimbat). Două tab-uri: unul singur câștigă.
    revendica: async (id: number, vazuta: string) => {
      let q = sb.from("facturi").update({ saga_status: "in_curs" }).eq("id", id).eq("saga_status", vazuta);
      if (vazuta === "in_curs") {
        const f = await cere(sb.from("facturi").select("updated_at").eq("id", id).maybeSingle(), "factura");
        q = q.eq("updated_at", (f as any)?.updated_at ?? "");
      }
      const rand = await cere(q.select("id"), "revendicarea facturii");
      return Array.isArray(rand) && rand.length === 1;
    },
    seteazaStare: async (id: number, campuri: Record<string, unknown>) => {
      const rand = await cere(sb.from("facturi").update(campuri).eq("id", id).select("id"), "starea facturii");
      if (!Array.isArray(rand) || rand.length !== 1) throw new EroareSaga(`Starea facturii ${id} nu s-a putut scrie.`, { cod: "baza" });
    },
  };
}

/** „Marchează confirmată”: doar din „trimisă”, după validarea făcută de om în SAGA. */
export async function confirmaFactura(id: number, de: string) {
  const sb = admin();
  const rand = await cere(sb.from("facturi")
    .update({ saga_status: "confirmata", confirmata_la: new Date().toISOString(), confirmata_de: de })
    .eq("id", id).eq("saga_status", "trimisa").select("id,serie,numar"), "confirmarea facturii");
  if (!Array.isArray(rand) || rand.length !== 1)
    throw new EroareSaga("Factura nu e în starea „trimisă” (poate a fost confirmată deja). Reîncarcă pagina.", { cod: "stare" });
  return rand[0] as { id: number; serie: string; numar: number };
}
