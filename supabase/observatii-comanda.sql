-- ============================================================
-- MIGRAREA 41 — observațiile clientului la comandă
--
-- DE CE (cerut de proprietar, 15 septembrie 2026)
-- Pe site sunt piese scrise ca UN singur produs pentru ambele părți: „Oglindă
-- stânga/dreapta", „Far stânga/dreapta". Clientul care comandă nu avea unde să
-- spună ce parte vrea, iar echipa afla abia la telefon — sau deloc.
-- Acum checkout-ul are un câmp liber, opțional, „Observații pentru comandă".
--
-- CE FACE
--   1. `orders.observatii` — text liber, opțional, maximum 1.000 de caractere.
--   2. `plaseaza_comanda` îl primește ÎN `p_client` (cheia `observatii`), deci
--      semnătura funcției NU se schimbă: niciun `drop function`, niciun drept
--      de acordat din nou, iar un checkout vechi rămas deschis într-un tab
--      merge în continuare (trimite pur și simplu fără cheia asta).
--
-- DE UNDE E COPIATĂ FUNCȚIA
-- Din PRODUCȚIE (`pg_get_functiondef`, citită la 14 septembrie 2026), comparată
-- cu `mod-vacanta.sql` (migrarea 27): identice, în afară de un comentariu din
-- gardă. Singurele schimbări față de ea sunt cele marcate „MIGRAREA 41".
-- Regula din CLAUDE.md rămâne: cine modifică funcția din nou o compară întâi
-- cu ce e în bază, altfel un `create or replace` dă înapoi tăcut o modificare.
--
-- Nu atinge niciun rând existent. IDEMPOTENTĂ: se poate re-rula oricând.
-- ============================================================

-- 1. COLOANA
alter table orders add column if not exists observatii text;

-- Plafonul stă și în bază, nu doar în `maxlength` din pagină: funcția e publică,
-- deci oricine o poate chema direct, cu orice lungime.
alter table orders drop constraint if exists orders_observatii_lungime;
alter table orders add constraint orders_observatii_lungime
  check (observatii is null or char_length(observatii) <= 1000);

comment on column orders.observatii is
  'Ce a scris clientul la checkout (ex. „vreau oglinda stângă"). Opțional.';


-- 2. FUNCȚIA
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
  -- ---- MOD VACANȚĂ — prima verificare, înaintea oricărei alteia ----
  if coalesce((select (valoare->>'activ')::boolean from settings where cheie = 'vacanta'), false) then
    return json_build_object('ok', false, 'vacanta', true,
      'mesaj', coalesce(
        nullif(trim((select valoare->>'mesaj' from settings where cheie = 'vacanta')), ''),
        'Magazin în pauză temporară.') ||
        ' Comenzile sunt oprite momentan — sună-ne dacă ai nevoie urgent de o piesă.');
  end if;
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

  -- MIGRAREA 41: observațiile au plafon și aici, cu mesaj omenesc, ca un text
  -- prea lung să nu ajungă la constrângerea din tabelă ca eroare tehnică.
  if char_length(coalesce(trim(p_client->>'observatii'), '')) > 1000 then
    return json_build_object('ok', false, 'mesaj', 'Observațiile pot avea cel mult 1.000 de caractere.');
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
                      subtotal, livrare, total, discount_cod, discount_valoare, gdpr,
                      observatii)  -- MIGRAREA 41
  values (v_numar, v_tip,
          trim(p_client->>'nume'), trim(p_client->>'email'), trim(p_client->>'telefon'),
          case when v_tip = 'firma' then nullif(trim(p_client->>'firma'), '') end,
          case when v_tip = 'firma' then nullif(trim(p_client->>'cui'), '') end,
          trim(p_client->>'adresa'), trim(p_client->>'oras'), trim(p_client->>'judet'),
          p_curier, p_plata,
          v_subtotal, 0, v_total, v_cod, v_reducere,
          coalesce((p_client->>'gdpr')::boolean, false),
          nullif(trim(coalesce(p_client->>'observatii', '')), ''))  -- MIGRAREA 41
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

grant execute on function public.plaseaza_comanda(jsonb, jsonb, text, text, text, numeric)
  to anon, authenticated;


-- 3. CE A IEȘIT
select column_name, data_type from information_schema.columns
 where table_name = 'orders' and column_name = 'observatii';
