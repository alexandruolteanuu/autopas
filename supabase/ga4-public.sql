-- ============================================================
-- AUTOPAS — ID-UL GOOGLE ANALYTICS PENTRU SITE-UL PUBLIC (rulează AL TREIZECILEA)
-- Supabase → SQL Editor → New query → lipește tot → Run
-- IDEMPOTENTĂ: se poate re-rula oricând.
--
-- DE CE O FUNCȚIE ȘI NU O CITIRE DIRECTĂ
-- ID-ul de măsurare stă în `settings.integrari.ga4.id`, iar rândul `integrari` NU
-- e citibil public — politica „setari citire" lasă la vedere doar `firma` și
-- `curieri`. Și e corect așa: în ACELAȘI rând stau parola de FAN Courier și cheia
-- privată Netopia. O politică lărgită „ca să ajungem la GA" ar da la iveală și
-- credențialele, într-un răspuns REST pe care îl poate cere oricine.
--
-- Funcția întoarce EXCLUSIV id-ul de măsurare. Nu e un secret — ajunge oricum în
-- HTML-ul paginii, vizibil în „View source" — dar restul rândului rămâne închis.
-- Aceeași formă ca `vacanta_publica()` din migrarea 27.
--
-- Întoarce șir gol când integrarea nu e configurată sau e dezactivată, iar codul
-- din site nu încarcă atunci NIMIC: fără id, zero scripturi, zero cereri către
-- Google. Comutatorul real al integrării e tot aici.
-- ============================================================

create or replace function public.ga4_public()
returns text
language sql
stable
security definer
set search_path = public
as $ga$
  select coalesce(
    (select nullif(trim(valoare -> 'ga4' ->> 'id'), '')
       from settings
      where cheie = 'integrari'
        -- `activ` lipsă înseamnă „mergi": integrarea se consideră pornită din
        -- momentul în care cineva a scris un id. Doar un `false` explicit o oprește.
        and coalesce((valoare -> 'ga4' ->> 'activ')::boolean, true) = true),
    '');
$ga$;

-- ATENȚIE la `revoke`: funcțiile primesc implicit EXECUTE pentru rolul PUBLIC,
-- iar `anon` și `authenticated` moștenesc de acolo. Revocarea doar de la ele ar
-- lăsa dreptul intact prin PUBLIC. (Aceeași notă ca la `vacanta_publica`.)
revoke execute on function public.ga4_public() from public;
grant execute on function public.ga4_public() to anon, authenticated;


-- ============================================================
-- VERIFICARE
-- Cât timp nimeni n-a lipit un id în Admin → Integrări, trebuie să iasă șir gol.
-- ============================================================
select ga4_public() as id_public,
       (select valoare ? 'ga4' from settings where cheie = 'integrari') as are_cheia_ga4;
