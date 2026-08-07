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
