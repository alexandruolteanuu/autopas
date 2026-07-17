-- ============================================================
-- AUTOPAS — DATE REALE (rulează AL DOILEA, după schema.sql)
-- Supabase → SQL Editor → New query → lipește tot → Run
-- Acestea sunt produse reale în baza ta de date: le poți edita,
-- șterge sau completa oricând din Table Editor sau din /admin.
-- ============================================================

insert into categories (slug, nume, display_count, art, ordine) values
 ('motor-si-anexe',              'Motor și anexe',               1240, 'engine',     1),
 ('cutie-de-viteze-si-transmisie','Cutie de viteze și transmisie', 386, 'gearbox',    2),
 ('caroserie-si-exterior',       'Caroserie și exterior',        2150, 'panel',      3),
 ('optica-si-faruri',            'Optică și faruri',              540, 'headlight',  4),
 ('electrice-si-senzori',        'Electrice și senzori',          890, 'alternator', 5),
 ('suspensie-si-directie',       'Suspensie și direcție',         610, 'suspension', 6),
 ('sistem-de-franare',           'Sistem de frânare',             430, 'brake',      7),
 ('interior-si-tapiterie',       'Interior și tapițerie',        1020, 'seat',       8),
 ('roti-jante-si-anvelope',      'Roți, jante și anvelope',       280, 'wheel',      9),
 ('climatizare-si-incalzire',    'Climatizare (AC) și încălzire', 350, 'compressor',10);

insert into vehicles (slug, nume, an, vin_masca, piese_listate, intrare) values
 ('vw-golf-6-2011',    'VW Golf 6 1.6 TDI',      2011, 'WVWZZZ1KZ…8452', 214, now() - interval '12 days'),
 ('vw-passat-b7-2012', 'VW Passat B7 2.0 TDI',   2012, 'WVWZZZ3CZ…9917', 214, now() - interval '2 days'),
 ('bmw-320d-f30-2014', 'BMW 320d F30',           2014, 'WBA3D…4408',      96, now() - interval '4 days'),
 ('dacia-duster-2016', 'Dacia Duster 1.5 dCi',   2016, 'UU1HS…2231',     148, now() - interval '7 days'),
 ('opel-astra-j-2011', 'Opel Astra J 1.7 CDTI',  2011, 'W0LP…7719',      167, now() - interval '14 days');

insert into products
 (slug, nume, oem, stare, stare_nota, pret_lei, pret_sufix, ani, art, categorie_id, vehicul_id, compat, stoc) values
 ('alternator-bosch-vw-golf-6-16-tdi', 'Alternator Bosch — VW Golf 6 1.6 TDI (CAYC)',
  '03L903023', 'A', 'testat pe stand la 2.000 rpm', 385, null, '2009–2013', 'alternator',
  (select id from categories where slug='electrice-si-senzori'),
  (select id from vehicles  where slug='vw-golf-6-2011'),
  array['VW Golf 6 1.6 TDI (CAYC) · 2009–2013','VW Passat B7 1.6 TDI · 2010–2014','VW Caddy III 1.6 TDI · 2010–2015','Audi A3 8P 1.6 TDI · 2009–2012','Škoda Octavia 2 1.6 TDI · 2009–2013'], 1),

 ('far-stanga-xenon-bmw-seria-3-f30', 'Far stânga xenon — BMW Seria 3 F30',
  '63117338709', 'B', 'uzură minoră carcasă, sticlă impecabilă', 1150, null, '2012–2015', 'headlight',
  (select id from categories where slug='optica-si-faruri'),
  (select id from vehicles  where slug='bmw-320d-f30-2014'),
  array['BMW Seria 3 F30 / F31 · 2012–2015'], 1),

 ('cutie-viteze-manuala-kxx-audi-a4-b8', 'Cutie de viteze manuală 6+1 (KXX) — Audi A4 B8 2.0 TDI',
  'KXX', 'A', 'testată, rulaj verificat', 2400, null, '2008–2012', 'gearbox',
  (select id from categories where slug='cutie-de-viteze-si-transmisie'), null,
  array['Audi A4 B8 2.0 TDI · 2008–2012','Audi A5 2.0 TDI · 2008–2011'], 1),

 ('turbina-garrett-ford-focus-3-16-tdci', 'Turbină Garrett — Ford Focus 3 1.6 TDCI',
  '9673283680', 'A', 'verificată pe stand', 890, null, '2011–2015', 'turbo',
  (select id from categories where slug='motor-si-anexe'), null,
  array['Ford Focus 3 1.6 TDCI · 2011–2015','Ford C-Max 1.6 TDCI · 2010–2015','Peugeot 308 1.6 HDI · 2009–2014'], 1),

 ('oglinda-dreapta-electrica-skoda-octavia-3', 'Oglindă dreapta electrică, rabatabilă — Škoda Octavia 3',
  '7 pini', 'A', 'cu semnalizare, funcțională complet', 320, null, '2013–2017', 'mirror',
  (select id from categories where slug='caroserie-si-exterior'), null,
  array['Škoda Octavia 3 · 2013–2017'], 1),

 ('egr-complet-renault-megane-3-15-dci', 'EGR complet — Renault Megane 3 1.5 dCi',
  '8200836385', 'B', 'funcțional, curățat', 240, null, '2009–2014', 'egr',
  (select id from categories where slug='motor-si-anexe'),
  (select id from vehicles  where slug='vw-golf-6-2011'),
  array['Renault Megane 3 1.5 dCi · 2009–2014','Dacia Duster 1.5 dCi · 2010–2017','Nissan Qashqai 1.5 dCi · 2007–2013'], 1),

 ('compresor-ac-denso-toyota-rav4', 'Compresor AC Denso — Toyota RAV4',
  '88310-42270', 'A', 'testat, agent nou', 650, null, '2013–2018', 'compressor',
  (select id from categories where slug='climatizare-si-incalzire'), null,
  array['Toyota RAV4 · 2013–2018','Toyota Auris · 2012–2018'], 1),

 ('set-jante-aliaj-r17-5x112', 'Set jante aliaj R17 5x112 — VW / Audi / Seat / Škoda',
  '5x112 ET45', 'B', 'zgârieturi fine, fără îndoituri', 1100, '/ set', 'universal', 'wheel',
  (select id from categories where slug='roti-jante-si-anvelope'), null,
  array['VW · Audi · Seat · Škoda — prezon 5x112, ET45'], 1);
