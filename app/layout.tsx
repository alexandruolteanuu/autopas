import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import SiteChrome from "@/components/SiteChrome";
import { CartProvider } from "@/components/CartContext";
import { CONFIG } from "@/lib/config";
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

export const metadata: Metadata = {
  title: { default: "Autopas Dezmembrări — piese auto testate, cu garanție", template: "%s · Autopas Dezmembrări" },
  description: "Piese auto second-hand din dezmembrări autorizate, Piatra-Neamț. Testate, fotografiate real, garanție 30 de zile, livrare 24–48h în toată România.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { firma } = await getSetariServer();
  return (
    <html lang="ro" className={poppins.variable}>
      <body>
        <CartProvider>
          <SiteChrome waPhone={CONFIG.whatsapp} firma={firma}>{children}</SiteChrome>
        </CartProvider>
      </body>
    </html>
  );
}
