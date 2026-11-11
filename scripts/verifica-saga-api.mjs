#!/usr/bin/env node
// ============================================================
// VERIFICĂRILE CLIENTULUI API SAGA (lib/saga-api.mjs) — pasul 7
//
// FĂRĂ cheia reală și FĂRĂ rețea: pornește pe 127.0.0.1 un server care IMITĂ
// SAGA WEB (200 XML, 400 JSON, 401, 403, 422, antetul X-Saga-Refresh-Token,
// întârzieri, conexiuni care atârnă) și cheamă funcțiile REALE din
// lib/saga-api.mjs, cu un depozit în memorie care se poartă ca tabelele din
// migrarea 52 (lacătul cu termen, rotirea condiționată de cheia veche).
// Cheia reală nu trece niciodată pe aici (decizia din 11 noiembrie 2026).
//
//   node scripts/verifica-saga-api.mjs
// Iese cu cod 1 la prima verificare picată.
// ============================================================
import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import {
  creeazaClientSaga, adresaApi, parseazaArticol, faraChei, EroareSaga,
  URL_API_IMPLICIT, COD_PROBA_INEXISTENT, MESAJ_CHEIE_BLOCATA, LACAT_SECUNDE,
} from "../lib/saga-api.mjs";

let n = 0;
function ok(cond, ce) { if (!cond) { console.error(`PICAT: ${ce}`); process.exit(1); } n++; }
async function arunca(fn, cod, ce) {
  try { await fn(); } catch (e) {
    if (!(e instanceof EroareSaga)) { console.error(`PICAT: ${ce} — eroare de alt tip: ${e?.message ?? e}`); process.exit(1); }
    if (cod && e.cod !== cod) { console.error(`PICAT: ${ce} — cod „${e.cod}”, aștept „${cod}” (${e.message})`); process.exit(1); }
    n++; return e;
  }
  console.error(`PICAT: ${ce} — trebuia să arunce eroare`); process.exit(1);
}
const asteapta = (ms) => new Promise((r) => setTimeout(r, ms));

const K1 = "CHEIE-SIMULATA-VECHE-0001";
const K2 = "CHEIE-SIMULATA-NOUA-0002";
const K3 = "CHEIE-SIMULATA-A-TREIA-0003";
const CIF = "RO36608590";

// ---------- depozitul în memorie (ca migrarea 52) ----------
function depozitNou(cheie = K1) {
  const d = {
    cheie, rotiri: 0, blocata: null, folosita: 0, jurnalRanduri: [],
    lacat: { detinator: null, pana: -Infinity },
    rotireLa: null, rotesteMereuFals: false, apeluriLacat: 0,
    async iaBlocarea(id, sec) {
      d.apeluriLacat++;
      if (d.lacat.pana >= Date.now()) return false;
      d.lacat = { detinator: id, pana: Date.now() + sec * 1000 }; return true;
    },
    async elibereaza(id) { if (d.lacat.detinator === id && d.lacat.pana >= Date.now()) { d.lacat.pana = -Infinity; return true; } return false; },
    async citesteCheia() { return d.cheie; },
    async rotesteCheia(veche, noua) {
      if (d.rotesteMereuFals) return false;
      if (d.cheie !== veche || !noua) return false;
      d.cheie = noua; d.rotiri++; d.blocata = null; d.rotireLa = Date.now(); return true;
    },
    async salveazaCheia(c) { d.cheie = c; d.rotiri = 0; d.blocata = null; },
    async marcheazaFolosita() { d.folosita++; },
    async marcheazaBlocata(motiv) { d.blocata = motiv; },
    async jurnal(r) { d.jurnalRanduri.push(r); },
  };
  return d;
}

// ---------- SAGA simulat ----------
const cereri = [];          // ce a primit serverul
let raspuns = null;         // (req, res) => void — comportamentul următor
let finalCorpLa = null;
const server = http.createServer((req, res) => {
  cereri.push({ metoda: req.method, cale: req.url, auth: req.headers.authorization, cif: req.headers["x-saga-cod-fiscal"] });
  (raspuns ?? ((_, r) => { r.writeHead(500); r.end("fără comportament"); }))(req, res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const URL_SIM = `http://127.0.0.1:${port}/api/v20260225`;

const XML_ARTICOL = `<Articol><Denumire>ACCESORII AUTO &amp; CO</Denumire><TVA>21</TVA><UM>BUC</UM>
<Pret_Vanzare1>0</Pret_Vanzare1><Cod_Bare></Cod_Bare><Cod_Propriu>ART1</Cod_Propriu></Articol>`;
const raspunde = (status, corp, antete = {}) => (_, res) => { res.writeHead(status, antete); res.end(corp); };

function client(d, extra = {}) { return creeazaClientSaga({ depozit: d, url: URL_SIM, cif: CIF, ...extra }); }

// ============================================================
// 1. Adresa API-ului
ok(adresaApi("") === URL_API_IMPLICIT, "adresa goală → cea din documentație");
ok(adresaApi("https://web.sagasoft.ro/api/v2/") === "https://web.sagasoft.ro/api/v2", "bara finală scoasă");
await arunca(() => adresaApi("http://web.sagasoft.ro/api"), "config", "adresa http (nu https) refuzată");
await arunca(() => adresaApi("ftp://x"), "config", "adresa ne-web refuzată");

// 2. GetArticol 200: antetele, calea, articolul citit
let d = depozitNou();
raspuns = raspunde(200, XML_ARTICOL, { "content-type": "application/xml" });
let r = await client(d).getArticol("ART 1");
let c = cereri.at(-1);
ok(c.metoda === "GET" && c.cale === "/api/v20260225/Situatii/GetArticol?codArticol=ART%201", `calea și metoda GetArticol (${c.metoda} ${c.cale})`);
ok(c.auth === `Bearer ${K1}`, "antetul Authorization: Bearer <cheie>");
ok(c.cif === CIF, "antetul X-Saga-Cod-Fiscal");
ok(r.exista === true && r.articol.denumire === "ACCESORII AUTO & CO" && r.articol.um === "BUC" && r.articol.cod_propriu === "ART1", "articolul citit din XML");
ok(d.jurnalRanduri.length === 1 && d.jurnalRanduri[0].tip === "get_articol" && d.jurnalRanduri[0].http_status === 200, "jurnalul apelului");
ok(d.lacat.pana === -Infinity, "lacătul eliberat după apel");
ok(d.folosita === 1, "cheia marcată ca folosită");

// 3. GetArticol 400 → „cod inexistent”, nu eroare
raspuns = raspunde(400, JSON.stringify({ success: false, error: "Nu ati trimis un cod de articol valid" }), { "content-type": "application/json" });
r = await client(d).getArticol("NU-EXISTA");
ok(r.exista === false && r.mesaj === "Nu ati trimis un cod de articol valid", "400 → exista: false, cu mesajul SAGA");
await arunca(() => client(d).getArticol("  "), "intrare", "cod gol refuzat fără apel");

// 4. ROTIREA pe 200, salvată ÎNAINTE de corp; apelul următor folosește cheia nouă
d = depozitNou();
raspuns = (_, res) => {
  res.writeHead(200, { "content-type": "application/xml", "X-Saga-Refresh-Token": K2 });
  res.write("<Articol><Denumire>");
  setTimeout(() => { finalCorpLa = Date.now(); res.end("X</Denumire></Articol>"); }, 250);
};
r = await client(d).getArticol("ART1");
ok(d.cheie === K2 && d.rotiri === 1, "cheia rotită salvată");
ok(d.rotireLa !== null && d.rotireLa < finalCorpLa, "cheia nouă salvată ÎNAINTE de citirea corpului");
ok(r.rotita === true && d.jurnalRanduri.at(-1).cheie_rotita === true, "rotirea notată în rezultat și în jurnal");
raspuns = raspunde(200, XML_ARTICOL);
await client(d).getArticol("ART1");
ok(cereri.at(-1).auth === `Bearer ${K2}`, "apelul următor folosește cheia NOUĂ");

// 5. Rotirea și pe răspunsuri de eroare (422 / 500)
raspuns = raspunde(422, "Raport ...", { "X-Saga-Refresh-Token": K3 });
await arunca(() => client(d).getArticol("ART1"), "neasteptat", "422 la GetArticol → eroare");
ok(d.cheie === K3 && d.rotiri === 2, "cheia rotită salvată și la un răspuns de eroare");
ok(d.lacat.pana === -Infinity, "lacătul eliberat după eroare");
raspuns = raspunde(200, XML_ARTICOL, { "X-Saga-Refresh-Token": K3 });
await client(d).getArticol("ART1");
ok(d.rotiri === 2, "același token ca cheia curentă nu e o rotire");

// 6. Cheie blocată: 401 și 403
for (const st of [401, 403]) {
  d = depozitNou();
  raspuns = raspunde(st, "Unauthorized");
  const e = await arunca(() => client(d).getArticol("ART1"), "cheie_blocata", `${st} → cheie blocată`);
  ok(e.message === MESAJ_CHEIE_BLOCATA && /SAGA WEB/.test(e.message) && /Salvează cheia/.test(e.message), `${st}: mesajul spune să se regenereze din SAGA WEB și să se salveze în admin`);
  ok(d.blocata === `HTTP ${st}` && d.lacat.pana === -Infinity, `${st}: cheia marcată blocată, lacătul eliberat`);
}

// 7. Rotire primită, dar NESALVATĂ → eroare clară, cheia marcată
d = depozitNou(); d.rotesteMereuFals = true;
raspuns = raspunde(200, XML_ARTICOL, { "X-Saga-Refresh-Token": K2 });
const ep = await arunca(() => client(d).getArticol("ART1"), "rotire_pierduta", "rotire nesalvată → eroare");
ok(/NU s-a putut salva/.test(ep.message) && d.blocata === "rotire nesalvată", "rotirea pierdută: mesaj și marcaj");

// 8. Un singur apel o dată: două simultane → unul refuzat, la server ajunge unul
d = depozitNou();
raspuns = (_, res) => setTimeout(() => { res.writeHead(200); res.end(XML_ARTICOL); }, 200);
const inainte = cereri.length;
const rez = await Promise.allSettled([client(d).getArticol("A"), client(d).getArticol("B")]);
ok(rez.filter((x) => x.status === "fulfilled").length === 1, "două apeluri simultane: unul singur trece");
ok(rez.some((x) => x.status === "rejected" && x.reason?.cod === "ocupat"), "al doilea: „o operație SAGA e deja în curs”");
ok(cereri.length - inainte === 1, "la SAGA a ajuns un singur apel");
ok(d.lacat.pana === -Infinity, "lacătul eliberat după apelul reușit");

// 9. Termenul lacătului (o funcție omorâtă nu blochează pentru totdeauna)
ok(LACAT_SECUNDE > 60, "termenul lacătului e peste limita de 60 s a unei funcții");
d = depozitNou(); d.lacat = { detinator: "omorat", pana: Date.now() - 1 };
raspuns = raspunde(200, XML_ARTICOL);
await client(d).getArticol("ART1");
ok(d.jurnalRanduri.length === 1, "lacătul expirat al unei funcții omorâte se poate lua");

// 10. Timeout și rețea căzută → eroare, lacăt eliberat, apelul următor merge
d = depozitNou();
raspuns = () => { /* atârnă */ };
await arunca(() => client(d, { timeoutMs: 200 }).getArticol("ART1"), "retea", "fără răspuns → eroare de rețea");
ok(d.lacat.pana === -Infinity && /Fără răspuns/.test(d.jurnalRanduri.at(-1).eroare), "timeout: lacăt eliberat, notat în jurnal");
await arunca(() => creeazaClientSaga({ depozit: d, url: "http://127.0.0.1:1/api", cif: CIF }).getArticol("ART1"), "retea", "port închis → eroare de rețea");
ok(d.lacat.pana === -Infinity, "rețea căzută: lacăt eliberat");

// 11. Fără cheie / fără CIF → refuz FĂRĂ apel la SAGA
d = depozitNou(null);
let inainte2 = cereri.length;
await arunca(() => client(d).getArticol("ART1"), "fara_cheie", "fără cheie salvată → refuz");
await arunca(() => creeazaClientSaga({ depozit: depozitNou(), url: URL_SIM, cif: "" }).getArticol("ART1"), "config", "fără cod fiscal → refuz");
ok(cereri.length === inainte2 && d.lacat.pana === -Infinity, "niciun apel la SAGA, lacătul eliberat");

// 12. „Testează conexiunea” — doar GetArticol, niciodată Import
d = depozitNou();
raspuns = raspunde(400, JSON.stringify({ success: false, error: "Nu ati trimis un cod de articol valid" }));
r = await client(d).testeazaConexiunea({});
ok(r.cod === COD_PROBA_INEXISTENT && r.exista === false && d.jurnalRanduri.at(-1).tip === "test", "test fără articol implicit: codul de probă, 400, tip „test”");
raspuns = raspunde(200, XML_ARTICOL);
r = await client(d).testeazaConexiunea({ cod: "ART1" });
ok(r.exista === true && cereri.at(-1).cale.endsWith("codArticol=ART1"), "test cu articolul implicit");
ok(cereri.every((x) => x.metoda === "GET" && !/\/Import/i.test(x.cale)), "simulatorul n-a primit nicio cerere de Import și nimic în afară de GET");

// 13. Salvarea cheii din admin — sub lacăt, cu validare
d = depozitNou();
await client(d).salveazaCheia("  CHEIE-NOUA-DIN-ADMIN-9  ");
ok(d.cheie === "CHEIE-NOUA-DIN-ADMIN-9" && d.lacat.pana === -Infinity, "cheia salvată (fără spații la capete), lacăt eliberat");
await arunca(() => client(d).salveazaCheia("scurta"), "intrare", "cheie prea scurtă refuzată");
await arunca(() => client(d).salveazaCheia("are spatiu in 0123456789"), "intrare", "cheie cu spații refuzată");
d.lacat = { detinator: "altcineva", pana: Date.now() + 60_000 };
await arunca(() => client(d).salveazaCheia("CHEIE-IN-TIMPUL-APELULUI"), "ocupat", "salvarea refuzată cât un apel e în curs");
ok(d.cheie === "CHEIE-NOUA-DIN-ADMIN-9", "cheia nu s-a schimbat în timpul unui apel");

// 14. CHEIA NU APARE NICĂIERI (nici dacă SAGA o scrie în corp)
d = depozitNou();
raspuns = raspunde(422, `eroare pentru cheia ${K1} si ${K2}`, { "X-Saga-Refresh-Token": K2 });
const e14 = await arunca(() => client(d).getArticol("ART1"), "neasteptat", "422 cu cheile în corp");
const totText = JSON.stringify(d.jurnalRanduri) + e14.message + JSON.stringify(rez.map((x) => x.reason?.message ?? x.value));
ok(!totText.includes(K1) && !totText.includes(K2) && /\[cheie ascunsă\]/.test(JSON.stringify(d.jurnalRanduri)), "cheia (veche și nouă) lipsește din jurnal și din erori");
ok(faraChei("a CHEIE-SIMULATA b", ["CHEIE-SIMULATA"]) === "a [cheie ascunsă] b", "faraChei");
ok(parseazaArticol("<Articol><UM>KG</UM></Articol>").denumire === null, "parseazaArticol: câmp lipsă → null");

// 15. Verificări statice: un singur loc cu cheia, fără Import în pasul 7, fără cheie în mediu
const fis = ["lib/saga-api.mjs", "lib/saga.ts", "app/api/saga/route.ts"].filter((f) => existsSync(f));
ok(fis.length === 3, "fișierele pasului 7 există");
const continut = Object.fromEntries(fis.map((f) => [f, readFileSync(f, "utf8")]));
ok(fis.every((f) => !/["'`]\/Import/.test(continut[f])), "nicio cale „/Import” în codul pasului 7");
ok(fis.every((f) => !/process\.env\.\w*SAGA\w*(CHEIE|KEY|TOKEN)/i.test(continut[f])), "cheia SAGA nu se citește din variabile de mediu");
ok(!/x-saga-refresh-token|saga_roteste_cheia/i.test(continut["app/api/saga/route.ts"]), "ruta nu rotește cheia (o face doar lib/saga-api.mjs)");
ok(/saga_roteste_cheia/.test(continut["lib/saga.ts"]) && !/X-Saga-Refresh-Token|ANTET_ROTIRE/i.test(continut["lib/saga.ts"]), "lib/saga.ts doar dă depozitul; antetul de rotire îl citește doar lib/saga-api.mjs");

server.close();
console.log(`TOATE CELE ${n} VERIFICĂRI ALE CLIENTULUI SAGA AU TRECUT`);
