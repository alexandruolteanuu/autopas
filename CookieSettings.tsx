import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CookieBanner from "@/components/CookieBanner";
import { CartProvider } from "@/components/CartContext";

// Fonturile sunt LOCALE (în proiect) — diacritice garantate, fără dependență de servicii externe.
const barlow = localFont({
  src: [
    { path: "./fonts/BarlowCondensed-Medium.ttf", weight: "500" },
    { path: "./fonts/BarlowCondensed-SemiBold.ttf", weight: "600" },
    { path: "./fonts/BarlowCondensed-Bold.ttf", weight: "700" },
    { path: "./fonts/BarlowCondensed-Black.ttf", weight: "900" },
  ],
  variable: "--font-barlow",
});
const inter = localFont({ src: "./fonts/Inter.ttf", variable: "--font-inter" });

export const metadata: Metadata = {
  title: { default: "Autopas Dezmembrări — piese auto testate, cu garanție", template: "%s · Autopas Dezmembrări" },
  description: "Piese auto second-hand din dezmembrări autorizate, Piatra-Neamț. Testate, fotografiate real, garanție 30 de zile, livrare 24–48h în toată România.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" className={`${barlow.variable} ${inter.variable}`}>
      <body>
        <CartProvider>
          <Header />
          <main className="min-h-[60vh]">{children}</main>
          <Footer />
          <CookieBanner />
        </CartProvider>
      </body>
    </html>
  );
}
