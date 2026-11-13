-- ANULAREA MIGRĂRII 56 (OLX) — DOAR LA NEVOIE. Fără `cascade`.
-- Se pierd: tokenii (se reconectează din Integrări), potrivirile categoriilor, catalogul și jurnalul.
-- Se oprește dacă există deja migrarea 57 (olx_anunturi): aceea se anulează întâi.
begin;
do $$ begin
  if to_regclass('public.olx_anunturi') is not null then
    raise exception 'Există olx_anunturi (migrarea 57). Anulează-o întâi.';
  end if;
end $$;
drop function if exists public.olx_consuma_starea(text);
drop function if exists public.olx_elibereaza(uuid);
drop function if exists public.olx_ia_blocarea(uuid, int);
drop table if exists public.olx_mapari;
drop table if exists public.olx_categorii;
drop table if exists public.olx_apeluri;
drop table if exists public.olx_blocare;
drop table if exists public.olx_cont;
commit;
