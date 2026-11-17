-- ============================================================
-- CORECTURILE POTRIVIRILOR CATEGORIE → ARTICOL SAGA (17 noiembrie 2026)
-- Găsite la verificarea tuturor pieselor după factura cu „Ventilator habitaclu Golf 6”
-- ieșită pe RADIATOARE. Confirmate de proprietar. DATE, nu schemă.
--
--   1. Aerotermă (225)                   RADIATOARE → VENTILATOARE   (64 de piese, toate ventilatoare)
--   2. Tulumbă frână (399)               nimic      → POMPA AUTO     (35, ca „Pompă servofrână” 286)
--   3. Radiatoare și Ventilatoare (20)   nimic      → RADIATOARE     (239; electroventilatoarele ies tot
--                                                                       RADIATOARE — decizia proprietarului)
--   4. Cinci piese mutate în subcategoria corectă (și categoria-părinte a ei):
--        AP-000637 furtun intercooler         Conducte AC (94)      → Furtun intercooler turbo (256)
--        AP-000825/860/861 calculator parcare Senzori parcare (213) → Calculator parcare (343)
--        AP-000866 calculator pompă motorină  Pompă amorsare (220)  → Calculator injecție (318)
--      Marcate `editat_manual`, ca o recitire din sursă să nu le mute înapoi. Mutarea le
--      pune singură în coada dez.ro și OLX (triggerele pe `products`).
-- Neatins: „Bloc xenon și balast” (48) rămâne ACCESORII AUTO (decizia proprietarului).
-- Facturile deja emise NU se schimbă (articolul e copiat pe linie la emitere).
--
-- Se rulează în SQL Editor. Un singur bloc: se OPREȘTE fără să scrie nimic dacă o categorie
-- sau o piesă nu mai e cum era la verificare. Idempotent.
-- Anulare (potrivirile): update saga_articole set cod_articol='1457070116', denumire='RADIATOARE'
--   where categorie_id=225; delete from saga_articole where categorie_id in (399, 20);
-- Anulare (piesele): vezi tabelul de mai sus, invers.
-- ============================================================
do $$
declare v_um_vent text; v_um_rad text; v_um_pompa text; n int;
begin
  -- Gărzile: numele categoriilor, așa cum erau la verificare.
  if (select count(*) from public.categories where (id, nume) in
        ((225, 'Aerotermă'), (399, 'Tulumbă frână'), (20, 'Radiatoare și Ventilatoare'),
         (256, 'Furtun intercooler turbo'), (343, 'Calculator parcare'), (318, 'Calculator injecție'))) <> 6 then
    raise exception 'OPRIT: o categorie nu mai are numele așteptat. Nu s-a scris nimic.';
  end if;
  select um into v_um_vent  from public.saga_articole where cod_articol = '1457070075' limit 1;
  select um into v_um_rad   from public.saga_articole where cod_articol = '1457070116' limit 1;
  select um into v_um_pompa from public.saga_articole where cod_articol = '1457070044' limit 1;
  if v_um_vent is null or v_um_rad is null or v_um_pompa is null then
    raise exception 'OPRIT: lipsește o potrivire existentă pe VENTILATOARE / RADIATOARE / POMPA AUTO (de unde se ia UM). Nu s-a scris nimic.';
  end if;

  -- 1–3. Potrivirile
  insert into public.saga_articole (categorie_id, cod_articol, denumire, um) values
    (225, '1457070075', 'VENTILATOARE', v_um_vent),
    (399, '1457070044', 'POMPA AUTO',   v_um_pompa),
    (20,  '1457070116', 'RADIATOARE',   v_um_rad)
  on conflict (categorie_id) do update
    set cod_articol = excluded.cod_articol, denumire = excluded.denumire, um = excluded.um,
        verificat_la = null, verificat_raspuns = null, actualizat_la = now();

  -- 4. Piesele: doar dacă stau încă unde erau (sau deja unde trebuie, la re-rulare).
  update public.products set categorie_id = 1, subcategorie_id = 256, editat_manual = true
   where cod_intern = 'AP-000637' and subcategorie_id = 94;
  update public.products set categorie_id = 5, subcategorie_id = 343, editat_manual = true
   where cod_intern in ('AP-000825', 'AP-000860', 'AP-000861') and subcategorie_id = 213;
  update public.products set categorie_id = 5, subcategorie_id = 318, editat_manual = true
   where cod_intern = 'AP-000866' and subcategorie_id = 220;
  select count(*) into n from public.products
   where (cod_intern = 'AP-000637' and subcategorie_id = 256)
      or (cod_intern in ('AP-000825', 'AP-000860', 'AP-000861') and subcategorie_id = 343)
      or (cod_intern = 'AP-000866' and subcategorie_id = 318);
  if n <> 5 then
    raise exception 'OPRIT: doar % din cele 5 piese sunt acum în subcategoria corectă (una a fost ștearsă sau mutată între timp). Nu s-a scris nimic.', n;
  end if;
end $$;

-- Verificarea (doar citire): 225 VENTILATOARE, 399 POMPA AUTO, 20 RADIATOARE; apoi cele 5 piese.
select categorie_id, cod_articol, denumire, um from public.saga_articole where categorie_id in (20, 225, 399) order by categorie_id;
select cod_intern, categorie_id, subcategorie_id from public.products
 where cod_intern in ('AP-000637', 'AP-000825', 'AP-000860', 'AP-000861', 'AP-000866') order by cod_intern;
