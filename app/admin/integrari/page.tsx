"use client";
// INTEGRĂRI — o listă compactă: un rând pe integrare, cu starea REALĂ (din configurarea
// salvată) și o propoziție. Se deschide câte una (adresa păstrează ancora: #olx, #saga…),
// iar pașii de configurare stau restrânși — deschiși doar cât integrarea nu e pornită.
import { useEffect, useState, useCallback } from "react";
import { sbBrowser, scrieVerificat } from "@/lib/supabase";
import { golesteCachePublic } from "@/lib/settings";

type Stare = "activ" | "pregatit" | "viitor";
type Integrare = {
  id: string; nume: string; grup: string;
  /** Starea când configurarea nu spune altceva (integrările fără bifă „Activă”). */
  stare: Stare;
  rezumat: string; desc: string; pasi: string[];
};

const INTEGRARI: Integrare[] = [
  { id: "whatsapp", nume: "WhatsApp Business", grup: "Comunicare", stare: "activ",
    rezumat: "Butonul de pe site și mesajele precompletate din admin.",
    desc: "Buton plutitor pe tot site-ul, cu mesaje precompletate (numele piesei și codul OEM). În admin: buton direct pe fiecare comandă și cerere.",
    pasi: ["Numărul se schimbă din Vercel → Settings → Environment Variables → NEXT_PUBLIC_WHATSAPP_PHONE (format 40722XXXXXX)"] },
  { id: "email", nume: "E-mail automat (Brevo)", grup: "Comunicare", stare: "pregatit",
    rezumat: "Confirmarea comenzii către client și anunțul de comandă nouă către tine.",
    desc: "Rândul intră în coadă în aceeași tranzacție cu comanda, deci un client care închide tabul imediat după plasare nu te lasă neanunțat. Cât timp integrarea e oprită, nu pleacă niciun mesaj și nu se pierde nimic — coada așteaptă. Confirmarea NU conține costul livrării.",
    pasi: ["Domeniul verificat la Brevo și redirecționarea contact@ (ImprovMX) — vezi docs/email.md",
           "Brevo → SMTP & API → Generate a new API key → o lipești mai jos",
           "Adresa de notificări: unde primești anunțul de comandă nouă",
           "Bifezi „Activă”, salvezi, apoi „Trimite un test” (verifici și Spam)"] },
  { id: "saga", nume: "Saga — facturare", grup: "Facturare", stare: "activ",
    rezumat: "Facturile se emit din comandă și se trimit în SAGA cu un buton.",
    desc: "În SAGA le verifici și le validezi, apoi le trimiți în e-Factura tot din SAGA. Comenzile facturate direct în SAGA se notează pe comandă.",
    pasi: ["Comanda → „Emite factura”", "Factura → „Trimite în SAGA”",
           "În SAGA: Diverse → Import date → verifici și validezi; apoi e-Factura din SAGA",
           "Înapoi în admin: „Marchează confirmată”"] },
  { id: "efactura", nume: "e-Factura ANAF (SPV)", grup: "Facturare", stare: "activ",
    rezumat: "Se trimite din SAGA, după validare — din admin nu pleacă nimic la ANAF.",
    desc: "Facturile ajung în e-Factura din SAGA, după ce le validezi acolo. Așa nu pleacă nicio factură de două ori.",
    pasi: ["Validezi factura în SAGA", "O trimiți în e-Factura din SAGA"] },
  { id: "fan", nume: "FAN Courier (SelfAWB)", grup: "Curieri", stare: "pregatit",
    rezumat: "Calculul transportului și AWB-ul, direct din pagina comenzii.",
    desc: "În comandă scrii coletele și kilogramele (dimensiunile sunt opționale): calculatorul dă prețul FAN, apoi „Generează AWB”. Destinatarul și rambursul (doar valoarea pieselor) vin din comandă. Transportul îl încasează FAN direct de la client. Eticheta se printează din același loc; AWB-ul apare și pe selfawb.ro.",
    pasi: ["Pe selfawb.ro: Client ID-ul e în dreapta sus → Editare cont → Opțiuni sucursală",
           "Completezi mai jos Client ID, utilizatorul și parola de pe selfawb.ro, salvezi",
           "„Verifică conexiunea” — trebuie să apară serviciile contului"] },
  { id: "fan_retur", nume: "FAN Courier — retururi", grup: "Curieri", stare: "viitor",
    rezumat: "AWB de retur cu ridicare de la client — așteaptă contul ocazional FAN.",
    desc: "Se generează din Admin → Cereri → Retururi, pe cererea clientului; adresa vine din comanda lui. Comanda de curier se plasează automat, iar eticheta o aduce curierul printată. Codul e gata și testat pe contul de probă FAN.",
    pasi: ["Creezi în SelfAWB un cont de client OCAZIONAL (fără contract) — altul decât contul de livrare",
           "Trimiți la cristian.branzan@fancourier.ro adresa de e-mail a contului și numele clientului cu contract de care se asociază plata",
           "FAN răspunde cu Client ID-ul contului ocazional și cu valoarea pentru „payment” — le pui mai jos",
           "„Verifică retururile” — trebuie să apară serviciile contului",
           "⚠ „payment” NU se ghicește: API-ul acceptă orice valoare, dar plata ajunge pe cine nu trebuie"] },
  { id: "card", nume: "Plată cu cardul (Netopia / Stripe)", grup: "Plăți", stare: "viitor",
    rezumat: "Plata online — acum se plătește doar ramburs la livrare.",
    desc: "Cardul online cere contract cu procesatorul și verificare KYC.",
    pasi: ["Contul la procesator", "Cheile API", "Pasul de plată în checkout"] },
  { id: "dezro", nume: "dez.ro — anunțuri", grup: "Anunțuri și reclame", stare: "pregatit",
    rezumat: "Piesele publicate pleacă automat ca anunțuri; vândutele se retrag singure.",
    desc: "Prețul se ține la zi singur, iar anunțul unei piese vândute se retrage automat. Publicarea și potrivirile se fac din Admin → Anunțuri dez.ro. Locul de livrare îl iau ei din profilul contului de pe dez.ro.",
    pasi: ["Cheia API primită de la dez.ro, utilizatorul și parola contului (vânzătorul)",
           "Bifezi „Activă”, salvezi, apoi Admin → Anunțuri dez.ro → „Testează conexiunea”"] },
  { id: "olx", nume: "OLX — anunțuri", grup: "Anunțuri și reclame", stare: "pregatit",
    rezumat: "Anunțuri pe contul OLX business, prin OLX Partner API.",
    desc: "Aplicația NU cumpără nimic (pachete, promovări). Datele aplicației și tokenii stau doar în bază, într-o tabelă pe care browserul n-o poate citi. Anunțurile vechi, puse manual pe cont, nu se ating.",
    pasi: ["client_id și client_secret de la OLX → „Salvează aplicația”",
           "„Conectează OLX” → autentificare cu contul business și acceptarea aplicației",
           "„Testează conexiunea” → numele contului",
           "Orașul (după coordonate) și numele de contact → „Salvează setările”",
           "Potrivirea categoriilor OLX — făcută; se schimbă doar la o categorie nouă (link mai jos)"] },
  { id: "merchant", nume: "Google Merchant Center", grup: "Anunțuri și reclame", stare: "activ",
    rezumat: "Feed-ul de produse pentru Google Shopping: /feed/google.xml.",
    desc: "Feed-ul se reîmprospătează singur la 3 ore și conține toate piesele publicate, cu poză și preț. Adresa completă și numărul de produse: Admin → Feed și export.",
    pasi: ["Merchant Center → revendici domeniul (e verificat în Search Console)",
           "Produse → Feeduri → Adaugă → „Preluare programată” → adresa /feed/google.xml",
           "Setări → Livrare: un tarif fix (costul real se comunică după comandă)"] },
  { id: "google_ads", nume: "Google Ads", grup: "Anunțuri și reclame", stare: "pregatit",
    rezumat: "Conversia „comandă plasată”, cu valoarea calculată de server.",
    desc: "Se încarcă DOAR pentru vizitatorii care acceptă cookie-urile de publicitate. Conversia pleacă cu numărul comenzii, deci nu se poate număra de două ori.",
    pasi: ["Google Ads → Instrumente → Conversii → acțiunea „Achiziție” (Site web, valoare din cod)",
           "ID-ul contului (AW-…) și eticheta conversiei (partea de după bară) → mai jos, salvezi",
           "Legi Google Ads cu GA4 și cu Merchant Center"] },
  { id: "meta", nume: "Meta — Facebook și Instagram", grup: "Anunțuri și reclame", stare: "pregatit",
    rezumat: "Pixelul și catalogul pentru reclamele Facebook / Instagram.",
    desc: "Catalogul se ia singur de la /feed/meta.csv. Pixelul trimite aceleași evenimente ca Analytics, cu aceleași id-uri de produs ca feed-ul.",
    pasi: ["Business Manager → Evenimente → creezi pixelul, copiezi ID-ul (15 cifre)",
           "Business Manager → Setări → Domenii → codul de verificare",
           "Le lipești mai jos și salvezi",
           "Commerce Manager → Catalog → Surse de date → Feed programat → /feed/meta.csv, la 4–6 ore"] },
  { id: "ga4", nume: "Google Analytics 4", grup: "Analiză", stare: "pregatit",
    rezumat: "Statistici de vizitare — doar pentru cine acceptă cookie-urile.",
    desc: "Cât timp ID-ul lipsește, în site nu se încarcă niciun script Google. Evenimentele de comerț sunt deja legate; traficul din /admin nu se numără.",
    pasi: ["Cont GA4 → ID de măsurare (G-XXXXXXX) → mai jos, salvezi", "GA4 → Rapoarte → Timp real: verifici că apari"] },
];

const ETICHETE: Record<Stare, [string, string]> = {
  activ: ["bg-ok/10 text-ok border-ok/30", "Activ"],
  pregatit: ["bg-yellow-50 text-yellow-800 border-yellow-300", "De configurat"],
  viitor: ["bg-paper text-mut border-line", "Fază următoare"],
};

// câmpurile de configurare salvate în baza de date (settings → integrari)
// `avansat`: câmpul stă în „Setări avansate”, restrânsă — setări care nu se mai schimbă după pornire.
const CAMPURI: Record<string, { k: string; l: string; tip?: string; avansat?: boolean }[]> = {
  "WhatsApp Business": [{ k: "numar", l: "Număr WhatsApp (format 40722…)" }],
  // Cota și regimul TVA le citește baza (`saga_cota_tva`, migrarea 48) la exportul
  // CSV și, de la pasul 4 din docs/saga-plan.md, la emiterea facturilor. Gol = 21%,
  // regim normal (confirmate de pe factura reală, 10 noiembrie 2026).
  // „Seria facturilor” a ieșit de aici la pasul 5: seria se setează în Facturi →
  // Setări serie (`facturi_serii`). Valoarea veche din bază rămâne, nefolosită —
  // salvarea pornește din configurarea existentă, deci n-o șterge.
  // Articolele (pasul 5, docs/saga-plan.md A.5): codul și denumirea EXACT ca în
  // gestiunea SAGA. Implicitul primește piesele fără potrivire în Facturi →
  // Articole SAGA; reducerea și transportul, goale, cad și ele pe implicit.
  "Saga — facturare": [
    { k: "mentiune_plata", l: "Mențiunea de plată de pe factură (de ex. ramburs in cont)" },
    { k: "articol_implicit", l: "Articolul din SAGA pentru piese — codul" },
    { k: "articol_implicit_denumire", l: "Articolul pentru piese — denumirea, exact ca în SAGA" },
    { k: "articol_implicit_um", l: "Articolul pentru piese — unitatea de măsură (gol = BUC)" },
    // Setări fixe după pornire (11 noiembrie 2026) — restrânse, ca să nu se schimbe din greșeală.
    { k: "cota_tva", l: "Cota TVA, în procente (gol = 21)", avansat: true },
    { k: "regim_tva", l: "Regimul TVA (gol = normal)", avansat: true },
    { k: "data_start_facturare", l: "Data de la care se facturează din admin (comenzile mai vechi s-au facturat direct în SAGA)", tip: "date", avansat: true },
    { k: "format_numar", l: "Cum se scrie numărul facturii pentru SAGA: serie_spatiu („PAP FE 14207”) / serie_lipita / doar_numar", avansat: true },
    { k: "format_data", l: "Cum se scrie data pentru SAGA: zi-luna-an / zi.luna.an / an-luna-zi", avansat: true },
    { k: "tva_la_incasare", l: "TVA la încasare: da / nu", avansat: true },
    { k: "cif_persoana_fizica", l: "Codul fiscal pentru persoane fizice: gol / liniuta / treisprezece_zerouri", avansat: true },
    { k: "articol_reducere", l: "Articolul pentru reducere — codul (gol = cel pentru piese)", avansat: true },
    { k: "articol_reducere_denumire", l: "Articolul pentru reducere — denumirea", avansat: true },
    { k: "articol_transport", l: "Articolul pentru transport — codul (gol = cel pentru piese)", avansat: true },
    { k: "articol_transport_denumire", l: "Articolul pentru transport — denumirea", avansat: true },
    // Cheia NU e aici — se salvează separat, în caseta „Legătura cu SAGA”, și ajunge doar în
    // tabela `saga_cheie` (invizibilă din browser).
    { k: "url_api", l: "Adresa SAGA (gol = adresa standard)", avansat: true },
    // Text da/nu, NU bifă — bifele de aici pornesc bifate când valoarea lipsește.
    { k: "import_automat", l: "Import automat în SAGA: da / nu (gol = nu — factura se validează de mână în SAGA)", avansat: true },
  ],
  "FAN Courier (SelfAWB)": [{ k: "client_id", l: "Client ID" }, { k: "user", l: "Utilizator selfawb.ro" }, { k: "parola", l: "Parolă selfawb.ro", tip: "password" },
    // Bifă: nesalvată încă înseamnă „da" (vezi `configFan` din lib/fancourier.ts).
    { k: "ramburs_cont", l: "Rambursul intră în contul bancar (serviciul Cont Colector). Debifat = ramburs în plic.", tip: "bifa" }],
  // Contul OCAZIONAL, pentru retururi. E ALTUL decât cel de livrare de mai sus:
  // contul cu contract poate trimite doar expediții care pleacă de la noi.
  "FAN Courier — retururi": [
    { k: "client_id", l: "Client ID al contului ocazional (îl dă FAN, după mapare)" },
    { k: "user", l: "Utilizator (adresa de e-mail cu care s-a creat contul ocazional)" },
    { k: "parola", l: "Parola contului ocazional", tip: "password" },
    // Nu se ghicește: verificat pe API, și „sender” și „recipient” generează AWB,
    // cu același tarif. Singura sursă adevărată e ce transmite FAN.
    { k: "payment", l: "Câmpul „payment”, exact cum îl transmite FAN (implicit: sender)" },
    { k: "depozit_judet", l: "Retururile vin în județul (ca la FAN, fără diacritice — implicit Neamt)" },
    { k: "depozit_localitate", l: "…localitatea (implicit Bistrita)" },
    { k: "depozit_strada", l: "…strada și numărul (implicit Str. Petru Rares nr. 181)" },
    { k: "depozit_contact", l: "Persoana de contact la recepția retururilor" },
  ],
  "Plată cu cardul (Netopia / Stripe)": [{ k: "pos_id", l: "POS Signature / ID" }, { k: "signature", l: "Cheie privată", tip: "password" }],
  "E-mail automat (Brevo)": [
    { k: "cheie", l: "Cheie API Brevo", tip: "password" },
    { k: "expeditor", l: "Adresa „De la” (implicit contact@autopas-dezmembrari.ro)" },
    { k: "nume_expeditor", l: "Numele afișat al expeditorului" },
    { k: "notificari", l: "Unde primești anunțul de comandă nouă" },
    { k: "webhook_url", l: "Adresa pe care o cheamă baza de date (https://…/api/email-coada)" },
    { k: "webhook_secret", l: "Secretul acelei adrese", tip: "password" },
  ],
  "dez.ro — anunțuri": [
    { k: "cheie", l: "Cheie API dez.ro", tip: "password" },
    { k: "utilizator", l: "Utilizator dez.ro" },
    { k: "parola", l: "Parolă dez.ro", tip: "password" },
    // Sincronizarea automată (migrarea 39): baza de date cheamă ruta la fiecare
    // schimbare de piesă. Fără cele două câmpuri, triggerele scriu în coadă și
    // atât — nimic nu se pierde, dar nimic nu pleacă singur.
    { k: "webhook_url", l: "Sincronizare automată: adresa chemată de baza de date (https://…/api/dezro-coada)" },
    { k: "webhook_secret", l: "Secretul acelei adrese", tip: "password" },
  ],
  "Google Analytics 4": [{ k: "id", l: "ID de măsurare (G-XXXXXXX)" }],
  "Google Merchant Center": [{ k: "id", l: "ID cont Merchant (doar pentru evidență)" }],
  // Eticheta se ține SEPARAT de id, nu lipită („AW-123/AbC”): așa nu se poate
  // salva din greșeală o etichetă care aparține altui cont Google Ads, iar
  // vânzările să fie raportate altcuiva fără niciun semn. Codul le compune.
  "Google Ads": [{ k: "id", l: "ID cont (AW-XXXXXXXXX)" },
                 { k: "eticheta_conversie", l: "Eticheta conversiei „comandă” (partea de după bară)" }],
  "Meta — Facebook și Instagram": [{ k: "pixel_id", l: "ID pixel (15 cifre)" },
                 { k: "verificare_domeniu", l: "Cod verificare domeniu (facebook-domain-verification)" },
                 { k: "catalog_id", l: "ID catalog (doar pentru evidență)" }],
};
const CHEI: Record<string, string> = {
  "WhatsApp Business": "whatsapp", "Saga — facturare": "saga", "FAN Courier (SelfAWB)": "fancourier",
  "FAN Courier — retururi": "fancourier_retur",
  "Plată cu cardul (Netopia / Stripe)": "netopia", "Google Analytics 4": "ga4", "E-mail automat (Brevo)": "email",
  "Google Merchant Center": "merchant", "Google Ads": "google_ads",
  "Meta — Facebook și Instagram": "meta", "dez.ro — anunțuri": "dezro",
};

/**
 * „Verifică conexiunea" pentru FAN Courier: se autentifică cu datele SALVATE și
 * cere serviciile contului. Merge pe aceeași rută ca generarea AWB-ului, deci un
 * test reușit înseamnă că și AWB-ul va putea pleca.
 */
function UneltFan() {
  const [lucru, setLucru] = useState(false);
  const [rez, setRez] = useState<{ bun: boolean; text: string } | null>(null);
  async function verifica() {
    setLucru(true); setRez(null);
    const sb = sbBrowser();
    const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
    const r = await fetch("/api/awb", { method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
      body: JSON.stringify({ actiune: "verifica" }) });
    const j = await r.json().catch(() => null);
    setLucru(false);
    if (j?.ok) setRez({ bun: !j.avertisment, text: `✓ Conectat. Serviciile contului: ${j.servicii.join(", ")}.${j.avertisment ? ` ⚠ ${j.avertisment}` : ""}` });
    else setRez({ bun: false, text: j?.eroare ?? "Nu s-a putut verifica." });
  }
  return (
    <div className="mt-3 text-sm">
      <button type="button" onClick={verifica} disabled={lucru} className="rounded-xl border-2 border-line px-3 py-1.5 text-xs font-bold hover:border-acc">
        {lucru ? "Se verifică…" : "Verifică conexiunea"}</button>
      {rez && <p className={`mt-2 text-xs ${rez.bun ? "text-ok" : "text-red-600"}`}>{rez.text}</p>}
    </div>
  );
}

/** „Verifică retururile”: se autentifică pe contul OCAZIONAL și cere serviciile
 *  lui. Merge pe aceeași rută ca AWB-ul de retur, deci un test reușit înseamnă
 *  că și AWB-ul de retur va putea pleca. Arată și adresa la care vor veni
 *  coletele, ca o greșeală în ea să se vadă înainte de primul retur, nu după. */
function UneltFanRetur() {
  const [lucru, setLucru] = useState(false);
  const [rez, setRez] = useState<{ bun: boolean; text: string } | null>(null);
  async function verifica() {
    setLucru(true); setRez(null);
    const sb = sbBrowser();
    const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
    const r = await fetch("/api/awb-retur", { method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
      body: JSON.stringify({ actiune: "verifica" }) });
    const j = await r.json().catch(() => null);
    setLucru(false);
    if (j?.ok) setRez({ bun: true,
      text: `✓ Contul de retur merge. Servicii: ${j.servicii.join(", ")}. Coletele vin la ${j.depozit.strada}, ${j.depozit.localitate}, jud. ${j.depozit.judet}.` });
    else setRez({ bun: false, text: j?.eroare ?? "Nu s-a putut verifica." });
  }
  return (
    <div className="mt-3 text-sm">
      <button type="button" onClick={verifica} disabled={lucru} className="rounded-xl border-2 border-line px-3 py-1.5 text-xs font-bold hover:border-acc">
        {lucru ? "Se verifică…" : "Verifică retururile"}</button>
      {rez && <p className={`mt-2 text-xs ${rez.bun ? "text-ok" : "text-red-600"}`}>{rez.text}</p>}
    </div>
  );
}

/**
 * CHEIA SAGA (pasul 7, docs/saga-plan.md). Cheia REALĂ se scrie aici de om și
 * pleacă direct la ruta /api/saga, care o pune în `saga_cheie` — tabelă pe care
 * browserul n-o poate citi, nici ca admin. Câmpul nu se precompletează niciodată:
 * panoul vede doar „salvată / rotită / blocată”. „Testează conexiunea” face DOAR
 * o citire (`GetArticol`), niciodată un import.
 */
type StareSaga = {
  cheie: { setata: boolean; salvata_la: string | null; rotita_la: string | null; rotiri: number;
           folosita_la: string | null; blocata_la: string | null; blocata_motiv: string | null };
  apeluri: { id: number; created_at: string; tip: string; http_status: number | null; durata_ms: number | null; cheie_rotita: boolean; eroare: string | null }[];
  adresa?: string; cif?: string;
};
const cand = (v: string | null) => v ? new Date(v).toLocaleString("ro-RO", { timeZone: "Europe/Bucharest" }) : "—";

function UneltSaga() {
  const [stare, setStare] = useState<StareSaga | null>(null);
  const [cheie, setCheie] = useState("");
  const [lucru, setLucru] = useState<"" | "salvez" | "test">("");
  const [rez, setRez] = useState<{ bun: boolean; text: string } | null>(null);

  const cheama = useCallback(async (corp: Record<string, unknown>) => {
    const sb = sbBrowser();
    const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
    const r = await fetch("/api/saga", { method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
      body: JSON.stringify(corp) });
    return r.json().catch(() => ({ ok: false, eroare: `Răspuns neașteptat (HTTP ${r.status}).` }));
  }, []);

  const citeste = useCallback(async () => {
    const j = await cheama({ actiune: "stare" });
    if (j?.ok) setStare(j); else setRez({ bun: false, text: j?.eroare ?? "Starea legăturii cu SAGA nu s-a putut citi." });
  }, [cheama]);
  useEffect(() => { citeste(); }, [citeste]);

  async function salveaza() {
    if (!cheie.trim()) return;
    if (stare?.cheie.setata && !confirm("Înlocuiești cheia SAGA salvată? Cea veche nu se mai folosește.")) return;
    setLucru("salvez"); setRez(null);
    const j = await cheama({ actiune: "salveaza-cheie", cheie });
    setLucru("");
    if (j?.ok) { setCheie(""); setStare(j); setRez({ bun: true, text: j.mesaj }); }
    else setRez({ bun: false, text: j?.eroare ?? "Cheia nu s-a salvat." });
  }
  async function testeaza() {
    setLucru("test"); setRez(null);
    const j = await cheama({ actiune: "testeaza-conexiunea" });
    setLucru("");
    if (j?.ok) { setStare(j); setRez({ bun: !j.avertisment, text: j.mesaj }); }
    else { setRez({ bun: false, text: j?.eroare ?? "Testul nu s-a putut face." }); citeste(); }
  }

  const k = stare?.cheie;
  return (
    <div className="mt-4 pt-3 border-t border-line text-sm grid gap-2">
      <b className="text-xs">Legătura cu SAGA</b>
      {k?.blocata_la && (
        <p className="text-xs rounded-lg border-2 border-red-300 bg-red-50 text-red-800 p-2">
          ⚠ Cheia a fost respinsă / pierdută la {cand(k.blocata_la)} ({k.blocata_motiv}). Generați o cheie nouă din SAGA WEB
          (Utilizatori → Integrare API → Generează cheie de acces) și salvați-o mai jos.</p>
      )}
      <p className="text-xs text-mut">
        {!stare ? "Se citește starea…" : k?.setata
          ? <>Conectat. Cheia e salvată ({cand(k.salvata_la)}); folosită ultima dată: {cand(k.folosita_la)}.</>
          : "Nicio cheie salvată."}
        {stare && !stare.cif && <span className="text-red-600"> Codul fiscal al firmei lipsește (Setări → Date firmă).</span>}
      </p>
      {/* Cu cheia salvată, schimbarea ei stă restrânsă: nu e o acțiune de zi cu zi. */}
      <details open={!k?.setata || !!k?.blocata_la} className="text-xs">
        <summary className="cursor-pointer text-mut">{k?.setata ? "Schimbă cheia" : "Salvează cheia"}</summary>
        <p className="text-mut mt-1">Cheia se generează în SAGA WEB de un utilizator Admin (Utilizatori → Integrare API → Generează cheie de acces)
          și se lipește doar aici — nu se trimite pe chat sau pe e-mail. După salvare nu se mai poate vedea, doar înlocui.</p>
        <div className="fld mt-1"><label>Cheia nouă de acces SAGA</label>
          <input type="password" autoComplete="new-password" value={cheie} onChange={(e) => setCheie(e.target.value)} placeholder="lipește cheia din SAGA WEB" /></div>
        <button type="button" onClick={salveaza} disabled={!!lucru || !cheie.trim()} className="btn-dark !py-1.5 text-xs mt-2">
          {lucru === "salvez" ? "Se salvează…" : "Salvează cheia"}</button>
      </details>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={testeaza} disabled={!!lucru || !k?.setata}
          className="rounded-xl border-2 border-line px-3 py-1.5 text-xs font-bold hover:border-acc">
          {lucru === "test" ? "Se testează…" : "Testează conexiunea"}</button>
      </div>
      <p className="text-[11px] text-mut">„Testează conexiunea” doar citește din SAGA articolul pentru piese — nu trimite nimic.</p>
      {rez && <p className={`text-xs ${rez.bun ? "text-ok" : "text-red-600"}`}>{rez.text}</p>}
      {!!stare?.apeluri.length && (
        <details className="text-xs"><summary className="cursor-pointer text-mut">Ultimele apeluri spre SAGA</summary>
          <ul className="mt-1 space-y-0.5">
            {stare.apeluri.map((a) => (
              <li key={a.id}>{cand(a.created_at)} · {a.tip} · HTTP {a.http_status ?? "—"} · {a.durata_ms ?? "—"} ms
                {a.cheie_rotita ? " · cheie rotită" : ""}{a.eroare ? <span className="text-red-600"> · {a.eroare}</span> : ""}</li>
            ))}
          </ul></details>
      )}
    </div>
  );
}

/**
 * OLX (pasul 1, docs/olx-plan.md). Nimic de aici nu trece prin `settings.integrari`:
 * client_secret și tokenii merg direct la /api/olx și stau în `olx_cont`, tabelă pe
 * care browserul n-o poate citi. Panoul vede doar „salvat / conectat / reînnoit”.
 */
type StareOlx = {
  aplicatie: boolean; client_id: string | null; conectat: boolean; conectat_la: string | null; reinnoit_la: string | null;
  access_expira: string | null; folosit_la: string | null; deconectat_la: string | null; deconectat_motiv: string | null;
  utilizator: { name?: string; email?: string; is_business?: boolean } | null;
  setari: { city_id?: number | null; district_id?: number | null; oras?: string; contact_nume?: string; contact_telefon?: string };
  apeluri: { id: number; created_at: string; tip: string; metoda: string | null; cale: string | null; http_status: number | null; durata_ms: number | null; eroare: string | null }[];
  categorii: number; mapari: number; callback?: string;
};

function UneltOlx() {
  const [stare, setStare] = useState<StareOlx | null>(null);
  const [app, setApp] = useState({ client_id: "", client_secret: "" });
  const [set, setSet] = useState({ city_id: "", district_id: "", oras: "", contact_nume: "", contact_telefon: "" });
  const [coord, setCoord] = useState("");
  const [locatii, setLocatii] = useState<{ city_id: number; oras: string; district_id: number | null; cartier: string | null }[]>([]);
  const [lucru, setLucru] = useState("");
  const [rez, setRez] = useState<{ bun: boolean; text: string } | null>(null);

  const cheama = useCallback(async (corp: Record<string, unknown>) => {
    const sb = sbBrowser();
    const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
    const r = await fetch("/api/olx", { method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` }, body: JSON.stringify(corp) });
    return r.json().catch(() => ({ ok: false, eroare: `Răspuns neașteptat (HTTP ${r.status}).` }));
  }, []);
  const aplica = (j: any) => {
    if (!j?.aplicatie && j?.aplicatie !== false) return;
    setStare(j);
    const s = j.setari ?? {};
    setSet({ city_id: s.city_id ? String(s.city_id) : "", district_id: s.district_id ? String(s.district_id) : "", oras: s.oras ?? "",
             contact_nume: s.contact_nume ?? "", contact_telefon: s.contact_telefon ?? "" });
  };
  useEffect(() => {
    // Mesajul întors de callback-ul OLX (?olx=ok|eroare&mesaj=…).
    const q = new URLSearchParams(location.search);
    if (q.get("olx")) setRez({ bun: q.get("olx") === "ok", text: q.get("mesaj") ?? "" });
    cheama({ actiune: "stare" }).then((j) => j?.ok ? aplica(j) : setRez({ bun: false, text: j?.eroare ?? "Starea OLX nu s-a putut citi." }));
  }, [cheama]);

  async function fa(actiune: string, extra: Record<string, unknown> = {}) {
    setLucru(actiune); setRez(null);
    const j = await cheama({ actiune, ...extra });
    setLucru("");
    if (j?.ok) { aplica(j); if (j.mesaj) setRez({ bun: true, text: j.mesaj }); }
    else setRez({ bun: false, text: j?.eroare ?? "Operația n-a mers." });
    return j;
  }
  async function conecteaza() {
    const j = await fa("conecteaza");
    if (j?.ok && j.url) location.href = j.url;
  }
  async function cautaOras() {
    const [lat, lon] = coord.split(/[,; ]+/).filter(Boolean);
    const j = await fa("cauta-oras", { lat, lon });
    if (j?.ok) { setLocatii(j.locatii ?? []); if (!j.locatii?.length) setRez({ bun: false, text: "OLX n-a găsit nicio localitate la coordonatele astea." }); }
  }

  const s = stare;
  return (
    <div id="olx" className="mt-4 pt-3 border-t border-line text-sm grid gap-2">
      <b className="text-xs">Legătura cu OLX</b>
      <p className="text-xs text-mut">
        {!s ? "Se citește starea…" : !s.aplicatie ? "Aplicația OLX nu e salvată."
          : s.conectat ? <>Conectat{s.utilizator?.name ? <> ca <b>{s.utilizator.name}</b>{s.utilizator.is_business ? " (business)" : ""}</> : ""} din {cand(s.conectat_la)}.
              Token reînnoit: {cand(s.reinnoit_la)}; valabil până la {cand(s.access_expira)}.</>
          : "Aplicația e salvată, contul nu e conectat."}
      </p>
      {s?.deconectat_la && <p className="text-xs rounded-lg border-2 border-red-300 bg-red-50 text-red-800 p-2">
        ⚠ Deconectat la {cand(s.deconectat_la)} ({s.deconectat_motiv}). Apasă „Conectează OLX”.</p>}

      <details open={!s?.aplicatie} className="text-xs">
        <summary className="cursor-pointer text-mut">{s?.aplicatie ? `Schimbă aplicația (client_id ${s.client_id})` : "Salvează aplicația OLX"}</summary>
        <div className="fld mt-1"><label>client_id</label>
          <input autoComplete="off" value={app.client_id} onChange={(e) => setApp({ ...app, client_id: e.target.value })} /></div>
        <div className="fld mt-1"><label>client_secret (nu se mai poate vedea după salvare)</label>
          <input type="password" autoComplete="new-password" value={app.client_secret} onChange={(e) => setApp({ ...app, client_secret: e.target.value })} /></div>
        {s?.callback && <p className="text-mut mt-1">Callback URL-ul înregistrat la OLX trebuie să fie exact: <code>{s.callback}</code></p>}
        <button type="button" disabled={!!lucru || !app.client_id.trim() || !app.client_secret.trim()} className="btn-dark !py-1.5 text-xs mt-2"
          onClick={async () => { const j = await fa("salveaza-aplicatia", app); if (j?.ok) setApp({ client_id: "", client_secret: "" }); }}>
          {lucru === "salveaza-aplicatia" ? "Se salvează…" : "Salvează aplicația"}</button>
      </details>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={conecteaza} disabled={!!lucru || !s?.aplicatie} className="btn-dark !py-1.5 text-xs">
          {lucru === "conecteaza" ? "Se deschide OLX…" : s?.conectat ? "Reconectează OLX" : "Conectează OLX"}</button>
        <button type="button" onClick={() => fa("testeaza")} disabled={!!lucru || !s?.conectat}
          className="rounded-xl border-2 border-line px-3 py-1.5 text-xs font-bold hover:border-acc">
          {lucru === "testeaza" ? "Se testează…" : "Testează conexiunea"}</button>
        {s?.conectat && <button type="button" disabled={!!lucru} className="text-xs text-red-700 underline"
          onClick={() => confirm("Deconectezi contul OLX? Tokenii se șterg; anunțurile de pe OLX rămân.") && fa("deconecteaza")}>Deconectează</button>}
      </div>
      <p className="text-[11px] text-mut">„Testează conexiunea” doar citește: contul și lista anunțurilor existente.</p>

      {s?.conectat && (
        <details className="text-xs" open={!s.setari?.city_id}>
          <summary className="cursor-pointer text-mut">Setările anunțurilor (oraș, contact){s.setari?.oras ? ` — ${s.setari.oras}` : ""}</summary>
          <div className="fld mt-1"><label>Coordonatele depozitului (latitudine, longitudine — din Google Maps)</label>
            <div className="flex gap-2"><input value={coord} onChange={(e) => setCoord(e.target.value)} placeholder="46.95, 26.30" />
              <button type="button" onClick={cautaOras} disabled={!!lucru || !coord.trim()} className="rounded-xl border-2 border-line px-3 text-xs font-bold whitespace-nowrap">
                {lucru === "cauta-oras" ? "Caut…" : "Caută pe OLX"}</button></div></div>
          {locatii.map((l) => (
            <button key={`${l.city_id}-${l.district_id}`} type="button" className="block text-left underline mt-1"
              onClick={() => setSet({ ...set, city_id: String(l.city_id), district_id: l.district_id ? String(l.district_id) : "", oras: l.oras + (l.cartier ? `, ${l.cartier}` : "") })}>
              {l.oras}{l.cartier ? ` · ${l.cartier}` : ""} (city_id {l.city_id})</button>
          ))}
          <p className="mt-1">Orașul ales: <b>{set.oras || "—"}</b> {set.city_id && `(city_id ${set.city_id}${set.district_id ? `, district_id ${set.district_id}` : ""})`}</p>
          <div className="fld mt-1"><label>Numele de contact de pe anunț</label>
            <input value={set.contact_nume} onChange={(e) => setSet({ ...set, contact_nume: e.target.value })} /></div>
          <div className="fld mt-1"><label>Telefonul de contact (câmpul OLX „contact”, nu în descriere)</label>
            <input value={set.contact_telefon} onChange={(e) => setSet({ ...set, contact_telefon: e.target.value })} /></div>
          <button type="button" disabled={!!lucru || !set.city_id || !set.contact_nume.trim()} onClick={() => fa("salveaza-setari", set)} className="btn-dark !py-1.5 text-xs mt-2">
            {lucru === "salveaza-setari" ? "Se salvează…" : "Salvează setările"}</button>
        </details>
      )}
      {s?.conectat && <p className="text-xs"><a href="/admin/olx/categorii" className="underline font-bold">Potrivirea categoriilor OLX →</a>
        <span className="text-mut"> ({s.mapari} potriviri, {s.categorii} categorii OLX aduse)</span></p>}
      {rez && <p className={`text-xs ${rez.bun ? "text-ok" : "text-red-600"}`}>{rez.text}</p>}
      {!!s?.apeluri.length && (
        <details className="text-xs"><summary className="cursor-pointer text-mut">Ultimele apeluri spre OLX</summary>
          <ul className="mt-1 space-y-0.5">
            {s.apeluri.map((a) => (
              <li key={a.id}>{cand(a.created_at)} · {a.tip} · {a.metoda} {a.cale} · HTTP {a.http_status ?? "—"} · {a.durata_ms ?? "—"} ms
                {a.eroare ? <span className="text-red-600"> · {a.eroare}</span> : ""}</li>
            ))}
          </ul></details>
      )}
    </div>
  );
}

/**
 * Testul și golirea manuală a cozii.
 *
 * Testul trece prin ACELAȘI drum ca un e-mail adevărat — aceeași rută, aceeași
 * cheie, același expeditor — altfel un test care trece n-ar dovedi nimic.
 *
 * „Trimite ce a rămas" există fiindcă trezirea din baza de date e fire-and-forget:
 * dacă site-ul era în timpul unui deploy exact atunci, rândul rămâne în coadă și
 * n-are cine să-l ia. Butonul ăsta e cârligul de recuperare, fără cron.
 */
function UneltEmail({ implicit }: { implicit: string }) {
  const [catre, setCatre] = useState(implicit);
  const [lucru, setLucru] = useState<"" | "test" | "coada">("");
  const [rez, setRez] = useState("");
  const [asteptare, setAsteptare] = useState<{ n: number; eroare: string | null } | null>(null);
  useEffect(() => { setCatre(implicit); }, [implicit]);

  // Câte e-mailuri așteaptă și de ce. Fără linia asta, o coadă blocată e
  // invizibilă până când clientul sună să întrebe de ce n-a primit confirmarea —
  // exact ce s-a întâmplat la comanda AP-2026-01004.
  const vezicoada = useCallback(async () => {
    const sb = sbBrowser(); if (!sb) return;
    const { data } = await sb.from("email_coada")
      .select("id,eroare").is("trimis_la", null).order("id", { ascending: false }).limit(50);
    const r = (data ?? []) as { id: number; eroare: string | null }[];
    setAsteptare({ n: r.length, eroare: r.find((x) => x.eroare)?.eroare ?? null });
  }, []);
  useEffect(() => { vezicoada(); }, [vezicoada]);

  async function cheama(corp: Record<string, unknown>, ce: "test" | "coada") {
    const sb = sbBrowser(); if (!sb) return;
    const token = (await sb.auth.getSession()).data.session?.access_token;
    if (!token) { setRez("Sesiune expirată — autentifică-te din nou."); return; }
    setLucru(ce); setRez("");
    try {
      const r = await fetch("/api/email-coada", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(corp),
      });
      const d = await r.json();
      if (d.ok && ce === "test") setRez("✓ Trimis. Verifică inbox-ul ȘI folderul Spam.");
      else if (d.ok) setRez(`✓ ${d.trimise ?? 0} trimise, ${d.esuate ?? 0} eșuate, ${d.sarite ?? 0} fără adresă.${d.nota ? " " + d.nota : ""}`);
      else setRez(`Nu a mers: ${d.eroare ?? "eroare necunoscută"}`);
    } catch (e: any) {
      setRez(`Nu a mers: ${e?.message ?? e}`);
    }
    setLucru("");
    vezicoada();
  }

  return (
    <div className="mt-4 pt-3 border-t border-line grid gap-2 text-sm">
      <div className="fld"><label>Trimite un test la</label>
        <input value={catre} onChange={(e) => setCatre(e.target.value)} type="email" placeholder="adresa@exemplu.ro" /></div>
      <div className="flex gap-2 flex-wrap">
        <button type="button" disabled={lucru !== "" || !catre} onClick={() => cheama({ test: catre }, "test")}
          className="rounded-xl border-2 border-line px-3 py-2 text-xs font-semibold hover:border-acc disabled:opacity-40">
          {lucru === "test" ? "Se trimite…" : "Trimite un test"}</button>
        <button type="button" disabled={lucru !== ""} onClick={() => cheama({}, "coada")}
          className="rounded-xl border-2 border-line px-3 py-2 text-xs font-semibold hover:border-acc disabled:opacity-40">
          {lucru === "coada" ? "Se trimite…" : "Trimite ce a rămas în coadă"}</button>
      </div>
      {rez && <p className="text-xs">{rez}</p>}
      {asteptare && (asteptare.n > 0
        ? <p className="text-xs text-red-600">
            ⚠ {asteptare.n} {asteptare.n === 1 ? "e-mail așteaptă" : "e-mailuri așteaptă"} în coadă.
            {asteptare.eroare ? ` Ultima eroare: ${asteptare.eroare}` : ""}
          </p>
        : <p className="text-xs text-ok">✓ Coada e goală — totul a plecat.</p>)}
    </div>
  );
}

/** Un câmp al formularului de configurare. `autoComplete` NU e cosmetic (7 septembrie 2026):
 *  Chrome vede un câmp `password` lângă unul text, crede că e un formular de autentificare
 *  și pune peste amândouă contul cu care ești logat în /admin — utilizatorul dez.ro apărea
 *  după un refresh ca adresa adminului, iar „Salvează” l-ar fi scris așa în bază.
 *  `new-password` pe parole oprește euristica; `off` singur nu e respectat de Chrome. */
function Camp({ c, valoare }: { c: { k: string; l: string; tip?: string }; valoare: any }) {
  if (c.tip === "bifa")
    return (
      <label className="flex items-start gap-2 text-xs cursor-pointer">
        {/* Bifă: nesalvată încă înseamnă „da” (vezi `configFan` din lib/fancourier.ts). */}
        <input type="checkbox" name={c.k} className="mt-0.5" defaultChecked={(valoare ?? "on") === "on"} />
        {c.l}</label>
    );
  return (
    <div className="fld"><label>{c.l}</label>
      <input name={c.k} type={c.tip ?? "text"} autoComplete={c.tip === "password" ? "new-password" : "off"} defaultValue={valoare ?? ""} /></div>
  );
}

const Sageata = ({ deschis }: { deschis: boolean }) => (
  <svg viewBox="0 0 20 20" className={`w-4 h-4 shrink-0 text-mut transition-transform ${deschis ? "rotate-180" : ""}`} aria-hidden="true">
    <path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function Integrari() {
  const [env, setEnv] = useState<Record<string, boolean>>({});
  const [conf, setConf] = useState<Record<string, any>>({});
  const [olxConectat, setOlxConectat] = useState(false);
  const [deschis, setDeschis] = useState<string | null>(null);
  const [salvez, setSalvez] = useState<string | null>(null);
  // Rezultatul ultimei salvări (sau al verificării dinainte), lângă butonul apăsat —
  // un mesaj afișat sus nu se vede când salvezi un card din josul paginii (7 septembrie 2026).
  const [rezultat, setRezultat] = useState<{ cheie: string; text: string; bun: boolean } | null>(null);

  const incarca = useCallback(async () => {
    const sb = sbBrowser(); if (!sb) return;
    const { data } = await sb.from("settings").select("valoare").eq("cheie", "integrari").single();
    setConf((data?.valoare as any) ?? {});
  }, []);

  useEffect(() => {
    fetch("/api/integrari").then((r) => r.json()).then(setEnv).catch(() => {});
    incarca();
    // Starea OLX stă în tabela ei (nu în `settings`): se întreabă ruta, doar pentru etichetă.
    (async () => {
      const sb = sbBrowser();
      const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
      const r = await fetch("/api/olx", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ actiune: "stare" }) }).catch(() => null);
      const j = await r?.json().catch(() => null);
      if (j?.ok) setOlxConectat(!!j.conectat);
    })();
    // Ancora din adresă deschide cardul (ex. întoarcerea de la OLX: …#olx).
    const h = location.hash.slice(1);
    if (INTEGRARI.some((i) => i.id === h)) setDeschis(h);
  }, [incarca]);

  function comuta(id: string) {
    const nou = deschis === id ? null : id;
    setDeschis(nou);
    history.replaceState(null, "", `${location.pathname}${location.search}${nou ? `#${nou}` : ""}`);
  }

  /** Starea reală: bifa „Activă” salvată / contul conectat bat starea scrisă în listă. */
  function stareReala(i: Integrare): Stare {
    if (i.id === "fan" && env.fan) return "activ";
    if (i.id === "olx" && olxConectat) return "activ";
    const cheie = CHEI[i.nume];
    if (cheie && conf[cheie]?.activ === true) return "activ";
    return i.stare;
  }

  /** Verificările de dinainte de salvare. Întoarce mesajul de eroare sau null. */
  function verifica(cheie: string, valori: any): string | null {
    // Adresa chemată de baza de date TREBUIE să fie o adresă web: la 7 septembrie 2026 a ajuns
    // acolo o adresă de e-mail, pg_net a refuzat-o („Bad scheme”) și e-mailurile au rămas în coadă.
    if (cheie === "email" || cheie === "dezro") {
      const u = String(valori.webhook_url ?? "").trim();
      if (u !== "" && !/^https?:\/\/[^\s]+$/i.test(u))
        return "„Adresa pe care o cheamă baza de date” trebuie să fie o adresă web, nu una de e-mail. " +
               `Valoarea corectă: https://autopas-dezmembrari.ro/api/${cheie === "email" ? "email-coada" : "dezro-coada"}`;
    }
    // Saga: aceleași reguli ca în bază (`saga_cota_tva`) și listele închise ale pasului 6 —
    // o valoare greșită ar opri exportul / XML-ul abia când e nevoie de el.
    if (cheie === "saga") {
      const cota = String(valori.cota_tva ?? "").trim().replace(",", ".").replace("%", "").trim();
      if (cota !== "" && !(/^[0-9]+(\.[0-9]+)?$/.test(cota) && Number(cota) < 100))
        return `Cota TVA „${valori.cota_tva}” nu e validă: scrie un număr între 0 și 99 (de exemplu 21), sau lasă gol pentru 21.`;
      const inchise: [string, string[]][] = [
        ["format_numar", ["serie_spatiu", "serie_lipita", "doar_numar"]],
        ["format_data", ["zi-luna-an", "zi.luna.an", "an-luna-zi"]],
        ["tva_la_incasare", ["da", "nu"]],
        ["cif_persoana_fizica", ["gol", "liniuta", "treisprezece_zerouri"]],
        ["import_automat", ["da", "nu"]],
      ];
      for (const [k, permise] of inchise) {
        const v = String(valori[k] ?? "").trim();
        valori[k] = v;
        if (v !== "" && !permise.includes(v)) return `„${v}” nu e o valoare permisă pentru ${k}. Variante: ${permise.join(" / ")} (sau gol).`;
      }
      // Adresa API-ului: doar https (cheia pleacă spre ea în antet).
      const urlApi = String(valori.url_api ?? "").trim();
      valori.url_api = urlApi;
      if (urlApi !== "" && !/^https:\/\/[^\s]+$/i.test(urlApi))
        return `Adresa SAGA („${urlApi}”) trebuie să înceapă cu https://. Lasă gol pentru adresa standard.`;
      const regim = String(valori.regim_tva ?? "").trim().toLowerCase();
      if (regim !== "" && regim !== "normal")
        return regim === "marja" || regim === "marjă"
          ? "Regimul „marjă” nu e implementat. Lasă gol sau scrie „normal”."
          : `Regimul TVA „${valori.regim_tva}” nu e cunoscut. Lasă gol sau scrie „normal”.`;
    }
    return null;
  }

  /**
   * Salvează DOAR câmpurile cardului apăsat, peste rândul RECITIT din bază chiar acum.
   * Înainte (până la 13 noiembrie 2026) se rescria tot `settings.integrari` cu ce era
   * încărcat la deschiderea paginii: o pagină veche, salvată pe ORICE card, readucea
   * valorile vechi pe toate (inclusiv tokenul dez.ro, scris de server între timp).
   */
  async function salveaza(cheie: string, campuri: Record<string, any>) {
    setRezultat(null);
    const eroare = verifica(cheie, campuri);
    if (eroare) { setRezultat({ cheie, text: eroare, bun: false }); return; }
    const sb = sbBrowser()!; setSalvez(cheie);
    const { data, error } = await sb.from("settings").select("valoare").eq("cheie", "integrari").single();
    if (error) { setSalvez(null); setRezultat({ cheie, text: `Nu s-a salvat: ${error.message}`, bun: false }); return; }
    const proaspat = ((data?.valoare as any) ?? {}) as Record<string, any>;
    const vechi = proaspat[cheie] ?? {};
    const valori = { ...vechi, ...campuri };
    // Alt cont dez.ro = tokenul memorat nu mai e al lui (la ei e valabil 30 de zile,
    // indiferent de parolă): fără asta am publica în continuare în numele celui vechi.
    if (cheie === "dezro" && (valori.utilizator !== vechi.utilizator || valori.parola !== vechi.parola)) {
      valori.token = null; valori.token_expira = null;
    }
    const nou = { ...proaspat, [cheie]: valori };
    // Un UPDATE oprit de RLS nu dă eroare, dă zero rânduri — de aici `scrieVerificat`.
    const r = await scrieVerificat(sb.from("settings").update({ valoare: nou }).eq("cheie", "integrari"));
    setSalvez(null);
    if (!r.ok) { setRezultat({ cheie, text: `Nu s-a salvat: ${r.eroare}`, bun: false }); return; }
    // Ca la Setări: după o salvare confirmată se golește cache-ul paginilor publice.
    await golesteCachePublic();
    setConf(nou);
    setRezultat({ cheie, text: "✓ Salvat.", bun: true });
  }

  const stari = INTEGRARI.map((i) => stareReala(i));
  const numar = (s: Stare) => stari.filter((x) => x === s).length;
  const grupuri = Array.from(new Set(INTEGRARI.map((i) => i.grup)));

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <div className="dim">Administrare</div>
        <h1 className="font-disp font-bold text-2xl mt-1">Integrări</h1>
        <p className="text-sm text-mut mt-1">Apasă pe o integrare ca să vezi detaliile și configurarea.</p>
        <div className="flex flex-wrap gap-2 mt-3 text-xs font-bold">
          {(["activ", "pregatit", "viitor"] as Stare[]).map((s) => (
            <span key={s} className={`px-2.5 py-1 rounded-full border ${ETICHETE[s][0]}`}>{numar(s)} · {ETICHETE[s][1]}</span>
          ))}
        </div>
      </div>

      {grupuri.map((g) => (
        <section key={g}>
          <div className="dim mb-2">{g}</div>
          <div className="card divide-y divide-line overflow-hidden">
            {INTEGRARI.filter((i) => i.grup === g).map((i) => {
              const stare = stareReala(i);
              const [cls, txt] = ETICHETE[stare];
              const eDeschis = deschis === i.id;
              const cheie = CHEI[i.nume];
              const campuri = CAMPURI[i.nume] ?? [];
              return (
                <div key={i.id} id={i.id} className={eDeschis ? "bg-paper/50" : ""}>
                  <button type="button" onClick={() => comuta(i.id)} aria-expanded={eDeschis}
                    className="w-full flex items-center gap-3 px-4 py-3 min-h-[56px] text-left hover:bg-paper">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm">{i.nume}</div>
                      <div className="text-xs text-mut truncate">{i.rezumat}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${cls}`}>{txt}</span>
                    <Sageata deschis={eDeschis} />
                  </button>

                  {eDeschis && (
                    <div className="px-4 pb-5 pt-1 text-sm">
                      <p className="text-mut">{i.desc}</p>
                      <details className="mt-3 text-xs" open={stare !== "activ"}>
                        <summary className="cursor-pointer font-semibold text-steel">Cum se configurează ({i.pasi.length} {i.pasi.length === 1 ? "pas" : "pași"})</summary>
                        <ol className="mt-2 space-y-1 text-steel">
                          {i.pasi.map((p, n) => <li key={n} className="flex gap-2"><span className="text-acc font-bold">{n + 1}.</span>{p}</li>)}
                        </ol>
                      </details>

                      {i.id === "email" && <UneltEmail implicit={conf.email?.notificari ?? ""} />}
                      {i.id === "fan" && <UneltFan />}
                      {i.id === "fan_retur" && <UneltFanRetur />}
                      {i.id === "saga" && <UneltSaga />}
                      {i.id === "olx" && <UneltOlx />}

                      {campuri.length > 0 && (
                        // `key` cu valorile salvate: câmpurile (necontrolate) se reîncarcă după citirea din bază.
                        <form key={JSON.stringify(conf[cheie] ?? {})} autoComplete="off"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const f = new FormData(e.currentTarget);
                            const v: Record<string, any> = {};
                            campuri.forEach((c) => { v[c.k] = c.tip === "bifa" ? (f.get(c.k) === "on" ? "on" : "") : String(f.get(c.k) ?? ""); });
                            v.activ = f.get("activ") === "on";
                            salveaza(cheie, v);
                          }}
                          className="mt-4 pt-3 border-t border-line grid gap-2">
                          <b className="text-xs">Configurare</b>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {campuri.filter((c) => !c.avansat).map((c) => <Camp key={c.k} c={c} valoare={conf[cheie]?.[c.k]} />)}
                          </div>
                          {campuri.some((c) => c.avansat) && (
                            <details className="rounded-xl border-2 border-line px-3 py-2">
                              <summary className="cursor-pointer text-xs font-semibold">Setări avansate (nu se schimbă de obicei)</summary>
                              <div className="grid gap-2 mt-2">
                                {campuri.filter((c) => c.avansat).map((c) => <Camp key={c.k} c={c} valoare={conf[cheie]?.[c.k]} />)}
                              </div>
                            </details>
                          )}
                          <div className="flex flex-wrap items-center gap-3 mt-1">
                            <label className="flex items-center gap-2 text-xs cursor-pointer">
                              <input type="checkbox" name="activ" defaultChecked={conf[cheie]?.activ ?? false} />
                              Activă (folosește această integrare)</label>
                            <button className="btn-dark !py-2 text-xs ml-auto" disabled={salvez !== null}>
                              {salvez === cheie ? "Se salvează…" : "Salvează configurarea"}</button>
                          </div>
                          {rezultat?.cheie === cheie && (
                            <p className={`text-xs ${rezultat.bun ? "text-ok" : "text-red-600"}`}>{rezultat.text}</p>
                          )}
                        </form>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
