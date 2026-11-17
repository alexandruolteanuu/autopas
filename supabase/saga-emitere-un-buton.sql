-- ============================================================
-- AUTOPAS — SAGA, PASUL 13: „EMITE FACTURA” DINTR-UN SINGUR BUTON
-- Migrarea 60 (17 noiembrie 2026). Planul: docs/saga-plan.md, pasul 13.
--
-- Butonul emite, alocă numărul, trimite în SAGA și verifică. Motorul e în
-- lib/saga-emitere.mjs; aici doar ce trebuie garantat de bază:
--
--   · `facturi.saga_status` primește `se_trimite` (motorul lucrează la ea) și
--     `de_verificat` (situație pe care motorul n-o poate decide singur).
--   · coloane noi de stare pe `facturi`: lacătul motorului (`lacat_pana`, 2 minute, și
--     `lacat_de`), `renumerotari` (plafon 10), `reincercari`, `reincearca_la`, `stornata`.
--   · O SINGURĂ factură activă pe comandă, garantat de un index unic
--     (`order_id` unde `tip = 'factura'` și nestornată); `stornata` e ținută de un trigger
--     la inserarea / ștergerea stornoului.
--   · `facturi_incercari` — fiecare trimitere spre SAGA, scrisă ÎNAINTE de POST.
--     „Încercare fără răspuns” = rând rămas `in_curs` sau marcat `fara_raspuns`.
--   · `emite_factura_start` / `facturi_porneste` (admin, contabil): validarea înainte de
--     număr, apoi `emite_factura` (54, NESCHIMBATĂ) și trecerea în `se_trimite`.
--   · `saga_factura_ia`, `facturi_renumeroteaza`, `facturi_elibereaza` (doar serverul).
--   · RESCRIE `facturi_pazeste` (din 49): numărul se schimbă DOAR prin renumerotare, în
--     `se_trimite`; restul regulilor — identice, plus cele două stări noi.
--     GARDĂ: amprenta fără „\r” = 49 (a2b12d08e988b102abc939e3d533fff6) sau 60 (re-rulare).
--   · Ceasul: pg_cron, o dată pe minut, `saga_ceas()` trezește /api/saga-coada DOAR dacă
--     o factură așteaptă o reîncercare. Adresa și secretul în `saga_trezire`.
--
-- Nu depinde de 59. Cere pg_cron și pg_net active (pre-verificarea le confirmă).
-- Nu atinge niciun rând existent (cele 11 facturi n-au storno; `stornata` pornește false).
-- Idempotentă. Pre-verificare: scripts/pre-verifica-saga-emitere-un-buton.sql.
-- Test: scripts/verifica-saga-emitere-un-buton.sql. Anulare: scripts/anuleaza-saga-emitere-un-buton.sql.
-- ============================================================


-- ------------------------------------------------------------
-- 1. GĂRZILE
-- ------------------------------------------------------------
do $$
declare v text; w text;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception 'OPRIT: extensia pg_cron nu e activă. Supabase → Database → Extensions → caută „pg_cron” → Enable, apoi rulează din nou.';
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise exception 'OPRIT: extensia pg_net nu e activă (Supabase → Database → Extensions → „pg_net” → Enable).';
  end if;
  select md5(replace(prosrc, E'\r', '')) into v from pg_proc where oid = to_regprocedure('public.emite_factura(bigint)');
  if v is distinct from '05f9fdfb49e73145c8004f290ed6ec42' then
    raise exception 'OPRIT: emite_factura din bază nu e versiunea din migrarea 54 (amprenta fără CR: %).', v;
  end if;
  select md5(replace(prosrc, E'\r', '')) into w from pg_proc where oid = to_regprocedure('public.facturi_pazeste()');
  if w is null or w not in ('a2b12d08e988b102abc939e3d533fff6', 'f8bccca0f490afa7f2ccf5a96d4be32d') then
    raise exception 'OPRIT: facturi_pazeste din bază diferă de versiunea din git (amprenta fără CR: %). Nu se rescrie nimic.', w;
  end if;
  if to_regprocedure('public.storneaza_factura(bigint,text)') is null then
    raise exception 'OPRIT: storneaza_factura nu există — migrarea 53 nu e rulată.';
  end if;
end $$;


-- ------------------------------------------------------------
-- 2. COLOANELE ȘI STĂRILE NOI
-- ------------------------------------------------------------
alter table public.facturi add column if not exists lacat_pana    timestamptz;
alter table public.facturi add column if not exists lacat_de      uuid;
alter table public.facturi add column if not exists renumerotari  int not null default 0;
alter table public.facturi add column if not exists reincercari   int not null default 0;
alter table public.facturi add column if not exists reincearca_la timestamptz;
alter table public.facturi add column if not exists stornata      boolean not null default false;

alter table public.facturi drop constraint if exists facturi_saga_status_check;
alter table public.facturi add constraint facturi_saga_status_check
  check (saga_status in ('de_trimis', 'in_curs', 'trimisa', 'eroare', 'confirmata', 'se_trimite', 'de_verificat'));


-- ------------------------------------------------------------
-- 3. PAZA FACTURILOR (rescrisă din 49)
-- ------------------------------------------------------------
create or replace function public.facturi_pazeste()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  stare_coloane constant text[] := array['saga_status', 'saga_eroare', 'saga_trimisa_la',
                                         'confirmata_la', 'confirmata_de', 'updated_at',
                                         'lacat_pana', 'lacat_de', 'renumerotari', 'reincercari',
                                         'reincearca_la', 'stornata'];
  -- Semnalul pus DOAR de facturi_renumeroteaza / facturi_elibereaza, pe factura lor (60).
  v_motor boolean := coalesce(current_setting('autopas.saga_motor', true), '') = old.id::text;
begin
  if tg_op = 'DELETE' then
    if old.saga_status <> 'de_trimis' and not (v_motor and old.saga_status = 'se_trimite') then
      raise exception 'Factura % % a plecat deja spre SAGA (stare: %) — nu se mai șterge. Se stornează.',
        old.serie, old.numar, old.saga_status;
    end if;
    return old;
  end if;

  -- Renumerotarea (60): numărul și data se schimbă doar prin motor, doar în „se_trimite”.
  if v_motor and old.saga_status = 'se_trimite' and new.saga_status = 'se_trimite'
     and (new.id, new.tip, new.storno_pentru, new.order_id, new.serie)
         is not distinct from (old.id, old.tip, old.storno_pentru, old.order_id, old.serie) then
    if (to_jsonb(new) - stare_coloane - array['numar', 'data', 'scadenta'])
       is distinct from (to_jsonb(old) - stare_coloane - array['numar', 'data', 'scadenta']) then
      raise exception 'Renumerotarea facturii % % schimbă doar numărul și data.', old.serie, old.numar;
    end if;
    new.updated_at := now();
    return new;
  end if;

  if (new.id, new.tip, new.storno_pentru, new.order_id, new.serie, new.numar)
     is distinct from (old.id, old.tip, old.storno_pentru, old.order_id, old.serie, old.numar) then
    raise exception 'Seria, numărul, comanda și tipul unei facturi nu se schimbă niciodată (factura % %).',
      old.serie, old.numar;
  end if;

  if old.saga_status in ('in_curs', 'trimisa', 'confirmata', 'se_trimite', 'de_verificat') then
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

drop trigger if exists facturi_pazeste on public.facturi;
create trigger facturi_pazeste before update or delete on public.facturi
  for each row execute function public.facturi_pazeste();
revoke execute on function public.facturi_pazeste() from public;


-- ------------------------------------------------------------
-- 4. O SINGURĂ FACTURĂ ACTIVĂ PE COMANDĂ
-- ------------------------------------------------------------
create or replace function public.facturi_tine_stornata()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.storno_pentru is not null then
    update public.facturi set stornata = true where id = new.storno_pentru and not stornata;
  elsif tg_op = 'DELETE' and old.storno_pentru is not null then
    update public.facturi set stornata = false where id = old.storno_pentru and stornata;
  end if;
  return null;
end;
$$;
revoke execute on function public.facturi_tine_stornata() from public;

drop trigger if exists facturi_tine_stornata on public.facturi;
create trigger facturi_tine_stornata after insert or delete on public.facturi
  for each row execute function public.facturi_tine_stornata();

-- Facturile stornate dinainte (azi: niciuna).
update public.facturi f set stornata = true
 where f.tip = 'factura' and not f.stornata
   and exists (select 1 from public.facturi s where s.storno_pentru = f.id);

create unique index if not exists facturi_o_activa_pe_comanda
  on public.facturi (order_id) where tip = 'factura' and not stornata;


-- ------------------------------------------------------------
-- 5. ÎNCERCĂRILE DE TRIMITERE
-- ------------------------------------------------------------
create table if not exists public.facturi_incercari (
  id            bigint generated always as identity primary key,
  factura_id    bigint references public.facturi (id) on delete set null,
  serie         text        not null,
  numar         int         not null,
  trimisa_la    timestamptz not null default now(),
  -- in_curs = scrisă înainte de POST, încă fără rezultat (dacă rămâne așa, procesul a murit
  -- în timpul apelului: se socotește FĂRĂ RĂSPUNS); netrimisa = sigur n-a plecat.
  stare         text        not null default 'in_curs'
                  check (stare in ('in_curs', 'raspuns', 'fara_raspuns', 'netrimisa')),
  http_status   int,
  raspuns       text,
  eroare        text,
  terminata_la  timestamptz,
  de            uuid
);
create index if not exists facturi_incercari_factura_idx on public.facturi_incercari (factura_id, serie, numar);
alter table public.facturi_incercari enable row level security;
revoke all on table public.facturi_incercari from public, anon, authenticated;
grant select on table public.facturi_incercari to authenticated;
grant select, insert, update on table public.facturi_incercari to service_role;
drop policy if exists "facturi incercari citire" on public.facturi_incercari;
create policy "facturi incercari citire" on public.facturi_incercari
  for select to authenticated using (public.is_facturare());
comment on table public.facturi_incercari is
  'Fiecare trimitere a unei facturi spre SAGA (migrarea 60), scrisă ÎNAINTE de POST. Dovada „am trimis și n-am primit răspuns” pentru numărul acela.';


-- ------------------------------------------------------------
-- 6. VALIDAREA ÎNAINTE DE NUMĂR
-- ------------------------------------------------------------
create or replace function public.factura_lipsuri(p_order_id bigint)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select nullif(array_to_string(array_remove(array[
    case when btrim(coalesce(o.nume, '')) = '' then 'numele clientului' end,
    case when btrim(coalesce(o.adresa, '')) = '' then 'adresa' end,
    case when btrim(coalesce(o.oras, '')) = '' then 'localitatea' end,
    case when public.cod_judet(o.judet) is null then 'județul' end,
    case when o.tip_client = 'firma' and btrim(coalesce(o.firma, '')) = '' then 'denumirea firmei' end,
    case when o.tip_client = 'firma' and btrim(coalesce(o.cui, '')) = '' then 'CUI-ul firmei' end,
    case when not exists (select 1 from public.order_items i where i.order_id = o.id) then 'piesele' end,
    case when coalesce(o.subtotal, 0) - coalesce(o.discount_valoare, 0) <= 0 then 'o valoare peste 0' end
  ], null), ', '), '')
  from public.orders o where o.id = p_order_id;
$$;
revoke execute on function public.factura_lipsuri(bigint) from public, anon, authenticated;


-- ------------------------------------------------------------
-- 7. PORNIREA: factură nouă sau reluarea uneia existente
-- ------------------------------------------------------------
create or replace function public.facturi_porneste(p_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  f        public.facturi%rowtype;
  o        public.orders%rowtype;
  v_lipsa  text;
  v_token  uuid;
begin
  if not public.is_facturare() then
    raise exception 'Doar administratorul sau contabilul pot emite facturi.';
  end if;
  select * into f from public.facturi where id = p_id for update;
  if not found then
    raise exception 'Factura % nu există.', p_id;
  end if;
  if f.saga_status in ('trimisa', 'confirmata', 'se_trimite') then
    return json_build_object('ok', true, 'id', f.id, 'serie', f.serie, 'numar', f.numar, 'stare', f.saga_status);
  end if;
  if f.saga_status = 'in_curs' and f.updated_at > now() - interval '3 minutes' then
    raise exception 'Factura % % se trimite chiar acum. Încearcă din nou peste un minut.', f.serie, f.numar;
  end if;

  -- O trimitere de dinainte de 60 fără răspuns (in_curs uitat, timeout în jurnal) devine
  -- încercare FĂRĂ RĂSPUNS pe numărul ăsta: dacă SAGA spune „deja”, factura e a noastră.
  if (f.saga_status = 'in_curs'
      or exists (select 1 from public.saga_trimiteri t
                  where t.tip = 'import' and t.factura_ids @> array[f.id] and t.http_status is null))
     and not exists (select 1 from public.facturi_incercari i
                      where i.factura_id = f.id and i.serie = f.serie and i.numar = f.numar
                        and i.stare in ('in_curs', 'fara_raspuns')) then
    insert into public.facturi_incercari (factura_id, serie, numar, stare, eroare, terminata_la)
    values (f.id, f.serie, f.numar, 'fara_raspuns', 'Trimitere de dinainte de migrarea 60, fără răspuns cunoscut', now());
  end if;

  -- O factură (nu storno) încă modificabilă ia datele clientului de ACUM din comandă:
  -- după o respingere pe date, omul corectează comanda și apasă din nou același buton.
  if f.tip = 'factura' and f.saga_status in ('de_trimis', 'eroare') then
    v_lipsa := public.factura_lipsuri(f.order_id);
    if v_lipsa is not null then
      raise exception 'De completat în comandă: %.', v_lipsa;
    end if;
    select * into o from public.orders where id = f.order_id;
    update public.facturi
       set client = jsonb_build_object(
             'tip', o.tip_client, 'nume', o.nume, 'firma', o.firma, 'cui', o.cui,
             'adresa', o.adresa, 'localitate', o.oras, 'judet', o.judet, 'cod_judet', public.cod_judet(o.judet),
             'tara', 'RO', 'email', o.email, 'telefon', o.telefon)
     where id = f.id;
  end if;

  update public.facturi
     set saga_status = 'se_trimite', saga_eroare = null,
         lacat_pana = now() + interval '2 minutes', lacat_de = gen_random_uuid(),
         renumerotari = 0, reincercari = 0, reincearca_la = now()
   where id = f.id
  returning lacat_de into v_token;

  return json_build_object('ok', true, 'id', f.id, 'serie', f.serie, 'numar', f.numar,
                           'stare', 'se_trimite', 'token', v_token);
end;
$$;

create or replace function public.emite_factura_start(p_order_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  o       public.orders%rowtype;
  v_id    bigint;
  v_lipsa text;
  r       json;
begin
  if not public.is_facturare() then
    raise exception 'Doar administratorul sau contabilul pot emite facturi.';
  end if;
  -- Comanda blocată: dublu-clic / două taburi trec pe rând, iar al doilea găsește factura primului.
  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Comanda % nu există.', p_order_id;
  end if;

  select id into v_id from public.facturi
   where order_id = o.id and tip = 'factura' and not stornata order by id desc limit 1;
  if found then
    return public.facturi_porneste(v_id);
  end if;

  -- Validarea ÎNAINTE de număr: o lipsă nu consumă nimic.
  v_lipsa := public.factura_lipsuri(o.id);
  if v_lipsa is not null then
    raise exception 'De completat în comandă: %.', v_lipsa;
  end if;

  r := public.emite_factura(o.id);          -- 54, neschimbată: numărul, liniile, contorul
  return public.facturi_porneste((r ->> 'id')::bigint);
end;
$$;

revoke execute on function public.facturi_porneste(bigint)    from public, anon;
revoke execute on function public.emite_factura_start(bigint) from public, anon;
grant  execute on function public.facturi_porneste(bigint)    to authenticated, service_role;
grant  execute on function public.emite_factura_start(bigint) to authenticated, service_role;


-- ------------------------------------------------------------
-- 8. MOTORUL (doar serverul): lacătul, renumerotarea, eliberarea
-- ------------------------------------------------------------
-- Lacătul de 2 minute. Cu tokenul primit la pornire, cererea butonului continuă fără să
-- concureze cu ceasul; fără token, ia doar o factură liberă și scadentă.
create or replace function public.saga_factura_ia(p_id bigint, p_token uuid default null)
returns uuid
language sql
security definer
set search_path = public
as $$
  update public.facturi
     set lacat_pana = now() + interval '2 minutes', lacat_de = coalesce(p_token, gen_random_uuid())
   where id = p_id and saga_status = 'se_trimite'
     and ((p_token is not null and lacat_de = p_token)
          or ((lacat_pana is null or lacat_pana < now()) and coalesce(reincearca_la, '-infinity') <= now()))
  returning lacat_de;
$$;

create or replace function public.facturi_renumeroteaza(p_id bigint, p_token uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  f      public.facturi%rowtype;
  v_urm  int;
  v_nou  int;
  v_azi  date := (now() at time zone 'Europe/Bucharest')::date;
begin
  select * into f from public.facturi where id = p_id for update;
  if not found or f.saga_status <> 'se_trimite' or f.lacat_de is distinct from p_token then
    raise exception 'Renumerotarea cere factura în „se_trimite”, ținută de motor.';
  end if;
  if f.renumerotari >= 10 then
    raise exception 'Factura % % a fost renumerotată deja de 10 ori.', f.serie, f.numar;
  end if;
  select urmator into v_urm from public.facturi_serii where serie = f.serie for update;
  if v_urm is null then
    raise exception 'Seria „%” nu mai există în Setări serie.', f.serie;
  end if;
  v_nou := greatest(v_urm, f.numar + 1);
  while exists (select 1 from public.facturi x where x.serie = f.serie and x.numar = v_nou) loop
    v_nou := v_nou + 1;
  end loop;

  perform set_config('autopas.saga_motor', f.id::text, true);
  update public.facturi set numar = v_nou, data = v_azi, scadenta = v_azi, renumerotari = renumerotari + 1
   where id = f.id;
  perform set_config('autopas.saga_motor', '', true);
  update public.facturi_serii set urmator = greatest(urmator, v_nou + 1), actualizat_la = now() where serie = f.serie;

  if f.tip = 'factura' then
    update public.orders set factura_serie = f.serie || ' ' || v_nou where id = f.order_id;
  end if;
  insert into public.order_events (order_id, tip, mesaj, autor)
  values (f.order_id, 'factura', 'Numărul ' || f.serie || ' ' || f.numar
          || ' era deja folosit în SAGA (factură manuală): documentul a primit numărul ' || f.serie || ' ' || v_nou, 'sistem');

  return json_build_object('ok', true, 'serie', f.serie, 'numar', v_nou, 'vechi', f.numar);
end;
$$;

-- Respingere pe date: dacă numărul e încă ultimul din serie, factura se șterge și numărul
-- se refolosește (ca la retrage_factura din 54); altfel rămâne „eroare”, legată de număr.
create or replace function public.facturi_elibereaza(p_id bigint, p_token uuid, p_motiv text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  f       public.facturi%rowtype;
  v_urm   int;
  v_vechi record;
begin
  select * into f from public.facturi where id = p_id for update;
  if not found or f.saga_status <> 'se_trimite' or f.lacat_de is distinct from p_token then
    raise exception 'Eliberarea cere factura în „se_trimite”, ținută de motor.';
  end if;
  select urmator into v_urm from public.facturi_serii where serie = f.serie for update;

  if f.tip = 'factura' and v_urm = f.numar + 1 then
    perform set_config('autopas.saga_motor', f.id::text, true);
    delete from public.facturi where id = f.id;                              -- liniile, în cascadă
    perform set_config('autopas.saga_motor', '', true);
    update public.facturi_serii set urmator = f.numar, actualizat_la = now() where serie = f.serie;
    insert into public.facturi_serii_istoric (serie, urmator, actiune, detalii, facut_de, facut_de_email)
    values (f.serie, f.numar, 'retragere',
            'Factura ' || f.serie || ' ' || f.numar || ' eliberată: SAGA a respins-o (' || left(coalesce(p_motiv, ''), 300) || ')',
            null, null);
    select x.serie, x.numar into v_vechi
      from public.facturi x
     where x.order_id = f.order_id and x.tip = 'factura' and x.stornata
     order by x.id desc limit 1;
    if found then
      update public.orders set factura_serie = v_vechi.serie || ' ' || v_vechi.numar, factura_status = 'stornata' where id = f.order_id;
    else
      update public.orders set factura_serie = null, factura_status = 'de_emis' where id = f.order_id;
    end if;
    insert into public.order_events (order_id, tip, mesaj, autor)
    values (f.order_id, 'factura', 'Factura ' || f.serie || ' ' || f.numar || ' respinsă de SAGA și eliberată (numărul se refolosește): '
            || left(coalesce(p_motiv, ''), 300), 'sistem');
    return json_build_object('ok', true, 'eliberata', true, 'serie', f.serie, 'numar', f.numar);
  end if;

  update public.facturi
     set saga_status = 'eroare', saga_eroare = p_motiv, lacat_pana = null, lacat_de = null
   where id = f.id;
  return json_build_object('ok', true, 'eliberata', false, 'serie', f.serie, 'numar', f.numar);
end;
$$;

revoke execute on function public.saga_factura_ia(bigint, uuid)               from public, anon, authenticated;
revoke execute on function public.facturi_renumeroteaza(bigint, uuid)         from public, anon, authenticated;
revoke execute on function public.facturi_elibereaza(bigint, uuid, text)      from public, anon, authenticated;
grant  execute on function public.saga_factura_ia(bigint, uuid)               to service_role;
grant  execute on function public.facturi_renumeroteaza(bigint, uuid)         to service_role;
grant  execute on function public.facturi_elibereaza(bigint, uuid, text)      to service_role;


-- ------------------------------------------------------------
-- 9. CEASUL: reîncercările din fundal
-- ------------------------------------------------------------
create table if not exists public.saga_trezire (
  unic           boolean     primary key default true check (unic),
  activ          boolean     not null default true,
  webhook_url    text        not null default 'https://autopas-dezmembrari.ro/api/saga-coada',
  webhook_secret text        not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  ultima         timestamptz not null default '-infinity'
);
insert into public.saga_trezire (unic) values (true) on conflict (unic) do nothing;
alter table public.saga_trezire enable row level security;
revoke all on table public.saga_trezire from public, anon, authenticated;
grant select, update on table public.saga_trezire to service_role;

create or replace function public.saga_ceas()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_url text; v_secret text;
begin
  select webhook_url, webhook_secret into v_url, v_secret from public.saga_trezire where unic and activ;
  if coalesce(v_url, '') = '' or coalesce(v_secret, '') = '' then return false; end if;
  if not exists (select 1 from public.facturi
                  where saga_status = 'se_trimite'
                    and (lacat_pana is null or lacat_pana < now())
                    and coalesce(reincearca_la, '-infinity') <= now()) then
    return false;
  end if;
  update public.saga_trezire set ultima = now() where unic and ultima < now() - interval '50 seconds';
  if not found then return false; end if;
  perform net.http_post(
    url := v_url, body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-autopas-saga', v_secret),
    timeout_milliseconds := 10000);
  return true;
end;
$$;
revoke execute on function public.saga_ceas() from public, anon, authenticated;
grant  execute on function public.saga_ceas() to service_role;

select cron.schedule('saga-coada', '* * * * *', 'select public.saga_ceas()');


-- ============================================================
-- VERIFICAREA FINALĂ (doar citire): true | true | true
-- ============================================================
select
  md5(replace(prosrc, E'\r', '')) = 'f8bccca0f490afa7f2ccf5a96d4be32d' as paza_60,
  to_regclass('public.facturi_o_activa_pe_comanda') is not null as index_unic,
  exists (select 1 from cron.job where jobname = 'saga-coada') as ceas
from pg_proc where oid = to_regprocedure('public.facturi_pazeste()');
