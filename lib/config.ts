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
  // --- Sameday — se activează când clientul primește contul ---
  sameday: {
    user: process.env.SAMEDAY_USER ?? "",
    parola: process.env.SAMEDAY_PASS ?? "",
  },
};
export const waLink = (text = "Bună! Am o întrebare despre o piesă.") =>
  `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}`;

// ============================================================
// CONTACT AFIȘAT — un singur loc pentru telefon, program și livrare.
// Se folosește în header, footer și în paginile publice.
// ============================================================
export const PROGRAM = "Luni – Vineri 8:30 – 17:30";
export const LIVRARE = "Livrare în 1–3 zile lucrătoare în toată România";
/** Numărul curățat, pentru linkul „tel:” (fără spații). */
export const telLink = (nr: string = CONFIG.telefonAfisat) => `tel:${nr.replace(/\s+/g, "")}`;

// ============================================================
// HĂRȚI — linkuri către locația depozitului.
// ATENȚIE: momentan sunt LINKURI PROVIZORII („#”).
// Când primești adresele reale, înlocuiește-le aici — se actualizează
// automat și în header, și în footer.
// ============================================================
export const HARTI = {
  waze: "#",       // TODO: link real Waze (ex. https://waze.com/ul/h...)
  gmaps: "#",      // TODO: link real Google Maps (ex. https://maps.app.goo.gl/...)
};
