// ============================================================
// SINCRONIZAREA AUTOMATĂ CU dez.ro — /api/dezro-coada
//
// Cine o cheamă:
//   1. baza de date, prin triggerele din supabase/dezro-automat.sql, imediat ce
//      o piesă e adăugată, modificată, vândută sau ștearsă. Se legitimează cu
//      secretul din `settings.integrari.dezro.webhook_secret`;
//   2. ea însăși, cât timp mai are de lucru (vezi „ÎNLĂNȚUIREA" mai jos);
//   3. un om din echipă, din Admin → Anunțuri dez.ro, ca să golească ce a rămas
//      blocat. Se legitimează cu token-ul sesiunii, ca ruta de AWB.
//
// Nicio regulă despre dez.ro nu se scrie aici. Ce se trimite, ce se sare și ce
// se retrage stă în `lib/dezro/` (vezi lib/dezro/README.md) — aici e doar
// orchestrarea: cine are voie, un lot, ce se șterge din coadă, cine se trezește
// mai departe.
//
// ÎNLĂNȚUIREA
// Un lot încape în 60 de secunde, deci golește ~25 de rânduri. La un import de
// mii de piese, coada are nevoie de sute de loturi. La final ruta cheamă
// `dezro_deblocheaza()` (pune ora ultimei treziri în trecut) și ABIA APOI
// recitește coada; dacă a mai rămas ceva, se trezește singură. Ordinea asta e ce
// închide cursa dintre „lotul tocmai s-a terminat" și „a mai intrat o
// modificare": orice trigger de după deblocare bate singur la ușă, iar orice
// trigger dinainte și-a lăsat rândul în coadă, unde recitirea îl vede.
//
// Nu întoarce niciodată 500 pentru un anunț care n-a plecat. Eșecul se scrie pe
// rândul din coadă (`incercari`, `eroare`) și se trece la următorul: baza de
// date n-are ce face cu un 500, iar un rând neîncercat e mai rău decât unul
// încercat de trei ori.
// ============================================================
import { NextResponse } from "next/server";
import { esteEchipa } from "@/lib/supabase";
import {
  depozitDinMediu, sesiuneDin, contextPublicare, lotCoada, pragCoada, PRAG_RETRAGERE,
} from "@/lib/dezro/index.mjs";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Câte rânduri ia un lot. Peste atât n-ar apuca oricum: bugetul motorului e de
 *  20 de secunde, iar o piesă cu poze noi poate ține câteva. */
const PE_LOT = 25;
/** După atâtea eșecuri rândul se lasă în pace, cu eroarea la vedere. O categorie
 *  nemapată la ei nu se repară singură, iar reîncercarea la infinit ar ține
 *  coada plină și ar ascunde restul. Aceeași valoare ca în `coadaCiteste`. */
const MAX_INCERCARI = 5;

const ok = (date: any) => NextResponse.json({ ok: true, ...date });

export async function POST(req: Request) {
  let depozit: any;
  try { depozit = depozitDinMediu(); }
  catch (e: any) { return NextResponse.json({ ok: false, eroare: e.message }, { status: 500 }); }

  const cfg = await depozit.citesteConfig().catch(() => null);
  if (!cfg) return NextResponse.json({ ok: false, eroare: "Nu s-au putut citi setările." }, { status: 500 });

  // ---- cine cere ----
  const secret = req.headers.get("x-autopas-dezro") ?? "";
  const dinBaza = !!cfg.webhook_secret && secret === cfg.webhook_secret;
  const dinPanou = dinBaza ? false : await esteEchipa(req);
  if (!dinBaza && !dinPanou) return NextResponse.json({ ok: false, eroare: "Neautorizat." }, { status: 401 });

  let corp: { confirmatPrag?: boolean } = {};
  try { corp = await req.json(); } catch { /* corp gol = golire simplă */ }

  // ---- integrarea oprită sau neconfigurată ----
  // Coada rămâne pe loc; nu se pierde nimic. Rândurile pleacă la prima trezire de
  // după pornire. Nu e o eroare: e starea normală înainte de configurare.
  if (cfg.activ === false || !cfg.cheie || !cfg.utilizator || !cfg.parola) {
    return ok({ facute: 0, nota: "Integrarea dez.ro e oprită sau neconfigurată; coada rămâne neatinsă." });
  }

  // ---- o publicare mare în lucru ----
  // Doi scriitori pe aceleași anunțuri ar putea trimite aceeași piesă de două
  // ori, iar la ei un anunț dublat nu se poate uni înapoi. Jobul parcurge oricum
  // tot catalogul, deci face și treaba cozii.
  const job = await depozit.jobActiv().catch(() => null);
  if (job) return ok({ facute: 0, nota: `Publicarea #${job.id} e în lucru; coada așteaptă să se termine.` });

  // ---- plasa de 20% ----
  // Singurul lucru care poate opri o ștergere în masă. Vezi `pragCoada` din
  // motor: aici nu apasă nimeni niciun buton, deci avertismentul trebuie să
  // OPREASCĂ, nu doar să se afișeze.
  const prag = await pragCoada({ depozit });
  if (prag.depasit && !(dinPanou && corp?.confirmatPrag)) {
    const mesaj =
      `S-ar retrage ${prag.total} din ${prag.active} anunțuri (${(prag.procent * 100).toFixed(1)}%, ` +
      `peste pragul de ${PRAG_RETRAGERE * 100}%). Pare o depublicare în masă, nu vânzări. ` +
      `La dez.ro ștergerea NU se poate desface. Confirmă din Admin → Anunțuri dez.ro dacă e corect.`;
    await depozit.salveazaConfig({ coada_mesaj: mesaj, coada_mesaj_la: new Date().toISOString() }).catch(() => null);
    return ok({ facute: 0, cereConfirmare: true, prag, nota: mesaj });
  }

  // ---- lotul ----
  const randuri = await depozit.coadaCiteste(PE_LOT, MAX_INCERCARI);
  if (!randuri.length) {
    await depozit.deblocheazaTrezirea().catch(() => null);
    return ok({ facute: 0, nota: "Coada e goală." });
  }

  const sesiune = sesiuneDin(cfg, depozit);
  const context = await contextPublicare(depozit);
  const rez = await lotCoada({ depozit, sesiune, context, randuri });

  // Rândurile făcute se șterg; cele picate rămân, cu încercarea numărată.
  await depozit.coadaSterge(rez.facute).catch(() => null);
  // Turnarea e necesară fiindcă motorul e `.mjs`: TypeScript deduce tipul din
  // fișierul acela, iar un `erori: []` gol se deduce ca `never[]`.
  type ErCoada = { coada_id: number; eroare: string; incercari: number };
  for (const e of rez.erori as ErCoada[]) {
    await depozit.coadaEsec(e.coada_id, e.eroare, e.incercari).catch(() => null);
  }

  // Mesajul de prag, dacă exista, nu mai are ce căuta după un lot reușit.
  if (cfg.coada_mesaj && !rez.oprit) {
    await depozit.salveazaConfig({ coada_mesaj: null, coada_mesaj_la: null }).catch(() => null);
  }

  // ---- deblocare, apoi înlănțuire ----
  // În ordinea asta, niciodată invers. Vezi antetul.
  await depozit.deblocheazaTrezirea().catch(() => null);
  const stare = await depozit.coadaStare().catch(() => null);
  const maiE = Number(stare?.de_facut) || 0;
  // Se cheamă mai departe DOAR dacă lotul a chiar închis rânduri. Un lot din care
  // n-a ieșit nimic (refuz de la ei, sesiune expirată) s-ar relua la nesfârșit,
  // iar fiecare reluare ar costa o funcție.
  const continua = maiE > 0 && !rez.oprit && rez.facute.length > 0;
  if (continua) await depozit.trezesteAcum().catch(() => null);

  return ok({
    facute: rez.facute.length,
    publicate: rez.publicate, actualizate: rez.actualizate, neschimbate: rez.neschimbate,
    retrase: rez.retrase, sarite: rez.sarite, poze: rez.poze,
    motive: rez.motive,
    erori: rez.erori.length,
    oprit: rez.oprit,
    ramase: maiE,
    continua,
  });
}
