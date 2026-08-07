// Schelete de încărcare: dreptunghiuri cu pulsație, în FORMA elementului care
// urmează — nu un cerc rotitor în mijlocul paginii. Așa pagina nu mai sare
// când sosesc datele, fiindcă locul e deja rezervat.

export function ScheletCardProdus() {
  return (
    <div className="h-full flex flex-col card overflow-hidden" aria-hidden="true">
      <div className="schelet w-full aspect-[4/3] rounded-none" />
      <div className="flex-1 flex flex-col p-3.5 gap-2">
        <div className="schelet h-3 w-2/3" />
        <div className="schelet h-4 w-full" />
        <div className="schelet h-4 w-4/5" />
        <div className="schelet h-6 w-1/2 mt-1" />
        <div className="mt-auto pt-3"><div className="schelet h-11 w-full" /></div>
      </div>
    </div>
  );
}

export function ScheletGrilaProduse({ cate = 8 }: { cate?: number }) {
  return (
    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6"
      role="status" aria-label="Se încarcă piesele">
      {Array.from({ length: cate }).map((_, i) => <ScheletCardProdus key={i} />)}
    </div>
  );
}

/** Schelet pentru listele din /admin — aceeași înălțime cu un rând real. */
export function ScheletLista({ randuri = 6 }: { randuri?: number }) {
  return (
    <div className="card p-4 space-y-3" role="status" aria-label="Se încarcă lista">
      {Array.from({ length: randuri }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="schelet h-4 w-24" />
          <div className="schelet h-4 flex-1" />
          <div className="schelet h-4 w-20" />
        </div>
      ))}
    </div>
  );
}
