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
  // `grid-cols-1` de mai jos nu e de decor: fără el, sub `lg:` grila are o singură
  // coloană `auto`, care se lățește cât cel mai lat conținut. Tabelul de cookie-uri
  // are `min-w-[560px]`, iar cei 560px urcau prin coloană și scoteau toată pagina
  // din ecran (578px pe un telefon de 320px), în loc să fie tăiați de
  // `overflow-x-auto` al tabelului. `grid-cols-1` înseamnă `minmax(0,1fr)`, adică
  // lățime minimă zero — abia atunci tabelul defilează singur, cum era gândit.
  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-[240px,minmax(0,1fr)] gap-8">
      <aside className="card p-4 h-fit text-sm lg:sticky lg:top-24">
        <b className="font-disp font-semibold text-[12px] text-textSecundar">Documente</b>
        <ul className="mt-2 space-y-1.5">
          {LEGAL_SLUGS.map((d) => (
            <li key={d.slug}><Link href={`/legal/${d.slug}`}
              className={d.slug === doc.slug ? "accentuat font-bold" : "accentuat-hover"}>{d.titlu}</Link></li>
          ))}
          <li><Link href="/formular-retur" className="accentuat-hover">Formular de retur</Link></li>
        </ul>
      </aside>
      <article>
        <Breadcrumbs items={[{ t: "Acasă", href: "/" }, { t: "Informații legale" }, { t: doc.titluScurt ?? doc.titlu }]} />
        <h1 className="t-sectiune mt-2 mb-6">{doc.titlu}</h1>
        <div className="space-y-6">
          {doc.sectiuni.map((s) => (
            <section key={s.h}>
              <h2 className="font-disp font-semibold text-lg">{s.h}</h2>
              {s.p?.map((p, i) => <p key={i} className="text-[15px] leading-relaxed mt-2 text-text">{p}</p>)}
              {/* Enumerările (piese acoperite, drepturi GDPR, documente necesare) se afișează ca listă,
                  ca să fie citibile — nu ca bloc compact de text. */}
              {s.lista && (
                <ul className="mt-2 space-y-1.5 text-[15px] leading-relaxed text-text">
                  {s.lista.map((el, i) => (
                    <li key={i} className="flex gap-2"><span className="accentuat mt-[2px]">•</span><span>{el}</span></li>
                  ))}
                </ul>
              )}
              {/* Tabelele (lista de cookie-uri, scopurile GDPR) derulează pe orizontală
                  în interiorul propriei casete. Pe telefon patru coloane nu încap, iar
                  fără `overflow-x-auto` tabelul ar lăți toată pagina. */}
              {s.tabel && (
                <div className="mt-3 overflow-x-auto rounded-[var(--r-mediu)] border border-chenar">
                  <table className="w-full min-w-[560px] border-collapse text-[14px]">
                    <thead>
                      <tr className="bg-suprafata2 text-left">
                        {s.tabel.capuri.map((c) => (
                          <th key={c} className="font-disp font-semibold p-3 border-b border-chenar align-top">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {s.tabel.randuri.map((r, i) => (
                        <tr key={i} className="border-b border-chenar last:border-0 align-top">
                          {r.map((celula, j) => (
                            <td key={j} className={`p-3 leading-relaxed ${j === 0 ? "font-semibold whitespace-nowrap" : "text-textSecundar"}`}>{celula}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
        </div>
        {doc.slug === "setari-cookie-uri" && <div className="mt-6"><CookieSettings /></div>}
        {doc.slug === "politica-de-retur" && (
          <p className="text-sm mt-6">
            Textul oficial al OUG 34/2014:{" "}
            <a href="https://legislatie.just.ro/Public/DetaliiDocument/159792" target="_blank" rel="noopener noreferrer"
              className="accentuat font-semibold">legislatie.just.ro</a>
          </p>
        )}
        <p className="text-xs text-textSecundar mt-8 border-t border-chenar pt-4">Ultima actualizare: august 2026 · Pentru orice întrebare, folosește pagina de <Link href="/contact" className="accentuat font-semibold">contact</Link>.</p>
      </article>
    </div>
  );
}
