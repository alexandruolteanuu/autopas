// ============================================================
// RUTA SAGA (pasul 7 din docs/saga-plan.md, 11 noiembrie 2026)
//
// Acțiuni (POST, JSON `{ actiune }`):
//   · `stare`               — starea cheii + ultimele apeluri (admin, contabil);
//   · `salveaza-cheie`      — cheia REALĂ, scrisă de om în Integrări (doar admin);
//   · `testeaza-conexiunea` — un singur `GetArticol`, DOAR citire (admin, contabil);
//   · `trimite`             — o factură → SAGA (pasul 8; admin, contabil). Toată logica
//                              e în lib/saga-trimitere.mjs; aici doar rolul și răspunsul;
//   · `confirma`            — „Marchează confirmată”, după validarea în SAGA (admin, contabil).
//
// Cheia SAGA intră aici o singură dată, la salvare, și nu iese niciodată: niciun
// răspuns nu o conține, iar folosirea și rotirea ei stau doar în lib/saga-api.mjs.
// Rutele din app/api nu sunt protejate de RLS — de aceea fiecare acțiune cere
// token-ul sesiunii și verifică rolul în bază.
// ============================================================
import { NextResponse } from "next/server";
import { esteAdmin, esteFacturare } from "@/lib/supabase";
import { clientSaga, stareSaga, depozitFacturi, confirmaFactura, EroareSaga } from "@/lib/saga";
import { trimiteFactura } from "@/lib/saga-trimitere.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const nuAi = (ce: string) => NextResponse.json({ ok: false, eroare: `Nu ai dreptul ${ce}. Autentifică-te din nou în panou.` }, { status: 401 });
const eroare = (e: unknown) => NextResponse.json({
  ok: false,
  cod: e instanceof EroareSaga ? (e as EroareSaga & { cod: string }).cod : "eroare",
  eroare: e instanceof EroareSaga ? e.message : `Eroare la legătura cu SAGA: ${(e as Error)?.message ?? e}`,
});

export async function POST(req: Request) {
  const corp = await req.json().catch(() => ({} as Record<string, unknown>));
  const actiune = String(corp.actiune ?? "");

  try {
    if (actiune === "stare") {
      if (!(await esteFacturare(req))) return nuAi("să vezi legătura cu SAGA");
      const { adresa, cif } = await clientSaga();
      return NextResponse.json({ ok: true, ...(await stareSaga()), adresa, cif });
    }

    if (actiune === "salveaza-cheie") {
      const de = await esteAdmin(req);
      if (!de) return nuAi("să salvezi cheia SAGA (doar administratorul)");
      const { client } = await clientSaga();
      await client.salveazaCheia(String(corp.cheie ?? ""), de);
      return NextResponse.json({ ok: true, mesaj: "✓ Cheia SAGA a fost salvată. Apasă „Testează conexiunea”.", ...(await stareSaga()) });
    }

    if (actiune === "testeaza-conexiunea") {
      const de = await esteFacturare(req);
      if (!de) return nuAi("să testezi legătura cu SAGA");
      const { client, articolImplicit } = await clientSaga();
      const r = await client.testeazaConexiunea({ cod: articolImplicit, de });
      const mesaj = r.exista
        ? `✓ Conectat la SAGA. Articolul „${r.cod}” există: ${r.articol?.denumire ?? "?"} (${r.articol?.um ?? "?"}, TVA ${r.articol?.tva ?? "?"}%).`
        : articolImplicit
          ? `⚠ Conectat la SAGA (cheia e acceptată), dar articolul implicit „${r.cod}” NU există în gestiune: ${r.mesaj}. Verifică codul cu contabila.`
          : `✓ Conectat la SAGA (cheia e acceptată). Proba s-a făcut cu un cod inexistent, fiindcă articolul implicit nu e setat — SAGA a răspuns: ${r.mesaj}.`;
      return NextResponse.json({ ok: true, avertisment: !r.exista && !!articolImplicit, mesaj, rotita: r.rotita, ...(await stareSaga()) });
    }

    if (actiune === "trimite") {
      const de = await esteFacturare(req);
      if (!de) return nuAi("să trimiți facturi în SAGA");
      const id = Number(corp.factura_id);
      if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, eroare: "Factura lipsește din cerere." }, { status: 400 });
      const { client, setariSaga } = await clientSaga();
      const r = await trimiteFactura({ id, client, depozit: depozitFacturi(), setariSaga, de });
      return NextResponse.json({ ok: true, ...r });
    }

    if (actiune === "confirma") {
      const de = await esteFacturare(req);
      if (!de) return nuAi("să confirmi facturi");
      const id = Number(corp.factura_id);
      if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, eroare: "Factura lipsește din cerere." }, { status: 400 });
      const f = await confirmaFactura(id, de);
      return NextResponse.json({ ok: true, mesaj: `✓ Factura ${f.serie} ${f.numar} e marcată confirmată în SAGA.` });
    }

    return NextResponse.json({ ok: false, eroare: `Acțiune necunoscută: „${actiune}”.` }, { status: 400 });
  } catch (e) {
    return eroare(e);
  }
}
