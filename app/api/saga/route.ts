// ============================================================
// RUTA SAGA (pasul 7 din docs/saga-plan.md, 11 noiembrie 2026)
//
// Acțiuni (POST, JSON `{ actiune }`):
//   · `stare`               — starea cheii + ultimele apeluri (admin, contabil);
//   · `salveaza-cheie`      — cheia REALĂ, scrisă de om în Integrări (doar admin);
//   · `testeaza-conexiunea` — un singur `GetArticol`, DOAR citire (admin, contabil);
//   · `emite`               — „Emite factura” (pasul 13, migrarea 60; admin, contabil):
//                              `order_id` → factură nouă (sau reluarea celei active),
//                              `factura_id` → reluarea unei facturi / a unui storno. Validarea
//                              și numărul în bază, apoi motorul din lib/saga-emitere.mjs, în
//                              buget de 40 s; ce nu încape îl termină ceasul (/api/saga-coada);
//   · `confirma`            — „Marchează confirmată”, după verificarea în SAGA (admin, contabil);
//   · `verifica-articol`    — un `GetArticol` pe codul dat, comparat cu denumirea / UM de la
//                              noi (pasul 9; admin, contabil). DOAR citire.
//
// Cheia SAGA intră aici o singură dată, la salvare, și nu iese niciodată: niciun
// răspuns nu o conține, iar folosirea și rotirea ei stau doar în lib/saga-api.mjs.
// Rutele din app/api nu sunt protejate de RLS — de aceea fiecare acțiune cere
// token-ul sesiunii și verifică rolul în bază.
// ============================================================
import { NextResponse } from "next/server";
import { esteAdmin, esteFacturare, sbCuToken } from "@/lib/supabase";
import { clientSaga, stareSaga, depozitEmitere, confirmaFactura, EroareSaga } from "@/lib/saga";
import { optiuniDinSetari } from "@/lib/saga-trimitere.mjs";
import { lucreazaFactura, TIMEOUT_IMPORT_MS, BUGET_MS, MESAJ_LEGATURA } from "@/lib/saga-emitere.mjs";
import { comparaArticol } from "@/lib/saga-api.mjs";

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
        ? `✓ Conectat la SAGA. Articolul pentru piese („${r.cod}”) există: ${r.articol?.denumire ?? "?"} (${r.articol?.um ?? "?"}).`
        : articolImplicit
          ? `⚠ Conectat la SAGA (cheia e acceptată), dar articolul implicit „${r.cod}” NU există în gestiune: ${r.mesaj}. Verifică codul în Integrări → Saga.`
          : `✓ Conectat la SAGA. (Articolul pentru piese nu e setat încă în Integrări → Saga.)`;
      return NextResponse.json({ ok: true, avertisment: !r.exista && !!articolImplicit, mesaj, rotita: r.rotita, ...(await stareSaga()) });
    }

    if (actiune === "emite") {
      const start = Date.now();
      const de = await esteFacturare(req);
      if (!de) return nuAi("să emiți facturi");
      const orderId = Number(corp.order_id), facturaId = Number(corp.factura_id);
      const peFactura = Number.isInteger(facturaId) && facturaId > 0;
      if (!peFactura && !(Number.isInteger(orderId) && orderId > 0))
        return NextResponse.json({ ok: false, eroare: "Comanda lipsește din cerere." }, { status: 400 });

      // Ce ar opri trimiterea se verifică ÎNAINTE de număr: o lipsă nu consumă nimic.
      const { client, setariSaga } = await clientSaga({ timeoutMs: TIMEOUT_IMPORT_MS });
      try { optiuniDinSetari(setariSaga); } catch (e) { return eroare(e); }
      const { cheie } = await stareSaga();
      if (!cheie.setata || cheie.blocata_la) return NextResponse.json({ ok: false, eroare: MESAJ_LEGATURA });

      const sb = sbCuToken(req);
      if (!sb) return nuAi("să emiți facturi");
      const { data, error } = peFactura
        ? await sb.rpc("facturi_porneste", { p_id: facturaId })
        : await sb.rpc("emite_factura_start", { p_order_id: orderId });
      if (error) return NextResponse.json({ ok: false, eroare: error.message });
      const p = data as { id: number; serie: string; numar: number; stare: string; token?: string };
      if (p.stare !== "se_trimite" || !p.token) return NextResponse.json({ ok: true, stare: p.stare, id: p.id, serie: p.serie, numar: p.numar });

      const r = await lucreazaFactura({ id: p.id, token: p.token, client, depozit: depozitEmitere(), setariSaga, de,
        pana: start + BUGET_MS });
      return NextResponse.json({ ok: true, ...r });
    }

    if (actiune === "verifica-articol") {
      const de = await esteFacturare(req);
      if (!de) return nuAi("să verifici articole în SAGA");
      const cod = String(corp.cod ?? "").trim();
      if (!cod) return NextResponse.json({ ok: false, eroare: "Codul articolului lipsește." }, { status: 400 });
      const { client } = await clientSaga();
      const r = await client.getArticol(cod, { de });
      if (!r.exista) return NextResponse.json({ ok: true, cod, exista: false, mesaj: r.mesaj, rotita: r.rotita });
      const cmp = comparaArticol({ denumire: String(corp.denumire ?? ""), um: String(corp.um ?? "") }, r.articol);
      return NextResponse.json({ ok: true, cod, exista: true, articol: r.articol, ...cmp, rotita: r.rotita });
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
