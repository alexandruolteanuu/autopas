-- ============================================================
-- DATE FICTIVE pentru mediul local de test SAGA (scripts/verifica-saga-local.sh).
-- Există doar în containerul Docker, care se șterge la final. Nu ajung niciodată
-- în Supabase, pe site sau în cod de producție.
-- ============================================================
insert into profiles (id, email, role) values
  ('11111111-1111-1111-1111-111111111111','admin@test.local','admin'),
  ('22222222-2222-2222-2222-222222222222','contabil@test.local','contabil'),
  ('33333333-3333-3333-3333-333333333333','operator@test.local','operator');
insert into settings values ('integrari', '{"fancourier":{"user":"x"}}'),
  ('firma', '{"denumire":"FIRMA TEST SRL","cui":"RO 123","reg_com":"J00/1/2000","adresa":"Str. Test 1","iban":"RO00TEST","capital":"200 RON","banca":"Banca Test","localitate":"Satul Test","judet":"Neamț","tara":"RO"}');
insert into products (cod_intern) select 'AP-' || lpad(g::text, 6, '0') from generate_series(1, 60) g;
-- 3 comenzi de bază: simplă, cu reducere, veche cu transport în total (data de start a probei: 9 noiembrie 2026)
insert into orders (numar, nume, email, telefon, adresa, oras, judet, subtotal, livrare, total, discount_cod, discount_valoare, created_at) values
  ('T-0001','Ion Test','i@t.ro','0700','Str. A 1','Bicaz','Neamț', 200, 0, 200, null, 0, '2026-11-10 12:00+02'),
  ('T-0002','Ana Test','a@t.ro','0700','Str. B 2','Iași','Iasi', 400, 0, 360, 'REDU10', 40, '2026-11-10 12:00+02'),
  ('T-0003','Firma Client','f@t.ro','0700','Str. C 3','Cluj','Cluj', 528.92, 28.92, 557.84, null, 0, '2026-11-10 12:00+02');
update orders set tip_client='firma', firma='CLIENT SRL', cui='RO999' where numar='T-0003';
insert into order_items (order_id, product_id, nume, pret, cantitate) values
  (1, 1, 'Far stânga Golf 6', 200, 1), (2, 2, 'Injector', 100, 4), (3, 3, 'Piesa B', 350, 1), (3, 4, 'Injector', 59.64, 3);
-- 20 de comenzi pentru proba de concurență
insert into orders (numar, nume, email, telefon, adresa, oras, judet, subtotal, livrare, total, created_at)
  select 'C-' || lpad(g::text,4,'0'), 'Client ' || g, 'c@t.ro', '0700', 'Str', 'Bicaz', 'Neamț', 100, 0, 100, '2026-11-10 10:00+02' from generate_series(1,20) g;
insert into order_items (order_id, product_id, nume, pret, cantitate) select id, 10, 'Piesa', 100, 1 from orders where numar like 'C-%';
-- ora-limită: plasată la 00:30 ora României pe 9 noiembrie = 22:30 UTC pe 8 noiembrie
insert into orders (numar, nume, email, telefon, adresa, oras, judet, subtotal, livrare, total, created_at)
  values ('Z-0001','Noapte','n@t.ro','0700','Str','Bicaz','Neamț', 50, 0, 50, '2026-11-08 22:30+00'),
         ('Z-0002','Seara','s@t.ro','0700','Str','Bicaz','Neamț', 50, 0, 50, '2026-11-08 21:30+00');
insert into order_items (order_id, product_id, nume, pret, cantitate) select id, 11, 'Piesa', 50, 1 from orders where numar like 'Z-%';
-- comandă cu județ nerecunoscut
insert into orders (numar, nume, email, telefon, adresa, oras, judet, subtotal, livrare, total, created_at)
  values ('J-0001','Judet','j@t.ro','0700','Str','X','Atlantis', 50, 0, 50, '2026-11-10 10:00+02');
insert into order_items (order_id, product_id, nume, pret, cantitate) select id, 12, 'Piesa', 50, 1 from orders where numar = 'J-0001';
