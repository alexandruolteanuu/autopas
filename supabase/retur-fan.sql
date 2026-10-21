-- ============================================================
-- MIGRAREA 46 — AWB de RETUR prin FAN Courier
--
-- DE CE (21 octombrie 2026, documentație primită de la FAN pe e-mail)
-- Până acum, clientul care voia să returneze o piesă completa formularul
-- (`return_requests`) și atât: AWB-ul de retur se făcea de mână, în selfawb.ro,
-- sau clientul trimitea cu ce curier voia. La 14 zile de drept de retragere și
-- 90 de zile de garanție, asta e muncă repetată la fiecare cerere.
--
-- Fluxul FAN pentru retururi (docs/fancourier/…anexa1.pdf) cere trei lucruri
-- pe care contul nostru cu contract NU le poate face:
--   1. un cont selfAWB OCAZIONAL (client fără contract), cu alt clientId, alt
--      utilizator și altă parolă — ridicarea se face de la o adresă care nu e a
--      noastră, iar FAN asociază plata contului cu contract;
--   2. `sender` = CLIENTUL care returnează, `recipient` = depozitul nostru
--      (exact invers față de AWB-ul de livrare, unde expeditorul e implicit);
--   3. o COMANDĂ DE CURIER pentru fiecare AWB de retur — altfel nimeni nu se
--      duce să ridice coletul. La livrările obișnuite nu e nevoie: curierul
--      vine zilnic la depozit (decizia din 15 septembrie 2026).
--
-- CE FACE MIGRAREA
--   1. `return_requests.order_id`   — legătura cu comanda, de unde vine adresa.
--   2. `return_requests.ridicare`   — adresa de la care se ridică coletul
--      (jsonb), precompletată din comandă și corectabilă de operator.
--   3. `return_requests.awb`, `awb_curier_id`, `awb_generat_la`, `awb_date`
--      — AWB-ul de retur, comanda de curier și tot ce s-a declarat/răspuns.
--
-- NU atinge niciun rând existent și nu schimbă nicio politică RLS: tabela e
-- deja numai pentru echipă (admin.sql + rls-citire-echipa.sql).
-- IDEMPOTENTĂ: se poate re-rula oricând.
-- ============================================================

-- ---------- 1. LEGĂTURA CU COMANDA ----------
-- `numar_comanda` rămâne cum e: text scris de CLIENT în formular, deci poate fi
-- greșit sau cu altă formă („ap 2026 1453”). Coloana nouă e legătura verificată,
-- pusă de operator sau găsită automat după număr. Fără ea n-avem adresa de
-- ridicare, fiindcă formularul de retur nu cere adresa.
alter table return_requests add column if not exists order_id bigint references orders(id) on delete set null;

comment on column return_requests.order_id is
  'Comanda de care ține returul. `numar_comanda` rămâne ce a scris clientul.';

create index if not exists return_requests_order_idx on return_requests (order_id);


-- ---------- 2. ADRESA DE RIDICARE ----------
-- De ce jsonb și nu cinci coloane, ca la livrare: e o adresă folosită într-un
-- singur loc (AWB-ul de retur), nu date de raportat sau de filtrat. Forma:
--   { "nume": "...", "telefon": "...", "judet": "Cluj",
--     "localitate": "Cluj-Napoca", "strada": "Strada Memorandumului nr. 28" }
-- Județul și localitatea se scriu ca în nomenclatorul FAN (fără diacritice) —
-- vezi `faraDiacritice` din lib/fancourier.ts.
alter table return_requests add column if not exists ridicare jsonb;

comment on column return_requests.ridicare is
  'De unde ridică curierul coletul returnat. Precompletată din comandă, corectabilă.';


-- ---------- 3. AWB-UL DE RETUR ----------
alter table return_requests add column if not exists awb text;
alter table return_requests add column if not exists awb_curier_id text;
alter table return_requests add column if not exists awb_generat_la timestamptz;
alter table return_requests add column if not exists awb_date jsonb;

comment on column return_requests.awb is
  'AWB-ul de retur, generat pe contul OCAZIONAL FAN (altul decât cel cu contract).';
comment on column return_requests.awb_curier_id is
  'Id-ul comenzii de curier (POST /order). Fără ea nimeni nu vine să ridice coletul.';
comment on column return_requests.awb_date is
  'Ce s-a declarat la FAN și ce a răspuns — aceeași idee ca orders.awb_date (migrarea 43).';

-- Un AWB nu poate fi al două cereri. Parțial, ca rândurile fără AWB să nu se
-- lovească între ele.
create unique index if not exists return_requests_awb_unic on return_requests (awb) where awb is not null;


-- ---------- 4. CE A IEȘIT ----------
select column_name, data_type
  from information_schema.columns
 where table_name = 'return_requests'
   and column_name in ('order_id', 'ridicare', 'awb', 'awb_curier_id', 'awb_generat_la', 'awb_date')
 order by column_name;
