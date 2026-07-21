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
