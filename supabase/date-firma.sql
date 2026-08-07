-- ============================================================
-- 10. DATELE REALE ALE FIRMEI — SC PIESE AUTO PAS SRL
-- Rulează o singură dată în Supabase → SQL Editor.
-- Înlocuiește datele-substituent (RO12345678, J27/456/2015) cu cele reale
-- și adaugă câmpul nou `adresa` (sediul social), folosit în subsol și în
-- paginile legale (certificat de garanție, politica de confidențialitate).
-- Scriptul este idempotent: se poate rula de mai multe ori fără efecte secundare.
-- ============================================================

-- Dacă din vreun motiv cheia `firma` lipsește, o creăm goală ca să avem ce actualiza.
insert into settings (cheie, valoare)
values ('firma', '{}'::jsonb)
on conflict (cheie) do nothing;

-- Suprascriem doar câmpurile de identificare a firmei.
-- IBAN, seria facturilor și e-mailul rămân neatinse (se completează din Admin → Setări).
update settings
set valoare = valoare || jsonb_build_object(
      'denumire', 'S.C. PIESE AUTO PAS S.R.L.',
      'cui',      'RO 36608590',
      'reg_com',  'J27/893/2016',
      'adresa',   'Str. Petru Rareș nr. 181, com. Alexandru cel Bun, jud. Neamț',
      'telefon',  '0743 627 151',
      'whatsapp', '40743627151'
    )
where cheie = 'firma';

-- Verificare rapidă — rulează separat dacă vrei să vezi rezultatul:
-- select valoare from settings where cheie = 'firma';
