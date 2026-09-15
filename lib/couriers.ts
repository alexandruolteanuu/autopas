// ============================================================
// CURIER — FAN Courier (SelfAWB). Este singurul curier al firmei.
// Toată legătura cu FAN stă în lib/fancourier.ts; aici rămâne doar întrebarea
// „e configurat?", folosită de ecranul Integrări.
// ============================================================
import { configFan } from "./fancourier";

export async function credentialeFan() {
  const c = await configFan();
  return { clientId: c.clientId, user: c.user, parola: c.parola };
}
