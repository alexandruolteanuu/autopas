-- ============================================================
-- MIGRAREA 16 — o singură adresă de e-mail pentru firmă
--
-- Până acum circulau trei variante:
--   · `comenzi@autopas.ro`               — rezerva din lib/settings.ts și sămânța din admin.sql
--   · `comenzi@autopas-dezmembrari.ro`   — valoarea salvată în producție
--   · `autopas.ro`                        — domeniul scris de mână în mesajul WhatsApp
--     de confirmare a comenzii, text care pleacă direct la client
--
-- Adresa oficială și unică este `contact@autopas-dezmembrari.ro`. Scriptul o pune
-- în `settings.firma.email`, care e sursa citită de tot site-ul: documentele legale
-- din lib/legal.ts, pagina de contact, subsolul și panoul de administrare.
--
-- IDEMPOTENT: se poate rula de câte ori vrei. Dacă adresa e deja cea corectă,
-- nu atinge niciun rând. Nu adaugă rândul dacă lipsește — atunci sursa e
-- `FIRMA_IMPLICITA` din lib/settings.ts, care conține aceeași adresă.
--
-- Se rulează în Supabase → SQL Editor.
-- ============================================================

update settings
   set valoare = jsonb_set(valoare, '{email}', '"contact@autopas-dezmembrari.ro"'::jsonb, true)
 where cheie = 'firma'
   and valoare->>'email' is distinct from 'contact@autopas-dezmembrari.ro';

-- Verificare: trebuie să întoarcă exact adresa de mai sus.
select valoare->>'email' as email_firma from settings where cheie = 'firma';
