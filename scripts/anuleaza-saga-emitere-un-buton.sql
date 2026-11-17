-- ============================================================
-- ANULAREA MIGRĂRII 60 (supabase/saga-emitere-un-buton.sql) — doar la nevoie.
--
-- Pune înapoi EXACT `facturi_pazeste` din 49, scoate ceasul, funcțiile, indexul,
-- triggerul `stornata`, tabelele `saga_trezire` și `facturi_incercari` și coloanele noi.
-- Fără `cascade`: dacă ceva depinde de un obiect, se oprește.
--
-- REFUZĂ dacă vreo factură e în „se_trimite” sau „de_verificat” (stări pe care 49 nu le
-- cunoaște) sau dacă o factură a fost renumerotată (jurnalul încercărilor e urma ei).
-- După anulare, butonul din admin nu mai merge până la re-rularea migrării 60.
-- ============================================================
begin;

do $$
declare w text;
begin
  select md5(replace(prosrc, E'\r', '')) into w from pg_proc where oid = to_regprocedure('public.facturi_pazeste()');
  if w is distinct from 'f8bccca0f490afa7f2ccf5a96d4be32d' then
    raise exception 'OPRIT: facturi_pazeste din bază nu e versiunea din 60 (amprenta %). Nu se anulează nimic.', w;
  end if;
  if exists (select 1 from public.facturi where saga_status in ('se_trimite', 'de_verificat')) then
    raise exception 'OPRIT: există facturi în „se_trimite” / „de_verificat”. Termină-le întâi (sau treci-le în „eroare”).';
  end if;
  if exists (select 1 from public.facturi where renumerotari > 0) then
    raise exception 'OPRIT: există facturi renumerotate de motor; jurnalul lor (facturi_incercari) nu se șterge.';
  end if;
end $$;

select cron.unschedule('saga-coada') where exists (select 1 from cron.job where jobname = 'saga-coada');

drop function if exists public.saga_ceas();
drop table if exists public.saga_trezire;
drop function if exists public.facturi_elibereaza(bigint, uuid, text);
drop function if exists public.facturi_renumeroteaza(bigint, uuid);
drop function if exists public.saga_factura_ia(bigint, uuid);
drop function if exists public.emite_factura_start(bigint);
drop function if exists public.facturi_porneste(bigint);
drop function if exists public.factura_lipsuri(bigint);
drop table if exists public.facturi_incercari;
drop index if exists public.facturi_o_activa_pe_comanda;
drop trigger if exists facturi_tine_stornata on public.facturi;
drop function if exists public.facturi_tine_stornata();

-- facturi_pazeste EXACT din 49 (supabase/saga-facturi.sql).
create or replace function public.facturi_pazeste()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  stare_coloane constant text[] := array['saga_status', 'saga_eroare', 'saga_trimisa_la',
                                         'confirmata_la', 'confirmata_de', 'updated_at'];
begin
  if tg_op = 'DELETE' then
    if old.saga_status <> 'de_trimis' then
      raise exception 'Factura % % a plecat deja spre SAGA (stare: %) — nu se mai șterge. Se stornează.',
        old.serie, old.numar, old.saga_status;
    end if;
    return old;
  end if;

  if (new.id, new.tip, new.storno_pentru, new.order_id, new.serie, new.numar)
     is distinct from (old.id, old.tip, old.storno_pentru, old.order_id, old.serie, old.numar) then
    raise exception 'Seria, numărul, comanda și tipul unei facturi nu se schimbă niciodată (factura % %).',
      old.serie, old.numar;
  end if;

  if old.saga_status in ('in_curs', 'trimisa', 'confirmata') then
    if (to_jsonb(new) - stare_coloane) is distinct from (to_jsonb(old) - stare_coloane) then
      raise exception 'Factura % % a plecat spre SAGA (stare: %): conținutul ei nu se mai modifică. Corecturile se fac în SAGA, iar în aplicație rămâne stornarea.',
        old.serie, old.numar, old.saga_status;
    end if;
    if old.saga_status = 'confirmata' and new.saga_status <> 'confirmata' then
      raise exception 'Factura % % e confirmată în SAGA; starea ei nu mai poate da înapoi.', old.serie, old.numar;
    end if;
    if old.saga_status = 'trimisa' and new.saga_status not in ('trimisa', 'confirmata') then
      raise exception 'Factura % % e trimisă în SAGA; poate trece doar în „confirmata”.', old.serie, old.numar;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function public.facturi_pazeste() from public;

alter table public.facturi drop constraint if exists facturi_saga_status_check;
alter table public.facturi add constraint facturi_saga_status_check
  check (saga_status in ('de_trimis', 'in_curs', 'trimisa', 'eroare', 'confirmata'));

alter table public.facturi drop column if exists stornata;
alter table public.facturi drop column if exists reincearca_la;
alter table public.facturi drop column if exists reincercari;
alter table public.facturi drop column if exists renumerotari;
alter table public.facturi drop column if exists lacat_de;
alter table public.facturi drop column if exists lacat_pana;

-- Verificarea: amprenta 49 → true
select md5(replace(prosrc, E'\r', '')) = 'a2b12d08e988b102abc939e3d533fff6' as paza_49
  from pg_proc where oid = to_regprocedure('public.facturi_pazeste()');

commit;
