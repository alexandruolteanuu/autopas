"use client";
import { useState } from "react";
import { useCart } from "./CartContext";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/types";
import { useVacanta } from "./VacantaContext";
import SelectorCantitate from "./SelectorCantitate";

export default function AddToCart({ p, mare = false }: { p: Product; mare?: boolean }) {
  const { items, add, setCantitate } = useCart();
  const router = useRouter();
  const vacanta = useVacanta();
  const inCos = items.find((x) => x.id === p.id);
  // Cantitatea aleasă ÎNAINTE de adăugare. Odată piesa în coș, sursa adevărului
  // devine coșul — selectorul îl modifică direct, ca să nu existe două numere
  // care se pot contrazice.
  const [cant, setCant] = useState(1);

  // MOD VACANȚĂ — butonul dispare peste tot dintr-o singură dată.
  //
  // Verificarea stă AICI, și nu în `ProductCard`, din două motive: cardul e
  // componentă de server, deci n-are acces la context; și, mai important, ăsta e
  // singurul loc din tot site-ul prin care o piesă ajunge în coș. O regulă pusă
  // în card ar fi lăsat descoperite piesele similare de pe pagina de produs,
  // favoritele și orice listă adăugată pe viitor.
  //
  // Nu e o măsură de securitate — aia e în `plaseaza_comanda`, pe server.
  if (vacanta.activ)
    return (
      <span aria-disabled="true"
        className={`w-full inline-flex items-center justify-center rounded-lg font-semibold
          min-h-[44px] whitespace-nowrap text-center px-4 bg-chenar text-text cursor-not-allowed
          ${mare ? "text-base" : "text-[13px]"}`}>
        Indisponibil temporar
      </span>
    );

  const dateCos = { id: p.id, slug: p.slug, nume: p.nume, pret: Number(p.pret_lei), art: p.art,
    oem: p.oem ?? p.cod_intern ?? "", poza: p.poze?.[0] ?? null, stoc: p.stoc };

  const buton = (clase: string, text: string) => (
    <button
      onClick={() => { if (inCos) { router.push("/cos"); return; }
        add(dateCos, cant); router.push("/cos"); }}
      className={clase}>
      {text}
    </button>
  );

  const claseButon = `inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition
    min-h-[44px] whitespace-nowrap text-center px-4
    ${mare ? "bg-accent text-accentContrast text-base hover:brightness-110"
           : "bg-headerBg text-headerText text-[13px] hover:bg-steel"}`;

  // CANTITATE (20 octombrie 2026). Selectorul apare numai pe pagina piesei
  // (`mare`) și numai când stocul e peste 1 — 84 de piese din catalog, azi.
  // Pe cardurile din grilă NU apare: sunt 24 pe pagină, iar un selector pe
  // fiecare le-ar încărca pentru un caz care atinge mai puțin de 1% din piese.
  // De acolo se adaugă o bucată, iar cantitatea se schimbă în coș.
  if (mare && p.stoc > 1)
    return (
      // „Cantitate" și butonul pe ACELAȘI rând (cerut de proprietar), iar
      // WhatsApp/Favorite dedesubt — de asta pagina piesei trece grila pe o
      // singură coloană când stocul e peste 1.
      //
      // `flex-wrap` e plasa pentru ecranele foarte înguste: la 320px selectorul
      // (144px) plus butonul nu încap pe un rând, iar butonul are
      // `whitespace-nowrap`, deci n-are cum să se îngusteze — fără wrap ar ieși
      // din card. Așa coboară singur pe rândul următor. Măsurat pe 11 lățimi:
      // pe un rând de la 360px în sus, pe două la 320px.
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Cuvântul „Cantitate" dispare sub 480px: cu el, blocul din stânga
              are 224px și butonul nu mai încape pe același rând pe telefon
              (măsurat: la 390px rămân 358px utili, iar butonul cere 176).
              Selectorul rămâne limpede singur, iar cititoarele de ecran au
              `aria-label`-urile din SelectorCantitate. */}
          <span className="hidden min-[480px]:inline text-[13px] text-textSecundar">Cantitate</span>
          <SelectorCantitate max={p.stoc}
            valoare={inCos ? inCos.cantitate : cant}
            setValoare={(n) => (inCos ? setCantitate(p.id, n) : setCant(n))} />
        </div>
        {buton(`${claseButon} flex-1 min-w-[10rem]`,
          inCos ? `În coș: ${inCos.cantitate} buc. — vezi coșul` : "Adaugă în coș")}
      </div>
    );

  return buton(`${claseButon} w-full`, inCos ? "În coș — vezi coșul" : "Adaugă în coș");
}
