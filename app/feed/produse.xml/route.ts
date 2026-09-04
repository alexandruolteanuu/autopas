// ============================================================
// /feed/produse.xml — același conținut ca `produse.csv`, în XML
//
// Există fiindcă o parte dintre platformele românești (și aproape toate
// importatoarele mai vechi) cer XML și își mapează singure etichetele. Numele
// etichetelor sunt exact numele coloanelor din CSV, deci cele două nu pot
// diverge: vin din aceeași listă, `CAPURI_GENERIC`.
// ============================================================
import { citesteCatalog } from "@/lib/feed";
import { xmlGenericBucati } from "@/lib/feed-formate";
import { areVoie, raspunsFeed, refuz } from "@/lib/feed-raspuns";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!areVoie(req)) return refuz();
  const { randuri } = await citesteCatalog();
  return raspunsFeed(xmlGenericBucati(randuri), "application/xml", "autopas-produse.xml");
}
