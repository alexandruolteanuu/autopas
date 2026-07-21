// ============================================================
// CURIERI — FAN Courier (SelfAWB) și Sameday.
// Credențialele se citesc mai întâi din Setări → Integrări (baza de date),
// iar dacă acolo nu e nimic, din variabilele Vercel.
// ============================================================
import { sbAdmin } from "./supabase";
import type { Integrari } from "./settings";

export type AwbCerere = {
  numar_comanda: string; nume: string; telefon: string; email: string;
  adresa: string; oras: string; judet: string;
  ramburs: number; greutate_kg?: number;
};
export type AwbRaspuns = { ok: boolean; awb?: string; eroare?: string };

async function integrariDinDb(): Promise<Integrari> {
  const sb = sbAdmin(); if (!sb) return {};
  const { data } = await sb.from("settings").select("valoare").eq("cheie", "integrari").single();
  return (data?.valoare as Integrari) ?? {};
}

export async function credentialeFan() {
  const i = await integrariDinDb();
  return {
    clientId: i.fancourier?.client_id || process.env.FANCOURIER_CLIENT_ID || "",
    user: i.fancourier?.user || process.env.FANCOURIER_USER || "",
    parola: i.fancourier?.parola || process.env.FANCOURIER_PASS || "",
  };
}
export async function credentialeSameday() {
  const i = await integrariDinDb();
  return {
    user: i.sameday?.user || process.env.SAMEDAY_USER || "",
    parola: i.sameday?.parola || process.env.SAMEDAY_PASS || "",
  };
}

export async function genereazaAwbFan(c: AwbCerere): Promise<AwbRaspuns> {
  const cred = await credentialeFan();
  if (!cred.clientId || !cred.user || !cred.parola)
    return { ok: false, eroare: "FAN Courier neconfigurat. Completează Client ID, utilizator și parolă în Admin → Integrări (sau în variabilele Vercel), după semnarea contractului FAN." };
  // La activare: 1) POST https://api.fancourier.ro/login → token
  //              2) POST https://api.fancourier.ro/intern-awb cu datele din `c` → { awbNumber }
  return { ok: false, eroare: "Credențiale găsite, dar apelul către FAN nu e încă activat. Anunță-ne și îl pornim (10 minute)." };
}

export async function genereazaAwbSameday(c: AwbCerere): Promise<AwbRaspuns> {
  const cred = await credentialeSameday();
  if (!cred.user || !cred.parola)
    return { ok: false, eroare: "Sameday neconfigurat. Completează utilizatorul și parola în Admin → Integrări (sau în variabilele Vercel), după semnarea contractului Sameday." };
  return { ok: false, eroare: "Credențiale găsite, dar apelul către Sameday nu e încă activat. Anunță-ne și îl pornim." };
}
