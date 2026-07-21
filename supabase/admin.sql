-- ============================================================
-- AUTOPAS — PANOUL DE ADMINISTRARE (rulează AL CINCILEA)
-- Supabase → SQL Editor → New query → lipește tot → Run
-- O singură migrare pentru toate etapele admin (A + B + C).
-- ============================================================

-- ---------- 1. JURNALUL COMENZILOR (audit log) ----------
create table order_events (
  id bigint generated always as identity primary key,
  order_id bigint not null references orders(id) on delete cascade,
  tip text not null,                 -- plasata / status / nota / awb / factura / anulare
  mesaj text not null,
  autor text not null default 'sistem',
  created_at timestamptz not null default now()
);

-- ---------- 2. CÂMPURI NOI ----------
alter table products add column greutate_kg numeric(6,2);
alter table products add column cost_lei numeric(10,2);
alter table products add column vizualizari int not null default 0;

alter table vehicles add column cost_achizitie numeric(10,2);
alter table vehicles add column status text not null default 'in_dezmembrare'
  check (status in ('in_dezmembrare','amortizata','finalizata'));

alter table orders add column nota_interna text;
alter table orders add column discount_cod text;
alter table orders add column discount_valoare numeric(10,2) not null default 0;

-- statusuri pe toate cererile (Inbox)
alter table part_requests       add column status text not null default 'noua' check (status in ('noua','in_lucru','rezolvata','respinsa'));
alter table part_requests       add column nota text;
alter table car_intake_requests add column status text not null default 'noua' check (status in ('noua','in_lucru','rezolvata','respinsa'));
alter table car_intake_requests add column nota text;
alter table return_requests     add column status text not null default 'noua' check (status in ('noua','in_lucru','rezolvata','respinsa'));
alter table return_requests     add column nota text;
alter table contact_messages    add column status text not null default 'noua' check (status in ('noua','in_lucru','rezolvata'));
alter table contact_messages    add column nota text;

-- facturare (fluxul cu Saga: seria se emite în Saga și se notează aici)
alter table orders add column factura_status text not null default 'de_emis'
  check (factura_status in ('de_emis','emisa','stornata','nu_se_emite'));

-- ---------- 3. CODURI DE REDUCERE ----------
create table discount_codes (
  id bigint generated always as identity primary key,
  cod text unique not null,
  tip text not null default 'procent' check (tip in ('procent','fix')),
  valoare numeric(10,2) not null,
  minim_comanda numeric(10,2) not null default 0,
  expira_la date,
  activ boolean not null default true,
  folosiri int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- 4. SETĂRI (date firmă, curieri — folosite în etapa B) ----------
create table settings (
  cheie text primary key,
  valoare jsonb not null
);
insert into settings (cheie, valoare) values
 ('firma', '{"denumire":"Autopas Dezmembrări SRL","cui":"RO12345678","reg_com":"J27/456/2015","iban":"","serie_factura":"AUTP","telefon":"0740 123 456","email":"comenzi@autopas.ro"}'),
 ('curieri', '[{"id":"fan","nume":"FAN Courier","detalii":"livrare 24–48h, ramburs inclus","pret":19.9},{"id":"cargus","nume":"Cargus","detalii":"livrare 24–48h","pret":21.5},{"id":"sameday","nume":"Sameday easybox","detalii":"ridici din locker","pret":14.9}]');

-- ---------- 5. ROLURI EXTINSE ----------
alter table profiles drop constraint profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('client','admin','operator','contabil'));

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles where id = auth.uid() and role in ('admin','operator','contabil'));
$$;

-- ---------- 6. TRIGGERE: STOC AUTOMAT + JURNAL AUTOMAT ----------
-- La fiecare produs comandat: stocul scade și piesa se ascunde automat la 0.
create or replace function public.scade_stocul()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.product_id is not null then
    update products
       set stoc = greatest(stoc - new.cantitate, 0),
           publicat = case when stoc - new.cantitate <= 0 then false else publicat end
     where id = new.product_id;
  end if;
  return new;
end; $$;
create trigger tr_scade_stocul after insert on order_items
  for each row execute procedure public.scade_stocul();

-- Jurnal automat: la plasare și la fiecare schimbare de status.
create or replace function public.jurnal_comanda()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into order_events(order_id, tip, mesaj, autor)
    values (new.id, 'plasata', 'Comandă plasată de client — plata: ' || new.plata || ', total: ' || new.total || ' lei', 'client');
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into order_events(order_id, tip, mesaj, autor)
    values (new.id, 'status', 'Status schimbat: ' || old.status || ' → ' || new.status,
            coalesce(auth.jwt()->>'email', 'sistem'));
  end if;
  return new;
end; $$;
create trigger tr_jurnal_comanda after insert or update on orders
  for each row execute procedure public.jurnal_comanda();

-- Anularea unei comenzi: repune piesele pe stoc și le republică, apoi jurnalizează.
create or replace function public.anuleaza_comanda(oid bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'Doar echipa poate anula comenzi.'; end if;
  if (select status from orders where id = oid) = 'anulata' then return; end if;
  update products p set stoc = p.stoc + i.cantitate, publicat = true
    from order_items i where i.order_id = oid and i.product_id = p.id;
  update orders set status = 'anulata' where id = oid;
  insert into order_events(order_id, tip, mesaj, autor)
  values (oid, 'anulare', 'Comandă anulată — piesele au fost republicate pe site',
          coalesce(auth.jwt()->>'email', 'sistem'));
end; $$;
grant execute on function public.anuleaza_comanda(bigint) to authenticated;

-- ---------- 7. SECURITATE (RLS) pentru tot ce e nou ----------
alter table order_events enable row level security;
alter table discount_codes enable row level security;
alter table settings enable row level security;

create policy "jurnal staff" on order_events for select using (is_staff());
create policy "jurnal insert staff" on order_events for insert with check (is_staff());
create policy "coduri publice la validare" on discount_codes for select using (activ = true or is_staff());
create policy "coduri admin" on discount_codes for all using (is_admin()) with check (is_admin());
create policy "setari citire" on settings for select using (true);
create policy "setari admin" on settings for update using (is_admin());

-- echipa (operator/contabil) primește acces operațional, nu doar adminul
create policy "comenzi staff citire" on orders for select using (is_staff());
create policy "comenzi staff update" on orders for update using (is_staff());
create policy "items staff" on order_items for select using (is_staff());
create policy "produse staff" on products for all using (is_staff()) with check (is_staff());
create policy "vehicule staff" on vehicles for all using (is_staff()) with check (is_staff());
create policy "cereri staff" on part_requests for all using (is_staff()) with check (is_staff());
create policy "predare staff" on car_intake_requests for all using (is_staff()) with check (is_staff());
create policy "retur staff" on return_requests for all using (is_staff()) with check (is_staff());
create policy "contact staff" on contact_messages for all using (is_staff()) with check (is_staff());
