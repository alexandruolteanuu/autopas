// ============================================================
// GOLIREA CACHE-ULUI DUPĂ O SALVARE DIN ADMIN
//
// `app/layout.tsx` are `revalidate = 300`, iar datele firmei se citesc pe server
// (`getSetariServer()`), deci subsolul, pagina de contact și cele 8 documente
// legale pot arăta până la 5 minute valoarea veche după o salvare. Operatorul
// salvează, se uită pe site, nu vede nimic schimbat și crede că iar n-a mers.
//
// Ruta asta e apelată de /admin/setari imediat după o salvare CONFIRMATĂ (adică
// una care chiar a atins un rând) și golește cache-ul întregului arbore de rute.
// `revalidatePath("/", "layout")` e varianta corectă aici, nu una pe pagină:
// datele firmei intră prin layout, deci ating fiecare pagină publică.
//
// Ca peste tot în app/api/: rutele nu sunt protejate de RLS, deci cer token-ul
// sesiunii și îl verifică cu `esteEchipa()`.
// ============================================================
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { esteEchipa } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await esteEchipa(req)))
    return NextResponse.json({ ok: false, eroare: "Doar echipa poate goli cache-ul." }, { status: 401 });

  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, golit: "tot arborele de rute" });
}
