// ============================================================
// /feed/pieseauto.csv — fișierul din care pieseauto.ro importă zilnic
//
// Adresa asta se trimite la pieseauto.ro; ei o alocă pe contul nostru și setează
// importul automat zilnic. Tot conținutul și toate regulile stau în
// `lib/feed-pieseauto.ts` — aici e doar livrarea.
//
// `?test=5` întoarce doar primele 5 piese cu stoc și poze: pentru un prim import
// de probă la ei, înainte de a le da adresa întreagă.
// ============================================================
import { citesteCatalogPieseauto, randCsv } from "@/lib/feed-pieseauto";
import { areVoie, raspunsFeed, refuz } from "@/lib/feed-raspuns";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!areVoie(req)) return refuz();
  const { randuri } = await citesteCatalogPieseauto();
  const test = Number(new URL(req.url).searchParams.get("test"));
  const lista = test > 0
    ? randuri.filter((r) => r.cantitate > 0 && r.poze.length).slice(0, Math.min(test, 50))
    : randuri;
  return raspunsFeed(lista.map(randCsv), "text/csv", test > 0 ? "pieseauto-test.csv" : "pieseauto.csv");
}
