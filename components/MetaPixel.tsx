"use client";
// ============================================================
// META PIXEL (Facebook + Instagram) — încărcat doar cu acord de MARKETING
//
// Patru condiții, toate obligatorii. Dacă vreuna cade, în pagină nu ajunge
// NICIUN script și nu pleacă nicio cerere către Meta:
//   1. există un id de pixel în Admin → Integrări;
//   2. vizitatorul a apăsat „Accept toate" — nu „Doar statistică", nu „Doar
//      necesare", și nici starea „încă n-a ales", care se tratează ca refuz;
//   3. nu suntem în /admin;
//   4. nu suntem în dezvoltare.
//
// DE CE E SEPARAT DE `Analytics`
// Pixelul are alt prag de consimțământ (marketing, nu statistică) și alt
// furnizor. Băgate într-o singură componentă, cele două s-ar fi încurcat exact
// la cazul care contează: cine acceptă măsurarea dar refuză reclamele.
//
// PAGEVIEW LA NAVIGARE
// Pixelul trimite `PageView` o dată, la încărcare. Site-ul e o aplicație cu
// navigare fără reîncărcare: fără efectul de mai jos, o vizită de 12 pagini ar
// fi raportată la Meta ca o singură pagină, iar audiențele de remarketing
// („cine a văzut piese de Golf") ar rămâne aproape goale. Același motiv pentru
// care GA4 are nevoie de măsurarea îmbunătățită.
//
// Evenimentele de comerț NU pleacă de aici: pleacă din `lib/analytics.ts`, care
// trimite un singur `ev(...)` către toate instrumentele. Aici doar golim coada
// în momentul în care `fbq` apare în pagină.
// ============================================================
import Script from "next/script";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { areVoieMarketing, ascultaConsimtamant, citesteConsimtamant, type Consimtamant } from "@/lib/consimtamant";
import { golesteCoadaMeta } from "@/lib/analytics";
import { citesteMasuratori } from "@/lib/masuratori";

export default function MetaPixel() {
  const cale = usePathname();
  const [acord, setAcord] = useState<Consimtamant>("nesetat");
  const [id, setId] = useState("");

  useEffect(() => {
    setAcord(citesteConsimtamant());
    return ascultaConsimtamant(setAcord);
  }, []);

  const potCere = areVoieMarketing(acord) && !cale.startsWith("/admin")
    && process.env.NODE_ENV === "production";

  useEffect(() => {
    if (!potCere) return;
    let viu = true;
    citesteMasuratori().then((m) => { if (viu) setId(m.meta_pixel); });
    return () => { viu = false; };
  }, [potCere]);

  const pornit = Boolean(id) && potCere;

  // Aceeași așteptare ca la gtag: `onReady` al lui next/script se declanșează
  // pentru un script inline la MONTARE, adică înainte ca scriptul să fi rulat.
  useEffect(() => {
    if (!pornit) return;
    let oprit = false, incercari = 0;
    const asteapta = () => {
      if (oprit) return;
      if (typeof window.fbq === "function") { golesteCoadaMeta(); return; }
      if (++incercari > 80) return;            // ~10 secunde, apoi renunțăm
      setTimeout(asteapta, 125);
    };
    asteapta();
    return () => { oprit = true; };
  }, [pornit]);

  // Retragerea acordului: `fbq('consent','revoke')` oprește pixelul deja
  // încărcat să mai trimită ceva. Cookie-urile lui (`_fbp`, `_fbc`) le șterge
  // `Analytics`, care se ocupă de toate într-un singur loc.
  useEffect(() => {
    if (areVoieMarketing(acord)) return;
    if (typeof window !== "undefined" && typeof window.fbq === "function")
      window.fbq("consent", "revoke");
  }, [acord]);

  // `PageView` la fiecare schimbare de adresă, DUPĂ prima (aceea o trimite chiar
  // scriptul de inițializare). Fără garda pe `pornit`, efectul ar încerca să
  // trimită și pentru vizitatorii care au refuzat.
  useEffect(() => {
    if (!pornit) return;
    if (typeof window.fbq !== "function") return;   // prima încărcare: o face scriptul
    window.fbq("track", "PageView");
  }, [cale, pornit]);

  if (!pornit) return null;

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">{`
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window,document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('consent', 'grant');
        fbq('init', '${id}');
        fbq('track', 'PageView');
      `}</Script>
      {/* Varianta fără JavaScript. Meta o cere în documentație; e o imagine de
          1×1 care raportează vizita. Apare doar pentru vizitatorii care au
          acceptat reclamele, fiindcă toată componenta apare doar atunci. */}
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img height="1" width="1" style={{ display: "none" }} alt=""
          src={`https://www.facebook.com/tr?id=${id}&ev=PageView&noscript=1`} />
      </noscript>
    </>
  );
}
