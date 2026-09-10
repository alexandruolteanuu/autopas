-- ============================================================
-- „SENZORI AUTO" DESPĂRȚIT ÎN CATEGORIILE PE CARE LE ARE ȘI dez.ro
-- 10 septembrie 2026 · migrarea 40 · date, nu schemă
--
-- DE CE
-- „Senzori auto" (id 196) era un sac: radare ACC/distronic, senzori de unghi
-- mort, senzori de impact pentru pietoni, senzori de impact de airbag, senzori
-- de parcare, de ploaie, de presiune DPF. Pe dez.ro fiecare dintre ele e o
-- categorie DIFERITĂ, deci categoria noastră n-avea cum să fie mapată la una
-- singură — 84 de piese nu se puteau publica. O mapare forțată le-ar fi trimis
-- pe majoritatea în categorie greșită, iar moderatorii lor verifică exact asta.
-- Despărțirea ajută și site-ul: filtrul arată de acum ce fel de senzor e.
--
-- CE FACE
--   1. cinci subcategorii noi sub „Electrice și senzori" (id 5);
--   2. mută piesele din 196 după titlu, ÎN ORDINEA de mai jos — ordinea e
--      regula: „Radar / Senzor blind spot" conține „radar", dar e un senzor de
--      unghi mort, deci unghiul mort se prinde primul;
--   3. leagă subcategoriile noi de categoriile dez.ro (`dezro_mapari`,
--      `sursa = 'om'`, ca o resincronizare automată să nu le calce).
--
-- CE NU FACE
--   · nu atinge piesele cu `editat_manual` — acolo a decis un om;
--   · nu șterge categoria 196: în ea rămân senzorii pentru care dez.ro n-are
--     corespondent (nivel faruri, nivel pernă de aer, deschidere haion);
--   · nu schimbă nimic altceva pe piese.
--
-- IDEMPOTENTĂ: categoriile au `on conflict (slug) do nothing`, iar fiecare
-- UPDATE atinge doar piese aflate ÎNCĂ în 196. A doua rulare nu schimbă nimic.
-- Piesele mutate intră singure în coada dez.ro (triggerul din migrarea 39).
-- ============================================================

-- 1. Subcategoriile noi. Slug-ul, `art` și `ordine` urmează tiparul surorilor.
insert into categories (nume, slug, parent_id, art, ordine) values
  ('Radar distronic (ACC)',  'electrice-si-senzori-radar-distronic-acc',   5, 'alternator', 46),
  ('Senzor impact pietoni',  'electrice-si-senzori-senzor-impact-pietoni', 5, 'alternator', 47),
  ('Senzor unghi mort',      'electrice-si-senzori-senzor-unghi-mort',     5, 'alternator', 48),
  ('Senzor impact airbag',   'electrice-si-senzori-senzor-impact-airbag',  5, 'alternator', 49),
  ('Senzor unghi volan',     'electrice-si-senzori-senzor-unghi-volan',    5, 'alternator', 50)
on conflict (slug) do nothing;

-- 2. Mutarea pieselor. O funcție mică, ca fiecare pas să fie o singură linie
--    și ordinea să se citească de sus în jos.
create or replace function pg_temp.muta_din_senzori_auto(p_slug text, p_regex text)
returns void language sql as $$
  update products p
     set categorie_id    = c.parent_id,
         subcategorie_id = c.id
    from categories c
   where c.slug = p_slug
     and p.subcategorie_id = 196
     and p.editat_manual is not true
     and p.nume ~* p_regex;
$$;

select pg_temp.muta_din_senzori_auto('electrice-si-senzori-senzor-unghi-mort',     'blind spot|unghi mort');
select pg_temp.muta_din_senzori_auto('electrice-si-senzori-senzor-impact-pietoni', 'pietoni');
select pg_temp.muta_din_senzori_auto('electrice-si-senzori-radar-distronic-acc',   'distronic|radar|\macc\M');
select pg_temp.muta_din_senzori_auto('electrice-si-senzori-senzor-impact-airbag',  'impact|airbag');
select pg_temp.muta_din_senzori_auto('electrice-si-senzori-senzor-unghi-volan',    'unghi volan');
-- În categorii care existau deja și sunt mapate:
select pg_temp.muta_din_senzori_auto('accesorii-auto-senzori-parcare',             'parcare');
select pg_temp.muta_din_senzori_auto('electrice-si-senzori-senzori-ploaie',        'ploaie');
select pg_temp.muta_din_senzori_auto('electrice-si-senzori-senzor-presiune-gaze-evacuare',
                                     'presiune diferentiala|filtru particule|presiune gaze');
select pg_temp.muta_din_senzori_auto('electrice-si-senzori-senzor-esp',            '\mesp\M');

-- 3. Legătura cu dez.ro. Id-urile lor sunt verificate în `dezro_catalog`
--    (toate `selectabil = true`).
insert into dezro_mapari (fel, local_id, dezro_id, sursa, nota, actualizat_de)
select 'categorie', c.id, v.dezro_id, 'om', v.nota, 'migrarea 40 (senzori-auto-despartire.sql)'
from (values
  ('electrice-si-senzori-radar-distronic-acc',   395, 'la ei „Modul distronic"'),
  ('electrice-si-senzori-senzor-impact-pietoni', 500, 'la ei „Senzor pietoni/pedestrian"'),
  ('electrice-si-senzori-senzor-unghi-mort',     587, 'la ei „Senzor unghi mort"'),
  ('electrice-si-senzori-senzor-impact-airbag',  362, 'la ei „Senzor impact"'),
  ('electrice-si-senzori-senzor-unghi-volan',    240, 'la ei „Senzor unghi bracaj"')
) as v(slug, dezro_id, nota)
join categories c on c.slug = v.slug
on conflict (fel, local_id) do update
  set dezro_id = excluded.dezro_id, sursa = excluded.sursa, nota = excluded.nota,
      actualizat_de = excluded.actualizat_de, actualizat_la = now();

-- Verificare: ce a rămas în „Senzori auto".
select p.nume from products p where p.subcategorie_id = 196 order by p.nume;

-- ============================================================
-- PARTEA A DOUA (aceeași zi): ultimii 11 senzori rămași în 196
--
-- După prima parte au rămas în „Senzori auto" senzori de nivel faruri/xenon
-- (8), de nivel pernă de aer (2) și unul de deschidere a haionului (1). Pentru
-- ei dez.ro n-are categorie exactă; cele de mai jos sunt cele mai apropiate.
-- Nivelul farurilor merge la „Instalatie xenon" fiindcă reglajul automat al
-- farurilor e cerut exact de sistemul xenon — APROXIMATIV, notat în mapare.
-- După partea asta 196 rămâne goală, dar NU se șterge: nu strică nimic și
-- poate primi piese la un import viitor.
-- ============================================================
insert into categories (nume, slug, parent_id, art, ordine) values
  ('Senzor nivel faruri',      'electrice-si-senzori-senzor-nivel-faruri',      5, 'alternator', 51),
  ('Senzor nivel suspensie',   'electrice-si-senzori-senzor-nivel-suspensie',   5, 'alternator', 52),
  ('Senzor deschidere haion',  'electrice-si-senzori-senzor-deschidere-haion',  5, 'alternator', 53)
on conflict (slug) do nothing;

create or replace function pg_temp.muta_din_senzori_auto(p_slug text, p_regex text)
returns void language sql as $$
  update products p
     set categorie_id    = c.parent_id,
         subcategorie_id = c.id
    from categories c
   where c.slug = p_slug
     and p.subcategorie_id = 196
     and p.editat_manual is not true
     and p.nume ~* p_regex;
$$;

select pg_temp.muta_din_senzori_auto('electrice-si-senzori-senzor-nivel-faruri',     'nivel (far|xenon)');
select pg_temp.muta_din_senzori_auto('electrice-si-senzori-senzor-nivel-suspensie',  'perna aer');
select pg_temp.muta_din_senzori_auto('electrice-si-senzori-senzor-deschidere-haion', 'haion');

insert into dezro_mapari (fel, local_id, dezro_id, sursa, nota, actualizat_de)
select 'categorie', c.id, v.dezro_id, 'om', v.nota, 'migrarea 40 (senzori-auto-despartire.sql)'
from (values
  ('electrice-si-senzori-senzor-nivel-faruri',     48,  'APROXIMATIV: la ei nu exista senzor de nivel faruri; reglajul automat tine de sistemul xenon'),
  ('electrice-si-senzori-senzor-nivel-suspensie',  219, 'la ei „Suspensie"'),
  ('electrice-si-senzori-senzor-deschidere-haion', 325, 'la ei „Actionare haion electric"')
) as v(slug, dezro_id, nota)
join categories c on c.slug = v.slug
on conflict (fel, local_id) do update
  set dezro_id = excluded.dezro_id, sursa = excluded.sursa, nota = excluded.nota,
      actualizat_de = excluded.actualizat_de, actualizat_la = now();

select p.nume from products p where p.subcategorie_id = 196 order by p.nume;
