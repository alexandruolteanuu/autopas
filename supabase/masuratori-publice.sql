-- ============================================================
-- AUTOPAS — ID-URILE DE MĂSURARE PENTRU SITE-UL PUBLIC (rulează AL TREIZECI ȘI TREILEA)
-- Supabase → SQL Editor → New query → lipește tot → Run
-- IDEMPOTENTĂ: se poate re-rula oricând.
--
-- CE FACE
-- Deschide către site-ul public, într-o singură funcție, id-urile celor trei
-- instrumente de măsurare pe care le folosim:
--   · Google Analytics 4      — G-XXXXXXXXXX
--   · Google Ads              — AW-XXXXXXXXX  (+ eticheta de conversie)
--   · Meta Pixel              — 15 cifre
-- plus codul de verificare a domeniului cerut de Meta.
--
-- DE CE O FUNCȚIE ȘI NU O CITIRE DIRECTĂ (același motiv ca la `ga4_public`)
-- Toate stau în `settings.integrari`, un rând care NU e citibil public — și
-- bine face: în ACELAȘI rând stau parola de FAN Courier și cheia privată
-- Netopia. O politică lărgită „ca să ajungem la pixel" le-ar da la iveală și pe
-- acelea, într-un răspuns REST pe care îl poate cere oricine.
--
-- Ce întoarce funcția NU e secret: fiecare id ajunge oricum în HTML-ul paginii,
-- vizibil din „View source". Secret e restul rândului, care rămâne închis.
--
-- COMUTATORUL REAL AL FIECĂREI INTEGRĂRI E AICI. Un id lipsă sau `activ=false`
-- înseamnă că în pagină nu se încarcă NIMIC și nu pleacă nicio cerere către
-- Google sau Meta. Nu există o a doua cale de a porni măsurarea.
--
-- `ga4_public()` din migrarea 30 RĂMÂNE, neatinsă: e chemată de codul vechi și
-- nu strică nimic să existe amândouă. Site-ul cheamă de acum `masuratori_publice()`,
-- o singură dată, în loc de câte o cerere pentru fiecare instrument.
-- ============================================================

create or replace function public.masuratori_publice()
returns jsonb
language sql
stable
security definer
set search_path = public
as $m$
  with i as (
    select valoare as v from settings where cheie = 'integrari'
  )
  select jsonb_build_object(
    -- `activ` lipsă înseamnă „mergi": integrarea se consideră pornită din
    -- momentul în care cineva a scris un id. Doar un `false` explicit o oprește.
    -- (Aceeași regulă ca la `ga4_public`, ca să nu existe două purtări diferite.)
    'ga4', coalesce((select nullif(trim(v -> 'ga4' ->> 'id'), '') from i
                      where coalesce((v -> 'ga4' ->> 'activ')::boolean, true)), ''),
    'google_ads', coalesce((select nullif(trim(v -> 'google_ads' ->> 'id'), '') from i
                      where coalesce((v -> 'google_ads' ->> 'activ')::boolean, true)), ''),
    -- Eticheta de conversie pentru „comandă plasată". Google o dă sub forma
    -- `AW-123456789/AbC-D_efGh`; salvăm doar partea de după bară, iar codul o
    -- lipește de id. Așa nu se poate ajunge la o etichetă care aparține altui cont.
    'ads_conversie', coalesce((select nullif(trim(v -> 'google_ads' ->> 'eticheta_conversie'), '') from i
                      where coalesce((v -> 'google_ads' ->> 'activ')::boolean, true)), ''),
    'meta_pixel', coalesce((select nullif(trim(v -> 'meta' ->> 'pixel_id'), '') from i
                      where coalesce((v -> 'meta' ->> 'activ')::boolean, true)), ''),
    -- Codul de verificare a domeniului din Meta Business Manager. Nu e o
    -- măsurătoare, dar merge pe același drum: e public prin natura lui (stă
    -- într-un `<meta>` în pagină) și trebuie citit fără sesiune.
    'meta_domeniu', coalesce((select nullif(trim(v -> 'meta' ->> 'verificare_domeniu'), '') from i), '')
  );
$m$;

-- ATENȚIE la `revoke`: funcțiile primesc implicit EXECUTE pentru rolul PUBLIC,
-- iar `anon` și `authenticated` moștenesc de acolo. Revocarea doar de la ele ar
-- lăsa dreptul intact prin PUBLIC. (Aceeași notă ca la `vacanta_publica`.)
revoke execute on function public.masuratori_publice() from public;
grant execute on function public.masuratori_publice() to anon, authenticated;


-- ============================================================
-- VERIFICARE
-- Cât timp nimeni n-a lipit niciun id în Admin → Integrări, toate cele cinci
-- câmpuri trebuie să iasă șiruri goale — adică site-ul nu încarcă nimic.
-- Al doilea rând arată că rândul `integrari` NU s-a deschis din greșeală:
-- trebuie să dea eroare sau zero rânduri pentru un utilizator anonim.
-- ============================================================
select masuratori_publice() as id_uri_publice;
