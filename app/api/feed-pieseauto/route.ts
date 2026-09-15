// Raportul feed-ului pieseauto.ro, pentru Admin → Feed și export: câte piese
// pleacă, câte cu cantitate 0, de unde vine categoria fiecăreia și ce categorii
// n-au putut fi verificate în catalogul lor. Doar echipa: citește și ce e ascuns.
import { NextResponse } from "next/server";
import { esteEchipa } from "@/lib/supabase";
import { citesteCatalogPieseauto } from "@/lib/feed-pieseauto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!(await esteEchipa(req))) return NextResponse.json({ ok: false, eroare: "Doar echipa." }, { status: 401 });
  try {
    const { randuri, raport } = await citesteCatalogPieseauto();
    const exemple = randuri.filter((r) => r.provenienta !== "anunt").slice(0, 10)
      .map((r) => ({ id: r.id, titlu: r.titlu, categorie: r.categorie, provenienta: r.provenienta }));
    return NextResponse.json({ ok: true, raport, exemple });
  } catch (e: any) {
    return NextResponse.json({ ok: false, eroare: e?.message ?? String(e) }, { status: 500 });
  }
}
