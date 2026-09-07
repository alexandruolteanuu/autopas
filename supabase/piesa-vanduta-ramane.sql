-- ============================================================
-- MIGRAREA 38 — o piesă vândută rămâne o pagină, nu devine un 404
--
-- CE SE ÎNTÂMPLA (găsit la 7 septembrie 2026, înainte de primele campanii plătite)
-- Triggerul `scade_stocul` făcea două lucruri la vânzare: `stoc = 0` ȘI
-- `publicat = false`. Al doilea scoate pagina de sub politica de citire publică
-- (`publicat = true or is_staff()`), deci pagina piesei începe să răspundă 404.
--
-- Lanțul, cu bani în el:
--   1. piesa se vinde dimineața;
--   2. Google ia feed-ul o dată pe zi, deci anunțul din Shopping rămâne activ;
--   3. cineva dă clic — PLĂTIT — și ajunge pe o pagină 404;
--   4. „Automatic availability updates" din Merchant Center, care ar fi oprit
--      anunțul în câteva ore citind `OutOfStock` de pe pagină, nu poate citi
--      nimic de pe o pagină care nu există. În loc de asta, Merchant Center
--      marchează produsul cu eroare de pagină de destinație.
--
-- DE CE E SIGUR SĂ NU MAI ATINGEM `publicat`
-- `publicat = false` NU era ce ascundea piesa vândută. Toate locurile care
-- listează piese filtrează deja `publicat = true AND stoc > 0`: paginile de
-- catalog, feed-urile de reclame, sitemap-ul, piesele similare, publicarea pe
-- dez.ro. Verificat câmp cu câmp înainte de migrarea asta.
-- Singurul efect al lui `publicat = false` la vânzare era omorârea paginii.
--
-- CE ÎNSEAMNĂ FIECARE COLOANĂ, DE ACUM ÎNAINTE
--   `publicat`  — operatorul vrea piesa pe site. Se schimbă doar din admin sau
--                 când piesa dispare din feed-ul sursei (`sursa_activ = false`).
--   `stoc`      — piesa mai există fizic. Zero = vândută.
-- Două lucruri diferite, două coloane, fără suprapunere.
--
-- CE VEDE OMUL
-- Pagina rămâne la HTTP 200, scrie „Vândută", n-are buton de comandă și arată
-- piese similare dedesubt. Clicul plătit care ajunge după vânzare nu se mai
-- pierde. Acelasi principiu ca la modul vacanță (migrarea 27): paginile rămân
-- la 200, altfel Google le scoate din index și poziția se recâștigă în
-- săptămâni, nu în ore.
--
-- LA MOMENTUL RULĂRII: 0 piese erau ascunse din cauza unei vânzări (numărate
-- înainte), deci nu e nimic de reparat retroactiv. Cele 138 scoase din feed și
-- cele 139 ascunse de operator rămân ascunse — corect, sunt alte cazuri.
--
-- IDEMPOTENTĂ: `create or replace`, se poate rula de câte ori vrei.
-- Se rulează în Supabase → SQL Editor.
-- ============================================================

-- ---------- 1. Vânzarea scade doar stocul ----------
create or replace function public.scade_stocul()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.product_id is not null then
    -- `publicat` nu se mai atinge. Vezi antetul: listările filtrează oricum
    -- după `stoc > 0`, iar pagina trebuie să rămână vie pentru Google și
    -- pentru clicul deja plătit.
    update products
       set stoc = greatest(stoc - new.cantitate, 0)
     where id = new.product_id;
  end if;
  return new;
end; $$;

-- ---------- 2. Anularea repune doar stocul ----------
-- Perechea celei de sus: dacă vânzarea nu mai ascunde piesa, anularea n-are ce
-- să dezvăluie. Mai mult, `publicat = true` de aici putea readuce pe site o
-- piesă pe care operatorul o ascunsese INTENȚIONAT înainte de comandă — o
-- republicare pe care n-o cerea nimeni.
create or replace function public.anuleaza_comanda(oid bigint)
returns void language plpgsql security definer as $$
begin
  if not is_staff() then raise exception 'Doar echipa poate anula comenzi.'; end if;
  if (select status from orders where id = oid) = 'anulata' then return; end if;

  update products p
     set stoc = p.stoc + i.cantitate
    from order_items i
   where i.order_id = oid and i.product_id = p.id;

  update orders set status = 'anulata' where id = oid;
  insert into order_events(order_id, tip, mesaj, autor)
  values (oid, 'anulare', 'Comandă anulată — piesele au fost repuse în stoc',
          coalesce(auth.jwt()->>'email', 'sistem'));
end; $$;

revoke execute on function public.anuleaza_comanda(bigint) from public;
grant execute on function public.anuleaza_comanda(bigint) to authenticated;

-- ---------- 3. Verificare ----------
-- a) triggerul nu mai pomenește `publicat`
select prosrc not like '%publicat%' as scade_stocul_nu_mai_atinge_publicat
  from pg_proc where proname = 'scade_stocul';

-- b) nici anularea
select prosrc not like '%publicat%' as anularea_nu_mai_atinge_publicat
  from pg_proc where proname = 'anuleaza_comanda';

-- c) câte piese sunt ascunse și din ce motiv (informativ)
select
  count(*) filter (where not publicat and coalesce(sursa_activ, true) = false) as scoase_din_feed,
  count(*) filter (where not publicat and coalesce(sursa_activ, true))         as ascunse_de_operator,
  count(*) filter (where publicat and stoc = 0)                                as vandute_dar_vizibile
from products;
