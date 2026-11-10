-- ============================================================
-- VERIFICĂRILE PASULUI 6 SAGA (migrarea 51, supabase/saga-emitere.sql)
--
-- Se rulează după migrarea 51, din Supabase → SQL Editor: lipești tot → Run.
-- Merge pe PRODUCȚIE. NU LASĂ NIMIC ÎN BAZĂ: totul între BEGIN și ROLLBACK, iar
-- blocul se termină ÎNTOTDEAUNA cu o eroare, care anulează tot (facturile de probă
-- pe o serie „TEST …” unică, setările temporare, marcajul manual de probă).
-- Singura urmă: id-uri interne consumate (secvențele nu se anulează).
--
-- REZULTATUL apare ÎNTOTDEAUNA în căsuța roșie de eroare:
--   · reușită: „REZULTAT OK: toate cele N verificări au trecut …”
--   · eșec:    „VERIFICARE PICATĂ: …”
-- ============================================================

begin;

do $$
declare
  n        int := 0;
  v_user   uuid;
  v_orig   jsonb;
  o1       public.orders%rowtype;
  o2       public.orders%rowtype;
  v_serie  text := 'TEST ' || upper(substr(md5(clock_timestamp()::text || random()::text), 1, 8));
  r        json;
  f        bigint;
  v_linie  bigint;
  v_alta   bigint;
  v_err    boolean;
  v_msg    text;
  fx       public.facturi%rowtype;
begin
  if (select md5(replace(prosrc, E'\r', '')) from pg_proc where oid = to_regprocedure('public.emite_factura(bigint)'))
     is distinct from 'a1a45bbd8ce6ad03eae408ee9d2f113e' then
    raise exception 'VERIFICARE PICATĂ: emite_factura din bază nu e versiunea din migrarea 51';
  end if;
  n := n + 1;

  select id into v_user from public.profiles
   where role in ('admin', 'contabil') order by (role = 'admin') desc, created_at limit 1;
  if v_user is null then raise exception 'VERIFICARE PICATĂ: nu există niciun profil admin sau contabil.'; end if;

  -- Două comenzi existente, facturabile, nemarcate ca facturate.
  select * into o2 from public.orders o
   where o.status <> 'anulata' and o.factura_serie is null and coalesce(o.factura_status, 'de_emis') = 'de_emis'
     and exists (select 1 from public.order_items i where i.order_id = o.id)
     and not exists (select 1 from public.facturi fx2 where fx2.order_id = o.id)
     and public.cod_judet(o.judet) is not null
   order by o.id desc limit 1;
  select * into o1 from public.orders o
   where o.id < coalesce(o2.id, 0) and o.status <> 'anulata' and o.factura_serie is null
     and coalesce(o.factura_status, 'de_emis') = 'de_emis'
     and exists (select 1 from public.order_items i where i.order_id = o.id)
     and not exists (select 1 from public.facturi fx2 where fx2.order_id = o.id)
     and public.cod_judet(o.judet) is not null
   order by o.id desc limit 1;
  if o1.id is null or o2.id is null then raise exception 'VERIFICARE PICATĂ: nu găsesc două comenzi potrivite.'; end if;

  select valoare into v_orig from public.settings where cheie = 'integrari';
  v_orig := coalesce(v_orig, '{}'::jsonb);
  insert into public.settings (cheie, valoare) values ('integrari', '{}'::jsonb) on conflict (cheie) do nothing;
  update public.settings set valoare = v_orig || jsonb_build_object('saga',
    coalesce(v_orig -> 'saga', '{}'::jsonb)
    || jsonb_build_object('cota_tva', '21', 'regim_tva', 'normal',
         'data_start_facturare', to_char(least((o1.created_at at time zone 'Europe/Bucharest')::date,
                                               (o2.created_at at time zone 'Europe/Bucharest')::date), 'YYYY-MM-DD'),
         'articol_implicit', 'IMPL', 'articol_implicit_denumire', 'ACCESORII AUTO'))
   where cheie = 'integrari';
  update public.facturi_serii set activa = false where activa;
  delete from public.saga_articole;

  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_user::text, true);
  perform public.seteaza_serie_factura(v_serie, 1);

  -- ----------------------------------------------------------
  -- A. COMANDA MARCATĂ DEJA CA FACTURATĂ (manual în SAGA) → refuz
  -- ----------------------------------------------------------
  update public.orders set factura_serie = 'PAP FE 99999', factura_status = 'emisa' where id = o1.id;
  begin perform public.emite_factura(o1.id); v_err := false;
  exception when others then v_err := true; v_msg := sqlerrm; end;
  if not v_err or v_msg not like '%deja marcată ca facturată%' then
    raise exception 'VERIFICARE PICATĂ: comanda facturată manual trebuia refuzată; am primit: %', coalesce(v_msg, 'nicio eroare');
  end if;
  if (select urmator from public.facturi_serii where serie = v_serie) <> 1
     or (select factura_serie from public.orders where id = o1.id) <> 'PAP FE 99999' then
    raise exception 'VERIFICARE PICATĂ: refuzul a mișcat contorul sau a atins nota manuală';
  end if;
  update public.orders set factura_status = 'nu_se_emite', factura_serie = null where id = o1.id;
  begin perform public.emite_factura(o1.id); v_err := false; exception when others then v_err := true; end;
  if not v_err then raise exception 'VERIFICARE PICATĂ: comanda „nu se emite” trebuia refuzată'; end if;
  update public.orders set factura_status = 'de_emis', factura_serie = null where id = o1.id;
  n := n + 3;

  -- ----------------------------------------------------------
  -- B. CORECTURI ÎNAINTE DE TRIMITERE
  -- ----------------------------------------------------------
  r := public.emite_factura(o1.id); f := (r ->> 'id')::bigint;
  select id into v_linie from public.facturi_linii where factura_id = f order by nr_crt limit 1;

  perform public.modifica_factura(f,
    '{"nume": "  Client Corectat  ", "judet": "Iasi", "cui": "RO123", "necunoscut": "x"}'::jsonb,
    jsonb_build_array(jsonb_build_object('id', v_linie, 'cod_articol_saga', ' ART2 ', 'descriere', 'ALT ARTICOL', 'um', 'SET')));
  select * into fx from public.facturi where id = f;
  if fx.client ->> 'nume' <> 'Client Corectat' or fx.client ->> 'judet' <> 'Iasi' or fx.client ->> 'cod_judet' <> 'IS'
     or fx.client ->> 'cui' <> 'RO123' or fx.client ? 'necunoscut' then
    raise exception 'VERIFICARE PICATĂ: corectura clientului nu e cea așteptată: %', fx.client;
  end if;
  if (select (cod_articol_saga, descriere, um) from public.facturi_linii where id = v_linie)
     is distinct from ('ART2'::text, 'ALT ARTICOL'::text, 'SET'::text) then
    raise exception 'VERIFICARE PICATĂ: corectura articolului de pe linie nu e cea așteptată';
  end if;
  if fx.total is distinct from (select sum(total) from public.facturi_linii where factura_id = f) or fx.numar <> 1 then
    raise exception 'VERIFICARE PICATĂ: corectura a atins totalurile sau numărul';
  end if;
  n := n + 3;

  -- Județ greșit, linie a altei facturi, cod gol → refuz.
  begin perform public.modifica_factura(f, '{"judet": "Atlantis"}'::jsonb, null); v_err := false;
  exception when others then v_err := true; end;
  if not v_err then raise exception 'VERIFICARE PICATĂ: județul „Atlantis” trebuia refuzat'; end if;
  r := public.emite_factura(o2.id);
  select id into v_alta from public.facturi_linii where factura_id = (r ->> 'id')::bigint limit 1;
  begin perform public.modifica_factura(f, null, jsonb_build_array(jsonb_build_object('id', v_alta, 'cod_articol_saga', 'X', 'descriere', 'X')));
    v_err := false; exception when others then v_err := true; end;
  if not v_err then raise exception 'VERIFICARE PICATĂ: o linie a altei facturi a putut fi corectată'; end if;
  begin perform public.modifica_factura(f, null, jsonb_build_array(jsonb_build_object('id', v_linie, 'cod_articol_saga', '  ', 'descriere', 'X')));
    v_err := false; exception when others then v_err := true; end;
  if not v_err then raise exception 'VERIFICARE PICATĂ: un cod de articol gol a fost acceptat'; end if;
  n := n + 3;

  -- După trimitere: nicio corectură.
  update public.facturi set saga_status = 'trimisa' where id = f;
  begin perform public.modifica_factura(f, '{"nume": "Alt nume"}'::jsonb, null); v_err := false;
  exception when others then v_err := true; v_msg := sqlerrm; end;
  if not v_err or v_msg not like '%nu se mai modifică%' then
    raise exception 'VERIFICARE PICATĂ: o factură trimisă a putut fi corectată; am primit: %', coalesce(v_msg, 'nicio eroare');
  end if;
  n := n + 1;

  -- ----------------------------------------------------------
  -- C. OPRIREA EMITERII
  -- ----------------------------------------------------------
  r := public.opreste_emiterea();
  if (r ->> 'oprite')::int <> 1 or exists (select 1 from public.facturi_serii where activa)
     or not exists (select 1 from public.facturi_serii_istoric where serie = v_serie and actiune = 'oprire') then
    raise exception 'VERIFICARE PICATĂ: oprirea emiterii nu a dezactivat seria sau nu a intrat în istoric';
  end if;
  -- A doua comandă își pierde factura (retragere: era ultima din serie, netrimisă),
  -- deci singurul motiv de refuz rămâne lipsa seriei active.
  perform public.retrage_factura((select id from public.facturi where order_id = o2.id));
  begin perform public.emite_factura(o2.id); v_err := false;
  exception when others then v_err := true; v_msg := sqlerrm; end;
  if not v_err or v_msg not like '%Seria facturilor nu e configurată%' then
    raise exception 'VERIFICARE PICATĂ: după oprire, emiterea trebuia refuzată; am primit: %', coalesce(v_msg, 'nicio eroare');
  end if;
  n := n + 2;

  -- ----------------------------------------------------------
  -- D. DREPTURILE
  -- ----------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', '', true);
  begin perform public.opreste_emiterea(); v_err := false; exception when others then v_err := true; end;
  if not v_err then raise exception 'VERIFICARE PICATĂ: un utilizator fără rol a oprit emiterea'; end if;
  begin perform public.modifica_factura(f, '{}'::jsonb, null); v_err := false; exception when others then v_err := true; end;
  if not v_err then raise exception 'VERIFICARE PICATĂ: un utilizator fără rol a modificat o factură'; end if;
  if has_function_privilege('anon', 'public.opreste_emiterea()', 'execute')
     or has_function_privilege('anon', 'public.modifica_factura(bigint, jsonb, jsonb)', 'execute') then
    raise exception 'VERIFICARE PICATĂ: anon poate chema funcțiile noi';
  end if;
  n := n + 3;

  raise exception 'REZULTAT OK: toate cele % verificări au trecut (probă pe comenzile % și %, seria de probă „%”). (Apare ca eroare intenționat: așa baza anulează tot.)',
    n, o1.numar, o2.numar, v_serie;
end $$;

rollback;
