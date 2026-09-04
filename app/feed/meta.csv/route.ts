// ============================================================
// /feed/meta.csv — catalogul pentru Facebook și Instagram (Meta Commerce)
//
// Se adaugă în Meta Business Suite → Commerce Manager → Catalog → Surse de date
// → Feed programat, cu reîmprospătare la câteva ore. Din catalogul ăsta se fac
// reclamele dinamice („Advantage+ catalog"), care arată exact piesa pe care
// omul a văzut-o pe site — dar numai dacă id-urile din feed sunt aceleași cu
// cele trimise de pixel. Sunt: și unul, și celălalt folosesc `cod_intern`.
//
// Aceleași rânduri ca la Google, alt format. Vezi `lib/feed-formate.ts`.
// ============================================================
import { citesteCatalog, doarPentruReclame } from "@/lib/feed";
import { csvMetaBucati } from "@/lib/feed-formate";
import { areVoie, raspunsFeed, refuz } from "@/lib/feed-raspuns";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!areVoie(req)) return refuz();
  const { randuri } = await citesteCatalog();
  return raspunsFeed(csvMetaBucati(doarPentruReclame(randuri)), "text/csv", "meta-catalog.csv");
}
