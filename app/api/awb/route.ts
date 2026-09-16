// AWB FAN COURIER — generare, etichetă PDF, ștergere, verificarea contului.
//
// Ruta rulează pe server, cu contul firmei la FAN. Fără verificarea de acces,
// oricine ar putea genera AWB-uri pe contul firmei, cu destinatari inventați.
// De aceea cerem token-ul sesiunii și acceptăm doar membrii echipei.
//
// Datele comenzii (nume, total) se citesc AICI din bază, nu se primesc din
// browser. Din browser vin doar ce scrie operatorul la AWB: coletul și,
// opțional, adresa corectată.
//
// AWB-ul se scrie în comandă tot de aici, imediat după răspunsul FAN: dacă
// browserul s-ar închide între „FAN a dat numărul" și „s-a salvat", AWB-ul ar
// exista la FAN fără ca noi să știm de el.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { esteEchipa, sbAdmin } from "@/lib/supabase";
import { genereazaAwb, etichetaAwb, stergeAwb, verificaConexiunea, tarifTransport, EroareFan, areDimensiuni } from "@/lib/fancourier";

export const dynamic = "force-dynamic";

const nuAi = () => NextResponse.json(
  { ok: false, eroare: "Nu ai dreptul să lucrezi cu AWB-uri. Autentifică-te din nou în panou." }, { status: 401 });

/** Adresa de e-mail a omului din echipă, pentru jurnalul comenzii. */
async function autor(req: Request) {
  const token = (req.headers.get("authorization") ?? "").slice(7).trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !key) return "echipa";
  const { data } = await createClient(url, key, { auth: { persistSession: false } }).auth.getUser(token);
  return data.user?.email ?? "echipa";
}

const eroare = (e: unknown) => NextResponse.json({
  ok: false, eroare: e instanceof EroareFan ? e.message : `Eroare la legătura cu FAN Courier: ${(e as Error)?.message ?? e}`,
});

/** Un număr din formular: virgula românească acceptată, gol = NaN. */
const nr = (v: unknown) => Number(String(v ?? "").replace(",", ".").trim() || NaN);
/** O dimensiune a coletului: centimetri întregi, sau `null` dacă e goală (opțională). */
const dim = (v: unknown) => { const n = Math.round(nr(v)); return n >= 1 ? n : null; };
/** Unele dimensiuni scrise, altele nu — probabil o greșeală de tastare, nu o alegere. */
const dimensiuniPartiale = (c: { lungime: number | null; latime: number | null; inaltime: number | null }) => {
  const n = [c.lungime, c.latime, c.inaltime].filter((x) => x !== null).length;
  return n > 0 && n < 3;
};

export async function POST(req: Request) {
  if (!(await esteEchipa(req))) return nuAi();
  const sb = sbAdmin();
  if (!sb) return NextResponse.json({ ok: false, eroare: "Serverul nu are acces la baza de date." });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, eroare: "Cerere invalidă." }, { status: 400 }); }

  try {
    if (body.actiune === "verifica") {
      const { servicii, cfg } = await verificaConexiunea();
      const areColector = servicii.includes("Cont Colector");
      return NextResponse.json({
        ok: true, servicii,
        avertisment: cfg.rambursInCont && !areColector
          ? "Contul n-are serviciul „Cont Colector”, deci rambursul nu poate intra în cont bancar. Debifează „Ramburs în cont bancar” sau cere-l de la FAN."
          : null,
      });
    }

    // ---------- calculatorul de transport ----------
    // Merge și fără comandă (clientul sună și întreabă „cât costă la Cluj?"):
    // atunci județul și localitatea vin din formular.
    if (body.actiune === "tarif") {
      const c = body.colet ?? {};
      const colet = {
        colete: Math.round(nr(c.colete)), greutate: nr(c.greutate),
        lungime: dim(c.lungime), latime: dim(c.latime), inaltime: dim(c.inaltime),
        cuRamburs: c.cu_ramburs !== false,
      };
      if (!(colet.colete >= 1) || !(colet.greutate > 0))
        return NextResponse.json({ ok: false, eroare: "Completează coletele și greutatea." });
      if (dimensiuniPartiale(colet))
        return NextResponse.json({ ok: false, eroare: "Dimensiunile sunt opționale: scrie-le pe toate trei sau lasă-le pe toate goale." });
      let judet = String(body.destinatar?.judet ?? "").trim(), localitate = String(body.destinatar?.localitate ?? "").trim();
      if (body.comanda_id) {
        const { data: o } = await sb.from("orders").select("judet,oras,plata").eq("id", Number(body.comanda_id)).maybeSingle();
        if (!o) return NextResponse.json({ ok: false, eroare: "Comanda nu există." });
        judet = judet || o.judet; localitate = localitate || o.oras;
        colet.cuRamburs = o.plata === "ramburs";
      }
      if (!judet || !localitate) return NextResponse.json({ ok: false, eroare: "Completează județul și localitatea." });
      const tarif = await tarifTransport({ judet, localitate }, colet);
      return NextResponse.json({ ok: true, tarif });
    }

    const id = Number(body.comanda_id);
    const { data: o } = await sb.from("orders").select("*").eq("id", id).maybeSingle();
    if (!o) return NextResponse.json({ ok: false, eroare: "Comanda nu există." });

    // ---------- ștergerea AWB-ului: la FAN ȘI din comandă ----------
    // Cele trei situații, toate cu același rezultat în admin — AWB-ul dispare din
    // comandă, din „Expedieri" și din borderou:
    //   · FAN confirmă ștergerea;
    //   · FAN spune că AWB-ul nu (mai) există (șters din selfawb.ro, scris greșit de
    //     mână): nu mai e nimic de șters acolo, deci doar se curăță comanda;
    //   · `doar_admin: true` — operatorul a ales explicit, după un refuz al FAN, să-l
    //     scoată doar din admin (ex. AWB de pe alt cont). Butonul apare doar după refuz.
    // O comandă „expediată" revine la „confirmată": fără AWB nu poate fi în tranzit.
    if (body.actiune === "sterge") {
      if (!o.awb) return NextResponse.json({ ok: true, deja: true });
      let rezultat: "sters" | "nu_exista" | "doar_admin";
      if (body.doar_admin === true) {
        rezultat = "doar_admin";
      } else {
        try {
          rezultat = await stergeAwb(o.awb);
        } catch (e) {
          return NextResponse.json({
            ok: false, poate_doar_admin: true,
            eroare: `${e instanceof EroareFan ? e.message : String(e)} AWB-ul NU a fost scos din comandă.`,
          });
        }
      }
      const patch: Record<string, unknown> = { awb: null, awb_generat_la: null, awb_date: null };
      if (o.status === "expediata") patch.status = "confirmata";
      const { data: scrise, error } = await sb.from("orders").update(patch).eq("id", id).select("id");
      if (error || !scrise?.length)
        return NextResponse.json({ ok: false, eroare: `${rezultat === "sters" ? "AWB-ul s-a șters la FAN, dar" : "AWB-ul"} n-a putut fi scos din comandă: ${error?.message ?? "niciun rând actualizat"}` });
      const mesaj = rezultat === "sters" ? `AWB ${o.awb} șters la FAN Courier și din comandă`
        : rezultat === "nu_exista" ? `AWB ${o.awb} scos din comandă (la FAN nu mai exista)`
        : `AWB ${o.awb} scos doar din admin, la cererea operatorului (FAN refuzase ștergerea)`;
      await sb.from("order_events").insert({
        order_id: id, tip: "awb", autor: await autor(req),
        mesaj: mesaj + (patch.status ? " · comanda revine la „confirmată”" : ""),
      });
      return NextResponse.json({ ok: true, rezultat });
    }

    if (body.actiune !== "genereaza") return NextResponse.json({ ok: false, eroare: "Acțiune necunoscută." }, { status: 400 });

    // ---------- verificările de dinainte ----------
    if (o.awb) return NextResponse.json({ ok: false, eroare: `Comanda are deja AWB-ul ${o.awb}. Șterge-l întâi dacă vrei altul.` });
    if (o.status === "anulata") return NextResponse.json({ ok: false, eroare: "Comanda e anulată." });
    // Decizia din 7 august 2026: fără transport stabilit, rambursul de pe AWB ar
    // fi altă sumă decât cea acceptată de client la telefon.
    if (!o.livrare_stabilit_la) return NextResponse.json({ ok: false, eroare: "Stabilește întâi costul livrării și confirmă-l cu clientul." });

    const c = body.colet ?? {};
    const colet = {
      colete: Math.round(nr(c.colete)), greutate: nr(c.greutate),
      lungime: dim(c.lungime), latime: dim(c.latime), inaltime: dim(c.inaltime),
      ramburs: nr(c.ramburs), continut: String(c.continut ?? "").trim(), observatii: String(c.observatii ?? "").trim(),
      referinta: o.numar as string,
    };
    const lipsa: string[] = [];
    if (!(colet.colete >= 1)) lipsa.push("numărul de colete");
    if (!(colet.greutate > 0)) lipsa.push("greutatea");
    // Dimensiunile sunt opționale (16 septembrie 2026), dar ori toate trei, ori niciuna.
    if (dimensiuniPartiale(colet)) lipsa.push("toate cele trei dimensiuni (sau lasă-le pe toate goale)");
    if (!(colet.ramburs >= 0)) lipsa.push("rambursul (0 dacă nu e cazul)");
    if (lipsa.length) return NextResponse.json({ ok: false, eroare: `Completează ${lipsa.join(", ")}.` });

    const d = body.destinatar ?? {};
    const dest = {
      nume: (o.firma || o.nume) as string,
      persoana_contact: o.firma ? o.nume as string : null,
      email: o.email as string,
      telefon: String(d.telefon ?? o.telefon).trim(),
      judet: String(d.judet ?? o.judet).trim(),
      localitate: String(d.localitate ?? o.oras).trim(),
      strada: String(d.strada ?? o.adresa).trim(),
    };

    const r = await genereazaAwb(dest, colet);

    const awb_date = {
      colete: colet.colete, greutate: colet.greutate, lungime: colet.lungime, latime: colet.latime, inaltime: colet.inaltime,
      ramburs: colet.ramburs, serviciu: r.serviciu, tarif: r.tarif, tva: r.tva, tracking: r.tracking,
      destinatar: { telefon: dest.telefon, judet: dest.judet, localitate: dest.localitate, strada: dest.strada },
    };
    const { error } = await sb.from("orders")
      .update({ awb: r.awb, awb_generat_la: new Date().toISOString(), awb_date }).eq("id", id);
    if (error) {
      // AWB-ul EXISTĂ la FAN. Nu-l pierdem: îl arătăm, ca să poată fi scris de mână.
      return NextResponse.json({ ok: false, awb: r.awb,
        eroare: `FAN a generat AWB-ul ${r.awb}, dar nu s-a putut salva în comandă (${error.message}). Scrie-l de mână în câmpul de AWB.` });
    }
    await sb.from("order_events").insert({
      order_id: id, tip: "awb", autor: await autor(req),
      mesaj: `AWB ${r.awb} generat la FAN Courier · ${colet.colete} colet(e), ${colet.greutate} kg${areDimensiuni(colet) ? `, ${colet.lungime}×${colet.latime}×${colet.inaltime} cm` : ", fără dimensiuni"} · ramburs ${colet.ramburs} lei`,
    });
    return NextResponse.json({ ok: true, awb: r.awb, tarif: r.tarif, tva: r.tva, tracking: r.tracking });
  } catch (e) {
    return eroare(e);
  }
}

/** Eticheta PDF. Browserul o cere cu token-ul în antet și o deschide ca fișier. */
export async function GET(req: Request) {
  if (!(await esteEchipa(req))) return nuAi();
  const sb = sbAdmin();
  const id = Number(new URL(req.url).searchParams.get("comanda_id"));
  const { data: o } = sb ? await sb.from("orders").select("awb,numar").eq("id", id).maybeSingle() : { data: null };
  if (!o?.awb) return NextResponse.json({ ok: false, eroare: "Comanda n-are AWB." }, { status: 404 });
  try {
    const pdf = await etichetaAwb(o.awb);
    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="AWB-${o.awb}-${o.numar}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, eroare: e instanceof EroareFan ? e.message : String(e) }, { status: 502 });
  }
}
