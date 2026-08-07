// ============================================================
// TEMPORAR — lista temelor de culoare, pentru dropdownul din header.
// Aici stau DOAR metadatele; culorile propriu-zise sunt în app/globals.css.
// Instrucțiunile de ștergere: CLAUDE.md, secțiunea „TEMPORAR — selector teme".
// ============================================================

export type GrupTema = "Actuală" | "Propuse de client" | "Propuse suplimentar";

export type Tema = {
  /** se pune în data-tema pe <html>; „actuala" înseamnă fără atribut */
  id: string;
  nume: string;
  grup: GrupTema;
};

export const TEMA_IMPLICITA = "actuala";

/** Cheia din localStorage unde se ține alegerea clientului. */
export const CHEIE_TEMA = "autopas-tema";

export const TEME: Tema[] = [
  { id: "actuala",             nume: "Actuală (portocaliu)",        grup: "Actuală" },

  { id: "negru-auriu",         nume: "Negru + auriu",               grup: "Propuse de client" },
  { id: "antracit-portocaliu", nume: "Antracit + portocaliu ars",   grup: "Propuse de client" },
  { id: "bleumarin-argintiu",  nume: "Bleumarin + argintiu",        grup: "Propuse de client" },
  { id: "negru-smarald",       nume: "Negru + verde smarald",       grup: "Propuse de client" },

  { id: "catalog-luminos",     nume: "Catalog luminos",             grup: "Propuse suplimentar" },
  { id: "verde-reciclare",     nume: "Verde reciclare",             grup: "Propuse suplimentar" },
  { id: "atelier-galben",      nume: "Atelier, galben industrial",  grup: "Propuse suplimentar" },
  { id: "bleumarin-rosu",      nume: "Bleumarin + roșu service",    grup: "Propuse suplimentar" },
];

/** Grupurile în ordinea în care apar în dropdown. */
export const GRUPURI: GrupTema[] = ["Actuală", "Propuse de client", "Propuse suplimentar"];
