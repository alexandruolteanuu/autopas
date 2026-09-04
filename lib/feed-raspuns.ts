// ============================================================
// RĂSPUNSUL UNUI FEED — antetele, cache-ul și paza, într-un singur loc
//
// Cele patru rute de feed diferă doar prin format. Tot ce ține de „cum se
// livrează" — cât stă în cache, dacă are voie să fie indexat, cine îl poate
// citi — e identic și trebuie să rămână identic, altfel o rută uitată devine
// singura prin care se scurge catalogul.
// ============================================================
import { NextResponse } from "next/server";
import { CACHE_FEED_SECUNDE, INVECHIRE_ACCEPTATA_SECUNDE } from "./feed";

/**
 * Parolă opțională pentru feed-uri (`FEED_TOKEN` în Vercel).
 *
 * IMPLICIT E GOALĂ, adică feed-urile sunt publice — și trebuie să fie: Google
 * Merchant Center și Meta le citesc cu roboți care nu se pot autentifica altfel
 * decât printr-un token pus în adresă. Prețurile și stocul sunt oricum publice,
 * pagină cu pagină.
 *
 * Cine vrea totuși să nu-și lase tot catalogul la îndemâna unui concurent care
 * îl ia dintr-o singură cerere pune un token în Vercel și îl adaugă în adresa
 * dată platformelor: `…/feed/google.xml?token=SECRET`. Panoul afișează adresele
 * cu tokenul deja pus.
 */
export const FEED_TOKEN = process.env.FEED_TOKEN ?? "";

/** `true` dacă cererea are voie. Fără token configurat, oricine are voie. */
export function areVoie(req: Request) {
  if (!FEED_TOKEN) return true;
  const t = new URL(req.url).searchParams.get("token") ?? "";
  return t === FEED_TOKEN;
}

export const refuz = () =>
  new NextResponse("Feed protejat. Adaugă ?token=… în adresă.", {
    status: 401,
    headers: { "content-type": "text/plain; charset=utf-8", "x-robots-tag": "noindex" },
  });

/**
 * Răspunsul propriu-zis, TRIMIS ÎN FLUX.
 *
 * DE CE ÎN FLUX, ȘI NU CA UN ȘIR
 * Feed-ul Google măsurat pe catalogul real (8.803 produse, 4 septembrie 2026)
 * are **25,8 MB**. O funcție Vercel care întoarce un corp construit în memorie
 * are plafon de 4,5 MB și pică cu `FUNCTION_PAYLOAD_TOO_LARGE` — un 500 sec, pe
 * care Merchant Center îl raportează drept „feed inaccesibil". Local, unde
 * plafonul nu există, totul ar fi arătat perfect.
 *
 * Cu un `ReadableStream`, corpul pleacă pe măsură ce se generează și plafonul nu
 * se mai aplică. Bucățile se grupează câte 200 (o bucată = un produs), ca să nu
 * facem 8.803 scrieri în rețea pentru un fișier.
 *
 * Antetele:
 *
 * CACHE: `s-maxage` e cache-ul CDN-ului Vercel, nu al browserului — de acolo
 * vine „se actualizează la câteva ore". `max-age=0` ține browserul departe de o
 * copie veche când operatorul deschide adresa ca să verifice. Iar
 * `stale-while-revalidate` face ca exact cererea care nimerește expirarea să
 * primească instantaneu varianta veche, în timp ce cea nouă se generează în
 * fundal: fără el, robotul Google ar fi cel care așteaptă cele câteva secunde de
 * citire a catalogului, și ar putea renunța.
 *
 * `X-Robots-Tag: noindex` — feed-ul NU e o pagină și n-are ce căuta în
 * rezultatele căutării. Atenție: asta e altceva decât a-l bloca din robots.txt.
 * Blocat în robots.txt, Google nu l-ar putea nici CITI, iar Merchant Center ar
 * raporta „feed inaccesibil" (vezi comentariul din app/robots.ts).
 */
/** Câte produse se strâng înainte de a fi trimise. Un compromis între numărul de
 *  scrieri în rețea și memoria ținută deodată. */
const BUCATI_PE_PACHET = 200;

export function raspunsFeed(bucati: string[], tip: string, fisier: string) {
  const codor = new TextEncoder();
  let i = 0;
  const flux = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i >= bucati.length) { controller.close(); return; }
      const pana = Math.min(i + BUCATI_PE_PACHET, bucati.length);
      controller.enqueue(codor.encode(bucati.slice(i, pana).join("")));
      i = pana;
    },
  });

  return new NextResponse(flux, {
    headers: {
      "content-type": `${tip}; charset=utf-8`,
      "cache-control":
        `public, max-age=0, s-maxage=${CACHE_FEED_SECUNDE}, stale-while-revalidate=${INVECHIRE_ACCEPTATA_SECUNDE}`,
      "x-robots-tag": "noindex",
      // `inline`, nu `attachment`: operatorul trebuie să-l poată deschide în
      // browser ca să vadă ce trimite, nu să descarce un fișier de fiecare dată.
      "content-disposition": `inline; filename="${fisier}"`,
    },
  });
}
