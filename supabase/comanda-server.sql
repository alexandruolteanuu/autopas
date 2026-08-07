-- ============================================================
-- 11. COMANDA SE CALCULEAZĂ PE SERVER (rulează după date-firma.sql)
-- Supabase → SQL Editor → New query → lipește tot → Run
--
-- DE CE: până acum browserul trimitea el prețurile (subtotal, livrare, total
-- și prețul fiecărei piese), iar baza de date le accepta ca atare. Oricine
-- deschidea consola putea comanda o piesă de 1.150 lei la 1 leu.
--
-- DE ACUM: browserul trimite doar CE vrea să cumpere (id-urile pieselor),
-- iar serverul citește prețurile din tabela `products`, costul livrării din
-- `settings` și recalculează totalul. Ce trimite clientul nu mai contează.
--
-- Bonus, rezolvate în aceeași funcție:
--  · numărul comenzii vine dintr-un contor, nu din random (fără coliziuni);
--  · comanda și piesele ei se scriu într-o singură tranzacție (fără comenzi goale);
--  · piesa e blocată la citire (for update), deci nu poate fi vândută de două ori.
-- ============================================================

-- ---------- 1. CONTOR PENTRU NUMĂRUL COMENZII ----------
-- Format: AP-2026-01000, AP-2026-01001, …
create sequence if not exists public.nr_comanda_seq start with 1000;

-- ---------- 2. FUNCȚIA CARE PLASEAZĂ COMANDA ----------
-- `security definer` = rulează cu drepturile proprietarului, deci poate scrie
-- în orders/order_items chiar dacă clientul nu mai are voie să scrie direct.
create or replace function public.plaseaza_comanda(
  p_client jsonb,                      -- datele de livrare (nume, email, adresă…)
  p_items  jsonb,                      -- [{"id": 12, "cantitate": 1}, …]
  p_curier text,
  p_plata  text,
  p_cod    text default null,          -- codul de reducere, opțional
  p_total_asteptat numeric default null -- totalul afișat clientului, pentru control
) returns json
language plpgsql security definer set search_path = public as $$
declare
  it         jsonb;
  prod       record;
  c          record;
  v_subtotal numeric(10,2) := 0;
  v_livrare  numeric(10,2);
  v_reducere numeric(10,2) := 0;
  v_total    numeric(10,2);
  v_cod      text := null;
  v_numar    text;
  v_order_id bigint;
  v_cant     int;
  v_tip      text;
begin
  -- ---- 2.1 Verificări de bază ----
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

  -- câmpurile obligatorii pentru livrare (mesaj clar, nu eroare de bază de date)
  if coalesce(trim(p_client->>'nume'), '') = ''
     or coalesce(trim(p_client->>'email'), '') = ''
     or coalesce(trim(p_client->>'telefon'), '') = ''
     or coalesce(trim(p_client->>'adresa'), '') = ''
     or coalesce(trim(p_client->>'oras'), '') = ''
     or coalesce(trim(p_client->>'judet'), '') = '' then
    return json_build_object('ok', false, 'mesaj', 'Completează toate câmpurile obligatorii de livrare.');
  end if;

  -- ---- 2.2 Costul livrării — din Setări, nu din browser ----
  select (cur.el->>'pret')::numeric into v_livrare
    from settings s, jsonb_array_elements(s.valoare) as cur(el)
   where s.cheie = 'curieri' and cur.el->>'id' = p_curier;
  if v_livrare is null then
    return json_build_object('ok', false, 'mesaj', 'Curierul ales nu mai este disponibil.');
  end if;

  -- ---- 2.3 Prețurile pieselor — din tabela products ----
  -- `for update` blochează rândurile până la finalul tranzacției, ca aceeași
  -- piesă unicat să nu fie vândută simultan la doi clienți.
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

  -- ---- 2.4 Reducerea — recalculată aici, nu preluată din browser ----
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
    -- dacă nu e valid, comanda merge mai departe fără reducere;
    -- diferența de total e prinsă la pasul următor și clientul e anunțat.
  end if;

  v_total := v_subtotal - v_reducere + v_livrare;

  -- ---- 2.5 Totalul afișat clientului trebuie să coincidă ----
  -- Dacă între timp s-a schimbat un preț sau a expirat codul, NU plasăm comanda
  -- pe tăcute cu altă sumă — îi spunem clientului să reîncarce coșul.
  if p_total_asteptat is not null and abs(p_total_asteptat - v_total) > 0.01 then
    return json_build_object('ok', false, 'reincarca', true, 'total', v_total,
      'mesaj', 'Prețurile s-au actualizat între timp. Totalul corect este ' ||
               trim(to_char(v_total, 'FM999999990.00')) || ' lei — reîncarcă coșul și reia comanda.');
  end if;

  -- ---- 2.6 Scriem comanda (totul într-o singură tranzacție) ----
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
          v_subtotal, v_livrare, v_total, v_cod, v_reducere,
          coalesce((p_client->>'gdpr')::boolean, false))
  returning id into v_order_id;

  -- piesele comandate — prețul și denumirea vin tot din products
  -- (triggerul tr_scade_stocul scade stocul și depublică piesa la 0)
  for it in select e.value from jsonb_array_elements(p_items) e
            order by (e.value->>'id')::bigint loop
    v_cant := greatest(coalesce((it->>'cantitate')::int, 1), 1);
    select id, nume, pret_lei into prod from products where id = (it->>'id')::bigint;
    insert into order_items (order_id, product_id, nume, pret, cantitate)
    values (v_order_id, prod.id, prod.nume, prod.pret_lei, v_cant);
  end loop;

  -- contorizăm folosirea codului doar dacă a fost chiar aplicat
  if v_cod is not null then
    update discount_codes set folosiri = folosiri + 1 where cod = v_cod;
  end if;

  return json_build_object('ok', true, 'numar', v_numar, 'total', v_total);
end; $$;

grant execute on function public.plaseaza_comanda(jsonb, jsonb, text, text, text, numeric)
  to anon, authenticated;

-- ---------- 3. ÎNCHIDEM SCRIEREA DIRECTĂ ÎN COMENZI ----------
-- Fără aceste politici, un `insert` direct din browser este respins de RLS.
-- Singura cale de a plasa o comandă rămâne funcția de mai sus.
drop policy if exists "comenzi insert" on orders;
drop policy if exists "items insert" on order_items;

-- ---------- 4. CURĂȚENIE ----------
-- `foloseste_cod` era apelabilă de oricine și umfla contorul de folosiri.
-- Numărătoarea se face acum în interiorul comenzii, deci n-o mai expunem.
-- (verificăm întâi că există, ca scriptul să nu cadă dacă sprint-bc.sql n-a rulat)
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'foloseste_cod') then
    revoke execute on function public.foloseste_cod(text) from anon, authenticated;
  end if;
end $$;

-- Verificare rapidă — rulează separat dacă vrei să vezi rezultatul:
-- select proname from pg_proc where proname = 'plaseaza_comanda';
-- select policyname from pg_policies where tablename in ('orders','order_items');
