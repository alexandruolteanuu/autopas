-- ============================================================
-- DIAGNOSTIC: BAZA NU RĂSPUNDE (16 noiembrie 2026)
-- DOAR CITIRE: nu schimbă și nu oprește nimic. Se rulează în SQL Editor
-- și se trimite rezultatul fiecărei interogări.
-- ============================================================

-- 1. Ce interogări rulează ACUM și de cât timp (cele mai vechi primele).
select pid,
       now() - query_start as durata,
       state,
       wait_event_type,
       wait_event,
       usename,
       application_name,
       left(query, 200) as interogare
  from pg_stat_activity
 where state <> 'idle'
   and pid <> pg_backend_pid()
 order by durata desc nulls last;

-- 2. Câte conexiuni sunt deschise, pe stare, față de maximul permis.
select state, count(*) as conexiuni,
       (select setting::int from pg_settings where name = 'max_connections') as maxim
  from pg_stat_activity
 group by state
 order by conexiuni desc;

-- 3. Cine așteaptă după cine (blocaje / lacăte).
select blocat.pid                     as pid_blocat,
       left(blocat.query, 120)        as interogare_blocata,
       now() - blocat.query_start     as asteapta_de,
       blocant.pid                    as pid_blocant,
       left(blocant.query, 120)       as interogare_blocanta,
       blocant.state                  as stare_blocant
  from pg_stat_activity blocat
  join pg_stat_activity blocant
    on blocant.pid = any (pg_blocking_pids(blocat.pid))
 order by asteapta_de desc;

-- 4. Cozile automate (OLX, dez.ro, e-mail): câte rânduri așteaptă.
select 'olx_coada' as coada, count(*) from public.olx_coada
union all select 'dezro_coada', count(*) from public.dezro_coada
union all select 'email_coada (netrimise)', count(*) from public.email_coada where trimis_la is null;
