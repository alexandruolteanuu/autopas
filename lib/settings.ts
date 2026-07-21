// Setările firmei și ale curierilor — citite din baza de date (tabela settings),
// ca să dispară valorile scrise "de mână" în cod (CUI, prețuri curieri etc.).
import { sbServer, sbBrowser } from "./supabase";

export type Firma = { denumire: string; cui: string; reg_com: string; iban: string; serie_factura: string; telefon: string; email: string };
export type Curier = { id: string; nume: string; detalii: string; pret: number };

export const FIRMA_IMPLICITA: Firma = {
  denumire: "Autopas Dezmembrări SRL", cui: "", reg_com: "", iban: "",
  serie_factura: "AUTP", telefon: "0740 123 456", email: "comenzi@autopas.ro",
};
export const CURIERI_IMPLICITI: Curier[] = [
  { id: "fan", nume: "FAN Courier", detalii: "livrare 24–48h, ramburs inclus", pret: 19.9 },
  { id: "cargus", nume: "Cargus", detalii: "livrare 24–48h", pret: 21.5 },
  { id: "sameday", nume: "Sameday easybox", detalii: "ridici din locker", pret: 14.9 },
];

// pe server (pagini, footer)
export async function getSetariServer() {
  const sb = sbServer();
  if (!sb) return { firma: FIRMA_IMPLICITA, curieri: CURIERI_IMPLICITI };
  const { data } = await sb.from("settings").select("cheie,valoare");
  const m = new Map((data ?? []).map((r: any) => [r.cheie, r.valoare]));
  return {
    firma: { ...FIRMA_IMPLICITA, ...(m.get("firma") ?? {}) } as Firma,
    curieri: ((m.get("curieri") as Curier[]) ?? CURIERI_IMPLICITI),
  };
}
// în browser (checkout, admin)
export async function getSetariBrowser() {
  const sb = sbBrowser();
  if (!sb) return { firma: FIRMA_IMPLICITA, curieri: CURIERI_IMPLICITI };
  const { data } = await sb.from("settings").select("cheie,valoare");
  const m = new Map((data ?? []).map((r: any) => [r.cheie, r.valoare]));
  return {
    firma: { ...FIRMA_IMPLICITA, ...(m.get("firma") ?? {}) } as Firma,
    curieri: ((m.get("curieri") as Curier[]) ?? CURIERI_IMPLICITI),
  };
}
