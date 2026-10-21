"use client";
// Selectorul de cantitate: − [n] +
//
// DE CE EXISTĂ (20 octombrie 2026)
// Coșul accepta o singură bucată din fiecare piesă, fiindcă „la dezmembrări
// fiecare piesă e unicat". Măsurat pe baza reală: 84 de piese publicate au
// stoc mai mare de 1 — arcuri, injectoare, bobine, capace de jante, adică
// exact ce se cumpără în set. Clientul care voia 4 injectoare putea comanda
// unul singur.
//
// Stă într-un SINGUR loc, folosit și pe pagina piesei și în coș: două copii
// ale lui s-ar despărți la prima corectură a plafonului.
import { useId } from "react";

// NU există variantă „compactă". Prima formă avea una de 36px pentru coș, iar
// verificarea de așezare a prins-o: tot site-ul ține ținte de atingere de
// minimum 44px, iar un „−”/„+” apăsat greșit pe telefon schimbă o cantitate
// care ajunge în comandă.
export default function SelectorCantitate({
  valoare, max, setValoare,
}: { valoare: number; max: number; setValoare: (n: number) => void }) {
  const id = useId();
  // Plafonul e `max`, dar niciodată sub 1: o piesă cu stoc 0 n-ar trebui să
  // ajungă aici, iar dacă ajunge, selectorul nu are voie să arate „0".
  const plafon = Math.max(1, max);
  const pune = (n: number) => setValoare(Math.min(plafon, Math.max(1, n)));
  const dim = "w-11 h-11";

  return (
    <div className="inline-flex items-center gap-1">
      <label htmlFor={id} className="sr-only">Cantitate</label>
      <button type="button" onClick={() => pune(valoare - 1)} disabled={valoare <= 1}
        aria-label="Scade cantitatea"
        className={`${dim} grid place-items-center rounded-lg border border-[rgb(var(--chenar-puternic))] text-text
          disabled:opacity-40 disabled:cursor-not-allowed hover:bg-suprafata2`}>
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2"
          strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
      </button>
      {/* `inputMode="numeric"` ca pe telefon să apară tastatura de cifre.
          Câmpul e editabil: cine vrea 8 bucăți nu apasă de șapte ori pe „+".
          Valoarea se plafonează la fiecare tastă, deci nu poate ieși din stoc. */}
      <input id={id} type="text" inputMode="numeric" value={valoare}
        onChange={(e) => {
          const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
          if (!isNaN(n)) pune(n);
        }}
        aria-label="Cantitate"
        className={`w-12 h-11 rounded-lg border border-[rgb(var(--chenar-puternic))] bg-[rgb(var(--camp-bg))]
          text-center font-semibold tabular-nums text-text`} />
      <button type="button" onClick={() => pune(valoare + 1)} disabled={valoare >= plafon}
        aria-label="Crește cantitatea"
        className={`${dim} grid place-items-center rounded-lg border border-[rgb(var(--chenar-puternic))] text-text
          disabled:opacity-40 disabled:cursor-not-allowed hover:bg-suprafata2`}>
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2"
          strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      </button>
    </div>
  );
}
