// Conversia pozelor stă în modulul comun de import, ca să existe o singură
// implementare pentru toate cele trei căi care aduc poze de la sursă:
// ruta /api/import, ruta /api/publica-piesa și scriptul din terminal.
// Fișierul ăsta rămâne doar ca punte pentru codul TypeScript care îl importa deja.
export { converteste, extensiaPentru, LATIME_MAXIMA, CALITATE } from "./import/imagini.mjs";
