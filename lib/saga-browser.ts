// Trimiterea unei facturi în SAGA, chemată din browser (ruta /api/saga, acțiunea „trimite”).
// Folosită automat imediat după emitere / stornare (16 noiembrie 2026, cerut de proprietar:
// „facturile să se trimită automat în SAGA”). Logica și stările le decide serverul
// (lib/saga-trimitere.mjs); aici doar cererea și un text pentru om.
import { sbBrowser } from "@/lib/supabase";

export type RaspunsSaga = { ok: boolean; stare?: string; nota?: string | null; fisier?: string; eroare?: string; cod?: string };

export async function trimiteInSaga(facturaId: number): Promise<RaspunsSaga> {
  const sb = sbBrowser();
  const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
  try {
    const r = await fetch("/api/saga", { method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
      body: JSON.stringify({ actiune: "trimite", factura_id: facturaId }) });
    return await r.json().catch(() => ({ ok: false, eroare: `Răspuns neașteptat (HTTP ${r.status}).` }));
  } catch (e: any) {
    return { ok: false, eroare: `Legătura cu serverul a căzut: ${e?.message ?? e}` };
  }
}

/** Textul pentru om, după trimitere. `bun` = a ajuns în SAGA. */
export function textTrimitere(doc: string, j: RaspunsSaga): { bun: boolean; text: string } {
  if (!j.ok) return { bun: false, text: `${doc} NU a plecat în SAGA: ${j.eroare ?? "eroare necunoscută"} Rămâne în aplicație; o trimiți din pagina ei cu „Trimite în SAGA”.` };
  if (j.stare === "eroare") return { bun: false, text: `${doc}: SAGA nu a primit-o — ${j.nota} O retrimiți din pagina ei.` };
  if (j.stare === "confirmata") return { bun: true, text: `✓ ${doc} e în SAGA, validată automat.` };
  return { bun: true, text: `✓ ${doc} e în SAGA.${j.nota ? ` ${j.nota}` : " Validarea se face în SAGA (importul automat e oprit în Integrări → Saga)."}` };
}
