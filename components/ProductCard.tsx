import LinkPiesa from "./LinkPiesa";
import ProductPhoto from "./ProductPhoto";
import FavButton from "./FavButton";
import AddToCart from "./AddToCart";
import { lei } from "@/lib/format";
import type { Product } from "@/lib/types";

// Cardul de produs e o stivă verticală, în ordine fixă: imagine, cod, denumire,
// preț, stoc, buton. Butonul stă lipit de baza cardului (`mt-auto`) și ocupă
// toată lățimea — înainte împărțea rândul cu prețul, se strângea, iar eticheta
// „Adaugă în coș" se rupea pe două rânduri pe telefon.
export default function ProductCard({ p, prioritara = false }: { p: Product; prioritara?: boolean }) {
  return (
        // Un singur efect la trecerea cu mouse-ul: chenar în accent, umbra de
    // nivel 2 și imaginea mărită cu 3%. Fără umbră în stare normală.
    <div className="group h-full flex flex-col card overflow-hidden transition-[box-shadow,border-color] duration-200 hover:border-accentChenar/40 hover:shadow-[var(--umbra-2)]">
      {/* `LinkPiesa` în loc de `Link`: raportează `select_item` la click. Cardul
          rămâne componentă de server — doar linkul trece în browser. */}
      <LinkPiesa p={p} className="block overflow-hidden">
        <ProductPhoto poze={p.poze} art={p.art} alt={p.nume} prioritara={prioritara}
          className="w-full aspect-[4/3] transition-transform duration-200 group-hover:scale-[1.03]" />
      </LinkPiesa>

      <div className="flex-1 flex flex-col p-3.5 gap-1.5">
        <div className="font-disp text-[12px] tracking-wider text-textSecundar uppercase">
          {p.oem ? `Cod OEM ${p.oem}` : p.cod_intern ?? ""}{p.ani ? ` · ${p.ani}` : ""}
        </div>

        <LinkPiesa p={p} className="t-card accentuat-hover line-clamp-2 min-h-[44px]">
          {p.nume}
        </LinkPiesa>

        <div className="t-pret accentuat">
          {lei(Number(p.pret_lei), p.pret_sufix)}
        </div>

        {/* Marcajele și inima pe același rând: inima NU mai stă peste imagine,
            ca să nu se suprapună cu linkul piesei. */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="min-w-0 flex flex-wrap gap-1.5">
            {p.stoc > 0
              ? <span className="inline-block text-[12px] px-2 py-0.5 rounded-full bg-ok/10 text-ok">În stoc</span>
              : <span className="inline-block text-[12px] px-2 py-0.5 rounded-full bg-chenar text-text">Stoc epuizat</span>}
            {p.originala !== false && (
              <span className="inline-block text-[12px] px-2 py-0.5 rounded-full bg-accent/10 accentuat">Originală</span>
            )}
          </div>
          <FavButton id={p.id} />
        </div>

        <div className="mt-auto pt-3">
          <AddToCart p={p} />
        </div>
      </div>
    </div>
  );
}
