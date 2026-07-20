// ============================================================
// CURIERI — FAN Courier (SelfAWB) și Sameday. SCHELETUL COMPLET:
// funcțiile, formatul datelor și pașii sunt gata; se activează
// în momentul în care clientul primește conturile de API.
// ============================================================
import { CONFIG } from "./config";

export type AwbCerere = {
  numar_comanda: string; nume: string; telefon: string; email: string;
  adresa: string; oras: string; judet: string;
  ramburs: number;           // 0 dacă plata e prin transfer
  greutate_kg?: number;      // implicit 5
};
export type AwbRaspuns = { ok: boolean; awb?: string; eroare?: string };

export function fanCourierConfigurat() {
  const f = CONFIG.fancourier; return Boolean(f.clientId && f.user && f.parola);
}
export function samedayConfigurat() {
  const s = CONFIG.sameday; return Boolean(s.user && s.parola);
}

// FAN Courier — API SelfAWB (https://www.selfawb.ro → cont + documentația "Import AWB")
// Pași la activare: 1) clientul semnează contract FAN → primește clientId/user/parolă
// 2) pune valorile în Vercel → Environment Variables  3) decomentează implementarea de mai jos.
export async function genereazaAwbFan(c: AwbCerere): Promise<AwbRaspuns> {
  if (!fanCourierConfigurat())
    return { ok: false, eroare: "FAN Courier neconfigurat: adaugă FANCOURIER_CLIENT_ID, FANCOURIER_USER, FANCOURIER_PASS în Vercel → Settings → Environment Variables (după semnarea contractului FAN)." };
  // TODO la activare (documentat pas cu pas în README):
  // 1. POST https://api.fancourier.ro/login  { username, password } -> token
  // 2. POST https://api.fancourier.ro/intern-awb  cu datele din `c` -> { awbNumber }
  return { ok: false, eroare: "Implementarea se deblochează la primirea contului FAN (vezi README → Integrări)." };
}

// Sameday — API eAWB (https://api.sameday.ro → documentația publică)
export async function genereazaAwbSameday(c: AwbCerere): Promise<AwbRaspuns> {
  if (!samedayConfigurat())
    return { ok: false, eroare: "Sameday neconfigurat: adaugă SAMEDAY_USER și SAMEDAY_PASS în Vercel → Settings → Environment Variables (după semnarea contractului Sameday)." };
  // TODO la activare:
  // 1. POST https://api.sameday.ro/api/authenticate -> token
  // 2. POST https://api.sameday.ro/api/awb  cu datele din `c` -> { awbNumber }
  return { ok: false, eroare: "Implementarea se deblochează la primirea contului Sameday (vezi README → Integrări)." };
}
