-- ============================================================
-- VERIFICĂRILE PASULUI 5 SAGA (migrarea 50, supabase/saga-articole.sql)
--
-- Se rulează după migrarea 50, din Supabase → SQL Editor: lipești tot → Run.
-- Merge pe PRODUCȚIE.
--
-- NU LASĂ NIMIC ÎN BAZĂ: potriviri de probă, setări schimbate temporar și
-- facturi de probă pe o serie „TEST …” cu nume unic — toate între BEGIN și
-- ROLLBACK, iar blocul se termină ÎNTOTDEAUNA cu o eroare, care anulează tot.
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
  o        public.orders%rowtype;
  v_item   bigint;
  v_cat    bigint;
  v_sub    bigint;
  v_alta   bigint;
  v_serie  text := 'TEST ' || upper(substr(md5(clock_timestamp()::text || random()::text), 1, 8));
  r        json;
  f        bigint;
  v_err    boolean;
  v_cnt    int;
  l        record;

begin
  -- ----------------------------------------------------------
  -- PREGĂTIRE
  -- ----------------------------------------------------------
  -- Fără „\r”: SQL Editor-ul de pe Windows salvează funcțiile cu CRLF.
  if (select md5(replace(prosrc, E'\r', '')) from pg_proc where oid = to_regprocedure('public.emite_factura(bigint)'))
     not in ('8eefb50d4c81c4ea93701317e9ac67ed',    -- migrarea 50
             'a1a45bbd8ce6ad03eae408ee9d2f113e')    -- migrarea 51 (aceeași potrivire a articolelor)
     or (select md5(replace(prosrc, E'\r', '')) from pg_proc where oid = to_regprocedure('public.emite_factura(bigint)')) is null then
    raise exception 'VERIFICARE PICATĂ: emite_factura din bază nu e versiunea din migrarea 50 sau 51';
  end if;
  n := n + 1;

  select id into v_user from public.profiles
   where role in ('admin', 'contabil') order by (role = 'admin') desc, created_at limit 1;
  if v_user is null then
    raise exception 'VERIFICARE PICATĂ: nu există niciun profil admin sau contabil pentru probă.';
  end if;

  -- O comandă existentă, facturabilă, cu o piesă care are ȘI categorie, ȘI subcategorie.
  select o2.* into o from public.orders o2
   where o2.status <> 'anulata'
     and not exists (select 1 from public.facturi fx where fx.order_id = o2.id)
     and o2.factura_serie is null and coalesce(o2.factura_status, 'de_emis') = 'de_emis'
     and public.cod_judet(o2.judet) is not null
     and exists (select 1 from public.order_items i join public.products p on p.id = i.product_id
                  where i.order_id = o2.id and p.categorie_id is not null and p.subcategorie_id is not null
                    and p.categorie_id <> p.subcategorie_id)
   order by o2.id desc limit 1;
  if o.id is null then
    raise exception 'VERIFICARE PICATĂ: nu găsesc o comandă cu o piesă care are categorie și subcategorie.';
  end if;
  select i.id, p.categorie_id, p.subcategorie_id into v_item, v_cat, v_sub
    from public.order_items i join public.products p on p.id = i.product_id
   where i.order_id = o.id and p.categorie_id is not null and p.subcategorie_id is not null
     and p.categorie_id <> p.subcategorie_id
   order by i.id limit 1;
  -- O categorie fără legătură cu piesa (pentru proba „potrivirea altei categorii nu se aplică”).
  select id into v_alta from public.categories where id not in (v_cat, v_sub) order by id limit 1;

  -- Setările probei, temporare.
  select valoare into v_orig from public.settings where cheie = 'integrari';
  v_orig := coalesce(v_orig, '{}'::jsonb);
  insert into public.settings (cheie, valoare) values ('integrari', '{}'::jsonb) on conflict (cheie) do nothing;
  update public.settings set valoare = v_orig || jsonb_build_object('saga',
    coalesce(v_orig -> 'saga', '{}'::jsonb)
    || jsonb_build_object('cota_tva', '21', 'regim_tva', 'normal',
                          'data_start_facturare', to_char((o.created_at at time zone 'Europe/Bucharest')::date, 'YYYY-MM-DD'),
                          'articol_implicit', 'IMPL', 'articol_implicit_denumire', 'ACCESORII AUTO',
                          'articol_implicit_um', 'BUC'))
   where cheie = 'integrari';
  update public.facturi_serii set activa = false where activa;
  delete from public.saga_articole;

  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_user::text, true);
  perform public.seteaza_serie_factura(v_serie, 1);

  -- ----------------------------------------------------------
  -- A. CINE SCRIE POTRIVIRILE
  -- ----------------------------------------------------------
  -- Admin/contabil, prin rolul `authenticated` (ca din pagină): poate scrie.
  set local role authenticated;
  insert into public.saga_articole (categorie_id, cod_articol, denumire) values (v_alta, 'ALTA', 'ALTCEVA');
  update public.saga_articole set denumire = 'ALTCEVA 2' where categorie_id = v_alta;
  get diagnostics v_cnt = row_count;
  reset role;
  if v_cnt <> 1 then raise exception 'VERIFICARE PICATĂ: admin/contabil nu poate modifica o potrivire'; end if;
  n := n + 1;

  -- Un utilizator logat fără rol de facturare: nu vede, nu scrie.
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', '', true);
  set local role authenticated;
  select count(*) into v_cnt from public.saga_articole;
  begin
    insert into public.saga_articole (categorie_id, cod_articol, denumire) values (v_cat, 'X', 'X'); v_err := false;
  exception when others then v_err := true; end;
  reset role;
  if v_cnt <> 0 or not v_err then
    raise exception 'VERIFICARE PICATĂ: un utilizator fără rol de facturare vede (%) sau scrie potriviri', v_cnt;
  end if;
  if has_table_privilege('anon', 'public.saga_articole', 'select') or has_table_privilege('anon', 'public.saga_articole', 'insert') then
    raise exception 'VERIFICARE PICATĂ: anon are drepturi pe saga_articole';
  end if;
  n := n + 2;
  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_user::text, true);

  -- Valori greșite: cod gol, cod cu spații la capete, a doua potrivire pe aceeași categorie.
  begin insert into public.saga_articole (categorie_id, cod_articol, denumire) values (v_cat, '  ', 'X'); v_err := false;
  exception when others then v_err := true; end;
  if not v_err then raise exception 'VERIFICARE PICATĂ: un cod de articol gol a fost acceptat'; end if;
  begin insert into public.saga_articole (categorie_id, cod_articol, denumire) values (v_cat, ' C1 ', 'X'); v_err := false;
  exception when others then v_err := true; end;
  if not v_err then raise exception 'VERIFICARE PICATĂ: un cod cu spații la capete a fost acceptat'; end if;
  begin insert into public.saga_articole (categorie_id, cod_articol, denumire) values (v_alta, 'DUBLU', 'X'); v_err := false;
  exception when others then v_err := true; end;
  if not v_err then raise exception 'VERIFICARE PICATĂ: a doua potrivire pe aceeași categorie a fost acceptată'; end if;
  n := n + 3;

  -- ----------------------------------------------------------
  -- B. ORDINEA: subcategoria → categoria → implicitul
  -- ----------------------------------------------------------
  -- 1. Fără potrivire pe categoria piesei → implicitul (potrivirea altei categorii nu contează).
  r := public.emite_factura(o.id); f := (r ->> 'id')::bigint;
  select * into l from public.facturi_linii where factura_id = f and order_item_id = v_item;
  if l.cod_articol_saga <> 'IMPL' or l.descriere <> 'ACCESORII AUTO' or l.um <> 'BUC' then
    raise exception 'VERIFICARE PICATĂ: fără potrivire, piesa trebuia pe articolul implicit; are %', l.cod_articol_saga;
  end if;
  perform public.retrage_factura(f);
  n := n + 1;

  -- 2. Potrivire pe CATEGORIE → articolul categoriei.
  insert into public.saga_articole (categorie_id, cod_articol, denumire, um) values (v_cat, 'CAT', 'ART CATEGORIE', 'SET');
  r := public.emite_factura(o.id); f := (r ->> 'id')::bigint;
  select * into l from public.facturi_linii where factura_id = f and order_item_id = v_item;
  if l.cod_articol_saga <> 'CAT' or l.descriere <> 'ART CATEGORIE' or l.um <> 'SET' then
    raise exception 'VERIFICARE PICATĂ: cu potrivire pe categorie, aștept CAT/ART CATEGORIE/SET; am %/%/%', l.cod_articol_saga, l.descriere, l.um;
  end if;
  perform public.retrage_factura(f);
  n := n + 1;

  -- 3. Și pe SUBCATEGORIE → subcategoria câștigă.
  insert into public.saga_articole (categorie_id, cod_articol, denumire) values (v_sub, 'SUB', 'ART SUBCATEGORIE');
  r := public.emite_factura(o.id); f := (r ->> 'id')::bigint;
  select * into l from public.facturi_linii where factura_id = f and order_item_id = v_item;
  if l.cod_articol_saga <> 'SUB' or l.descriere <> 'ART SUBCATEGORIE' or l.um <> 'BUC' then
    raise exception 'VERIFICARE PICATĂ: cu potrivire și pe subcategorie, aștept SUB; am %', l.cod_articol_saga;
  end if;
  -- Numărul s-a refolosit la fiecare retragere: tot 1.
  if (select numar from public.facturi where id = f) <> 1 then
    raise exception 'VERIFICARE PICATĂ: după retrageri, factura trebuia să aibă tot numărul 1';
  end if;
  n := n + 2;

  -- 4. Reducerea și transportul NU iau articolul piesei (rămân pe implicit / articolele lor).
  if exists (select 1 from public.facturi_linii where factura_id = f and tip in ('reducere', 'transport')
              and cod_articol_saga in ('CAT', 'SUB')) then
    raise exception 'VERIFICARE PICATĂ: reducerea sau transportul au luat articolul unei categorii';
  end if;
  n := n + 1;

  -- 5. Factura emisă NU se schimbă când se schimbă potrivirea (copia de la emitere).
  update public.saga_articole set cod_articol = 'SUB2' where categorie_id = v_sub;
  if (select cod_articol_saga from public.facturi_linii where factura_id = f and order_item_id = v_item) <> 'SUB' then
    raise exception 'VERIFICARE PICATĂ: schimbarea potrivirii a modificat o factură deja emisă';
  end if;
  n := n + 1;

  raise exception 'REZULTAT OK: toate cele % verificări au trecut (probă pe comanda %, seria de probă „%”). (Apare ca eroare intenționat: așa baza anulează tot — potrivirile, setările, facturile de probă.)',
    n, o.numar, v_serie;
end $$;

rollback;
