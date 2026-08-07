// ============================================================
// CONȚINUTUL PAGINILOR LEGALE — un singur template le afișează pe toate
// (app/legal/[slug]/page.tsx).
//
// Documentele NU mai conțin date de firmă scrise în cod: denumirea, CUI-ul,
// nr. de Reg. Com., sediul și telefonul vin din Admin → Setări → Date firmă
// (tabela `settings`, cheia `firma`). De aceea documentele se construiesc
// printr-o funcție care primește datele firmei.
// ============================================================
import { FIRMA_IMPLICITA, type Firma } from "./settings";

export type LegalSectiune = { h: string; p?: string[]; lista?: string[] };
// `titluScurt` (opțional) se folosește în meniul lateral și în meniuri, atunci
// când titlul complet al documentului ar fi prea lung.
export type LegalDoc = { slug: string; titlu: string; titluScurt?: string; sectiuni: LegalSectiune[] };

export function getLegalDocs(firma: Firma = FIRMA_IMPLICITA): LegalDoc[] {
  // Formulare scurtă a identificării firmei, refolosită în mai multe documente.
  const identificare = [
    firma.denumire,
    firma.adresa ? `cu sediul în ${firma.adresa}` : "",
    firma.reg_com ? `înregistrată la Registrul Comerțului cu nr. ${firma.reg_com}` : "",
    firma.cui ? `cod fiscal ${firma.cui}` : "",
    firma.telefon ? `telefon ${firma.telefon}` : "",
  ].filter(Boolean).join(", ");

  return [
  {
    slug: "termeni-si-conditii",
    titlu: "Termeni și condiții",
    sectiuni: [
      { h: "1. Cine suntem", p: [
        `Site-ul autopas este operat de ${identificare}. Suntem centru autorizat pentru tratarea vehiculelor scoase din uz.`,
      ]},
      { h: "2. Produsele", p: [
        "Comercializăm piese auto second-hand provenite din dezmembrări autorizate. Fiecare piesă este verificată, fotografiată real și descrisă cu informațiile ei tehnice (cod OEM, compatibilitate, cod intern).",
        "Piesele sunt, în general, unicate (stoc: 1 buc). La plasarea comenzii, piesa se rezervă automat.",
      ]},
      { h: "3. Comanda și contractul", p: [
        "Comanda plasată pe site reprezintă o ofertă de cumpărare. Contractul se consideră încheiat la confirmarea comenzii de către noi, prin e-mail sau telefonic.",
        "Prețurile sunt exprimate în lei și includ TVA. Costul livrării este afișat separat, înainte de finalizarea comenzii.",
      ]},
      { h: "4. Garanție și retur", p: [
        "Piesele beneficiază de garanție de 90 de zile de la data facturării, conform OUG 140/2021 — condițiile complete sunt în pagina Certificat de garanție.",
        "Ai și dreptul de retragere din contract în 14 zile, conform OUG 34/2014 — detalii în Politica de retur.",
      ]},
      { h: "5. Răspundere", p: [
        "Montajul pieselor se face doar în unități specializate, autorizate RAR. Nu răspundem pentru defecțiuni cauzate de montaj incorect sau utilizare neconformă.",
      ]},
    ],
  },
  // ---------------------------------------------------------------
  // GDPR — adaptat pentru web din informarea privind prelucrarea datelor.
  // Formularul de acord semnat pe hârtie, la sediu, NU se publică aici.
  // ---------------------------------------------------------------
  {
    slug: "politica-de-confidentialitate",
    titlu: "Politica de confidențialitate (GDPR)",
    sectiuni: [
      { h: "Cine prelucrează datele tale (operatorul)", p: [
        `${identificare}.`,
      ]},
      { h: "Ce sunt datele cu caracter personal", p: [
        "Orice informații privind o persoană fizică identificată sau identificabilă — nume, prenume, domiciliu, cetățenie, cod numeric personal, datele din actul de identitate, adresa de e-mail, numerele de telefon, informațiile din orice document semnat cu operatorul (inclusiv contractele de furnizare de produse și servicii), semnătura, imaginea, vocea, convorbirile telefonice, precum și informațiile financiare și bancare necesare conform legii.",
      ]},
      { h: "Ce înseamnă prelucrarea", p: [
        "Orice operațiune efectuată asupra datelor — colectare, înregistrare, organizare, structurare, stocare, adaptare, modificare, extragere, consultare, utilizare, divulgare prin transmitere, diseminare, aliniere, restricționare, ștergere sau distrugere.",
      ]},
      { h: "În ce scopuri prelucrăm datele", p: [
        "Evidența și executarea contractelor și documentelor semnate între operator și persoana vizată, furnizarea de servicii și produse, statistică, colectare debite și recuperare creanțe, raportări către autoritățile de supraveghere din România și din străinătate, managementul portofoliului și al riscului, supraveghere video, prevenirea fraudelor și a spălării banilor, combaterea finanțării terorismului.",
      ]},
      { h: "Cine sunt persoanele vizate", p: [
        "Persoana vizată, împuternicitul acesteia și orice alte persoane fizice ale căror date ajung în orice mod la operator, pe durata relației contractuale.",
      ]},
      { h: "Cui transmitem datele (destinatari)", p: [
        "Persoanele vizate și reprezentanții lor, societăți comerciale partenere, autoritățile și instituțiile publice din România și din străinătate potrivit legii, instanțele judecătorești și arbitrale, angajații, societățile de colectare a debitelor și de recuperare a creanțelor.",
      ]},
      { h: "Cât timp păstrăm datele", p: [
        "Pe durata derulării contractelor semnate cu persoana vizată, plus o perioadă de 3 ani, pentru desfășurarea activităților curente ale operatorului și realizarea intereselor sale legitime — cu excepția cazurilor în care legea prevede alt termen, caz în care se aplică acel termen.",
      ]},
      { h: "Drepturile tale", p: [
        "Conform Regulamentului General de Protecție a Datelor beneficiezi de:",
      ], lista: [
        "dreptul la informare;",
        "dreptul de acces la date;",
        "dreptul de intervenție asupra datelor și dreptul la rectificare;",
        "dreptul de opoziție;",
        "dreptul de a nu fi supus unei decizii individuale luate pe baza unei prelucrări automate;",
        "dreptul de a te adresa justiției;",
        "dreptul la ștergerea datelor („dreptul de a fi uitat”);",
        "dreptul la restricționarea prelucrării;",
        "dreptul la portabilitatea datelor.",
      ]},
      { h: "Cum îți exerciți drepturile", p: [
        "Toate drepturile de mai sus se exercită gratuit, prin cerere scrisă, datată și semnată, înaintată operatorului — cu excepția dreptului de a te adresa justiției, care se exercită prin cerere scrisă către instanța competentă.",
        "Poți solicita oricând sistarea prelucrării datelor, prin cerere scrisă adresată operatorului.",
      ]},
      { h: "Cookie-uri", p: [
        "Modul în care folosim cookie-urile este descris separat, în pagina Politica de cookies. Preferințele le poți schimba oricând din pagina Setări cookie-uri.",
      ]},
    ],
  },
  {
    slug: "politica-de-cookies",
    titlu: "Politica de cookies",
    sectiuni: [
      { h: "1. Ce sunt cookie-urile", p: [
        "Fișiere mici de text salvate în browserul tău, care ajută site-ul să funcționeze (de ex. să-ți țină minte coșul) și, cu acordul tău, să măsurăm traficul.",
      ]},
      { h: "2. Ce folosim", p: [
        "Strict necesare: menținerea coșului de cumpărături și a sesiunii de autentificare — fără acestea site-ul nu poate funcționa.",
        "Statistică (doar cu acord): măsurarea anonimă a vizitelor, pentru a înțelege ce pagini sunt utile.",
      ]},
      { h: "3. Cum le controlezi", p: [
        "Din pagina Setări cookie-uri poți accepta sau refuza cookie-urile de statistică oricând. Cele strict necesare nu pot fi dezactivate, fiind indispensabile funcționării.",
      ]},
    ],
  },
  {
    slug: "livrare",
    titlu: "Livrare",
    sectiuni: [
      { h: "1. Curieri și termene", p: [
        "Livrăm în toată România prin FAN Courier, cu plata ramburs inclusă. Termenul uzual: 1–3 zile lucrătoare de la confirmarea comenzii.",
        "Comenzile confirmate până la ora 15:00 în zilele lucrătoare pleacă, de regulă, în aceeași zi.",
      ]},
      { h: "2. Piese voluminoase (motoare, cutii de viteze, caroserie mare)", p: [
        "Piesele grele se livrează paletizat, cu tarif calculat la comandă (de la 120 lei, în funcție de greutate și destinație). Te contactăm telefonic cu costul exact înainte de expediere.",
      ]},
      { h: "3. Verificarea coletului", p: [
        "Recomandăm verificarea coletului la primire, în prezența curierului. Piesele sunt ambalate protejat și etichetate cu codul OEM.",
      ]},
      { h: "4. Ridicare personală", p: [
        "Poți ridica piesa direct de la depozitul nostru din Piatra-Neamț, în programul afișat în subsol — fără cost de livrare.",
      ]},
    ],
  },
  // ---------------------------------------------------------------
  // RETUR — aliniat pe articolele din OUG 34/2014, în limbaj simplu
  // (legea cere „limbaj simplu și inteligibil”).
  // ---------------------------------------------------------------
  {
    slug: "politica-de-retur",
    titlu: "Politica de retur",
    sectiuni: [
      { h: "1. Dreptul de retragere — 14 zile (art. 9)", p: [
        "Te poți retrage din contract în 14 zile calendaristice de la primirea piesei, fără să justifici decizia și fără penalități.",
      ]},
      { h: "2. Cum ne comunici retragerea (art. 11)", p: [
        "Prin Formularul de retur de pe site sau prin orice altă declarație neechivocă (e-mail, scrisoare) în care ne spui că te retragi din contract.",
        "Confirmăm primirea deciziei tale pe un suport durabil (de regulă, prin e-mail).",
      ]},
      { h: "3. Ce îți rambursăm (art. 13)", p: [
        "Toate sumele primite de la tine, inclusiv costul livrării standard, în cel mult 14 zile de la data la care ne-ai comunicat decizia de retragere, folosind aceeași metodă de plată ca la achiziție.",
        "Dacă ai ales expres o livrare mai scumpă decât cea standard oferită de noi, diferența de cost nu se rambursează.",
        "Putem amâna rambursarea până primim piesa înapoi sau până ne trimiți dovada că ai expediat-o — se ia în calcul data cea mai apropiată.",
      ]},
      { h: "4. Ce te costă pe tine (art. 14)", p: [
        "Suporți costul direct al returnării piesei.",
        "Răspunzi doar pentru diminuarea valorii piesei rezultată din manipulări dincolo de ce este necesar pentru a-i determina natura, caracteristicile și modul de funcționare.",
      ]},
      { h: "5. Termenul tău de returnare (art. 14 alin. 1)", p: [
        "Trimiți piesa înapoi în cel mult 14 zile de la data la care ne-ai comunicat decizia de retragere.",
      ]},
      { h: "6. Dacă nu te informăm (art. 10)", p: [
        "Dacă nu te informăm asupra dreptului de retragere, termenul de 14 zile se prelungește cu 12 luni.",
      ]},
      { h: "7. Excepții (art. 16)", p: [
        "Dreptul de retragere nu se aplică pieselor confecționate după specificațiile tale sau personalizate în mod clar.",
      ]},
      { h: "8. Retragere ≠ Garanție", p: [
        "Retragerea înseamnă că te-ai răzgândit: 14 zile, fără să dai un motiv.",
        "Garanția înseamnă că piesa are un defect: 90 de zile, conform OUG 140/2021 — vezi pagina Certificat de garanție.",
      ]},
      { h: "9. Textul oficial al legii", p: [
        "Poți citi integral OUG 34/2014 pe portalul oficial legislatie.just.ro.",
      ]},
    ],
  },
  // ---------------------------------------------------------------
  // CERTIFICAT DE GARANȚIE — textul certificatului real al firmei.
  // Temeiul legal: OUG 140/2021 (a abrogat Legea 449/2003).
  // ---------------------------------------------------------------
  {
    slug: "certificat-garantie",
    titlu: "Certificat de garanție — piese auto second-hand din dezmembrări",
    titluScurt: "Certificat de garanție",
    sectiuni: [
      { h: "Durata garanției", p: [
        `Garanția acordată de ${firma.denumire} este de 90 de zile de la data facturării, conform OUG 140/2021 privind anumite aspecte referitoare la contractele de vânzare de bunuri.`,
      ]},
      { h: "Piese acoperite de garanție", p: [
        "Ambreiaje · arcuri · amortizoare · articulații planetare · elemente de caroserie · elemente de direcție · elemente de frână · semnalizatoare · stopuri · cabluri · pompe · radiatoare · tobe și țevi de eșapament · rulmenți · fișe de bujii · piese de electromotor și alternator · piese de motor în mișcare.",
      ]},
      { h: "Piese fără garanție (consumabile)", p: [
        "Filtre (ulei, aer, combustibil, habitaclu) · becuri · ștergătoare de parbriz · burdufuri · bujii de aprindere și incandescente · garnituri metalo-plastice și simeringuri · curele de transmisie și distribuție.",
      ]},
      { h: "Când garanția nu se aplică", lista: [
        `piesa nu a fost cumpărată de la ${firma.denumire};`,
        "piesa nu a fost montată într-un atelier autorizat RAR pentru tipul de serviciu solicitat sau de reprezentantul legal al producătorului;",
        "defectarea a rezultat dintr-un montaj incorect sau din montarea împreună cu piese conexe uzate, defecte ori modificate;",
        "piesa a fost greșit aleasă sau folosită în alt scop decât cel din catalogul producătorului;",
        "piesa nu a fost identificată corect din cauza unor date eronate transmise de cumpărător sau nu a fost comparată la montaj cu piesa înlocuită;",
        "uzură sau deteriorare din suprasolicitare, întreținere incorectă ori insuficientă, neefectuarea reviziilor periodice, lipsa verificărilor și reglajelor ulterioare montajului;",
        "autoturismul a fost folosit în alte scopuri decât cel prevăzut de constructor sau exploatat necorespunzător (raliuri, competiții sportive);",
        "autoturismul a fost accidentat sau a suferit avarii din factori externi (șocuri termice, electrice, mecanice);",
        "piesele prezintă urme de lovituri, zgârieturi, îndoituri, rupturi, deformări;",
        "piesele nu mai au inscripționările și sigiliile aplicate de parcul de dezmembrări.",
      ]},
      { h: "Documente necesare la o reclamație", lista: [
        "copie după factura de achiziție, împreună cu bonul sau chitanța;",
        "dovada montării într-un service autorizat RAR (deviz de montaj) și documentele fiscale aferente;",
        "notă de constatare de la un service autorizat RAR, cu descrierea detaliată a defecțiunii;",
        "copie după certificatul de înmatriculare al autovehiculului;",
        "copie după autorizația RAR a service-ului unde s-a făcut montajul.",
      ]},
      { h: "Termene de soluționare", p: [
        "Reclamația primește răspuns în 15 zile lucrătoare de la recepția produselor la sediul vânzătorului, însoțite de toate documentele de mai sus.",
        "Dacă reclamația este justificată, produsul se înlocuiește în 7 zile sau se restituie contravaloarea. Garanția acoperă cel mult valoarea integrală a produsului reclamat.",
      ]},
      { h: "În caz de dezacord", p: [
        "Dacă părțile nu ajung la un consens, piesele se trimit spre analiză unui specialist în domeniu. Rezultatul analizei este obligatoriu pentru ambele părți, iar cheltuielile sunt suportate de partea în culpă.",
      ]},
      { h: "Transportul pentru reclamații", lista: [
        `de la client către ${firma.denumire} — plata este efectuată de client;`,
        `de la ${firma.denumire} către client — plata este suportată de clientul destinatar.`,
      ]},
      { h: "Valabilitate teritorială", p: [
        "Garanția este valabilă pe teritoriul României, cu excepția situațiilor în care garanția în Uniunea Europeană este solicitată expres și stipulată pe documentul justificativ.",
      ]},
    ],
  },
  {
    slug: "setari-cookie-uri",
    titlu: "Setări cookie-uri",
    sectiuni: [
      { h: "Gestionează-ți preferințele", p: [
        "Folosește panoul de mai jos pentru a alege ce cookie-uri accepți. Alegerea ta se aplică imediat și o poți schimba oricând, revenind pe această pagină.",
      ]},
    ],
  },
  {
    slug: "anpc-si-sol",
    titlu: "ANPC și Soluționarea Online a Litigiilor",
    sectiuni: [
      { h: "Protecția consumatorilor", p: [
        "Autoritatea Națională pentru Protecția Consumatorilor (ANPC): anpc.ro. Pentru soluționarea alternativă a litigiilor (SAL): anpc.ro/ce-este-sal.",
        "Platforma europeană de Soluționare Online a Litigiilor (SOL): ec.europa.eu/consumers/odr.",
        "Ne dorim însă ca orice problemă să o rezolvăm direct, rapid și corect — scrie-ne mai întâi prin pagina de contact.",
      ]},
    ],
  },
  ];
}

// Lista de adrese (slug + titlu) — nu depinde de datele firmei, deci se poate
// folosi și la generarea paginilor statice (generateStaticParams).
export const LEGAL_SLUGS = getLegalDocs().map((d) => ({ slug: d.slug, titlu: d.titluScurt ?? d.titlu }));

export function getLegal(slug: string, firma: Firma = FIRMA_IMPLICITA) {
  return getLegalDocs(firma).find((d) => d.slug === slug) ?? null;
}
