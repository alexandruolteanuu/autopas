-- ============================================================
-- ANULAREA MIGRĂRII 50 (supabase/saga-articole.sql) — DOAR LA NEVOIE
--
-- Pune înapoi `emite_factura` EXACT cum era în migrarea 49 (fără potrivire pe
-- categorii: toate piesele pe articolul implicit), apoi șterge `saga_articole`.
-- Facturile deja emise NU se ating (au articolul copiat pe fiecare linie).
--
-- GARDĂ: se oprește dacă `emite_factura` din bază nu e versiunea din migrarea 50
-- (amprenta 8eefb50d4c81c4ea93701317e9ac67ed) — nu calcă o modificare necunoscută. Fără `cascade`.
-- Rulare: Supabase → SQL Editor → lipești tot → Run. O singură tranzacție.
-- ============================================================

begin;

do $$
declare v text;
begin
  -- Fără „\r”: SQL Editor-ul de pe Windows salvează funcțiile cu CRLF (vezi migrarea 50).
  select md5(replace(prosrc, E'\r', '')) into v from pg_proc where oid = to_regprocedure('public.emite_factura(bigint)');
  if v is distinct from '8eefb50d4c81c4ea93701317e9ac67ed' then
    raise exception 'OPRIT: emite_factura din bază nu e versiunea din migrarea 50 (amprenta %). Nu se anulează nimic.', coalesce(v, 'lipsă');
  end if;
end $$;

create or replace function public.emite_factura(p_order_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  o          public.orders%rowtype;
  v_saga     jsonb;
  v_firma    jsonb;
  v_start_t  text;
  v_start    date;
  v_azi      date := (now() at time zone 'Europe/Bucharest')::date;
  v_plasata  date;
  v_cota     numeric;
  v_regim    text;
  v_serie    text;
  v_numar    int;
  v_art_cod  text;  v_art_den  text;  v_art_um text;
  v_red_cod  text;  v_red_den  text;
  v_tr_cod   text;  v_tr_den   text;
  v_cod_jud  text;
  v_fur_jud  text;
  v_id       bigint;
  v_nr       int := 0;
  v_transport numeric;
  i          record;
  t          record;
begin
  if not public.is_facturare() then
    raise exception 'Doar administratorul sau contabilul pot emite facturi.';
  end if;

  -- 1. Comanda, blocată: două emiteri pe aceeași comandă nu trec amândouă de verificarea de mai jos.
  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Comanda % nu există.', p_order_id;
  end if;
  if o.status = 'anulata' then
    raise exception 'Comanda % e anulată — nu se facturează.', o.numar;
  end if;
  if exists (select 1 from public.facturi f
              where f.order_id = o.id and f.tip = 'factura'
                and not exists (select 1 from public.facturi s where s.storno_pentru = f.id)) then
    raise exception 'Comanda % are deja o factură (nestornată).', o.numar;
  end if;
  if not exists (select 1 from public.order_items where order_id = o.id) then
    raise exception 'Comanda % nu are nicio piesă.', o.numar;
  end if;

  select valoare -> 'saga' into v_saga from public.settings where cheie = 'integrari';
  v_saga := coalesce(v_saga, '{}'::jsonb);

  -- 1b. Data de start a facturării (regula din 10 noiembrie 2026): comenzile de
  -- dinainte au fost facturate manual în SAGA și NU se facturează de aici.
  v_start_t := btrim(coalesce(v_saga ->> 'data_start_facturare', ''));
  if v_start_t = '' then
    raise exception 'Data de start a facturării nu e setată (Admin → Integrări → Saga). Până atunci nu se emite nicio factură din aplicație; comenzile se facturează manual în SAGA.';
  end if;
  begin
    if v_start_t !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'format'; end if;
    v_start := v_start_t::date;
  exception when others then
    raise exception 'Data de start a facturării „%” nu e o dată validă (AAAA-LL-ZZ).', v_start_t;
  end;
  v_plasata := (o.created_at at time zone 'Europe/Bucharest')::date;
  if v_plasata < v_start then
    raise exception 'Comanda % a fost plasată pe %, înainte de data de start a facturării (%). Comenzile de dinainte se facturează manual în SAGA, nu din aplicație.',
      o.numar, to_char(v_plasata, 'DD.MM.YYYY'), to_char(v_start, 'DD.MM.YYYY');
  end if;

  -- 2. Seria activă, blocată până la sfârșitul tranzacției.
  select serie, urmator into v_serie, v_numar from public.facturi_serii where activa for update;
  if not found then
    raise exception 'Seria facturilor nu e configurată. Setați seria și numărul de start în Facturi → Setări serie, în ziua pornirii, după ultima factură manuală.';
  end if;

  -- 3. TVA: cota și regimul din setări (refuză valori greșite și regimul marjă).
  v_cota  := public.saga_cota_tva();
  v_regim := 'normal';

  -- 4. Articolele din gestiunea SAGA. Codul articolului implicit e obligatoriu.
  v_art_cod := btrim(coalesce(v_saga ->> 'articol_implicit', ''));
  v_art_den := btrim(coalesce(v_saga ->> 'articol_implicit_denumire', ''));
  v_art_um  := coalesce(nullif(btrim(coalesce(v_saga ->> 'articol_implicit_um', '')), ''), 'BUC');
  if v_art_cod = '' or v_art_den = '' then
    raise exception 'Articolul implicit din gestiunea SAGA (cod și denumire) nu e setat în Admin → Integrări → Saga. Codul îl dă contabila.';
  end if;
  v_red_cod := coalesce(nullif(btrim(coalesce(v_saga ->> 'articol_reducere', '')), ''), v_art_cod);
  v_red_den := case when v_red_cod = v_art_cod then v_art_den
                    else coalesce(nullif(btrim(coalesce(v_saga ->> 'articol_reducere_denumire', '')), ''), v_art_den) end;
  v_tr_cod  := coalesce(nullif(btrim(coalesce(v_saga ->> 'articol_transport', '')), ''), v_art_cod);
  v_tr_den  := case when v_tr_cod = v_art_cod then v_art_den
                    else coalesce(nullif(btrim(coalesce(v_saga ->> 'articol_transport_denumire', '')), ''), v_art_den) end;

  -- 5. Furnizorul: copia datelor firmei din Admin → Setări.
  select valoare into v_firma from public.settings where cheie = 'firma';
  v_firma := coalesce(v_firma, '{}'::jsonb);
  if btrim(coalesce(v_firma ->> 'denumire', '')) = '' or btrim(coalesce(v_firma ->> 'cui', '')) = ''
     or btrim(coalesce(v_firma ->> 'reg_com', '')) = '' or btrim(coalesce(v_firma ->> 'adresa', '')) = ''
     or btrim(coalesce(v_firma ->> 'iban', '')) = '' then
    raise exception 'Datele firmei sunt incomplete (denumire, CUI, Reg. Com., adresă, IBAN) — Admin → Setări → Date firmă.';
  end if;
  v_fur_jud := public.cod_judet(v_firma ->> 'judet');

  -- 6. Clientul: copia din comandă. Județul trebuie recunoscut (SAGA cere codul).
  v_cod_jud := public.cod_judet(o.judet);
  if v_cod_jud is null then
    raise exception 'Județul „%” al comenzii % nu e recunoscut — corectați-l în comandă.', o.judet, o.numar;
  end if;

  -- 7. Documentul.
  insert into public.facturi (order_id, serie, numar, data, scadenta, regim_tva, preturi_cu_tva,
                              client, furnizor, mentiune_plata, observatii, emisa_de)
  values (o.id, v_serie, v_numar, v_azi, v_azi, v_regim, true,
          jsonb_build_object(
            'tip', o.tip_client, 'nume', o.nume, 'firma', o.firma, 'cui', o.cui,
            'adresa', o.adresa, 'localitate', o.oras, 'judet', o.judet, 'cod_judet', v_cod_jud,
            'tara', 'RO', 'email', o.email, 'telefon', o.telefon),
          v_firma || jsonb_build_object('cod_judet', v_fur_jud),
          nullif(btrim(coalesce(v_saga ->> 'mentiune_plata', '')), ''),
          'Comanda ' || o.numar,
          auth.uid())
  returning id into v_id;

  -- 8. Liniile: piesele, apoi reducerea (linie negativă), apoi transportul facturabil.
  for i in
    select oi.id, oi.product_id, oi.nume, oi.pret, oi.cantitate, p.cod_intern
      from public.order_items oi left join public.products p on p.id = oi.product_id
     where oi.order_id = o.id
     order by oi.id
  loop
    v_nr := v_nr + 1;
    select * into t from public.calculeaza_linie_tva(i.pret, i.cantitate, v_cota);
    insert into public.facturi_linii (factura_id, nr_crt, tip, order_item_id, product_id, cod_intern,
                                      denumire_site, cod_articol_saga, descriere, um, cantitate,
                                      pret_cu_tva, pret_fara_tva, valoare, cota_tva, tva, total)
    values (v_id, v_nr, 'piesa', i.id, i.product_id, i.cod_intern,
            i.nume, v_art_cod, v_art_den, v_art_um, i.cantitate,
            i.pret, t.pret_fara_tva, t.valoare, v_cota, t.tva, t.total);
  end loop;

  if coalesce(o.discount_valoare, 0) > 0 then
    v_nr := v_nr + 1;
    select * into t from public.calculeaza_linie_tva(-o.discount_valoare, 1, v_cota);
    insert into public.facturi_linii (factura_id, nr_crt, tip, denumire_site, cod_articol_saga, descriere, um,
                                      cantitate, pret_cu_tva, pret_fara_tva, valoare, cota_tva, tva, total)
    values (v_id, v_nr, 'reducere',
            'Reducere' || coalesce(' cod ' || nullif(o.discount_cod, ''), ''),
            v_red_cod, v_red_den, v_art_um, 1, -o.discount_valoare, t.pret_fara_tva, t.valoare, v_cota, t.tva, t.total);
  end if;

  v_transport := public.transport_facturabil(o.subtotal, o.discount_valoare, o.livrare, o.total);
  if v_transport > 0 then
    v_nr := v_nr + 1;
    select * into t from public.calculeaza_linie_tva(v_transport, 1, v_cota);
    insert into public.facturi_linii (factura_id, nr_crt, tip, denumire_site, cod_articol_saga, descriere, um,
                                      cantitate, pret_cu_tva, pret_fara_tva, valoare, cota_tva, tva, total)
    values (v_id, v_nr, 'transport', 'Transport', v_tr_cod, v_tr_den, v_art_um,
            1, v_transport, t.pret_fara_tva, t.valoare, v_cota, t.tva, t.total);
  end if;

  update public.facturi f
     set total_fara_tva = s.v, total_tva = s.t, total = s.tot
    from (select sum(valoare) v, sum(tva) t, sum(total) tot from public.facturi_linii where factura_id = v_id) s
   where f.id = v_id;

  -- 9. Contorul: abia acum, în aceeași tranzacție.
  update public.facturi_serii set urmator = v_numar + 1, actualizat_la = now() where serie = v_serie;

  -- 10. Oglinda pe comandă (A.9) + jurnalul comenzii.
  update public.orders set factura_serie = v_serie || ' ' || v_numar, factura_status = 'emisa' where id = o.id;
  insert into public.order_events (order_id, tip, mesaj, autor)
  values (o.id, 'factura', 'Factură emisă din aplicație: ' || v_serie || ' ' || v_numar || ' (de trimis în SAGA)',
          coalesce(auth.jwt() ->> 'email', 'sistem'));

  return json_build_object('ok', true, 'id', v_id, 'serie', v_serie, 'numar', v_numar,
                           'total', (select total from public.facturi where id = v_id));
end;
$$;

comment on function public.emite_factura(bigint) is
  'Emite factura unei comenzi: număr din seria activă (fără goluri), copia clientului, furnizorului și liniilor, TVA cu calculeaza_linie_tva. Refuză comenzile dinaintea data_start_facturare. Doar admin/contabil.';

drop table if exists public.saga_articole;

commit;

-- Verificare: amprenta trebuie să fie cea din migrarea 49 (5b89a9154101aacc8d72d4d864b01356), iar tabela să lipsească.
select md5(replace(prosrc, E'\r', '')) = '5b89a9154101aacc8d72d4d864b01356' as emite_factura_ca_in_49,
       to_regclass('public.saga_articole') is null as saga_articole_stearsa
  from pg_proc where oid = 'public.emite_factura(bigint)'::regprocedure;
