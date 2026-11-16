-- ============================================================
-- TESTUL MIGRĂRII 58 (OLX, sincronizarea automată). Pe PRODUCȚIE, în tranzacție ANULATĂ.
-- Se termină MEREU cu eroare: „REZULTAT OK …” sau „VERIFICARE PICATĂ …”.
-- Nu trimite nimic la OLX și nu cheamă ruta: trezirea e OPRITĂ în test (și pg_net trimite
-- oricum doar după COMMIT — aici e rollback).
-- Verifică: (1) structura și drepturile; (2) modificarea unei coloane din anunț pune piesa
-- în coadă, `vizualizari` nu; (3) o modificare nouă repornește încercările; (4) ștergerea
-- piesei pune în coadă id-ul anunțului; (5) trezirea oprită nu cheamă nimic, pornită
-- respectă fereastra de 20 s; (6) lacătul lotului; (7) view-urile numără corect.
-- ============================================================
begin;
do $$
declare v_p bigint; v_p2 bigint; v_del bigint; n int; t text; b boolean;
begin
  -- (1) structura și drepturile
  if (select count(*) from information_schema.triggers
       where event_object_table = 'products' and trigger_name like 'olx_la_%') <> 3 then
    raise exception 'VERIFICARE PICATĂ: nu sunt exact 3 triggere olx_la_* pe products';
  end if;
  foreach t in array array['anon', 'authenticated'] loop
    if has_table_privilege(t, 'public.olx_coada', 'insert') or has_table_privilege(t, 'public.olx_coada', 'update')
       or has_table_privilege(t, 'public.olx_coada', 'delete') then
      raise exception 'VERIFICARE PICATĂ: rolul % poate scrie în olx_coada', t; end if;
    if has_table_privilege(t, 'public.olx_trezire', 'select') then
      raise exception 'VERIFICARE PICATĂ: rolul % poate citi olx_trezire (secretul)', t; end if;
    if has_function_privilege(t, 'public.olx_trezeste(boolean)', 'execute')
       or has_function_privilege(t, 'public.olx_coada_ia_lotul(int)', 'execute') then
      raise exception 'VERIFICARE PICATĂ: rolul % poate chema funcțiile cozii OLX', t; end if;
  end loop;
  if length((select webhook_secret from public.olx_trezire)) < 32 then
    raise exception 'VERIFICARE PICATĂ: secretul trezirii lipsește sau e prea scurt'; end if;

  -- Trezirea OPRITĂ pe tot testul (nu se cheamă nimic).
  update public.olx_trezire set activ = false where unic;
  delete from public.olx_coada;

  -- (2) două piese publicate cu stoc
  select id into v_p  from public.products where publicat and stoc > 0 order by id limit 1;
  select id into v_p2 from public.products where publicat and stoc > 0 and id <> v_p order by id limit 1;
  update public.products set vizualizari = coalesce(vizualizari, 0) + 1 where id = v_p2;
  if exists (select 1 from public.olx_coada where product_id = v_p2) then
    raise exception 'VERIFICARE PICATĂ: `vizualizari` a pus piesa în coadă'; end if;
  update public.products set pret_lei = pret_lei + 1 where id = v_p;
  if not exists (select 1 from public.olx_coada where product_id = v_p and motiv = 'piesă modificată') then
    raise exception 'VERIFICARE PICATĂ: schimbarea prețului nu a pus piesa în coadă'; end if;

  -- (3) o modificare nouă repornește încercările
  update public.olx_coada set incercari = 5, eroare = 'test' where product_id = v_p;
  update public.products set stoc = 0 where id = v_p;
  if not exists (select 1 from public.olx_coada where product_id = v_p and incercari = 0 and eroare is null) then
    raise exception 'VERIFICARE PICATĂ: o modificare nouă nu a repornit încercările'; end if;

  -- (4) ștergerea: o piesă fără comenzi, cu anunț de probă
  select p.id into v_del from public.products p
   where not exists (select 1 from public.order_items i where i.product_id = p.id)
     and not exists (select 1 from public.olx_anunturi a where a.product_id = p.id)
   order by p.id limit 1;
  insert into public.olx_anunturi (product_id, advert_id, status) values (v_del, -58, 'limited');
  delete from public.products where id = v_del;
  if not exists (select 1 from public.olx_coada where advert_id = -58 and product_id is null) then
    raise exception 'VERIFICARE PICATĂ: ștergerea piesei nu a pus anunțul în coadă'; end if;
  if not exists (select 1 from public.olx_de_retras where advert_id = -58 and motiv = 'ștearsă') then
    raise exception 'VERIFICARE PICATĂ: anunțul piesei șterse nu apare la „de retras”'; end if;
  update public.olx_anunturi set retras_la = now() where advert_id = -58;
  if exists (select 1 from public.olx_de_retras where advert_id = -58) then
    raise exception 'VERIFICARE PICATĂ: un anunț retras apare tot la „de retras”'; end if;

  -- (5) trezirea: oprită → false; pornită → true, apoi fereastra → false, forțat → true
  if public.olx_trezeste(false) then raise exception 'VERIFICARE PICATĂ: trezirea oprită a chemat ruta'; end if;
  update public.olx_trezire set activ = true, webhook_url = 'http://127.0.0.1:9/test-olx', ultima = '-infinity' where unic;
  if not public.olx_trezeste(false) then raise exception 'VERIFICARE PICATĂ: trezirea pornită nu a chemat'; end if;
  if public.olx_trezeste(false) then raise exception 'VERIFICARE PICATĂ: fereastra de 20 s nu ține'; end if;
  if not public.olx_trezeste(true) then raise exception 'VERIFICARE PICATĂ: trezirea forțată n-a mers'; end if;
  perform public.olx_deblocheaza();
  if not public.olx_trezeste(false) then raise exception 'VERIFICARE PICATĂ: deblocarea nu a redeschis fereastra'; end if;

  -- (6) lacătul lotului
  perform public.olx_coada_elibereaza();
  if not public.olx_coada_ia_lotul(70) then raise exception 'VERIFICARE PICATĂ: lacătul liber nu s-a luat'; end if;
  if public.olx_coada_ia_lotul(70) then raise exception 'VERIFICARE PICATĂ: lacătul s-a luat de două ori'; end if;
  perform public.olx_coada_elibereaza();
  if not public.olx_coada_ia_lotul(70) then raise exception 'VERIFICARE PICATĂ: lacătul eliberat nu s-a mai luat'; end if;

  -- (7) view-ul de stare
  select de_facut into n from public.olx_coada_stare;
  if n <> (select count(*) from public.olx_coada where incercari < 5) then
    raise exception 'VERIFICARE PICATĂ: olx_coada_stare.de_facut greșit'; end if;

  raise exception 'REZULTAT OK: triggere, drepturi, coada, ștergerea, trezirea cu fereastră și lacătul lotului (tot a fost anulat)';
end $$;
rollback;
