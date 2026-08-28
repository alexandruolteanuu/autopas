-- ============================================================
-- AUTOPAS — MOD VACANȚĂ (rulează AL DOUĂZECI ȘI ȘAPTELEA)
-- Supabase → SQL Editor → New query → lipește tot → Run
-- IDEMPOTENTĂ: se poate re-rula oricând.
--
-- CE E ȘI, MAI ALES, CE NU E:
--
-- Modul vacanță NU atinge NICIODATĂ coloana `products.publicat`.
--
-- Implementarea evidentă — „la activare, update products set publicat=false; la
-- dezactivare, invers" — ar distruge catalogul. A doua comandă ar republica
-- piesele ascunse intenționat de operator, pe cele cu stoc 0 depublicate automat
-- de triggerul de stoc, pe cele dispărute din feed (`sursa_activ=false`) și pe
-- cele nepublicate fiindcă le lipsea ceva. După dezactivare n-ar mai exista nicio
-- cale de a ști care piesă era ascunsă din vacanță și care din alt motiv:
-- informația s-ar pierde ireversibil.
--
-- Aici e doar un comutator global, citit la AFIȘARE. Piesele își păstrează starea
-- exactă; site-ul public pur și simplu nu le arată cât timp e activ. La
-- dezactivare totul revine automat, fără nicio scriere în `products`.
-- ============================================================


-- ============================================================
-- 1. COMUTATORUL
--
-- Rândul rămâne CITIBIL DOAR DE ECHIPĂ (politica „setari citire" lasă public
-- doar `firma` și `curieri`, iar aici nu se schimbă nimic). Motivul: `activat_de`
-- e adresa unui om din echipă și n-are ce căuta într-un răspuns public.
-- Site-ul public citește doar ce-i trebuie, prin funcția de la punctul 2.
-- ============================================================
insert into settings (cheie, valoare)
values ('vacanta', jsonb_build_object(
  'activ', false,          -- comutatorul propriu-zis
  'mesaj', '',             -- text liber, scris de proprietar; max 120 de caractere din interfață
  'data_activarii', null,  -- când a fost pornit ultima dată
  'activat_de', null       -- cine l-a pornit (e-mailul contului de echipă)
))
on conflict (cheie) do nothing;


-- ============================================================
-- 2. CE VEDE SITE-UL PUBLIC
--
-- Doar `activ` și `mesaj`. Fără dată, fără cine — alea rămân în admin.
-- `security definer` fiindcă rândul din `settings` nu e citibil de anon.
-- ============================================================
create or replace function public.vacanta_publica()
returns json
language sql
stable
security definer
set search_path = public
as $vp$
  select json_build_object(
    'activ', coalesce((select (valoare->>'activ')::boolean from settings where cheie = 'vacanta'), false),
    'mesaj', coalesce((select nullif(trim(valoare->>'mesaj'), '') from settings where cheie = 'vacanta'), '')
  );
$vp$;

-- ATENȚIE la `revoke`: în Postgres funcțiile primesc implicit EXECUTE pentru rolul
-- PUBLIC, iar `anon` și `authenticated` moștenesc de acolo. Revocarea doar de la
-- ele ar lăsa dreptul intact prin PUBLIC.
revoke execute on function public.vacanta_publica() from public;
grant execute on function public.vacanta_publica() to anon, authenticated;


-- ============================================================
-- 3. BLOCAREA COMENZILOR — PE SERVER
--
-- Ascunderea din interfață nu e suficientă: cine are pagina de checkout deja
-- deschisă, sau un URL de produs salvat, poate trimite un POST direct către
-- `plaseaza_comanda`. Aici e singura garanție reală.
--
-- Funcția e recopiată integral din `livrare-dupa-comanda.sql` (migrarea 12), cu
-- garda adăugată imediat după `begin`, ÎNAINTE de orice verificare sau scriere.
-- Restul e neschimbat, literă cu literă.
-- ============================================================
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
  -- Ascunderea pieselor din interfață NU e suficientă: cine are pagina de
  -- checkout deja deschisă, sau un URL de produs salvat, poate trimite un POST
  -- direct către funcția asta. Aici e singura garanție reală; restul e cosmetică.
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

grant execute on function public.plaseaza_comanda(jsonb, jsonb, text, text, text, numeric)
  to anon, authenticated;


-- ============================================================
-- 4. CE A IEȘIT
-- ============================================================
select valoare from settings where cheie = 'vacanta';
