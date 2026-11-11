-- ============================================================
-- AUTOPAS — SAGA, PASUL 10b: REFACTURAREA DUPĂ STORNO
-- Migrarea 54 (12 noiembrie 2026). Planul: docs/saga-plan.md, pasul 10b.
--
-- CE ATINGE DIN CE EXISTĂ (doar obiecte SAGA):
--   · RESCRIE `emite_factura` (din 51): o comandă „stornata” poate primi o factură
--     NOUĂ dacă stornarea vine din aplicație (toate facturile ei din aplicație au
--     storno) și FIECARE storno e deja trimis / confirmat în SAGA. Restul funcției e
--     IDENTIC cu 51 (o comandă marcată „stornata” de mână rămâne refuzată).
--     GARDĂ: amprenta fără „\r” = 51 (a1a45bbd8ce6ad03eae408ee9d2f113e) sau 54 (05f9fdfb49e73145c8004f290ed6ec42, re-rulare).
--   · RESCRIE `retrage_factura` (din 49): retragerea facturii NOI readuce comanda la
--     „stornata” + seria ultimei facturi stornate, nu la „de_emis”. Pentru o comandă
--     fără stornări — IDENTIC cu 49.
--     GARDĂ: amprenta fără „\r” = 49 (f9f982f093a2a5fb92cbc3b34ec49ccd) sau 54 (8ea9759db0a900c3043eff58663ea1fb, re-rulare).
--   · Nicio tabelă, nicio politică, niciun rând. `retrage_storno` (53) — neatinsă.
--
-- Depinde de 51 și 53 (rulate). Idempotentă.
-- Testele: scripts/verifica-saga-refacturare.sql. Anularea: scripts/anuleaza-saga-refacturare.sql.
-- ============================================================


-- ------------------------------------------------------------
-- 1. GĂRZILE: funcțiile din bază = versiunile din git (fără „\r”)
-- ------------------------------------------------------------
do $$
declare v text; w text;
begin
  -- Fără „\r”: SQL Editor-ul folosit de pe Windows salvează funcțiile cu CRLF.
  select md5(replace(prosrc, E'\r', '')) into v from pg_proc where oid = to_regprocedure('public.emite_factura(bigint)');
  select md5(replace(prosrc, E'\r', '')) into w from pg_proc where oid = to_regprocedure('public.retrage_factura(bigint)');
  if v is null or w is null then
    raise exception 'OPRIT: emite_factura sau retrage_factura nu există — migrările 49–51 nu sunt rulate.';
  end if;
  if to_regprocedure('public.storneaza_factura(bigint,text)') is null then
    raise exception 'OPRIT: storneaza_factura nu există — migrarea 53 nu e rulată.';
  end if;
  if v not in ('a1a45bbd8ce6ad03eae408ee9d2f113e', '05f9fdfb49e73145c8004f290ed6ec42') then
    raise exception 'OPRIT: emite_factura din bază diferă de versiunea din git (amprenta fără CR: %). Nu se rescrie nimic. Trimite textul funcției (select pg_get_functiondef(''public.emite_factura(bigint)''::regprocedure)) pentru comparare.', v;
  end if;
  if w not in ('f9f982f093a2a5fb92cbc3b34ec49ccd', '8ea9759db0a900c3043eff58663ea1fb') then
    raise exception 'OPRIT: retrage_factura din bază diferă de versiunea din git (amprenta fără CR: %). Nu se rescrie nimic. Trimite textul funcției (select pg_get_functiondef(''public.retrage_factura(bigint)''::regprocedure)) pentru comparare.', w;
  end if;
end $$;


-- ------------------------------------------------------------
-- 2. EMITEREA: și refacturarea după storno
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
  v_refact   boolean := false;
  v_storno   record;
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
  -- REFACTURAREA DUPĂ STORNO (pasul 10b, migrarea 54): o comandă „stornata” primește o
  -- factură nouă DOAR dacă stornarea vine din APLICAȚIE (are facturi de-ale noastre — toate
  -- stornate, garantat de verificarea de mai sus) și FIECARE storno e deja trimis în SAGA:
  -- un storno netrimis se mai poate retrage, iar factura veche ar redeveni valabilă lângă
  -- cea nouă. O comandă marcată „stornata” de mână, fără facturi din aplicație, rămâne refuzată.
  if coalesce(o.factura_status, 'de_emis') = 'stornata'
     and exists (select 1 from public.facturi f where f.order_id = o.id and f.tip = 'factura') then
    select s.serie, s.numar, s.saga_status into v_storno
      from public.facturi s
     where s.order_id = o.id and s.tip = 'storno' and s.saga_status not in ('trimisa', 'confirmata')
     order by s.id limit 1;
    if found then
      raise exception 'Stornoul % % al comenzii % nu e încă trimis în SAGA (stare: %). Factura nouă se emite abia după ce stornoul a plecat: un storno netrimis se mai poate retrage, iar factura veche ar redeveni valabilă.',
        v_storno.serie, v_storno.numar, o.numar, v_storno.saga_status;
    end if;
    v_refact := true;
  elsif o.factura_serie is not null or coalesce(o.factura_status, 'de_emis') <> 'de_emis' then
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
  values (o.id, 'factura', case when v_refact then 'Factură NOUĂ după stornare, emisă din aplicație: ' else 'Factură emisă din aplicație: ' end
          || v_serie || ' ' || v_numar || ' (de trimis în SAGA)',
          coalesce(auth.jwt() ->> 'email', 'sistem'));

  return json_build_object('ok', true, 'id', v_id, 'serie', v_serie, 'numar', v_numar,
                           'total', (select total from public.facturi where id = v_id));
end;
$$;

comment on function public.emite_factura(bigint) is
  'Emite factura unei comenzi: număr din seria activă (fără goluri), copia clientului, furnizorului și liniilor, TVA cu calculeaza_linie_tva, articolul SAGA din saga_articole. Refuză comenzile dinaintea data_start_facturare și pe cele marcate deja ca facturate — în afară de refacturarea după un storno din aplicație, deja trimis în SAGA (54). Doar admin/contabil.';


-- ------------------------------------------------------------
-- 3. RETRAGEREA: după o refacturare, comanda revine la „stornata”
-- ------------------------------------------------------------
create or replace function public.retrage_factura(p_id bigint)
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
  if not public.is_facturare() then
    raise exception 'Doar administratorul sau contabilul pot retrage facturi.';
  end if;
  select * into f from public.facturi where id = p_id for update;
  if not found then
    raise exception 'Factura % nu există.', p_id;
  end if;
  if f.saga_status <> 'de_trimis' then
    raise exception 'Factura % % a plecat spre SAGA (stare: %) — nu se mai retrage; se stornează.', f.serie, f.numar, f.saga_status;
  end if;
  if f.tip <> 'factura' then
    raise exception 'Doar facturile se retrag, nu stornările.';
  end if;
  select urmator into v_urm from public.facturi_serii where serie = f.serie for update;
  if v_urm is null or f.numar <> v_urm - 1 then
    raise exception 'Doar ultima factură din seria „%” se poate retrage (ultima are numărul %). Factura % se corectează înainte de trimitere sau se stornează după.',
      f.serie, coalesce(v_urm - 1, 0), f.numar;
  end if;

  delete from public.facturi where id = f.id;                              -- liniile, în cascadă
  update public.facturi_serii set urmator = f.numar, actualizat_la = now() where serie = f.serie;
  insert into public.facturi_serii_istoric (serie, urmator, actiune, detalii, facut_de, facut_de_email)
  values (f.serie, f.numar, 'retragere', 'Factura ' || f.serie || ' ' || f.numar || ' retrasă înainte de trimitere',
          auth.uid(), auth.jwt() ->> 'email');
  -- Pasul 10b (migrarea 54): dacă factura retrasă era una NOUĂ, după stornare, comanda
  -- revine la „stornata” cu seria ultimei facturi stornate — nu la „de emis”.
  select x.serie, x.numar into v_vechi
    from public.facturi x
   where x.order_id = f.order_id and x.tip = 'factura'
     and exists (select 1 from public.facturi s where s.storno_pentru = x.id)
   order by x.id desc limit 1;
  if found then
    update public.orders set factura_serie = v_vechi.serie || ' ' || v_vechi.numar, factura_status = 'stornata' where id = f.order_id;
  else
    update public.orders set factura_serie = null, factura_status = 'de_emis' where id = f.order_id;
  end if;
  insert into public.order_events (order_id, tip, mesaj, autor)
  values (f.order_id, 'factura', 'Factura ' || f.serie || ' ' || f.numar || ' retrasă înainte de trimiterea în SAGA (numărul se refolosește)',
          coalesce(auth.jwt() ->> 'email', 'sistem'));

  return json_build_object('ok', true, 'serie', f.serie, 'numar', f.numar);
end;
$$;

comment on function public.retrage_factura(bigint) is
  'Șterge ULTIMA factură din serie, doar dacă e netrimisă, și dă contorul înapoi (fără gol); comanda revine la „de_emis”, sau la „stornata” dacă mai are facturi stornate (54). Doar admin/contabil.';

revoke execute on function public.emite_factura(bigint)   from public;
revoke execute on function public.emite_factura(bigint)   from anon;
revoke execute on function public.retrage_factura(bigint) from public;
revoke execute on function public.retrage_factura(bigint) from anon;
grant  execute on function public.emite_factura(bigint)   to authenticated, service_role;
grant  execute on function public.retrage_factura(bigint) to authenticated, service_role;
