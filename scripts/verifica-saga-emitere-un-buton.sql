-- ============================================================
-- TESTUL ESENȚIAL AL MIGRĂRII 60 (supabase/saga-emitere-un-buton.sql)
--
-- Supabase → SQL Editor: lipești tot → Run. Merge pe PRODUCȚIE și NU LASĂ NIMIC:
-- totul stă între BEGIN și ROLLBACK, iar blocul se termină ÎNTOTDEAUNA cu o eroare
-- (căsuța roșie e intenționată):
--   · reușită: „REZULTAT OK: …”      · eșec: „VERIFICARE PICATĂ: …”
-- Lucrează pe o serie „TEST …” unică și pe o comandă EXISTENTĂ fără factură.
-- Singura urmă: id-uri interne consumate.
--
-- Verifică drumul din bază: pornirea (număr, „se_trimite”, token), a doua apăsare
-- (aceeași factură), indexul unic, renumerotarea (număr +1, contor +1, doar cu tokenul),
-- eliberarea după o respingere (factura dispare, contorul dă înapoi), validarea fără număr.
-- ============================================================

begin;

do $$
declare
  n        int := 0;
  v_user   uuid;
  v_orig   jsonb;
  o1       public.orders%rowtype;
  v_serie  text := 'TEST ' || upper(substr(md5(clock_timestamp()::text || random()::text), 1, 8));
  r        json;  r2 json;
  v_id     bigint;
  v_tok    uuid;
  v_nr     int;
  v_err    boolean;
  v_msg    text;
begin
  if (select md5(replace(prosrc, E'\r', '')) from pg_proc where oid = to_regprocedure('public.facturi_pazeste()'))
       is distinct from 'f8bccca0f490afa7f2ccf5a96d4be32d' then
    raise exception 'VERIFICARE PICATĂ: facturi_pazeste din bază nu e versiunea din migrarea 60';
  end if;
  n := n + 1;

  select id into v_user from public.profiles
   where role in ('admin', 'contabil') order by (role = 'admin') desc, created_at limit 1;
  if v_user is null then raise exception 'VERIFICARE PICATĂ: nu există niciun profil admin sau contabil.'; end if;

  select * into o1 from public.orders o
   where o.status <> 'anulata' and o.factura_serie is null and coalesce(o.factura_status, 'de_emis') = 'de_emis'
     and exists (select 1 from public.order_items i where i.order_id = o.id)
     and not exists (select 1 from public.facturi fx where fx.order_id = o.id)
     and public.factura_lipsuri(o.id) is null
   order by o.id desc limit 1;
  if o1.id is null then raise exception 'VERIFICARE PICATĂ: nu găsesc o comandă potrivită.'; end if;

  select valoare into v_orig from public.settings where cheie = 'integrari';
  v_orig := coalesce(v_orig, '{}'::jsonb);
  update public.settings set valoare = v_orig || jsonb_build_object('saga',
    coalesce(v_orig -> 'saga', '{}'::jsonb)
    || jsonb_build_object('data_start_facturare', to_char((o1.created_at at time zone 'Europe/Bucharest')::date, 'YYYY-MM-DD')))
   where cheie = 'integrari';
  update public.facturi_serii set activa = false where activa;
  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_user::text, true);
  perform public.seteaza_serie_factura(v_serie, 100);

  -- A. Pornirea: număr 100, „se_trimite”, token, contorul 101.
  r := public.emite_factura_start(o1.id);
  v_id := (r ->> 'id')::bigint;  v_tok := (r ->> 'token')::uuid;
  if (r ->> 'numar')::int <> 100 or r ->> 'stare' <> 'se_trimite' or v_tok is null
     or (select urmator from public.facturi_serii where serie = v_serie) <> 101 then
    raise exception 'VERIFICARE PICATĂ: pornirea (%).', r;
  end if;
  n := n + 1;

  -- B. A doua apăsare (dublu-clic, alt tab): aceeași factură, niciun număr nou.
  r2 := public.emite_factura_start(o1.id);
  if (r2 ->> 'id')::bigint <> v_id or (select count(*) from public.facturi where order_id = o1.id) <> 1
     or (select urmator from public.facturi_serii where serie = v_serie) <> 101 then
    raise exception 'VERIFICARE PICATĂ: a doua apăsare (%).', r2;
  end if;
  n := n + 1;

  -- C. Indexul unic: o a doua factură activă pe aceeași comandă e refuzată de bază.
  begin
    insert into public.facturi (order_id, serie, numar, data, scadenta, regim_tva, client, furnizor)
    select order_id, serie, 999, data, scadenta, regim_tva, client, furnizor from public.facturi where id = v_id;
    v_err := false;
  exception when unique_violation then v_err := true; end;
  if not v_err then raise exception 'VERIFICARE PICATĂ: indexul unic n-a oprit a doua factură.'; end if;
  n := n + 1;

  -- D. Renumerotarea: fără token refuzată; cu token → 101, contorul 102, oglinda pe comandă.
  begin perform public.facturi_renumeroteaza(v_id, gen_random_uuid()); v_err := false;
  exception when others then v_err := true; end;
  if not v_err then raise exception 'VERIFICARE PICATĂ: renumerotarea fără tokenul motorului a trecut.'; end if;
  r := public.facturi_renumeroteaza(v_id, v_tok);
  if (r ->> 'numar')::int <> 101 or (select numar from public.facturi where id = v_id) <> 101
     or (select urmator from public.facturi_serii where serie = v_serie) <> 102
     or (select factura_serie from public.orders where id = o1.id) <> v_serie || ' 101' then
    raise exception 'VERIFICARE PICATĂ: renumerotarea (%).', r;
  end if;
  n := n + 2;

  -- E. Numărul NU se schimbă pe altă cale (paza din 49 rămâne).
  begin update public.facturi set numar = 555 where id = v_id; v_err := false;
  exception when others then v_err := true; end;
  if not v_err then raise exception 'VERIFICARE PICATĂ: numărul s-a schimbat fără motor.'; end if;
  n := n + 1;

  -- F. Respingere pe date, numărul e ultimul: factura dispare, contorul revine la 101.
  r := public.facturi_elibereaza(v_id, v_tok, 'proba: date greșite');
  if (r ->> 'eliberata')::boolean is not true or exists (select 1 from public.facturi where id = v_id)
     or (select urmator from public.facturi_serii where serie = v_serie) <> 101
     or (select factura_status from public.orders where id = o1.id) <> 'de_emis' then
    raise exception 'VERIFICARE PICATĂ: eliberarea (%).', r;
  end if;
  n := n + 1;

  -- G. Validarea înainte de număr: o lipsă nu consumă nimic.
  update public.orders set adresa = '' where id = o1.id;
  begin perform public.emite_factura_start(o1.id); v_err := false;
  exception when others then v_err := true; v_msg := sqlerrm; end;
  if not v_err or v_msg not like 'De completat în comandă: adresa%'
     or (select urmator from public.facturi_serii where serie = v_serie) <> 101 then
    raise exception 'VERIFICARE PICATĂ: validarea (%).', coalesce(v_msg, 'fără eroare');
  end if;
  n := n + 1;

  raise exception 'REZULTAT OK: toate cele % verificări au trecut (comanda %, seria %). Nimic nu a rămas în bază.', n, o1.numar, v_serie;
end $$;

rollback;
