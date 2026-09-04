"use client";
// ============================================================
// GOOGLE ANALYTICS 4 + GOOGLE ADS — încărcate doar când au voie
//
// Un singur script (gtag.js) le servește pe amândouă, dar au voie prin
// consimțăminte DIFERITE:
//   · Analytics pornește la „Doar statistică" sau „Accept toate";
//   · Google Ads pornește DOAR la „Accept toate".
// Deci sunt trei stări reale, nu două: fără nimic, doar măsurare, măsurare +
// reclame. Cine acceptă statistica fără reclame primește gtag.js configurat
// numai pentru GA4, cu `ad_storage: denied` — Google nu are voie să pună atunci
// niciun cookie de publicitate.
//
// Condițiile care se adaugă peste consimțământ, aceleași ca înainte:
//   · există un id configurat în Admin → Integrări (altfel nu se încarcă nimic);
//   · nu suntem în /admin — traficul echipei ar falsifica statisticile și ar
//     învăța algoritmul de licitare pe vizite care nu cumpără niciodată;
//   · nu suntem în dezvoltare.
//
// CONSENT MODE
// `gtag('consent','default', …)` cu tot pe `denied` rulează ÎNAINTE de `config`,
// iar `update` imediat după, cu exact ce a acceptat omul. Scripturile se încarcă
// oricum abia după acceptare, deci semnalul e o a doua plasă — dar e plasa pe
// care o citește Google, și e verificabilă în „DebugView".
//
// La retragerea acordului trimitem `update` cu `denied` și ștergem cookie-urile
// grupului retras. Un script deja încărcat nu se poate „descărca" dintr-o pagină
// vie, dar din acel moment nu mai stochează nimic; la următoarea încărcare a
// paginii nu mai apare deloc.
// ============================================================
import Script from "next/script";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { areVoieStatistica, areVoieMarketing, ascultaConsimtamant, citesteConsimtamant,
         stergeCookieuriMasurare, type Consimtamant } from "@/lib/consimtamant";
import { golesteCoada, seteazaConversiaAds } from "@/lib/analytics";
import { citesteMasuratori, conversieCompleta, type Masuratori } from "@/lib/masuratori";

const GOL: Masuratori = { ga4: "", google_ads: "", ads_conversie: "", meta_pixel: "", meta_domeniu: "" };

export default function Analytics() {
  const cale = usePathname();
  const [acord, setAcord] = useState<Consimtamant>("nesetat");
  const [m, setM] = useState<Masuratori>(GOL);

  // Alegerea se citește după montare (localStorage nu există pe server) și se
  // urmărește în continuare, ca „Accept toate" să pornească măsurarea pe loc,
  // fără reîncărcare.
  useEffect(() => {
    setAcord(citesteConsimtamant());
    return ascultaConsimtamant(setAcord);
  }, []);

  const inAdmin = cale.startsWith("/admin");
  const productie = process.env.NODE_ENV === "production";
  const potStatistica = areVoieStatistica(acord) && !inAdmin && productie;
  const potMarketing = areVoieMarketing(acord) && !inAdmin && productie;

  // Id-urile se cer abia când unul dintre cele două are voie. Pentru cine refuză
  // tot, nici cererea asta nu pleacă.
  useEffect(() => {
    if (!potStatistica && !potMarketing) return;
    let viu = true;
    citesteMasuratori().then((x) => { if (viu) setM(x); });
    return () => { viu = false; };
  }, [potStatistica, potMarketing]);

  const ga4 = potStatistica ? m.ga4 : "";
  const ads = potMarketing ? m.google_ads : "";
  // Id-ul cu care se cere scriptul. gtag.js îl acceptă pe oricare dintre cele
  // două; restul se adaugă cu `config`. Când avem doar Ads (statistică refuzată,
  // reclame acceptate — rar, dar posibil), scriptul vine cu id-ul de Ads.
  const idScript = ga4 || ads;
  const pornit = Boolean(idScript);
  const conversie = potMarketing ? conversieCompleta(m) : "";

  // Eticheta de conversie ajunge în `lib/analytics.ts`, singurul loc care
  // trimite evenimente. Fără ea, `purchase` pleacă la GA4 și la Meta, dar nu și
  // la Google Ads.
  useEffect(() => { seteazaConversiaAds(conversie); }, [conversie]);

  // Retragerea acordului, în doi pași. `consent update: denied` oprește scrierea
  // unor cookie-uri NOI, dar nu le atinge pe cele deja puse. De asta le și
  // ștergem — și doar pe cele ale grupului retras.
  useEffect(() => {
    const faraStatistica = !areVoieStatistica(acord);
    const faraMarketing = !areVoieMarketing(acord);
    if (!faraStatistica && !faraMarketing) return;
    if (typeof window !== "undefined" && typeof window.gtag === "function")
      window.gtag("consent", "update", {
        ...(faraStatistica ? { analytics_storage: "denied" } : {}),
        ...(faraMarketing ? { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" } : {}),
      });
    stergeCookieuriMasurare({ statistica: faraStatistica, marketing: faraMarketing });
  }, [acord]);

  // Golirea cozii de evenimente NU se poate lega de `onReady` al lui next/script:
  // pentru un script inline acela se declanșează la montare, adică ÎNAINTE ca
  // scriptul să fi rulat, iar `gtag` încă nu există — verificat în browser, coada
  // rămânea plină. Așteptăm apariția lui `gtag`, cu un plafon ca să nu învârtim
  // la nesfârșit dacă Google e blocat de un ad-blocker.
  useEffect(() => {
    if (!pornit) return;
    let oprit = false, incercari = 0;
    const asteapta = () => {
      if (oprit) return;
      if (typeof window.gtag === "function") { golesteCoada(); return; }
      if (++incercari > 80) return;            // ~10 secunde, apoi renunțăm
      setTimeout(asteapta, 125);
    };
    asteapta();
    return () => { oprit = true; };
  }, [pornit, conversie]);

  if (!pornit) return null;

  // `ads_data_redaction` cere Google-ului ca, atunci când reclamele NU sunt
  // acceptate, identificatorii din clickurile de reclamă să fie eliminați din
  // adresele trimise. Fără el, un vizitator venit dintr-o reclamă ar fi urmărit
  // prin adresă chiar dacă a refuzat cookie-urile de publicitate.
  const init = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied'
    });
    gtag('set', 'ads_data_redaction', ${potMarketing ? "false" : "true"});
    gtag('consent', 'update', {
      analytics_storage: '${potStatistica ? "granted" : "denied"}',
      ad_storage: '${potMarketing ? "granted" : "denied"}',
      ad_user_data: '${potMarketing ? "granted" : "denied"}',
      ad_personalization: '${potMarketing ? "granted" : "denied"}'
    });
    ${ga4 ? `gtag('config', '${ga4}', { anonymize_ip: true });` : ""}
    ${ads ? `gtag('config', '${ads}');` : ""}
  `;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${idScript}`} strategy="afterInteractive" />
      <Script id="gtag-init" strategy="afterInteractive">{init}</Script>
    </>
  );
}
