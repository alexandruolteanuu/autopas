import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CookieBanner from "@/components/CookieBanner";
import { CartProvider } from "@/components/CartContext";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import { CONFIG } from "@/lib/config";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" className={poppins.variable}>
      <body>
        <CartProvider>
          <Header />
          <main className="min-h-[60vh]">{children}</main>
          <Footer />
          <CookieBanner />
          <WhatsAppFloat phone={CONFIG.whatsapp} />
        </CartProvider>
      </body>
    </html>
  );
}
