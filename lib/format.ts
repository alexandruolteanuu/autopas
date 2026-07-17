// Formatarea prețurilor în stil românesc: 1.150 lei
export function lei(n: number, sufix?: string | null) {
  const s = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 }).format(n);
  return `${s} lei${sufix ?? ""}`;
}
export function nrComanda() {
  const an = new Date().getFullYear();
  const r = Math.floor(10000 + Math.random() * 89999);
  return `AP-${an}-${r}`;
}
export const CURIERI = [
  { id: "fan",     nume: "FAN Courier",     detalii: "livrare 24–48h, ramburs inclus", pret: 19.9 },
  { id: "cargus",  nume: "Cargus",          detalii: "livrare 24–48h",                 pret: 21.5 },
  { id: "sameday", nume: "Sameday easybox", detalii: "ridici din locker",              pret: 14.9 },
];
