"use client";
import Breadcrumbs from "@/components/Breadcrumbs";
import { useCart } from "@/components/CartContext";
import ProductPhoto from "@/components/ProductPhoto";
import { lei, cuvantPiese } from "@/lib/format";
import SelectorCantitate from "@/components/SelectorCantitate";
import { useEffect, useRef, useState } from "react";
import { ev, MONEDA } from "@/lib/analytics";
import DiscountBox, { type Reducere } from "@/components/DiscountBox";
import Link from "next/link";
import StareGoala from "@/components/StareGoala";
import { IconCos } from "@/components/Icoane";
import { useVacanta } from "@/components/VacantaContext";
import { VacantaBanner } from "@/components/VacantaNota";

export default function Cos() {
  const { items, remove, total, bucati, setCantitate, reimprospateazaStoc } = useCart();
  // Coșul NU se golește în vacanță: piesele rămân, ca omul să le regăsească
  // la reluare. Se blochează doar drumul spre checkout.
  const vacanta = useVacanta();
  const [reducere, setReducere] = useState<Reducere>(null);
  // Coșul NU e gata la montare: `CartContext` îl citește din `localStorage`
  // într-un efect, deci la prima randare `items` e gol. Un efect cu lista de
  // dependențe goală ar rula exact atunci și n-ar trimite nimic — verificat în
  // browser: la navigarea din interiorul aplicației mergea, la încărcarea
  // directă a paginii nu. Așteptăm primul coș neg, apoi trimitem O SINGURĂ dată.
  const trimis = useRef(false);
  useEffect(() => {
    if (trimis.current || items.length === 0) return;
    trimis.current = true;
    ev("view_cart", { currency: MONEDA, value: total,
      items: items.map((i) => ({ item_id: i.oem || String(i.id), item_name: i.nume, price: i.pret, quantity: i.cantitate })) });
  }, [items, total]);

  // STOCUL se recitește la fiecare deschidere a coșului (20 octombrie 2026).
  // Coșul trăiește în `localStorage`, deci cantitatea pusă acum o săptămână
  // poate depăși ce mai există. Recitirea taie cantitățile la stocul real și
  // marchează piesele vândute ÎNAINTE de checkout — altfel clientul completa
  // tot formularul de livrare ca să fie refuzat de server la ultimul pas.
  //
  // Se cheamă o singură dată, la primul coș nenul (ca `view_cart` mai sus):
  // un efect pe `[items]` ar reporni la fiecare scriere a propriului rezultat.
  const stocCerut = useRef(false);
  useEffect(() => {
    if (stocCerut.current || items.length === 0) return;
    stocCerut.current = true;
    reimprospateazaStoc();
  }, [items, reimprospateazaStoc]);

  // Piesele care s-au vândut între timp. Cât timp sunt în coș, finalizarea e
  // blocată: `plaseaza_comanda` le-ar respinge oricum, dar aici o aflăm la
  // primul ecran, nu la ultimul.
  const vandute = items.filter((i) => i.stoc === 0);

  useEffect(() => { // păstrăm reducerea pentru checkout
    if (reducere) sessionStorage.setItem("autopas_reducere", JSON.stringify(reducere));
    else sessionStorage.removeItem("autopas_reducere");
  }, [reducere]);
  if (items.length === 0)
    return (
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 py-16">
        <StareGoala
          icon={<IconCos className="w-7 h-7" />}
          titlu="Coșul tău e gol"
          text="Caută piesa de care ai nevoie după marcă și model — depozitul se schimbă săptămânal."
          actiune={{ eticheta: "Vezi piesele pe stoc", href: "/piese" }}
          secundar={{ eticheta: "Caută după mașină", href: "/cauta-dupa-masina" }}
        />
      </div>
    );
  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumbs items={[{ t: "Acasă", href: "/" }, { t: "Coșul meu" }]} />
      <h1 className="t-sectiune mt-2 mb-6">Coșul meu <span className="text-textSecundar text-lg">· {bucati} {cuvantPiese(bucati)}</span></h1>
      {vacanta.activ && <VacantaBanner vacanta={vacanta} className="mb-6" />}
      <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr),340px] gap-6 items-start">
        {/* Pe telefon fiecare piesă e un card: imagine 80px în stânga, denumirea
            și prețul în dreapta, iar „Șterge" pe rândul lui, ca țintă de 44px.
            Selectorul de cantitate apare pe fiecare rând, plafonat la stocul
            recitit la deschiderea coșului. Majoritatea pieselor din dezmembrări
            sunt unicate, dar 84 au stoc peste 1 — vezi CartContext. */}
        <div className="card divide-y divide-chenar">
          {items.map((i) => (
            <div key={i.id} className="p-4">
              <div className="flex gap-3 sm:gap-4 min-w-0">
                {/* Poza REALĂ a piesei, cu desenul doar ca rezervă. Aceeași
                    componentă ca pe carduri și pe pagina de produs, deci arată
                    la fel peste tot. Înainte era `PartArt` fix, adică desenul
                    chiar și pentru cele 8.700 de piese care au poze. */}
                <ProductPhoto poze={i.poza ? [i.poza] : null} art={i.art} alt={i.nume}
                  className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <Link href={`/piese/${i.slug}`} className="inline-flex items-center min-h-[44px] font-semibold text-[15px] leading-snug accentuat-hover break-words">{i.nume}</Link>
                  <div className="text-[13px] text-textSecundar mt-0.5 break-words">
                    OEM {i.oem} · {i.stoc === 0
                      ? <span className="text-red-600 font-semibold">s-a vândut între timp</span>
                      : (i.stoc ?? 0) > 1
                      ? `${i.stoc} buc. pe stoc`
                      : "piesă unică — rezervată 30 min"}
                  </div>
                  {/* Prețul unei bucăți rămâne la vedere când sunt mai multe:
                      altfel clientul vede 1.800 lei pe un rând de 450 și crede
                      că s-a scumpit piesa. */}
                  <b className="block mt-1.5 font-disp text-lg accentuat tabular-nums">{lei(i.pret * i.cantitate)}</b>
                  {i.cantitate > 1 && (
                    <div className="text-[12px] text-textSecundar tabular-nums">{i.cantitate} × {lei(i.pret)}</div>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                {/* Selectorul apare doar când chiar se poate alege ceva: la o
                    piesă unicat un „− 1 +" cu ambele butoane stinse arată a
                    defect. Plafonul e stocul recitit mai sus. */}
                {(i.stoc ?? 0) > 1
                  ? <SelectorCantitate max={i.stoc!} valoare={i.cantitate}
                      setValoare={(n) => setCantitate(i.id, n)} />
                  : <span />}
                <button onClick={() => remove(i.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-chenar px-3 min-h-[44px] text-[13px] text-textSecundar hover:text-red-600 hover:border-red-300">
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
                  </svg>
                  Șterge piesa
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="card p-5 space-y-3 text-sm lg:sticky lg:top-24">
          <b className="font-disp font-semibold text-[13px]">Sumar comandă</b>
          <div className="flex justify-between"><span>Subtotal</span><b>{lei(total)}</b></div>
          <DiscountBox subtotal={total} reducere={reducere} setReducere={setReducere} />
          {reducere && <div className="flex justify-between text-ok"><span>Reducere {reducere.cod}</span><b>−{lei(reducere.valoare)}</b></div>}
          {/* Transportul nu se poate calcula automat: piesele diferă mult ca greutate
              și gabarit, iar FAN Courier taxează în funcție de ele. Îl stabilim după
              comandă și îl comunicăm clientului înainte de expediere. */}
          <div className="flex justify-between text-textSecundar"><span>Livrare</span><span>se calculează separat</span></div>
          <div className="flex justify-between border-t border-chenar pt-3 text-base"><span>Total piese</span>
            <b className="font-disp text-2xl accentuat tabular-nums">{lei(Math.max(0, total - (reducere?.valoare ?? 0)))}</b></div>
          <p className="text-xs text-textSecundar bg-suprafata2 rounded-lg px-3 py-2 leading-relaxed">
            Costul livrării depinde de greutatea și dimensiunile pieselor. Îl calculăm după
            plasarea comenzii și te sunăm cu totalul exact înainte de expediere.
          </p>
          {vacanta.activ
            ? <span aria-disabled="true"
                className="w-full rounded-xl bg-chenar text-text px-5 min-h-[44px] grid place-items-center text-sm font-semibold text-center cursor-not-allowed">
                Comenzile sunt oprite temporar
              </span>
            : vandute.length > 0
            ? <>
                <p className="text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 leading-relaxed">
                  {vandute.length === 1 ? "O piesă din coș s-a vândut" : `${vandute.length} piese din coș s-au vândut`}
                  {" "}între timp. Scoate-{vandute.length === 1 ? "o" : "le"} ca să poți continua — piesele
                  din dezmembrări sunt unicate și se vând repede.
                </p>
                <span aria-disabled="true"
                  className="w-full rounded-xl bg-chenar text-text px-5 min-h-[44px] grid place-items-center text-sm font-semibold text-center cursor-not-allowed">
                  Finalizează comanda
                </span>
              </>
            : <Link href="/checkout" className="btn-acc w-full">Finalizează comanda</Link>}
          <p className="text-xs text-textSecundar text-center">Plată ramburs sau transfer bancar · Garanție 90 de zile · Retur în 14 zile</p>
        </div>
      </div>
    </div>
  );
}
