import { getLegal, LEGAL } from "@/lib/legal";
import CookieSettings from "@/components/CookieSettings";
import Link from "next/link";
import { notFound } from "next/navigation";

export function generateStaticParams() { return LEGAL.map((d) => ({ slug: d.slug })); }
export function generateMetadata({ params }: { params: { slug: string } }) {
  const d = getLegal(params.slug); return { title: d?.titlu ?? "Informații legale" };
}

export default function LegalPage({ params }: { params: { slug: string } }) {
  const doc = getLegal(params.slug);
  if (!doc) notFound();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 grid lg:grid-cols-[240px,1fr] gap-8">
      <aside className="card p-4 h-fit text-sm lg:sticky lg:top-24">
        <b className="font-disp font-semibold text-[12px] text-mut">Documente</b>
        <ul className="mt-2 space-y-1.5">
          {LEGAL.map((d) => (
            <li key={d.slug}><Link href={`/legal/${d.slug}`}
              className={d.slug === doc.slug ? "text-acc font-bold" : "hover:text-acc"}>{d.titlu}</Link></li>
          ))}
          <li><Link href="/formular-retur" className="hover:text-acc">Formular de retur</Link></li>
        </ul>
      </aside>
      <article>
        <div className="dim">Informații legale</div>
        <h1 className="font-disp font-bold text-3xl mt-2 mb-6">{doc.titlu}</h1>
        <div className="space-y-6">
          {doc.sectiuni.map((s) => (
            <section key={s.h}>
              <h2 className="font-disp font-semibold text-lg">{s.h}</h2>
              {s.p.map((p, i) => <p key={i} className="text-[15px] leading-relaxed mt-2 text-steel">{p}</p>)}
            </section>
          ))}
        </div>
        {doc.slug === "setari-cookie-uri" && <div className="mt-6"><CookieSettings /></div>}
        <p className="text-xs text-mut mt-8 border-t border-line pt-4">Ultima actualizare: iulie 2026 · Pentru orice întrebare, folosește pagina de <Link href="/contact" className="text-acc font-semibold">contact</Link>.</p>
      </article>
    </div>
  );
}
