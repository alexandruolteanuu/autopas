-- ============================================================
-- VERIFICĂRILE PASULUI 2 SAGA (migrarea 48, supabase/saga-export.sql)
--
-- Se rulează după migrarea 48, din Supabase → SQL Editor: lipești tot → Run.
-- Merge pe PRODUCȚIE.
--
-- NU LASĂ NIMIC ÎN BAZĂ:
--   · singura scriere e o schimbare TEMPORARĂ a setării `integrari.saga`, ca să
--     se verifice cotele (19, 21,5, gol, greșite); se anulează;
--   · totul stă între BEGIN și ROLLBACK;
--   · blocul se termină ÎNTOTDEAUNA cu o eroare, care anulează tranzacția.
--   · NU creează comenzi: o comandă de test ar consuma un număr real din
--     `nr_comanda_seq` (secvențele nu se anulează la rollback). Exportul se
--     verifică pe comenzile EXISTENTE, doar citite.
--
-- REZULTATUL apare ÎNTOTDEAUNA în căsuța roșie de eroare:
--   · reușită: „REZULTAT OK: toate cele N verificări au trecut …”
--   · eșec:    „VERIFICARE PICATĂ: …”
-- „function … does not exist” = migrarea 48 (sau 47) nu e rulată.
-- ============================================================

begin;

do $$
declare
  n        int := 0;
  v_orig   jsonb;
  v_cota   numeric;
  v_err    boolean;
  v_msg    text;
  v_ids    bigint[];
  v_linii  int;
  v_items  int;
  r        record;
  t        record;
begin
  -- Setarea `integrari.saga` se schimbă temporar mai jos, prin `update`-uri
  -- repetate (nu printr-o funcție ajutătoare: aceea ar fi o scriere în schemă).
  -- Totul se anulează la final.
  select valoare into v_orig from public.settings where cheie = 'integrari';
  if v_orig is null then
    insert into public.settings (cheie, valoare) values ('integrari', '{}'::jsonb);
    v_orig := '{}'::jsonb;
  end if;

  -- ----------------------------------------------------------
  -- A. COTA DIN SETĂRI
  -- ----------------------------------------------------------
  -- Gol / nesalvat → 21.
  update public.settings set valoare = v_orig || jsonb_build_object('saga',
    coalesce(v_orig->'saga', '{}'::jsonb) - 'cota_tva' - 'regim_tva') where cheie = 'integrari';
  if public.saga_cota_tva() <> 21 then
    raise exception 'VERIFICARE PICATĂ: fără cotă salvată aștept 21, am primit %', public.saga_cota_tva();
  end if;
  update public.settings set valoare = v_orig || jsonb_build_object('saga',
    coalesce(v_orig->'saga', '{}'::jsonb) || '{"cota_tva": "", "regim_tva": ""}') where cheie = 'integrari';
  if public.saga_cota_tva() <> 21 then
    raise exception 'VERIFICARE PICATĂ: cu cota goală aștept 21, am primit %', public.saga_cota_tva();
  end if;
  n := n + 2;

  -- Valori bune, scrise cum le-ar scrie un om.
  for r in select * from (values ('19', 19.0), ('21', 21.0), (' 21 ', 21.0), ('21,5', 21.5),
                                 ('21.5', 21.5), ('9%', 9.0), ('0', 0.0)) as x(scris, asteptat) loop
    update public.settings set valoare = v_orig || jsonb_build_object('saga',
      coalesce(v_orig->'saga', '{}'::jsonb) || jsonb_build_object('cota_tva', r.scris, 'regim_tva', 'normal'))
      where cheie = 'integrari';
    v_cota := public.saga_cota_tva();
    if v_cota <> r.asteptat then
      raise exception 'VERIFICARE PICATĂ: cota scrisă „%” → %, aștept %', r.scris, v_cota, r.asteptat;
    end if;
  end loop;
  n := n + 1;

  -- Valori greșite → refuz cu mesaj, NU 21 tăcut.
  for r in select * from (values ('abc'), ('2l'), ('100'), ('150'), ('-5'), ('21.5.1')) as x(scris) loop
    update public.settings set valoare = v_orig || jsonb_build_object('saga',
      coalesce(v_orig->'saga', '{}'::jsonb) || jsonb_build_object('cota_tva', r.scris, 'regim_tva', 'normal'))
      where cheie = 'integrari';
    begin
      perform public.saga_cota_tva(); v_err := false;
    exception when others then v_err := true; end;
    if not v_err then
      raise exception 'VERIFICARE PICATĂ: cota „%” trebuia refuzată', r.scris;
    end if;
  end loop;
  n := n + 1;

  -- Regimul marjă → refuz; necunoscut → refuz; „Normal” cu majusculă → merge.
  for r in select * from (values ('marja'), ('Marjă'), ('special')) as x(scris) loop
    update public.settings set valoare = v_orig || jsonb_build_object('saga',
      coalesce(v_orig->'saga', '{}'::jsonb) || jsonb_build_object('cota_tva', '21', 'regim_tva', r.scris))
      where cheie = 'integrari';
    begin
      perform public.saga_cota_tva(); v_err := false;
    exception when others then v_err := true; v_msg := sqlerrm; end;
    if not v_err then
      raise exception 'VERIFICARE PICATĂ: regimul „%” trebuia refuzat', r.scris;
    end if;
  end loop;
  update public.settings set valoare = v_orig || jsonb_build_object('saga',
    coalesce(v_orig->'saga', '{}'::jsonb) || '{"cota_tva": "21", "regim_tva": "Normal"}') where cheie = 'integrari';
  if public.saga_cota_tva() <> 21 then
    raise exception 'VERIFICARE PICATĂ: regimul „Normal” trebuia acceptat';
  end if;
  n := n + 2;

  -- ----------------------------------------------------------
  -- B. EXPORTUL, PE COMENZILE EXISTENTE (doar citite)
  -- ----------------------------------------------------------
  -- Cota 21 pentru restul verificărilor.
  update public.settings set valoare = v_orig || jsonb_build_object('saga',
    coalesce(v_orig->'saga', '{}'::jsonb) || '{"cota_tva": "21", "regim_tva": "normal"}') where cheie = 'integrari';

  select coalesce(array_agg(id order by id), '{}') into v_ids from public.orders;
  select count(*) into v_items from public.order_items where order_id = any(v_ids);
  select count(*) into v_linii from public.export_saga_linii(v_ids);

  -- O linie pe fiecare piesă din comenzi — nici în plus, nici lipsă.
  if v_linii <> v_items then
    raise exception 'VERIFICARE PICATĂ: exportul are % linii, comenzile au % piese', v_linii, v_items;
  end if;
  n := n + 1;

  -- Fiecare linie: exact calculul din migrarea 47, cota 21, transportul regulii.
  for r in
    select e.*, o.subtotal, o.discount_valoare, o.livrare, o.total as total_comanda
      from public.export_saga_linii(v_ids) e join public.orders o on o.id = e.order_id
  loop
    select * into t from public.calculeaza_linie_tva(r.pret_cu_tva, r.cantitate, 21);
    if (r.pret_fara_tva, r.valoare, r.tva, r.total) is distinct from (t.pret_fara_tva, t.valoare, t.tva, t.total) then
      raise exception 'VERIFICARE PICATĂ: comanda %, linia %: exportul dă %/%/%/%, calculul dă %/%/%/%',
        r.order_id, r.item_id, r.pret_fara_tva, r.valoare, r.tva, r.total, t.pret_fara_tva, t.valoare, t.tva, t.total;
    end if;
    if r.cota <> 21 then
      raise exception 'VERIFICARE PICATĂ: linia % are cota %, aștept 21', r.item_id, r.cota;
    end if;
    if r.valoare + r.tva <> r.total then
      raise exception 'VERIFICARE PICATĂ: linia %: valoare + TVA ≠ total', r.item_id;
    end if;
    if r.transport <> public.transport_facturabil(r.subtotal, r.discount_valoare, r.livrare, r.total_comanda) then
      raise exception 'VERIFICARE PICATĂ: comanda %: transportul din export diferă de regulă', r.order_id;
    end if;
  end loop;
  n := n + 4;

  -- Cota schimbată în setări se vede în export (aici 19, ca proba să fie clară).
  if v_linii > 0 then
    update public.settings set valoare = v_orig || jsonb_build_object('saga',
      coalesce(v_orig->'saga', '{}'::jsonb) || '{"cota_tva": "19"}') where cheie = 'integrari';
    if exists (select 1 from public.export_saga_linii(v_ids) where cota <> 19) then
      raise exception 'VERIFICARE PICATĂ: cota 19 din setări nu ajunge în export';
    end if;
  end if;
  n := n + 1;

  -- Listă goală sau NULL → zero linii, nu toate comenzile.
  if (select count(*) from public.export_saga_linii('{}')) <> 0
     or (select count(*) from public.export_saga_linii(null)) <> 0 then
    raise exception 'VERIFICARE PICATĂ: o listă goală de comenzi a întors linii';
  end if;
  n := n + 1;

  -- Cota greșită în setări → exportul se oprește, nu calculează cu 21.
  update public.settings set valoare = v_orig || jsonb_build_object('saga',
    coalesce(v_orig->'saga', '{}'::jsonb) || '{"cota_tva": "abc"}') where cheie = 'integrari';
  begin
    perform * from public.export_saga_linii(v_ids); v_err := false;
  exception when others then v_err := true; end;
  if not v_err then
    raise exception 'VERIFICARE PICATĂ: exportul a mers cu o cotă greșită în setări';
  end if;
  n := n + 1;

  -- ----------------------------------------------------------
  -- C. DREPTURILE
  -- ----------------------------------------------------------
  if has_function_privilege('anon', 'public.saga_cota_tva()', 'execute')
     or has_function_privilege('anon', 'public.export_saga_linii(bigint[])', 'execute') then
    raise exception 'VERIFICARE PICATĂ: rolul anon poate chema o funcție SAGA';
  end if;
  n := n + 1;

  raise exception 'REZULTAT OK: toate cele % verificări au trecut (% comenzi, % linii de export verificate). (Apare ca eroare intenționat: așa baza anulează tot ce a făcut testul, inclusiv setarea schimbată temporar.)',
    n, coalesce(array_length(v_ids, 1), 0), v_linii;
end $$;

rollback;
