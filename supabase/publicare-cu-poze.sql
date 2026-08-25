-- ============================================================
-- MIGRAREA 21 — o piesă importată nu se poate publica fără poze
--
-- CE S-A ÎNTÂMPLAT (25 august 2026)
-- Opt piese venite din import au ajuns publicate pe site fără nicio poză.
-- Nu ruta /api/publica-piesa le-a publicat — ea scrie `publicat` și
-- `poze_descarcate` în aceeași instrucțiune, iar cele opt aveau
-- `poze_descarcate = false`. Au fost publicate din interfață, care are trei căi
-- ce scriu direct în `products`, fără nicio verificare:
--   · comutatorul de pe fiecare rând din /admin/produse
--   · acțiunea în masă „publică" pe selecție
--   · bifa „publicat" din formularul de produs
--
-- Degeaba facem ruta mai strictă dacă trei butoane o ocolesc. Regula stă acum
-- în bază, unde nu există cale de ocolire.
--
-- DE CE DOAR PIESELE IMPORTATE
-- Site-ul afișează intenționat o ilustrație desenată (`ProductPhoto` ->
-- `PartArt`) când o piesă n-are poze, iar o piesă introdusă manual poate fi
-- publicată așa. Interdicția se aplică doar pieselor cu `sursa` completată:
-- acolo pozele EXISTĂ la sursă, iar o piesă fără ele înseamnă că descărcarea
-- n-a rulat — nu o alegere a operatorului.
--
-- Trigger, nu CHECK: un CHECK aruncă „new row violates check constraint
-- products_...", pe care operatorul n-are cum s-o înțeleagă. Triggerul spune
-- în română ce lipsește și ce are de făcut.
--
-- IDEMPOTENT.
-- Se rulează în Supabase → SQL Editor.
-- ============================================================

create or replace function public.verifica_publicarea()
returns trigger language plpgsql as $$
begin
  -- Ne interesează doar trecerea pe publicat, nu și depublicarea.
  if new.publicat is not true then return new; end if;
  if new.sursa is null then return new; end if;   -- piesele introduse manual

  if coalesce(cardinality(new.poze), 0) = 0 then
    raise exception
      'Piesa „%" vine din import și nu are încă poze descărcate. Publică-o din Admin → Piese de completat, ca pozele să fie aduse de la sursă.',
      new.nume
      using errcode = 'check_violation';
  end if;

  if new.categorie_id is null then
    raise exception
      'Piesa „%" nu are categorie. Alege-i una înainte de publicare.',
      new.nume
      using errcode = 'check_violation';
  end if;

  return new;
end; $$;

drop trigger if exists tr_verifica_publicarea on products;
create trigger tr_verifica_publicarea
  before insert or update on products
  for each row execute function public.verifica_publicarea();

-- ============================================================
-- ANULAREA COMENZII, făcută tolerantă
--
-- `anuleaza_comanda` republică piesele: `update products set ... publicat = true`.
-- Cu triggerul de mai sus, o singură piesă importată fără poze ar face excepție
-- și ar anula TOATĂ operațiunea — comanda ar rămâne neanulată, stocul nereîntors.
-- Un defect mult mai grav decât cel pe care îl reparăm.
--
-- Deci republicarea devine condiționată: piesele care n-au voie pe site rămân
-- nepublicate, restul se republică normal. Anularea nu poate eșua din cauza asta.
-- ============================================================
create or replace function public.anuleaza_comanda(oid bigint)
returns void language plpgsql security definer as $$
begin
  if not is_staff() then raise exception 'Doar echipa poate anula comenzi.'; end if;
  if (select status from orders where id = oid) = 'anulata' then return; end if;

  update products p
     set stoc = p.stoc + i.cantitate,
         -- o piesă importată fără poze nu se republică: n-ar avea ce arăta
         publicat = case
           when p.sursa is not null and coalesce(cardinality(p.poze), 0) = 0 then false
           when p.categorie_id is null then false
           else true
         end
    from order_items i
   where i.order_id = oid and i.product_id = p.id;

  update orders set status = 'anulata' where id = oid;
  insert into order_events(order_id, tip, mesaj, autor)
  values (oid, 'anulare', 'Comandă anulată — piesele au fost republicate pe site',
          coalesce(auth.jwt()->>'email', 'sistem'));
end; $$;

revoke execute on function public.anuleaza_comanda(bigint) from public;
grant execute on function public.anuleaza_comanda(bigint) to authenticated;

-- ---------- Verificare ----------
-- 1. Triggerul există
select tgname from pg_trigger where tgrelid = 'products'::regclass and tgname = 'tr_verifica_publicarea';

-- 2. Nicio piesă importată publicată nu e fără poze sau fără categorie
select count(*) as trebuie_sa_fie_zero
  from products
 where sursa is not null and publicat
   and (coalesce(cardinality(poze), 0) = 0 or categorie_id is null);
