-- ============================================================
-- AUTOPAS — FILTRUL MARCĂ → MODEL → PIESĂ (rulează AL TREILEA)
-- Supabase → SQL Editor → New query → lipește tot → Run
-- Adaugă listele fixe de mărci și modele + legătura cu piesele.
-- ============================================================

create table brands (
  id bigint generated always as identity primary key,
  slug text unique not null,
  nume text not null,
  ordine int not null default 0
);

create table models (
  id bigint generated always as identity primary key,
  brand_id bigint not null references brands(id) on delete cascade,
  slug text unique not null,
  nume text not null                       -- ex. "Golf 6 (2008–2013)"
);

-- fiecare piesă poate fi compatibilă cu mai multe modele
alter table products add column model_ids bigint[] not null default '{}';
create index products_model_ids_idx on products using gin (model_ids);

alter table brands enable row level security;
alter table models enable row level security;
create policy "marci publice"  on brands  for select using (true);
create policy "modele publice" on models  for select using (true);
create policy "marci admin"  on brands  for all using (is_admin()) with check (is_admin());
create policy "modele admin" on models for all using (is_admin()) with check (is_admin());

-- ============================ MĂRCI ============================
insert into brands (slug, nume, ordine) values
 ('audi','Audi',1),('bmw','BMW',2),('dacia','Dacia',3),('ford','Ford',4),
 ('nissan','Nissan',5),('opel','Opel',6),('peugeot','Peugeot',7),('renault','Renault',8),
 ('seat','Seat',9),('skoda','Škoda',10),('toyota','Toyota',11),('vw','Volkswagen',12);

-- ============================ MODELE ============================
insert into models (brand_id, slug, nume) values
 ((select id from brands where slug='audi'), 'audi-a3-8p',  'A3 8P (2003–2012)'),
 ((select id from brands where slug='audi'), 'audi-a4-b8',  'A4 B8 (2008–2015)'),
 ((select id from brands where slug='audi'), 'audi-a5',     'A5 (2007–2016)'),
 ((select id from brands where slug='audi'), 'audi-a6-c6',  'A6 C6 (2004–2011)'),
 ((select id from brands where slug='bmw'),  'bmw-seria1-e87','Seria 1 E87 (2004–2011)'),
 ((select id from brands where slug='bmw'),  'bmw-seria3-e90','Seria 3 E90 (2005–2012)'),
 ((select id from brands where slug='bmw'),  'bmw-seria3-f30','Seria 3 F30 (2012–2018)'),
 ((select id from brands where slug='bmw'),  'bmw-seria5-f10','Seria 5 F10 (2010–2017)'),
 ((select id from brands where slug='dacia'),'dacia-logan-1','Logan 1 (2004–2012)'),
 ((select id from brands where slug='dacia'),'dacia-logan-2','Logan 2 (2012–2020)'),
 ((select id from brands where slug='dacia'),'dacia-duster', 'Duster (2010–2017)'),
 ((select id from brands where slug='dacia'),'dacia-sandero-2','Sandero 2 (2012–2020)'),
 ((select id from brands where slug='ford'), 'ford-fiesta-6','Fiesta 6 (2008–2017)'),
 ((select id from brands where slug='ford'), 'ford-focus-2', 'Focus 2 (2004–2011)'),
 ((select id from brands where slug='ford'), 'ford-focus-3', 'Focus 3 (2011–2018)'),
 ((select id from brands where slug='ford'), 'ford-c-max',   'C-Max (2010–2019)'),
 ((select id from brands where slug='ford'), 'ford-mondeo-4','Mondeo 4 (2007–2014)'),
 ((select id from brands where slug='nissan'),'nissan-qashqai-j10','Qashqai J10 (2007–2013)'),
 ((select id from brands where slug='nissan'),'nissan-juke',  'Juke (2010–2019)'),
 ((select id from brands where slug='nissan'),'nissan-x-trail','X-Trail (2007–2014)'),
 ((select id from brands where slug='opel'), 'opel-astra-h', 'Astra H (2004–2014)'),
 ((select id from brands where slug='opel'), 'opel-astra-j', 'Astra J (2009–2015)'),
 ((select id from brands where slug='opel'), 'opel-corsa-d', 'Corsa D (2006–2014)'),
 ((select id from brands where slug='opel'), 'opel-insignia-a','Insignia A (2008–2017)'),
 ((select id from brands where slug='peugeot'),'peugeot-207','207 (2006–2014)'),
 ((select id from brands where slug='peugeot'),'peugeot-308','308 (2007–2014)'),
 ((select id from brands where slug='peugeot'),'peugeot-508','508 (2011–2018)'),
 ((select id from brands where slug='renault'),'renault-clio-3','Clio 3 (2005–2012)'),
 ((select id from brands where slug='renault'),'renault-megane-2','Megane 2 (2002–2009)'),
 ((select id from brands where slug='renault'),'renault-megane-3','Megane 3 (2008–2016)'),
 ((select id from brands where slug='renault'),'renault-laguna-3','Laguna 3 (2007–2015)'),
 ((select id from brands where slug='seat'), 'seat-ibiza-4', 'Ibiza 4 (2008–2017)'),
 ((select id from brands where slug='seat'), 'seat-leon-1p', 'Leon (2005–2012)'),
 ((select id from brands where slug='seat'), 'seat-altea',   'Altea (2004–2015)'),
 ((select id from brands where slug='skoda'),'skoda-fabia-2','Fabia 2 (2007–2014)'),
 ((select id from brands where slug='skoda'),'skoda-octavia-2','Octavia 2 (2004–2013)'),
 ((select id from brands where slug='skoda'),'skoda-octavia-3','Octavia 3 (2013–2020)'),
 ((select id from brands where slug='skoda'),'skoda-superb-2','Superb 2 (2008–2015)'),
 ((select id from brands where slug='toyota'),'toyota-auris','Auris (2012–2018)'),
 ((select id from brands where slug='toyota'),'toyota-corolla','Corolla (2007–2018)'),
 ((select id from brands where slug='toyota'),'toyota-rav4', 'RAV4 (2013–2018)'),
 ((select id from brands where slug='toyota'),'toyota-yaris','Yaris (2011–2019)'),
 ((select id from brands where slug='vw'),   'vw-golf-5',    'Golf 5 (2003–2008)'),
 ((select id from brands where slug='vw'),   'vw-golf-6',    'Golf 6 (2008–2013)'),
 ((select id from brands where slug='vw'),   'vw-golf-7',    'Golf 7 (2012–2019)'),
 ((select id from brands where slug='vw'),   'vw-passat-b6', 'Passat B6 (2005–2010)'),
 ((select id from brands where slug='vw'),   'vw-passat-b7', 'Passat B7 (2010–2015)'),
 ((select id from brands where slug='vw'),   'vw-caddy-3',   'Caddy III (2004–2015)'),
 ((select id from brands where slug='vw'),   'vw-polo-6r',   'Polo 6R (2009–2017)'),
 ((select id from brands where slug='vw'),   'vw-tiguan-1',  'Tiguan (2007–2016)');

-- ============ LEAGĂ cele 8 piese existente de modele ============
update products set model_ids = (select array_agg(id) from models where slug in
 ('vw-golf-6','vw-passat-b7','vw-caddy-3','audi-a3-8p','skoda-octavia-2'))
 where slug = 'alternator-bosch-vw-golf-6-16-tdi';
update products set model_ids = (select array_agg(id) from models where slug in
 ('bmw-seria3-f30')) where slug = 'far-stanga-xenon-bmw-seria-3-f30';
update products set model_ids = (select array_agg(id) from models where slug in
 ('audi-a4-b8','audi-a5')) where slug = 'cutie-viteze-manuala-kxx-audi-a4-b8';
update products set model_ids = (select array_agg(id) from models where slug in
 ('ford-focus-3','ford-c-max','peugeot-308')) where slug = 'turbina-garrett-ford-focus-3-16-tdci';
update products set model_ids = (select array_agg(id) from models where slug in
 ('skoda-octavia-3')) where slug = 'oglinda-dreapta-electrica-skoda-octavia-3';
update products set model_ids = (select array_agg(id) from models where slug in
 ('renault-megane-3','dacia-duster','nissan-qashqai-j10')) where slug = 'egr-complet-renault-megane-3-15-dci';
update products set model_ids = (select array_agg(id) from models where slug in
 ('toyota-rav4','toyota-auris')) where slug = 'compresor-ac-denso-toyota-rav4';
update products set model_ids = (select array_agg(id) from models where slug in
 ('vw-golf-6','vw-passat-b7','audi-a3-8p','audi-a4-b8','skoda-octavia-2','skoda-octavia-3','seat-leon-1p'))
 where slug = 'set-jante-aliaj-r17-5x112';
