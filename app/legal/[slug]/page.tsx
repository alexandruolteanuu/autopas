import { getLegal, LEGAL_SLUGS } from "@/lib/legal";
import { getSetariServer } from "@/lib/settings";
import CookieSettings from "@/components/CookieSettings";
import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import { notFound } from "next/navigation";

export function generateStaticParams() { return LEGAL_SLUGS.map((d) => ({ slug: d.slug })); }
export function generateMetadata({ params }: { params: { slug: string } }) {
  const d = getLegal(params.slug); return { title: d?.titluScurt ?? d?.titlu ?? "Informații legale" };
}

export default async function LegalPage({ params }: { params: { slug: string } }) {
  // Datele firmei (denumire, sediu, CUI, telefon) vin din Admin → Setări și
  // se completează automat în textele legale.
  const { firma } = await getSetariServer();
  const doc = getLegal(params.slug, firma);
  if (!doc) notFound();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 grid lg:grid-cols-[240px,1fr] gap-8">
      <aside className="card p-4 h-fit text-sm lg:sticky lg:top-24">
        <b className="font-disp font-semibold text-[12px] text-mut">Documente</b>
        <ul className="mt-2 space-y-1.5">
          {LEGAL_SLUGS.map((d) => (
            <li key={d.slug}><Link href={`/legal/${d.slug}`}
              className={d.slug === doc.slug ? "text-acc font-bold" : "hover:text-acc"}>{d.titlu}</Link></li>
          ))}
          <li><Link href="/formular-retur" className="hover:text-acc">Formular de retur</Link></li>
        </ul>
      </aside>
      <article>
        <Breadcrumbs items={[{ t: "Acasă", href: "/" }, { t: "Informații legale" }, { t: doc.titluScurt ?? doc.titlu }]} />
        <h1 className="font-disp font-bold text-3xl mt-2 mb-6">{doc.titlu}</h1>
        <div className="space-y-6">
          {doc.sectiuni.map((s) => (
            <section key={s.h}>
              <h2 className="font-disp font-semibold text-lg">{s.h}</h2>
              {s.p?.map((p, i) => <p key={i} className="text-[15px] leading-relaxed mt-2 text-steel">{p}</p>)}
              {/* Enumerările (piese acoperite, drepturi GDPR, documente necesare) se afișează ca listă,
                  ca să fie citibile — nu ca bloc compact de text. */}
              {s.lista && (
                <ul className="mt-2 space-y-1.5 text-[15px] leading-relaxed text-steel">
                  {s.lista.map((el, i) => (
                    <li key={i} className="flex gap-2"><span className="text-acc mt-[2px]">•</span><span>{el}</span></li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
        {doc.slug === "setari-cookie-uri" && <div className="mt-6"><CookieSettings /></div>}
        {doc.slug === "politica-de-retur" && (
          <p className="text-sm mt-6">
            Textul oficial al OUG 34/2014:{" "}
            <a href="https://legislatie.just.ro/Public/DetaliiDocument/159792" target="_blank" rel="noopener noreferrer"
              className="text-acc font-semibold">legislatie.just.ro</a>
          </p>
        )}
        <p className="text-xs text-mut mt-8 border-t border-line pt-4">Ultima actualizare: august 2026 · Pentru orice întrebare, folosește pagina de <Link href="/contact" className="text-acc font-semibold">contact</Link>.</p>
      </article>
    </div>
  );
}
