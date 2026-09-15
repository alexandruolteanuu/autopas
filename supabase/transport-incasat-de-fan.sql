-- ============================================================
-- MIGRAREA 45 — transportul îl încasează FAN, nu firma
--
-- DE CE (decizia proprietarului, 15 septembrie 2026)
-- Operatorul calculează transportul și i-l comunică clientului, dar NU îl încasează:
-- pe AWB transportul e plătit de destinatar direct la FAN Courier (`payment:
-- "recipient"`, lib/fancourier.ts), iar rambursul e DOAR valoarea pieselor. Așa lucra
-- firma și din contul eAWB.
--
-- Deci totalul comenzii (`orders.total`) nu mai include transportul: e ce încasează
-- firma. `orders.livrare` și defalcarea (`livrare_baza`, `livrare_km_extra`…) rămân
-- completate, ca informație pentru client și pentru mesajul de pe WhatsApp.
--
-- Funcția e copiată din PRODUCȚIE (`pg_get_functiondef`, citită la 15 septembrie
-- 2026, identică cu `livrare-dupa-comanda.sql`). Singurele schimbări sunt marcate
-- „MIGRAREA 45": calculul lui `v_total` și textul din jurnal.
--
-- NU atinge comenzile existente: cele 2 cu transportul deja inclus în total rămân așa
-- (au fost stabilite sub regula veche). Exporturile Saga trec transportul pe factură
-- doar când e inclus în total, deci pentru ele rămân corecte.
--
-- IDEMPOTENTĂ: se poate re-rula oricând.
-- ============================================================

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
  -- MIGRAREA 45: transportul NU intră în total — îl încasează FAN direct de la client.
  v_total   := o.subtotal - coalesce(o.discount_valoare, 0);

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
    -- MIGRAREA 45: jurnalul spune limpede cine încasează ce.
    ', încasat de FAN de la client — de încasat de noi (ramburs): ' || trim(to_char(v_total, 'FM999999990.00')) || ' lei',
    coalesce(auth.jwt()->>'email', 'echipa'));

  return json_build_object('ok', true, 'livrare', v_livrare, 'total', v_total);
end; $fn$;

revoke execute on function public.seteaza_cost_livrare(bigint, numeric, numeric, numeric, numeric, text, text) from public, anon;
grant  execute on function public.seteaza_cost_livrare(bigint, numeric, numeric, numeric, numeric, text, text) to authenticated;
