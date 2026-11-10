-- ============================================================
-- VERIFICĂRILE PASULUI 4 SAGA (migrarea 49, supabase/saga-facturi.sql)
--
-- Se rulează după migrarea 49, din Supabase → SQL Editor: lipești tot → Run.
-- Merge pe PRODUCȚIE.
--
-- NU LASĂ NIMIC ÎN BAZĂ:
--   · emite facturi de PROBĂ pe o serie „TEST …” cu nume unic, nouă la fiecare
--     rulare (niciodată pe seria reală),
--     pe două comenzi EXISTENTE, apoi le retrage, le „trimite”, încearcă să le
--     modifice — tot în aceeași tranzacție;
--   · schimbă TEMPORAR setările `integrari.saga` (data de start, articolul);
--   · totul stă între BEGIN și ROLLBACK, iar blocul se termină ÎNTOTDEAUNA cu o
--     eroare, care anulează tot: facturile de probă, contorul, oglinda de pe
--     comenzi, jurnalul comenzilor, setările.
--   · Singura urmă: id-urile din `facturi` / `facturi_serii_istoric` consumate de
--     probă (secvențele nu se anulează) — numere INTERNE, fără legătură cu
--     numărul facturii. Seria și numerele facturilor nu sunt atinse.
--
-- Rulează „ca” un utilizator din echipă: își alege singur un profil admin (sau
-- contabil) și îl pune în contextul tranzacției, cum face Supabase pentru un
-- utilizator logat.
--
-- REZULTATUL apare ÎNTOTDEAUNA în căsuța roșie de eroare:
--   · reușită: „REZULTAT OK: toate cele N verificări au trecut …”
--   · eșec:    „VERIFICARE PICATĂ: …”
-- ============================================================

begin;

do $$
declare
  n          int := 0;
  v_user     uuid;
  v_email    text;
  v_orig     jsonb;
  v_saga     jsonb;
  o1         public.orders%rowtype;
  o2         public.orders%rowtype;
  v_d1       date;
  v_d0       date;
  -- Serie de probă cu nume UNIC la fiecare rulare: proba nu depinde de ce ar
  -- exista deja în `facturi_serii` (și nu poate atinge seria reală).
  v_serie    text := 'TEST ' || upper(substr(md5(clock_timestamp()::text || random()::text), 1, 8));
  r          json;
  f1         bigint;
  f2         bigint;
  v_err      boolean;
  v_msg      text;
  v_cnt      int;
  v_asteptat int;
  fx         public.facturi%rowtype;
  l          record;
  t          record;
begin
  -- ----------------------------------------------------------
  -- PREGĂTIRE
  -- ----------------------------------------------------------
  select id, email into v_user, v_email from public.profiles
   where role in ('admin', 'contabil') order by (role = 'admin') desc, created_at limit 1;
  if v_user is null then
    raise exception 'VERIFICARE PICATĂ: nu există niciun profil admin sau contabil pentru probă.';
  end if;

  -- Două comenzi existente, neanulate, cu piese, fără factură, cu județ recunoscut.
  select * into o2 from public.orders o
   where o.status <> 'anulata'
     and exists (select 1 from public.order_items i where i.order_id = o.id)
     and not exists (select 1 from public.facturi f where f.order_id = o.id)
     and o.factura_serie is null and coalesce(o.factura_status, 'de_emis') = 'de_emis'
     and public.cod_judet(o.judet) is not null
   order by o.id desc limit 1;
  select * into o1 from public.orders o
   where o.status <> 'anulata' and o.id < coalesce(o2.id, 0)
     and exists (select 1 from public.order_items i where i.order_id = o.id)
     and not exists (select 1 from public.facturi f where f.order_id = o.id)
     and o.factura_serie is null and coalesce(o.factura_status, 'de_emis') = 'de_emis'
     and public.cod_judet(o.judet) is not null
   order by o.id desc limit 1;
  if o1.id is null or o2.id is null then
    raise exception 'VERIFICARE PICATĂ: nu găsesc două comenzi potrivite pentru probă.';
  end if;
  -- Ziua (ora României) a primei comenzi; comenzile importate nu au neapărat
  -- datele în ordinea id-urilor, deci data de start se ia la cea mai veche dintre ele.
  v_d1 := (o1.created_at at time zone 'Europe/Bucharest')::date;
  v_d0 := least(v_d1, (o2.created_at at time zone 'Europe/Bucharest')::date);

  select valoare into v_orig from public.settings where cheie = 'integrari';
  v_orig := coalesce(v_orig, '{}'::jsonb);
  v_saga := coalesce(v_orig -> 'saga', '{}'::jsonb) - 'data_start_facturare' - 'articol_implicit'
            - 'articol_implicit_denumire' - 'articol_reducere' - 'articol_transport';
  insert into public.settings (cheie, valoare) values ('integrari', '{}'::jsonb) on conflict (cheie) do nothing;
  update public.settings set valoare = v_orig || jsonb_build_object('saga',
    v_saga || '{"cota_tva": "21", "regim_tva": "normal", "mentiune_plata": "ramburs in cont"}') where cheie = 'integrari';

  -- Nicio serie activă la început (proba nu se bazează pe ce e în producție).
  update public.facturi_serii set activa = false where activa;
  -- Fără potriviri pe categorii (pasul 5, migrarea 50): proba verifică articolul
  -- IMPLICIT pe toate liniile. Golirea se anulează odată cu restul testului.
  if to_regclass('public.saga_articole') is not null then
    execute 'delete from public.saga_articole';
  end if;

  -- ----------------------------------------------------------
  -- A. FĂRĂ UTILIZATOR DIN ECHIPĂ → refuz
  -- ----------------------------------------------------------
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  begin perform public.emite_factura(o1.id); v_err := false; exception when others then v_err := true; end;
  if not v_err then raise exception 'VERIFICARE PICATĂ: emite_factura a mers fără utilizator din echipă'; end if;
  begin perform public.seteaza_serie_factura(v_serie, 1); v_err := false; exception when others then v_err := true; end;
  if not v_err then raise exception 'VERIFICARE PICATĂ: seteaza_serie_factura a mers fără utilizator din echipă'; end if;
  n := n + 2;

  -- De aici încolo, „logat” ca admin/contabil.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user, 'role', 'authenticated', 'email', v_email)::text, true);
  perform set_config('request.jwt.claim.sub', v_user::text, true);
  if not public.is_facturare() then
    raise exception 'VERIFICARE PICATĂ: is_facturare() e fals pentru profilul de probă %', v_user;
  end if;
  n := n + 1;

  -- ----------------------------------------------------------
  -- B. DATA DE START A FACTURĂRII
  -- ----------------------------------------------------------
  begin perform public.emite_factura(o1.id); v_err := false;
  exception when others then v_err := true; v_msg := sqlerrm; end;
  if not v_err or v_msg not like '%Data de start%' then
    raise exception 'VERIFICARE PICATĂ: fără data de start trebuia refuz cu mesaj despre ea; am primit: %', coalesce(v_msg, 'nicio eroare');
  end if;
  update public.settings set valoare = jsonb_set(valoare, '{saga,data_start_facturare}', '"azi"') where cheie = 'integrari';
  begin perform public.emite_factura(o1.id); v_err := false;
  exception when others then v_err := true; v_msg := sqlerrm; end;
  if not v_err or v_msg not like '%nu e o dată validă%' then
    raise exception 'VERIFICARE PICATĂ: data „azi” trebuia refuzată; am primit: %', coalesce(v_msg, 'nicio eroare');
  end if;
  update public.settings set valoare = jsonb_set(valoare, '{saga,data_start_facturare}', to_jsonb(to_char(v_d1 + 1, 'YYYY-MM-DD')))
   where cheie = 'integrari';
  begin perform public.emite_factura(o1.id); v_err := false;
  exception when others then v_err := true; v_msg := sqlerrm; end;
  if not v_err or v_msg not like '%înainte de data de start%' then
    raise exception 'VERIFICARE PICATĂ: comanda dinaintea datei de start trebuia refuzată; am primit: %', coalesce(v_msg, 'nicio eroare');
  end if;
  n := n + 3;

  -- Data de start = ziua celei mai vechi dintre cele două comenzi: ambele devin facturabile.
  update public.settings set valoare = jsonb_set(valoare, '{saga,data_start_facturare}', to_jsonb(to_char(v_d0, 'YYYY-MM-DD')))
   where cheie = 'integrari';

  -- ----------------------------------------------------------
  -- C. SERIA
  -- ----------------------------------------------------------
  begin perform public.emite_factura(o1.id); v_err := false;
  exception when others then v_err := true; v_msg := sqlerrm; end;
  if not v_err or v_msg not like '%Seria facturilor nu e configurată%' then
    raise exception 'VERIFICARE PICATĂ: fără serie activă trebuia refuz; am primit: %', coalesce(v_msg, 'nicio eroare');
  end if;
  begin perform public.seteaza_serie_factura(v_serie, 0); v_err := false; exception when others then v_err := true; end;
  if not v_err then raise exception 'VERIFICARE PICATĂ: numărul 0 trebuia refuzat'; end if;
  begin perform public.seteaza_serie_factura('   ', 5); v_err := false; exception when others then v_err := true; end;
  if not v_err then raise exception 'VERIFICARE PICATĂ: seria goală trebuia refuzată'; end if;
  r := public.seteaza_serie_factura('  ' || v_serie || '  ', 1);
  if not exists (select 1 from public.facturi_serii where serie = v_serie and urmator = 1 and activa)
     or (select count(*) from public.facturi_serii where activa) <> 1 then
    raise exception 'VERIFICARE PICATĂ: seria „%” (cu spațiu, tăiată la capete) nu e singura activă, cu numărul 1', v_serie;
  end if;
  if not exists (select 1 from public.facturi_serii_istoric where serie = v_serie and actiune = 'setare' and facut_de = v_user) then
    raise exception 'VERIFICARE PICATĂ: setarea seriei nu a intrat în istoric cu utilizatorul';
  end if;
  n := n + 5;

  -- Fără articolul din gestiune → refuz.
  begin perform public.emite_factura(o1.id); v_err := false;
  exception when others then v_err := true; v_msg := sqlerrm; end;
  if not v_err or v_msg not like '%Articolul implicit%' then
    raise exception 'VERIFICARE PICATĂ: fără articol implicit trebuia refuz; am primit: %', coalesce(v_msg, 'nicio eroare');
  end if;
  update public.settings set valoare = jsonb_set(jsonb_set(valoare, '{saga,articol_implicit}', '"TEST-ART"'),
                                                 '{saga,articol_implicit_denumire}', '"ACCESORII AUTO"')
   where cheie = 'integrari';
  n := n + 1;

  -- ----------------------------------------------------------
  -- D. EMITEREA
  -- ----------------------------------------------------------
  r := public.emite_factura(o1.id);
  f1 := (r ->> 'id')::bigint;
  select * into fx from public.facturi where id = f1;
  if fx.serie <> v_serie or fx.numar <> 1 or fx.saga_status <> 'de_trimis' or fx.tip <> 'factura' then
    raise exception 'VERIFICARE PICATĂ: prima factură: % % %, aștept % 1 de_trimis', fx.serie, fx.numar, fx.saga_status, v_serie;
  end if;
  if (select urmator from public.facturi_serii where serie = v_serie) <> 2 then
    raise exception 'VERIFICARE PICATĂ: contorul nu a trecut la 2';
  end if;
  n := n + 2;

  -- Liniile: o linie pe piesă (+ reducere, + transport facturabil), calculul din migrarea 47.
  v_asteptat := (select count(*) from public.order_items where order_id = o1.id)
              + case when coalesce(o1.discount_valoare, 0) > 0 then 1 else 0 end
              + case when public.transport_facturabil(o1.subtotal, o1.discount_valoare, o1.livrare, o1.total) > 0 then 1 else 0 end;
  select count(*) into v_cnt from public.facturi_linii where factura_id = f1;
  if v_cnt <> v_asteptat then
    raise exception 'VERIFICARE PICATĂ: factura are % linii, aștept %', v_cnt, v_asteptat;
  end if;
  for l in select * from public.facturi_linii where factura_id = f1 loop
    select * into t from public.calculeaza_linie_tva(l.pret_cu_tva, l.cantitate, 21);
    if (l.pret_fara_tva, l.valoare, l.tva, l.total) is distinct from (t.pret_fara_tva, t.valoare, t.tva, t.total)
       or l.cota_tva <> 21 or l.cod_articol_saga <> 'TEST-ART' or l.descriere <> 'ACCESORII AUTO' or l.um <> 'BUC' then
      raise exception 'VERIFICARE PICATĂ: linia % a facturii nu corespunde calculului sau articolului', l.nr_crt;
    end if;
  end loop;
  if (select string_agg(nr_crt::text, ',' order by nr_crt) from public.facturi_linii where factura_id = f1)
     <> (select string_agg(g::text, ',' order by g) from generate_series(1, v_cnt) g) then
    raise exception 'VERIFICARE PICATĂ: numerele de rând ale liniilor nu sunt 1..%', v_cnt;
  end if;
  -- Totalul facturii = ce a plătit clientul pentru piese, minus reducerea, plus transportul facturabil.
  if fx.total is distinct from (select sum(total) from public.facturi_linii where factura_id = f1)
     or (select total from public.facturi where id = f1)
        <> o1.subtotal - coalesce(o1.discount_valoare, 0) + public.transport_facturabil(o1.subtotal, o1.discount_valoare, o1.livrare, o1.total) then
    raise exception 'VERIFICARE PICATĂ: totalul facturii (%) nu e subtotal − reducere + transport', (select total from public.facturi where id = f1);
  end if;
  select * into fx from public.facturi where id = f1;
  if fx.total_fara_tva + fx.total_tva <> fx.total then
    raise exception 'VERIFICARE PICATĂ: total fără TVA + TVA ≠ total';
  end if;
  n := n + 4;

  -- Copiile: clientul cu codul județului, furnizorul din Setări, mențiunea, data în ora României.
  if fx.client ->> 'cod_judet' is distinct from public.cod_judet(o1.judet)
     or fx.client ->> 'nume' is distinct from o1.nume
     or fx.furnizor ->> 'denumire' is distinct from (select valoare ->> 'denumire' from public.settings where cheie = 'firma')
     or fx.mentiune_plata is distinct from 'ramburs in cont'
     or fx.data <> (now() at time zone 'Europe/Bucharest')::date
     or fx.observatii is distinct from 'Comanda ' || o1.numar
     or fx.emisa_de is distinct from v_user then
    raise exception 'VERIFICARE PICATĂ: copia clientului / furnizorului / mențiunii / datei nu e cea așteptată';
  end if;
  n := n + 1;

  -- Oglinda pe comandă + jurnalul comenzii.
  if (select factura_serie from public.orders where id = o1.id) is distinct from v_serie || ' 1'
     or (select factura_status from public.orders where id = o1.id) is distinct from 'emisa' then
    raise exception 'VERIFICARE PICATĂ: oglinda pe comandă nu e „% 1” / „emisa”', v_serie;
  end if;
  if not exists (select 1 from public.order_events where order_id = o1.id and tip = 'factura' and mesaj like '%' || v_serie || ' 1%') then
    raise exception 'VERIFICARE PICATĂ: emiterea nu a intrat în jurnalul comenzii';
  end if;
  n := n + 2;

  -- A doua factură pe aceeași comandă → refuz; contorul neatins.
  begin perform public.emite_factura(o1.id); v_err := false;
  exception when others then v_err := true; v_msg := sqlerrm; end;
  if not v_err or v_msg not like '%are deja o factură%' then
    raise exception 'VERIFICARE PICATĂ: a doua factură pe aceeași comandă trebuia refuzată; am primit: %', coalesce(v_msg, 'nicio eroare');
  end if;
  if (select urmator from public.facturi_serii where serie = v_serie) <> 2 then
    raise exception 'VERIFICARE PICATĂ: un refuz a mișcat contorul';
  end if;
  n := n + 2;

  -- A doua comandă → numărul 2.
  r := public.emite_factura(o2.id);
  f2 := (r ->> 'id')::bigint;
  if (select numar from public.facturi where id = f2) <> 2 then
    raise exception 'VERIFICARE PICATĂ: a doua factură nu are numărul 2';
  end if;
  n := n + 1;

  -- ----------------------------------------------------------
  -- E. NUMĂRUL DE START NU POATE COBORÎ SUB CE S-A EMIS
  -- ----------------------------------------------------------
  begin perform public.seteaza_serie_factura(v_serie, 2); v_err := false;
  exception when others then v_err := true; v_msg := sqlerrm; end;
  if not v_err or v_msg not like '%deja folosit%' then
    raise exception 'VERIFICARE PICATĂ: numărul 2, deja emis, trebuia refuzat; am primit: %', coalesce(v_msg, 'nicio eroare');
  end if;
  n := n + 1;

  -- ----------------------------------------------------------
  -- F. RETRAGEREA: doar ultima, iar numărul se refolosește
  -- ----------------------------------------------------------
  begin perform public.retrage_factura(f1); v_err := false;
  exception when others then v_err := true; v_msg := sqlerrm; end;
  if not v_err or v_msg not like '%Doar ultima factură%' then
    raise exception 'VERIFICARE PICATĂ: retragerea facturii 1 (nu e ultima) trebuia refuzată; am primit: %', coalesce(v_msg, 'nicio eroare');
  end if;
  perform public.retrage_factura(f2);
  if exists (select 1 from public.facturi where id = f2) or exists (select 1 from public.facturi_linii where factura_id = f2)
     or (select urmator from public.facturi_serii where serie = v_serie) <> 2
     or (select factura_serie from public.orders where id = o2.id) is not null
     or (select factura_status from public.orders where id = o2.id) <> 'de_emis' then
    raise exception 'VERIFICARE PICATĂ: retragerea nu a șters factura, nu a dat contorul înapoi sau nu a curățat comanda';
  end if;
  r := public.emite_factura(o2.id);
  f2 := (r ->> 'id')::bigint;
  if (select numar from public.facturi where id = f2) <> 2 then
    raise exception 'VERIFICARE PICATĂ: după retragere, numărul 2 nu s-a refolosit (gol în numerotare)';
  end if;
  n := n + 3;

  -- ----------------------------------------------------------
  -- G. NEMODIFICABIL DUPĂ TRIMITERE
  -- ----------------------------------------------------------
  update public.facturi set saga_status = 'trimisa', saga_trimisa_la = now() where id = f2;   -- permis
  begin update public.facturi set total = 0 where id = f2; v_err := false; exception when others then v_err := true; end;
  if not v_err then raise exception 'VERIFICARE PICATĂ: totalul unei facturi trimise s-a putut modifica'; end if;
  begin update public.facturi set client = '{}' where id = f2; v_err := false; exception when others then v_err := true; end;
  if not v_err then raise exception 'VERIFICARE PICATĂ: clientul unei facturi trimise s-a putut modifica'; end if;
  begin update public.facturi_linii set valoare = 0 where factura_id = f2; v_err := false; exception when others then v_err := true; end;
  if not v_err then raise exception 'VERIFICARE PICATĂ: o linie a unei facturi trimise s-a putut modifica'; end if;
  begin delete from public.facturi_linii where factura_id = f2; v_err := false; exception when others then v_err := true; end;
  if not v_err then raise exception 'VERIFICARE PICATĂ: o linie a unei facturi trimise s-a putut șterge'; end if;
  begin delete from public.facturi where id = f2; v_err := false; exception when others then v_err := true; end;
  if not v_err then raise exception 'VERIFICARE PICATĂ: o factură trimisă s-a putut șterge'; end if;
  begin perform public.retrage_factura(f2); v_err := false; exception when others then v_err := true; end;
  if not v_err then raise exception 'VERIFICARE PICATĂ: o factură trimisă s-a putut retrage'; end if;
  begin update public.facturi set saga_status = 'de_trimis' where id = f2; v_err := false; exception when others then v_err := true; end;
  if not v_err then raise exception 'VERIFICARE PICATĂ: o factură trimisă a putut da înapoi la „de_trimis”'; end if;
  update public.facturi set saga_status = 'confirmata', confirmata_la = now(), confirmata_de = v_user where id = f2;  -- permis
  begin update public.facturi set saga_status = 'trimisa' where id = f2; v_err := false; exception when others then v_err := true; end;
  if not v_err then raise exception 'VERIFICARE PICATĂ: o factură confirmată a putut da înapoi'; end if;
  -- Identitatea nu se schimbă nici înainte de trimitere.
  begin update public.facturi set numar = 99 where id = f1; v_err := false; exception when others then v_err := true; end;
  if not v_err then raise exception 'VERIFICARE PICATĂ: numărul unei facturi netrimise s-a putut schimba'; end if;
  n := n + 9;

  -- ----------------------------------------------------------
  -- H. O COMANDĂ FACTURATĂ NU SE MAI ȘTERGE (pe nicio cale)
  -- ----------------------------------------------------------
  begin delete from public.orders where id = o2.id; v_err := false;
  exception when others then v_err := true; v_msg := sqlerrm; end;
  if not v_err or v_msg not like '%comanda_facturata_nu_se_poate_sterge%' then
    raise exception 'VERIFICARE PICATĂ: o comandă facturată trebuia să nu se poată șterge; am primit: %', coalesce(v_msg, 'nicio eroare');
  end if;
  n := n + 1;

  -- ----------------------------------------------------------
  -- I. CINE VEDE FACTURILE
  -- ----------------------------------------------------------
  -- Un utilizator logat, dar fără rol de facturare: nu vede nimic și nu emite.
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', '', true);
  set local role authenticated;
  select count(*) into v_cnt from public.facturi;
  if v_cnt <> 0 then
    reset role;
    raise exception 'VERIFICARE PICATĂ: un utilizator fără rol de facturare vede % facturi', v_cnt;
  end if;
  begin perform public.emite_factura(o1.id); v_err := false; exception when others then v_err := true; end;
  reset role;
  if not v_err then raise exception 'VERIFICARE PICATĂ: un utilizator fără rol de facturare a emis o factură'; end if;
  n := n + 2;

  -- Vizitatorul anonim: nici măcar dreptul de a citi tabela sau de a chema funcțiile.
  if has_table_privilege('anon', 'public.facturi', 'select')
     or has_table_privilege('anon', 'public.facturi_serii', 'select')
     or has_function_privilege('anon', 'public.emite_factura(bigint)', 'execute')
     or has_function_privilege('anon', 'public.seteaza_serie_factura(text, integer)', 'execute')
     or has_function_privilege('anon', 'public.retrage_factura(bigint)', 'execute')
     or has_function_privilege('anon', 'public.is_facturare()', 'execute')
     or has_table_privilege('authenticated', 'public.facturi', 'insert')
     or has_table_privilege('authenticated', 'public.facturi_serii', 'update') then
    raise exception 'VERIFICARE PICATĂ: drepturi prea largi pe facturi pentru anon sau authenticated';
  end if;
  n := n + 1;

  raise exception 'REZULTAT OK: toate cele % verificări au trecut (probă pe comenzile % și %, seria de probă „%”). (Apare ca eroare intenționat: așa baza anulează tot — facturile de probă, contorul, oglinda de pe comenzi, setările.)',
    n, o1.numar, o2.numar, v_serie;
end $$;

rollback;
