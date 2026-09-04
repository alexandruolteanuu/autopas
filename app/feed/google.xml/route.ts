// ============================================================
// /feed/google.xml — feed-ul pentru Google Merchant Center
//
// Adresa asta se lipește o singură dată în Merchant Center (Produse → Feeduri →
// programare), iar Google o citește singur, zilnic. De aici pleacă produsele în
// Google Shopping și în campaniile Performance Max din Google Ads.
//
// `force-dynamic`: ruta NU se generează la build. La build n-ar avea catalogul
// (și oricum ar îngheța prețurile de atunci), iar `revalidate` moștenit din
// `app/layout.tsx` ar fi tăiat cei 5 minute peste cele 3 ore de aici — cel mai
// mic număr din arbore câștigă. Prospețimea o dă antetul `Cache-Control`, scris
// explicit în `raspunsFeed`, unde se și vede.
// ============================================================
import { citesteCatalog, doarPentruReclame } from "@/lib/feed";
import { xmlGoogleBucati } from "@/lib/feed-formate";
import { areVoie, raspunsFeed, refuz } from "@/lib/feed-raspuns";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!areVoie(req)) return refuz();
  const { randuri } = await citesteCatalog();
  return raspunsFeed(xmlGoogleBucati(doarPentruReclame(randuri)), "application/xml", "google-merchant.xml");
}
