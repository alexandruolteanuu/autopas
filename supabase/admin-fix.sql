-- ============================================================
-- AUTOPAS — REPARAȚII ADMIN (rulează AL NOUĂLEA)
-- Supabase → SQL Editor → New query → lipește tot → Run
-- ============================================================

-- ---------- 1. PROFILE: adminul vede echipa și poate schimba rolurile ----------
-- (până acum: fiecare își vedea doar propriul profil, iar rolurile nu se puteau schimba din interfață)
drop policy if exists "profil propriu" on profiles;
create policy "profil propriu" on profiles for select
  using (auth.uid() = id or is_admin());

drop policy if exists "profil admin update" on profiles;
create policy "profil admin update" on profiles for update
  using (is_admin()) with check (is_admin());

-- ---------- 2. COMENZI: adminul poate șterge (comenzi de test, duplicate) ----------
drop policy if exists "comenzi admin delete" on orders;
create policy "comenzi admin delete" on orders for delete using (is_admin());

drop policy if exists "items admin delete" on order_items;
create policy "items admin delete" on order_items for delete using (is_admin());

-- ștergerea repune piesele pe stoc, ca la anulare
create or replace function public.sterge_comanda(oid bigint)
returns json language plpgsql security definer set search_path = public as $$
declare nr text;
begin
  if not is_admin() then return json_build_object('ok', false, 'mesaj', 'Doar administratorul poate șterge comenzi.'); end if;
  select numar into nr from orders where id = oid;
  if nr is null then return json_build_object('ok', false, 'mesaj', 'Comanda nu există.'); end if;
  -- repunem piesele pe stoc doar dacă nu era deja anulată
  if (select status from orders where id = oid) <> 'anulata' then
    update products p set stoc = p.stoc + i.cantitate, publicat = true
      from order_items i where i.order_id = oid and i.product_id = p.id;
  end if;
  delete from orders where id = oid;   -- order_items și order_events se șterg în cascadă
  return json_build_object('ok', true, 'mesaj', 'Comanda ' || nr || ' a fost ștearsă, piesele au revenit pe stoc.');
end; $$;
grant execute on function public.sterge_comanda(bigint) to authenticated;

-- ---------- 3. NUMĂRUL REAL DE PIESE PE FIECARE MAȘINĂ ----------
-- (până acum era o cifră scrisă o dată și niciodată actualizată)
create or replace function public.recalc_piese_vehicul()
returns trigger language plpgsql security definer set search_path = public as $$
declare v bigint;
begin
  v := coalesce(new.vehicul_id, old.vehicul_id);
  if v is not null then
    update vehicles set piese_listate =
      (select count(*) from products where vehicul_id = v and publicat = true and stoc > 0)
      where id = v;
  end if;
  if tg_op = 'UPDATE' and old.vehicul_id is distinct from new.vehicul_id and old.vehicul_id is not null then
    update vehicles set piese_listate =
      (select count(*) from products where vehicul_id = old.vehicul_id and publicat = true and stoc > 0)
      where id = old.vehicul_id;
  end if;
  return null;
end; $$;

drop trigger if exists tr_recalc_piese on products;
create trigger tr_recalc_piese after insert or update or delete on products
  for each row execute procedure public.recalc_piese_vehicul();

-- punem cifrele la zi acum
update vehicles v set piese_listate =
  (select count(*) from products p where p.vehicul_id = v.id and p.publicat = true and p.stoc > 0);

-- ---------- 4. SETĂRI: securizare + inserare ----------
-- IMPORTANT: până acum ORICINE putea citi tot ce e în settings.
-- Datele firmei și curierii sunt publice (apar oricum pe site);
-- integrările (parole, chei API) rămân vizibile DOAR echipei.
drop policy if exists "setari citire" on settings;
create policy "setari citire" on settings for select
  using (cheie in ('firma', 'curieri') or is_staff());

drop policy if exists "setari admin" on settings;
create policy "setari admin" on settings for update using (is_admin()) with check (is_admin());

drop policy if exists "setari admin insert" on settings;
create policy "setari admin insert" on settings for insert with check (is_admin());

-- ne asigurăm că există cheile necesare (dacă upgrade.sql n-a apucat să ruleze)
insert into settings (cheie, valoare) values
 ('integrari', '{"whatsapp":{"numar":"","activ":true},
                 "fancourier":{"client_id":"","user":"","parola":"","activ":false},
                 "sameday":{"user":"","parola":"","activ":false},
                 "netopia":{"signature":"","pos_id":"","activ":false},
                 "saga":{"serie":"AUTP","activ":true},
                 "ga4":{"id":"","activ":false}}')
on conflict (cheie) do nothing;

-- numărul de WhatsApp trece în datele firmei (e public oricum) ca să-l poți schimba din Setări
update settings
   set valoare = valoare || '{"whatsapp":"40740123456"}'::jsonb
 where cheie = 'firma' and not (valoare ? 'whatsapp');

-- ---------- 5. CATEGORII / MĂRCI: și operatorul poate lucra ----------
drop policy if exists "categorii admin" on categories;
create policy "categorii staff" on categories for all using (is_staff()) with check (is_staff());
drop policy if exists "marci admin" on brands;
create policy "marci staff" on brands for all using (is_staff()) with check (is_staff());
drop policy if exists "modele admin" on models;
create policy "modele staff" on models for all using (is_staff()) with check (is_staff());
