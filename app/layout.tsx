import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import SiteChrome from "@/components/SiteChrome";
import { CartProvider } from "@/components/CartContext";
import { FavoritesProvider } from "@/components/FavoritesContext";
import { CONFIG, SITE_URL } from "@/lib/config";
import { getSetariServer, getVacanta } from "@/lib/settings";

// Fontul Poppins (local) — un singur font, patru grosimi, diacritice românești garantate.
const poppins = localFont({
  src: [
    { path: "./fonts/Poppins-Regular.ttf", weight: "400" },
    { path: "./fonts/Poppins-Medium.ttf", weight: "500" },
    { path: "./fonts/Poppins-SemiBold.ttf", weight: "600" },
    { path: "./fonts/Poppins-Bold.ttf", weight: "700" },
  ],
  variable: "--font-poppins",
});

// Datele firmei (subsol, documente legale) vin din Admin → Setări. Fără linia asta,
// paginile generate static le-ar îngheța la momentul build-ului, iar o modificare
// făcută în admin s-ar vedea abia la următorul deploy. Cu revalidare la 5 minute,
// paginile se regenerează singure. Paginile marcate `force-dynamic` nu sunt afectate.
export const revalidate = 300;

export const metadata: Metadata = {
  // `metadataBase` transformă căile relative din metadate în adrese absolute
  // (necesar pentru partajarea pe Facebook/WhatsApp) și e folosit de sitemap.
  metadataBase: new URL(SITE_URL),
  title: { default: "Autopas Dezmembrări — piese auto testate, cu garanție", template: "%s · Autopas Dezmembrări" },
  description: "Piese auto second-hand din dezmembrări autorizate, județul Neamț. Testate, fotografiate real, garanție 90 de zile, livrare în 1–3 zile lucrătoare în toată România.",
  alternates: { canonical: "/" },
  // Dovada pentru Google Search Console că domeniul e al nostru. E un token public,
  // legat de proprietatea din Search Console, nu un secret — de asta stă în cod și
  // nu în Setări: trebuie să apară în HTML pe TOATE paginile, inclusiv pe cele
  // statice, iar o valoare citită din bază ar rămâne prinsă în build (vezi de ce
  // și-a mutat `Analytics` id-ul în browser).
  // Verificarea merge chiar dacă indexarea e oprită din `PERMITE_INDEXARE`.
  verification: { google: "JaPSNJJ-InidGi9B9qXcy9fkyWF29FjN_Jsx43qLpX0" },
  openGraph: {
    type: "website",
    locale: "ro_RO",
    siteName: "Autopas Dezmembrări",
    title: "Autopas Dezmembrări — piese auto testate, cu garanție",
    description: "Piese auto second-hand din dezmembrări autorizate, județul Neamț. Garanție 90 de zile, livrare în 1–3 zile lucrătoare.",
  },
};

// Bara de sus a browserului pe Android se colorează la fel cu headerul, în loc să
// rămână albă. În Next 14 `themeColor` stă în `viewport`, nu în `metadata` — acolo
// e depreciat și dă avertisment la build.
export const viewport: Viewport = {
  themeColor: "#000000",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { firma } = await getSetariServer();
  // Starea vacanței, citită o dată pentru tot arborele public. Hello bar-ul o
  // arată pe fiecare pagină, nu doar pe prima. `revalidate = 300` de mai sus ar
  // ține-o veche până la 5 minute, de asta comutatorul din admin cheamă
  // `/api/revalideaza` imediat după salvare — la fel ca datele firmei.
  const vacanta = await getVacanta();
  return (
    <html lang="ro" className={poppins.variable}>
      <head>
        {/* SCRIPT ANTI-FLASH. Rulează înainte de orice desenare: citește tema
            salvată și o pune pe <html>. Fără el, pagina ar apărea o clipă
            întunecată și apoi ar sări pe luminos la fiecare reîncărcare — exact
            genul de licărire pe care oamenii o simt fără s-o poată numi.
            Implicit rămâne întunecatul: dacă nu e nimic salvat, nu se pune nimic.
            `dangerouslySetInnerHTML` e singura cale de a insera un script inline
            în App Router; conținutul e scris de noi, nu vine de nicăieri. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('autopas-tema');" +
              "if(t==='luminos'){document.documentElement.setAttribute('data-tema','luminos');}" +
              "}catch(e){}})();",
          }}
        />
      </head>
      <body>
        <CartProvider>
          <FavoritesProvider>
          <SiteChrome waPhone={firma.whatsapp || CONFIG.whatsapp} firma={firma} vacanta={vacanta}>{children}</SiteChrome>
        </FavoritesProvider>
        </CartProvider>
      </body>
    </html>
  );
}
