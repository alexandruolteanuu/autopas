// Raportează starea integrărilor (fără să expună vreo parolă).
import { NextResponse } from "next/server";
import { credentialeFan, credentialeSameday } from "@/lib/couriers";

export async function GET() {
  const [f, s] = await Promise.all([credentialeFan(), credentialeSameday()]);
  return NextResponse.json({
    fan: Boolean(f.clientId && f.user && f.parola),
    sameday: Boolean(s.user && s.parola),
  });
}
