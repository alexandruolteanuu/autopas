// ============================================================
// SETĂRI — sursa unică de adevăr pentru datele firmei, curieri și integrări.
// Se citesc din baza de date (tabela settings); variabilele din Vercel rămân
// doar ca rezervă, dacă în baza de date nu s-a completat nimic.
// ============================================================
import { sbServer, sbBrowser } from "./supabase";

export type Firma = { denumire: string; cui: string; reg_com: string; adresa: string; iban: string;
  serie_factura: string; telefon: string; email: string; whatsapp: string };
export type Curier = { id: string; nume: string; detalii: string; pret: number };
export type Integrari = {
  fancourier?: { client_id?: string; user?: string; parola?: string; activ?: boolean };
  netopia?: { pos_id?: string; signature?: string; activ?: boolean };
  saga?: { serie?: string; activ?: boolean };
  ga4?: { id?: string; activ?: boolean };
};

// Datele REALE ale firmei — folosite ca rezervă dacă în tabela `settings` nu s-a salvat nimic.
// Sursa oficială rămâne Admin → Setări → Date firmă (se suprascriu automat peste acestea).
export const FIRMA_IMPLICITA: Firma = {
  denumire: "S.C. PIESE AUTO PAS S.R.L.",
  cui: "RO 36608590",
  reg_com: "J27/893/2016",
  adresa: "Str. Petru Rareș nr. 181, com. Alexandru cel Bun, jud. Neamț",
  iban: "",
  serie_factura: "AUTP",
  telefon: "0743 627 151",
  email: "comenzi@autopas.ro",
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_PHONE ?? "40743627151",
};
// FAN Courier este singurul curier al firmei (decizie: 7 august 2026).
export const CURIERI_IMPLICITI: Curier[] = [
  { id: "fan", nume: "FAN Courier", detalii: "livrare 1–3 zile lucrătoare, ramburs inclus", pret: 19.9 },
];

function compune(rows: { cheie: string; valoare: any }[] | null) {
  const m = new Map((rows ?? []).map((r) => [r.cheie, r.valoare]));
  return {
    firma: { ...FIRMA_IMPLICITA, ...(m.get("firma") ?? {}) } as Firma,
    curieri: ((m.get("curieri") as Curier[]) ?? CURIERI_IMPLICITI),
    integrari: ((m.get("integrari") as Integrari) ?? {}),
  };
}

// pe server (layout, footer, pagini)
export async function getSetariServer() {
  const sb = sbServer();
  if (!sb) return compune(null);
  const { data } = await sb.from("settings").select("cheie,valoare");
  return compune(data as any);
}
// în browser (checkout, admin)
export async function getSetariBrowser() {
  const sb = sbBrowser();
  if (!sb) return compune(null);
  const { data } = await sb.from("settings").select("cheie,valoare");
  return compune(data as any);
}
// link WhatsApp construit din numărul salvat în Setări
export const waLinkCu = (numar: string, text = "Bună! Am o întrebare despre o piesă.") =>
  `https://wa.me/${(numar || "").replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
