-- ============================================================
-- AUTOPAS — MĂRCILE CARE LIPSEAU DIN FILTRU (rulează AL DOUĂZECI ȘI CINCILEA)
-- Supabase → SQL Editor → New query → lipește tot → Run
-- IDEMPOTENTĂ: se poate re-rula oricând.
--
-- DE CE:
-- Tabela `brands` avea 19 mărci și era, vizibil, o listă de dealer de mașini noi
-- (BYD, Cherry, OMODA, JAECOO). Feed-ul pieseauto.ro acoperă însă ~44 de mărci.
-- Din cele 1.912 piese rămase fără model după importul din 26 august 2026, 1.473
-- aveau compatibilitatea citită CURAT de pe pagină („Mercedes A-Class W168",
-- „Mazda 2") și cădeau dintr-un singur motiv: marca nu exista la noi.
--
-- Numărul de piese de lângă fiecare marcă e MĂSURAT în feed la 28 august 2026,
-- nu estimat. `ordine` urmează același clasament, ca mărcile grele să fie sus.
--
-- Fără prag: o marcă cu 8 piese (Alfa Romeo) intră la fel ca una cu 311.
-- Decizia utilizatorului, 28 august 2026: la subcategorii pragul are sens, fiindcă
-- prea multe diluează filtrarea; la mărci e invers — cine caută Alfa Romeo caută
-- exact asta, iar 8 piese invizibile sunt 8 piese pierdute.
-- Curățenia din meniu se face la AFIȘARE, nu prin ștergere: filtrul de pe site
-- arată doar mărcile cu cel puțin o piesă publicată (vezi `marciCuPiese` din
-- lib/format.ts), așa că BYD/Cherry/OMODA/JAECOO dispar singure din interfață,
-- fără să ștergem un rând.
--
-- Numele sunt scrise EXACT cum le scrie sursa în liniile de compatibilitate,
-- fiindcă `despartCompat` potrivește pe `nume` și pe `slug`. Verificat pe toate
-- cele 12.410 linii de compatibilitate din bază: sursa scrie „Mercedes …",
-- niciodată „Mercedes-Benz"; „Land Rover …", niciodată „Range Rover"; nu apar
-- deloc „VAG" sau „MB". De aceea tabelul de sinonime are un singur rând (KGM),
-- nu zece inventate din memorie.
-- ============================================================

-- ---------- 1. SsangYong: redenumire, nu marcă nouă ----------
-- Rândul există deja, sub numele corporativ de azi („KGM Ssangyong"). Cine caută
-- o piesă de Rexton scrie „SsangYong". Sursa scrie tot așa, în toate cele 68 de
-- linii de compatibilitate măsurate. „KGM" rămâne ca sinonim, în cod
-- (`SINONIME_MARCI` din lib/import/potrivire.mjs), ca un feed viitor care ar
-- scrie numele nou să fie tot recunoscut.
-- Se face ÎNAINTE de insert, ca re-rularea să nu creeze un al doilea rând.
update brands set nume = 'SsangYong', slug = 'ssangyong', ordine = 21
where slug = 'kgm-ssangyong';

-- ---------- 2. mărcile absente ----------
insert into brands (slug, nume, ordine) values
  ('mercedes',    'Mercedes',    13),   -- 311 piese
  ('mazda',       'Mazda',       14),   -- 282
  ('hyundai',     'Hyundai',     15),   -- 196
  ('fiat',        'Fiat',        16),   -- 127
  ('suzuki',      'Suzuki',      17),   --  78
  ('chevrolet',   'Chevrolet',   18),   --  77
  ('land-rover',  'Land Rover',  19),   --  73
  ('citroen',     'Citroen',     20),   --  68
  ('kia',         'Kia',         22),   --  45
  ('lexus',       'Lexus',       23),   --  26
  ('cupra',       'Cupra',       24),   --  25
  ('jaguar',      'Jaguar',      25),   --  23
  ('mitsubishi',  'Mitsubishi',  26),   --  18
  ('mini',        'Mini',        27),   --  14
  ('porsche',     'Porsche',     28),   --  13
  ('honda',       'Honda',       29),   --  12
  ('smart',       'Smart',       30),   --  11
  ('jeep',        'Jeep',        31),   --  10
  ('alfa-romeo',  'Alfa Romeo',  32),   --   8
  ('subaru',      'Subaru',      33),   --   4
  ('lancia',      'Lancia',      34),   --   4
  ('dodge',       'Dodge',       35),   --   2
  ('iveco',       'Iveco',       36)    --   2
on conflict (slug) do nothing;

-- NU se adaugă „Altă marcă": cele 24 de piese care o au scrisă în compatibilitate
-- sunt piese pentru care SURSA ÎNSĂȘI spune că nu știe mașina („Altă marcă Alt
-- model"). Rămân fără model, corect — regula din E.2 e că ce nu se poate
-- determina cu certitudine rămâne gol.

-- ---------- ce a ieșit ----------
select count(*) as marci_total from brands;
