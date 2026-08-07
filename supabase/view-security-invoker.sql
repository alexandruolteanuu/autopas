-- ============================================================
-- 14. VIEW-UL DE CATEGORII RESPECTĂ DREPTURILE CELUI CARE ÎL CITEȘTE
-- Supabase → SQL Editor → New query → lipește tot → Run
--
-- PROBLEMA (semnalată de Supabase ca ERROR): în PostgreSQL, un view rulează
-- implicit cu drepturile celui care l-a CREAT, nu ale celui care îl citește.
-- Adică poate ocoli politicile RLS. Pentru `categorii_cu_numar` nu se pierde
-- nimic concret — view-ul numără doar piese deja publice (`publicat = true`
-- și `stoc > 0`), aceleași pe care oricine le vede în catalog — dar principiul
-- e greșit și devine periculos dacă cineva adaugă mâine o coloană sensibilă.
--
-- SOLUȚIA: `security_invoker = true` (disponibil de la PostgreSQL 15; proiectul
-- rulează pe 17.6). Din acel moment view-ul aplică politicile RLS ale
-- utilizatorului care interoghează, ca orice tabelă normală.
--
-- Rezultatele NU se schimbă: filtrul `publicat = true` era deja în view.
-- ============================================================

alter view public.categorii_cu_numar set (security_invoker = true);

-- Verificare rapidă — rulează separat dacă vrei să vezi rezultatul:
-- select relname, reloptions from pg_class where relname = 'categorii_cu_numar';
--   -> trebuie să apară {security_invoker=true}
