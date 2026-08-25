import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Paleta veche, fixă. Rămâne pentru /admin și pentru culorile
        // semantice (ok = verde de succes), care nu se schimbă cu tema.
        ink: "#15181C", steel: "#3A4048", acc: "#FF6B1A", paper: "#F5F4F1",
        ok: "#1FA463", line: "#E4E1DA", mut: "#6C7480",

        // Culorile temei site-ului public. Valorile stau în blocul `:root`
        // din app/globals.css — acolo se schimbă, nu aici și nici în
        // componente. Sintaxa cu <alpha-value> face să meargă și
        // transparența: bg-accent/10, border-chenar/40.
        fundal:       "rgb(var(--fundal) / <alpha-value>)",
        suprafata:    "rgb(var(--suprafata) / <alpha-value>)",
        suprafata2:   "rgb(var(--suprafata-2) / <alpha-value>)",
        text:         "rgb(var(--text) / <alpha-value>)",
        textSecundar: "rgb(var(--text-secundar) / <alpha-value>)",
        chenar:       "rgb(var(--chenar) / <alpha-value>)",
        accent:       "rgb(var(--accent) / <alpha-value>)",
        accentHover:  "rgb(var(--accent-hover) / <alpha-value>)",
        // Galbenul are două roluri — vezi blocul :root din app/globals.css:
        //   bg-accent           umplutura (butonul galben)
        //   text-accentContrast textul DE PE umplutură (închis)
        //   border-accentChenar conturul unei umpluturi galbene
        // Galben CA text NU e un token: nu există pe tema luminoasă. Locurile
        // care îl vor pe cea întunecată folosesc clasa `.accentuat` din
        // globals.css, care pe luminos devine culoarea obișnuită a textului.
        accentContrast: "rgb(var(--accent-contrast) / <alpha-value>)",
        accentChenar:   "rgb(var(--accent-chenar) / <alpha-value>)",
        headerBg:     "rgb(var(--header-bg) / <alpha-value>)",
        headerText:   "rgb(var(--header-text) / <alpha-value>)",
        footerBg:     "rgb(var(--footer-bg) / <alpha-value>)",
        footerText:   "rgb(var(--footer-text) / <alpha-value>)",
        imagineBg:    "rgb(var(--imagine-bg) / <alpha-value>)",
        // Banda de sus a paginii de acasă. Pe tema întunecată e neagră, ca
        // headerul; pe cea luminoasă devine deschisă — „hero alb", cerința
        // clientului. Restul benzilor negre rămân negre pe ambele teme.
        heroBg:       "rgb(var(--hero-bg) / <alpha-value>)",
        heroText:     "rgb(var(--hero-text) / <alpha-value>)",
      },
      fontFamily: { disp: ["var(--font-poppins)"], body: ["var(--font-poppins)"] },
      boxShadow: { card: "0 8px 26px rgba(21,24,28,.08)" },
    },
  },
  plugins: [],
};
export default config;
