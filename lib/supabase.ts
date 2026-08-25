// Conexiunea la Supabase — un singur loc pentru tot proiectul.
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Client pentru componentele de server (paginile care citesc catalogul).
export function sbServer(): SupabaseClient | null {
  if (!url || !key) return null; // fără chei -> paginile afișează stare goală, nu crapă
  return createClient(url, key, { auth: { persistSession: false } });
}

// Client pentru browser (coș -> comandă, formulare, autentificare).
let browserClient: SupabaseClient | null = null;
export function sbBrowser(): SupabaseClient | null {
  if (!url || !key) return null;
  if (!browserClient) browserClient = createClient(url, key);
  return browserClient;
}

// Client cu drepturi depline — DOAR pentru rutele de server (nu ajunge niciodată în browser).
// Se folosește ca să citim credențialele curierilor, care sunt protejate de RLS.
// Necesită variabila SUPABASE_SERVICE_ROLE_KEY în Vercel (Settings → Environment Variables).
export function sbAdmin(): SupabaseClient | null {
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return null;
  return createClient(url, service, { auth: { persistSession: false } });
}

// ============================================================
// SCRIERE VERIFICATĂ
//
// DE CE EXISTĂ (defect găsit la 25 august 2026, în Admin → Setări)
// Un UPDATE oprit de RLS NU produce eroare. PostgREST întoarce 204, zero rânduri
// și corp gol, iar clientul primește `error === null` — exact ca la o scriere
// reușită. Verificat pe producție:
//
//   PATCH /rest/v1/settings?cheie=eq.firma   (fără drept)
//   → HTTP 204 · content-range: */* · niciun mesaj
//
// Deci orice cod care se uită doar la `error` afișează „✓ Salvat" peste o
// operațiune care n-a atins nimic. Cel mai periculos tip de defect: omul crede
// că a reușit și pleacă.
//
// `.select()` cere înapoi RÂNDURILE atinse (Prefer: return=representation).
// Zero rânduri înseamnă că nu s-a scris nimic — fie RLS a refuzat, fie filtrul
// n-a găsit rândul, fie altcineva l-a șters între timp. Toate trei sunt eșecuri
// și toate trebuie spuse.
//
// Se folosește la orice UPDATE sau DELETE din /admin:
//   const r = await scrieVerificat(sb.from("settings").update({ valoare }).eq("cheie", cheie));
//   if (!r.ok) setMsg("Nu s-a salvat: " + r.eroare);
//
// La INSERT nu e nevoie: acolo RLS chiar ridică eroare (42501).
//
// ATENȚIE la o capcană: `.select()` trece prin politica de SELECT a tabelei. Dacă
// o tabelă permite scrierea unui rol care nu-i permite și citirea, o scriere
// reușită ar părea eșuată. În proiect erau două astfel de nepotriviri (produse
// nepublicate și inboxul de cereri, ambele scriabile de `operator` dar citibile
// doar de `admin`); le repară migrarea `rls-citire-echipa.sql`.
// ============================================================
type CerereScriere = {
  select: () => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
};

export async function scrieVerificat(cerere: CerereScriere): Promise<{ ok: boolean; eroare?: string }> {
  const { data, error } = await cerere.select();
  if (error) return { ok: false, eroare: error.message };
  if (!data || data.length === 0)
    return {
      ok: false,
      eroare: "nu s-a modificat niciun rând — cel mai probabil contul curent n-are dreptul acesta (verifică rolul în Setări → Echipa)",
    };
  return { ok: true };
}

// Verifică dacă cel care a trimis cererea către o rută /api este din echipă.
// Paginile din /admin sunt protejate de RLS, dar rutele /api rulează cu drepturi
// de server, deci trebuie să întrebe explicit cine sună. Browserul trimite
// token-ul sesiunii în antetul Authorization, iar noi îl dăm mai departe lui
// Supabase și folosim aceeași funcție is_staff() ca politicile din bază.
export async function esteEchipa(req: Request): Promise<boolean> {
  if (!url || !key) return false;
  const antet = req.headers.get("authorization") ?? "";
  const token = antet.toLowerCase().startsWith("bearer ") ? antet.slice(7).trim() : "";
  if (!token) return false;
  const sb = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.rpc("is_staff");
  return !error && data === true;
}
