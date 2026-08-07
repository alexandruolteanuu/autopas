// Raportează starea integrărilor (fără să expună vreo parolă).
import { NextResponse } from "next/server";
import { credentialeFan } from "@/lib/couriers";

export async function GET() {
  const f = await credentialeFan();
  return NextResponse.json({
    fan: Boolean(f.clientId && f.user && f.parola),
  });
}
