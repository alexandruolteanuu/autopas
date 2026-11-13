-- ANULAREA MIGRĂRII 57 (OLX) — DOAR LA NEVOIE. Fără `cascade`.
-- REFUZĂ dacă există anunțuri reale (advert_id completat): s-ar pierde legătura cu ele.
begin;
do $$ begin
  if to_regclass('public.olx_anunturi') is not null
     and exists (select 1 from public.olx_anunturi where advert_id is not null) then
    raise exception 'Există anunțuri OLX reale în olx_anunturi. Retrage-le întâi; anularea ar pierde legătura cu ele.';
  end if;
end $$;
drop table if exists public.olx_anunturi;
commit;
