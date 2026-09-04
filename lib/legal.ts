// ============================================================
// CONȚINUTUL PAGINILOR LEGALE — un singur template le afișează pe toate
// (app/legal/[slug]/page.tsx).
//
// Documentele NU conțin date de firmă scrise în cod: denumirea, CUI-ul,
// nr. de Reg. Com., sediul, telefonul și e-mailul vin din Admin → Setări →
// Date firmă (tabela `settings`, cheia `firma`). De aceea documentele se
// construiesc printr-o funcție care primește datele firmei.
//
// Surse: certificatul de garanție al firmei, informarea GDPR (Anexa 9) și
// OUG 34/2014. Legea cere „limbaj simplu și inteligibil”, deci textele sunt
// rescrise pe înțeles, nu copiate în limbaj juridic.
// ============================================================
import { FIRMA_IMPLICITA, type Firma } from "./settings";

// O secțiune poate avea paragrafe, o listă cu puncte și/sau un tabel.
// Tabelul a apărut pentru politica de cookies, unde o înșiruire de fraze ar
// fi fost imposibil de urmărit.
export type LegalTabel = { capuri: string[]; randuri: string[][] };
export type LegalSectiune = { h: string; p?: string[]; lista?: string[]; tabel?: LegalTabel };
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
    firma.email ? `e-mail ${firma.email}` : "",
  ].filter(Boolean).join(", ");

  return [
  // ---------------------------------------------------------------
  // TERMENI ȘI CONDIȚII — contractul dintre site și client.
  // Acoperă informațiile precontractuale cerute de OUG 34/2014 art. 6.
  // ---------------------------------------------------------------
  {
    slug: "termeni-si-conditii",
    titlu: "Termeni și condiții",
    sectiuni: [
      { h: "1. Cine suntem", p: [
        `Site-ul Autopas Dezmembrări este operat de ${identificare}.`,
        "Suntem centru autorizat pentru tratarea vehiculelor scoase din uz: dezmembrăm autoturisme și vindem piesele recuperate din ele.",
        "Prin plasarea unei comenzi accepți termenii de mai jos. Te rugăm să îi citești înainte — sunt scrise pe înțeles, tocmai ca să nu ai surprize.",
      ]},
      { h: "2. Câțiva termeni, ca să ne înțelegem", lista: [
        "„Piesă” sau „produs” — un reper auto second-hand, recuperat dintr-un vehicul dezmembrat de noi.",
        "„Comandă” — cererea ta de a cumpăra una sau mai multe piese, trimisă prin site.",
        "„Consumator” — persoana fizică ce cumpără în afara activității sale profesionale. Consumatorii au drepturi suplimentare, menționate explicit acolo unde se aplică.",
        "„Cod OEM” — codul dat de producătorul auto piesei originale, după care se verifică potrivirea.",
        "„Cod intern” — codul nostru de urmărire a piesei în depozit, de forma AP-000123.",
      ]},
      { h: "3. Ce vindem", p: [
        "Comercializăm exclusiv piese auto second-hand provenite din dezmembrări autorizate. Nu vindem piese noi și nu vindem replici.",
        "Fiecare piesă este verificată, fotografiată real — pozele de pe site sunt ale piesei pe care o primești, nu poze de catalog — și descrisă cu informațiile ei tehnice: cod OEM, compatibilitate, cod intern, iar unde e cazul, o notă despre starea ei.",
        "Piesele sunt, în general, unicate: stocul este de o singură bucată. La plasarea comenzii piesa se rezervă automat, ca să nu fie vândută de două ori.",
      ]},
      { h: "4. Ce înseamnă „second-hand” și ce urme sunt normale", p: [
        "O piesă demontată dintr-un vehicul folosit poartă urmele utilizării: zgârieturi, praf, vopsea mată, mici lovituri pe zone care nu afectează funcționarea, cauciucuri sau plastice îmbătrânite. Acestea sunt considerate uzură normală și nu constituie defecte.",
        "Ce nu e normal — fisuri, deformări care împiedică montajul, lipsa unor componente care ar fi trebuit incluse — descriem în anunț sau, dacă ne-a scăpat, intră la garanție.",
        "Dacă un aspect anume contează pentru tine, întreabă-ne înainte de comandă. Trimitem fotografii suplimentare la cerere.",
      ]},
      { h: "5. Prețuri", p: [
        "Prețurile sunt exprimate în lei și includ TVA. Prețul valabil este cel afișat în momentul plasării comenzii.",
        "Ne rezervăm dreptul de a corecta erorile evidente de preț. Dacă o piesă a fost afișată dintr-o greșeală la un preț vădit eronat, te anunțăm înainte de expediere și poți alege între prețul corect și anularea comenzii, fără niciun cost.",
        "Codurile de reducere se aplică în coș, se scad din valoarea produselor și nu se cumulează dacă nu se precizează altfel.",
      ]},
      { h: "6. Cum se plasează o comandă și când se încheie contractul", p: [
        "Alegi piesele, le adaugi în coș, completezi datele de livrare și trimiți comanda. Primești pe ecran un număr de comandă, de forma AP-2026-01000.",
        "Comanda plasată pe site este o ofertă de cumpărare din partea ta. Contractul se consideră încheiat în momentul în care noi îți confirmăm comanda, telefonic sau în scris.",
        "Putem refuza o comandă dacă piesa nu mai este disponibilă, dacă datele de contact sunt incomplete sau vădit incorecte, ori dacă există un motiv întemeiat de a suspecta o comandă frauduloasă. În acest caz te anunțăm și restituim integral orice sumă încasată.",
      ]},
      { h: "7. Costul livrării nu apare la finalizarea comenzii", p: [
        "Piesele auto diferă enorm ca greutate și gabarit — de la un senzor de câteva sute de grame până la o cutie de viteze de zeci de kilograme. Curierul taxează după greutate, dimensiuni și destinație, așa că un tarif fix afișat automat ar fi, în multe cazuri, greșit.",
        "De aceea, când trimiți comanda vezi doar valoarea produselor. După ce o primim, cântărim și măsurăm coletul, calculăm transportul și te contactăm cu totalul exact, explicat pe componente.",
        "Nu expediem nimic până nu ești de acord cu totalul. Dacă suma nu îți convine, anulezi comanda fără niciun cost. Detalii complete în pagina Livrare.",
      ]},
      { h: "8. Plata", p: [
        "Poți plăti ramburs, la primirea coletului, sau prin transfer bancar pe baza unei facturi proforme.",
        "Plata cu cardul online va fi disponibilă ulterior; până atunci butonul este vizibil, dar inactiv.",
        "Emitem factură pentru fiecare comandă. Pentru facturarea pe firmă, completează datele societății în formularul de comandă.",
      ]},
      { h: "9. Anularea comenzii", p: [
        "Poți anula comanda oricând înainte de expediere, fără costuri — sună-ne sau scrie-ne.",
        "După expediere se aplică dreptul de retragere în 14 zile, descris în Politica de retur.",
      ]},
      { h: "10. Garanție și retur", p: [
        "Piesele beneficiază de garanție 90 de zile de la data facturării, conform OUG 140/2021 — condițiile complete sunt în pagina Certificat de garanție.",
        "Separat de garanție, ai dreptul de retragere din contract în 14 zile, conform OUG 34/2014 — detalii în Politica de retur.",
        "Cele două sunt lucruri diferite: retragerea înseamnă „m-am răzgândit”, garanția înseamnă „piesa are un defect”.",
      ]},
      { h: "11. Montajul și răspunderea noastră", p: [
        "Montajul pieselor se face în unități specializate, autorizate RAR. Este o condiție a garanției și, în egală măsură, o chestiune de siguranță rutieră.",
        "Nu răspundem pentru defecțiuni cauzate de montaj incorect, de alegerea greșită a piesei sau de utilizare neconformă.",
        "Verificarea potrivirii piesei revine cumpărătorului. Te ajutăm gratuit: trimite-ne seria de șasiu și verificăm noi compatibilitatea înainte să comanzi.",
      ]},
      { h: "12. Contul de client", p: [
        "Contul este opțional — poți comanda și fără el. Dacă îți faci cont, ești răspunzător pentru păstrarea în siguranță a parolei și pentru activitatea desfășurată prin contul tău.",
        "Poți cere oricând ștergerea contului, prin pagina de contact.",
      ]},
      { h: "13. Conținutul site-ului", p: [
        "Textele, fotografiile pieselor, structura și elementele grafice ale site-ului ne aparțin și sunt protejate de lege. Nu pot fi copiate sau refolosite comercial fără acordul nostru scris.",
        "Denumirile de mărci și modele auto apar exclusiv cu scop descriptiv, pentru identificarea compatibilității pieselor. Nu suntem afiliați producătorilor auto și nu folosim siglele lor.",
      ]},
      { h: "14. Situații pe care nu le putem controla", p: [
        "Nu răspundem pentru întârzieri sau neexecutări cauzate de evenimente independente de voința noastră — calamități, greve la curier, întreruperi majore de rețea. Te anunțăm imediat ce apare o astfel de situație și îți propunem o soluție sau restituim banii.",
      ]},
      { h: "15. Legea aplicabilă și rezolvarea neînțelegerilor", p: [
        "Contractului i se aplică legea română. Litigiile se soluționează de instanțele competente din România.",
        "Înainte de orice altceva, scrie-ne: majoritatea problemelor se rezolvă într-un telefon. Dacă nu ajungem la o soluție, te poți adresa ANPC — vezi pagina dedicată.",
      ]},
      { h: "16. Modificarea termenilor", p: [
        "Putem actualiza acești termeni. Versiunea aplicabilă comenzii tale este cea publicată pe site în momentul plasării comenzii. Data ultimei actualizări apare la finalul paginii.",
      ]},
    ],
  },
  // ---------------------------------------------------------------
  // GDPR — adaptat pentru web din informarea privind prelucrarea datelor
  // (Anexa 9). Formularul de acord semnat pe hârtie, la sediu, NU se publică
  // aici: e marcat confidențial și cere CNP și serie de act de identitate.
  // ---------------------------------------------------------------
  {
    slug: "politica-de-confidentialitate",
    titlu: "Politica de confidențialitate (GDPR)",
    sectiuni: [
      { h: "Cine prelucrează datele tale (operatorul)", p: [
        `${identificare}.`,
        "Pentru orice chestiune legată de datele tale personale ne poți scrie la adresa de e-mail de mai sus sau la sediul social.",
      ]},
      { h: "Ce date colectăm prin site, concret", p: [
        "Nu îți cerem mai mult decât ne trebuie. În funcție de ce faci pe site:",
      ], lista: [
        "când plasezi o comandă: nume și prenume (sau datele firmei), telefon, e-mail, adresa de livrare, localitatea și județul, metoda de plată aleasă;",
        "când îți faci cont: e-mail și parolă (parola este stocată criptat, nu o vedem nici noi), plus numele și telefonul, dacă le completezi;",
        "când trimiți o cerere prin formularele site-ului (piesă căutată, predarea unei mașini la dezmembrat, retur, contact): datele de contact și informațiile pe care le scrii tu în cerere;",
        "la formularul de predare a mașinii, opțional, seria de șasiu completă (VIN) — vizibilă doar echipei noastre, niciodată public;",
        "lista ta de favorite, dacă ești autentificat;",
        "date tehnice colectate automat de furnizorii de găzduire (adresa IP, momentul accesării, tipul de browser), necesare pentru funcționarea și securitatea site-ului.",
      ]},
      { h: "Ce sunt datele cu caracter personal", p: [
        "Orice informații privind o persoană fizică identificată sau identificabilă — nume, prenume, domiciliu, cetățenie, cod numeric personal, datele din actul de identitate, adresa de e-mail, numerele de telefon, informațiile din orice document semnat cu operatorul (inclusiv contractele de furnizare de produse și servicii), semnătura, imaginea, vocea, convorbirile telefonice, precum și informațiile financiare și bancare necesare conform legii.",
      ]},
      { h: "Ce înseamnă prelucrarea", p: [
        "Orice operațiune efectuată asupra datelor — colectare, înregistrare, organizare, structurare, stocare, adaptare, modificare, extragere, consultare, utilizare, divulgare prin transmitere, diseminare, aliniere, restricționare, ștergere sau distrugere.",
      ]},
      { h: "În ce scopuri prelucrăm datele și în ce temei", p: [
        "Regulamentul cere să spunem nu doar de ce folosim datele, ci și în ce temei legal. Pe scurt:",
      ], tabel: {
        capuri: ["Scopul", "Temeiul legal"],
        randuri: [
          ["Preluarea, confirmarea și livrarea comenzii; contactul telefonic pentru stabilirea transportului", "Executarea contractului"],
          ["Administrarea contului de client și a listei de favorite", "Executarea contractului, la cererea ta"],
          ["Răspunsul la cererile trimise prin formulare (piesă căutată, predare mașină, contact)", "Interesul nostru legitim de a răspunde solicitărilor primite"],
          ["Emiterea facturii și evidența contabilă", "Obligație legală"],
          ["Soluționarea returnărilor și a reclamațiilor în garanție", "Obligație legală și executarea contractului"],
          ["Prevenirea fraudelor și securitatea site-ului", "Interes legitim"],
          ["Apărarea drepturilor noastre în fața autorităților sau a instanțelor, recuperarea creanțelor", "Interes legitim"],
          ["Supravegherea video la sediu și în depozit", "Interes legitim, pentru paza bunurilor"],
        ],
      }},
      { h: "Cine sunt persoanele vizate", p: [
        "Persoana vizată, împuternicitul acesteia și orice alte persoane fizice ale căror date ajung în orice mod la operator, pe durata relației contractuale.",
      ]},
      { h: "Cui ajung datele tale", p: [
        "Nu vindem datele nimănui și nu le folosim pentru publicitate. Le transmitem doar cui e nevoie, ca să ne facem treaba:",
      ], lista: [
        "FAN Courier — numele, adresa și telefonul, ca să îți poată livra coletul;",
        "furnizorii care găzduiesc site-ul și baza de date, descriși mai jos;",
        "Google, pentru statistica de trafic — dar numai dacă ai acceptat cookie-urile de statistică, și fără numele, telefonul, e-mailul sau adresa ta;",
        "Google și Meta (Facebook, Instagram), pentru măsurarea reclamelor — numai dacă ai acceptat cookie-urile de publicitate, și tot fără numele, telefonul, e-mailul sau adresa ta;",
        "contabilul firmei, prin exportul facturilor;",
        "autoritățile și instituțiile publice, atunci când legea ne obligă;",
        "instanțele judecătorești, avocații sau executorii, dacă este necesar pentru apărarea unui drept;",
        "societăți de recuperare a creanțelor, în caz de debite neachitate.",
      ]},
      { h: "Unde sunt stocate datele", p: [
        "Baza de date și fotografiile sunt găzduite la Supabase, pe infrastructură aflată în Uniunea Europeană (Irlanda). Site-ul este găzduit de Vercel.",
        "Dacă ai acceptat cookie-urile de statistică, datele de trafic ajung și la Google, prin Google Analytics. Dacă ai acceptat și cookie-urile de publicitate, ajung date și la Google Ads, și la Meta Platforms Ireland Limited, prin pixelul Facebook. Ce anume se trimite scrie în Politica de cookies.",
        "Toate aceste societăți au sediul, sau societatea-mamă, în Statele Unite. În măsura în care intervine un transfer de date în afara Spațiului Economic European, acesta se face pe baza garanțiilor prevăzute de Regulament — clauzele contractuale standard aprobate de Comisia Europeană și, după caz, Cadrul UE–SUA privind confidențialitatea datelor.",
      ]},
      { h: "Cât timp păstrăm datele", lista: [
        "datele contului — până când ceri ștergerea contului;",
        "comenzile și facturile — pe durata impusă de legislația contabilă și fiscală, chiar dacă între timp ți-ai șters contul;",
        "cererile trimise prin formulare — atât cât e nevoie pentru rezolvarea lor, plus perioada în care ne-am putea apăra un drept legat de ele;",
        "în general, pe durata relației contractuale plus o perioadă de 3 ani, cu excepția cazurilor în care legea prevede alt termen, caz în care se aplică acel termen;",
        "înregistrările video de la sediu — pe termen scurt, prin suprascriere automată, dacă nu sunt necesare într-o cercetare.",
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
        "Răspundem în cel mult o lună de la primirea cererii. Dacă cererea este complexă, termenul poate fi prelungit, iar în acest caz te anunțăm.",
        "Reține că unele date nu pot fi șterse la cerere: facturile emise, de exemplu, trebuie păstrate cât cere legea contabilă.",
      ]},
      { h: "Dacă nu ești mulțumit de cum îți tratăm datele", p: [
        "Scrie-ne mai întâi nouă — cel mai des e o neînțelegere care se lămurește repede.",
        "Dacă tot nu ești mulțumit, ai dreptul să depui plângere la Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (ANSPDCP), B-dul General Gheorghe Magheru nr. 28-30, sector 1, București, site: dataprotection.ro.",
        "Ai, de asemenea, dreptul de a te adresa justiției.",
      ]},
      { h: "Decizii automate și profilare", p: [
        "Nu luăm decizii cu efect juridic asupra ta pe baza unei prelucrări exclusiv automate și nu facem profilare în scop de marketing.",
      ]},
      { h: "Securitatea datelor", p: [
        "Accesul la datele clienților este limitat la membrii echipei care au nevoie de ele pentru a-și face treaba, pe roluri diferite. Legătura cu site-ul este criptată, iar parolele sunt stocate sub formă criptată, ireversibil.",
      ]},
      { h: "Minori", p: [
        "Site-ul se adresează persoanelor majore. Nu colectăm cu bună știință date ale copiilor. Dacă observăm că am primit astfel de date, le ștergem.",
      ]},
      { h: "Cookie-uri", p: [
        "Modul în care folosim cookie-urile și tehnologiile similare este descris separat, în pagina Politica de cookies. Preferințele le poți schimba oricând din pagina Setări cookie-uri.",
      ]},
      { h: "Modificări ale acestei politici", p: [
        "Dacă schimbăm ceva important — un scop nou, un destinatar nou — actualizăm această pagină și modificăm data de la final.",
      ]},
    ],
  },
  // ---------------------------------------------------------------
  // COOKIES — scrisă pe baza a ce face codul în realitate, nu pe un
  // șablon copiat. Ce ține de funcționarea site-ului stă în localStorage /
  // sessionStorage; cookie-uri propriu-zise pun doar instrumentele de măsurare,
  // și doar după acordul explicit pentru grupul lor.
  // Actualizată la 4 septembrie 2026, când s-au adăugat Google Ads și pixelul
  // Meta: de atunci sunt TREI tabele (necesare, statistică, publicitate) și
  // trei răspunsuri posibile în banner, nu două.
  // Dacă se schimbă ceva la măsurare — alt instrument, alt cookie, altă
  // durată — se actualizează AICI, în toate tabelele, ÎNAINTE de punerea în
  // funcțiune, nu după. Vezi și docs/google-analytics.md și
  // docs/marketing-feeduri.md.
  // ---------------------------------------------------------------
  {
    slug: "politica-de-cookies",
    titlu: "Politica de cookies",
    sectiuni: [
      { h: "Pe scurt", p: [
        "Sunt două lucruri pentru care îți cerem acordul, separat: măsurarea traficului (Google Analytics) și publicitatea (Google Ads și Meta — Facebook, Instagram). Le poți accepta pe amândouă, doar pe una, sau pe niciuna.",
        "Bannerul de la prima vizită are trei butoane: „Doar necesare”, „Doar statistică” și „Accept toate”. Dacă nu alegi nimic, tratăm asta ca pe un refuz și nu se încarcă nimic.",
        "Fără acordul tău, browserul tău nu trimite nicio cerere către Google sau Meta. Poți verifica singur, în uneltele de dezvoltator.",
        "În rest, ce salvăm ține de funcționarea site-ului: coșul, favoritele, contul și chiar alegerea ta din banner. Mai jos sunt toate listele, fără excepții.",
      ]},
      { h: "Ce sunt cookie-urile și „tehnologiile similare”", p: [
        "Cookie-urile sunt fișiere mici pe care un site le pune în browserul tău și pe care browserul le trimite înapoi la fiecare vizită.",
        "Există și alte metode prin care un site poate ține minte ceva: localStorage și sessionStorage, două spații de stocare din browser. Diferența practică e că acestea rămân în calculatorul tău și nu sunt trimise automat către server la fiecare cerere.",
        "Precizarea contează, pentru că tot ce are nevoie site-ul ca să meargă ținem exclusiv în a doua variantă. Cookie-uri propriu-zise pun doar instrumentele de măsurare și de publicitate descrise mai jos, și doar după ce le accepți.",
      ]},
      { h: "Ce salvăm ca să funcționeze site-ul", p: [
        "Poți verifica singur: deschide uneltele de dezvoltator din browser (F5 sau F12, secțiunea „Application” sau „Stocare”) și caută-le după nume.",
      ], tabel: {
        capuri: ["Ce salvăm", "Unde", "La ce folosește", "Cât rămâne"],
        randuri: [
          ["autopas_cart", "localStorage", "Coșul de cumpărături — ține minte piesele alese până trimiți comanda", "Până golești coșul sau ștergi datele browserului"],
          ["autopas_favorite", "localStorage", "Lista de favorite, când nu ești autentificat. Dacă te autentifici, favoritele se mută în cont", "Până le ștergi"],
          ["autopas_cookies", "localStorage", "Chiar alegerea ta din bannerul de cookie-uri, ca să nu te întrebăm la fiecare pagină", "Până o schimbi din Setări cookie-uri"],
          ["autopas_reducere", "sessionStorage", "Codul de reducere aplicat, între coș și finalizarea comenzii", "Se șterge singur când închizi fila"],
          ["sb-…-auth-token", "localStorage", "Sesiunea de autentificare, ca să rămâi conectat în contul tău între pagini", "Până te deconectezi sau expiră sesiunea"],
          ["autopas_sunet", "localStorage", "Doar pentru echipa noastră, în panoul de administrare: dacă alerta sonoră la comandă nouă e pornită", "Până o schimbă utilizatorul"],
        ],
      }},
      { h: "De ce nu îți cerem acordul pentru acestea", p: [
        "Legea 506/2004 cere acordul vizitatorului pentru stocarea de informații în echipamentul lui, cu o excepție: atunci când stocarea este strict necesară pentru furnizarea unui serviciu cerut în mod expres de utilizator.",
        "Toate elementele din tabel intră în această excepție. Fără ele nu ai coș de cumpărături, nu poți rămâne autentificat și nu ți-am putea reține nici măcar refuzul de la banner.",
        "Nu le poți dezactiva din site, pentru că ar însemna să nu mai funcționeze. Le poți însă șterge oricând din browser — vezi mai jos.",
      ]},
      { h: "Google Analytics — se încarcă doar dacă îl accepți", p: [
        "Folosim Google Analytics 4 ca să vedem câți oameni intră pe site, ce piese caută și dacă găsesc ce le trebuie. Ne ajută să știm ce să dezmembrăm și ce să listăm mai întâi.",
        "Se încarcă doar dacă apeși „Doar statistică” sau „Accept toate”. Până atunci, și dacă alegi „Doar necesare”, scriptul Google nu ajunge în pagină — nu stă adormit și nu așteaptă nimic. Poți verifica singur, în uneltele de dezvoltator, secțiunea „Network”: nu vei vedea nicio cerere către google-analytics.com.",
        "Dacă te răzgândești, oprești statistica din pagina Setări cookie-uri. Din clipa aceea nu se mai măsoară nimic, iar la următoarea încărcare a paginii scriptul nu mai apare deloc.",
        "Ce trimitem: paginile pe care intri, piesele pe care le deschizi și le pui în coș, sumele și numărul comenzii. Ce NU trimitem: numele, telefonul, e-mailul sau adresa ta — acestea rămân la noi, în comandă.",
        "Datele ajung la Google, care le prelucrează pentru noi, inclusiv pe servere din afara Uniunii Europene. Adresa ta IP este anonimizată înainte de a fi înregistrată.",
      ], tabel: {
        capuri: ["Cookie", "Cine îl pune", "La ce folosește", "Cât rămâne"],
        randuri: [
          ["_ga", "Google", "Deosebește vizitatorii unul de altul, fără să știe cine ești", "2 ani"],
          ["_ga_ urmat de codul contului nostru", "Google", "Ține minte sesiunea curentă de măsurare", "2 ani"],
        ],
      }},
      { h: "Publicitate — Google Ads și Meta, doar cu „Accept toate”", p: [
        "Ne facem reclamă în Google (rezultatele căutării și Google Shopping) și pe Facebook și Instagram. Ca să știm care reclamă a adus o comandă și ca să nu plătim pentru afișări către oameni cărora nu le folosesc, folosim două instrumente: eticheta Google Ads și pixelul Meta.",
        "Se încarcă DOAR dacă apeși „Accept toate”. Cu „Doar statistică” sau „Doar necesare”, niciunul dintre ele nu ajunge în pagină și nu pleacă nicio cerere către Google Ads sau către Facebook.",
        "Ce trimitem: paginile pe care intri, piesele pe care le deschizi și le pui în coș, valoarea comenzii și numărul ei intern. Ce NU trimitem: numele, telefonul, e-mailul sau adresa ta.",
        "Ce înseamnă concret: dacă te-ai uitat la un far de Golf 6 și nu ai comandat, e posibil să vezi mai târziu, pe Facebook sau în Google, o reclamă chiar cu piesa aceea. Asta este „remarketing” și pentru asta îți cerem acordul separat.",
        "Dacă te răzgândești, oprești publicitatea din pagina Setări cookie-uri. Din clipa aceea pixelul nu mai trimite nimic, cookie-urile de mai jos se șterg, iar la următoarea încărcare a paginii scripturile nu mai apar deloc.",
      ], tabel: {
        capuri: ["Cookie", "Cine îl pune", "La ce folosește", "Cât rămâne"],
        randuri: [
          ["_gcl_au", "Google Ads", "Leagă un click pe reclamă de comanda plasată, ca să știm care reclamă a funcționat", "90 de zile"],
          ["_fbp", "Meta", "Deosebește browserele între ele, ca să nu îți arătăm de zece ori aceeași reclamă", "90 de zile"],
          ["_fbc", "Meta", "Se pune doar dacă ai ajuns pe site dintr-o reclamă Facebook sau Instagram; reține din care anume", "90 de zile"],
        ],
      }},
      { h: "Cookie-urile puse de Google și de Meta pe domeniile lor", p: [
        "Pe lângă cele trei de mai sus, care sunt puse pe domeniul nostru și pe care le putem șterge noi, Google și Meta pot pune cookie-uri pe propriile lor domenii (google.com, doubleclick.net, facebook.com) atunci când scripturile lor se încarcă — adică numai după ce ai apăsat „Accept toate”.",
        "Pe acelea nu le putem nici citi, nici șterge din site-ul nostru. Ele se gestionează din contul tău Google (myadcenter.google.com) și din setările tale de reclame de pe Facebook, sau ștergând cookie-urile din browser.",
        "Google Ireland Limited și Meta Platforms Ireland Limited sunt operatori independenți pentru datele pe care le primesc astfel. Politicile lor: policies.google.com/privacy și facebook.com/privacy/policy.",
      ]},
      { h: "Ce nu folosim", p: [
        "Ca să fie clar prin negație, la data ultimei actualizări a acestei pagini site-ul nu conține:",
      ], lista: [
        "alte instrumente de analiză, în afară de Google Analytics (Matomo, Plausible, Hotjar sau altele);",
        "pixeli ai altor rețele sociale (TikTok, LinkedIn, X);",
        "hărți, videoclipuri sau alte elemente încorporate de la terți care ar putea seta cookie-uri fără știrea ta;",
        "decizii automate cu efect juridic asupra ta — reclamele pe care le vezi nu schimbă prețul pe care îl plătești și nu îți refuză nimic.",
      ]},
      { h: "Despre bannerul de cookie-uri", p: [
        "Bannerul de la prima vizită are trei butoane, iar diferența dintre ele e reală: „Doar necesare” lasă site-ul exact cum e descris în primul tabel, fără nicio măsurare; „Doar statistică” adaugă Google Analytics și cele două cookie-uri ale lui; „Accept toate” adaugă, în plus, Google Ads și pixelul Meta.",
        "Cele două scopuri sunt independente: din Setări cookie-uri poți ține statistica pornită și publicitatea oprită, sau invers.",
        "Cât timp n-ai apăsat niciun buton, tratăm asta ca pe un refuz: nu pornește nimic. Alegerea se ține în browserul tău, nu la noi, și o poți schimba oricând din Setări cookie-uri.",
      ]},
      { h: "Cum ștergi ce s-a salvat", p: [
        "Din site: pagina Setări cookie-uri îți arată alegerea curentă și îți permite să o schimbi.",
        "Din browser: în Chrome, Edge sau Firefox mergi la Setări → Confidențialitate → Ștergere date de navigare și alege „Cookie-uri și alte date ale site-urilor”. Poți șterge datele doar pentru acest site, dând click pe lacătul din bara de adrese.",
        "Atenție: dacă ștergi aceste date, îți pierzi coșul și favoritele salvate local și vei fi deconectat din cont.",
      ]},
      { h: "Modificări", p: [
        "Data ultimei actualizări apare la finalul paginii. Orice instrument nou și orice cookie nou apar în tabelele de mai sus înainte de a fi puse în funcțiune, nu după.",
      ]},
    ],
  },
  {
    slug: "livrare",
    titlu: "Livrare",
    sectiuni: [
      { h: "1. Curier și termene", p: [
        "Livrăm în toată România prin FAN Courier, cu plata ramburs inclusă. Termenul uzual: 1–3 zile lucrătoare de la confirmarea comenzii.",
        "Comenzile confirmate până la ora 15:00 în zilele lucrătoare pleacă, de regulă, în aceeași zi.",
      ]},
      { h: "2. Cum se calculează costul livrării", p: [
        "Piesele auto diferă mult ca greutate și gabarit — de la un senzor de câteva sute de grame până la o cutie de viteze de zeci de kilograme. Curierul taxează în funcție de greutatea și dimensiunile coletului, plus eventuale taxe pentru localitățile izolate, așa că nu putem afișa un tarif fix, valabil pentru orice piesă.",
        "De aceea, la plasarea comenzii vezi doar valoarea produselor. După ce primim comanda, cântărim și măsurăm coletul, calculăm transportul și te sunăm cu totalul exact: produse plus transport, cu explicația din ce se compune suma.",
        "Nu expediem nimic până nu ești de acord cu totalul. Dacă suma nu îți convine, poți anula comanda fără niciun cost.",
      ]},
      { h: "3. Piese voluminoase (motoare, cutii de viteze, caroserie mare)", p: [
        "Piesele grele se livrează paletizat, iar tariful se stabilește în funcție de greutate și destinație. Se aplică același principiu: te contactăm telefonic cu costul exact înainte de expediere.",
      ]},
      { h: "4. Termenul maxim de livrare", p: [
        "Dacă nu convenim altfel, livrăm fără întârziere nejustificată și în cel mult 30 de zile de la încheierea contractului, așa cum prevede OUG 34/2014.",
        "Dacă nu reușim să livrăm în acest termen, te anunțăm și îți poți denunța contractul, caz în care îți restituim integral sumele plătite.",
      ]},
      { h: "5. Verificarea coletului", p: [
        "Recomandăm verificarea coletului la primire, în prezența curierului. Piesele sunt ambalate protejat și etichetate cu codul OEM.",
        "Dacă ambalajul este vizibil deteriorat, cere curierului întocmirea unui proces-verbal de constatare și anunță-ne în aceeași zi. Ne ușurează mult recuperarea daunei de la curier.",
      ]},
      { h: "6. Ridicare personală", p: [
        "Poți ridica piesa direct de la depozitul nostru din Str. Petru Rareș nr. 181, pe DN 15 între Piatra-Neamț și Bicaz (sat Bistrița, com. Alexandru cel Bun, jud. Neamț), în programul afișat în subsol — fără cost de livrare.",
        "Sună înainte, ca să pregătim piesa și să eviți drumul degeaba.",
      ]},
    ],
  },
  // ---------------------------------------------------------------
  // RETUR — aliniat pe articolele din OUG 34/2014, în limbaj simplu
  // (legea cere „limbaj simplu și inteligibil”). Formularul-model este
  // reprodus din anexa ordonanței, partea B — legea cere ca acesta să fie
  // pus la dispoziția consumatorului.
  // ---------------------------------------------------------------
  {
    slug: "politica-de-retur",
    titlu: "Politica de retur",
    sectiuni: [
      { h: "1. Dreptul de retragere — 14 zile (art. 9)", p: [
        "Te poți retrage din contract în 14 zile calendaristice de la primirea piesei, fără să justifici decizia și fără penalități.",
        "Dacă ai comandat mai multe piese care se livrează separat, termenul curge de la primirea ultimei piese.",
      ]},
      { h: "2. Cum ne comunici retragerea (art. 11)", p: [
        "Prin Formularul de retur de pe site, prin formularul-model de mai jos sau prin orice altă declarație neechivocă (e-mail, scrisoare) în care ne spui că te retragi din contract.",
        "Nu e obligatoriu să folosești un anumit format — contează să reiasă clar decizia ta.",
        "Confirmăm primirea deciziei tale pe un suport durabil (de regulă, prin e-mail).",
      ]},
      { h: "3. Formularul-model de retragere", p: [
        "Acesta este formularul-model din anexa OUG 34/2014. Îl completezi și ni-l trimiți doar dacă vrei să te retragi din contract:",
      ], lista: [
        `Către ${firma.denumire}${firma.adresa ? `, ${firma.adresa}` : ""}${firma.telefon ? `, telefon ${firma.telefon}` : ""}${firma.email ? `, e-mail ${firma.email}` : ""}:`,
        "Vă informez prin prezenta cu privire la retragerea mea din contractul referitor la vânzarea următoarelor produse: …",
        "Comandate la data … / primite la data …",
        "Numele consumatorului: …",
        "Adresa consumatorului: …",
        "Semnătura consumatorului (doar în cazul în care acest formular este notificat pe hârtie): …",
        "Data: …",
      ]},
      { h: "4. Ce îți rambursăm (art. 13)", p: [
        "Toate sumele primite de la tine reprezentând contravaloarea produselor, în cel mult 14 zile de la data la care ne-ai comunicat decizia de retragere, folosind aceeași metodă de plată ca la achiziție.",
      ]},
      { h: "5. Ce te costă pe tine (art. 14)", p: [
        "Suporți costul direct al returnării piesei.",
        "Răspunzi doar pentru diminuarea valorii piesei rezultată din manipulări dincolo de ce este necesar pentru a-i determina natura, caracteristicile și modul de funcționare.",
        "În practică: poți despacheta piesa, o poți privi, o poți compara cu cea veche și poți verifica dacă se potrivește. O piesă montată efectiv pe mașină, rodată sau vopsită nu mai poate fi returnată ca nouă, iar din suma rambursată se poate reține scăderea de valoare.",
      ]},
      { h: "6. Termenul tău de returnare și unde trimiți piesa (art. 14 alin. 1)", p: [
        "Trimiți piesa înapoi în cel mult 14 zile de la data la care ne-ai comunicat decizia de retragere.",
        `Adresa de returnare: ${firma.adresa || "sediul nostru"}. Te rugăm să ne anunți înainte de expediere și să incluzi în colet o copie a facturii, ca să identificăm rapid comanda.`,
        "Ambalează piesa cel puțin la fel de bine cum ai primit-o — o piesă deteriorată pe drumul de întoarcere intră la diminuarea valorii.",
      ]},
      { h: "7. Dacă nu te informăm (art. 10)", p: [
        "Dacă nu te informăm asupra dreptului de retragere, termenul de 14 zile se prelungește cu 12 luni.",
      ]},
      { h: "8. Excepții (art. 16)", p: [
        "Legea prevede treisprezece situații în care dreptul de retragere nu se aplică. Dintre ele, la piese auto second-hand pot fi relevante:",
      ], lista: [
        "piesele confecționate după specificațiile tale sau personalizate în mod clar (de exemplu, o piesă vopsită la codul de culoare al mașinii tale, la cererea ta);",
        "produsele care, după livrare, prin natura lor, sunt inseparabil amestecate cu alte elemente (de exemplu, fluide sau consumabile deja folosite);",
        "produsele sigilate care nu pot fi returnate din motive de igienă și care au fost desigilate de tine;",
        "contractele încheiate în cadrul unei licitații.",
      ]},
      { h: "9. Retragere ≠ Garanție", p: [
        "Retragerea înseamnă că te-ai răzgândit: 14 zile, fără să dai un motiv, piesa trebuie să fie nefolosită.",
        "Garanția înseamnă că piesa are un defect: 90 de zile, conform OUG 140/2021 — vezi pagina Certificat de garanție.",
        "Sunt drepturi separate. Faptul că au trecut cele 14 zile nu îți ia garanția.",
      ]},
      { h: "10. Textul oficial al legii", p: [
        "Poți citi integral OUG 34/2014 pe portalul oficial legislatie.just.ro.",
      ]},
    ],
  },
  // ---------------------------------------------------------------
  // CERTIFICAT DE GARANȚIE — reproduce certificatul real al firmei
  // (`garantie.docx`), în aceeași ordine a secțiunilor. Singurele intervenții
  // sunt diacriticele și corectarea greșelilor de tastare din original
  // („incorrect”, „correct”, „serviu”, „competii”, „ocazionale”).
  //
  // Decizia clientului din 10 august 2026: durata se afișează ca 90 de zile,
  // cu mențiunea „conform OUG 140/2021”, iar restul textului rămâne identic cu
  // documentul — inclusiv clauza de transport, care lasă plata în sarcina
  // clientului în ambele sensuri. Nu modifica aceste texte fără acordul lui.
  // ---------------------------------------------------------------
  {
    slug: "certificat-garantie",
    titlu: "Certificat de garanție — piese auto second-hand din dezmembrări",
    titluScurt: "Certificat de garanție",
    sectiuni: [
      { h: "Durata garanției", p: [
        `Produsele cumpărate de la ${firma.denumire} sunt piese auto second-hand provenite din dezmembrarea autoturismelor și beneficiază de garanție pe o perioadă de 90 de zile (3 luni), care începe să curgă din momentul facturării, conform OUG 140/2021 privind anumite aspecte referitoare la contractele de vânzare de bunuri.`,
      ]},
      { h: "Categorii de piese care beneficiază de garanție", p: [
        "Ambreiaje · arcuri · amortizoare · articulații planetare · elemente de caroserie · elemente de direcție · elemente de frână · semnalizatoare · stopuri · cabluri · pompe · radiatoare · tobe și țevi de eșapament · rulmenți · fișe de bujii · piese de electromotor și alternator · piese de motor în mișcare.",
      ]},
      { h: "Ce se întâmplă dacă piesa se defectează în garanție", p: [
        "Piesele care prezintă în perioada de garanție defecte vor fi înlocuite cu altele sau se va returna contravaloarea achitată la achiziție.",
      ]},
      { h: "Vânzătorul este exonerat de răspundere privind garanția sau aceasta poate fi anulată în următoarele cazuri", lista: [
        `piesa nu a fost cumpărată de la ${firma.denumire};`,
        "piesa nu a fost montată într-un atelier de specialitate autorizat de RAR pentru tipul de serviciu solicitat sau de către reprezentantul legal al producătorului autovehiculului (reprezentanța auto);",
        "piesa s-a defectat datorită unui montaj incorect sau datorită montării împreună cu piese conexe uzate, defecte ori modificate;",
        "piesa a fost greșit aleasă sau a fost utilizată pentru alt scop decât cel indicat în catalogul producătorului;",
        "piesa nu a fost identificată corect datorită prezentării de către cumpărător a unor date eronate sau nu a fost comparată la montaj cu piesa de înlocuit;",
        "piesa s-a uzat sau deteriorat datorită suprasolicitării, întreținerii incorecte sau insuficiente a autovehiculului, neefectuării reviziilor periodice conform recomandărilor producătorului autoturismului, ori atelierul de specialitate care a efectuat montajul nu a stabilit verificările și reglajele ulterioare conform tehnologiei de montaj sau impuse de producător;",
        "autoturismul a fost folosit în alte scopuri decât cel prevăzut de constructor sau a fost exploatat în condiții necorespunzătoare (raliuri, competiții sportive etc.);",
        "autoturismul a fost accidentat sau a suferit avarii produse de factori externi, atmosferici sau de altă natură (șocuri termice, electrice, mecanice);",
        "piesele prezintă urme de lovituri, zgârieturi, îndoituri, rupturi, deformări;",
        "piesele nu mai au inscripționările și sigiliile aplicate de parcul de dezmembrări auto.",
      ]},
      { h: "Piesele care fac obiectul unei reclamații în garanție vor fi însoțite de următoarele documente", lista: [
        "copie după factura de achiziție, împreună cu bonul sau chitanța cu care a fost cumpărată piesa;",
        "dovada montării într-un service autorizat RAR (deviz de montaj) și documentele fiscale aferente;",
        "notă de constatare emisă de către un service autorizat RAR, prin care se constată și se descrie detaliat defecțiunea;",
        "copie după certificatul de înmatriculare al autovehiculului;",
        "copie după autorizația RAR a service-ului unde s-a făcut montajul.",
      ]},
      { h: "Termene de soluționare", p: [
        "Reclamația depusă de cumpărător va fi analizată și va primi un răspuns în termen de 15 zile lucrătoare de la data recepției produselor reclamate la sediul vânzătorului, însoțite de toate documentele enumerate mai sus.",
        "În cazul în care reclamația a fost justificată, vânzătorul se obligă la înlocuirea produsului în termen de 7 zile sau se va returna contravaloarea comenzii la achiziție. Garanția acoperă cel mult valoarea integrală a produsului reclamat.",
      ]},
      { h: "În caz de dezacord", p: [
        "În cazuri speciale, când părțile nu ajung la un consens cu privire la reclamația de garanție, părțile vor trimite piesele pentru analiză la un specialist în domeniu. Rezultatele analizei vor fi considerate obligatorii atât pentru vânzător, cât și pentru cumpărător. Cheltuielile ocazionate de efectuarea analizei vor fi suportate de partea în culpă.",
      ]},
      { h: "Plata transportului pentru produsele trimise în vederea soluționării garanției va fi împărțită astfel", lista: [
        `de la client către ${firma.denumire} — plata va fi efectuată de către client;`,
        `de la ${firma.denumire} către client — plata va fi suportată de către clientul destinatar.`,
      ]},
      { h: "Piese fără garanție (consumabile)", p: [
        "Nu se acordă termenul de garanție pentru piesele auto cu caracter consumabil: filtre (de ulei, aer, combustibil, habitaclu), becuri, ștergătoare de parbriz, burdufuri, bujii de aprindere și incandescente, garnituri metalo-plastice și simeringuri, curele de transmisie și distribuție.",
      ]},
      { h: "Valabilitate teritorială", p: [
        "Garanția este valabilă doar pe teritoriul României, cu excepția situațiilor când este solicitată în mod expres garanția în Uniunea Europeană și aceasta este stipulată pe documentul justificativ.",
      ]},
    ],
  },
  {
    slug: "setari-cookie-uri",
    titlu: "Setări cookie-uri",
    sectiuni: [
      { h: "Gestionează-ți preferințele", p: [
        "Folosește panoul de mai jos pentru a vedea și schimba alegerea făcută în bannerul de cookie-uri. Alegerea se aplică imediat și o poți modifica oricând, revenind pe această pagină.",
      ]},
      { h: "Ce înseamnă fiecare variantă", lista: [
        "„Doar necesare” — rămân active doar elementele fără de care site-ul nu funcționează: coșul, favoritele, sesiunea de autentificare și chiar reținerea acestei alegeri.",
        "„Statistică” — se încarcă Google Analytics, care măsoară anonim cum e folosit site-ul și pune două cookie-uri proprii.",
        "„Publicitate” — se încarcă eticheta Google Ads și pixelul Meta (Facebook, Instagram), care ne arată care reclamă a adus o comandă și ne permit să îți arătăm reclame cu piesele pe care le-ai privit. Pun trei cookie-uri, cu durata de 90 de zile.",
        "Cele două comutatoare sunt independente: poți ține statistica pornită și publicitatea oprită, sau invers. Detaliile fiecărui cookie, cu nume și durată, sunt în Politica de cookies.",
      ]},
      { h: "Ce nu poți dezactiva și de ce", p: [
        "Elementele strict necesare nu pot fi oprite din site: fără ele nu ai coș de cumpărături și nu poți rămâne autentificat în cont. Le poți însă șterge oricând din browser.",
        "Lista completă a ce se salvează în browserul tău, cu scopul și durata fiecărui element, se află în pagina Politica de cookies.",
      ]},
    ],
  },
  {
    slug: "anpc-si-sol",
    titlu: "ANPC și Soluționarea Online a Litigiilor",
    sectiuni: [
      { h: "Scrie-ne întâi nouă", p: [
        "Aproape orice neînțelegere se rezolvă într-un telefon sau într-un e-mail. Înainte de a te adresa unei autorități, dă-ne șansa să reparăm noi problema — răspundem la fiecare sesizare.",
        `Ne găsești la telefon ${firma.telefon}${firma.email ? `, pe e-mail la ${firma.email}` : ""} sau prin pagina de contact.`,
      ]},
      { h: "Protecția consumatorilor", p: [
        "Autoritatea Națională pentru Protecția Consumatorilor (ANPC): anpc.ro. Pentru soluționarea alternativă a litigiilor (SAL): anpc.ro/ce-este-sal.",
        "Platforma europeană de Soluționare Online a Litigiilor (SOL): ec.europa.eu/consumers/odr.",
        "Ne dorim însă ca orice problemă să o rezolvăm direct, rapid și corect — scrie-ne mai întâi prin pagina de contact.",
      ]},
      { h: "Ce este soluționarea alternativă a litigiilor (SAL)", p: [
        "SAL este o procedură prin care un litigiu între un consumator și un comerciant se rezolvă în afara instanței, cu ajutorul unei entități specializate. Este de regulă mai rapidă și mai ieftină decât un proces.",
        "Procedura se aplică după ce ai depus mai întâi o reclamație direct la comerciant și nu ai ajuns la o soluție.",
      ]},
      { h: "Ce să pregătești pentru o reclamație", lista: [
        "numărul comenzii (de forma AP-2026-01000) și factura;",
        "o descriere scurtă a problemei, în ordine cronologică;",
        "fotografii, dacă problema este vizibilă;",
        "corespondența purtată cu noi până în acel moment;",
        "pentru reclamațiile în garanție, documentele enumerate în Certificatul de garanție.",
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
