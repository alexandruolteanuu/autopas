-- ============================================================
-- AUTOPAS — SPRINT B + C (rulează AL ȘASELEA, după admin.sql)
-- Supabase → SQL Editor → New query → lipește tot → Run
-- ============================================================

-- ---------- 1. VALIDAREA CODULUI DE REDUCERE (rulează pe server, securizat) ----------
-- Clientul nu poate păcăli reducerea: valoarea se calculează aici, nu în browser.
create or replace function public.valideaza_cod(p_cod text, p_subtotal numeric)
returns json language plpgsql security definer set search_path = public as $$
declare c record; val numeric;
begin
  select * into c from discount_codes where upper(cod) = upper(p_cod) and activ = true;
  if not found then return json_build_object('ok', false, 'mesaj', 'Codul nu există sau a fost dezactivat.'); end if;
  if c.expira_la is not null and c.expira_la < current_date then
    return json_build_object('ok', false, 'mesaj', 'Codul a expirat.'); end if;
  if p_subtotal < c.minim_comanda then
    return json_build_object('ok', false, 'mesaj', 'Codul necesită o comandă de minimum ' || c.minim_comanda || ' lei.'); end if;
  if c.tip = 'procent' then val := round(p_subtotal * c.valoare / 100, 2);
  else val := least(c.valoare, p_subtotal); end if;
  return json_build_object('ok', true, 'cod', c.cod, 'valoare', val,
    'mesaj', case when c.tip = 'procent' then '−' || c.valoare || '% aplicat' else '−' || c.valoare || ' lei aplicat' end);
end; $$;
grant execute on function public.valideaza_cod(text, numeric) to anon, authenticated;

-- ---------- 2. CONTORIZAREA FOLOSIRII (după plasarea comenzii) ----------
create or replace function public.foloseste_cod(p_cod text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update discount_codes set folosiri = folosiri + 1 where upper(cod) = upper(p_cod);
end; $$;
grant execute on function public.foloseste_cod(text) to anon, authenticated;

-- ---------- 3. CONTOR DE VIZUALIZĂRI PE PIESĂ (statistica din admin) ----------
create or replace function public.vazut_produs(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update products set vizualizari = vizualizari + 1 where id = p_id;
end; $$;
grant execute on function public.vazut_produs(bigint) to anon, authenticated;

-- ---------- 4. ȘTERGEREA PROTEJATĂ A UNEI PIESE ----------
-- Nu lăsăm să dispară o piesă care apare într-o comandă (s-ar strica istoricul).
create or replace function public.sterge_produs(p_id bigint)
returns json language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not is_staff() then return json_build_object('ok', false, 'mesaj', 'Fără drepturi.'); end if;
  select count(*) into n from order_items where product_id = p_id;
  if n > 0 then
    update products set publicat = false where id = p_id;
    return json_build_object('ok', false, 'mesaj', 'Piesa apare în ' || n || ' comandă/comenzi — nu poate fi ștearsă. A fost ascunsă de pe site.');
  end if;
  delete from products where id = p_id;
  return json_build_object('ok', true, 'mesaj', 'Piesa a fost ștearsă definitiv.');
end; $$;
grant execute on function public.sterge_produs(bigint) to authenticated;

-- ---------- 5. INDEX-URI pentru rapoarte rapide ----------
create index if not exists orders_created_idx on orders (created_at desc);
create index if not exists order_items_order_idx on order_items (order_id);
create index if not exists products_vehicul_idx on products (vehicul_id);
