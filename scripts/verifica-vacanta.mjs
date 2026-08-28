// ============================================================
// VERIFICAREA MODULUI VACANȚĂ — cele 7 puncte din sarcină, pe baza reală.
//
// Modul vacanță se sprijină pe o singură promisiune: NU atinge catalogul.
// Promisiunea aia nu se poate verifica citind codul, fiindcă exact defectul de
// care ne temem — o scriere în `products` — ar fi invizibil până la dezactivare,
// când piesele ascunse de operator ar reapărea pe site.
//
// Deci se verifică prin măsurare: se ia o amprentă a întregului catalog (id +
// publicat + stoc), se face un ciclu activare/dezactivare, se ia amprenta din
// nou și se compară. Dacă diferă cu un singur rând, ceva scrie unde n-ar trebui.
//
// ⚠ RULEAZĂ PE BAZA REALĂ și comută vacanța pentru câteva secunde. Site-ul chiar
//   se oprește în intervalul ăsta. La final o lasă DEZACTIVATĂ, indiferent cum a
//   fost înainte — dacă era activă, o reactivezi din admin.
//
//   node scripts/verifica-vacanta.mjs
//
// Iese cu cod 1 dacă vreo verificare pică.
// ============================================================
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Lipsesc NEXT_PUBLIC_SUPABASE_URL sau SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

let treceri = 0, picate = 0;
const cer = (eticheta, conditie, detaliu = "") => {
  if (conditie) { treceri++; console.log(`  ✓ ${eticheta}`); }
  else { picate++; console.log(`  ✗ ${eticheta}${detaliu ? ` — ${detaliu}` : ""}`); }
};

async function rest(cale, opt = {}) {
  const r = await fetch(`${url}/rest/v1/${cale}`, { ...opt, headers: { ...h, ...(opt.headers ?? {}) } });
  const t = await r.text();
  if (!r.ok) throw new Error(`${opt.method ?? "GET"} ${cale.split("?")[0]}: HTTP ${r.status} ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : null;
}

/** Amprenta catalogului: fiecare piesă cu starea care contează pentru afișare.
 *  Se citește paginat — peste 1.000 de rânduri PostgREST taie tăcut, iar o
 *  amprentă calculată pe o felie ar trece verificarea fără să demonstreze nimic. */
async function amprenta() {
  const out = [];
  for (let de = 0; ; de += 1000) {
    const lot = await rest(`products?select=id,publicat,stoc,sursa_activ&order=id&limit=1000&offset=${de}`);
    out.push(...lot);
    if (lot.length < 1000) break;
  }
  return { n: out.length, sir: out.map((p) => `${p.id}:${p.publicat ? 1 : 0}:${p.stoc}:${p.sursa_activ ? 1 : 0}`).join("|") };
}

const setVacanta = (valoare) =>
  rest("settings?cheie=eq.vacanta", { method: "PATCH", body: JSON.stringify({ valoare }) });

const citesteVacanta = async () =>
  (await rest("settings?cheie=eq.vacanta&select=valoare"))?.[0]?.valoare ?? null;

/** Cheamă `plaseaza_comanda` exact cum ar face-o browserul cuiva care are pagina
 *  de checkout deja deschisă. Cu vacanța activă, garda respinge ÎNAINTE de orice
 *  scriere, deci apelul e sigur: nu scade niciun stoc și nu creează nicio comandă.
 *  Se rulează DOAR cât timp vacanța e activă, tocmai fiindcă altfel ar plasa o
 *  comandă adevărată și ar scoate din stoc o piesă unicat. */
async function incearcaComanda(idPiesa) {
  return rest("rpc/plaseaza_comanda", {
    method: "POST",
    body: JSON.stringify({
      p_client: { nume: "VERIFICARE AUTOMATĂ", email: "verificare@exemplu.invalid", telefon: "0700000000",
                  adresa: "—", oras: "—", judet: "—", gdpr: true },
      p_items: [{ id: idPiesa, cantitate: 1 }],
      p_curier: "fan", p_plata: "ramburs",
    }),
  });
}

/** Sondă fără efecte secundare: coș GOL. Garda de vacanță e prima verificare din
 *  funcție, iar „coșul e gol" e a doua. Deci răspunsul spune exact care dintre
 *  ele a răspuns, fără să atingă nimic — se poate rula și cu vacanța oprită. */
const sondaGol = () =>
  rest("rpc/plaseaza_comanda", {
    method: "POST",
    body: JSON.stringify({ p_client: {}, p_items: [], p_curier: "fan", p_plata: "ramburs" }),
  });

console.log("VERIFICAREA MODULUI VACANȚĂ — pe baza reală\n");

const initial = await citesteVacanta();
if (initial === null) {
  console.error("Nu există cheia „vacanta” în settings. Rulează întâi supabase/mod-vacanta.sql.");
  process.exit(1);
}
console.log(`stare la început: ${initial.activ ? "ACTIVĂ" : "inactivă"}\n`);

// o piesă publicată, pe stoc — ținta încercării de comandă
const tinta = (await rest("products?select=id,nume&publicat=eq.true&stoc=gt.0&limit=1"))?.[0];
if (!tinta) { console.error("Nicio piesă publicată pe stoc; verificarea 4 n-ar demonstra nimic."); process.exit(1); }

const inainte = await amprenta();
console.log(`── amprenta catalogului: ${inainte.n} piese\n`);

// ---------- ACTIVARE ----------
console.log("── activez modul vacanță");
await setVacanta({ activ: true, mesaj: "Verificare automată — se dezactivează singur.",
                   data_activarii: new Date().toISOString(), activat_de: "scripts/verifica-vacanta.mjs" });

const dupaActivare = await amprenta();
cer("6. activarea NU scrie nimic în products",
    dupaActivare.sir === inainte.sir && dupaActivare.n === inainte.n,
    `${dupaActivare.n} piese, amprentă ${dupaActivare.sir === inainte.sir ? "identică" : "SCHIMBATĂ"}`);

const pub = await rest("rpc/vacanta_publica", { method: "POST", body: "{}" });
cer("site-ul public vede vacanța activă", pub?.activ === true, JSON.stringify(pub));
cer("mesajul ajunge la site", typeof pub?.mesaj === "string" && pub.mesaj.length > 0);

const refuz = await incearcaComanda(tinta.id);
cer("4. un POST direct către plaseaza_comanda e REFUZAT",
    refuz?.ok === false && refuz?.vacanta === true, JSON.stringify(refuz));

const gardaPrima = await sondaGol();
cer("garda de vacanță răspunde ÎNAINTEA oricărei alte verificări",
    gardaPrima?.vacanta === true, JSON.stringify(gardaPrima));

const dupaIncercare = await amprenta();
cer("încercarea de comandă n-a atins stocul",
    dupaIncercare.sir === inainte.sir);

const comenziNoi = await rest("orders?select=id&nume=eq.VERIFICARE%20AUTOMAT%C4%82");
cer("nicio comandă n-a fost creată", (comenziNoi ?? []).length === 0, JSON.stringify(comenziNoi));

// ---------- DEZACTIVARE ----------
console.log("\n── dezactivez modul vacanță");
await setVacanta({ activ: false, mesaj: "", data_activarii: null, activat_de: null });

const dupa = await amprenta();
cer("1. după ciclu, exact aceleași piese: nici una în plus, nici una în minus",
    dupa.n === inainte.n && dupa.sir === inainte.sir,
    `${inainte.n} → ${dupa.n}`);

// 2 și 3 sunt cazuri particulare ale lui 1, dar se verifică explicit: sunt
// exact defectele pe care implementarea „update products set publicat" le-ar fi
// produs, iar o amprentă identică e mai ușor de crezut dacă e și numărată.
const ascunse = await rest("products?select=id&publicat=eq.false&limit=1000");
const faraStoc = await rest("products?select=id&stoc=eq.0&limit=1000");
const ascunseSir = (ascunse ?? []).map((x) => x.id).join(",");
const faraStocSir = (faraStoc ?? []).map((x) => x.id).join(",");
const inainteAscunse = inainte.sir.split("|").filter((x) => x.split(":")[1] === "0").map((x) => x.split(":")[0]).join(",");
const inainteFaraStoc = inainte.sir.split("|").filter((x) => x.split(":")[2] === "0").map((x) => x.split(":")[0]).join(",");
cer("2. piesele ascunse de operator au rămas ascunse",
    ascunseSir === inainteAscunse, `${(ascunse ?? []).length} nepublicate`);
cer("3. piesele cu stoc 0 nu au reapărut",
    faraStocSir === inainteFaraStoc, `${(faraStoc ?? []).length} cu stoc 0`);

const dupaPub = await rest("rpc/vacanta_publica", { method: "POST", body: "{}" });
cer("site-ul public vede vacanța inactivă", dupaPub?.activ === false, JSON.stringify(dupaPub));

// După dezactivare NU se mai încearcă o comandă adevărată: ar reuși, ar scădea
// stocul unei piese unicat și ar lăsa o comandă de șters. Sonda cu coșul gol
// spune tot ce trebuie — dacă răspunde „Coșul este gol", înseamnă că a trecut
// de gardă, deci garda nu mai respinge.
const dupaGarda = await sondaGol();
cer("după dezactivare, garda nu mai respinge (răspunde verificarea următoare)",
    dupaGarda?.vacanta !== true && dupaGarda?.ok === false, JSON.stringify(dupaGarda));

console.log(`\n5. Coșul e în localStorage, în browser — nu se poate verifica de aici.`);
console.log(`7. Înălțimea hello bar-ului la 320px se verifică cu scripts/scan-responsive.mjs.`);
console.log(`\n=== ${treceri} verificări trec · ${picate} pică ===`);
console.log(`Modul vacanță a rămas DEZACTIVAT. Starea de la început era: ${initial.activ ? "ACTIVĂ" : "inactivă"}.`);
if (picate) process.exit(1);
