// ============================================================
// SETĂRI — sursa unică de adevăr pentru datele firmei, curieri și integrări.
// Se citesc din baza de date (tabela settings); variabilele din Vercel rămân
// doar ca rezervă, dacă în baza de date nu s-a completat nimic.
// ============================================================
import { sbServer, sbBrowser } from "./supabase";

export type Firma = { denumire: string; cui: string; reg_com: string; adresa: string; iban: string;
  serie_factura: string; telefon: string; email: string; whatsapp: string };
export type Curier = { id: string; nume: string; detalii: string; pret: number };
export type Integrari = {
  fancourier?: { client_id?: string; user?: string; parola?: string; activ?: boolean };
  netopia?: { pos_id?: string; signature?: string; activ?: boolean };
  saga?: { serie?: string; activ?: boolean };
  ga4?: { id?: string; activ?: boolean };
};

// Datele REALE ale firmei — folosite ca rezervă dacă în tabela `settings` nu s-a salvat nimic.
// Sursa oficială rămâne Admin → Setări → Date firmă (se suprascriu automat peste acestea).
export const FIRMA_IMPLICITA: Firma = {
  denumire: "S.C. PIESE AUTO PAS S.R.L.",
  cui: "RO 36608590",
  reg_com: "J27/893/2016",
  adresa: "Str. Petru Rareș nr. 181, com. Alexandru cel Bun, jud. Neamț",
  iban: "",
  serie_factura: "AUTP",
  telefon: "0743 627 151",
  // Adresa oficială și unică a firmei. Se schimbă din Admin → Setări → Date firmă;
  // valoarea de aici e doar rezerva folosită când tabela `settings` n-a fost citită.
  // Dacă o schimbi, schimbi și `supabase/email-unic.sql`, ca baza să spună la fel.
  email: "contact@autopas-dezmembrari.ro",
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_PHONE ?? "40743627151",
};
// FAN Courier este singurul curier al firmei (decizie: 7 august 2026).
export const CURIERI_IMPLICITI: Curier[] = [
  { id: "fan", nume: "FAN Courier", detalii: "livrare 1–3 zile lucrătoare, ramburs inclus", pret: 19.9 },
];

function compune(rows: { cheie: string; valoare: any }[] | null) {
  const m = new Map((rows ?? []).map((r) => [r.cheie, r.valoare]));
  return {
    firma: { ...FIRMA_IMPLICITA, ...(m.get("firma") ?? {}) } as Firma,
    curieri: ((m.get("curieri") as Curier[]) ?? CURIERI_IMPLICITI),
    integrari: ((m.get("integrari") as Integrari) ?? {}),
  };
}

// ============================================================
// MOD VACANȚĂ
//
// Comutator global, citit la afișare. NU atinge niciodată `products.publicat` —
// vezi supabase/mod-vacanta.sql pentru motivul întreg. Pe scurt: dezactivarea ar
// trebui să știe care piesă era ascunsă din vacanță și care din alt motiv (stoc
// zero, scoasă de operator, dispărută din feed), iar informația aia nu există.
//
// Rândul din `settings` NU e citibil public: `activat_de` e adresa unui om din
// echipă. Site-ul public primește doar `activ` și `mesaj`, prin funcția
// `vacanta_publica()`.
// ============================================================
export type Vacanta = { activ: boolean; mesaj: string };
export type VacantaAdmin = Vacanta & { data_activarii: string | null; activat_de: string | null };

/** Textul arătat când vacanța e activă, dar proprietarul n-a scris niciun mesaj. */
export const MESAJ_VACANTA_IMPLICIT = "Magazin în pauză temporară.";
/** Plafonul din interfața de admin. Peste el, hello bar-ul de pe telefon ar trece
 *  de 52px și ar împinge conținutul în jos. */
export const LIMITA_MESAJ_VACANTA = 120;

const vacantaDin = (d: any): Vacanta => ({
  activ: d?.activ === true,
  mesaj: typeof d?.mesaj === "string" ? d.mesaj.trim() : "",
});

/** Starea vacanței pentru site-ul public (server). Dacă apelul cade din orice
 *  motiv, se întoarce „inactiv": un magazin care nu poate citi comutatorul
 *  trebuie să vândă mai departe, nu să se închidă singur. */
export async function getVacanta(): Promise<Vacanta> {
  const sb = sbServer();
  if (!sb) return { activ: false, mesaj: "" };
  const { data } = await sb.rpc("vacanta_publica");
  return vacantaDin(data);
}

/** Aceeași stare, în browser (coș, checkout, favorite). */
export async function getVacantaBrowser(): Promise<Vacanta> {
  const sb = sbBrowser();
  if (!sb) return { activ: false, mesaj: "" };
  const { data } = await sb.rpc("vacanta_publica");
  return vacantaDin(data);
}

/** Mesajul de arătat, cu textul implicit când proprietarul n-a scris nimic. */
export const mesajVacanta = (v: Vacanta) => v.mesaj || MESAJ_VACANTA_IMPLICIT;

// pe server (layout, footer, pagini)
export async function getSetariServer() {
  const sb = sbServer();
  if (!sb) return compune(null);
  const { data } = await sb.from("settings").select("cheie,valoare");
  return compune(data as any);
}
// în browser (checkout, admin)
export async function getSetariBrowser() {
  const sb = sbBrowser();
  if (!sb) return compune(null);
  const { data } = await sb.from("settings").select("cheie,valoare");
  return compune(data as any);
}
/**
 * Golește cache-ul paginilor publice, după o salvare din Admin → Setări.
 *
 * `app/layout.tsx` are `revalidate = 300`, iar datele firmei ȘI starea vacanței
 * se citesc pe server. Fără apelul ăsta, subsolul, documentele legale și hello
 * bar-ul ar arăta valoarea veche încă până la 5 minute — exact simptomul „am
 * salvat și nu se vede".
 */
export async function golesteCachePublic() {
  const sb = sbBrowser();
  const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
  if (!token) return;
  await fetch("/api/revalideaza", { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
}

// link WhatsApp construit din numărul salvat în Setări
export const waLinkCu = (numar: string, text = "Bună! Am o întrebare despre o piesă.") =>
  `https://wa.me/${(numar || "").replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
