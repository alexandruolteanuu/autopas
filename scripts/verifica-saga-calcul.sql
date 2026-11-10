-- ============================================================
-- VERIFICĂRILE PASULUI 1 SAGA (migrarea 47, supabase/saga-calcul.sql)
--
-- Se rulează după migrarea 47, din Supabase → SQL Editor: lipești tot fișierul → Run.
-- Merge și pe PRODUCȚIE (decizia din 10 noiembrie 2026: fără bază de test).
--
-- NU LASĂ NIMIC ÎN BAZĂ, prin construcție:
--   · nu scrie nimic — doar citește `judete_coduri` și cheamă funcții de calcul;
--   · totul stă între BEGIN și ROLLBACK;
--   · și, mai ales, blocul se termină ÎNTOTDEAUNA cu o eroare, iar o eroare
--     anulează tot ce s-a făcut în tranzacție. Chiar dacă cineva ar adăuga
--     mâine o scriere aici, ea n-ar supraviețui.
--
-- CUM CITEȘTI REZULTATUL — apare ÎNTOTDEAUNA ca „eroare” (căsuța roșie):
--   · reușită:  „REZULTAT OK: toate cele 33 de verificări au trecut …”
--   · eșec:     „VERIFICARE PICATĂ: …” — ce s-a așteptat și ce s-a primit.
-- Altă eroare (de ex. „function … does not exist”) = migrarea 47 nu e rulată.
-- ============================================================

begin;

do $$
declare
  n int := 0;          -- câte verificări au trecut
  r record;
  s record;
  c text;
  v_err boolean;
  i int;
  p numeric;
  q int;
begin
  -- ----------------------------------------------------------
  -- A. CAZUL DE REFERINȚĂ, DE PE FACTURA REALĂ DIN SAGA
  --    200,00 cu TVA, 21%, cantitate 1 → 165,2900 / 165,29 / 34,71 / 200,00
  -- ----------------------------------------------------------
  select * into r from public.calculeaza_linie_tva(200.00, 1, 21);
  if (r.pret_fara_tva, r.valoare, r.tva, r.total) is distinct from (165.2900, 165.29, 34.71, 200.00) then
    raise exception 'VERIFICARE PICATĂ: referința 200,00 → aștept 165.2900/165.29/34.71/200.00, am primit %/%/%/%',
      r.pret_fara_tva, r.valoare, r.tva, r.total;
  end if;
  -- Prețul unitar trebuie să aibă exact 4 zecimale („165.2900”), ca pe factură.
  if r.pret_fara_tva::text <> '165.2900' then
    raise exception 'VERIFICARE PICATĂ: prețul unitar se scrie „%”, aștept „165.2900”', r.pret_fara_tva::text;
  end if;
  if r.valoare::text <> '165.29' or r.tva::text <> '34.71' or r.total::text <> '200.00' then
    raise exception 'VERIFICARE PICATĂ: valorile nu au 2 zecimale: % / % / %', r.valoare, r.tva, r.total;
  end if;
  n := n + 2;

  -- Stornarea lui: cantitate −1 → exact opusul, prețul unitar rămâne pozitiv.
  select * into r from public.calculeaza_linie_tva(200.00, -1, 21);
  if (r.pret_fara_tva, r.valoare, r.tva, r.total) is distinct from (165.2900, -165.29, -34.71, -200.00) then
    raise exception 'VERIFICARE PICATĂ: storno 200,00 → aștept 165.2900/-165.29/-34.71/-200.00, am primit %/%/%/%',
      r.pret_fara_tva, r.valoare, r.tva, r.total;
  end if;
  n := n + 1;

  -- ----------------------------------------------------------
  -- B. ALTE CAZURI FIXE
  -- ----------------------------------------------------------
  select * into r from public.calculeaza_linie_tva(350, 1, 21);
  if (r.pret_fara_tva, r.valoare, r.tva, r.total) is distinct from (289.2600, 289.26, 60.74, 350.00) then
    raise exception 'VERIFICARE PICATĂ: 350 → am primit %/%/%/%', r.pret_fara_tva, r.valoare, r.tva, r.total;
  end if;
  n := n + 1;

  -- Cel mai mic preț posibil: un ban. Baza rotunjită la 0,01, TVA 0.
  select * into r from public.calculeaza_linie_tva(0.01, 1, 21);
  if (r.pret_fara_tva, r.valoare, r.tva, r.total) is distinct from (0.0100, 0.01, 0.00, 0.01) then
    raise exception 'VERIFICARE PICATĂ: 0,01 → am primit %/%/%/%', r.pret_fara_tva, r.valoare, r.tva, r.total;
  end if;
  n := n + 1;

  -- Cantitate peste 1: 99,99 × 3 = 299,97 → bază 247,91, TVA 52,06, unitar 82,6367.
  select * into r from public.calculeaza_linie_tva(99.99, 3, 21);
  if (r.pret_fara_tva, r.valoare, r.tva, r.total) is distinct from (82.6367, 247.91, 52.06, 299.97) then
    raise exception 'VERIFICARE PICATĂ: 99,99 × 3 → am primit %/%/%/%', r.pret_fara_tva, r.valoare, r.tva, r.total;
  end if;
  n := n + 1;

  -- Jumătatea de ban se rotunjește DEPARTE DE ZERO, în ambele sensuri.
  -- (Cu 21%, baza nu poate cădea exact pe jumătate de ban dintr-un total cu 2
  --  zecimale — 121 și 1000 sunt prime între ele — deci jumătatea se testează
  --  la total, cu un preț de 3 zecimale.)
  select * into r from public.calculeaza_linie_tva(0.125, 1, 21);
  if r.total <> 0.13 then
    raise exception 'VERIFICARE PICATĂ: 0,125 trebuie rotunjit la 0,13, am primit %', r.total;
  end if;
  select * into r from public.calculeaza_linie_tva(0.125, -1, 21);
  if r.total <> -0.13 then
    raise exception 'VERIFICARE PICATĂ: −0,125 trebuie rotunjit la −0,13, am primit %', r.total;
  end if;
  n := n + 2;

  -- Cota 0: baza = totalul, TVA 0.
  select * into r from public.calculeaza_linie_tva(100, 2, 0);
  if (r.pret_fara_tva, r.valoare, r.tva, r.total) is distinct from (100.0000, 200.00, 0.00, 200.00) then
    raise exception 'VERIFICARE PICATĂ: cota 0 → am primit %/%/%/%', r.pret_fara_tva, r.valoare, r.tva, r.total;
  end if;
  n := n + 1;

  -- ----------------------------------------------------------
  -- C. 10.000 DE PREȚURI: invarianții regulii
  --    1. valoare + tva = total, la ban
  --    2. storno = exact opusul (valoare, tva, total), același preț unitar
  --    3. TVA-ul prin diferență e la cel mult 1 ban de cel calculat direct
  --    4. toate au 2 zecimale, prețul unitar 4
  -- ----------------------------------------------------------
  for i in 1..10000 loop
    p := round(((i * 7.13) % 5000)::numeric + 0.01, 2);   -- prețuri deterministe, 0,01 … 5.000
    q := 1 + (i % 4);                                       -- cantități 1 … 4
    select * into r from public.calculeaza_linie_tva(p, q, 21);
    select * into s from public.calculeaza_linie_tva(p, -q, 21);

    if r.valoare + r.tva <> r.total or r.total <> round(p * q, 2) then
      raise exception 'VERIFICARE PICATĂ: % × %: valoare % + tva % ≠ total %', p, q, r.valoare, r.tva, r.total;
    end if;
    if s.valoare <> -r.valoare or s.tva <> -r.tva or s.total <> -r.total or s.pret_fara_tva <> r.pret_fara_tva then
      raise exception 'VERIFICARE PICATĂ: storno % × %: % / % / % față de % / % / %',
        p, q, s.valoare, s.tva, s.total, r.valoare, r.tva, r.total;
    end if;
    if abs(r.tva - round(r.total - r.total / 1.21, 2)) > 0.01 then
      raise exception 'VERIFICARE PICATĂ: % × %: TVA % prea departe de calculul direct', p, q, r.tva;
    end if;
    if scale(r.valoare) <> 2 or scale(r.tva) <> 2 or scale(r.total) <> 2 or scale(r.pret_fara_tva) <> 4 then
      raise exception 'VERIFICARE PICATĂ: % × %: zecimale greșite (%, %, %, %)',
        p, q, scale(r.valoare), scale(r.tva), scale(r.total), scale(r.pret_fara_tva);
    end if;
  end loop;
  n := n + 4;

  -- ----------------------------------------------------------
  -- D. INTRĂRI GREȘITE — trebuie refuzate, nu calculate
  -- ----------------------------------------------------------
  begin
    perform public.calculeaza_linie_tva(100, 0, 21); v_err := false;
  exception when others then v_err := true; end;
  if not v_err then raise exception 'VERIFICARE PICATĂ: cantitatea 0 trebuia refuzată'; end if;

  begin
    perform public.calculeaza_linie_tva(100, 1, null); v_err := false;
  exception when others then v_err := true; end;
  if not v_err then raise exception 'VERIFICARE PICATĂ: cota lipsă trebuia refuzată'; end if;

  begin
    perform public.calculeaza_linie_tva(100, 1, 121); v_err := false;
  exception when others then v_err := true; end;
  if not v_err then raise exception 'VERIFICARE PICATĂ: cota 121 trebuia refuzată'; end if;

  begin
    perform public.calculeaza_linie_tva(100, 1, -5); v_err := false;
  exception when others then v_err := true; end;
  if not v_err then raise exception 'VERIFICARE PICATĂ: cota negativă trebuia refuzată'; end if;
  n := n + 4;

  -- ----------------------------------------------------------
  -- E. JUDEȚELE
  -- ----------------------------------------------------------
  if (select count(*) from public.judete_coduri) <> 42 then
    raise exception 'VERIFICARE PICATĂ: aștept 42 de județe, sunt %', (select count(*) from public.judete_coduri);
  end if;
  if (select count(distinct cheie) from public.judete_coduri) <> 42 then
    raise exception 'VERIFICARE PICATĂ: două județe au aceeași cheie de căutare';
  end if;
  n := n + 2;

  -- Fiecare județ, după numele lui exact, după numele fără diacritice, cu
  -- majuscule, cu spațiu în loc de cratimă, și după codul lui.
  for r in select cod, nume from public.judete_coduri loop
    if public.cod_judet(r.nume) is distinct from r.cod then
      raise exception 'VERIFICARE PICATĂ: „%” → %, aștept %', r.nume, public.cod_judet(r.nume), r.cod;
    end if;
    if public.cod_judet(public.text_cautare(r.nume)) is distinct from r.cod then
      raise exception 'VERIFICARE PICATĂ: „%” fără diacritice → %', public.text_cautare(r.nume), public.cod_judet(public.text_cautare(r.nume));
    end if;
    if public.cod_judet(upper(r.nume)) is distinct from r.cod then
      raise exception 'VERIFICARE PICATĂ: „%” → %', upper(r.nume), public.cod_judet(upper(r.nume));
    end if;
    if public.cod_judet(replace(r.nume, '-', ' ')) is distinct from r.cod then
      raise exception 'VERIFICARE PICATĂ: „%” → %', replace(r.nume, '-', ' '), public.cod_judet(replace(r.nume, '-', ' '));
    end if;
    if public.cod_judet(lower(r.cod)) is distinct from r.cod then
      raise exception 'VERIFICARE PICATĂ: codul „%” → %', lower(r.cod), public.cod_judet(lower(r.cod));
    end if;
  end loop;
  n := n + 5;

  -- Forme reale care pot veni din adrese.
  for r in select * from (values
      ('Neamț', 'NT'), ('Neamt', 'NT'), ('NEAMȚ', 'NT'), ('  neamt  ', 'NT'),
      ('Neamţ', 'NT'),                                  -- sedilă
      ('Constanţa', 'CT'), ('Iaşi', 'IS'), ('Timiş', 'TM'), ('Argeş', 'AG'),
      ('Bistrita Nasaud', 'BN'), ('bistrita-nasaud', 'BN'), ('Caras Severin', 'CS'),
      ('Satu-Mare', 'SM'), ('satumare', 'SM'),
      ('Jud. Neamț', 'NT'), ('jud neamt', 'NT'), ('Județul Neamț', 'NT'), ('Judetul Neamt', 'NT'),
      ('Bucuresti', 'B'), ('București', 'B'), ('Municipiul București', 'B'), ('Mun. Bucuresti', 'B'),
      ('Sector 3', 'B'), ('sectorul 6', 'B'), ('SECTOR1', 'B'),
      ('Ilfov', 'IF'), ('Dâmbovița', 'DB'), ('Dambovita', 'DB'), ('Vâlcea', 'VL'), ('Valcea', 'VL')
    ) as t(intrare, asteptat)
  loop
    c := public.cod_judet(r.intrare);
    if c is distinct from r.asteptat then
      raise exception 'VERIFICARE PICATĂ: „%” → %, aștept %', r.intrare, coalesce(c, 'NULL'), r.asteptat;
    end if;
  end loop;
  n := n + 1;

  -- Ce nu e județ → NULL, niciodată o ghicire.
  for r in select * from (values ('Atlantis'), (''), ('   '), ('Sector 7'), ('Neam'), ('XX'), ('Piatra Neamț')) as t(intrare) loop
    c := public.cod_judet(r.intrare);
    if c is not null then
      raise exception 'VERIFICARE PICATĂ: „%” trebuia să dea NULL, a dat %', r.intrare, c;
    end if;
  end loop;
  if public.cod_judet(null) is not null then
    raise exception 'VERIFICARE PICATĂ: NULL trebuia să dea NULL';
  end if;
  n := n + 1;

  -- ----------------------------------------------------------
  -- F. TRANSPORTUL FACTURABIL
  --    argumente: subtotal, reducere, livrare, total
  -- ----------------------------------------------------------
  -- Comandă nouă: transportul îl încasează FAN, totalul = subtotal → 0.
  if public.transport_facturabil(500, 0, 28.92, 500) <> 0 then
    raise exception 'VERIFICARE PICATĂ: comanda nouă nu trebuie să aibă transport pe factură';
  end if;
  -- Comandă nouă cu reducere: total = subtotal − reducere → 0.
  if public.transport_facturabil(500, 50, 28.92, 450) <> 0 then
    raise exception 'VERIFICARE PICATĂ: comanda nouă cu reducere nu trebuie să aibă transport';
  end if;
  -- Comandă veche: transportul e în total → intră pe factură.
  if public.transport_facturabil(500, 0, 28.92, 528.92) <> 28.92 then
    raise exception 'VERIFICARE PICATĂ: comanda veche trebuie să aibă transportul pe factură';
  end if;
  -- Comandă veche cu reducere.
  if public.transport_facturabil(500, 50, 28.92, 478.92) <> 28.92 then
    raise exception 'VERIFICARE PICATĂ: comanda veche cu reducere trebuie să aibă transportul';
  end if;
  -- Livrare necalculată (NULL) → 0, nu NULL.
  if public.transport_facturabil(500, null, null, 500) is distinct from 0::numeric then
    raise exception 'VERIFICARE PICATĂ: livrarea NULL trebuie să dea 0';
  end if;
  -- O diferență de rotunjire sub 0,009 nu e transport.
  if public.transport_facturabil(500, 0, 28.92, 500.005) <> 0 then
    raise exception 'VERIFICARE PICATĂ: o diferență de rotunjire a fost luată drept transport';
  end if;
  n := n + 6;

  -- ----------------------------------------------------------
  -- G. DREPTURILE: funcțiile nu se cheamă ca vizitator anonim
  --    (lecția din migrarea 42: pe Supabase `anon` primește drept direct).
  -- ----------------------------------------------------------
  if has_function_privilege('anon', 'public.calculeaza_linie_tva(numeric, numeric, numeric)', 'execute')
     or has_function_privilege('anon', 'public.cod_judet(text)', 'execute')
     or has_function_privilege('anon', 'public.transport_facturabil(numeric, numeric, numeric, numeric)', 'execute') then
    raise exception 'VERIFICARE PICATĂ: rolul anon poate chema o funcție SAGA';
  end if;
  n := n + 1;

  -- Reușita se anunță tot printr-o eroare: așa Postgres anulează orice ar fi
  -- făcut blocul, iar SQL Editor arată mesajul (un `raise notice` nu se vede acolo).
  raise exception 'REZULTAT OK: toate cele % de verificări au trecut. (Apare ca eroare intenționat: așa baza anulează tot ce a făcut testul.)', n;
end $$;

rollback;
