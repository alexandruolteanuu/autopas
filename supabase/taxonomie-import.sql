-- ============================================================
-- MIGRAREA 18 — completări de taxonomie cerute de importul din pieseauto.ro
--
-- Adaugă două subcategorii și modelele de mașini pe care le cer piesele reale
-- din eșantionul de 50, dar care lipsesc din baza noastră.
--
-- IDEMPOTENT: `on conflict (slug) do nothing`. A doua rulare nu schimbă nimic.
-- Se rulează în Supabase → SQL Editor.
-- ============================================================

-- ---------- 1. Subcategorii noi ----------
-- Ambele au cel puțin 3 piese în eșantion, deci trec pragul de creare.
-- Numele sunt scrise în stilul celorlalte categorii: română, cu diacritice,
-- nu slug-ul din URL-ul sursei.
insert into categories (slug, nume, art, ordine, parent_id) values
  ('motor-si-anexe-intercooler',                 'Intercooler',           'engine', 13, 1),
  ('caroserie-si-exterior-broaste-si-incuietori','Broaște și încuietori', 'panel',  13, 3)
on conflict (slug) do nothing;

-- „Ștergătoare și spălare parbriz" NU se creează încă: are o singură piesă în
-- eșantion, sub pragul de 3. Piesele rămân pe „Caroserie și exterior" și sunt
-- marcate pentru revizuire. Se reevaluează la rularea completă.

-- ---------- 2. Modele care lipsesc ----------
-- Convenția de slug: `{marca}-{model}`. Numele conțin generația și intervalul
-- de ani, ca la celelalte — intervalul e folosit de import ca să deducă
-- generația atunci când sursa spune doar „Skoda Octavia", fără număr.
insert into models (brand_id, slug, nume) values
  ((select id from brands where slug = 'vw'),   'vw-touran-1', 'Touran 1 (2003–2015)'),
  ((select id from brands where slug = 'audi'), 'audi-a8-4e',  'A8 4E (2002–2010)')
on conflict (slug) do nothing;

-- ────────────────────────────────────────────────────────────
-- NU am adăugat Caddy, Galaxy și Jetta. Motivele, pe rând:
--
--   Caddy   — EXISTĂ deja, ca `vw-caddy-3` / „Caddy III (2004–2015)". Raportul
--             meu anterior a greșit: piesele nu se potriveau fiindcă sursa scrie
--             doar „Caddy", fără generație. Deducerea după ani le rezolvă acum.
--             „Caddy Life" e versiune de echipare, nu model separat, deci merge
--             tot la Caddy III (tratat în `ALIAS_MODELE` din scriptul de import).
--
--   Galaxy  — piesa care cerea „Ford Galaxy" are titlul „Debitmetru Aer Vw SHARAN".
--             Sharan și Galaxy sunt gemene de platformă, iar sursa a ales-o pe
--             cealaltă. Dacă adăugăm ceva, ar trebui să fie VW Sharan, nu Galaxy.
--
--   Jetta   — piesa care cerea „Volkswagen Jetta" are titlul „Maneta Tempomat Vw
--             GOLF 5", iar Golf 5 există deja la noi. Sursa a greșit.
--
-- Ambele au fost prinse de verificarea pe titlu. Dacă vrei totuși modelele,
-- decomentează — sunt reale și se vând în România, doar că eșantionul de 50 nu
-- le cere:
--
-- insert into models (brand_id, slug, nume) values
--   ((select id from brands where slug = 'vw'),   'vw-sharan-1', 'Sharan 1 (1995–2010)'),
--   ((select id from brands where slug = 'vw'),   'vw-jetta-5',  'Jetta 5 (2005–2010)'),
--   ((select id from brands where slug = 'ford'), 'ford-galaxy-2','Galaxy 2 (2006–2015)')
-- on conflict (slug) do nothing;
-- ────────────────────────────────────────────────────────────

-- ---------- 3. Verificare ----------
select 'categorii noi' as ce, slug, nume from categories
 where slug in ('motor-si-anexe-intercooler','caroserie-si-exterior-broaste-si-incuietori');

select 'modele noi' as ce, m.slug, m.nume, b.nume as marca
  from models m join brands b on b.id = m.brand_id
 where m.slug in ('vw-touran-1','audi-a8-4e');
