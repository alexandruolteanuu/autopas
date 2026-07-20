-- ============================================================
-- AUTOPAS — PREGĂTIREA INTEGRĂRILOR (rulează AL PATRULEA)
-- Adaugă pe comenzi câmpurile pentru AWB și factură.
-- ============================================================
alter table orders add column awb text;
alter table orders add column awb_generat_la timestamptz;
alter table orders add column factura_serie text;   -- completată la exportul în Saga
