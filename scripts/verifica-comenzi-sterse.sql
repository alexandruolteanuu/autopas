-- ============================================================
-- VERIFICĂRILE MIGRĂRII 55 (supabase/comenzi-sterse.sql) — „Șterge” pe comenzile cu factură
--
-- Se rulează după migrarea 55, din Supabase → SQL Editor: lipești tot → Run.
-- Merge pe PRODUCȚIE. NU LASĂ NIMIC ÎN BAZĂ: totul între BEGIN și ROLLBACK, iar blocul
-- se termină ÎNTOTDEAUNA cu o eroare, care anulează tot (ascunderea de probă, ștergerea
-- de probă a unei comenzi fără factură, stocul).
--
-- Folosește comenzi EXISTENTE: una cu factură din aplicație și una fără.
-- REZULTATUL apare ÎNTOTDEAUNA în căsuța roșie de eroare:
--   · reușită: „REZULTAT OK: toate cele N verificări au trecut …”
--   · eșec:    „VERIFICARE PICATĂ: …”
-- ============================================================

begin;

do $$
declare
  n        int := 0;
  v_admin  uuid;
  v_cu     bigint;      -- comandă cu factură
  v_fara   bigint;      -- comandă fără factură
  v_alta   bigint;      -- altă comandă, pentru scrierea directă din browser
  r        json;
  v_fact0  text;  v_fact1  text;
  v_lin0   text;  v_lin1   text;
  v_stoc0  text;  v_stoc1  text;
  v_cmd0   jsonb; v_cmd1   jsonb;
  v_items  int;
  v_err    boolean;
  v_cnt    int;
begin
  -- ----------------------------------------------------------
  -- A. STRUCTURA
  -- ----------------------------------------------------------
  if (select count(*) from information_schema.columns
       where table_schema = 'public' and table_name = 'orders' and column_name in ('sters_la', 'sters_de')) <> 2 then
    raise exception 'VERIFICARE PICATĂ: lipsesc coloanele sters_la / sters_de pe orders';
  end if;
  n := n + 1;
  if not exists (select 1 from pg_trigger where tgname = 'orders_sters_pazeste'
                  and tgrelid = 'public.orders'::regclass and tgenabled <> 'D') then
    raise exception 'VERIFICARE PICATĂ: triggerul orders_sters_pazeste lipsește sau e oprit';
  end if;
  n := n + 1;
  if (select md5(replace(prosrc, E'\r', '')) from pg_proc where oid = to_regprocedure('public.sterge_comanda(bigint)'))
     <> 'ec5319ea6dbed417d766c2fb92157410' then
    raise exception 'VERIFICARE PICATĂ: sterge_comanda nu e versiunea din migrarea 55';
  end if;
  n := n + 1;

  -- ----------------------------------------------------------
  -- B. DATELE DE PROBĂ (existente, doar citite până aici)
  -- ----------------------------------------------------------
  select id into v_admin from public.profiles where role = 'admin' order by created_at limit 1;
  if v_admin is null then raise exception 'VERIFICARE PICATĂ: nu există niciun profil admin.'; end if;
  select o.id into v_cu from public.orders o
   where o.sters_la is null and exists (select 1 from public.facturi f where f.order_id = o.id)
   order by o.id desc limit 1;
  select o.id into v_fara from public.orders o
   where o.sters_la is null and not exists (select 1 from public.facturi f where f.order_id = o.id)
   order by o.id limit 1;
  select o.id into v_alta from public.orders o
   where o.sters_la is null and o.id not in (coalesce(v_cu, 0), coalesce(v_fara, 0))
   order by o.id desc limit 1;
  if v_cu is null or v_fara is null or v_alta is null then
    raise exception 'VERIFICARE PICATĂ: nu găsesc o comandă cu factură, una fără și încă una.';
  end if;

  -- Amprentele a tot ce NU are voie să se schimbe la ascundere.
  select md5(string_agg(to_jsonb(f)::text, '|' order by f.id)) into v_fact0 from public.facturi f where f.order_id = v_cu;
  select md5(string_agg(to_jsonb(l)::text, '|' order by l.id)) into v_lin0
    from public.facturi_linii l join public.facturi f on f.id = l.factura_id where f.order_id = v_cu;
  select md5(coalesce(string_agg(p.id || ':' || p.stoc || ':' || p.publicat, '|' order by p.id), '')) into v_stoc0
    from public.products p where p.id in (select product_id from public.order_items where order_id = v_cu);
  select to_jsonb(o) - 'sters_la' - 'sters_de' into v_cmd0 from public.orders o where o.id = v_cu;
  select count(*) into v_items from public.order_items where order_id = v_cu;

  -- ----------------------------------------------------------
  -- C. UN UTILIZATOR CARE NU E ADMIN nu șterge nimic
  -- ----------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', '', true);
  set local role authenticated;
  r := public.sterge_comanda(v_cu);
  reset role;
  if (r->>'ok')::boolean or (select sters_la from public.orders where id = v_cu) is not null then
    raise exception 'VERIFICARE PICATĂ: un utilizator fără rol de admin a ascuns comanda';
  end if;
  n := n + 1;

  -- ----------------------------------------------------------
  -- D. ADMINUL, PE COMANDA CU FACTURĂ → ascunsă, nimic altceva atins
  -- ----------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated', 'email', 'proba@verifica')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  r := public.sterge_comanda(v_cu);
  reset role;
  if not coalesce((r->>'ok')::boolean, false) then
    raise exception 'VERIFICARE PICATĂ: „Șterge” pe comanda cu factură a fost refuzat: %', r->>'mesaj';
  end if;
  n := n + 1;
  if not exists (select 1 from public.orders where id = v_cu and sters_la is not null and sters_de = v_admin) then
    raise exception 'VERIFICARE PICATĂ: comanda cu factură nu e marcată ștearsă (sters_la / sters_de)';
  end if;
  n := n + 1;
  select md5(string_agg(to_jsonb(f)::text, '|' order by f.id)) into v_fact1 from public.facturi f where f.order_id = v_cu;
  select md5(string_agg(to_jsonb(l)::text, '|' order by l.id)) into v_lin1
    from public.facturi_linii l join public.facturi f on f.id = l.factura_id where f.order_id = v_cu;
  if v_fact1 is distinct from v_fact0 then raise exception 'VERIFICARE PICATĂ: facturile comenzii s-au schimbat la ștergere'; end if;
  if v_lin1 is distinct from v_lin0 then raise exception 'VERIFICARE PICATĂ: liniile facturilor s-au schimbat la ștergere'; end if;
  n := n + 2;
  select md5(coalesce(string_agg(p.id || ':' || p.stoc || ':' || p.publicat, '|' order by p.id), '')) into v_stoc1
    from public.products p where p.id in (select product_id from public.order_items where order_id = v_cu);
  if v_stoc1 is distinct from v_stoc0 then raise exception 'VERIFICARE PICATĂ: stocul / publicarea pieselor s-a schimbat la ascundere'; end if;
  n := n + 1;
  select to_jsonb(o) - 'sters_la' - 'sters_de' into v_cmd1 from public.orders o where o.id = v_cu;
  if v_cmd1 is distinct from v_cmd0 then raise exception 'VERIFICARE PICATĂ: alte câmpuri ale comenzii (status, AWB, factura…) s-au schimbat'; end if;
  if (select count(*) from public.order_items where order_id = v_cu) <> v_items then
    raise exception 'VERIFICARE PICATĂ: piesele comenzii s-au schimbat';
  end if;
  n := n + 2;
  if not exists (select 1 from public.order_events where order_id = v_cu and tip = 'stergere' and autor = 'proba@verifica') then
    raise exception 'VERIFICARE PICATĂ: lipsește nota din jurnalul comenzii';
  end if;
  n := n + 1;

  -- A doua apăsare: refuzată, fără o a doua notă.
  set local role authenticated;
  r := public.sterge_comanda(v_cu);
  reset role;
  if coalesce((r->>'ok')::boolean, true)
     or (select count(*) from public.order_events where order_id = v_cu and tip = 'stergere') <> 1 then
    raise exception 'VERIFICARE PICATĂ: a doua ștergere a aceleiași comenzi nu a fost refuzată curat';
  end if;
  n := n + 1;

  -- ----------------------------------------------------------
  -- E. RAPOARTELE ȘI EXPORTUL o văd în continuare (RLS neschimbat)
  -- ----------------------------------------------------------
  set local role authenticated;
  select count(*) into v_cnt from public.orders where id = v_cu;
  reset role;
  if v_cnt <> 1 then raise exception 'VERIFICARE PICATĂ: adminul nu mai poate citi comanda ascunsă (rapoartele ar pierde-o)'; end if;
  n := n + 1;
  if v_items > 0 then
    set local role authenticated;
    select count(*) into v_cnt from public.export_saga_linii(array[v_cu]);
    reset role;
    if v_cnt = 0 then raise exception 'VERIFICARE PICATĂ: exportul pentru SAGA nu mai include comanda ascunsă'; end if;
  end if;
  n := n + 1;

  -- ----------------------------------------------------------
  -- F. DIN BROWSER coloanele nu se scriu direct; din SQL Editor, da
  -- ----------------------------------------------------------
  set local role authenticated;
  begin update public.orders set sters_la = null where id = v_cu; v_err := false;
  exception when others then v_err := true; end;
  reset role;
  if not v_err then raise exception 'VERIFICARE PICATĂ: adminul a reafișat comanda direct din browser'; end if;
  n := n + 1;
  set local role authenticated;
  begin update public.orders set sters_la = now() where id = v_alta; v_err := false;
  exception when others then v_err := true; end;
  reset role;
  if not v_err then raise exception 'VERIFICARE PICATĂ: adminul a ascuns o comandă direct din browser, ocolind sterge_comanda'; end if;
  n := n + 1;
  -- Reafișarea proprietarului (rolul SQL Editor-ului).
  update public.orders set sters_la = null, sters_de = null where id = v_cu;
  if (select sters_la from public.orders where id = v_cu) is not null then
    raise exception 'VERIFICARE PICATĂ: reafișarea din SQL Editor nu a mers';
  end if;
  n := n + 1;

  -- ----------------------------------------------------------
  -- G. COMANDA FĂRĂ FACTURĂ: ștearsă de tot, ca înainte
  -- ----------------------------------------------------------
  set local role authenticated;
  r := public.sterge_comanda(v_fara);
  reset role;
  if not coalesce((r->>'ok')::boolean, false) or exists (select 1 from public.orders where id = v_fara) then
    raise exception 'VERIFICARE PICATĂ: comanda fără factură nu s-a șters din bază: %', r->>'mesaj';
  end if;
  n := n + 1;

  raise exception 'REZULTAT OK: toate cele % verificări au trecut. (Apare ca eroare intenționat: așa baza anulează tot — ascunderea și ștergerea de probă.)', n;
end $$;

rollback;
