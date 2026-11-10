-- ============================================================
-- AUTOPAS — SAGA, PASUL 4: FACTURILE ȘI NUMEROTAREA
-- Migrarea 49 (10 noiembrie 2026). Planul: docs/saga-plan.md, pasul 4 din C
-- (secțiunile A.1–A.4, A.9, A.14, A.15).
--
-- CE ATINGE DIN CE EXISTĂ — NIMIC NU SE ÎNLOCUIEȘTE:
--   · nicio funcție existentă nu e rescrisă (nici `sterge_comanda`, nici
--     `anuleaza_comanda`, nici `plaseaza_comanda`);
--   · niciun trigger nou pe tabelele existente, nicio coloană nouă pe ele;
--   · niciun rând existent nu e modificat de migrare.
--   · SINGURA legătură nouă cu ce există: cheia străină `facturi.order_id →
--     orders(id) ON DELETE RESTRICT`. Ea face ca o comandă CARE ARE FACTURĂ să
--     nu mai poată fi ștearsă — pe nicio cale, inclusiv `sterge_comanda`, care
--     se oprește atunci cu eroarea constrângerii, numită intenționat
--     „comanda_facturata_nu_se_poate_sterge”. Comenzile fără factură (adică
--     toate, azi) se șterg exact ca înainte. (Planul cerea o gardă în
--     `sterge_comanda`; cheia străină dă aceeași protecție fără să rescrie o
--     funcție din producție.)
--   · Funcțiile noi SCRIU pe `orders.factura_serie` / `factura_status` (oglinda
--     din A.9) doar când sunt chemate — migrarea însăși nu scrie nimic.
--
-- NICIO SERIE ȘI NICIUN NUMĂR FIX: seria („PAP FE”, decizia din 10 noiembrie
-- 2026) și numărul de start ajung în bază doar prin `seteaza_serie_factura`,
-- din admin, în ziua pornirii (docs/saga-plan.md, „Procedura de pornire”).
--
-- Depinde de 47 (`calculeaza_linie_tva`, `cod_judet`, `transport_facturabil`)
-- și 48 (`saga_cota_tva`). NU depinde de 46. Idempotentă.
-- Testele: scripts/verifica-saga-facturi.sql (tranzacție anulată, seria
-- „TEST …” cu nume unic). Anularea: scripts/anuleaza-saga-facturi.sql.
-- ============================================================


-- ------------------------------------------------------------
-- 1. CINE FACTUREAZĂ: adminul și contabilul (nu operatorul)
-- ------------------------------------------------------------
create or replace function public.is_facturare()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'contabil'));
$$;

comment on function public.is_facturare() is
  'Utilizatorul curent poate factura (rol admin sau contabil). Folosită de politicile și funcțiile facturilor.';

revoke execute on function public.is_facturare() from public;
revoke execute on function public.is_facturare() from anon;
grant  execute on function public.is_facturare() to authenticated, service_role;


-- ------------------------------------------------------------
-- 2. SERIILE ȘI CONTORUL LOR
--
-- Un rând pe serie; cel mult una ACTIVĂ (indexul unic parțial). `urmator` e
-- numărul pe care îl va primi următoarea factură. Fără `sequence`: o secvență
-- consumă numărul și la o tranzacție anulată, deci lasă goluri.
-- ------------------------------------------------------------
create table if not exists public.facturi_serii (
  serie         text        primary key check (serie = btrim(serie) and serie <> '' and length(serie) <= 20),
  urmator       int         not null check (urmator >= 1),
  activa        boolean     not null default false,
  actualizat_la timestamptz not null default now(),
  actualizat_de uuid
);
create unique index if not exists facturi_serii_o_singura_activa on public.facturi_serii (activa) where activa;

-- Istoricul fiecărei setări de serie: urma zilei de pornire (cine a pus ce număr, când).
create table if not exists public.facturi_serii_istoric (
  id        bigint generated always as identity primary key,
  serie     text        not null,
  urmator   int         not null,
  actiune   text        not null check (actiune in ('setare', 'retragere')),
  detalii   text,
  facut_la  timestamptz not null default now(),
  facut_de  uuid,
  facut_de_email text
);


-- ------------------------------------------------------------
-- 3. FACTURA — documentul, cu COPIA datelor din momentul emiterii
-- ------------------------------------------------------------
create table if not exists public.facturi (
  id               bigint generated always as identity primary key,   -- GUID_factura spre SAGA
  tip              text        not null default 'factura' check (tip in ('factura', 'storno')),
  storno_pentru    bigint      references public.facturi (id),
  order_id         bigint      not null,
  serie            text        not null,
  numar            int         not null check (numar >= 1),
  data             date        not null,
  scadenta         date,
  regim_tva        text        not null check (regim_tva in ('normal', 'marja')),
  preturi_cu_tva   boolean     not null default true,
  client           jsonb       not null,
  furnizor         jsonb       not null,
  mentiune_plata   text,
  observatii       text,
  total_fara_tva   numeric(12,2) not null default 0,
  total_tva        numeric(12,2) not null default 0,
  total            numeric(12,2) not null default 0,
  saga_status      text        not null default 'de_trimis'
                     check (saga_status in ('de_trimis', 'in_curs', 'trimisa', 'eroare', 'confirmata')),
  saga_eroare      text,
  saga_trimisa_la  timestamptz,
  confirmata_la    timestamptz,
  confirmata_de    uuid,
  emisa_de         uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint facturi_serie_numar_unic unique (serie, numar),
  constraint facturi_storno_are_sursa check ((tip = 'storno') = (storno_pentru is not null)),
  -- Numele ajunge în mesajul de eroare al oricui încearcă să șteargă o comandă
  -- facturată (inclusiv prin `sterge_comanda`), deci spune singur ce s-a întâmplat.
  constraint comanda_facturata_nu_se_poate_sterge
    foreign key (order_id) references public.orders (id) on delete restrict
);
create index if not exists facturi_order_idx on public.facturi (order_id);
create index if not exists facturi_status_idx on public.facturi (saga_status);
-- Cel mult un storno pe factură.
create unique index if not exists facturi_un_storno on public.facturi (storno_pentru) where storno_pentru is not null;

-- Liniile: copia pieselor. `order_item_id` și `product_id` sunt doar URMĂ, FĂRĂ
-- cheie străină: o piesă ștearsă din catalog nu are voie să atingă o factură
-- (iar după trimitere triggerul de mai jos ar refuza oricum modificarea).
create table if not exists public.facturi_linii (
  id               bigint generated always as identity primary key,
  factura_id       bigint      not null references public.facturi (id) on delete cascade,
  nr_crt           int         not null,
  tip              text        not null check (tip in ('piesa', 'reducere', 'transport')),
  order_item_id    bigint,
  product_id       bigint,
  cod_intern       text,                      -- AP-000123 → GUID_cod_articol
  denumire_site    text        not null,      -- numele de pe site → InformatiiSuplimentare
  cod_articol_saga text        not null,      -- CodArticolClient
  descriere        text        not null,      -- Descriere: articolul din gestiune
  um               text        not null default 'BUC',
  cantitate        numeric(12,3) not null,
  pret_cu_tva      numeric(12,2) not null,
  pret_fara_tva    numeric(12,4) not null,
  valoare          numeric(12,2) not null,
  cota_tva         numeric(5,2)  not null,
  tva              numeric(12,2) not null,
  total            numeric(12,2) not null,
  constraint facturi_linii_nr_unic unique (factura_id, nr_crt)
);


-- ------------------------------------------------------------
-- 4. NEMODIFICABIL DUPĂ TRIMITERE — garantat în bază, nu în interfață
--
-- După ce factura a plecat spre SAGA (`in_curs`, `trimisa`, `confirmata`) se pot
-- schimba DOAR coloanele de stare, iar starea merge doar înainte
-- (trimisa → confirmata). Identitatea facturii (serie, număr, comandă, tip) nu
-- se schimbă niciodată. Ștergerea e permisă doar înainte de trimitere.
-- ------------------------------------------------------------
create or replace function public.facturi_pazeste()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  stare_coloane constant text[] := array['saga_status', 'saga_eroare', 'saga_trimisa_la',
                                         'confirmata_la', 'confirmata_de', 'updated_at'];
begin
  if tg_op = 'DELETE' then
    if old.saga_status <> 'de_trimis' then
      raise exception 'Factura % % a plecat deja spre SAGA (stare: %) — nu se mai șterge. Se stornează.',
        old.serie, old.numar, old.saga_status;
    end if;
    return old;
  end if;

  if (new.id, new.tip, new.storno_pentru, new.order_id, new.serie, new.numar)
     is distinct from (old.id, old.tip, old.storno_pentru, old.order_id, old.serie, old.numar) then
    raise exception 'Seria, numărul, comanda și tipul unei facturi nu se schimbă niciodată (factura % %).',
      old.serie, old.numar;
  end if;

  if old.saga_status in ('in_curs', 'trimisa', 'confirmata') then
    if (to_jsonb(new) - stare_coloane) is distinct from (to_jsonb(old) - stare_coloane) then
      raise exception 'Factura % % a plecat spre SAGA (stare: %): conținutul ei nu se mai modifică. Corecturile se fac în SAGA, iar în aplicație rămâne stornarea.',
        old.serie, old.numar, old.saga_status;
    end if;
    if old.saga_status = 'confirmata' and new.saga_status <> 'confirmata' then
      raise exception 'Factura % % e confirmată în SAGA; starea ei nu mai poate da înapoi.', old.serie, old.numar;
    end if;
    if old.saga_status = 'trimisa' and new.saga_status not in ('trimisa', 'confirmata') then
      raise exception 'Factura % % e trimisă în SAGA; poate trece doar în „confirmata”.', old.serie, old.numar;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists facturi_pazeste on public.facturi;
create trigger facturi_pazeste before update or delete on public.facturi
  for each row execute function public.facturi_pazeste();

-- Liniile urmează starea facturii-părinte: se scriu doar cât e `de_trimis` sau
-- `eroare`. Părinte negăsit = e chiar în curs de ștergere (cascada de la o
-- retragere permisă), deci se lasă.
create or replace function public.facturi_linii_pazeste()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_stare text;
  v_id    bigint := case when tg_op = 'DELETE' then old.factura_id else new.factura_id end;
begin
  if tg_op = 'UPDATE' and new.factura_id is distinct from old.factura_id then
    raise exception 'O linie de factură nu se mută pe altă factură.';
  end if;
  select f.saga_status into v_stare from public.facturi f where f.id = v_id;
  if v_stare is not null and v_stare not in ('de_trimis', 'eroare') then
    raise exception 'Factura a plecat spre SAGA (stare: %): liniile ei nu se mai modifică.', v_stare;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists facturi_linii_pazeste on public.facturi_linii;
create trigger facturi_linii_pazeste before insert or update or delete on public.facturi_linii
  for each row execute function public.facturi_linii_pazeste();

revoke execute on function public.facturi_pazeste() from public;
revoke execute on function public.facturi_linii_pazeste() from public;


-- ------------------------------------------------------------
-- 5. SERIA ȘI NUMĂRUL DE START
--
-- Creează seria dacă nu există, o face ACTIVĂ (le dezactivează pe celelalte) și
-- pune numărul următor. Refuză un număr ≤ cel mai mare emis deja în seria aceea.
-- Confirmarea „ultima factură manuală are numărul X și facturarea manuală s-a
-- oprit” o cere interfața (Facturi → Setări serie), înainte de apel.
-- ------------------------------------------------------------
create or replace function public.seteaza_serie_factura(p_serie text, p_urmator int)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_serie text := btrim(coalesce(p_serie, ''));
  v_max   int;
begin
  if not public.is_facturare() then
    raise exception 'Doar administratorul sau contabilul pot seta seria facturilor.';
  end if;
  if v_serie = '' or length(v_serie) > 20 then
    raise exception 'Seria trebuie să aibă între 1 și 20 de caractere.';
  end if;
  if p_urmator is null or p_urmator < 1 then
    raise exception 'Numărul următor trebuie să fie cel puțin 1.';
  end if;

  -- Blochează toate seriile: o emitere în curs (care ține rândul seriei active)
  -- se termină întâi, apoi se schimbă seria.
  perform 1 from public.facturi_serii for update;

  select max(numar) into v_max from public.facturi where serie = v_serie;
  if v_max is not null and p_urmator <= v_max then
    raise exception 'Numărul % e deja folosit: ultima factură emisă din aplicație pe seria „%” are numărul %. Numărul următor trebuie să fie cel puțin %.',
      p_urmator, v_serie, v_max, v_max + 1;
  end if;

  update public.facturi_serii set activa = false where activa and serie <> v_serie;
  insert into public.facturi_serii (serie, urmator, activa, actualizat_la, actualizat_de)
  values (v_serie, p_urmator, true, now(), auth.uid())
  on conflict (serie) do update
    set urmator = excluded.urmator, activa = true,
        actualizat_la = excluded.actualizat_la, actualizat_de = excluded.actualizat_de;

  insert into public.facturi_serii_istoric (serie, urmator, actiune, detalii, facut_de, facut_de_email)
  values (v_serie, p_urmator, 'setare',
          'Seria activă; următoarea factură primește numărul ' || p_urmator,
          auth.uid(), auth.jwt() ->> 'email');

  return json_build_object('ok', true, 'serie', v_serie, 'urmator', p_urmator);
end;
$$;

comment on function public.seteaza_serie_factura(text, int) is
  'Face seria activă și îi pune numărul următor. Refuză un număr deja folosit. Doar admin/contabil.';


-- ------------------------------------------------------------
-- 6. EMITEREA FACTURII
--
-- O singură tranzacție: dacă orice pas pică, se anulează TOT, inclusiv
-- incrementul contorului — deci nu rămâne niciun gol în numerotare. Două
-- emiteri simultane se așteaptă una pe alta la rândul seriei (`for update`).
-- ------------------------------------------------------------
create or replace function public.emite_factura(p_order_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  o          public.orders%rowtype;
  v_saga     jsonb;
  v_firma    jsonb;
  v_start_t  text;
  v_start    date;
  v_azi      date := (now() at time zone 'Europe/Bucharest')::date;
  v_plasata  date;
  v_cota     numeric;
  v_regim    text;
  v_serie    text;
  v_numar    int;
  v_art_cod  text;  v_art_den  text;  v_art_um text;
  v_red_cod  text;  v_red_den  text;
  v_tr_cod   text;  v_tr_den   text;
  v_cod_jud  text;
  v_fur_jud  text;
  v_id       bigint;
  v_nr       int := 0;
  v_transport numeric;
  i          record;
  t          record;
begin
  if not public.is_facturare() then
    raise exception 'Doar administratorul sau contabilul pot emite facturi.';
  end if;

  -- 1. Comanda, blocată: două emiteri pe aceeași comandă nu trec amândouă de verificarea de mai jos.
  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Comanda % nu există.', p_order_id;
  end if;
  if o.status = 'anulata' then
    raise exception 'Comanda % e anulată — nu se facturează.', o.numar;
  end if;
  if exists (select 1 from public.facturi f
              where f.order_id = o.id and f.tip = 'factura'
                and not exists (select 1 from public.facturi s where s.storno_pentru = f.id)) then
    raise exception 'Comanda % are deja o factură (nestornată).', o.numar;
  end if;
  if not exists (select 1 from public.order_items where order_id = o.id) then
    raise exception 'Comanda % nu are nicio piesă.', o.numar;
  end if;

  select valoare -> 'saga' into v_saga from public.settings where cheie = 'integrari';
  v_saga := coalesce(v_saga, '{}'::jsonb);

  -- 1b. Data de start a facturării (regula din 10 noiembrie 2026): comenzile de
  -- dinainte au fost facturate manual în SAGA și NU se facturează de aici.
  v_start_t := btrim(coalesce(v_saga ->> 'data_start_facturare', ''));
  if v_start_t = '' then
    raise exception 'Data de start a facturării nu e setată (Admin → Integrări → Saga). Până atunci nu se emite nicio factură din aplicație; comenzile se facturează manual în SAGA.';
  end if;
  begin
    if v_start_t !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'format'; end if;
    v_start := v_start_t::date;
  exception when others then
    raise exception 'Data de start a facturării „%” nu e o dată validă (AAAA-LL-ZZ).', v_start_t;
  end;
  v_plasata := (o.created_at at time zone 'Europe/Bucharest')::date;
  if v_plasata < v_start then
    raise exception 'Comanda % a fost plasată pe %, înainte de data de start a facturării (%). Comenzile de dinainte se facturează manual în SAGA, nu din aplicație.',
      o.numar, to_char(v_plasata, 'DD.MM.YYYY'), to_char(v_start, 'DD.MM.YYYY');
  end if;

  -- 2. Seria activă, blocată până la sfârșitul tranzacției.
  select serie, urmator into v_serie, v_numar from public.facturi_serii where activa for update;
  if not found then
    raise exception 'Seria facturilor nu e configurată. Setați seria și numărul de start în Facturi → Setări serie, în ziua pornirii, după ultima factură manuală.';
  end if;

  -- 3. TVA: cota și regimul din setări (refuză valori greșite și regimul marjă).
  v_cota  := public.saga_cota_tva();
  v_regim := 'normal';

  -- 4. Articolele din gestiunea SAGA. Codul articolului implicit e obligatoriu.
  v_art_cod := btrim(coalesce(v_saga ->> 'articol_implicit', ''));
  v_art_den := btrim(coalesce(v_saga ->> 'articol_implicit_denumire', ''));
  v_art_um  := coalesce(nullif(btrim(coalesce(v_saga ->> 'articol_implicit_um', '')), ''), 'BUC');
  if v_art_cod = '' or v_art_den = '' then
    raise exception 'Articolul implicit din gestiunea SAGA (cod și denumire) nu e setat în Admin → Integrări → Saga. Codul îl dă contabila.';
  end if;
  v_red_cod := coalesce(nullif(btrim(coalesce(v_saga ->> 'articol_reducere', '')), ''), v_art_cod);
  v_red_den := case when v_red_cod = v_art_cod then v_art_den
                    else coalesce(nullif(btrim(coalesce(v_saga ->> 'articol_reducere_denumire', '')), ''), v_art_den) end;
  v_tr_cod  := coalesce(nullif(btrim(coalesce(v_saga ->> 'articol_transport', '')), ''), v_art_cod);
  v_tr_den  := case when v_tr_cod = v_art_cod then v_art_den
                    else coalesce(nullif(btrim(coalesce(v_saga ->> 'articol_transport_denumire', '')), ''), v_art_den) end;

  -- 5. Furnizorul: copia datelor firmei din Admin → Setări.
  select valoare into v_firma from public.settings where cheie = 'firma';
  v_firma := coalesce(v_firma, '{}'::jsonb);
  if btrim(coalesce(v_firma ->> 'denumire', '')) = '' or btrim(coalesce(v_firma ->> 'cui', '')) = ''
     or btrim(coalesce(v_firma ->> 'reg_com', '')) = '' or btrim(coalesce(v_firma ->> 'adresa', '')) = ''
     or btrim(coalesce(v_firma ->> 'iban', '')) = '' then
    raise exception 'Datele firmei sunt incomplete (denumire, CUI, Reg. Com., adresă, IBAN) — Admin → Setări → Date firmă.';
  end if;
  v_fur_jud := public.cod_judet(v_firma ->> 'judet');

  -- 6. Clientul: copia din comandă. Județul trebuie recunoscut (SAGA cere codul).
  v_cod_jud := public.cod_judet(o.judet);
  if v_cod_jud is null then
    raise exception 'Județul „%” al comenzii % nu e recunoscut — corectați-l în comandă.', o.judet, o.numar;
  end if;

  -- 7. Documentul.
  insert into public.facturi (order_id, serie, numar, data, scadenta, regim_tva, preturi_cu_tva,
                              client, furnizor, mentiune_plata, observatii, emisa_de)
  values (o.id, v_serie, v_numar, v_azi, v_azi, v_regim, true,
          jsonb_build_object(
            'tip', o.tip_client, 'nume', o.nume, 'firma', o.firma, 'cui', o.cui,
            'adresa', o.adresa, 'localitate', o.oras, 'judet', o.judet, 'cod_judet', v_cod_jud,
            'tara', 'RO', 'email', o.email, 'telefon', o.telefon),
          v_firma || jsonb_build_object('cod_judet', v_fur_jud),
          nullif(btrim(coalesce(v_saga ->> 'mentiune_plata', '')), ''),
          'Comanda ' || o.numar,
          auth.uid())
  returning id into v_id;

  -- 8. Liniile: piesele, apoi reducerea (linie negativă), apoi transportul facturabil.
  for i in
    select oi.id, oi.product_id, oi.nume, oi.pret, oi.cantitate, p.cod_intern
      from public.order_items oi left join public.products p on p.id = oi.product_id
     where oi.order_id = o.id
     order by oi.id
  loop
    v_nr := v_nr + 1;
    select * into t from public.calculeaza_linie_tva(i.pret, i.cantitate, v_cota);
    insert into public.facturi_linii (factura_id, nr_crt, tip, order_item_id, product_id, cod_intern,
                                      denumire_site, cod_articol_saga, descriere, um, cantitate,
                                      pret_cu_tva, pret_fara_tva, valoare, cota_tva, tva, total)
    values (v_id, v_nr, 'piesa', i.id, i.product_id, i.cod_intern,
            i.nume, v_art_cod, v_art_den, v_art_um, i.cantitate,
            i.pret, t.pret_fara_tva, t.valoare, v_cota, t.tva, t.total);
  end loop;

  if coalesce(o.discount_valoare, 0) > 0 then
    v_nr := v_nr + 1;
    select * into t from public.calculeaza_linie_tva(-o.discount_valoare, 1, v_cota);
    insert into public.facturi_linii (factura_id, nr_crt, tip, denumire_site, cod_articol_saga, descriere, um,
                                      cantitate, pret_cu_tva, pret_fara_tva, valoare, cota_tva, tva, total)
    values (v_id, v_nr, 'reducere',
            'Reducere' || coalesce(' cod ' || nullif(o.discount_cod, ''), ''),
            v_red_cod, v_red_den, v_art_um, 1, -o.discount_valoare, t.pret_fara_tva, t.valoare, v_cota, t.tva, t.total);
  end if;

  v_transport := public.transport_facturabil(o.subtotal, o.discount_valoare, o.livrare, o.total);
  if v_transport > 0 then
    v_nr := v_nr + 1;
    select * into t from public.calculeaza_linie_tva(v_transport, 1, v_cota);
    insert into public.facturi_linii (factura_id, nr_crt, tip, denumire_site, cod_articol_saga, descriere, um,
                                      cantitate, pret_cu_tva, pret_fara_tva, valoare, cota_tva, tva, total)
    values (v_id, v_nr, 'transport', 'Transport', v_tr_cod, v_tr_den, v_art_um,
            1, v_transport, t.pret_fara_tva, t.valoare, v_cota, t.tva, t.total);
  end if;

  update public.facturi f
     set total_fara_tva = s.v, total_tva = s.t, total = s.tot
    from (select sum(valoare) v, sum(tva) t, sum(total) tot from public.facturi_linii where factura_id = v_id) s
   where f.id = v_id;

  -- 9. Contorul: abia acum, în aceeași tranzacție.
  update public.facturi_serii set urmator = v_numar + 1, actualizat_la = now() where serie = v_serie;

  -- 10. Oglinda pe comandă (A.9) + jurnalul comenzii.
  update public.orders set factura_serie = v_serie || ' ' || v_numar, factura_status = 'emisa' where id = o.id;
  insert into public.order_events (order_id, tip, mesaj, autor)
  values (o.id, 'factura', 'Factură emisă din aplicație: ' || v_serie || ' ' || v_numar || ' (de trimis în SAGA)',
          coalesce(auth.jwt() ->> 'email', 'sistem'));

  return json_build_object('ok', true, 'id', v_id, 'serie', v_serie, 'numar', v_numar,
                           'total', (select total from public.facturi where id = v_id));
end;
$$;

comment on function public.emite_factura(bigint) is
  'Emite factura unei comenzi: număr din seria activă (fără goluri), copia clientului, furnizorului și liniilor, TVA cu calculeaza_linie_tva. Refuză comenzile dinaintea data_start_facturare. Doar admin/contabil.';


-- ------------------------------------------------------------
-- 7. RETRAGEREA UNEI FACTURI NETRIMISE
--
-- Singurul fel în care un număr „dispare”: doar ULTIMA factură din serie, doar
-- netrimisă — iar contorul dă înapoi, deci numărul se refolosește și nu rămâne gol.
-- ------------------------------------------------------------
create or replace function public.retrage_factura(p_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  f       public.facturi%rowtype;
  v_urm   int;
begin
  if not public.is_facturare() then
    raise exception 'Doar administratorul sau contabilul pot retrage facturi.';
  end if;
  select * into f from public.facturi where id = p_id for update;
  if not found then
    raise exception 'Factura % nu există.', p_id;
  end if;
  if f.saga_status <> 'de_trimis' then
    raise exception 'Factura % % a plecat spre SAGA (stare: %) — nu se mai retrage; se stornează.', f.serie, f.numar, f.saga_status;
  end if;
  if f.tip <> 'factura' then
    raise exception 'Doar facturile se retrag, nu stornările.';
  end if;
  select urmator into v_urm from public.facturi_serii where serie = f.serie for update;
  if v_urm is null or f.numar <> v_urm - 1 then
    raise exception 'Doar ultima factură din seria „%” se poate retrage (ultima are numărul %). Factura % se corectează înainte de trimitere sau se stornează după.',
      f.serie, coalesce(v_urm - 1, 0), f.numar;
  end if;

  delete from public.facturi where id = f.id;                              -- liniile, în cascadă
  update public.facturi_serii set urmator = f.numar, actualizat_la = now() where serie = f.serie;
  insert into public.facturi_serii_istoric (serie, urmator, actiune, detalii, facut_de, facut_de_email)
  values (f.serie, f.numar, 'retragere', 'Factura ' || f.serie || ' ' || f.numar || ' retrasă înainte de trimitere',
          auth.uid(), auth.jwt() ->> 'email');
  update public.orders set factura_serie = null, factura_status = 'de_emis' where id = f.order_id;
  insert into public.order_events (order_id, tip, mesaj, autor)
  values (f.order_id, 'factura', 'Factura ' || f.serie || ' ' || f.numar || ' retrasă înainte de trimiterea în SAGA (numărul se refolosește)',
          coalesce(auth.jwt() ->> 'email', 'sistem'));

  return json_build_object('ok', true, 'serie', f.serie, 'numar', f.numar);
end;
$$;

comment on function public.retrage_factura(bigint) is
  'Șterge ULTIMA factură din serie, doar dacă e netrimisă, și dă contorul înapoi (fără gol). Doar admin/contabil.';

revoke execute on function public.seteaza_serie_factura(text, int) from public;
revoke execute on function public.seteaza_serie_factura(text, int) from anon;
revoke execute on function public.emite_factura(bigint)            from public;
revoke execute on function public.emite_factura(bigint)            from anon;
revoke execute on function public.retrage_factura(bigint)          from public;
revoke execute on function public.retrage_factura(bigint)          from anon;
grant  execute on function public.seteaza_serie_factura(text, int) to authenticated, service_role;
grant  execute on function public.emite_factura(bigint)            to authenticated, service_role;
grant  execute on function public.retrage_factura(bigint)          to authenticated, service_role;


-- ------------------------------------------------------------
-- 8. RLS: citire doar pentru admin/contabil; scriere DOAR prin funcțiile de mai sus
-- ------------------------------------------------------------
alter table public.facturi               enable row level security;
alter table public.facturi_linii         enable row level security;
alter table public.facturi_serii         enable row level security;
alter table public.facturi_serii_istoric enable row level security;

drop policy if exists "facturi citire"        on public.facturi;
drop policy if exists "facturi linii citire"  on public.facturi_linii;
drop policy if exists "facturi serii citire"  on public.facturi_serii;
drop policy if exists "facturi istoric citire" on public.facturi_serii_istoric;
create policy "facturi citire"         on public.facturi               for select using (public.is_facturare());
create policy "facturi linii citire"   on public.facturi_linii         for select using (public.is_facturare());
create policy "facturi serii citire"   on public.facturi_serii         for select using (public.is_facturare());
create policy "facturi istoric citire" on public.facturi_serii_istoric for select using (public.is_facturare());

-- Pe Supabase, tabelele noi primesc implicit drepturi depline pentru `anon` și
-- `authenticated`; RLS fără politici de scriere le blochează oricum, dar le
-- scoatem și explicit.
revoke all on public.facturi, public.facturi_linii, public.facturi_serii, public.facturi_serii_istoric from anon;
revoke insert, update, delete, truncate on public.facturi, public.facturi_linii, public.facturi_serii, public.facturi_serii_istoric from authenticated;
grant select on public.facturi, public.facturi_linii, public.facturi_serii, public.facturi_serii_istoric to authenticated;

comment on table public.facturi is 'Facturile emise din aplicație (spre SAGA). Copia datelor din momentul emiterii; nemodificabile după trimitere. Planul: docs/saga-plan.md.';
comment on table public.facturi_linii is 'Liniile facturilor: copia pieselor, reducerii și transportului, cu TVA calculat la emitere.';
comment on table public.facturi_serii is 'Seriile facturilor și numărul următor. Cel mult una activă. Se setează doar prin seteaza_serie_factura.';
comment on table public.facturi_serii_istoric is 'Istoricul setărilor de serie și al retragerilor: cine, când, ce număr.';
