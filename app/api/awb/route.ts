// Ruta de generare AWB — apelată din /admin cu un click pe comandă.
// Firma lucrează exclusiv cu FAN Courier, deci nu mai alegem între curieri.
import { NextResponse } from "next/server";
import { genereazaAwbFan, AwbCerere } from "@/lib/couriers";

export async function POST(req: Request) {
  const body = await req.json();
  const cerere: AwbCerere = body.cerere;
  const r = await genereazaAwbFan(cerere);
  return NextResponse.json(r);
}
