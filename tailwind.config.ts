import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#15181C", steel: "#3A4048", acc: "#FF6B1A", paper: "#F5F4F1",
        ok: "#1FA463", line: "#E4E1DA", mut: "#6C7480",
      },
      fontFamily: { disp: ["var(--font-barlow)"], body: ["var(--font-inter)"] },
      boxShadow: { card: "0 8px 26px rgba(21,24,28,.08)" },
    },
  },
  plugins: [],
};
export default config;
