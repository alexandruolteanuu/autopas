-- ============================================================
-- AUTOPAS — E-MAILURI AUTOMATE (rulează AL TREIZECI ȘI ȘASELEA)
-- Supabase → SQL Editor → New query → lipește tot → Run
-- IDEMPOTENTĂ: se poate re-rula oricând.
--
-- CE FACE (7 septembrie 2026)
-- Pune la coadă un e-mail de fiecare dată când intră o comandă sau o cerere, și
-- trezește ruta `/api/email-coada` de pe site, care le trimite prin Brevo.
--
-- DE CE O COADĂ ȘI NU O TRIMITERE DIRECTĂ DIN BROWSER
-- Varianta evidentă ar fi ca pagina de checkout să cheme o rută după ce comanda
-- reușește. Dar atunci un client care închide tabul în secunda de după „Trimite
-- comanda" ți-ar lăsa comanda în bază FĂRĂ să te anunțe nimeni — exact cazul în
-- care ai cel mai mult nevoie de e-mail. Aici rândul intră în coadă în ACEEAȘI
-- tranzacție cu comanda: dacă există comanda, există și e-mailul de trimis.
-- Ce se poate întâmpla mai rău e o întârziere, niciodată o pierdere.
--
-- REGULA CARE NU SE ÎNCALCĂ: un e-mail nu are voie să strice o comandă.
-- Tot ce face triggerul e învelit într-un `exception when others then null`.
-- Dacă pg_net cade, dacă `settings` e gol, dacă site-ul e în timpul unui deploy —
-- comanda se salvează oricum, iar rândul rămâne în coadă și se trimite la
-- următoarea trezire. O comandă pierdută costă bani; un e-mail întârziat, nu.
--
-- UNDE STAU SECRETELE
-- În `settings.integrari.email`, ca parola FAN Courier: rândul `integrari` NU e
-- citibil public (politica lasă la vedere doar `firma` și `curieri`). Triggerul
-- îl citește fiindcă e `security definer`.
-- ============================================================


-- ============================================================
-- 1. pg_net — extensia prin care baza poate chema o adresă HTTPS
--
-- E aceeași pe care o folosesc „Database Webhooks" din panoul Supabase; o
-- activăm explicit ca să rămână scrisă în migrare, nu apăsată într-o interfață.
-- Apelul e ASINCRON: `net.http_post` doar pune cererea într-o coadă internă și
-- se întoarce imediat, deci nu ține tranzacția comenzii în loc.
-- ============================================================
create extension if not exists pg_net with schema extensions;


-- ============================================================
-- 2. COADA — și, în același timp, jurnalul
--
-- Ține minte ce s-a trimis, când, către cine și ce eroare a fost. La retururi și
-- la garanție contează să poți arăta că i-ai trimis clientului confirmarea, nu
-- doar să crezi că i-ai trimis-o.
--
-- Indexul UNIC pe (tip, referinta_id) e plasa împotriva dublurilor: dacă
-- triggerul se declanșează de două ori, sau dacă cineva re-rulează migrarea,
-- clientul tot primește un singur e-mail.
-- ============================================================
create table if not exists public.email_coada (
  id            bigint generated always as identity primary key,
  tip           text        not null,
  referinta_id  bigint      not null,
  catre         text,
  creat_la      timestamptz not null default now(),
  trimis_la     timestamptz,
  incercari     int         not null default 0,
  eroare        text
);

create unique index if not exists email_coada_unic on public.email_coada (tip, referinta_id);
-- Index parțial: interesează doar rândurile netrimise, adică (aproape) niciunul.
create index if not exists email_coada_de_trimis on public.email_coada (id) where trimis_la is null;

alter table public.email_coada enable row level security;

-- Coada conține adrese de e-mail ale clienților: se citește DOAR de echipă.
-- Ruta care trimite folosește cheia de service, care trece peste RLS oricum.
drop policy if exists "coada email citire echipa" on public.email_coada;
create policy "coada email citire echipa" on public.email_coada
  for select using (is_staff());


-- ============================================================
-- 3. TRIGGERUL
--
-- O comandă produce DOUĂ rânduri: unul pentru client (confirmarea) și unul
-- pentru echipă (notificarea către pieseneamt@yahoo.ro). Sunt separate ca să
-- poată eșua independent — dacă adresa clientului e greșită, tu tot afli că a
-- intrat o comandă.
--
-- Formularele produc un singur rând, de confirmare către expeditor.
-- ============================================================
create or replace function public.pune_email_in_coada()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url    text;
  v_secret text;
begin
  begin
    if tg_table_name = 'orders' then
      insert into public.email_coada (tip, referinta_id) values ('comanda_client', new.id)
        on conflict (tip, referinta_id) do nothing;
      insert into public.email_coada (tip, referinta_id) values ('comanda_echipa', new.id)
        on conflict (tip, referinta_id) do nothing;
    else
      insert into public.email_coada (tip, referinta_id) values (tg_table_name, new.id)
        on conflict (tip, referinta_id) do nothing;
    end if;

    select valoare->'email'->>'webhook_url', valoare->'email'->>'webhook_secret'
      into v_url, v_secret
      from public.settings where cheie = 'integrari';

    -- Fără adresă sau fără secret nu se cheamă nimic: rândurile rămân în coadă
    -- și pleacă la prima trezire de după configurare. Nu e o eroare, e starea
    -- normală cât timp integrarea nu e pornită din Admin → Integrări.
    if v_url is not null and v_url <> '' and v_secret is not null and v_secret <> '' then
      perform extensions.net.http_post(
        url     := v_url,
        body    := '{}'::jsonb,
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-autopas-email', v_secret),
        timeout_milliseconds := 3000
      );
    end if;
  exception when others then
    -- Înghițit intenționat. Vezi antetul: un e-mail nu are voie să strice o comandă.
    null;
  end;
  return new;
end;
$$;

revoke execute on function public.pune_email_in_coada() from public;

do $$
declare t text;
begin
  foreach t in array array['orders','part_requests','car_intake_requests','return_requests','contact_messages']
  loop
    execute format('drop trigger if exists email_la_inserare on public.%I', t);
    execute format(
      'create trigger email_la_inserare after insert on public.%I
         for each row execute function public.pune_email_in_coada()', t);
  end loop;
end $$;


-- ============================================================
-- VERIFICARE
-- Prima: triggerele există pe toate cele cinci tabele.
-- A doua: coada (goală la prima rulare).
-- ============================================================
select event_object_table as tabela, trigger_name, action_timing, event_manipulation
  from information_schema.triggers
 where trigger_name = 'email_la_inserare'
 order by tabela;

select tip, count(*) as randuri,
       count(*) filter (where trimis_la is null) as netrimise
  from public.email_coada group by tip order by tip;
