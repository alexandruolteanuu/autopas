-- ============================================================
-- AUTOPAS — UPGRADE (rulează AL ȘAPTELEA, după sprint-bc.sql)
-- Subcategorii · poze reale · cod intern · renunțare la starea A/B/C
-- Supabase → SQL Editor → New query → lipește tot → Run
-- ============================================================

-- ---------- 1. CATEGORII IERARHICE (categorie → subcategorie) ----------
alter table categories add column parent_id bigint references categories(id) on delete cascade;
alter table categories add column descriere text;
create index categories_parent_idx on categories (parent_id);

-- ---------- 2. PRODUSE: câmpuri noi ----------
alter table products add column subcategorie_id bigint references categories(id);
alter table products add column cod_intern text unique;
alter table products add column originala boolean not null default true;   -- „Piesă Auto Originală din dezmembrări"
alter table products add column poze text[] not null default '{}';          -- URL-urile pozelor reale
alter table products alter column stare drop not null;                      -- nu mai folosim A/B/C
alter table products alter column oem drop not null;

-- cod intern automat: AP-000123 (se poate dicta la telefon)
create or replace function public.set_cod_intern()
returns trigger language plpgsql as $$
begin
  if new.cod_intern is null then
    new.cod_intern := 'AP-' || lpad(new.id::text, 6, '0');
  end if;
  return new;
end; $$;
create trigger tr_cod_intern before insert on products
  for each row execute procedure public.set_cod_intern();

-- completăm codurile pentru piesele deja existente
update products set cod_intern = 'AP-' || lpad(id::text, 6, '0') where cod_intern is null;

-- ---------- 3. SUBCATEGORII REALE ----------
-- Structura urmează practica dezmembrărilor din România (dez.ro / edez.ro).
-- Toate se pot edita, șterge sau completa din panoul de administrare.
do $$
declare c record; p bigint;
begin
  for c in select * from (values
    ('motor-si-anexe', array['Motor complet','Chiulasă și bloc motor','Turbină','Injectoare și rampă','Pompă de injecție','Alternator','Electromotor','EGR și clapetă','Galerie admisie/evacuare','Radiatoare și răcire','Curele și distribuție','Ambreiaj și volantă']),
    ('cutie-de-viteze-si-transmisie', array['Cutie de viteze manuală','Cutie de viteze automată','Planetare și cardan','Diferențial','Cuplaje și rulmenți','Timonerie și schimbător']),
    ('caroserie-si-exterior', array['Capotă','Ușă față','Ușă spate','Aripă','Bară față','Bară spate','Haion și portbagaj','Pavilion și praguri','Oglinzi','Grile și ornamente','Parbriz, lunetă și geamuri','Macarale geam']),
    ('optica-si-faruri', array['Far stânga','Far dreapta','Stop stânga','Stop dreapta','Semnalizatoare','Proiectoare ceață','Lampă număr și interior','Bloc xenon și balast']),
    ('electrice-si-senzori', array['Calculator motor (ECU)','Calculator confort','Senzori motor','Senzori ABS și parcare','Instalație electrică','Panou de siguranțe','Baterie și borne','Contact și cheie','Airbag-uri și centuri']),
    ('suspensie-si-directie', array['Amortizoare','Arcuri','Brațe și bielete','Fuzete și rulmenți','Casetă de direcție','Pompă servodirecție','Bară stabilizatoare','Punte față/spate']),
    ('sistem-de-franare', array['Discuri de frână','Plăcuțe și saboți','Etriere','Pompă de frână','Pompă ABS','Servofrână','Frână de mână']),
    ('interior-si-tapiterie', array['Scaune','Banchetă','Bord complet','Volan','Airbag volan','Consolă centrală','Panouri de uși','Plafonieră și tapițerie','Mochetă și covorașe','Centuri de siguranță']),
    ('roti-jante-si-anvelope', array['Jante aliaj','Jante tablă','Anvelope','Capace și ornamente','Roată de rezervă','Senzori presiune (TPMS)']),
    ('climatizare-si-incalzire', array['Compresor AC','Radiator AC (condensator)','Radiator habitaclu','Ventilator habitaclu','Panou comandă climă','Conducte și furtunuri AC'])
  ) as t(parent_slug, subs) loop
    select id into p from categories where slug = c.parent_slug;
    if p is not null then
      for i in 1 .. array_length(c.subs, 1) loop
        insert into categories (slug, nume, parent_id, ordine, art, display_count)
        values (
          c.parent_slug || '-' || regexp_replace(
            lower(translate(c.subs[i], 'ăâîșțĂÂÎȘȚ /()', 'aaistAAIST---')), '[^a-z0-9]+', '-', 'g'),
          c.subs[i], p, i,
          (select art from categories where id = p), 0
        ) on conflict (slug) do nothing;
      end loop;
    end if;
  end loop;
end $$;

-- ---------- 4. NUMĂRĂTOAREA REALĂ DE PIESE PE CATEGORIE ----------
-- Înlocuiește numerele fixe (display_count) cu stocul real, publicat.
create or replace view categorii_cu_numar as
select c.id, c.slug, c.nume, c.parent_id, c.ordine, c.art,
       (select count(*) from products p
         where p.publicat = true and p.stoc > 0
           and (p.categorie_id = c.id or p.subcategorie_id = c.id)) as nr_piese
from categories c;
grant select on categorii_cu_numar to anon, authenticated;

-- ---------- 5. SETĂRILE INTEGRĂRILOR (salvate în DB, nu doar în env) ----------
insert into settings (cheie, valoare) values
 ('integrari', '{"whatsapp":{"numar":"","activ":true},
                 "fancourier":{"client_id":"","user":"","parola":"","activ":false},
                 "sameday":{"user":"","parola":"","activ":false},
                 "netopia":{"signature":"","pos_id":"","activ":false},
                 "saga":{"serie":"AUTP","activ":true},
                 "ga4":{"id":"","activ":false}}')
on conflict (cheie) do nothing;

-- ---------- 6. POZE: bucketul de stocare ----------
-- ATENȚIE: bucketul se creează din interfața Supabase (Storage → New bucket → "poze-piese" → Public).
-- Politicile de mai jos permit oricui să VADĂ pozele și doar echipei să încarce/șteargă.
insert into storage.buckets (id, name, public) values ('poze-piese', 'poze-piese', true)
on conflict (id) do nothing;

create policy "poze publice" on storage.objects for select
  using (bucket_id = 'poze-piese');
create policy "poze incarcare staff" on storage.objects for insert to authenticated
  with check (bucket_id = 'poze-piese' and is_staff());
create policy "poze stergere staff" on storage.objects for delete to authenticated
  using (bucket_id = 'poze-piese' and is_staff());
