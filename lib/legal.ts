// Conținutul paginilor legale — un singur template le afișează pe toate (app/legal/[slug]/page.tsx).
// Textele de retur și garanție sunt schițe profesionale; clientul le va înlocui cu variantele lui finale.
export type LegalDoc = { slug: string; titlu: string; sectiuni: { h: string; p: string[] }[] };

export const LEGAL: LegalDoc[] = [
  {
    slug: "termeni-si-conditii",
    titlu: "Termeni și condiții",
    sectiuni: [
      { h: "1. Cine suntem", p: [
        "Site-ul autopas este operat de Autopas Dezmembrări SRL, cu sediul în Piatra-Neamț, jud. Neamț, înregistrată la Registrul Comerțului (CUI și nr. de înregistrare afișate în subsol). Suntem centru autorizat pentru tratarea vehiculelor scoase din uz.",
      ]},
      { h: "2. Produsele", p: [
        "Comercializăm piese auto second-hand provenite din dezmembrări autorizate. Fiecare piesă este verificată, fotografiată real și descrisă cu starea ei (A — testată, B — funcțională cu urme de uz, C — pentru recondiționare).",
        "Piesele sunt, în general, unicate (stoc: 1 buc). La plasarea comenzii, piesa se rezervă automat.",
      ]},
      { h: "3. Comanda și contractul", p: [
        "Comanda plasată pe site reprezintă o ofertă de cumpărare. Contractul se consideră încheiat la confirmarea comenzii de către noi, prin e-mail sau telefonic.",
        "Prețurile sunt exprimate în lei și includ TVA. Costul livrării este afișat separat, înainte de finalizarea comenzii.",
      ]},
      { h: "4. Răspundere", p: [
        "Montajul pieselor se face doar în unități specializate. Nu răspundem pentru defecțiuni cauzate de montaj incorect sau utilizare neconformă.",
      ]},
    ],
  },
  {
    slug: "politica-de-confidentialitate",
    titlu: "Politica de confidențialitate (GDPR)",
    sectiuni: [
      { h: "1. Ce date colectăm", p: [
        "Pentru procesarea comenzilor: nume, telefon, e-mail, adresa de livrare, iar pentru facturare pe firmă: denumirea și CUI-ul. Nu colectăm și nu solicităm CNP.",
        "Prin formulare (contact, caut o piesă, predă mașina): datele pe care ni le transmiți voluntar.",
      ]},
      { h: "2. De ce le colectăm", p: [
        "Executarea contractului (livrarea comenzii, emiterea facturii), obligații legale (facturare, garanție, retur) și, doar cu acordul tău separat, comunicări de marketing.",
      ]},
      { h: "3. Cât timp și cu cine", p: [
        "Păstrăm datele cât cere legea (documentele fiscale — conform legislației contabile). Le transmitem doar partenerilor necesari livrării: curierului (nume, telefon, adresă) și procesatorului de facturi.",
      ]},
      { h: "4. Drepturile tale", p: [
        "Ai dreptul de acces, rectificare, ștergere, restricționare, portabilitate și opoziție. Ne poți scrie oricând la adresa de e-mail din pagina de contact. Te poți adresa și ANSPDCP (dataprotection.ro).",
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
        "Livrăm în toată România prin FAN Courier (19,90 lei, ramburs inclus), Cargus (21,50 lei) și Sameday easybox (14,90 lei — ridici din locker). Termenul uzual: 24–48 de ore de la confirmarea comenzii.",
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
  {
    slug: "politica-de-retur",
    titlu: "Politica de retur",
    sectiuni: [
      { h: "1. Dreptul de retur — 14 zile", p: [
        "Conform OUG 34/2014, ai dreptul să returnezi piesa în 14 zile calendaristice de la primire, fără să motivezi decizia. Este suficient să ne anunți în acest termen prin Formularul de retur sau la datele din pagina de contact.",
      ]},
      { h: "2. Condițiile returului", p: [
        "Piesa trebuie returnată în starea în care a fost primită, cu eticheta OEM intactă. Piesele electrice/electronice montate necorespunzător sau desigilate contrar instrucțiunilor pot pierde dreptul de retur, conform legii.",
        "Costul transportului de retur este suportat de client, cu excepția cazurilor în care piesa este neconformă — atunci îl suportăm noi integral.",
      ]},
      { h: "3. Rambursarea", p: [
        "Returnăm contravaloarea piesei în maximum 14 zile de la primirea returului, în contul IBAN indicat în formular.",
      ]},
      { h: "4. Piese neconforme", p: [
        "Dacă piesa primită nu corespunde descrierii sau este nefuncțională, ne asumăm integral înlocuirea sau rambursarea, inclusiv transportul. Contactează-ne în cel mai scurt timp de la constatare.",
      ]},
    ],
  },
  {
    slug: "certificat-garantie",
    titlu: "Certificat de garanție",
    sectiuni: [
      { h: "1. Garanția Autopas — 30 de zile", p: [
        "Toate piesele vândute beneficiază de o garanție comercială de 30 de zile de la livrare, care acoperă funcționarea piesei conform destinației ei.",
      ]},
      { h: "2. Condiții de acordare", p: [
        "Garanția este valabilă cu factura fiscală și cu eticheta OEM aplicată de noi pe piesă, intactă. Montajul trebuie efectuat într-o unitate specializată, cu document de montaj (deviz).",
      ]},
      { h: "3. Ce nu acoperă garanția", p: [
        "Defecțiunile cauzate de montaj incorect, utilizare neconformă, intervenții neautorizate asupra piesei sau deteriorări mecanice ulterioare livrării.",
      ]},
      { h: "4. Soluționarea", p: [
        "În perioada de garanție, piesa defectă se înlocuiește cu una echivalentă sau se rambursează integral, la alegerea ta, în maximum 15 zile de la constatare.",
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

export function getLegal(slug: string) {
  return LEGAL.find((d) => d.slug === slug) ?? null;
}
