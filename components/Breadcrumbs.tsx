import Link from "next/link";
// Firimituri de navigație — fiecare segment e clicabil (ultimul e pagina curentă).
export type Crumb = { t: string; href?: string };

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Navigație" className="dim flex-wrap">
      {items.map((c, i) => (
        <span key={i} className="flex items-center gap-2">
          {c.href ? <Link href={c.href} className="hover:text-accent transition">{c.t}</Link>
                  : <span className="text-text">{c.t}</span>}
          {i < items.length - 1 && <span className="text-chenar">/</span>}
        </span>
      ))}
    </nav>
  );
}
