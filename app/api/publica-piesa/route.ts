// ============================================================
// ADUCEREA POZELOR UNEI PIESE IMPORTATE (și publicarea ei)
//
// De la 25 august 2026 pozele se descarcă în timpul importului, nu aici — vezi
// app/api/import/route.ts. Ruta asta a rămas pentru cazul în care descărcarea a
// eșuat atunci: butonul „Reia pozele eșuate" din Admin → Piese de completat o
// cheamă pentru piesele care au `poze_sursa`, dar `poze` gol.
//
// Supabase e pe plan Pro, deci limita de 1 GB nu mai e o constrângere și toate
// pozele se aduc la import. Motivul vechi al amânării a dispărut odată cu ea.
//
// Rulează pe server pentru că browserul nu poate descărca de pe pieseauto.ro
// (CORS) și pentru că scrierea în `products` cere drepturi de echipă.
//
// Se cere token-ul sesiunii și se verifică cu `esteEchipa()`, ca la /api/awb:
// rutele din `app/api/` nu sunt protejate de RLS, rulează cu drepturi de server.
// ============================================================
import { NextResponse } from "next/server";
import { esteEchipa, sbAdmin } from "@/lib/supabase";
import { converteste, extensiaPentru } from "@/lib/imagini";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Câte piese acceptăm într-o singură cerere. Publicarea în masă din ecranul
 *  „Piese de completat" trimite loturi de mărimea asta, ca nicio cerere să nu
 *  depășească limita de timp a funcției. */
const MAX_PE_CERERE = 10;

export async function POST(req: Request) {
  if (!(await esteEchipa(req)))
    return NextResponse.json({ ok: false, eroare: "Doar echipa poate publica piese." }, { status: 401 });

  const sb = sbAdmin();
  if (!sb) return NextResponse.json({ ok: false, eroare: "Baza de date nu e configurată." }, { status: 500 });

  const { ids } = (await req.json().catch(() => ({}))) as { ids?: number[] };
  if (!Array.isArray(ids) || ids.length === 0)
    return NextResponse.json({ ok: false, eroare: "Trimite `ids`, o listă de identificatori de piese." }, { status: 400 });
  if (ids.length > MAX_PE_CERERE)
    return NextResponse.json({ ok: false, eroare: `Maximum ${MAX_PE_CERERE} piese pe cerere.` }, { status: 400 });

  const { data: piese, error } = await sb
    .from("products")
    .select("id, nume, poze, poze_sursa, poze_descarcate, categorie_id, publicat")
    .in("id", ids);
  if (error) return NextResponse.json({ ok: false, eroare: error.message }, { status: 500 });

  const rezultate: { id: number; ok: boolean; poze?: number; eroare?: string }[] = [];

  for (const p of piese ?? []) {
    // Nimic nu mai blochează publicarea: nici categoria lipsă, nici greutatea
    // estimată, nici pozele (regula A.0). O piesă fără categorie e o piesă de
    // completat, nu una de ascuns — apare oricum în ecranul de lucru.
    const areDejaPoze = (p.poze ?? []).length > 0;
    const surse = (p.poze_sursa ?? []) as string[];
    if (!areDejaPoze && surse.length === 0) {
      rezultate.push({ id: p.id, ok: false, eroare: "fără poze" });
      continue;
    }

    let poze = p.poze ?? [];
    if (!areDejaPoze) {
      const aduse: string[] = [];
      // `surse.forEach`-style index fără iterator: `tsconfig` țintește ES5, unde
      // `entries()` cere `downlevelIteration`.
      for (let i = 0; i < surse.length; i++) {
        const url = surse[i];
        try {
          const r = await fetch(url, {
            headers: { "User-Agent": "AutopasImport/1.0 (+https://autopas-dezmembrari.ro)" },
          });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const brut = Buffer.from(await r.arrayBuffer());
          const { date, tip } = await converteste(brut);

          const cale = `${new Date().getFullYear()}/import-${p.id}-${i}-${Date.now().toString(36)}.${extensiaPentru(tip)}`;
          const { error: eUp } = await sb.storage
            .from("poze-piese")
            .upload(cale, date, { contentType: tip, cacheControl: "31536000", upsert: false });
          if (eUp) throw new Error(eUp.message);
          aduse.push(sb.storage.from("poze-piese").getPublicUrl(cale).data.publicUrl);
        } catch (e) {
          // O poză care nu vine nu oprește publicarea, dacă au venit altele.
          console.error(`poza ${url} pentru piesa ${p.id}:`, e);
        }
      }
      if (aduse.length === 0) {
        rezultate.push({ id: p.id, ok: false, eroare: "nicio poză n-a putut fi adusă" });
        continue;
      }
      poze = aduse;
    }

    const { error: eSalv } = await sb
      .from("products")
      .update({ poze, poze_descarcate: true, publicat: true })
      .eq("id", p.id);
    if (eSalv) { rezultate.push({ id: p.id, ok: false, eroare: eSalv.message }); continue; }
    rezultate.push({ id: p.id, ok: true, poze: poze.length });
  }

  return NextResponse.json({
    ok: true,
    publicate: rezultate.filter((r) => r.ok).length,
    esuate: rezultate.filter((r) => !r.ok),
  });
}
