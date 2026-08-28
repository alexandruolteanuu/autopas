import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import SiteChrome from "@/components/SiteChrome";
import { CartProvider } from "@/components/CartContext";
import { FavoritesProvider } from "@/components/FavoritesContext";
import { CONFIG, SITE_URL } from "@/lib/config";
import { getSetariServer, getVacanta } from "@/lib/settings";
import { SABLON_TITLU } from "@/lib/seo";
import { sbServer } from "@/lib/supabase";

/** Rândul de mărci din subsol. */
export type MarcaTop = { slug: string; nume: string; nr_piese: number };

// Fontul Poppins (local) — un singur font, patru grosimi, diacritice românești garantate.
// WOFF2, nu TTF: aceleași patru grosimi, 617 KB -> 200 KB, cu 68% mai puțin.
// Fonturile erau cel mai greu lucru din fiecare pagină a site-ului — mai grele
// decât tot JavaScript-ul — iar TTF-ul e formatul necomprimat, potrivit pentru
// instalare în sistem, nu pentru web. Fișierele .ttf rămân în `app/fonts/` ca
// sursă: din ele se regenerează .woff2 dacă e nevoie.
//
// Toate patru grosimile sunt folosite: 400 în textul de corp, 500 la etichete,
// 600 și 700 în titluri și butoane (174, respectiv 113 locuri în cod).
//
// `display: "swap"` — textul se desenează imediat cu fontul de sistem și se
// schimbă când sosește Poppins. Alternativa, `optional`, ar sări complet fontul
// pe conexiuni slabe; aici identitatea vizuală contează prea mult.
const poppins = localFont({
  src: [
    { path: "./fonts/Poppins-Regular.woff2", weight: "400" },
    { path: "./fonts/Poppins-Medium.woff2", weight: "500" },
    { path: "./fonts/Poppins-SemiBold.woff2", weight: "600" },
    { path: "./fonts/Poppins-Bold.woff2", weight: "700" },
  ],
  variable: "--font-poppins",
  display: "swap",
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
  title: { default: "Autopas Dezmembrări — piese auto testate, cu garanție", template: SABLON_TITLU },
  description: "Piese auto second-hand din dezmembrări autorizate, județul Neamț. Testate, fotografiate real, garanție 90 de zile, livrare în 1–3 zile lucrătoare în toată România.",
  // AICI NU SE PUNE `alternates.canonical`. (Defect găsit la 28 august 2026.)
  //
  // Metadatele din layout se moștenesc de fiecare pagină care nu-și declară
  // altele, iar un `canonical: "/"` pus aici nu înseamnă „prima pagină e
  // canonică pentru ea însăși", ci „TOATE paginile sunt duplicate ale primei
  // pagini". Așa spuneau toate cele 8.739 de pagini de piese, plus contact, faq,
  // despre-noi și cele 8 documente legale — verificat pe producție.
  //
  // Consecința e mai rea decât lipsa oricărei etichete: fără canonical, Google
  // folosește adresa paginii, adică exact ce trebuie. Fiecare pagină publică își
  // declară acum canonical-ul propriu.
  // Dovada pentru Google Search Console că domeniul e al nostru. E un token public,
  // legat de proprietatea din Search Console, nu un secret — de asta stă în cod și
  // nu în Setări: trebuie să apară în HTML pe TOATE paginile, inclusiv pe cele
  // statice, iar o valoare citită din bază ar rămâne prinsă în build (vezi de ce
  // și-a mutat `Analytics` id-ul în browser).
  // Verificarea merge chiar dacă indexarea e oprită din `PERMITE_INDEXARE`.
  verification: { google: "4u7KgciMTRXG3ZTRkQJmE5J9Geb52TMLk7S3WWWfdCo" },
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
  // Primele mărci după numărul de piese, pentru rândul de navigație din subsol.
  // Vin de aici, de pe SERVER, fiindcă subsolul e componentă de client și
  // fiindcă linkurile trebuie să existe în HTML — altfel crawlerul nu le vede.
  // Din view, 38 de rânduri; vezi supabase/piese-marca-categorie.sql.
  const sbTop = sbServer();
  const marciTop = sbTop
    ? (((await sbTop.from("numar_piese_pe_marca").select("slug,nume,nr_piese")
        .gt("nr_piese", 0).order("nr_piese", { ascending: false }).limit(10)).data ?? []) as MarcaTop[])
    : [];
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
          <SiteChrome waPhone={firma.whatsapp || CONFIG.whatsapp} firma={firma} vacanta={vacanta} marciTop={marciTop}>{children}</SiteChrome>
        </FavoritesProvider>
        </CartProvider>
      </body>
    </html>
  );
}
