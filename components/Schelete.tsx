// ============================================================
// SCHELETE DE ÎNCĂRCARE
//
// DE CE NU UN CERC ROTITOR
// Un cerc spune „se întâmplă ceva", dar nu spune CE, iar când sosește
// conținutul pagina sare: cercul ocupa alt spațiu decât cardurile. Scheletele
// au exact forma și dimensiunile a ceea ce urmează, deci trecerea e o simplă
// umplere, nu o rearanjare. CLS-ul rămâne 0.
//
// DE CE EXISTĂ
// Măsurat pe producție: după un click în meniu, pagina veche rămâne pe ecran
// ~1,2 secunde fără niciun semn, fiindcă rutele randează pe server. Navigarea
// era de fapt mai RAPIDĂ decât încărcarea directă (1,2 s față de 1,5 s) — deci
// problema nu era viteza, ci lipsa unui răspuns la click. Un ecran care nu
// confirmă apăsarea pare mai lent decât unul care se umple vizibil în același
// timp.
//
// `animate-pulse` e singura animație: discretă, și se oprește singură când
// utilizatorul a cerut mișcare redusă (vezi `prefers-reduced-motion` din
// globals.css, dacă e definit acolo).
// ============================================================

/** Dreptunghi gri, cu forma dată din afară. Cărămida tuturor scheletelor. */
export function Bloc({ className = "" }: { className?: string }) {
  return <div className={`bg-suprafata2 rounded-lg animate-pulse ${className}`} />;
}

/** Cardul de piesă: aceeași stivă ca `ProductCard` — imagine 4:3, cod, denumire
 *  pe două rânduri, preț, buton lipit de bază. */
export function ScheletCard() {
  return (
    <div className="card overflow-hidden flex flex-col">
      <Bloc className="w-full aspect-[4/3] rounded-none" />
      <div className="flex-1 flex flex-col p-3.5 gap-2">
        <Bloc className="h-3 w-2/5" />
        <Bloc className="h-4 w-full" />
        <Bloc className="h-4 w-3/4" />
        <Bloc className="h-6 w-1/3 mt-1" />
        <Bloc className="h-11 w-full mt-auto" />
      </div>
    </div>
  );
}

/** Grila de listare. Numărul implicit e cel al unei pagini reale de catalog. */
export function ScheletGrila({ cate = 12 }: { cate?: number }) {
  return (
    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
      {Array.from({ length: cate }).map((_, i) => <ScheletCard key={i} />)}
    </div>
  );
}

/** Capul unei pagini de listare: firul Ariadnei, titlul, rândul cu numărul de piese. */
export function ScheletAntetListare() {
  return (
    <>
      <Bloc className="h-4 w-52" />
      <Bloc className="h-9 w-3/4 max-w-md mt-3" />
      <Bloc className="h-4 w-40 mt-3" />
    </>
  );
}
