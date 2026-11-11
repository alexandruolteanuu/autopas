-- ============================================================
-- MIGRAREA 53 — STORNAREA ȘI ASCUNDEREA FACTURILOR DE PROBĂ
-- (pasul 10 din docs/saga-plan.md, 12 noiembrie 2026)
--
-- Doar obiecte NOI. Nu înlocuiește nicio funcție existentă și nu adaugă coloane pe
-- tabelele existente. Depinde de 47 (`calculeaza_linie_tva` nu e folosită direct —
-- stornarea e copia cu semn schimbat) și de 49 (`facturi`, `facturi_linii`,
-- `facturi_serii`, `is_facturare`). Idempotentă.
--
--   · `storneaza_factura(id, motiv)` — documentul storno al unei facturi TRIMISE sau
--     CONFIRMATE: aceeași serie, număr nou (fără goluri, sub lacătul seriei), aceleași
--     linii cu cantitatea și sumele cu semn schimbat (totalul = exact opusul), copia
--     clientului și a furnizorului de pe factură. Comanda → `factura_status = 'stornata'`.
--     Pleacă în SAGA ca orice factură (pasul 8). Regula A.15: după pornire, stornările pe
--     PAP FE se fac DOAR de aici, niciodată manual în SAGA.
--   · `retrage_storno(id)` — un storno apăsat din greșeală, cât e NETRIMIS și ULTIMUL din
--     serie: se șterge, contorul dă înapoi, comanda revine la „emisă”. (`retrage_factura`
--     din 49 refuză stornările și NU se rescrie.)
--   · `facturi_ascunse` + `ascunde_factura` / `reafiseaza_factura` — DOAR pe seriile de
--     probă (numele începe cu „PROBA” sau „TEST”): o factură de probă trimisă în SAGA nu se
--     mai poate retrage, dar nu trebuie să încarce lista. Nu se șterge nimic: ascunsă = doar
--     nu apare implicit în listă. O factură pe o serie reală NU se poate ascunde.
--
-- Limită știută (NU schimbată aici): după stornare comanda e „stornata”, iar
-- `emite_factura` (51) refuză comenzile care nu sunt „de_emis” — deci o comandă stornată
-- nu primește o factură nouă din aplicație. Refacturarea ar cere rescrierea lui
-- `emite_factura`, cu gardă de amprentă — decizie separată.
--
-- Anularea: scripts/anuleaza-saga-stornare.sql. Verificarea: scripts/verifica-saga-stornare.sql.
-- ============================================================

-- ---------- facturile ascunse (doar probe) ----------
create table if not exists public.facturi_ascunse (
  factura_id  bigint primary key references public.facturi (id) on delete cascade,
  motiv       text,
  ascunsa_la  timestamptz not null default now(),
  ascunsa_de  uuid
);
comment on table public.facturi_ascunse is
  'Facturile de PROBĂ (serie „PROBA…” / „TEST…”) ascunse din lista din Facturi. Nu se șterge nimic. Scriere doar prin ascunde_factura / reafiseaza_factura.';
alter table public.facturi_ascunse enable row level security;
revoke all on table public.facturi_ascunse from public, anon, authenticated;
grant select on table public.facturi_ascunse to authenticated;
grant select, insert, delete on table public.facturi_ascunse to service_role;
drop policy if exists "facturi ascunse citire" on public.facturi_ascunse;
create policy "facturi ascunse citire" on public.facturi_ascunse
  for select to authenticated using (public.is_facturare());

-- O serie e „de probă” dacă numele ei începe cu PROBA sau TEST (fără diferență de majuscule).
create or replace function public.serie_de_proba(p_serie text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select upper(btrim(coalesce(p_serie, ''))) ~ '^(PROBA|TEST)';
$$;

-- ---------- stornarea ----------
create or replace function public.storneaza_factura(p_id bigint, p_motiv text default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  f        public.facturi%rowtype;
  v_numar  int;
  v_id     bigint;
  v_azi    date := (now() at time zone 'Europe/Bucharest')::date;
  v_obs    text;
begin
  if not public.is_facturare() then
    raise exception 'Doar administratorul sau contabilul pot storna facturi.';
  end if;

  -- Factura, blocată: două stornări simultane nu trec amândouă de verificări.
  select * into f from public.facturi where id = p_id for update;
  if not found then
    raise exception 'Factura % nu există.', p_id;
  end if;
  if f.tip <> 'factura' then
    raise exception 'Documentul % % e deja un storno — nu se stornează.', f.serie, f.numar;
  end if;
  if f.saga_status not in ('trimisa', 'confirmata') then
    raise exception 'Factura % % e „%”: se stornează doar o factură trimisă în SAGA. Înainte de trimitere se corectează („Modifică”) sau, dacă e ultima din serie, se retrage.',
      f.serie, f.numar, f.saga_status;
  end if;
  if exists (select 1 from public.facturi s where s.storno_pentru = f.id) then
    raise exception 'Factura % % are deja un storno.', f.serie, f.numar;
  end if;

  -- Numărul: din ACEEAȘI serie, blocată până la sfârșitul tranzacției (ca la emitere).
  select urmator into v_numar from public.facturi_serii where serie = f.serie for update;
  if v_numar is null then
    raise exception 'Seria „%” a facturii nu mai există în Setări serie — stornarea nu poate primi număr.', f.serie;
  end if;

  v_obs := 'Stornare factura ' || f.serie || ' ' || f.numar || ' din ' || to_char(f.data, 'DD.MM.YYYY')
           || coalesce('. Motiv: ' || nullif(btrim(coalesce(p_motiv, '')), ''), '');

  insert into public.facturi (tip, storno_pentru, order_id, serie, numar, data, scadenta, regim_tva, preturi_cu_tva,
                              client, furnizor, mentiune_plata, observatii, emisa_de)
  values ('storno', f.id, f.order_id, f.serie, v_numar, v_azi, v_azi, f.regim_tva, f.preturi_cu_tva,
          f.client, f.furnizor, f.mentiune_plata, v_obs, auth.uid())
  returning id into v_id;

  -- Liniile: copia exactă, cu cantitatea și sumele cu semn schimbat; prețul unitar rămâne
  -- cel de pe factură (regula din calculeaza_linie_tva: cantitatea poartă semnul).
  insert into public.facturi_linii (factura_id, nr_crt, tip, order_item_id, product_id, cod_intern, denumire_site,
                                    cod_articol_saga, descriere, um, cantitate, pret_cu_tva, pret_fara_tva,
                                    valoare, cota_tva, tva, total)
  select v_id, l.nr_crt, l.tip, l.order_item_id, l.product_id, l.cod_intern, l.denumire_site,
         l.cod_articol_saga, l.descriere, l.um, -l.cantitate, l.pret_cu_tva, l.pret_fara_tva,
         -l.valoare, l.cota_tva, -l.tva, -l.total
    from public.facturi_linii l
   where l.factura_id = f.id
   order by l.nr_crt;

  update public.facturi s
     set total_fara_tva = -f.total_fara_tva, total_tva = -f.total_tva, total = -f.total
   where s.id = v_id;

  update public.facturi_serii set urmator = v_numar + 1, actualizat_la = now() where serie = f.serie;

  update public.orders set factura_status = 'stornata' where id = f.order_id;
  insert into public.order_events (order_id, tip, mesaj, autor)
  values (f.order_id, 'factura', 'Factura ' || f.serie || ' ' || f.numar || ' stornată: storno ' || f.serie || ' ' || v_numar
          || ' (de trimis în SAGA)' || coalesce('. Motiv: ' || nullif(btrim(coalesce(p_motiv, '')), ''), ''),
          coalesce(auth.jwt() ->> 'email', 'sistem'));

  return json_build_object('ok', true, 'id', v_id, 'serie', f.serie, 'numar', v_numar, 'total', -f.total);
end;
$$;

comment on function public.storneaza_factura(bigint, text) is
  'Stornează o factură trimisă/confirmată: document storno în aceeași serie (număr nou, fără goluri), liniile cu semn schimbat, comanda „stornata”. Doar admin/contabil.';

-- ---------- retragerea unui storno netrimis ----------
create or replace function public.retrage_storno(p_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  f      public.facturi%rowtype;
  o      public.facturi%rowtype;
  v_urm  int;
begin
  if not public.is_facturare() then
    raise exception 'Doar administratorul sau contabilul pot retrage stornări.';
  end if;
  select * into f from public.facturi where id = p_id for update;
  if not found then
    raise exception 'Documentul % nu există.', p_id;
  end if;
  if f.tip <> 'storno' then
    raise exception 'Documentul % % nu e un storno (o factură se retrage cu „Retrage”).', f.serie, f.numar;
  end if;
  if f.saga_status <> 'de_trimis' then
    raise exception 'Stornoul % % a plecat spre SAGA (stare: %) — nu se mai retrage.', f.serie, f.numar, f.saga_status;
  end if;
  select urmator into v_urm from public.facturi_serii where serie = f.serie for update;
  if v_urm is null or f.numar <> v_urm - 1 then
    raise exception 'Doar ultimul document din seria „%” se poate retrage (ultimul are numărul %).', f.serie, coalesce(v_urm - 1, 0);
  end if;
  select * into o from public.facturi where id = f.storno_pentru;

  delete from public.facturi where id = f.id;                              -- liniile, în cascadă
  update public.facturi_serii set urmator = f.numar, actualizat_la = now() where serie = f.serie;
  insert into public.facturi_serii_istoric (serie, urmator, actiune, detalii, facut_de, facut_de_email)
  values (f.serie, f.numar, 'retragere', 'Storno ' || f.serie || ' ' || f.numar || ' retras înainte de trimitere',
          auth.uid(), auth.jwt() ->> 'email');
  -- Comanda revine la factura de dinainte de stornare.
  update public.orders set factura_status = 'emisa', factura_serie = o.serie || ' ' || o.numar where id = f.order_id;
  insert into public.order_events (order_id, tip, mesaj, autor)
  values (f.order_id, 'factura', 'Storno ' || f.serie || ' ' || f.numar || ' retras înainte de trimiterea în SAGA; factura '
          || o.serie || ' ' || o.numar || ' rămâne valabilă (numărul se refolosește)',
          coalesce(auth.jwt() ->> 'email', 'sistem'));

  return json_build_object('ok', true, 'serie', f.serie, 'numar', f.numar);
end;
$$;

comment on function public.retrage_storno(bigint) is
  'Șterge un storno NETRIMIS, doar dacă e ultimul din serie; contorul dă înapoi, comanda revine la „emisa”. Doar admin/contabil.';

-- ---------- ascunderea facturilor de probă ----------
create or replace function public.ascunde_factura(p_id bigint, p_motiv text default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.facturi%rowtype;
begin
  if not public.is_facturare() then
    raise exception 'Doar administratorul sau contabilul pot ascunde facturi.';
  end if;
  select * into f from public.facturi where id = p_id;
  if not found then
    raise exception 'Factura % nu există.', p_id;
  end if;
  if not public.serie_de_proba(f.serie) then
    raise exception 'Se ascund doar facturile de PROBĂ (seria începe cu PROBA sau TEST). Factura % % e pe o serie reală: un document fiscal nu dispare din listă — se stornează.',
      f.serie, f.numar;
  end if;
  insert into public.facturi_ascunse (factura_id, motiv, ascunsa_de)
  values (f.id, nullif(btrim(coalesce(p_motiv, '')), ''), auth.uid())
  on conflict (factura_id) do nothing;
  return json_build_object('ok', true, 'serie', f.serie, 'numar', f.numar);
end;
$$;

create or replace function public.reafiseaza_factura(p_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_facturare() then
    raise exception 'Doar administratorul sau contabilul pot reafișa facturi.';
  end if;
  delete from public.facturi_ascunse where factura_id = p_id;
  return json_build_object('ok', true);
end;
$$;

-- Drepturile: pe Supabase funcțiile noi primesc drept DIRECT pentru `anon` (lecția din 42).
revoke execute on function public.serie_de_proba(text)              from public, anon;
revoke execute on function public.storneaza_factura(bigint, text)   from public, anon;
revoke execute on function public.retrage_storno(bigint)            from public, anon;
revoke execute on function public.ascunde_factura(bigint, text)     from public, anon;
revoke execute on function public.reafiseaza_factura(bigint)        from public, anon;
grant  execute on function public.serie_de_proba(text)              to authenticated, service_role;
grant  execute on function public.storneaza_factura(bigint, text)   to authenticated, service_role;
grant  execute on function public.retrage_storno(bigint)            to authenticated, service_role;
grant  execute on function public.ascunde_factura(bigint, text)     to authenticated, service_role;
grant  execute on function public.reafiseaza_factura(bigint)        to authenticated, service_role;
