// ============================================================
// /feed/produse.csv — feed-ul generic, pentru orice altă platformă
//
// Nu presupune nimic despre cine îl citește: toate coloanele, cu nume
// românești, în ordinea în care le-ar căuta un om. Se folosește pentru
// marketplace-uri care își mapează singure câmpurile, pentru un partener care
// vrea catalogul, sau pur și simplu ca să vezi în Excel ce pleacă din site.
//
// DIFERENȚA față de exportul din Admin → Feed & Export: acolo poți cere și
// coloanele interne (cost de achiziție, marjă, vizualizări), fiindcă citirea
// trece prin sesiunea ta. AICI NU AJUNG NICIODATĂ — adresa e publică.
//
// Nu are filtrul de reclame: intră și piesele fără poză, ca să se vadă ce
// lipsește. Google și Meta le-ar respinge oricum, deci feed-urile lor le sar.
// ============================================================
import { citesteCatalog } from "@/lib/feed";
import { csvGenericBucati } from "@/lib/feed-formate";
import { areVoie, raspunsFeed, refuz } from "@/lib/feed-raspuns";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!areVoie(req)) return refuz();
  const { randuri } = await citesteCatalog();
  return raspunsFeed(csvGenericBucati(randuri), "text/csv", "autopas-produse.csv");
}
