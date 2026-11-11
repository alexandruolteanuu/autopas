-- ============================================================
-- ȘTERGEREA DEFINITIVĂ A CELOR DOUĂ COMENZI DE PROBĂ SAGA (11 noiembrie 2026)
--
--   AP-2026-01809 (factura PROBA 1)  și  AP-2026-01811 (PROBA 2 + stornoul PROBA 3)
--
-- Cerută de proprietar: comenzile de probă să nu mai apară în admin. IREVERSIBIL.
-- Ocolește intenționat regula „o factură trimisă în SAGA nu se șterge”: oprește
-- triggerele de pază ale facturilor DOAR în tranzacția asta (ALTER TABLE e tranzacțional —
-- dacă ceva pică, totul revine, inclusiv triggerele).
--
-- Gărzi: se OPREȘTE fără să șteargă nimic dacă
--   · nu găsește exact cele două comenzi;
--   · una dintre ele are vreo factură pe o serie care NU e de probă (PROBA… / TEST…);
--   · vreo factură de probă de-a lor e legată de o factură a altei comenzi.
-- Stocul: dacă o comandă nu e „anulata”, piesele ei revin pe stoc (ca `sterge_comanda`).
-- Nu atinge contorul seriei PROBA, jurnalul saga_trimiteri sau SAGA însuși.
--
-- Se rulează din Supabase → SQL Editor, de proprietar: lipești tot → Run.
-- ============================================================
begin;

do $$
declare
  v_ids     bigint[];
  v_fact    bigint[];
  v_rest    int;
  v_text    text;
begin
  select array_agg(id order by id) into v_ids
    from public.orders where numar in ('AP-2026-01809', 'AP-2026-01811');
  if coalesce(array_length(v_ids, 1), 0) <> 2 then
    raise exception 'OPRIT: nu am găsit exact cele două comenzi (găsite: %). Nu s-a șters nimic.', coalesce(array_length(v_ids, 1), 0);
  end if;

  if exists (select 1 from public.facturi
              where order_id = any(v_ids) and not public.serie_de_proba(serie)) then
    raise exception 'OPRIT: una dintre comenzi are o factură pe o serie REALĂ. Nu s-a șters nimic.';
  end if;

  select array_agg(id) into v_fact from public.facturi where order_id = any(v_ids);
  if exists (select 1 from public.facturi
              where storno_pentru = any(coalesce(v_fact, '{}')) and not (order_id = any(v_ids))) then
    raise exception 'OPRIT: o factură a altei comenzi trimite la facturile acestor comenzi. Nu s-a șters nimic.';
  end if;

  select string_agg(serie || ' ' || numar || ' (' || tip || ', ' || saga_status || ')', '; ' order by id)
    into v_text from public.facturi where order_id = any(v_ids);

  -- Stocul înapoi doar pentru comenzile care NU sunt anulate (anularea l-a pus deja).
  update public.products p set stoc = p.stoc + i.cantitate
    from public.order_items i join public.orders o on o.id = i.order_id
   where i.order_id = any(v_ids) and o.status <> 'anulata' and i.product_id = p.id;
  get diagnostics v_rest = row_count;

  alter table public.facturi       disable trigger facturi_pazeste;
  alter table public.facturi_linii disable trigger facturi_linii_pazeste;
  delete from public.facturi where order_id = any(v_ids);   -- liniile și „ascunsele”, în cascadă
  alter table public.facturi       enable trigger facturi_pazeste;
  alter table public.facturi_linii enable trigger facturi_linii_pazeste;

  delete from public.orders where id = any(v_ids);          -- piesele comenzii și jurnalul, în cascadă

  raise notice 'GATA: șterse comenzile AP-2026-01809 și AP-2026-01811, facturile: %; piese repuse pe stoc: %.',
    coalesce(v_text, 'niciuna'), v_rest;
end $$;

-- Verificarea: trebuie să iasă 0 | 0 | true | true
select (select count(*) from public.orders  where numar in ('AP-2026-01809', 'AP-2026-01811')) as comenzi_ramase,
       (select count(*) from public.facturi f where serie_de_proba(f.serie) and f.order_id is not null
                                              and not exists (select 1 from public.orders o where o.id = f.order_id)) as facturi_orfane,
       (select tgenabled <> 'D' from pg_trigger where tgname = 'facturi_pazeste')       as paza_facturi_pornita,
       (select tgenabled <> 'D' from pg_trigger where tgname = 'facturi_linii_pazeste') as paza_liniilor_pornita;

commit;
