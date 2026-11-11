-- ============================================================
-- VERIFICĂRILE PASULUI 10 SAGA (migrarea 53, supabase/saga-stornare.sql)
--
-- Se rulează după migrarea 53, din Supabase → SQL Editor: lipești tot → Run.
-- Merge pe PRODUCȚIE. NU LASĂ NIMIC ÎN BAZĂ: totul între BEGIN și ROLLBACK, iar
-- blocul se termină ÎNTOTDEAUNA cu o eroare, care anulează tot (facturile și stornările
-- de probă pe două serii cu nume unic, setările temporare, marcajele de ascundere).
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
  v_reala  text := 'Z' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  r        json;
  f1       bigint;
  f2       bigint;
  s1       bigint;
  v_err    boolean;
  v_msg    text;
  v_cnt    int;
  fa       public.facturi%rowtype;
  sa       public.facturi%rowtype;
begin
  select id into v_user from public.profiles
   where role in ('admin', 'contabil') order by (role = 'admin') desc, created_at limit 1;
  if v_user is null then raise exception 'VERIFICARE PICATĂ: nu există niciun profil admin sau contabil.'; end if;

  -- Două comenzi existente, facturabile, nemarcate ca facturate (ca în verifica-saga-emitere.sql).
  select * into o2 from public.orders o
   where o.status <> 'anulata' and o.factura_serie is null and coalesce(o.factura_status, 'de_emis') = 'de_emis'
     and exists (select 1 from public.order_items i where i.order_id = o.id)
     and not exists (select 1 from public.facturi fx where fx.order_id = o.id)
     and public.cod_judet(o.judet) is not null
   order by o.id desc limit 1;
  select * into o1 from public.orders o
   where o.id < coalesce(o2.id, 0) and o.status <> 'anulata' and o.factura_serie is null
     and coalesce(o.factura_status, 'de_emis') = 'de_emis'
     and exists (select 1 from public.order_items i where i.order_id = o.id)
     and not exists (select 1 from public.facturi fx where fx.order_id = o.id)
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

  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_user::text, true);
  perform public.seteaza_serie_factura(v_serie, 1);

  -- ----------------------------------------------------------
  -- 0. SERIILE DE PROBĂ
  -- ----------------------------------------------------------
  if not (public.serie_de_proba('PROBA') and public.serie_de_proba('proba 2') and public.serie_de_proba(' TEST X')
          and not public.serie_de_proba('PAP FE') and not public.serie_de_proba('XPROBA') and not public.serie_de_proba(null)) then
    raise exception 'VERIFICARE PICATĂ: serie_de_proba';
  end if;
  n := n + 1;

  -- ----------------------------------------------------------
  -- A. STORNAREA
  -- ----------------------------------------------------------
  r := public.emite_factura(o1.id);  f1 := (r ->> 'id')::bigint;

  -- Netrimisă → refuz (se corectează sau se retrage).
  begin perform public.storneaza_factura(f1, null); v_err := false; exception when others then v_err := true; v_msg := sqlerrm; end;
  if not v_err or v_msg not like '%se stornează doar o factură trimisă%' then
    raise exception 'VERIFICARE PICATĂ: stornarea unei facturi netrimise trebuia refuzată (%)', coalesce(v_msg, 'fără eroare');
  end if;
  n := n + 1;

  update public.facturi set saga_status = 'trimisa', saga_trimisa_la = now() where id = f1;   -- ca după pasul 8
  r := public.storneaza_factura(f1, 'proba verifica-saga-stornare');
  s1 := (r ->> 'id')::bigint;
  select * into fa from public.facturi where id = f1;
  select * into sa from public.facturi where id = s1;
  if sa.tip <> 'storno' or sa.storno_pentru <> f1 or sa.serie <> v_serie or sa.numar <> 2 or sa.saga_status <> 'de_trimis' then
    raise exception 'VERIFICARE PICATĂ: antetul stornoului (tip %, pentru %, % %, stare %)', sa.tip, sa.storno_pentru, sa.serie, sa.numar, sa.saga_status;
  end if;
  if (select urmator from public.facturi_serii where serie = v_serie) <> 3 then
    raise exception 'VERIFICARE PICATĂ: contorul seriei după stornare nu e 3';
  end if;
  if sa.total <> -fa.total or sa.total_tva <> -fa.total_tva or sa.total_fara_tva <> -fa.total_fara_tva then
    raise exception 'VERIFICARE PICATĂ: totalurile stornoului nu sunt opusul facturii (% vs %)', sa.total, fa.total;
  end if;
  if sa.client is distinct from fa.client or sa.furnizor is distinct from fa.furnizor or sa.mentiune_plata is distinct from fa.mentiune_plata then
    raise exception 'VERIFICARE PICATĂ: stornoul nu poartă clientul / furnizorul / mențiunea facturii';
  end if;
  if sa.observatii not like 'Stornare factura ' || v_serie || ' 1 din %Motiv: proba verifica-saga-stornare' then
    raise exception 'VERIFICARE PICATĂ: observațiile stornoului: „%”', sa.observatii;
  end if;
  n := n + 5;

  select count(*) into v_cnt
    from public.facturi_linii a
    join public.facturi_linii b on b.factura_id = s1 and b.nr_crt = a.nr_crt
   where a.factura_id = f1
     and b.cantitate = -a.cantitate and b.valoare = -a.valoare and b.tva = -a.tva and b.total = -a.total
     and b.pret_fara_tva = a.pret_fara_tva and b.pret_cu_tva = a.pret_cu_tva and b.cota_tva = a.cota_tva
     and b.cod_articol_saga = a.cod_articol_saga and b.tip = a.tip;
  if v_cnt <> (select count(*) from public.facturi_linii where factura_id = f1)
     or v_cnt <> (select count(*) from public.facturi_linii where factura_id = s1) then
    raise exception 'VERIFICARE PICATĂ: liniile stornoului nu sunt copia cu semn schimbat (% potrivite)', v_cnt;
  end if;
  n := n + 1;

  if (select factura_status from public.orders where id = o1.id) <> 'stornata' then
    raise exception 'VERIFICARE PICATĂ: comanda nu e „stornata” după stornare';
  end if;
  if not exists (select 1 from public.order_events where order_id = o1.id and tip = 'factura' and mesaj like '%stornată: storno%') then
    raise exception 'VERIFICARE PICATĂ: lipsește rândul din jurnalul comenzii';
  end if;
  n := n + 2;

  -- Al doilea storno pe aceeași factură → refuz.
  begin perform public.storneaza_factura(f1, null); v_err := false; exception when others then v_err := true; v_msg := sqlerrm; end;
  if not v_err or v_msg not like '%are deja un storno%' then
    raise exception 'VERIFICARE PICATĂ: al doilea storno trebuia refuzat (%)', coalesce(v_msg, 'fără eroare');
  end if;
  -- `retrage_factura` (din 49) refuză un storno.
  begin perform public.retrage_factura(s1); v_err := false; exception when others then v_err := true; end;
  if not v_err then raise exception 'VERIFICARE PICATĂ: retrage_factura a retras un storno'; end if;
  -- `retrage_storno` refuză o factură care nu e storno.
  begin perform public.retrage_storno(f1); v_err := false; exception when others then v_err := true; end;
  if not v_err then raise exception 'VERIFICARE PICATĂ: retrage_storno a acceptat o factură'; end if;
  n := n + 3;

  -- B. RETRAGEREA UNUI STORNO NETRIMIS (ultimul din serie)
  perform public.retrage_storno(s1);
  if exists (select 1 from public.facturi where id = s1)
     or (select urmator from public.facturi_serii where serie = v_serie) <> 2
     or (select factura_status from public.orders where id = o1.id) <> 'emisa'
     or (select factura_serie from public.orders where id = o1.id) <> v_serie || ' 1' then
    raise exception 'VERIFICARE PICATĂ: după retrage_storno (document șters, contor 2, comanda „emisă” cu % 1)', v_serie;
  end if;
  n := n + 1;

  -- Din nou: numărul 2 se refolosește; stornoul trimis nu se mai retrage și nu se stornează.
  r := public.storneaza_factura(f1, null);  s1 := (r ->> 'id')::bigint;
  if (r ->> 'numar')::int <> 2 then raise exception 'VERIFICARE PICATĂ: numărul stornoului după retragere nu e 2'; end if;
  update public.facturi set saga_status = 'trimisa' where id = s1;
  begin perform public.retrage_storno(s1); v_err := false; exception when others then v_err := true; end;
  if not v_err then raise exception 'VERIFICARE PICATĂ: un storno trimis a fost retras'; end if;
  begin perform public.storneaza_factura(s1, null); v_err := false; exception when others then v_err := true; v_msg := sqlerrm; end;
  if not v_err or v_msg not like '%e deja un storno%' then raise exception 'VERIFICARE PICATĂ: un storno a fost stornat (%)', coalesce(v_msg, '—'); end if;
  begin update public.facturi_linii set valoare = valoare + 1 where factura_id = s1; v_err := false; exception when others then v_err := true; end;
  if not v_err then raise exception 'VERIFICARE PICATĂ: liniile unui storno trimis s-au putut modifica'; end if;
  n := n + 4;

  -- ----------------------------------------------------------
  -- C. ASCUNDEREA — doar pe seriile de probă
  -- ----------------------------------------------------------
  perform public.ascunde_factura(f1, 'proba');
  perform public.ascunde_factura(f1, 'a doua oara');           -- idempotent
  if (select count(*) from public.facturi_ascunse where factura_id = f1) <> 1 then
    raise exception 'VERIFICARE PICATĂ: ascunderea facturii de probă';
  end if;
  perform public.reafiseaza_factura(f1);
  if exists (select 1 from public.facturi_ascunse where factura_id = f1) then
    raise exception 'VERIFICARE PICATĂ: reafișarea';
  end if;
  n := n + 2;

  -- Serie „reală” (nume care NU începe cu PROBA / TEST): ascunderea e refuzată;
  -- stornarea unei facturi CONFIRMATE merge.
  perform public.seteaza_serie_factura(v_reala, 1);
  r := public.emite_factura(o2.id);  f2 := (r ->> 'id')::bigint;
  begin perform public.ascunde_factura(f2, null); v_err := false; exception when others then v_err := true; v_msg := sqlerrm; end;
  if not v_err or v_msg not like '%Se ascund doar facturile de PROBĂ%' then
    raise exception 'VERIFICARE PICATĂ: o factură pe o serie reală s-a putut ascunde (%)', coalesce(v_msg, 'fără eroare');
  end if;
  update public.facturi set saga_status = 'trimisa' where id = f2;
  update public.facturi set saga_status = 'confirmata', confirmata_la = now() where id = f2;
  r := public.storneaza_factura(f2, null);
  if (r ->> 'serie') <> v_reala or (r ->> 'numar')::int <> 2 then
    raise exception 'VERIFICARE PICATĂ: stornarea unei facturi confirmate (% %)', r ->> 'serie', r ->> 'numar';
  end if;
  n := n + 2;

  -- ----------------------------------------------------------
  -- D. DREPTURILE
  -- ----------------------------------------------------------
  perform public.ascunde_factura(f1, 'pentru proba drepturilor');
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', '', true);
  begin perform public.storneaza_factura(f2, null); v_err := false; exception when others then v_err := true; end;
  if not v_err then raise exception 'VERIFICARE PICATĂ: un utilizator fără rol a stornat'; end if;
  begin perform public.ascunde_factura(f1, null); v_err := false; exception when others then v_err := true; end;
  if not v_err then raise exception 'VERIFICARE PICATĂ: un utilizator fără rol a ascuns o factură'; end if;
  begin perform public.retrage_storno(s1); v_err := false; exception when others then v_err := true; end;
  if not v_err then raise exception 'VERIFICARE PICATĂ: un utilizator fără rol a retras un storno'; end if;
  set local role authenticated;
  select count(*) into v_cnt from public.facturi_ascunse;
  reset role;
  if v_cnt <> 0 then raise exception 'VERIFICARE PICATĂ: un utilizator fără rol vede % facturi ascunse', v_cnt; end if;
  if has_function_privilege('anon', 'public.storneaza_factura(bigint, text)', 'execute')
     or has_function_privilege('anon', 'public.retrage_storno(bigint)', 'execute')
     or has_function_privilege('anon', 'public.ascunde_factura(bigint, text)', 'execute')
     or has_function_privilege('anon', 'public.reafiseaza_factura(bigint)', 'execute')
     or has_table_privilege('anon', 'public.facturi_ascunse', 'select')
     or has_table_privilege('authenticated', 'public.facturi_ascunse', 'insert') then
    raise exception 'VERIFICARE PICATĂ: drepturi prea largi pe funcțiile / tabela pasului 10';
  end if;
  n := n + 5;

  raise exception 'REZULTAT OK: toate cele % verificări au trecut (probă pe comenzile % și %, seriile de probă „%” și „%”). (Apare ca eroare intenționat: așa baza anulează tot.)',
    n, o1.numar, o2.numar, v_serie, v_reala;
end $$;

rollback;
