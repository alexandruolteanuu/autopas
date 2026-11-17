// „Emite factura” din browser (pasul 13, migrarea 60): O SINGURĂ cerere spre /api/saga
// (acțiunea „emite”), care face totul pe server — validarea, numărul, trimiterea în SAGA,
// verificarea. Dacă serverul lasă factura „se_trimite” (reîncercare în fundal), browserul
// doar citește starea la 2 s; închiderea paginii nu oprește nimic.
import { sbBrowser } from "@/lib/supabase";

export type RaspunsEmitere = {
  ok: boolean; stare?: string; id?: number; serie?: string | null; numar?: number | null;
  mesaj?: string | null; eroare?: string;
};

async function token() {
  const sb = sbBrowser();
  return sb ? (await sb.auth.getSession()).data.session?.access_token ?? "" : "";
}

/** `order_id` = factura comenzii (nouă sau reluată); `factura_id` = o factură / un storno anume. */
export async function emiteFactura(p: { order_id?: number; factura_id?: number }): Promise<RaspunsEmitere> {
  try {
    const r = await fetch("/api/saga", { method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
      body: JSON.stringify({ actiune: "emite", ...p }) });
    return await r.json().catch(() => ({ ok: false, eroare: `Răspuns neașteptat (HTTP ${r.status}).` }));
  } catch (e: any) {
    return { ok: false, eroare: `Legătura cu serverul a căzut: ${e?.message ?? e}` };
  }
}

/** Citește starea facturii la `pasMs` cât e „se_trimite”, cel mult `maxMs`. */
export async function asteaptaFactura(id: number, { pasMs = 2_000, maxMs = 120_000 } = {}): Promise<RaspunsEmitere> {
  const sb = sbBrowser();
  if (!sb) return { ok: false, eroare: "Fără legătură cu baza." };
  const pana = Date.now() + maxMs;
  for (;;) {
    const { data, error } = await sb.from("facturi").select("id,serie,numar,saga_status,saga_eroare").eq("id", id).maybeSingle();
    if (error) return { ok: false, eroare: error.message };
    if (!data) return { ok: true, stare: "eliberata", id, mesaj: "SAGA a respins factura; detaliile sunt în jurnalul comenzii." };
    if (data.saga_status !== "se_trimite" || Date.now() > pana)
      return { ok: true, stare: data.saga_status, id, serie: data.serie, numar: data.numar, mesaj: data.saga_eroare };
    await new Promise((r) => setTimeout(r, pasMs));
  }
}

/** Un singur rând pentru om. `bun` = factura e emisă; `fundal` = încă se lucrează la ea. */
export function textEmitere(j: RaspunsEmitere): { bun: boolean; fundal?: boolean; text: string } {
  if (!j.ok) return { bun: false, text: j.eroare ?? "Eroare necunoscută." };
  if (j.stare === "confirmata" || j.stare === "trimisa") return { bun: true, text: `✓ Factura ${j.serie} ${j.numar} emisă` };
  if (j.stare === "se_trimite") return { bun: false, fundal: true, text: "Se emite în fundal; poți închide pagina." };
  return { bun: false, text: j.mesaj || "Factura nu s-a putut emite." };
}

/** Butonul întreg: cererea, apoi așteptarea dacă a rămas în fundal. */
export async function emiteSiAsteapta(p: { order_id?: number; factura_id?: number }): Promise<RaspunsEmitere> {
  const j = await emiteFactura(p);
  return j.ok && j.stare === "se_trimite" && j.id ? asteaptaFactura(j.id) : j;
}
