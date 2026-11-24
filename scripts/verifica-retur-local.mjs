// Partea de teste a lui scripts/verifica-retur-local.sh (nu se rulează singur:
// scriptul .sh pornește baza, PostgREST și site-ul, apoi cheamă fișierul ăsta).
// Formularul (/api/retur), panoul din admin (/api/awb-retur: PDF, modifică,
// șterge, generează) și e-mailul (coada + Brevo prins, nu trimis).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createHmac } from "node:crypto";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (claims, secret) => {
  const h = b64({ alg: "HS256", typ: "JWT" }), p = b64({ exp: Math.floor(Date.now() / 1000) + 86400, ...claims });
  return `${h}.${p}.${createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url")}`;
};
const S = process.env.VR_TMP.replace(/\/?$/, "/");
const PG = process.env.VR_PG;
const SITE = "http://localhost:3100";
const SECRET = process.env.VR_JWT;
const SQL = (q) => execFileSync("docker", ["exec", PG, "psql", "-U", "postgres", "-tA", "-v", "ON_ERROR_STOP=1", "-c", q]).toString().trim();
const EMAILURI = `${S}emailuri.jsonl`;
const emailuri = () => readFileSync(EMAILURI, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));

let picate = 0, trecute = 0;
const v = (ce, cond, detaliu = "") => {
  console.log(`${cond ? "✓" : "✗"} ${ce}${detaliu ? ` — ${detaliu}` : ""}`);
  cond ? trecute++ : picate++;
};
const toateAwb = new Set();   // tot ce s-a creat la FAN, pentru curățenie

// ---------- datele ----------
const STAFF = "11111111-1111-1111-1111-111111111111", CLIENT_U = "22222222-2222-2222-2222-222222222222";
SQL(`insert into profiles (id, email, role) values ('${STAFF}', 'op@local', 'operator'), ('${CLIENT_U}', 'c@local', 'client')`);
SQL(`insert into settings (cheie, valoare) values
  ('firma', '{"denumire":"PIESE AUTO PAS SRL","telefon":"0743 627 151","email":"contact@autopas-dezmembrari.ro","adresa":"Str. Petru Rareș nr. 181"}'),
  ('integrari', '{"fancourier_retur":{"user":"clienttest@fancourier.ro","parola":"testareFAN"},
    "email":{"activ":true,"cheie":"cheie-falsa-locala","webhook_url":"${SITE}/api/email-coada","webhook_secret":"secret-email-local"}}')`);
const ADR = { nume: "Proba Retur", telefon: "0723456789", judet: "Cluj", localitate: "Cluj-Napoca" };
const comanda = (numar, extra = "") => SQL(`insert into orders (numar, nume, email, telefon, adresa, oras, judet ${extra ? ", status, awb_date" : ""})
  values ('${numar}', 'Proba Retur', 'proba@local.test', '0723456789', 'Str. Memorandumului 28', 'Cluj-Napoca', 'Cluj' ${extra}) returning id`);
comanda("AP-2026-90001");                                                     // fără AWB de livrare
comanda("AP-2026-90002", `, 'livrata', '{"colete":1,"greutate":3,"lungime":50,"latime":30,"inaltime":20}'`);
comanda("AP-2026-90003", `, 'anulata', null`);
comanda("AP-2026-90004");
comanda("AP-2026-90005");

const tok = { staff: jwt({ role: "authenticated", sub: STAFF }, SECRET), client: jwt({ role: "authenticated", sub: CLIENT_U }, SECRET) };
const formular = async (corp) => (await fetch(`${SITE}/api/retur`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corp) })).json();
const admin = async (corp, t = tok.staff) => {
  const r = await fetch(`${SITE}/api/awb-retur`, { method: "POST", headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: JSON.stringify(corp) });
  return { status: r.status, ...(await r.json().catch(() => ({}))) };
};
const golesteCoada = async () => (await fetch(`${SITE}/api/email-coada`, { method: "POST", headers: { "Content-Type": "application/json", "x-autopas-email": "secret-email-local" }, body: "{}" })).json();
const cerere = (numar) => JSON.parse(SQL(`select row_to_json(r) from return_requests r where numar_comanda = '${numar}' order by id desc limit 1`) || "null");
const baza = (numar, motiv, extra = {}) => ({
  numar_comanda: numar, nume: "Proba Retur", email: "proba@local.test", telefon: "0723456789",
  produs: "Far stânga", motiv, adresa: { judet: "Cluj", localitate: "Cluj-Napoca", strada: "Strada Memorandumului", numar: "28" }, ...extra,
});
const COLET = { greutate: "2", lungime: "40", latime: "30", inaltime: "20" };

try {
  // ================= FORMULARUL =================
  console.log("\n— Formularul public (/api/retur)");
  const g = await (await fetch(`${SITE}/api/retur`)).json();
  v("GET dă 5 zile lucrătoare, de mâine", g.ok && g.zile.length === 5 && g.zile.every((z) => ![0, 6].includes(new Date(z).getUTCDay())), g.zile.join(" "));

  let r = await formular({ numar_comanda: "AP-2026-90001" });
  v("câmpuri lipsă → eroare clară", !r.ok && /Completează/.test(r.eroare), r.eroare);
  r = await formular(baza("AP-2026-99999", "Alt motiv", { colet: COLET }));
  v("comandă inexistentă → refuz", !r.ok && /N-am găsit/.test(r.eroare));
  r = await formular(baza("AP-2026-90003", "Alt motiv", { colet: COLET }));
  v("comandă anulată → refuz", !r.ok && /anulată/.test(r.eroare));
  r = await formular(baza("AP-2026-90001", "Motiv inventat", { colet: COLET }));
  v("motiv care nu e în listă → refuz", !r.ok && /motivul/.test(r.eroare));
  r = await formular(baza("AP-2026-90001", "Alt motiv"));
  v("fără AWB de livrare și fără colet → cere mărimea coletului", !r.ok && r.cere_colet?.greutate && r.cere_colet?.dimensiuni);
  v("…și nu s-a înregistrat nimic încă", SQL("select count(*) from return_requests") === "0");
  r = await formular(baza("AP-2026-90001", "Alt motiv", { colet: COLET, adresa: { judet: "Cluj", localitate: "Localitate Inexistenta", strada: "X", numar: "1" } }));
  v("localitate refuzată de FAN → mesaj de corectat, nimic salvat", !r.ok && /localitatea/i.test(r.eroare) && SQL("select count(*) from return_requests") === "0", r.eroare);

  const zi = g.zile[1];
  r = await formular(baza("AP-2026-90001", "Alt motiv", { colet: COLET, data_ridicare: zi }));
  if (r.awb) toateAwb.add(r.awb);
  v("„Alt motiv” → AWB generat pe loc", r.ok && !!r.awb, `AWB ${r.awb}`);
  v("…curierul comandat", r.curier === true);
  v("…plătește CLIENTUL", r.plata === "client");
  v("…ziua aleasă e respectată", r.data_ridicare === zi);
  let c = cerere("AP-2026-90001");
  v("cererea e salvată cu AWB, curier, status „în lucru”, legată de comandă",
    c && c.awb === r.awb && !!c.awb_curier_id && c.status === "in_lucru" && !!c.order_id);
  v("awb_date are tot ce trebuie e-mailului (plata, tarif, tracking, ridicare)",
    c.awb_date?.automat === true && c.awb_date.plata === "client" && c.awb_date.tarif > 0 && /^https?:/.test(c.awb_date.tracking) && c.awb_date.data_ridicare === zi);
  v("triggerul a pus e-mailul în coadă", SQL(`select count(*) from email_coada where tip='return_requests' and referinta_id=${c.id} and trimis_la is null`) === "1");
  v("…și a trezit ruta de e-mail (cu secretul)", SQL(`select count(*) from net.cereri where headers->>'x-autopas-email' = 'secret-email-local'`) >= "1");
  const gol = await golesteCoada();
  const m1 = emailuri().find((e) => e.subject?.includes(r.awb));
  v("ruta de e-mail trimite (prins, nu plecat)", gol.ok && gol.trimise >= 1 && !!m1, `trimise ${gol.trimise}`);
  v("e-mailul: către client, cu AWB-ul, ziua și „plătești curierului, cash”",
    m1 && m1.to?.[0]?.email === "proba@local.test" && m1.htmlContent.includes(r.awb) && /plătești curierului, cash/.test(m1.htmlContent) && /n-ai nevoie de imprimantă/.test(m1.htmlContent));
  v("rândul din coadă e marcat trimis", SQL(`select trimis_la is not null from email_coada where referinta_id=${c.id} and tip='return_requests'`) === "t");

  r = await formular(baza("AP-2026-90001", "Alt motiv", { colet: COLET }));
  v("a doua trimitere pe aceeași comandă → refuz, fără AWB nou", !r.ok && /există deja un AWB/.test(r.eroare));

  r = await formular(baza("ap 2026 90002", "Piesa este neconformă / nefuncțională"));
  if (r.awb) toateAwb.add(r.awb);
  v("„neconformă” + nr. scris liber + colet din AWB-ul de livrare → AWB, plătim NOI", r.ok && !!r.awb && r.plata === "firma", `AWB ${r.awb}`);
  c = cerere("ap 2026 90002");
  v("…coletul luat din livrare (3 kg, 50×30×20)", c?.awb_date?.greutate === 3 && c.awb_date.lungime === 50);
  await golesteCoada();
  const m2 = emailuri().find((e) => e.subject?.includes(r.awb));
  v("…e-mailul spune „Transportul îl plătim noi”", m2 && /îl plătim noi/.test(m2.htmlContent));

  for (const [mot, asteptat] of [["Renunț la produs (14 zile, OUG 34/2014)", "client"], ["Piesa nu se potrivește pe mașină", "client"]]) {
    const nr = mot.startsWith("Renunț") ? "AP-2026-90004" : "AP-2026-90005";
    r = await formular(baza(nr, mot, { colet: COLET }));
    if (r.awb) toateAwb.add(r.awb);
    v(`„${mot.slice(0, 28)}…” → plătește ${asteptat}`, r.ok && r.plata === asteptat, `AWB ${r.awb}`);
  }

  // ================= ADMIN =================
  console.log("\n— Panoul din admin (/api/awb-retur)");
  const c1 = cerere("AP-2026-90001");
  let a = await admin({ actiune: "pregateste", cerere_id: c1.id }, null);
  v("fără autentificare → 401", a.status === 401);
  a = await admin({ actiune: "pregateste", cerere_id: c1.id }, tok.client);
  v("cont de client (nu echipă) → 401", a.status === 401);
  a = await admin({ actiune: "pregateste", cerere_id: c1.id });
  v("echipa: „pregătește” dă AWB-ul, adresa și comanda", a.ok && a.awb === c1.awb && a.adresa?.localitate === "Cluj-Napoca" && a.comanda?.numar === "AP-2026-90001");

  let pdf = await fetch(`${SITE}/api/awb-retur?cerere_id=${c1.id}`);
  v("PDF fără autentificare → 401", pdf.status === 401);
  pdf = await fetch(`${SITE}/api/awb-retur?cerere_id=${c1.id}`, { headers: { Authorization: `Bearer ${tok.staff}` } });
  const octeti = Buffer.from(await pdf.arrayBuffer());
  v("„Vezi AWB-ul (PDF)” → PDF adevărat de la FAN", pdf.status === 200 && octeti.subarray(0, 4).toString() === "%PDF" && octeti.length > 1000, `${octeti.length} octeți`);

  // Modificare cu localitate greșită: AWB-ul vechi trebuie să rămână neatins.
  a = await admin({ actiune: "modifica", cerere_id: c1.id, plata: "client", data_ridicare: g.zile[2],
    colet: { colete: 1, ...COLET }, adresa: { ...ADR, localitate: "Localitate Inexistenta", strada: "X 1" } });
  const c1b = cerere("AP-2026-90001");
  v("modificare refuzată de FAN → eroare, AWB-ul vechi rămâne", !a.ok && c1b.awb === c1.awb && c1b.awb_curier_id === c1.awb_curier_id, a.eroare?.slice(0, 90));
  a = await admin({ actiune: "modifica", cerere_id: c1.id, data_ridicare: g.zile[2], colet: { colete: 1, ...COLET }, adresa: ADR });
  v("modificare fără „cine plătește” → refuz", !a.ok && /cine plătește/.test(a.eroare));

  const inainte = emailuri().length;
  a = await admin({ actiune: "modifica", cerere_id: c1.id, plata: "firma", data_ridicare: g.zile[2],
    colet: { colete: 1, greutate: "5", lungime: "60", latime: "40", inaltime: "30" },
    adresa: { ...ADR, strada: "Strada Memorandumului nr. 30" }, anunta_clientul: true });
  if (a.awb) toateAwb.add(a.awb);
  const c1c = cerere("AP-2026-90001");
  v("„Modifică” → AWB NOU, diferit de cel vechi", a.ok && !!a.awb && a.awb !== c1.awb, `${c1.awb} → ${a.awb}`);
  v("…curier nou comandat", !!a.comanda_curier && !a.eroare_curier);
  v("…fără avertismente (vechiul anulat și șters)", !/ATENȚIE/.test(a.nota ?? ""), a.nota);
  v("…cererea are datele noi (AWB, 5 kg, plătim noi, ziua nouă, strada nouă)",
    c1c.awb === a.awb && c1c.awb_date.greutate === 5 && c1c.awb_date.plata === "firma" && c1c.awb_date.data_ridicare === g.zile[2] && c1c.ridicare.strada.includes("nr. 30"));
  v("…ține minte AWB-ul anterior și că a venit din formular", c1c.awb_date.awb_anterior === c1.awb && c1c.awb_date.automat === true);
  const m3 = emailuri().slice(inainte).find((e) => e.subject?.includes(a.awb));
  v("…clientul primește e-mail cu AWB-ul NOU", !!m3 && m3.htmlContent.includes(a.awb) && !m3.htmlContent.includes(c1.awb) && /îl plătim noi/.test(m3.htmlContent), a.nota);
  v("…rândul din coadă e iar trimis (nu blocat)", SQL(`select (trimis_la is not null)::text || '|' || incercari from email_coada where referinta_id=${c1.id} and tip='return_requests'`) === "true|1");

  const c2 = cerere("ap 2026 90002"); const inainte2 = emailuri().length;
  a = await admin({ actiune: "modifica", cerere_id: c2.id, plata: "firma", data_ridicare: g.zile[1],
    colet: { colete: 1, greutate: "3", lungime: "50", latime: "30", inaltime: "20" }, adresa: ADR, anunta_clientul: false });
  if (a.awb) toateAwb.add(a.awb);
  v("„Modifică” cu bifa scoasă → AWB nou, FĂRĂ e-mail", a.ok && a.awb !== c2.awb && emailuri().length === inainte2);

  // Ștergere
  const c4 = cerere("AP-2026-90004");
  a = await admin({ actiune: "sterge", cerere_id: c4.id });
  const c4b = cerere("AP-2026-90004");
  v("„Șterge AWB-ul” → scos la FAN și din cerere", a.ok && !c4b.awb && !c4b.awb_curier_id && !c4b.awb_date, a.nota);
  a = await admin({ actiune: "sterge", cerere_id: c4.id });
  v("a doua ștergere → fără eroare", a.ok && a.deja);
  a = await admin({ actiune: "modifica", cerere_id: c4.id, plata: "client", colet: { colete: 1, ...COLET }, adresa: ADR });
  v("„Modifică” pe cerere fără AWB → refuz", !a.ok && /n-are AWB/.test(a.eroare));
  a = await admin({ actiune: "genereaza", cerere_id: c4.id, plata: "client", data_ridicare: g.zile[0], colet: { colete: 1, ...COLET }, adresa: ADR });
  if (a.awb) toateAwb.add(a.awb);
  v("„Generează manual” după ștergere → AWB nou", a.ok && !!a.awb);
  a = await admin({ actiune: "genereaza", cerere_id: c4.id, plata: "client", colet: { colete: 1, ...COLET }, adresa: ADR });
  v("„Generează” când există deja AWB → refuz (fără dublură)", !a.ok && /deja/.test(a.eroare));
  a = await admin({ actiune: "genereaza", cerere_id: c4.id, plata: "client", data_ridicare: "2020-01-01", colet: { colete: 1, ...COLET }, adresa: ADR });
  v("data în trecut → refuz", !a.ok);

  // Formularul după ștergerea din admin: se poate cere din nou.
  const c5 = cerere("AP-2026-90005");
  await admin({ actiune: "sterge", cerere_id: c5.id });
  r = await formular(baza("AP-2026-90005", "Alt motiv", { colet: COLET }));
  if (r.awb) toateAwb.add(r.awb);
  v("după „Șterge” din admin, clientul poate trimite iar formularul", r.ok && !!r.awb);
} catch (e) {
  v("testul a mers până la capăt", false, e?.stack ?? String(e));
} finally {
  // ================= CURĂȚENIA LA FAN =================
  console.log("\n— Curățenia la FAN");
  const vii = SQL("select coalesce(string_agg(id::text, ','), '') from return_requests where awb is not null").split(",").filter(Boolean);
  for (const id of vii) {
    const a = await admin({ actiune: "sterge", cerere_id: Number(id) });
    v(`cererea ${id}: AWB șters prin panou`, a.ok, a.nota || a.eroare);
  }
  // AWB-urile înlocuite la „Modifică” trebuie să fie deja șterse la FAN.
  execFileSync("npx", ["tsc", "lib/fancourier.ts", "--outDir", ".tmp-fan", "--module", "commonjs", "--target", "es2020",
    "--moduleResolution", "node", "--skipLibCheck", "--esModuleInterop", "--incremental", "false"], { cwd: `${S}site`, stdio: "inherit" });
  process.env.FANCOURIER_RETUR_USER = "clienttest@fancourier.ro"; process.env.FANCOURIER_RETUR_PASS = "testareFAN";
  const fan = createRequire(import.meta.url)(`${S}site/.tmp-fan/fancourier.js`);
  const cfg = { clientId: "323245", user: "clienttest@fancourier.ro", parola: "testareFAN", rambursInCont: false };
  for (const awb of toateAwb) {
    const x = await fan.stergeAwb(awb, cfg).catch((e) => `EROARE ${e.message}`);
    v(`AWB ${awb} nu mai există la FAN`, x === "nu_exista", x);
  }
  console.log(`\n${picate ? `VERIFICARE PICATĂ: ${picate} picate, ${trecute} trecute` : `REZULTAT OK: toate cele ${trecute} verificări au trecut`}`);
  process.exit(picate ? 1 : 0);
}
