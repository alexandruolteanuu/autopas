-- ============================================================
-- 12. COSTUL LIVRĂRII SE STABILEȘTE DUPĂ PLASAREA COMENZII
-- Supabase → SQL Editor → New query → lipește tot → Run
--
-- DE CE: piesele auto diferă mult ca greutate și gabarit, iar FAN Courier
-- taxează în funcție de ele. Un preț fix (19,90 lei) e greșit în ambele sensuri:
-- prea mare pentru un senzor, mult prea mic pentru o cutie de viteze.
--
-- CUM: clientul plasează comanda fără cost de livrare (îi spunem clar în checkout
-- că îl calculăm și îl comunicăm înainte de expediere). Echipa completează în
-- admin datele reale (greutate, dimensiuni, km suplimentari), iar serverul
-- recalculează totalul comenzii și scrie totul în jurnal.
-- ============================================================

-- ---------- 1. CÂMPURI NOI PE COMANDĂ ----------
-- `livrare` (care există deja) rămâne TOTALUL transportului; câmpurile de mai jos
-- păstrează defalcarea, ca să-i poți explica clientului din ce se compune suma.
alter table orders add column if not exists livrare_baza        numeric(10,2);
alter table orders add column if not exists livrare_km_extra    numeric(10,2);
alter table orders add column if not exists livrare_alte        numeric(10,2);
alter table orders add column if not exists livrare_greutate_kg numeric(10,2);
alter table orders add column if not exists livrare_dimensiuni  text;
alter table orders add column if not exists livrare_nota        text;        -- explicațiile pentru client
alter table orders add column if not exists livrare_stabilit_la timestamptz; -- null = încă necalculat

-- ---------- 2. STABILIREA COSTULUI (doar echipa) ----------
-- Totalul comenzii se recalculează AICI, pe server, din subtotal și reducere.
-- Nu se acceptă un total trimis din browser — aceeași regulă ca la plasarea comenzii.
create or replace function public.seteaza_cost_livrare(
  p_order_id   bigint,
  p_baza       numeric,
  p_km_extra   numeric default 0,
  p_alte       numeric default 0,
  p_greutate   numeric default null,
  p_dimensiuni text default null,
  p_nota       text default null
) returns json
language plpgsql security definer set search_path = public as $fn$
declare
  o        record;
  v_livrare numeric(10,2);
  v_total   numeric(10,2);
begin
  if not is_staff() then
    return json_build_object('ok', false, 'mesaj', 'Doar echipa poate stabili costul livrării.');
  end if;

  select * into o from orders where id = p_order_id;
  if not found then
    return json_build_object('ok', false, 'mesaj', 'Comanda nu există.');
  end if;
  if o.status = 'anulata' then
    return json_build_object('ok', false, 'mesaj', 'Comanda este anulată — costul nu mai poate fi stabilit.');
  end if;

  if coalesce(p_baza, 0) < 0 or coalesce(p_km_extra, 0) < 0 or coalesce(p_alte, 0) < 0 then
    return json_build_object('ok', false, 'mesaj', 'Sumele nu pot fi negative.');
  end if;

  v_livrare := round(coalesce(p_baza, 0) + coalesce(p_km_extra, 0) + coalesce(p_alte, 0), 2);
  v_total   := o.subtotal - coalesce(o.discount_valoare, 0) + v_livrare;

  update orders set
    livrare             = v_livrare,
    livrare_baza        = coalesce(p_baza, 0),
    livrare_km_extra    = coalesce(p_km_extra, 0),
    livrare_alte        = coalesce(p_alte, 0),
    livrare_greutate_kg = p_greutate,
    livrare_dimensiuni  = nullif(trim(coalesce(p_dimensiuni, '')), ''),
    livrare_nota        = nullif(trim(coalesce(p_nota, '')), ''),
    livrare_stabilit_la = now(),
    total               = v_total
  where id = p_order_id;

  insert into order_events (order_id, tip, mesaj, autor)
  values (p_order_id, 'livrare',
    'Cost livrare stabilit: ' || trim(to_char(v_livrare, 'FM999999990.00')) || ' lei' ||
    ' (transport ' || trim(to_char(coalesce(p_baza,0), 'FM999999990.00')) ||
    case when coalesce(p_km_extra,0) > 0 then ' + km suplimentari ' || trim(to_char(p_km_extra, 'FM999999990.00')) else '' end ||
    case when coalesce(p_alte,0)     > 0 then ' + alte taxe '       || trim(to_char(p_alte,     'FM999999990.00')) else '' end ||
    ')' ||
    case when p_greutate is not null then ' · ' || trim(to_char(p_greutate, 'FM999999990.0')) || ' kg' else '' end ||
    ' — total comandă ' || trim(to_char(v_total, 'FM999999990.00')) || ' lei',
    coalesce(auth.jwt()->>'email', 'echipa'));

  return json_build_object('ok', true, 'livrare', v_livrare, 'total', v_total);
end; $fn$;

-- doar utilizatori autentificați (funcția verifică oricum rolul de echipă)
revoke execute on function public.seteaza_cost_livrare(bigint, numeric, numeric, numeric, numeric, text, text) from public, anon;
grant  execute on function public.seteaza_cost_livrare(bigint, numeric, numeric, numeric, numeric, text, text) to authenticated;

-- ---------- 3. PLASAREA COMENZII: FĂRĂ COST DE LIVRARE ----------
-- Singura schimbare față de versiunea anterioară: livrarea pornește de la 0 și
-- se completează ulterior din admin. Curierul se validează, dar prețul lui nu
-- se mai folosește (nu mai există un tarif fix).
create or replace function public.plaseaza_comanda(
  p_client jsonb,
  p_items  jsonb,
  p_curier text,
  p_plata  text,
  p_cod    text default null,
  p_total_asteptat numeric default null
) returns json
language plpgsql security definer set search_path = public as $fn$
declare
  it         jsonb;
  prod       record;
  c          record;
  v_subtotal numeric(10,2) := 0;
  v_reducere numeric(10,2) := 0;
  v_total    numeric(10,2);
  v_cod      text := null;
  v_numar    text;
  v_order_id bigint;
  v_cant     int;
  v_tip      text;
  v_curier_ok boolean;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return json_build_object('ok', false, 'mesaj', 'Coșul este gol.');
  end if;
  if jsonb_array_length(p_items) > 50 then
    return json_build_object('ok', false, 'mesaj', 'Prea multe piese într-o singură comandă.');
  end if;
  if p_plata is null or p_plata not in ('card', 'ramburs', 'transfer') then
    return json_build_object('ok', false, 'mesaj', 'Metodă de plată necunoscută.');
  end if;

  v_tip := coalesce(nullif(p_client->>'tip_client', ''), 'pf');
  if v_tip not in ('pf', 'firma') then
    return json_build_object('ok', false, 'mesaj', 'Tip de client necunoscut.');
  end if;

  if coalesce(trim(p_client->>'nume'), '') = ''
     or coalesce(trim(p_client->>'email'), '') = ''
     or coalesce(trim(p_client->>'telefon'), '') = ''
     or coalesce(trim(p_client->>'adresa'), '') = ''
     or coalesce(trim(p_client->>'oras'), '') = ''
     or coalesce(trim(p_client->>'judet'), '') = '' then
    return json_build_object('ok', false, 'mesaj', 'Completează toate câmpurile obligatorii de livrare.');
  end if;

  -- curierul trebuie să existe în Setări, dar prețul lui nu se mai folosește
  select true into v_curier_ok
    from settings s, jsonb_array_elements(s.valoare) as cur(el)
   where s.cheie = 'curieri' and cur.el->>'id' = p_curier;
  if v_curier_ok is not true then
    return json_build_object('ok', false, 'mesaj', 'Curierul ales nu mai este disponibil.');
  end if;

  for it in select e.value from jsonb_array_elements(p_items) e
            order by (e.value->>'id')::bigint loop
    v_cant := greatest(coalesce((it->>'cantitate')::int, 1), 1);

    select id, nume, pret_lei, stoc, publicat into prod
      from products where id = (it->>'id')::bigint for update;

    if not found then
      return json_build_object('ok', false, 'reincarca', true,
        'mesaj', 'O piesă din coș nu mai există. Golește coșul și încearcă din nou.');
    end if;
    if not prod.publicat or prod.stoc < v_cant then
      return json_build_object('ok', false, 'reincarca', true,
        'mesaj', 'Piesa „' || prod.nume || '” tocmai s-a vândut. Scoate-o din coș și reia comanda.');
    end if;

    v_subtotal := v_subtotal + prod.pret_lei * v_cant;
  end loop;

  if p_cod is not null and trim(p_cod) <> '' then
    select * into c from discount_codes
     where upper(cod) = upper(trim(p_cod)) and activ = true;
    if found
       and (c.expira_la is null or c.expira_la >= current_date)
       and v_subtotal >= c.minim_comanda then
      if c.tip = 'procent' then v_reducere := round(v_subtotal * c.valoare / 100, 2);
      else v_reducere := least(c.valoare, v_subtotal); end if;
      v_cod := c.cod;
    end if;
  end if;

  -- totalul de acum NU include transportul (se adaugă din admin, ulterior)
  v_total := v_subtotal - v_reducere;

  if p_total_asteptat is not null and abs(p_total_asteptat - v_total) > 0.01 then
    return json_build_object('ok', false, 'reincarca', true, 'total', v_total,
      'mesaj', 'Prețurile s-au actualizat între timp. Totalul corect este ' ||
               trim(to_char(v_total, 'FM999999990.00')) || ' lei — reîncarcă coșul și reia comanda.');
  end if;

  v_numar := 'AP-' || to_char(now(), 'YYYY') || '-' ||
             lpad(nextval('public.nr_comanda_seq')::text, 5, '0');

  insert into orders (numar, tip_client, nume, email, telefon, firma, cui,
                      adresa, oras, judet, curier, plata,
                      subtotal, livrare, total, discount_cod, discount_valoare, gdpr)
  values (v_numar, v_tip,
          trim(p_client->>'nume'), trim(p_client->>'email'), trim(p_client->>'telefon'),
          case when v_tip = 'firma' then nullif(trim(p_client->>'firma'), '') end,
          case when v_tip = 'firma' then nullif(trim(p_client->>'cui'), '') end,
          trim(p_client->>'adresa'), trim(p_client->>'oras'), trim(p_client->>'judet'),
          p_curier, p_plata,
          v_subtotal, 0, v_total, v_cod, v_reducere,
          coalesce((p_client->>'gdpr')::boolean, false))
  returning id into v_order_id;

  for it in select e.value from jsonb_array_elements(p_items) e
            order by (e.value->>'id')::bigint loop
    v_cant := greatest(coalesce((it->>'cantitate')::int, 1), 1);
    select id, nume, pret_lei into prod from products where id = (it->>'id')::bigint;
    insert into order_items (order_id, product_id, nume, pret, cantitate)
    values (v_order_id, prod.id, prod.nume, prod.pret_lei, v_cant);
  end loop;

  if v_cod is not null then
    update discount_codes set folosiri = folosiri + 1 where cod = v_cod;
  end if;

  return json_build_object('ok', true, 'numar', v_numar, 'total', v_total);
end; $fn$;

-- Verificare rapidă — rulează separat dacă vrei să vezi rezultatul:
-- select numar, subtotal, livrare, total, livrare_stabilit_la from orders order by id desc limit 5;
