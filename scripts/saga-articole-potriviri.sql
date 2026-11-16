-- ============================================================
-- POTRIVIRILE CATEGORIE → ARTICOL SAGA (16 noiembrie 2026), din lista de stocuri
-- trimisă de proprietar (gestiunea DEPOZIT PIESE VADURI). DATE, nu schemă: scrie în
-- `saga_articole` (migrarea 50), același tabel ca Admin → Facturi → Articole SAGA.
--
-- Se rulează în SQL Editor. Se OPREȘTE fără să scrie nimic dacă o categorie nu mai are
-- numele așteptat (ca să nu lege altă categorie). Idempotent: re-rularea rescrie aceleași valori.
-- Ce nu e aici rămâne pe articolul implicit (ACCESORII AUTO, 1457070043).
-- Facturile deja emise NU se schimbă (articolul e copiat pe linie la emitere).
-- Alegeri: la articole dublate s-a luat codul general (14570700…) cel mai folosit la ieșiri;
-- codurile de lot (U1022, R0922…) nu se folosesc. UM gol în SAGA → „BUC” aici (CARENAJE,
-- CONTACT, PUNTE SPATE, ARCURI, CONDUCTE AC, FURTUN AUTO). După rulare: Articole SAGA → „Verifică toate”.
-- Anulare: delete from public.saga_articole where categorie_id in (<id-urile de mai jos>);
-- ============================================================
begin;
create temp table _potriviri (categorie_id bigint, nume text, cod text, denumire text, um text) on commit drop;
insert into _potriviri values
  (11, 'Motor complet', '1457070037', 'MOTOR', 'BUC'),
  (14, 'Injectoare și rampă', '1457070062', 'INJECTOARE', 'BUC'),
  (17, 'Electromotor', '1457070048', 'ELECTROMOTOR', 'BUC'),
  (210, 'Turbine', '1457070056', 'TURBINA', 'BUC'),
  (246, 'Baie ulei', '1457070115', 'BAIE ULEI', 'BC'),
  (364, 'Pistoane', '1457070166', 'PISTOANE', 'BC'),
  (191, 'Pompă vacuum', '1457070044', 'POMPA AUTO', 'BUC'),
  (195, 'Pompă motorină din rezervor', '1457070044', 'POMPA AUTO', 'BUC'),
  (209, 'Pompă injecție', '1457070044', 'POMPA AUTO', 'BUC'),
  (220, 'Pompă amorsare', '1457070044', 'POMPA AUTO', 'BUC'),
  (233, 'Pompă apă', '1457070044', 'POMPA AUTO', 'BUC'),
  (268, 'Pompă rezervor', '1457070044', 'POMPA AUTO', 'BUC'),
  (358, 'Pompă AdBlue', '1457070044', 'POMPA AUTO', 'BUC'),
  (384, 'Pompă benzină', '1457070044', 'POMPA AUTO', 'BUC'),
  (387, 'Pompă ulei', '1457070044', 'POMPA AUTO', 'BUC'),
  (63, 'Pompă servodirecție', '1457070044', 'POMPA AUTO', 'BUC'),
  (70, 'Pompă ABS', '1457070044', 'POMPA AUTO', 'BUC'),
  (286, 'Pompă servofrână', '1457070044', 'POMPA AUTO', 'BUC'),
  (206, 'Cutie de viteze', '1457070038', 'CUTIE VITEZA', 'BUC'),
  (333, 'Cutie viteze automată', '1457070038', 'CUTIE VITEZA', 'BUC'),
  (287, 'Volantă', '1457070135', 'VOLANTA', 'BC'),
  (29, 'Capotă', '1457070033', 'CAPOTA', 'BUC'),
  (205, 'Capotă portbagaj', '1457070033', 'CAPOTA', 'BUC'),
  (30, 'Ușă față', '1457070151', 'USA', 'BC'),
  (31, 'Ușă spate', '1457070151', 'USA', 'BC'),
  (373, 'Ușă culisantă', '1457070151', 'USA', 'BC'),
  (32, 'Aripă', '1457070032', 'ARIPA', 'BUC'),
  (218, 'Aripă față', '1457070032', 'ARIPA', 'BUC'),
  (344, 'Aripă spate', '1457070032', 'ARIPA', 'BUC'),
  (33, 'Bară față', '1457070028', 'BARA FATA', 'BUC'),
  (34, 'Bară spate', '1457070029', 'BARA SPATE', 'BUC'),
  (298, 'Armatură bară față', '1457070034', 'ARMATURA', 'BUC'),
  (272, 'Armatură bară spate', '1457070034', 'ARMATURA', 'BUC'),
  (217, 'Trager', '1457070049', 'TRAGER', 'BUC'),
  (231, 'Oglinzi complete', '1457070063', 'OGLINDA', 'BUC'),
  (249, 'Haion', '1457070042', 'HAION', 'BUC'),
  (258, 'Carenaj roată', '1457070306', 'CARENAJE', 'BUC'),
  (312, 'Grilă radiator', '1457070050', 'GRILA RADIATOR', 'BUC'),
  (194, 'Faruri', '1457070031', 'FAR', 'BUC'),
  (224, 'Stopuri', '1457070036', 'STOP AUTO', 'BUC'),
  (203, 'Alternator', '1457070047', 'ALTERNATOR', 'BUC'),
  (237, 'Calculator ECU', '1457070070', 'CALCULATOARE', 'BUC'),
  (50, 'Calculator confort', '1457070070', 'CALCULATOARE', 'BUC'),
  (248, 'Calculator lumini', '1457070070', 'CALCULATOARE', 'BUC'),
  (265, 'Calculator airbag', '1457070070', 'CALCULATOARE', 'BUC'),
  (273, 'Calculator ABS', '1457070070', 'CALCULATOARE', 'BUC'),
  (318, 'Calculator injecție', '1457070070', 'CALCULATOARE', 'BUC'),
  (319, 'Calculator frână mână', '1457070070', 'CALCULATOARE', 'BUC'),
  (343, 'Calculator parcare', '1457070070', 'CALCULATOARE', 'BUC'),
  (402, 'Calculator cutie automată', '1457070070', 'CALCULATOARE', 'BUC'),
  (51, 'Senzori motor', '1457070069', 'SENZOR', 'BUC'),
  (213, 'Senzori parcare', '1457070069', 'SENZOR', 'BUC'),
  (250, 'Senzori ploaie', '1457070069', 'SENZOR', 'BUC'),
  (323, 'Senzor presiune gaze evacuare', '1457070069', 'SENZOR', 'BUC'),
  (332, 'Senzor MAP', '1457070069', 'SENZOR', 'BUC'),
  (337, 'Senzor NOx', '1457070069', 'SENZOR', 'BUC'),
  (345, 'Senzor ESP', '1457070069', 'SENZOR', 'BUC'),
  (369, 'Senzor ax came', '1457070069', 'SENZOR', 'BUC'),
  (413, 'Senzor nivel ulei', '1457070069', 'SENZOR', 'BUC'),
  (420, 'Senzor temperatură gaze evacuare', '1457070069', 'SENZOR', 'BUC'),
  (442, 'Radar distronic (ACC)', '1457070069', 'SENZOR', 'BUC'),
  (443, 'Senzor impact pietoni', '1457070069', 'SENZOR', 'BUC'),
  (444, 'Senzor unghi mort', '1457070069', 'SENZOR', 'BUC'),
  (445, 'Senzor impact airbag', '1457070069', 'SENZOR', 'BUC'),
  (446, 'Senzor unghi volan', '1457070069', 'SENZOR', 'BUC'),
  (447, 'Senzor nivel faruri', '1457070069', 'SENZOR', 'BUC'),
  (448, 'Senzor nivel suspensie', '1457070069', 'SENZOR', 'BUC'),
  (449, 'Senzor deschidere haion', '1457070069', 'SENZOR', 'BUC'),
  (56, 'Contact și cheie', '1457070323', 'CONTACT', 'BUC'),
  (61, 'Fuzete și rulmenți', '1457070058', 'FUZEETA', 'BUC'),
  (305, 'Punte spate', '1457070343', 'PUNTE SPATE', 'BUC'),
  (334, 'Arcuri auto', '1457070369', 'ARCURI', 'BUC'),
  (424, 'Foi de arc', '1457070369', 'ARCURI', 'BUC'),
  (75, 'Plansa bord', '1457070064', 'PLANSA BORD', 'BUC'),
  (381, 'Jante', '1457070136', 'JANTE', 'BC'),
  (89, 'Compresor AC', '1457070053', 'COMPRESOR', 'BUC'),
  (94, 'Conducte și furtunuri AC', '1457070342', 'CONDUCTE AC', 'BUC'),
  (90, 'Radiator AC (condensator)', '1457070116', 'RADIATOARE', 'BC'),
  (181, 'Intercooler', '1457070116', 'RADIATOARE', 'BC'),
  (289, 'Radiator ulei termoflot', '1457070116', 'RADIATOARE', 'BC'),
  (225, 'Aerotermă', '1457070116', 'RADIATOARE', 'BC'),
  (199, 'Sondă lambda', '1457070069', 'SENZOR', 'BUC'),
  (391, 'Electroventilator climă AC', '1457070075', 'VENTILATOARE', 'BUC'),
  (256, 'Furtun intercooler turbo', '1457070368', 'FURTUN AUTO', 'BUC'),
  (275, 'Furtun admisie', '1457070368', 'FURTUN AUTO', 'BUC'),
  (204, 'Oglindă retrovizoare', '1457070063', 'OGLINDA', 'BUC');

do $$
declare r record;
begin
  for r in select p.categorie_id, p.nume, c.nume as nume_baza from _potriviri p left join public.categories c on c.id = p.categorie_id
            where c.id is null or c.nume <> p.nume loop
    raise exception 'OPRIT, nimic scris: categoria #% trebuia să fie „%”, în bază e „%”.', r.categorie_id, r.nume, coalesce(r.nume_baza, '(nu există)');
  end loop;
end $$;

insert into public.saga_articole (categorie_id, cod_articol, denumire, um)
select categorie_id, cod, denumire, um from _potriviri
on conflict (categorie_id) do update
   set cod_articol = excluded.cod_articol, denumire = excluded.denumire, um = excluded.um,
       verificat_la = null, verificat_raspuns = null, actualizat_la = now();

-- Rezultatul: câte categorii pe fiecare articol (trebuie 86 în total).
select s.cod_articol, s.denumire, s.um, count(*) as categorii, string_agg(c.nume, ', ' order by c.nume) as ce_categorii
  from public.saga_articole s join public.categories c on c.id = s.categorie_id
 group by 1, 2, 3 order by 2;
commit;
