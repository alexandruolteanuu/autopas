// Punctul unic de intrare în legătura cu dez.ro. Ambele declanșatoare —
// `app/api/dezro/route.ts` și `scripts/publica-dezro.mjs` — importă de aici, ca
// să nu existe două implementări care să se despartă în timp. Aceeași regulă ca
// la `lib/import/index.mjs`.
export * from "./api.mjs";
export * from "./potrivire.mjs";
export * from "./anunt.mjs";
export * from "./depozit.mjs";
export * from "./motor.mjs";
