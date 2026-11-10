-- ============================================================
-- AUTOPAS — SAGA, PASUL 6: EMITEREA DIN INTERFAȚĂ — CORECTURI, OPRIRE, PAZĂ
-- Migrarea 51 (10 noiembrie 2026). Planul: docs/saga-plan.md, pasul 6 din C.
--
-- CE ATINGE DIN CE EXISTĂ (doar obiecte SAGA, create de 49–50):
--   · RESCRIE `emite_factura` (din 50): o singură verificare în plus — refuză o
--     comandă marcată deja ca facturată pe altă cale (`orders.factura_serie`
--     completat sau `factura_status` ≠ „de_emis”, adică factura notată de mână
--     din SAGA, „nu se emite” sau stornată). Fără ea, o factură din aplicație pe o
--     comandă deja facturată manual ar fi a doua factură pentru aceeași vânzare,
--     iar o retragere i-ar șterge nota. Restul funcției e IDENTIC cu 50.
--     GARDĂ: amprenta FĂRĂ „\r” trebuie să fie a versiunii 50 (8eefb50d4c81c4ea93701317e9ac67ed) sau 51
--     (a1a45bbd8ce6ad03eae408ee9d2f113e, la re-rulare); altfel migrarea se OPREȘTE.
--   · `facturi_serii_istoric`: constrângerea `actiune` primește și „oprire”.
--   · funcții NOI: `modifica_factura` (corecturi înainte de trimitere),
--     `opreste_emiterea` (nicio serie activă).
--   · Nicio tabelă, funcție sau rând din afara obiectelor SAGA.
--
-- Depinde de 50 (rulată). NU depinde de 46. Idempotentă.
-- Testele: scripts/verifica-saga-emitere.sql. Anularea: scripts/anuleaza-saga-emitere.sql.
-- ============================================================


-- ------------------------------------------------------------
-- 1. GARDA: emite_factura din bază = versiunea din git (fără „\r”)
-- ------------------------------------------------------------
do $$
declare v text;
begin
  -- Fără „\r”: SQL Editor-ul folosit de pe Windows salvează funcțiile cu CRLF.
  select md5(replace(prosrc, E'\r', '')) into v from pg_proc where oid = to_regprocedure('public.emite_factura(bigint)');
  if v is null then
    raise exception 'OPRIT: emite_factura nu există — migrările 49–50 nu sunt rulate.';
  end if;
  if v not in ('8eefb50d4c81c4ea93701317e9ac67ed', 'a1a45bbd8ce6ad03eae408ee9d2f113e') then
    raise exception 'OPRIT: emite_factura din bază diferă de versiunea din git (amprenta fără CR: %). Nu se rescrie nimic. Trimite textul funcției (select pg_get_functiondef(''public.emite_factura(bigint)''::regprocedure)) pentru comparare.', v;
  end if;
end $$;


-- ------------------------------------------------------------
-- 2. ISTORICUL SERIILOR: și „oprire”
-- ------------------------------------------------------------
alter table public.facturi_serii_istoric drop constraint if exists facturi_serii_istoric_actiune_check;
alter table public.facturi_serii_istoric add constraint facturi_serii_istoric_actiune_check
  check (actiune in ('setare', 'retragere', 'oprire'));


-- ------------------------------------------------------------
-- 3. OPRIREA EMITERII: nicio serie activă
--
-- După o probă pe o serie de test (sau oricând trebuie oprită emiterea), seria
-- activă se dezactivează. `emite_factura` refuză atunci tot („Seria facturilor nu
-- e configurată”). Rândul seriei rămâne, cu numărul următor, pentru istoric.
-- ------------------------------------------------------------
create or replace function public.opreste_emiterea()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n int := 0;
begin
  if not public.is_facturare() then
    raise exception 'Doar administratorul sau contabilul pot opri emiterea facturilor.';
  end if;
  for r in update public.facturi_serii set activa = false, actualizat_la = now(), actualizat_de = auth.uid()
            where activa returning serie, urmator loop
    n := n + 1;
    insert into public.facturi_serii_istoric (serie, urmator, actiune, detalii, facut_de, facut_de_email)
    values (r.serie, r.urmator, 'oprire', 'Emiterea oprită: nicio serie activă', auth.uid(), auth.jwt() ->> 'email');
  end loop;
  return json_build_object('ok', true, 'oprite', n);
end;
$$;

comment on function public.opreste_emiterea() is
  'Dezactivează seria activă: din acel moment nu se mai emite nicio factură până la o nouă setare de serie. Doar admin/contabil.';


-- ------------------------------------------------------------
-- 4. CORECTURI ÎNAINTE DE TRIMITERE
--
-- Doar cât factura e „de_trimis” sau „eroare” (triggerul din 49 apără oricum
-- restul). Se pot corecta: datele CLIENTULUI din copie și, pe linii, ARTICOLUL din
-- gestiune (cod, denumire, UM). Prețurile, cantitățile, TVA-ul, seria și numărul
-- NU — ele vin din comandă; o comandă greșită se corectează altfel (retragere).
-- ------------------------------------------------------------
create or replace function public.modifica_factura(p_id bigint, p_client jsonb, p_linii jsonb)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  f        public.facturi%rowtype;
  v_client jsonb;
  v_permis constant text[] := array['nume', 'firma', 'cui', 'nr_reg_com', 'adresa', 'localitate',
                                    'judet', 'email', 'telefon', 'tara'];
  v_cheie  text;
  v_cod    text;
  l        jsonb;
  v_n      int;
begin
  if not public.is_facturare() then
    raise exception 'Doar administratorul sau contabilul pot modifica facturi.';
  end if;
  select * into f from public.facturi where id = p_id for update;
  if not found then
    raise exception 'Factura % nu există.', p_id;
  end if;
  if f.saga_status not in ('de_trimis', 'eroare') then
    raise exception 'Factura % % a plecat spre SAGA (stare: %): nu se mai modifică. Corecturile se fac în SAGA, iar în aplicație rămâne stornarea.',
      f.serie, f.numar, f.saga_status;
  end if;

  -- Clientul: doar cheile permise; restul cheilor trimise se ignoră.
  v_client := f.client;
  if p_client is not null then
    for v_cheie in select jsonb_object_keys(p_client) loop
      if v_cheie = any(v_permis) then
        v_client := v_client || jsonb_build_object(v_cheie, nullif(btrim(coalesce(p_client ->> v_cheie, '')), ''));
      end if;
    end loop;
  end if;
  if coalesce(btrim(v_client ->> 'nume'), '') = '' and coalesce(btrim(v_client ->> 'firma'), '') = '' then
    raise exception 'Clientul trebuie să aibă nume sau denumirea firmei.';
  end if;
  v_cod := public.cod_judet(v_client ->> 'judet');
  if v_cod is null then
    raise exception 'Județul „%” nu e recunoscut.', coalesce(v_client ->> 'judet', '');
  end if;
  v_client := v_client || jsonb_build_object('cod_judet', v_cod);
  update public.facturi set client = v_client where id = f.id;

  -- Liniile: doar articolul din gestiune.
  if p_linii is not null then
    for l in select * from jsonb_array_elements(p_linii) loop
      if coalesce(btrim(l ->> 'cod_articol_saga'), '') = '' or coalesce(btrim(l ->> 'descriere'), '') = '' then
        raise exception 'Linia %: codul și denumirea articolului sunt obligatorii.', l ->> 'id';
      end if;
      update public.facturi_linii
         set cod_articol_saga = btrim(l ->> 'cod_articol_saga'),
             descriere        = btrim(l ->> 'descriere'),
             um               = coalesce(nullif(btrim(coalesce(l ->> 'um', '')), ''), um)
       where id = (l ->> 'id')::bigint and factura_id = f.id;
      get diagnostics v_n = row_count;
      if v_n = 0 then
        raise exception 'Linia % nu aparține facturii % %.', l ->> 'id', f.serie, f.numar;
      end if;
    end loop;
  end if;

  insert into public.order_events (order_id, tip, mesaj, autor)
  values (f.order_id, 'factura', 'Factura ' || f.serie || ' ' || f.numar || ' corectată înainte de trimitere',
          coalesce(auth.jwt() ->> 'email', 'sistem'));
  return json_build_object('ok', true, 'id', f.id);
end;
$$;

comment on function public.modifica_factura(bigint, jsonb, jsonb) is
  'Corectează, înainte de trimiterea în SAGA, datele clientului din copie și articolul din gestiune pe linii. Prețurile și numerotarea nu se ating. Doar admin/contabil.';

revoke execute on function public.opreste_emiterea()                     from public;
revoke execute on function public.opreste_emiterea()                     from anon;
revoke execute on function public.modifica_factura(bigint, jsonb, jsonb) from public;
revoke execute on function public.modifica_factura(bigint, jsonb, jsonb) from anon;
grant  execute on function public.opreste_emiterea()                     to authenticated, service_role;
grant  execute on function public.modifica_factura(bigint, jsonb, jsonb) to authenticated, service_role;


-- ------------------------------------------------------------
-- 5. EMITEREA, CU PAZA PE COMENZILE FACTURATE DEJA
-- ------------------------------------------------------------
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
  -- Comanda marcată deja ca facturată pe altă cale (seria notată de mână, „nu se
  -- emite”, stornată) NU primește o factură din aplicație: ar fi a doua factură pentru
  -- aceeași vânzare, iar o retragere i-ar șterge nota manuală (pasul 6, migrarea 51).
  if o.factura_serie is not null or coalesce(o.factura_status, 'de_emis') <> 'de_emis' then
    raise exception 'Comanda % e deja marcată ca facturată (serie notată: „%”, stare: %), probabil manual în SAGA. Nu se emite o a doua factură din aplicație.',
      o.numar, coalesce(o.factura_serie, '—'), o.factura_status;
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

  -- 4. Articolele din gestiunea SAGA. Codul articolului implicit e obligatoriu: e și
  --    rezerva pentru piesele fără potrivire în `saga_articole` (pasul 5).
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
  -- Articolul fiecărei piese (pasul 5, migrarea 50): potrivirea SUBCATEGORIEI piesei
  -- câștigă, apoi a CATEGORIEI, apoi articolul implicit. O piesă ștearsă din catalog
  -- (fără rând în `products`) primește articolul implicit.
  for i in
    select oi.id, oi.product_id, oi.nume, oi.pret, oi.cantitate, p.cod_intern,
           a.cod_articol, a.denumire as art_den, a.um as art_um
      from public.order_items oi
      left join public.products p on p.id = oi.product_id
      left join lateral (
        select sa.cod_articol, sa.denumire, sa.um
          from public.saga_articole sa
         where sa.categorie_id = p.subcategorie_id or sa.categorie_id = p.categorie_id
         order by (sa.categorie_id = p.subcategorie_id) desc nulls last
         limit 1) a on true
     where oi.order_id = o.id
     order by oi.id
  loop
    v_nr := v_nr + 1;
    select * into t from public.calculeaza_linie_tva(i.pret, i.cantitate, v_cota);
    insert into public.facturi_linii (factura_id, nr_crt, tip, order_item_id, product_id, cod_intern,
                                      denumire_site, cod_articol_saga, descriere, um, cantitate,
                                      pret_cu_tva, pret_fara_tva, valoare, cota_tva, tva, total)
    values (v_id, v_nr, 'piesa', i.id, i.product_id, i.cod_intern,
            i.nume, coalesce(i.cod_articol, v_art_cod), coalesce(i.art_den, v_art_den),
            coalesce(i.art_um, v_art_um), i.cantitate,
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
  'Emite factura unei comenzi: număr din seria activă (fără goluri), copia clientului, furnizorului și liniilor, TVA cu calculeaza_linie_tva, articolul SAGA din saga_articole (subcategorie → categorie → implicit). Refuză comenzile dinaintea data_start_facturare și pe cele marcate deja ca facturate. Doar admin/contabil.';
