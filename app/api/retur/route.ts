// RETUR AUTOMAT — formularul public de retur (/formular-retur), FĂRĂ cont și FĂRĂ
// confirmare din partea echipei (decizia proprietarului, 24 noiembrie 2026).
//
// Ce face, într-o singură cerere:
//   1. caută comanda după numărul scris de client (singura verificare cerută);
//   2. ia coletul (colete, kg, dimensiuni) din AWB-ul LIVRĂRII acelei comenzi —
//      dacă lipsesc dimensiunile, le cere clientului (FAN refuză comanda de
//      curier fără ele);
//   3. cine plătește transportul vine din motiv (`plataDupaMotiv`): piesa
//      neconformă = noi, orice altceva = clientul, cash la ridicare;
//   4. generează AWB-ul de retur + comanda de curier, pe adresa scrisă de client;
//   5. abia APOI scrie cererea, cu AWB-ul în ea. Triggerul de e-mail (migrarea 36)
//      pornește la inserare, deci e-mailul clientului conține deja AWB-ul.
//
// Protecții păstrate, care nu-l încurcă pe client: comanda trebuie să existe și
// să nu fie anulată; o comandă are cel mult UN AWB de retur (altfel un dublu-clic
// ar comanda doi curieri). Dacă FAN nu răspunde, cererea se înregistrează oricum,
// fără AWB — retragerea din contract e un drept legal și nu se pierde.
import { NextResponse } from "next/server";
import { sbAdmin } from "@/lib/supabase";
import {
  genereazaAwbRetur, configFanRetur, returConfigurat, EroareFan, INTERVAL_RIDICARE,
} from "@/lib/fancourier";
import { gasesteComanda, plataDupaMotiv, zileRidicare, MOTIVE_RETUR } from "@/lib/retur";

export const dynamic = "force-dynamic";

const text = (v: unknown, max = 300) => String(v ?? "").trim().slice(0, max);
const nr = (v: unknown) => Number(String(v ?? "").replace(",", ".").trim() || NaN);
const dim = (v: unknown) => { const n = Math.round(nr(v)); return n >= 1 && n <= 300 ? n : 0; };
const raspuns = (o: object) => NextResponse.json(o);

/** GET: zilele în care poate veni curierul (formularul le arată ca listă). */
export async function GET() {
  return raspuns({ ok: true, zile: zileRidicare(), interval: INTERVAL_RIDICARE });
}

export async function POST(req: Request) {
  const sb = sbAdmin();
  if (!sb) return raspuns({ ok: false, eroare: "Serverul nu are acces la baza de date. Sună-ne și rezolvăm la telefon." });

  let b: any;
  try { b = await req.json(); } catch { return raspuns({ ok: false, eroare: "Cerere invalidă." }); }

  // ---------- câmpurile clientului ----------
  const date = {
    numar_comanda: text(b.numar_comanda, 40), nume: text(b.nume, 120), email: text(b.email, 160),
    telefon: text(b.telefon, 30), produs: text(b.produs, 300), motiv: text(b.motiv, 120),
    iban: text(b.iban, 40) || null,
  };
  const a = b.adresa ?? {};
  const strada = [text(a.strada, 150), text(a.numar, 50)].filter(Boolean).join(", ");
  const ridicare = { nume: date.nume, telefon: date.telefon, email: date.email || null,
    judet: text(a.judet, 60), localitate: text(a.localitate, 80), strada };

  const lipsa: string[] = [];
  if (!date.numar_comanda) lipsa.push("numărul comenzii");
  if (!date.nume) lipsa.push("numele");
  if (!/^\S+@\S+\.\S+$/.test(date.email)) lipsa.push("un e-mail valid");
  if (date.telefon.replace(/\D/g, "").length < 9) lipsa.push("telefonul");
  if (!date.produs) lipsa.push("piesa returnată");
  if (!(MOTIVE_RETUR as readonly string[]).includes(date.motiv)) lipsa.push("motivul");
  if (!ridicare.judet || !ridicare.localitate) lipsa.push("județul și localitatea de ridicare");
  if (!strada) lipsa.push("adresa de ridicare (strada și numărul)");
  if (lipsa.length) return raspuns({ ok: false, eroare: `Completează ${lipsa.join(", ")}.` });

  const zile = zileRidicare();
  const dataRidicare = zile.includes(text(b.data_ridicare)) ? text(b.data_ridicare) : zile[0];

  // ---------- comanda ----------
  const comanda = await gasesteComanda(sb, { numar_comanda: date.numar_comanda });
  if (!comanda)
    return raspuns({ ok: false, eroare: `N-am găsit comanda „${date.numar_comanda}”. Verifică numărul (îl găsești în e-mailul de confirmare, de forma AP-2026-01847).` });
  if (comanda.status === "anulata")
    return raspuns({ ok: false, eroare: `Comanda ${comanda.numar} e anulată, deci n-are ce să se returneze. Dacă e o greșeală, sună-ne.` });

  // O comandă = cel mult un AWB de retur (dublu-clic, a doua trimitere a formularului).
  const { data: existente } = await sb.from("return_requests").select("id,awb")
    .eq("order_id", comanda.id).not("awb", "is", null).limit(1);
  if (existente?.length)
    return raspuns({ ok: false, eroare: `Pentru comanda ${comanda.numar} există deja un AWB de retur, trimis pe e-mail. Dacă ai nevoie de altul, sună-ne.` });

  // ---------- coletul: din AWB-ul livrării, completat de client doar unde lipsește ----------
  const livrare = (comanda.awb_date ?? {}) as Record<string, any>;
  const c = b.colet ?? {};
  const colet = {
    colete: Math.max(1, Math.round(nr(livrare.colete)) || 1),
    greutate: nr(livrare.greutate) > 0 ? nr(livrare.greutate) : (nr(c.greutate) > 0 && nr(c.greutate) <= 500 ? nr(c.greutate) : 0),
    lungime: dim(livrare.lungime) || dim(c.lungime),
    latime: dim(livrare.latime) || dim(c.latime),
    inaltime: dim(livrare.inaltime) || dim(c.inaltime),
    observatii: `Retur comanda ${comanda.numar}`,
    referinta: String(comanda.numar),
    plata: plataDupaMotiv(date.motiv),
  };
  if (!(colet.greutate > 0) || !(colet.lungime && colet.latime && colet.inaltime)) {
    return raspuns({
      ok: false, cere_colet: { greutate: !(colet.greutate > 0), dimensiuni: !(colet.lungime && colet.latime && colet.inaltime) },
      eroare: "Mai avem nevoie de mărimea coletului (aproximativ), ca să comandăm curierul. Completează câmpurile apărute mai jos.",
    });
  }

  // ---------- AWB + curier ----------
  let awb: Awaited<ReturnType<typeof genereazaAwbRetur>> | null = null;
  let eroareFan: string | null = null;
  try {
    const cfgR = await configFanRetur();
    if (!returConfigurat(cfgR)) throw new EroareFan("contul de retur nu e configurat");
    awb = await genereazaAwbRetur(ridicare, colet, dataRidicare, cfgR);
  } catch (e) {
    eroareFan = e instanceof Error ? e.message : String(e);
    // Adresa refuzată de FAN: clientul o poate corecta pe loc — nu înregistrăm nimic încă.
    if (e instanceof EroareFan && e.stare === 422 && /Localitatea|Județul|Telefonul/.test(eroareFan))
      return raspuns({ ok: false, eroare: /Telefonul/.test(eroareFan)
        ? "Curierul nu acceptă numărul de telefon scris. Verifică-l și trimite din nou."
        : "Curierul nu recunoaște localitatea sau județul de ridicare. Alege-le din listă (numele satului sau al orașului, nu al cartierului) și trimite din nou." });
  }

  // ---------- cererea, cu AWB-ul în ea (e-mailul pleacă din trigger, la inserare) ----------
  const rand: Record<string, unknown> = { ...date, order_id: comanda.id, ridicare };
  if (awb) {
    Object.assign(rand, {
      awb: awb.awb, awb_curier_id: awb.comandaCurierId, awb_generat_la: new Date().toISOString(),
      status: "in_lucru",
      awb_date: {
        automat: true, plata: colet.plata,
        colete: colet.colete, greutate: colet.greutate,
        lungime: colet.lungime, latime: colet.latime, inaltime: colet.inaltime,
        tarif: awb.tarif, tva: awb.tva, tracking: awb.tracking,
        data_ridicare: dataRidicare, interval: INTERVAL_RIDICARE,
        comanda_curier: awb.comandaCurierId, eroare_curier: awb.eroareCurier, ridicare,
      },
    });
    if (awb.eroareCurier)
      rand.nota = `AWB generat automat, DAR curierul NU s-a comandat: ${awb.eroareCurier} Comandă ridicarea din selfawb.ro.`;
  } else {
    rand.nota = `AWB-ul de retur NU s-a generat automat: ${eroareFan}. De făcut din panou.`;
  }
  const { error } = await sb.from("return_requests").insert(rand);
  if (error) {
    // AWB-ul EXISTĂ la FAN: îl dăm clientului, ca să nu se piardă.
    return raspuns(awb
      ? { ok: true, awb: awb.awb, nesalvat: true, total: awb.tarif + awb.tva, plata: colet.plata, data_ridicare: dataRidicare, interval: INTERVAL_RIDICARE }
      : { ok: false, eroare: "Cererea nu s-a putut înregistra. Încearcă din nou sau sună-ne." });
  }

  return raspuns(awb
    ? { ok: true, awb: awb.awb, curier: !!awb.comandaCurierId, total: Math.round((awb.tarif + awb.tva) * 100) / 100,
        plata: colet.plata, data_ridicare: dataRidicare, interval: INTERVAL_RIDICARE, tracking: awb.tracking }
    : { ok: true, awb: null });
}
