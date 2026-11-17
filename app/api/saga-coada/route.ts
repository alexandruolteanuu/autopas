// ============================================================
// RELUAREA FACTURILOR DIN FUNDAL — /api/saga-coada (pasul 13, migrarea 60)
//
// O cheamă ceasul din bază (`saga_ceas`, pg_cron, o dată pe minut) DOAR când o factură
// e în „se_trimite”, liberă și cu reîncercarea scadentă (după un timeout, un 429 sau
// lacătul SAGA ocupat, ori când cererea butonului și-a terminat bugetul). Se legitimează
// cu secretul din `saga_trezire` (generat de migrare, nu iese din bază).
//
// Nicio regulă aici: fiecare factură trece prin același motor ca butonul
// (lib/saga-emitere.mjs), pe rând, cât încape în buget.
// ============================================================
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { clientSaga, depozitEmitere, facturiScadente, secretCeas } from "@/lib/saga";
import { lucreazaFactura, TIMEOUT_IMPORT_MS, BUGET_MS } from "@/lib/saga-emitere.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const acelasiSecret = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && x.length >= 32 && timingSafeEqual(x, y);
};

export async function POST(req: Request) {
  const start = Date.now();
  try {
    const secret = await secretCeas();
    if (!secret || !acelasiSecret(req.headers.get("x-autopas-saga") ?? "", secret))
      return NextResponse.json({ ok: false, eroare: "Neautorizat." }, { status: 401 });

    const ids = await facturiScadente();
    if (!ids.length) return NextResponse.json({ ok: true, facute: 0 });
    const { client, setariSaga } = await clientSaga({ timeoutMs: TIMEOUT_IMPORT_MS });
    const depozit = depozitEmitere();
    const rezultate = [];
    for (const id of ids) {
      if (Date.now() + TIMEOUT_IMPORT_MS + 2_000 > start + BUGET_MS) break;
      rezultate.push(await lucreazaFactura({ id, client, depozit, setariSaga, pana: start + BUGET_MS }));
    }
    return NextResponse.json({ ok: true, facute: rezultate.length, rezultate: rezultate.map((r) => ({ id: r.id, stare: r.stare })) });
  } catch (e) {
    return NextResponse.json({ ok: false, eroare: (e as Error)?.message ?? String(e) }, { status: 500 });
  }
}
