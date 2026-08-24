// ============================================================
// CONFIGURAREA INTEGRĂRILOR — un singur loc pentru tot.
// Valorile vin din Environment Variables (Vercel → Settings).
// ============================================================
export const CONFIG = {
  // --- WhatsApp (FUNCȚIONAL ACUM: schimbi numărul și gata) ---
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_PHONE ?? "40743627151", // format internațional, fără +
  telefonAfisat: process.env.NEXT_PUBLIC_PHONE_DISPLAY ?? "0743 627 151",

  // --- FAN Courier (SelfAWB) — se activează când clientul primește contul ---
  fancourier: {
    clientId: process.env.FANCOURIER_CLIENT_ID ?? "",
    user: process.env.FANCOURIER_USER ?? "",
    parola: process.env.FANCOURIER_PASS ?? "",
  },
};
export const waLink = (text = "Bună! Am o întrebare despre o piesă.") =>
  `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}`;

// ============================================================
// CONTACT AFIȘAT — un singur loc pentru telefon, program și livrare.
// Se folosește în header, footer și în paginile publice.
// ============================================================
export const PROGRAM = "Luni – Vineri 8:30 – 17:30";
/** Varianta scurtă, pentru hello bar-ul de pe telefon. Pe 360px lățime forma
 *  lungă nu încape lângă număr și ar rupe bara pe două rânduri. Aceleași ore —
 *  dacă schimbi programul, schimbi ambele constante. */
export const PROGRAM_SCURT = "L–V 8:30–17:30";
export const LIVRARE = "Livrare în 1–3 zile lucrătoare în toată România";
/** Numărul curățat, pentru linkul „tel:” (fără spații). */
export const telLink = (nr: string = CONFIG.telefonAfisat) => `tel:${nr.replace(/\s+/g, "")}`;

// ============================================================
// ADRESA SITE-ULUI — necesară în sitemap, robots.txt și pentru linkurile
// absolute din metadate (Open Graph). Ordinea:
//   1. NEXT_PUBLIC_SITE_URL, dacă o setezi tu în Vercel
//   2. domeniul de producție pe care îl dă Vercel automat (…vercel.app)
//   3. localhost, în dezvoltare
//
// LA CUMPĂRAREA DOMENIULUI: domeniul ales este autopas-dezmembrari.ro (încă
// neînregistrat la 7 august 2026). După ce îl legi în Vercel, adaugi acolo
// NEXT_PUBLIC_SITE_URL = https://autopas-dezmembrari.ro și redeployezi.
// Până atunci merge automat pe adresa .vercel.app, fără să configurezi nimic.
// ============================================================
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "") ||
  "http://localhost:3000";

/** Indexarea în Google se activează manual, la lansare: PERMITE_INDEXARE=da în Vercel.
 *  Cât timp nu e setată, robots.txt cere motoarelor să nu indexeze nimic — ca să nu
 *  ajungă în căutări piesele de probă de dinainte de lansare. */
export const INDEXARE_PERMISA = process.env.PERMITE_INDEXARE === "da";

// ============================================================
// ADRESA DEPOZITULUI — locul unde vine efectiv clientul.
// Coincide cu sediul social din Admin → Setări, dar aici e scrisă în forma
// utilă la drum: reperul de pe DN15 și codul poștal.
// ============================================================
export const ADRESA = {
  scurt: "Str. Petru Rareș 181, DN 15, jud. Neamț",
  lung: "Str. Petru Rareș nr. 181, DN 15 Piatra-Neamț – Bicaz, sat Bistrița, com. Alexandru cel Bun, jud. Neamț, 617508",
  reper: "pe DN 15, între Piatra-Neamț și Bicaz",
};

// ============================================================
// HĂRȚI — linkuri către locația depozitului (Autopas Dezmembrări).
// Coordonate: 46.9418304, 26.3101874
//
// Google Maps: linkul fișei de firmă, exact cum vine din Maps. I-am scos doar
// parametrii de sesiune de la final (`entry`, `g_ep`), care expiră și nu sunt
// necesari. Deschide direct fișa Autopas, cu recenzii și program.
// Waze: primește coordonatele și pornește navigația.
// ============================================================
export const HARTI = {
  waze: "https://www.waze.com/ul?ll=46.9418304%2C26.3101874&navigate=yes",
  gmaps: "https://www.google.com/maps/place/Autopas+Dezmembrari/@46.9418956,26.3102788,20.25z/data=!4m14!1m7!3m6!1s0x47355770d6f42f6d:0x5e2f863406a67bc0!2sAutopas+Dezmembrari!8m2!3d46.9418304!4d26.3101874!16s%2Fg%2F11jclwjc3z!3m5!1s0x47355770d6f42f6d:0x5e2f863406a67bc0!8m2!3d46.9418304!4d26.3101874!16s%2Fg%2F11jclwjc3z",
};
