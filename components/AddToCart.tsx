"use client";
import { useCart } from "./CartContext";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/types";
import { useVacanta } from "./VacantaContext";

export default function AddToCart({ p, mare = false }: { p: Product; mare?: boolean }) {
  const { items, add } = useCart();
  const router = useRouter();
  const vacanta = useVacanta();
  const inCos = items.some((x) => x.id === p.id);

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

  return (
    <button
      onClick={() => { if (inCos) { router.push("/cos"); return; }
        add({ id: p.id, slug: p.slug, nume: p.nume, pret: Number(p.pret_lei), art: p.art, oem: p.oem ?? p.cod_intern ?? "" });
        router.push("/cos"); }}
      className={`w-full inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition
        min-h-[44px] whitespace-nowrap text-center px-4
        ${mare ? "bg-accent text-accentContrast text-base hover:brightness-110" : "bg-headerBg text-headerText text-[13px] hover:bg-steel"}`}>
      {inCos ? "În coș — vezi coșul" : "Adaugă în coș"}
    </button>
  );
}
