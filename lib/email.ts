// ============================================================
// E-MAILURILE AUTOMATE — un singur loc din care pleacă orice mesaj.
//
// Aceeași regulă ca la `ev()` din lib/analytics.ts: paginile și rutele nu știu
// de furnizor. Dacă mâine se schimbă Brevo cu altceva, se rescrie `trimite()` și
// atât — șabloanele și regulile de conținut rămân neatinse.
//
// CE NU SCRIE NICIODATĂ ÎN E-MAIL
// Costul livrării. Rămâne decizia din 7 august 2026: transportul se stabilește
// DUPĂ comandă, din greutatea și gabaritul reale, și se comunică la telefon.
// Un e-mail automat care ar inventa un cost ar contrazice prima ta convorbire cu
// clientul, iar clientul l-ar crede pe el, nu pe tine. Confirmarea spune exact
// ce spune azi mesajul de WhatsApp: piesele, totalul lor, și că urmează un
// telefon pentru transport.
//
// DE UNDE VIN ADRESELE
// Expeditorul e `settings.firma.email` (contact@autopas-dezmembrari.ro), sursa
// unică folosită și în cele 8 documente legale. Adresa pe care ajung
// notificările interne se pune din Admin → Integrări; nu e scrisă în cod, ca
// nicio altă dată reală a firmei.
// ============================================================
import { sbAdmin } from "./supabase";
import { FIRMA_IMPLICITA } from "./settings";
import { SITE_URL } from "./config";

/** Ce știe ruta să trimită. `catre` gol înseamnă „nu avem adresă" — rândul se
 *  închide ca trimis, fără să fie o eroare: un client care comandă la telefon
 *  n-are e-mail, iar formularul de piesă cere doar telefonul. */
export type Mesaj = {
  catre: string;
  subiect: string;
  html: string;
  text: string;
  /** Pe notificarea internă e adresa CLIENTULUI: apeși „Reply" în Yahoo și îi
   *  scrii lui, nu ție. Fără asta ar trebui să copiezi adresa de mână. */
  replyTo?: string;
};

export type ConfigEmail = {
  cheie?: string;          // cheia API Brevo
  expeditor?: string;      // adresa „De la"; implicit settings.firma.email
  nume_expeditor?: string; // numele afișat
  notificari?: string;     // unde ajung notificările interne (pieseneamt@yahoo.ro)
  webhook_url?: string;
  webhook_secret?: string;
  activ?: boolean;
};

// ------------------------------------------------------------
// TRIMITEREA
// ------------------------------------------------------------

/**
 * Trimite prin API-ul Brevo. Întoarce eroarea ca text, niciodată nu aruncă:
 * cine cheamă funcția asta golește o coadă și trebuie să treacă mai departe la
 * rândul următor, nu să se oprească la primul refuz.
 *
 * Brevo e ales pentru că serverele lui sunt în UE (Franța), ceea ce scurtează
 * mult ce trebuie declarat în politica de confidențialitate — vezi lib/legal.ts.
 */
export async function trimite(m: Mesaj, cfg: ConfigEmail): Promise<{ ok: boolean; eroare?: string }> {
  if (!cfg.cheie) return { ok: false, eroare: "Lipsește cheia API a furnizorului de e-mail (Admin → Integrări)." };
  if (!m.catre) return { ok: false, eroare: "Destinatar gol." };

  const expeditor = cfg.expeditor || FIRMA_IMPLICITA.email;
  try {
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": cfg.cheie, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { email: expeditor, name: cfg.nume_expeditor || "AUTOPAS Dezmembrări" },
        to: [{ email: m.catre }],
        subject: m.subiect,
        htmlContent: m.html,
        textContent: m.text,
        ...(m.replyTo ? { replyTo: { email: m.replyTo } } : {}),
      }),
    });
    if (!r.ok) {
      const corp = await r.text().catch(() => "");
      return { ok: false, eroare: `Brevo a răspuns ${r.status}: ${corp.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, eroare: `Nu s-a putut contacta furnizorul: ${e?.message ?? e}` };
  }
}

// ------------------------------------------------------------
// ȘABLOANELE
//
// HTML scris cu tabele și stiluri în atribut, nu cu clase și flexbox: Outlook
// și aplicația Yahoo ignoră `<style>` din `<head>` și nu știu flex. Arată sărac
// în cod, dar e singurul fel în care iese la fel peste tot.
//
// Fiecare mesaj are ȘI variantă text. Fără ea, filtrele antispam cresc scorul,
// iar un mesaj de confirmare a comenzii ajuns la Spam e mai rău decât unul
// netrimis: clientul crede că nu i-ai răspuns.
// ------------------------------------------------------------

const GALBEN = "#F2B705";
const INCHIS = "#101010";

function lei(n: number) {
  return `${new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 }).format(Number(n) || 0)} lei`;
}

/** Scapă textul care vine din baza de date înainte să intre în HTML. Numele și
 *  mesajele sunt scrise de clienți, deci sunt date, nu markup. */
function esc(s: unknown) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function invelis(titlu: string, corp: string, subsol: string) {
  return `<!doctype html><html lang="ro"><body style="margin:0;padding:24px 12px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:${INCHIS}">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden">
  <tr><td style="background:${INCHIS};padding:20px 24px">
    <span style="color:${GALBEN};font-size:18px;font-weight:bold;letter-spacing:.5px">AUTOPAS DEZMEMBRĂRI</span>
  </td></tr>
  <tr><td style="padding:24px">
    <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">${esc(titlu)}</h1>
    ${corp}
  </td></tr>
  <tr><td style="padding:16px 24px;background:#fafafa;border-top:1px solid #e5e5e5;font-size:12px;color:#666;line-height:1.6">
    ${subsol}
  </td></tr>
</table></body></html>`;
}

function subsolFirma(firma: { denumire: string; adresa: string; telefon: string; email: string }) {
  return `${esc(firma.denumire)} · ${esc(firma.adresa)}<br>
Telefon ${esc(firma.telefon)} · <a href="mailto:${esc(firma.email)}" style="color:#666">${esc(firma.email)}</a><br>
<a href="${SITE_URL || "https://autopas-dezmembrari.ro"}" style="color:#666">autopas-dezmembrari.ro</a>`;
}

function tabelPiese(items: { nume: string; pret: number; cantitate: number }[]) {
  const randuri = items.map((i) => `<tr>
    <td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px">${esc(i.nume)}${i.cantitate > 1 ? ` × ${i.cantitate}` : ""}</td>
    <td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;text-align:right;white-space:nowrap">${lei(Number(i.pret) * i.cantitate)}</td>
  </tr>`).join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:16px 0">${randuri}</table>`;
}

// ------------------------------------------------------------
// CONSTRUIREA UNUI MESAJ, DUPĂ TIPUL DIN COADĂ
// ------------------------------------------------------------

type Firma = typeof FIRMA_IMPLICITA;

async function iaFirma(): Promise<Firma> {
  const sb = sbAdmin();
  if (!sb) return FIRMA_IMPLICITA;
  const { data } = await sb.from("settings").select("valoare").eq("cheie", "firma").maybeSingle();
  return { ...FIRMA_IMPLICITA, ...((data?.valoare as Partial<Firma>) ?? {}) };
}

/** Textul comun pentru orice cerere venită dintr-un formular. Un singur loc:
 *  cele patru formulare promit același lucru, deci trebuie să spună la fel. */
function confirmareCerere(
  titlu: string, nume: string, detalii: [string, string][], firma: Firma,
): { subiect: string; html: string; text: string } {
  const linii = detalii.filter(([, v]) => v && v.trim() !== "");
  const html = invelis(titlu,
    `<p style="font-size:15px;line-height:1.6">Bună, ${esc(nume)},</p>
     <p style="font-size:15px;line-height:1.6">Am primit cererea ta și o verificăm. Îți răspundem în cel mai scurt timp, de obicei în aceeași zi lucrătoare.</p>
     <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:16px 0">
     ${linii.map(([k, v]) => `<tr>
        <td style="padding:6px 12px 6px 0;font-size:13px;color:#666;vertical-align:top;white-space:nowrap">${esc(k)}</td>
        <td style="padding:6px 0;font-size:14px">${esc(v)}</td></tr>`).join("")}
     </table>
     <p style="font-size:14px;line-height:1.6;color:#444">Dacă între timp vrei să ne spui ceva, răspunde la acest mesaj sau sună-ne la ${esc(firma.telefon)}.</p>`,
    subsolFirma(firma));
  const text = `Bună, ${nume},\n\nAm primit cererea ta și o verificăm. Îți răspundem în cel mai scurt timp, de obicei în aceeași zi lucrătoare.\n\n`
    + linii.map(([k, v]) => `${k}: ${v}`).join("\n")
    + `\n\nDacă vrei să ne spui ceva, răspunde la acest mesaj sau sună-ne la ${firma.telefon}.\n\n${firma.denumire}\n${firma.adresa}`;
  return { subiect: titlu, html, text };
}

/**
 * Citește din bază tot ce trebuie și compune mesajul.
 *
 * Întoarce `null` când n-are ce trimite — cel mai des fiindcă rândul n-are
 * adresă de e-mail (formularul de piesă cere doar telefonul). Ruta tratează
 * `null` ca „gata, nimic de făcut", nu ca eroare.
 */
export async function construieste(tip: string, referintaId: number, cfg: ConfigEmail): Promise<Mesaj | null> {
  const sb = sbAdmin();
  if (!sb) return null;
  const firma = await iaFirma();

  if (tip === "comanda_client" || tip === "comanda_echipa") {
    const { data: c } = await sb.from("orders").select("*").eq("id", referintaId).maybeSingle();
    if (!c) return null;
    const { data: linii } = await sb.from("order_items").select("nume,pret,cantitate").eq("order_id", referintaId);
    const items = (linii ?? []) as { nume: string; pret: number; cantitate: number }[];
    const numar = String((c as any).numar ?? "");

    if (tip === "comanda_client") {
      const email = String((c as any).email ?? "").trim();
      if (!email) return null;
      const html = invelis(`Comanda ${numar} a fost înregistrată`,
        `<p style="font-size:15px;line-height:1.6">Bună, ${esc((c as any).nume)},</p>
         <p style="font-size:15px;line-height:1.6">Îți mulțumim pentru comandă. Am înregistrat-o cu numărul <b>${esc(numar)}</b> și o pregătim.</p>
         ${tabelPiese(items)}
         <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
           <tr><td style="font-size:15px;padding-top:4px"><b>Total piese</b></td>
               <td style="font-size:15px;text-align:right;padding-top:4px"><b>${lei(Number((c as any).total))}</b></td></tr>
         </table>
         <!-- Blocul ăsta e obligatoriu. Fără el, clientul crede că totalul de mai
              sus e suma finală și se supără la telefon. -->
         <div style="margin:20px 0;padding:14px 16px;background:#fffbeb;border-left:4px solid ${GALBEN};font-size:14px;line-height:1.6">
           <b>Transportul nu e inclus în suma de mai sus.</b> Piesele auto diferă mult ca greutate și gabarit,
           așa că îl calculăm după ce cântărim și măsurăm coletul. Te sunăm la ${esc((c as any).telefon)} ca să ți-l
           comunicăm înainte de expediere — nu se expediază nimic până nu ești de acord.
         </div>
         <p style="font-size:14px;line-height:1.6;color:#444">Livrare la: ${esc((c as any).adresa)}, ${esc((c as any).oras)}, ${esc((c as any).judet)}.<br>
         Plată: ${esc((c as any).plata)}.</p>
         <p style="font-size:14px;line-height:1.6;color:#444">Ai întrebări? Răspunde la acest mesaj sau sună-ne la ${esc(firma.telefon)}.</p>`,
        subsolFirma(firma));
      const text = `Bună, ${(c as any).nume},\n\nÎți mulțumim pentru comandă. Am înregistrat-o cu numărul ${numar}.\n\n`
        + items.map((i) => `- ${i.nume}${i.cantitate > 1 ? ` x${i.cantitate}` : ""}: ${lei(Number(i.pret) * i.cantitate)}`).join("\n")
        + `\n\nTotal piese: ${lei(Number((c as any).total))}\n\n`
        + `TRANSPORTUL NU E INCLUS în suma de mai sus. Piesele auto diferă mult ca greutate și gabarit, `
        + `așa că îl calculăm după ce cântărim coletul și te sunăm la ${(c as any).telefon} ca să ți-l comunicăm `
        + `înainte de expediere.\n\nLivrare la: ${(c as any).adresa}, ${(c as any).oras}, ${(c as any).judet}\n`
        + `Plată: ${(c as any).plata}\n\n${firma.denumire}\n${firma.adresa}\nTelefon ${firma.telefon}`;
      return { catre: email, subiect: `Comanda ${numar} a fost înregistrată · AUTOPAS`, html, text };
    }

    // Notificarea internă. Scurtă și cu tot ce trebuie ca să poți suna imediat.
    const catre = (cfg.notificari ?? "").trim();
    if (!catre) return null;
    const html = invelis(`Comandă nouă: ${numar}`,
      `<p style="font-size:15px;line-height:1.6"><b>${esc((c as any).nume)}</b> · ${esc((c as any).telefon)}${(c as any).email ? ` · ${esc((c as any).email)}` : ""}</p>
       ${tabelPiese(items)}
       <p style="font-size:16px"><b>Total piese: ${lei(Number((c as any).total))}</b> · plată: ${esc((c as any).plata)}</p>
       <p style="font-size:14px;line-height:1.6">Livrare: ${esc((c as any).adresa)}, ${esc((c as any).oras)}, ${esc((c as any).judet)}</p>
       <p style="font-size:14px;line-height:1.6;color:#444">Transportul nu e calculat încă — se completează în panou, la comandă.</p>
       <p style="margin-top:20px"><a href="${SITE_URL || "https://autopas-dezmembrari.ro"}/admin/comenzi"
          style="display:inline-block;background:${GALBEN};color:${INCHIS};text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px;font-size:15px">Deschide comanda în panou</a></p>`,
      `Poți răspunde direct la acest mesaj — ajunge la client, nu la tine.`);
    const text = `Comandă nouă: ${numar}\n\n${(c as any).nume} · ${(c as any).telefon}${(c as any).email ? ` · ${(c as any).email}` : ""}\n\n`
      + items.map((i) => `- ${i.nume}${i.cantitate > 1 ? ` x${i.cantitate}` : ""}: ${lei(Number(i.pret) * i.cantitate)}`).join("\n")
      + `\n\nTotal piese: ${lei(Number((c as any).total))} · plată: ${(c as any).plata}\n`
      + `Livrare: ${(c as any).adresa}, ${(c as any).oras}, ${(c as any).judet}\n\n`
      + `Transportul nu e calculat încă.\n${SITE_URL || "https://autopas-dezmembrari.ro"}/admin/comenzi`;
    return {
      catre,
      subiect: `Comandă nouă ${numar} · ${lei(Number((c as any).total))}`,
      html, text,
      // Reply-To pe adresa clientului: apeși „Reply" în Yahoo și îi scrii lui.
      replyTo: String((c as any).email ?? "").trim() || undefined,
    };
  }

  if (tip === "part_requests") {
    const { data: r } = await sb.from("part_requests").select("*").eq("id", referintaId).maybeSingle();
    if (!r) return null;
    const email = String((r as any).email ?? "").trim();
    if (!email) return null;
    const m = confirmareCerere("Am primit cererea ta de piesă", String((r as any).nume), [
      ["Mașina", String((r as any).masina ?? "")],
      ["Piesa căutată", String((r as any).piesa ?? "")],
      ["Detalii", String((r as any).mesaj ?? "")],
    ], firma);
    return { catre: email, subiect: `${m.subiect} · AUTOPAS`, html: m.html, text: m.text };
  }

  if (tip === "car_intake_requests") {
    const { data: r } = await sb.from("car_intake_requests").select("*").eq("id", referintaId).maybeSingle();
    if (!r) return null;
    const email = String((r as any).email ?? "").trim();
    if (!email) return null;
    const m = confirmareCerere("Am primit oferta ta de mașină", String((r as any).nume), [
      ["Mașina", String((r as any).masina ?? "")],
      ["An", (r as any).an ? String((r as any).an) : ""],
      ["Detalii", String((r as any).mesaj ?? "")],
    ], firma);
    return { catre: email, subiect: `${m.subiect} · AUTOPAS`, html: m.html, text: m.text };
  }

  if (tip === "return_requests") {
    const { data: r } = await sb.from("return_requests").select("*").eq("id", referintaId).maybeSingle();
    if (!r) return null;
    const email = String((r as any).email ?? "").trim();
    if (!email) return null;
    const m = confirmareCerere("Am primit cererea ta de retur", String((r as any).nume), [
      ["Comanda", String((r as any).numar_comanda ?? "")],
      ["Produsul", String((r as any).produs ?? "")],
      ["Motivul", String((r as any).motiv ?? "")],
    ], firma);
    return { catre: email, subiect: `${m.subiect} · AUTOPAS`, html: m.html, text: m.text };
  }

  if (tip === "contact_messages") {
    const { data: r } = await sb.from("contact_messages").select("*").eq("id", referintaId).maybeSingle();
    if (!r) return null;
    const email = String((r as any).email ?? "").trim();
    if (!email) return null;
    const m = confirmareCerere("Am primit mesajul tău", String((r as any).nume), [
      ["Mesajul tău", String((r as any).mesaj ?? "")],
    ], firma);
    return { catre: email, subiect: `${m.subiect} · AUTOPAS`, html: m.html, text: m.text };
  }

  return null;
}

/** Mesajul de test din Admin → Integrări. Trece prin ACELAȘI drum ca restul —
 *  aceeași funcție `trimite`, aceeași cheie, același expeditor — altfel un test
 *  care trece n-ar dovedi nimic despre e-mailurile adevărate. */
export async function mesajDeTest(catre: string): Promise<Mesaj> {
  const firma = await iaFirma();
  const html = invelis("Test reușit",
    `<p style="font-size:15px;line-height:1.6">Dacă citești mesajul ăsta, trimiterea automată de e-mailuri funcționează.</p>
     <p style="font-size:14px;line-height:1.6;color:#444">A plecat de la <b>${esc(firma.email)}</b>, prin furnizorul configurat în Admin → Integrări.</p>
     <p style="font-size:14px;line-height:1.6;color:#444">Verifică și că nu a ajuns la Spam. Dacă a ajuns, mai lipsește o înregistrare DNS (SPF, DKIM sau DMARC).</p>`,
    subsolFirma(firma));
  return {
    catre,
    subiect: "Test AUTOPAS — trimiterea automată funcționează",
    html,
    text: "Dacă citești mesajul ăsta, trimiterea automată de e-mailuri funcționează.\n\n"
      + `A plecat de la ${firma.email}, prin furnizorul configurat în Admin → Integrări.\n`
      + "Verifică și că nu a ajuns la Spam. Dacă a ajuns, mai lipsește o înregistrare DNS (SPF, DKIM sau DMARC).",
  };
}
