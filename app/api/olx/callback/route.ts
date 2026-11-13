// ============================================================
// CALLBACK-UL OAUTH OLX (pasul 1 din docs/olx-plan.md)
//
// OLX trimite aici browserul omului, cu `code` și `state`. Nu există sesiune în
// antet (e o redirecționare), deci protecția e `state`-ul: creat de un ADMIN prin
// /api/olx („Conectează OLX”), valabil 10 minute, consumat atomic în bază
// (`olx_consuma_starea`) — merge O SINGURĂ dată. Un `state` greșit nu schimbă nimic.
// Codul se schimbă pe tokeni pe server; tokenii nu ajung în browser.
// ============================================================
import { NextResponse } from "next/server";
import { admin, clientOlx, adresaCallback, EroareOlx } from "@/lib/olx";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const inapoi = (rezultat: string, mesaj: string) =>
    NextResponse.redirect(`${u.origin}/admin/integrari?olx=${rezultat}&mesaj=${encodeURIComponent(mesaj)}#olx`, 303);

  const code = u.searchParams.get("code") ?? "";
  const state = u.searchParams.get("state") ?? "";
  if (u.searchParams.get("error")) return inapoi("eroare", `OLX: ${u.searchParams.get("error_description") || u.searchParams.get("error")}`);
  if (!code || !state) return inapoi("eroare", "Lipsesc „code” sau „state” din răspunsul OLX.");

  try {
    const { data: de, error } = await admin().rpc("olx_consuma_starea", { p_stare: state });
    if (error) return inapoi("eroare", `Baza de date: ${error.message}`);
    if (!de) return inapoi("eroare", "Cererea de conectare nu e recunoscută sau a expirat (10 minute). Apasă din nou „Conectează OLX”.");
    await clientOlx().schimbaCodul({ code, redirect_uri: adresaCallback(req), de });
    return inapoi("ok", "✓ Contul OLX e conectat. Apasă „Testează conexiunea”.");
  } catch (e) {
    return inapoi("eroare", e instanceof EroareOlx ? e.message : `Conectarea a eșuat: ${(e as Error)?.message ?? e}`);
  }
}
