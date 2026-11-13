-- ============================================================
-- TESTUL ESENȚIAL AL MIGRĂRII 57 (OLX). Pe PRODUCȚIE, în tranzacție ANULATĂ.
-- Se termină MEREU cu eroare: „REZULTAT OK …” sau „VERIFICARE PICATĂ …”.
-- Verifică: (1) o piesă nu poate avea două rânduri (deci nici două anunțuri);
-- (2) același advert_id nu poate fi pe două piese; (3) browserul nu poate scrie;
-- (4) ștergerea piesei NU șterge rândul cu advert_id.
-- ============================================================
begin;
do $$
declare v_p bigint; v_p2 bigint; t text;
begin
  -- O piesă fără comenzi (order_items o ține cu cheie străină fără cascade).
  select p.id into v_p from public.products p
   where not exists (select 1 from public.order_items i where i.product_id = p.id) order by p.id limit 1;
  select id into v_p2 from public.products where id <> v_p order by id limit 1;
  insert into public.olx_anunturi (product_id, advert_id, status) values (v_p, -1, 'test');
  begin
    insert into public.olx_anunturi (product_id, status) values (v_p, 'test');
    raise exception 'VERIFICARE PICATĂ: aceeași piesă a primit al doilea rând';
  exception when unique_violation then null; end;
  begin
    insert into public.olx_anunturi (product_id, advert_id, status) values (v_p2, -1, 'test');
    raise exception 'VERIFICARE PICATĂ: același advert_id pe două piese';
  exception when unique_violation then null; end;
  foreach t in array array['anon', 'authenticated'] loop
    if has_table_privilege(t, 'public.olx_anunturi', 'insert') or has_table_privilege(t, 'public.olx_anunturi', 'update')
       or has_table_privilege(t, 'public.olx_anunturi', 'delete') then
      raise exception 'VERIFICARE PICATĂ: rolul % poate scrie în olx_anunturi', t;
    end if;
  end loop;
  -- Ștergerea piesei: rândul rămâne, cu advert_id (piesa reală revine la anulare).
  delete from public.products where id = v_p;
  if not exists (select 1 from public.olx_anunturi where advert_id = -1 and product_id is null) then
    raise exception 'VERIFICARE PICATĂ: ștergerea piesei a luat cu ea anunțul (trebuia set null)';
  end if;
  raise exception 'REZULTAT OK: un singur anunț pe piesă, advert_id unic, browserul nu scrie, anunțul supraviețuiește piesei (tot a fost anulat)';
end $$;
rollback;
