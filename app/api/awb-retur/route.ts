// AWB DE RETUR — FAN Courier, pe contul selfAWB OCAZIONAL.
//
// Coletul pleacă de la CLIENT și vine la depozit, deci:
//   · se folosește alt cont decât la livrare (cel ocazional, fără contract);
//   · `sender` e clientul, nu noi;
//   · pe lângă AWB se plasează obligatoriu o COMANDĂ DE CURIER, altfel nimeni
//     nu trece pe la client să ridice coletul.
// Motivele complete stau în lib/fancourier.ts, lângă funcții.
//
// Ca la ruta de AWB obișnuit: rulează pe server, cu contul firmei, deci cere
// token-ul sesiunii și acceptă doar echipa. Datele clientului se citesc AICI
// din bază; din browser vin doar coletul, data ridicării și, dacă operatorul a
// corectat-o, adresa.
import { NextResponse } from "next/server";
import { esteEchipa, sbAdmin } from "@/lib/supabase";
import {
  genereazaAwbRetur, anuleazaComandaCurier, stergeAwb, etichetaAwb, verificaReturul,
  tarifRetur, configFanRetur, returConfigurat, depozitRetur, EroareFan, INTERVAL_RIDICARE,
} from "@/lib/fancourier";

export const dynamic = "force-dynamic";

const nuAi = () => NextResponse.json(
  { ok: false, eroare: "Nu ai dreptul să lucrezi cu AWB-uri. Autentifică-te din nou în panou." }, { status: 401 });

const eroare = (e: unknown) => NextResponse.json({
  ok: false,
  eroare: e instanceof EroareFan ? e.message : `Eroare la legătura cu FAN Courier: ${(e as Error)?.message ?? e}`,
});

const nr = (v: unknown) => Number(String(v ?? "").replace(",", ".").trim() || NaN);
const dim = (v: unknown) => { const n = Math.round(nr(v)); return n >= 1 ? n : 0; };
const text = (v: unknown) => String(v ?? "").trim();

/** Ziua de azi la București, ca `YYYY-MM-DD`. FAN refuză o dată din trecut
 *  (verificat: 422 „must be a date after or equal to today”), iar serverul
 *  rulează la Frankfurt — o oră în minus ar putea da ziua de ieri. */
function aziRO() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Bucharest" }).format(new Date());
}

/** Adresa de ridicare: ce a corectat operatorul, altfel ce e salvat pe cerere,
 *  altfel adresa din comandă. Formularul de retur NU cere adresa — de asta
 *  există legătura cu comanda. */
function adresaRidicare(cerere: any, comanda: any, dinFormular: any) {
  const salvat = (cerere?.ridicare ?? {}) as Record<string, string>;
  const f = dinFormular ?? {};
  return {
    nume: text(f.nume) || salvat.nume || text(cerere?.nume),
    telefon: text(f.telefon) || salvat.telefon || text(cerere?.telefon) || text(comanda?.telefon),
    email: text(cerere?.email) || null,
    judet: text(f.judet) || salvat.judet || text(comanda?.judet),
    localitate: text(f.localitate) || salvat.localitate || text(comanda?.oras),
    strada: text(f.strada) || salvat.strada || text(comanda?.adresa),
  };
}

/** Comanda de care ține cererea: întâi legătura salvată, apoi căutarea după
 *  numărul scris de client — care poate fi scris oricum („ap 2026 1453”). */
async function gasesteComanda(sb: any, cerere: any) {
  if (cerere.order_id) {
    const { data } = await sb.from("orders").select("*").eq("id", cerere.order_id).maybeSingle();
    if (data) return data;
  }
  const brut = text(cerere.numar_comanda);
  if (!brut) return null;
  const cifre = brut.replace(/\D/g, "");
  const { data } = await sb.from("orders").select("*").or(
    `numar.eq.${brut.toUpperCase()}` + (cifre.length >= 8 ? `,numar.eq.AP-${cifre.slice(0, 4)}-${cifre.slice(4)}` : ""),
  ).limit(1);
  return data?.[0] ?? null;
}

export async function POST(req: Request) {
  if (!(await esteEchipa(req))) return nuAi();
  const sb = sbAdmin();
  if (!sb) return NextResponse.json({ ok: false, eroare: "Serverul nu are acces la baza de date." });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, eroare: "Cerere invalidă." }, { status: 400 }); }

  try {
    // ---------- „Verifică conexiunea” din Integrări ----------
    if (body.actiune === "verifica") {
      const { servicii } = await verificaReturul();
      const dep = await depozitRetur();
      return NextResponse.json({ ok: true, servicii, depozit: dep });
    }

    const cerereId = Number(body.cerere_id);
    const { data: cerere } = await sb.from("return_requests").select("*").eq("id", cerereId).maybeSingle();
    if (!cerere) return NextResponse.json({ ok: false, eroare: "Cererea de retur nu există." });
    const comanda = await gasesteComanda(sb, cerere);

    // ---------- ce se știe despre cerere, pentru formular ----------
    // Deschiderea panoului nu cheamă niciodată FAN: ecranul se încarcă instant,
    // iar API-ul lor e chemat doar când operatorul apasă un buton.
    if (body.actiune === "pregateste") {
      const cfgR = await configFanRetur();
      return NextResponse.json({
        ok: true,
        configurat: returConfigurat(cfgR),
        adresa: adresaRidicare(cerere, comanda, null),
        comanda: comanda ? { id: comanda.id, numar: comanda.numar, total: comanda.total } : null,
        awb: cerere.awb ?? null,
        awb_curier_id: cerere.awb_curier_id ?? null,
        awb_date: cerere.awb_date ?? null,
        interval: INTERVAL_RIDICARE,
        azi: aziRO(),
      });
    }

    // ---------- cât costă returul ----------
    if (body.actiune === "tarif") {
      const c = body.colet ?? {};
      const colet = { colete: Math.round(nr(c.colete)), greutate: nr(c.greutate),
        lungime: dim(c.lungime), latime: dim(c.latime), inaltime: dim(c.inaltime) };
      const adr = adresaRidicare(cerere, comanda, body.adresa);
      const lipsa = verificaColet(colet, adr);
      if (lipsa) return NextResponse.json({ ok: false, eroare: lipsa });
      const tarif = await tarifRetur(adr, colet);
      return NextResponse.json({ ok: true, tarif });
    }

    // ---------- salvarea adresei corectate, fără să cheme FAN ----------
    if (body.actiune === "salveaza_adresa") {
      const adr = adresaRidicare(cerere, comanda, body.adresa);
      const patch: Record<string, unknown> = { ridicare: adr };
      if (comanda && !cerere.order_id) patch.order_id = comanda.id;
      const { data: scrise, error } = await sb.from("return_requests").update(patch).eq("id", cerereId).select("id");
      if (error || !scrise?.length)
        return NextResponse.json({ ok: false, eroare: `Adresa nu s-a salvat: ${error?.message ?? "niciun rând atins"}` });
      return NextResponse.json({ ok: true, adresa: adr });
    }

    // ---------- ștergerea: la FAN ȘI din cerere ----------
    // Aceeași regulă ca la AWB-ul de livrare: „nu mai există la FAN” e tot un
    // succes, fiindcă rezultatul dorit e atins. La orice alt refuz, AWB-ul NU
    // se scoate din cerere — altfel ar rămâne unul la FAN de care nu mai știe
    // nimeni. Comanda de curier se anulează ÎNAINTE: dacă rămâne, curierul se
    // duce degeaba la client.
    if (body.actiune === "sterge") {
      if (!cerere.awb) return NextResponse.json({ ok: true, deja: true });
      const cfgR = await configFanRetur();
      let notaCurier = "";
      if (cerere.awb_curier_id) {
        try {
          const r = await anuleazaComandaCurier(String(cerere.awb_curier_id), cfgR);
          notaCurier = r === "anulata" ? " · comanda de curier anulată" : " · comanda de curier nu mai exista";
        } catch (e) {
          // Nu oprim ștergerea AWB-ului pentru asta, dar o spunem: o comandă de
          // curier rămasă înseamnă un drum degeaba, nu o pierdere de date.
          notaCurier = ` · ATENȚIE: comanda de curier ${cerere.awb_curier_id} n-a putut fi anulată (${e instanceof Error ? e.message : e}). Anuleaz-o din selfawb.ro.`;
        }
      }
      if (body.doar_admin !== true) {
        try {
          await stergeAwb(String(cerere.awb), { clientId: cfgR.clientId, user: cfgR.user, parola: cfgR.parola, rambursInCont: false });
        } catch (e) {
          return NextResponse.json({ ok: false, poate_doar_admin: true,
            eroare: `${e instanceof EroareFan ? e.message : String(e)} AWB-ul NU a fost scos din cerere.${notaCurier}` });
        }
      }
      const { data: scrise, error } = await sb.from("return_requests")
        .update({ awb: null, awb_curier_id: null, awb_generat_la: null, awb_date: null })
        .eq("id", cerereId).select("id");
      if (error || !scrise?.length)
        return NextResponse.json({ ok: false, eroare: `AWB-ul n-a putut fi scos din cerere: ${error?.message ?? "niciun rând atins"}` });
      return NextResponse.json({ ok: true, nota: notaCurier.trim() });
    }

    if (body.actiune !== "genereaza")
      return NextResponse.json({ ok: false, eroare: "Acțiune necunoscută." }, { status: 400 });

    // ---------- generarea ----------
    if (cerere.awb)
      return NextResponse.json({ ok: false, eroare: `Cererea are deja AWB-ul de retur ${cerere.awb}. Șterge-l întâi dacă vrei altul.` });

    const c = body.colet ?? {};
    const colet = {
      colete: Math.round(nr(c.colete)), greutate: nr(c.greutate),
      lungime: dim(c.lungime), latime: dim(c.latime), inaltime: dim(c.inaltime),
      observatii: text(c.observatii) || `Retur comanda ${cerere.numar_comanda}`,
      referinta: text(comanda?.numar) || text(cerere.numar_comanda),
    };
    const adr = adresaRidicare(cerere, comanda, body.adresa);
    const lipsa = verificaColet(colet, adr);
    if (lipsa) return NextResponse.json({ ok: false, eroare: lipsa });

    const dataRidicare = text(body.data_ridicare) || aziRO();
    if (dataRidicare < aziRO())
      return NextResponse.json({ ok: false, eroare: "Data ridicării nu poate fi în trecut." });

    const r = await genereazaAwbRetur(adr, colet, dataRidicare);

    const awb_date = {
      colete: colet.colete, greutate: colet.greutate,
      lungime: colet.lungime, latime: colet.latime, inaltime: colet.inaltime,
      tarif: r.tarif, tva: r.tva, tracking: r.tracking,
      data_ridicare: dataRidicare, interval: INTERVAL_RIDICARE,
      comanda_curier: r.comandaCurierId, eroare_curier: r.eroareCurier,
      ridicare: adr,
    };
    const patch: Record<string, unknown> = {
      awb: r.awb, awb_curier_id: r.comandaCurierId, awb_generat_la: new Date().toISOString(),
      awb_date, ridicare: adr,
    };
    if (comanda && !cerere.order_id) patch.order_id = comanda.id;
    // Statusul trece în lucru la primul AWB, dacă încă e „noua”.
    if (cerere.status === "noua") patch.status = "in_lucru";

    const { data: scrise, error } = await sb.from("return_requests").update(patch).eq("id", cerereId).select("id");
    if (error || !scrise?.length) {
      // AWB-ul EXISTĂ la FAN. Îl arătăm, ca să nu se piardă.
      return NextResponse.json({ ok: false, awb: r.awb,
        eroare: `FAN a generat AWB-ul de retur ${r.awb}, dar nu s-a putut salva în cerere (${error?.message ?? "niciun rând atins"}). Notează-l.` });
    }
    return NextResponse.json({
      ok: true, awb: r.awb, tarif: r.tarif, tva: r.tva, tracking: r.tracking,
      comanda_curier: r.comandaCurierId, eroare_curier: r.eroareCurier,
    });
  } catch (e) {
    return eroare(e);
  }
}

/** Ce lipsește ca să se poată cere ceva de la FAN. Dimensiunile sunt
 *  OBLIGATORII la retur (comanda de curier le cere — măsurat: 422 fără ele),
 *  spre deosebire de AWB-ul de livrare, unde sunt opționale. */
function verificaColet(
  colet: { colete: number; greutate: number; lungime: number; latime: number; inaltime: number },
  adr: { judet: string; localitate: string; strada: string; telefon: string },
): string | null {
  const lipsa: string[] = [];
  if (!(colet.colete >= 1)) lipsa.push("numărul de colete");
  if (!(colet.greutate > 0)) lipsa.push("greutatea");
  if (!(colet.lungime && colet.latime && colet.inaltime))
    lipsa.push("toate cele trei dimensiuni (FAN le cere la comanda de curier)");
  if (!adr.judet || !adr.localitate) lipsa.push("județul și localitatea de ridicare");
  if (!adr.strada) lipsa.push("strada de ridicare");
  if (!adr.telefon) lipsa.push("telefonul clientului");
  return lipsa.length ? `Completează ${lipsa.join(", ")}.` : null;
}

/** Eticheta PDF a AWB-ului de retur. Se printează pe contul OCAZIONAL — cu cel
 *  cu contract, FAN n-ar recunoaște AWB-ul. De obicei n-o printăm noi: curierul
 *  o aduce (de asta `awbNumber` pleacă în comanda de curier), dar o păstrăm
 *  pentru cazul în care clientul vrea s-o aibă pe hârtie. */
export async function GET(req: Request) {
  if (!(await esteEchipa(req))) return nuAi();
  const sb = sbAdmin();
  const id = Number(new URL(req.url).searchParams.get("cerere_id"));
  const { data: c } = sb
    ? await sb.from("return_requests").select("awb,numar_comanda").eq("id", id).maybeSingle()
    : { data: null };
  if (!c?.awb) return NextResponse.json({ ok: false, eroare: "Cererea n-are AWB de retur." }, { status: 404 });
  try {
    const cfgR = await configFanRetur();
    const pdf = await etichetaAwb(String(c.awb),
      { clientId: cfgR.clientId, user: cfgR.user, parola: cfgR.parola, rambursInCont: false });
    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="RETUR-${c.awb}-${c.numar_comanda}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, eroare: e instanceof EroareFan ? e.message : String(e) }, { status: 502 });
  }
}
