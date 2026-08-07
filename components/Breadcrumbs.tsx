import Link from "next/link";
// Firimituri de navigație — fiecare segment e clicabil (ultimul e pagina curentă).
//
// Pe telefon se afișează doar ultimele două segmente. Cu ținte de atingere de
// 44px, un traseu complet („Acasă / Piese auto / Categorie / Subcategorie /
// numele piesei") se rupea pe patru rânduri și împingea butonul de comandă
// mult sub marginea ecranului.
export type Crumb = { t: string; href?: string };

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Navigație" className="dim flex-wrap">
      {items.map((c, i) => {
        const ascunsPeTelefon = i < items.length - 2;
        return (
          <span key={i} className={`items-center gap-2 ${ascunsPeTelefon ? "hidden sm:flex" : "flex"}`}>
            {c.href ? <Link href={c.href} className="inline-flex items-center min-h-[44px] hover:text-accent transition">{c.t}</Link>
                    : <span className="text-text">{c.t}</span>}
            {i < items.length - 1 && <span className="text-chenar">/</span>}
          </span>
        );
      })}
    </nav>
  );
}
