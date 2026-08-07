-- ============================================================
-- 13. CODURILE DE REDUCERE NU MAI SUNT PUBLICE
-- Supabase → SQL Editor → New query → lipește tot → Run
--
-- PROBLEMA: politica „coduri publice la validare" permitea oricui să citească
-- toate codurile active, cu valorile lor:
--     GET /rest/v1/discount_codes?select=*
-- Adică orice vizitator putea afla campaniile înainte să le anunți și putea
-- folosi coduri care nu-i erau destinate.
--
-- DE CE SE POATE ȘTERGE FĂRĂ EFECTE: validarea din site nu citește tabela.
-- Se face prin funcția `valideaza_cod`, care e `security definer` — rulează cu
-- drepturile proprietarului și nu depinde de politicile RLS. Panoul de
-- administrare (Marketing) e accesibil doar adminului și e acoperit de
-- politica „coduri admin".
--
-- DACĂ VREI SĂ REVII (nu recomandat), politica ștearsă era:
--   create policy "coduri publice la validare" on discount_codes
--     for select using (activ = true or is_staff());
-- ============================================================

drop policy if exists "coduri publice la validare" on discount_codes;

-- Verificare rapidă — rulează separat dacă vrei să vezi rezultatul:
-- select policyname, cmd from pg_policies where tablename = 'discount_codes';
--   -> trebuie să rămână doar „coduri admin" (ALL, is_admin())
