import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import SiteChrome from "@/components/SiteChrome";
import { CartProvider } from "@/components/CartContext";
import { FavoritesProvider } from "@/components/FavoritesContext";
import { CONFIG, SITE_URL } from "@/lib/config";
import { getSetariServer } from "@/lib/settings";

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
  openGraph: {
    type: "website",
    locale: "ro_RO",
    siteName: "Autopas Dezmembrări",
    title: "Autopas Dezmembrări — piese auto testate, cu garanție",
    description: "Piese auto second-hand din dezmembrări autorizate, județul Neamț. Garanție 90 de zile, livrare în 1–3 zile lucrătoare.",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { firma } = await getSetariServer();
  return (
    <html lang="ro" className={poppins.variable}>
      <head>
        {/* TEMPORAR — selector teme pentru client. Vezi instrucțiunile de ștergere din CLAUDE.md.
            Scriptul aplică tema salvată ÎNAINTE ca pagina să se deseneze; fără el, la fiecare
            reîncărcare site-ul apare o clipă în tema veche și apoi sare. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('autopas-tema');if(t&&t!=='actuala'){document.documentElement.setAttribute('data-tema',t);}}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <CartProvider>
          <FavoritesProvider>
          <SiteChrome waPhone={firma.whatsapp || CONFIG.whatsapp} firma={firma}>{children}</SiteChrome>
        </FavoritesProvider>
        </CartProvider>
      </body>
    </html>
  );
}
