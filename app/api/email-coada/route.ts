// ============================================================
// GOLIREA COZII DE E-MAILURI — /api/email-coada
//
// Cine o cheamă:
//   1. baza de date, prin triggerul din supabase/email-automat.sql, imediat ce
//      intră o comandă sau o cerere. Se legitimează cu secretul din
//      `settings.integrari.email.webhook_secret`;
//   2. un om din echipă, din Admin → Integrări, ca să retrimită ce a rămas
//      blocat sau ca să trimită un mesaj de test. Se legitimează cu token-ul
//      sesiunii, ca ruta de AWB.
//
// Ruta rulează cu cheia de service, deci trece peste RLS. De aceea NU are voie
// să fie deschisă: coada conține adresele de e-mail ale clienților.
//
// Nu întoarce niciodată 500 pentru un e-mail care n-a plecat. Un eșec de
// trimitere se scrie în rândul din coadă (`eroare`, `incercari`) și se trece la
// următorul; cine cheamă ruta primește un raport, nu o excepție. Baza de date
// n-are ce face cu un 500, iar un rând rămas neîncercat e mai rău decât unul
// încercat de trei ori.
// ============================================================
import { NextResponse } from "next/server";
import { sbAdmin, esteEchipa } from "@/lib/supabase";
import { construieste, trimite, mesajDeTest, type ConfigEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Câte rânduri se iau într-o trecere. Peste asta, trezirea următoare le ia pe
 *  restul: mai bine două treceri scurte decât o funcție tăiată la 60s cu
 *  jumătate din coadă netrimisă și fără nimic scris în bază. */
const PE_TRECERE = 20;
/** După atâtea eșecuri, rândul se lasă în pace. O adresă greșită nu se repară
 *  singură, iar reîncercarea la infinit ar arde cota furnizorului. Rândul rămâne
 *  vizibil în coadă, cu eroarea scrisă, ca să se vadă de ce. */
const MAX_INCERCARI = 5;

async function iaConfig(): Promise<ConfigEmail | null> {
  const sb = sbAdmin();
  if (!sb) return null;
  const { data } = await sb.from("settings").select("valoare").eq("cheie", "integrari").maybeSingle();
  return ((data?.valoare as any)?.email ?? {}) as ConfigEmail;
}

export async function POST(req: Request) {
  const sb = sbAdmin();
  if (!sb) return NextResponse.json({ ok: false, eroare: "Baza de date nu e configurată pe server." }, { status: 500 });

  const cfg = await iaConfig();
  if (!cfg) return NextResponse.json({ ok: false, eroare: "Nu s-au putut citi setările." }, { status: 500 });

  // ---- cine cere ----
  const secret = req.headers.get("x-autopas-email") ?? "";
  const dinBaza = !!cfg.webhook_secret && secret === cfg.webhook_secret;
  const dinPanou = dinBaza ? false : await esteEchipa(req);
  if (!dinBaza && !dinPanou) {
    return NextResponse.json({ ok: false, eroare: "Neautorizat." }, { status: 401 });
  }

  let body: { test?: string } = {};
  try { body = await req.json(); } catch { /* corp gol = golire simplă */ }

  // ---- mesajul de test, cerut din panou ----
  if (body.test) {
    if (!dinPanou) return NextResponse.json({ ok: false, eroare: "Testul se cere din panou." }, { status: 403 });
    const r = await trimite(await mesajDeTest(body.test), cfg);
    return NextResponse.json(r);
  }

  // Integrarea oprită din panou: coada rămâne pe loc, nu se pierde nimic.
  // Rândurile pleacă la prima trezire de după repornire.
  if (cfg.activ === false || !cfg.cheie) {
    return NextResponse.json({ ok: true, trimise: 0, nota: "Integrarea de e-mail e oprită sau fără cheie; coada rămâne neatinsă." });
  }

  const { data: randuri, error } = await sb
    .from("email_coada")
    .select("id,tip,referinta_id,incercari")
    .is("trimis_la", null)
    .lt("incercari", MAX_INCERCARI)
    .order("id")
    .limit(PE_TRECERE);
  if (error) return NextResponse.json({ ok: false, eroare: error.message }, { status: 500 });

  let trimise = 0, sarite = 0, esuate = 0;
  for (const r of (randuri ?? []) as { id: number; tip: string; referinta_id: number; incercari: number }[]) {
    let mesaj = null;
    let eroare: string | undefined;
    try {
      mesaj = await construieste(r.tip, r.referinta_id, cfg);
    } catch (e: any) {
      eroare = `Nu s-a putut compune mesajul: ${e?.message ?? e}`;
    }

    // Nimic de trimis (rândul n-are adresă de e-mail, sau a fost șters între
    // timp). Se închide ca rezolvat, nu ca eroare: altfel ar fi reîncercat de
    // cinci ori degeaba și ar rămâne pe veci în coadă, arătând a defect.
    if (!eroare && !mesaj) {
      await sb.from("email_coada").update({ trimis_la: new Date().toISOString(), eroare: "fără adresă de e-mail" }).eq("id", r.id);
      sarite++;
      continue;
    }

    if (!eroare && mesaj) {
      const rez = await trimite(mesaj, cfg);
      if (rez.ok) {
        await sb.from("email_coada").update({
          trimis_la: new Date().toISOString(), catre: mesaj.catre, eroare: null,
          incercari: r.incercari + 1,
        }).eq("id", r.id);
        trimise++;
        continue;
      }
      eroare = rez.eroare;
    }

    await sb.from("email_coada").update({ incercari: r.incercari + 1, eroare: eroare ?? "eroare necunoscută" }).eq("id", r.id);
    esuate++;
  }

  return NextResponse.json({ ok: true, trimise, sarite, esuate, in_lot: (randuri ?? []).length });
}
