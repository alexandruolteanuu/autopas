-- ============================================================
-- MIGRAREA 42 — categoria sugerată pentru o piesă nouă, din piesele existente
--
-- DE CE (cerut de proprietar, 15 septembrie 2026)
-- În „Adaugă piesă", după ce operatorul scrie titlul, formularul își completează
-- singur categoria și subcategoria. Nu există o regulă scrisă „oglindă ->
-- Caroserie / Oglinzi", dar există 8.800 de piese deja clasificate: cele care au
-- aceleași cuvinte în titlu votează, și câștigă categoria cea mai frecventă.
-- Vezi lib/sugestie-piesa.ts.
--
-- DE CE O FUNCȚIE, NU O CITIRE DIN BROWSER
-- „bara" se potrivește pe aproape 1.000 de piese. Adunate în browser, PostgREST
-- le-ar fi tăiat tăcut la 1.000 (CLAUDE.md), iar votul s-ar fi dat pe un
-- eșantion. Aici se numără tot, într-o trecere, și pleacă cel mult 50 de rânduri.
--
-- CE PRIMEȘTE
-- `p_tipare` = tiparele de căutare făcute de `tipareCautare` din lib/format.ts
-- (câte unul pe cuvânt, cu plural și sinonime), aplicate cu ȘI pe
-- `products.cautare` — exact căutarea din admin și de pe site.
--
-- CINE O POATE CHEMA
-- Doar echipa: e o unealtă de admin, iar tiparele sunt expresii regulate venite
-- din afară. `revoke ... from public` (nu doar de la `anon`, care moștenește
-- dreptul prin PUBLIC), plus verificarea `is_staff()` înăuntru.
--
-- Nu atinge niciun rând. IDEMPOTENTĂ: se poate re-rula oricând.
-- ============================================================

create or replace function public.sugestie_clasificare(p_tipare text[])
returns table (categorie_id bigint, subcategorie_id bigint, art text, nr bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select p.categorie_id, p.subcategorie_id, p.art, count(*)::bigint as nr
    from products p
   where public.is_staff()
     and cardinality(p_tipare) between 1 and 6
     and p.categorie_id is not null
     and p.cautare ~* all (p_tipare)
   group by p.categorie_id, p.subcategorie_id, p.art
   order by nr desc
   limit 50;
$$;

comment on function public.sugestie_clasificare(text[]) is
  'Categoriile pieselor care se potrivesc pe toate tiparele, cu numărul lor. Pentru sugestia din „Adaugă piesă".';

revoke execute on function public.sugestie_clasificare(text[]) from public;
-- ȘI de la `anon`, explicit: pe Supabase funcțiile noi primesc drept DIRECT pentru
-- `anon`, nu doar prin PUBLIC. Verificat la rulare (15 septembrie 2026): după
-- revocarea de la PUBLIC, `has_function_privilege('anon', …)` tot spunea „da".
revoke execute on function public.sugestie_clasificare(text[]) from anon;
grant execute on function public.sugestie_clasificare(text[]) to authenticated;
