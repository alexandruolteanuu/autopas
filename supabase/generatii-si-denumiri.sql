-- ============================================================
-- AUTOPAS — GENERAȚIILE LIPSĂ, ANII LOR ȘI DENUMIRILE OFICIALE
-- (rulează AL DOUĂZECI ȘI ȘASELEA)
-- Supabase → SQL Editor → New query → lipește tot → Run
-- IDEMPOTENTĂ: se poate re-rula oricând.
--
-- Toate cifrele de mai jos sunt MĂSURATE pe cele 8.754 de piese importate, nu
-- presupuse. Metoda: anii din titlurile pieselor legate de UN SINGUR model —
-- la piesele legate de mai multe, intervalul e poluat de compatibilități.
--
-- ⚠ CONȚINE DOUĂ ȘTERGERI DE RÂNDURI (partea 4). Sunt unificări de duplicate,
--   cu piesele mutate înainte de ștergere. Citește partea aceea înainte să rulezi.
-- ============================================================


-- ============================================================
-- 1. DENUMIRILE OFICIALE ALE PRODUCĂTORULUI
--
-- Regula noastră de majusculă inițială (`numeModelNou` din potrivire.mjs) a
-- transformat 6 modele. La cinci a greșit: Hyundai își scrie seria „i" cu literă
-- mică, iar aia e denumirea pe care o caută omul. La al șaselea a avut dreptate —
-- Citroën chiar scrie „Jumpy", deci rămâne așa.
--
-- `bZ4X` nu vine din runda asta, e din tabela moștenită, dar e aceeași greșeală.
--
-- Codul a fost reparat în același timp: `numeModelNou` nu mai atinge numele care
-- încep cu una-două litere mici urmate de cifră („i20", „ix35", „bz4x", „e208").
-- ============================================================
update models set nume = 'i10'  where nume = 'I10';
update models set nume = 'i20'  where nume = 'I20';
update models set nume = 'i30'  where nume = 'I30';
update models set nume = 'i40'  where nume = 'I40';
update models set nume = 'ix35' where nume = 'Ix35';
update models set nume = 'bZ4X' where nume = 'BZ4X';


-- ============================================================
-- 2. GENERAȚIILE CARE LIPSEAU CU TOTUL
--
-- 138 de piese rămăseseră fără model nu fiindcă le lipseau anii unei generații
-- pe care o avem, ci fiindcă generația lor NU EXISTĂ în tabelă. Verificat pe
-- titluri: la Focus, Superb și Octavia piesele blocate sunt din generația VECHE,
-- nu din cea nouă.
--
-- Numele urmează convenția deja folosită în tabelă („Caddy III" -> „Caddy IV",
-- „Qashqai J10" -> „Qashqai J11").
-- ============================================================
insert into models (brand_id, slug, nume, an_start, an_final)
select b.id, x.slug, x.nume, x.an_start, x.an_final
from (values
  -- marcă,      slug,                   nume,             de la, până la   (piese deblocate · dovada din titluri)
  ('nissan',  'nissan-qashqai-j11', 'Qashqai J11', 2013, 2021),  -- 31 · toate între 2014 și 2020
  ('skoda',   'skoda-fabia-1',      'Fabia 1',     1999, 2007),  -- 31 · 1998–2006, în 13 intervale distincte
  ('ford',    'ford-focus-1',       'Focus 1',     1998, 2004),  -- 17 · 1998–2003
  ('vw',      'vw-caddy-v',         'Caddy V',     2020, null),  -- 14 · 2020–2024
  ('vw',      'vw-touran-2',        'Touran 2',    2015, null),  -- 14 · 2016–2020
  ('skoda',   'skoda-superb-4',     'Superb 4',    2023, null),  -- 13 · 2024–2026
  ('skoda',   'skoda-fabia-4',      'Fabia 4',     2021, null),  --  9 · 2021–2024
  ('vw',      'vw-caddy-iv',        'Caddy IV',    2015, 2020),  --  4 · 2016–2019
  ('skoda',   'skoda-octavia-1',    'Octavia 1',   1996, 2004),  --  2 · 1999–2003  (vezi nota de mai jos)
  ('seat',    'seat-ibiza-3',       'Ibiza 3',     2002, 2008),  --  1 · 2002–2005
  ('seat',    'seat-ibiza-2',       'Ibiza 2',     1993, 2002),  --  1 · 1998–2001
  ('renault', 'renault-espace-4',   'Espace 4',    2002, 2014)   --  1 · 2004–2008
) as x(marca, slug, nume, an_start, an_final)
join brands b on b.slug = x.marca
on conflict (slug) do nothing;

-- NOTA despre Octavia 1: în realitate s-a fabricat până în 2010, în paralel cu
-- Octavia 2, sub numele „Octavia Tour". Dacă i-am fi pus 1996–2010, intervalul
-- s-ar fi suprapus peste „Octavia 2 (2004–2013)" și **147 de piese care azi se
-- potrivesc corect ar fi devenit ambigue** (măsurat). Cele 2 piese blocate sunt
-- din 1999–2003, deci 1996–2004 le prinde pe amândouă fără să strice nimic.
-- Un capăt de interval e aici o unealtă de dezambiguizare, nu o dată istorică.


-- ============================================================
-- 3. ANII PE MODELELE CARE ÎI AVEAU GOI
--
-- Se scrie doar unde e gol, ca o valoare pusă de operator să nu fie suprascrisă.
-- Fiecare interval e confirmat de titlurile pieselor legate de modelul acela
-- singur; numărul lor e trecut în comentariu.
-- ============================================================
update models m set an_start = x.an_start, an_final = x.an_final
from (values
  ('Fabia 3',   2014, 2021),   -- 11 piese: 2014–2021, exact
  ('Superb 3',  2015, 2023),   -- 50 piese: 2013–2022 (2013 e un caz izolat; p10 = 2015)
  ('Focus 4',   2018, 2025),   -- 15 piese: 2018–2024
  ('Octavia 4', 2019, null),   -- 31 piese: 2020–2026
  ('Logan 3',   2020, null),   --  2 piese: 2020–2024
  ('Sandero 3', 2020, null),   -- 15 piese: 2020–2024
  ('Mondeo 5',  2014, 2022),   --  6 piese: 2015–2022
  ('Mondeo 3',  2000, 2007),   -- 20 piese: 2001–2006
  ('A8 D4',     2010, 2017),   --  0 legate, dar 2 blocate: 2011–2017 → le deblochează
  ('A8 D5',     2017, null),   -- generația 2017+ (vezi partea 4: „A8 4N" e același model)
  ('Fiesta 5',  2002, 2008),   --  1 legată + 6 blocate: 2002–2007 → le deblochează
  ('Fiesta 7',  2017, 2023)    -- vezi partea 4: „Fiesta 8" e același model
) as x(nume, an_start, an_final)
where m.nume = x.nume and m.an_start is null and m.an_final is null;

-- RĂMÂN INTENȚIONAT FĂRĂ ANI, și nu e o scăpare:
--
--   · „Focus C-Max" și „Logan MCV" — amândouă sunt candidate pentru liniile
--     altui model, fiindcă numele lor începe cu numele aceluia („Focus …",
--     „Logan …"). Cu anii puși, o piesă de Focus din 2006 s-ar potrivi și cu
--     „Focus 2 (2004–2011)", și cu „Focus C-Max (2003–2010)" → ar deveni ambiguă
--     și AR PIERDE modelul pe care îl are azi. Completarea ar strica, nu repara.
--     Regulă generală: într-un grup de candidați, intervalele nu au voie să se
--     suprapună. Un model care nu e generație a celuilalt n-are ce căuta în grup,
--     iar până rezolvăm asta, gol e mai sigur decât plin.
--
--   · „Ibiza 5" — datele contrazic: singura piesă legată de el are 2008–2012,
--     adică intervalul lui „Ibiza 4 (2008–2017)". O piesă nu tranșează nimic.
--
--   · „Espace 5" — o singură piesă (2015–2019). Nu contrazice, dar nici nu
--     confirmă, iar piesa blocată e din 2004–2008, deci ține de „Espace 4".


-- ============================================================
-- 4. ⚠ UNIFICĂRI DE DUPLICATE — AICI SE ȘTERG DOUĂ RÂNDURI
--
-- Două mașini apar în tabelă sub două nume, fiindcă vânzătorii le numesc în
-- ambele feluri. Piesele se mută pe rândul păstrat ÎNAINTE de ștergere, deci nu
-- se pierde nicio legătură.
--
--   a) „A8 4N" = „A8 D5". 4N e codul intern al generației D5 (2017+). Ambele au
--      titluri 2017–2025. Se păstrează „A8 D5"; „A8 4N" avea 24 de piese.
--
--   b) „Fiesta 8" = „Fiesta 7". Nu e un facelift trecut greșit ca generație, cum
--      părea la prima vedere: titlurile arată că vânzătorii scriu AMÂNDOUĂ
--      numerele pentru ACELAȘI an — „Ford Fiesta 7 2017 2018 2019" lângă „Ford
--      Fiesta mk8 2017 2018 2019 2020". Sunt două convenții de numerotare pentru
--      aceeași mașină, nu două mașini. Se păstrează „Fiesta 7" (tabela are deja
--      „Fiesta 6 (2008–2017)", deci 2017+ e a șaptea); „Fiesta 8" avea 6 piese.
--
-- `lib/import/potrivire.mjs` a primit în același timp aliasurile „audi|a8 4n" ->
-- „a8 d5" și „ford|fiesta 8" -> „fiesta 7". Fără ele, primul import ar recrea
-- exact rândurile șterse aici.
-- ============================================================
do $$
declare
  vechi bigint; nou bigint;
begin
  for vechi, nou in
    select v.id, n.id
    from (values ('A8 4N', 'A8 D5'), ('Fiesta 8', 'Fiesta 7')) as x(de_la, la)
    join models v on v.nume = x.de_la
    join models n on n.nume = x.la and n.brand_id = v.brand_id
  loop
    -- piesele trec pe modelul păstrat, fără dubluri în array
    update products p
    set model_ids = (select array_agg(distinct e) from unnest(array_replace(p.model_ids, vechi, nou)) e)
    where p.model_ids @> array[vechi];

    delete from models where id = vechi;
  end loop;
end $$;


-- ============================================================
-- 5. CE A IEȘIT
-- ============================================================
select count(*) as modele,
       count(an_start) as cu_ani,
       count(*) - count(an_start) as fara_ani
from models;
