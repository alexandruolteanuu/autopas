"use client";
// ============================================================
// GOOGLE ANALYTICS 4 — încărcat doar când are voie
//
// Patru condiții, toate obligatorii. Dacă vreuna cade, în pagină nu ajunge
// NICIUN script și nu pleacă nicio cerere către Google:
//
//   1. există un ID de măsurare în Admin → Integrări (`ga4_public()`);
//   2. vizitatorul a apăsat „Accept toate" — nu „Doar necesare", și nici
//      starea „încă n-a ales", care se tratează ca refuz;
//   3. nu suntem în /admin — traficul echipei ar falsifica statisticile;
//   4. nu suntem în dezvoltare.
//
// CONSIMȚĂMÂNT
// Scriptul se încarcă abia după acceptare, deci teoretic n-ar mai fi nevoie de
// `consent mode`. Îl punem oricând: `default` cu `analytics_storage: denied`
// rulează ÎNAINTE de `config`, iar `update` imediat după. Așa, dacă Google
// schimbă vreodată comportamentul implicit al lui gtag.js, semnalul nostru
// rămâne explicit și verificabil în „DebugView".
//
// La retragerea acordului („Doar necesare" din Setări cookie-uri) trimitem un
// `update` cu `denied` și oprim trimiterea evenimentelor. Scriptul deja încărcat
// nu se poate „descărca" dintr-o pagină vie, dar din acel moment nu mai
// stochează nimic și nu mai primește evenimente; la următoarea încărcare a
// paginii nu mai apare deloc.
// ============================================================
import Script from "next/script";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { areVoieStatistica, ascultaConsimtamant, citesteConsimtamant, stergeCookieuriGa,
         type Consimtamant } from "@/lib/consimtamant";
import { golesteCoada } from "@/lib/analytics";
import { sbBrowser } from "@/lib/supabase";

export default function Analytics() {
  const cale = usePathname();
  const [acord, setAcord] = useState<Consimtamant>("nesetat");
  const [id, setId] = useState("");

  // Alegerea se citește după montare (localStorage nu există pe server) și se
  // urmărește în continuare, ca „Accept toate" să pornească măsurarea pe loc,
  // fără reîncărcare.
  useEffect(() => {
    setAcord(citesteConsimtamant());
    return ascultaConsimtamant(setAcord);
  }, []);

  // ID-ul se cere din browser, nu prin propsuri de la layout.
  //
  // Motivul e măsurat, nu teoretic: `/cos`, `/checkout` și `/favorite` sunt pagini
  // STATICE, iar tot ce randează layout-ul pentru ele — inclusiv un ID venit pe
  // props — rămâne prins în HTML-ul generat la build. Rezultatul era că
  // analytics-ul pornea pe paginile dinamice și tăcea exact pe cele unde se
  // întâmplă vânzarea. Verificat în browser: `/piese` avea scriptul, `/cos` nu.
  //
  // Cererea pleacă DOAR după ce vizitatorul a acceptat statistica, deci pentru cine
  // refuză nu se întâmplă nimic în plus. `ga4_public()` întoarce exclusiv id-ul.
  const potCere = areVoieStatistica(acord) && !cale.startsWith("/admin")
    && process.env.NODE_ENV === "production";
  useEffect(() => {
    if (!potCere || id) return;
    let viu = true;
    const sb = sbBrowser();
    if (!sb) return;
    sb.rpc("ga4_public").then(({ data }) => { if (viu && typeof data === "string") setId(data); });
    return () => { viu = false; };
  }, [potCere, id]);

  const pornit = Boolean(id) && areVoieStatistica(acord)
    && !cale.startsWith("/admin")
    && process.env.NODE_ENV === "production";

  // Retragerea acordului, în doi pași. `consent update: denied` oprește scrierea
  // unor cookie-uri NOI, dar nu le atinge pe cele deja puse — acelea au 2 ani.
  // De asta le și ștergem: altfel omul ar apăsa „oprește statistica" și ar găsi
  // cookie-urile în browser peste o lună.
  useEffect(() => {
    if (areVoieStatistica(acord)) return;
    if (typeof window !== "undefined" && typeof window.gtag === "function")
      window.gtag("consent", "update", { analytics_storage: "denied" });
    stergeCookieuriGa();
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
  }, [pornit]);

  if (!pornit) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">{`
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
        gtag('consent', 'update', { analytics_storage: 'granted' });
        gtag('config', '${id}', { anonymize_ip: true });
      `}</Script>
    </>
  );
}
