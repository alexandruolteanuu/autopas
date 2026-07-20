// ============================================================
// CONFIGURAREA INTEGRĂRILOR — un singur loc pentru tot.
// Valorile vin din Environment Variables (Vercel → Settings).
// ============================================================
export const CONFIG = {
  // --- WhatsApp (FUNCȚIONAL ACUM: schimbi numărul și gata) ---
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_PHONE ?? "40740123456", // format internațional, fără +
  telefonAfisat: process.env.NEXT_PUBLIC_PHONE_DISPLAY ?? "0740 123 456",

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
