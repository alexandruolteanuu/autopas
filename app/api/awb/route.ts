// Ruta de generare AWB — apelată din /admin cu un click pe comandă.
// Firma lucrează exclusiv cu FAN Courier, deci nu mai alegem între curieri.
//
// Ruta rulează pe server, cu credențialele firmei la FAN Courier. Fără o
// verificare de acces, oricine ar putea genera AWB-uri pe contul firmei, cu
// destinatari inventați. De aceea cerem token-ul sesiunii și acceptăm doar
// membrii echipei.
import { NextResponse } from "next/server";
import { genereazaAwbFan, AwbCerere } from "@/lib/couriers";
import { esteEchipa } from "@/lib/supabase";

export async function POST(req: Request) {
  if (!(await esteEchipa(req))) {
    return NextResponse.json(
      { ok: false, eroare: "Nu ai dreptul să generezi AWB-uri. Autentifică-te din nou în panou." },
      { status: 401 },
    );
  }

  let body: { cerere?: AwbCerere };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, eroare: "Cerere invalidă." }, { status: 400 });
  }

  const cerere = body.cerere;
  if (!cerere || !cerere.numar_comanda) {
    return NextResponse.json({ ok: false, eroare: "Lipsesc datele expedierii." }, { status: 400 });
  }

  const r = await genereazaAwbFan(cerere);
  return NextResponse.json(r);
}
