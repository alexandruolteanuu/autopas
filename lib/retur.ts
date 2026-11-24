// RETUR — reguli comune pentru formularul public (app/api/retur) și panoul din
// admin (app/api/awb-retur). Rulează doar pe server.
import type { PlataRetur } from "@/lib/fancourier";

/** Comanda de care ține cererea: întâi legătura salvată, apoi căutarea după
 *  numărul scris de client — care poate fi scris oricum („ap 2026 1453”). */
export async function gasesteComanda(sb: any, cerere: { order_id?: number | null; numar_comanda?: string | null }) {
  if (cerere.order_id) {
    const { data } = await sb.from("orders").select("*").eq("id", cerere.order_id).maybeSingle();
    if (data) return data;
  }
  const brut = String(cerere.numar_comanda ?? "").trim();
  if (!brut) return null;
  const cifre = brut.replace(/\D/g, "");
  const { data } = await sb.from("orders").select("*").or(
    `numar.eq.${brut.toUpperCase().replace(/[^A-Z0-9-]/g, "")}` +
    (cifre.length >= 8 ? `,numar.eq.AP-${cifre.slice(0, 4)}-${cifre.slice(4)}` : ""),
  ).limit(1);
  return data?.[0] ?? null;
}

/** Motivele din formularul de retur. Textul e cel salvat în `return_requests.motiv`. */
export const MOTIVE_RETUR = [
  "Renunț la produs (14 zile, OUG 34/2014)",
  "Piesa nu se potrivește pe mașină",
  "Piesa este neconformă / nefuncțională",
  "Alt motiv",
] as const;

/** Cine plătește transportul, după motivul ales de client (decizia proprietarului,
 *  24 noiembrie 2026): piesa neconformă / nefuncțională = plătim noi; orice alt
 *  motiv = clientul, cash curierului la ridicare. */
export const plataDupaMotiv = (motiv: string): PlataRetur =>
  /neconform|nefunc/i.test(motiv) ? "firma" : "client";

/** Ziua de azi la București, ca `YYYY-MM-DD` (serverul e la Frankfurt). */
export function aziRO() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Bucharest" }).format(new Date());
}

/** Următoarele `n` zile lucrătoare (luni–vineri), începând de MÂINE, ca `YYYY-MM-DD`.
 *  Sărbătorile legale nu sunt scoase: o ridicare căzută într-o sărbătoare o mută FAN. */
export function zileRidicare(n = 5): string[] {
  const [a, l, z] = aziRO().split("-").map(Number);
  const d = new Date(Date.UTC(a, l - 1, z));
  const zile: string[] = [];
  while (zile.length < n) {
    d.setUTCDate(d.getUTCDate() + 1);
    const zs = d.getUTCDay();
    if (zs !== 0 && zs !== 6) zile.push(d.toISOString().slice(0, 10));
  }
  return zile;
}
