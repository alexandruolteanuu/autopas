// Ruta de generare AWB — apelată din /admin cu un click pe comandă.
// Alege automat curierul comenzii (fan / sameday) și întoarce AWB-ul sau motivul exact.
import { NextResponse } from "next/server";
import { genereazaAwbFan, genereazaAwbSameday, AwbCerere } from "@/lib/couriers";

export async function POST(req: Request) {
  const body = await req.json();
  const cerere: AwbCerere = body.cerere;
  const curier: string = body.curier;
  const r = curier === "sameday" ? await genereazaAwbSameday(cerere) : await genereazaAwbFan(cerere);
  return NextResponse.json(r);
}
