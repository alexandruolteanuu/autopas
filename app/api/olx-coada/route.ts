// ============================================================
// SINCRONIZAREA AUTOMATĂ CU OLX — /api/olx-coada (pasul 3 din docs/olx-plan.md, migrarea 58)
//
// Cine o cheamă:
//   1. baza de date, prin triggerele din supabase/olx-coada.sql, imediat ce o piesă e
//      adăugată, modificată, vândută, ascunsă sau ștearsă. Se legitimează cu secretul
//      din `olx_trezire.webhook_secret` (generat de migrare, nu iese din bază);
//   2. ea însăși, cât timp mai are de lucru (înlănțuirea, ca la dez.ro);
//   3. adminul, din Admin → Anunțuri OLX („Trimite acum ce e în coadă”), cu sesiunea lui.
//
// Nicio regulă despre OLX aici: ce se face cu fiecare piesă stă în lib/olx-coada.mjs.
// Aici: cine are voie, plasa de 20%, lacătul, un lot, mesajul pentru panou, înlănțuirea.
//
// ORDINEA DE LA FINAL (ca la dez.ro): eliberează lacătul → deblochează trezirea → ABIA
// APOI recitește coada și se cheamă singură dacă a mai rămas ceva. Așa, orice trigger de
// după deblocare bate singur la ușă, iar orice trigger dinainte și-a lăsat rândul în coadă.
// ============================================================
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { esteAdmin } from "@/lib/supabase";
import { clientOlx, contextAnunt, depozitCoada } from "@/lib/olx";
import { lotCoada, prag, PE_LOT, MAX_INCERCARI, TIMEOUT_COADA_MS, PRAG_RETRAGERE } from "@/lib/olx-coada.mjs";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Cât ține confirmarea pragului de 20% dată din panou. */
const CONFIRMARE_PRAG_MS = 2 * 3600_000;

const ok = (date: Record<string, unknown>) => NextResponse.json({ ok: true, ...date });
const acelasiSecret = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && x.length >= 32 && timingSafeEqual(x, y);
};

export async function POST(req: Request) {
  let depozit: ReturnType<typeof depozitCoada>;
  let trez: Awaited<ReturnType<ReturnType<typeof depozitCoada>["trezirea"]>>;
  try { depozit = depozitCoada(); trez = await depozit.trezirea(); }
  catch (e) {
    return NextResponse.json({ ok: false, eroare: `Sincronizarea OLX nu poate porni (migrarea 58 e rulată?): ${(e as Error)?.message ?? e}` }, { status: 500 });
  }
  if (!trez) return NextResponse.json({ ok: false, eroare: "Lipsește rândul olx_trezire (migrarea 58)." }, { status: 500 });

  // ---- cine cere ----
  const dinBaza = acelasiSecret(req.headers.get("x-autopas-olx") ?? "", trez.webhook_secret ?? "");
  const de = dinBaza ? null : await esteAdmin(req);
  if (!dinBaza && !de) return NextResponse.json({ ok: false, eroare: "Neautorizat." }, { status: 401 });
  const corp = (await req.json().catch(() => ({}))) as { confirmatPrag?: boolean };

  // ---- oprită: coada rămâne pe loc, nu se pierde nimic ----
  if (!trez.activ) return ok({ facute: 0, nota: "Sincronizarea automată OLX e oprită; coada rămâne neatinsă." });

  // ---- plasa de 20% ----
  if (!dinBaza && corp.confirmatPrag) {
    await depozit.scrieTrezirea({ prag_confirmat_la: new Date().toISOString(), mesaj: null, mesaj_la: null });
  }
  const stare0 = await depozit.coadaStare();
  const p = prag({ vii: Number(stare0?.anunturi_vii) || 0, deRetras: Number(stare0?.de_retras) || 0 });
  const confirmat = !!trez.prag_confirmat_la && Date.now() - Date.parse(trez.prag_confirmat_la) < CONFIRMARE_PRAG_MS
    || (!dinBaza && !!corp.confirmatPrag);
  if (p.depasit && !confirmat) {
    const mesaj = `S-ar retrage ${p.deRetras} din ${p.vii} anunțuri OLX (${(p.procent * 100).toFixed(1)}%, peste pragul de ` +
      `${PRAG_RETRAGERE * 100}%). Pare o ascundere în masă, nu vânzări. Sincronizarea s-a oprit — confirmă din Admin → Anunțuri OLX dacă e corect.`;
    await depozit.scrieTrezirea({ mesaj, mesaj_la: new Date().toISOString() }).catch(() => null);
    return ok({ facute: 0, cereConfirmare: true, prag: p, nota: mesaj });
  }

  // ---- lacătul: un singur lot o dată ----
  if (!(await depozit.iaLotul(70))) return ok({ facute: 0, nota: "Alt lot lucrează chiar acum; coada se golește singură." });

  let rez: Awaited<ReturnType<typeof lotCoada>> | null = null;
  try {
    const randuri = await depozit.coadaCiteste(PE_LOT, MAX_INCERCARI);
    if (randuri.length) {
      const [ctx, client] = [await contextAnunt(), clientOlx({ timeoutMs: TIMEOUT_COADA_MS })];
      rez = await lotCoada({ randuri, ctx, client, depozit });
      if (rez.oprit) {
        await depozit.scrieTrezirea({ mesaj: `Sincronizarea s-a oprit: ${rez.oprit}`, mesaj_la: new Date().toISOString() }).catch(() => null);
      } else if (trez.mesaj && rez.facute > 0) {
        await depozit.scrieTrezirea({ mesaj: null, mesaj_la: null }).catch(() => null);
      }
    }
  } catch (e) {
    const mesaj = `Sincronizarea s-a oprit: ${(e as Error)?.message ?? e}`.slice(0, 500);
    await depozit.scrieTrezirea({ mesaj, mesaj_la: new Date().toISOString() }).catch(() => null);
    await depozit.elibereazaLotul().catch(() => null);
    await depozit.deblocheaza().catch(() => null);
    return NextResponse.json({ ok: false, eroare: mesaj });
  } finally {
    await depozit.elibereazaLotul().catch(() => null);
  }

  // ---- deblocare, apoi înlănțuire (în ordinea asta) ----
  await depozit.deblocheaza().catch(() => null);
  const stare = await depozit.coadaStare().catch(() => null);
  const ramase = Number(stare?.de_facut) || 0;
  // Mai departe DOAR dacă lotul a închis rânduri: un lot fără niciun progres s-ar relua la nesfârșit.
  const continua = !!rez && ramase > 0 && !rez.oprit && rez.facute > 0;
  if (continua) await depozit.trezesteAcum().catch(() => null);

  return ok({
    facute: rez?.facute ?? 0, publicate: rez?.publicate ?? 0, actualizate: rez?.actualizate ?? 0,
    reactivate: rez?.reactivate ?? 0, retrase: rez?.retrase ?? 0, nimic: rez?.nimic ?? 0,
    erori: rez?.erori ?? [], oprit: rez?.oprit ?? null, ramase, continua,
    nota: rez ? undefined : "Coada e goală.",
  });
}
