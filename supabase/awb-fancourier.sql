-- ============================================================
-- MIGRAREA 43 — detaliile AWB-ului FAN Courier, pe comandă
--
-- DE CE (15 septembrie 2026)
-- AWB-ul se generează acum direct din comanda din admin (lib/fancourier.ts,
-- app/api/awb/route.ts). Operatorul scrie la fiecare AWB greutatea și
-- dimensiunile coletului — NU se mai iau din greutatea pieselor (decizia
-- proprietarului: piesele au 1 kg pus automat la import, iar un colet real se
-- cântărește).
--
-- `orders.awb` (numărul) și `orders.awb_generat_la` există din `integrari.sql`.
-- Aici se adaugă doar ce s-a trimis și ce a răspuns FAN, într-o singură coloană:
--   { colete, greutate, lungime, latime, inaltime, ramburs, serviciu,
--     tarif, tva, tracking, destinatar: { judet, localitate, strada, telefon } }
-- De ce contează:
--   · borderoul din „Expedieri" scrie greutatea REALĂ a coletului, nu o estimare;
--   · la o dispută cu FAN (diferență de greutate facturată) se vede ce s-a declarat;
--   · `tarif` e ce a calculat FAN pentru expediția asta — se poate compara cu
--     transportul spus clientului.
-- `jsonb`, nu coloane separate: nimic din bază nu filtrează după câmpurile astea,
-- iar forma răspunsului FAN se poate schimba fără migrare.
--
-- Nu atinge niciun rând existent. IDEMPOTENTĂ: se poate re-rula oricând.
-- ============================================================

alter table orders add column if not exists awb_date jsonb;

comment on column orders.awb_date is
  'Ce s-a declarat la FAN la generarea AWB-ului (greutate, dimensiuni, ramburs) și ce a răspuns (tarif, tracking). Null = AWB negenerat sau scris de mână.';
