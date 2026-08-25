import Breadcrumbs from "@/components/Breadcrumbs";
import ReturnForm from "@/components/ReturnForm";
import Link from "next/link";
import { getSetariServer } from "@/lib/settings";
export const metadata = { title: "Formular de retur" };

export default async function FormularRetur() {
  // Adresa de returnare și datele firmei vin din Admin → Setări, ca peste tot.
  const { firma } = await getSetariServer();
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Breadcrumbs items={[{ t: "Acasă", href: "/" }, { t: "Informații legale", href: "/legal/politica-de-retur" }, { t: "Formular de retur" }]} />
      <h1 className="t-sectiune mt-2">Formular de retur</h1>
      <p className="text-textSecundar mt-2 leading-relaxed">
        Te-ai răzgândit? Ai dreptul să te retragi din contract în 14 zile calendaristice de la primirea piesei,
        fără să ne dai vreun motiv. Completează formularul de mai jos și ne ocupăm noi de restul.
      </p>

      <div className="card p-5 mt-6">
        <b className="font-disp font-semibold text-[13px]">Ce se întâmplă după ce trimiți formularul</b>
        <ol className="mt-3 space-y-2 text-sm leading-relaxed">
          {[
            "Îți confirmăm pe e-mail că am primit decizia ta de retragere — legea ne obligă să o facem pe un suport durabil.",
            "Primești instrucțiunile de expediere și adresa exactă la care trimiți piesa.",
            "Trimiți piesa în cel mult 14 zile de la momentul în care ne-ai anunțat. Costul acestui transport îl suporți tu.",
            "Îți restituim contravaloarea produselor în cel mult 14 zile de la anunțul tău.",
          ].map((pas, i) => (
            <li key={i} className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-accent text-accentContrast grid place-items-center text-xs font-bold">{i + 1}</span>
              <span>{pas}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="card p-5 mt-4">
        <b className="font-disp font-semibold text-[13px]">Înainte să trimiți piesa</b>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-textSecundar">
          <li className="flex gap-2"><span className="accentuat mt-[2px]">•</span><span>Pune în colet o copie a facturii — ne ajută să identificăm imediat comanda.</span></li>
          <li className="flex gap-2"><span className="accentuat mt-[2px]">•</span><span>Ambalează piesa cel puțin la fel de bine cum ai primit-o. O piesă lovită pe drumul de întoarcere înseamnă o scădere de valoare care se reține din suma rambursată.</span></li>
          <li className="flex gap-2"><span className="accentuat mt-[2px]">•</span><span>Poți despacheta și verifica piesa, o poți compara cu cea veche. Dar o piesă montată efectiv pe mașină, rodată sau vopsită, nu se mai poate returna ca nefolosită.</span></li>
          {firma.adresa && (
            <li className="flex gap-2"><span className="accentuat mt-[2px]">•</span><span>Adresa de returnare: <b className="text-text">{firma.adresa}</b></span></li>
          )}
        </ul>
      </div>

      {/* Distincția asta e cea mai frecventă confuzie: oamenii cer „retur” pentru o piesă defectă
          montată acum două luni, care de fapt intră la garanție, cu alte reguli. */}
      <div className="card p-5 mt-4 border-l-4 border-l-accent">
        <b className="font-disp font-semibold text-[13px]">Nu confunda returul cu garanția</b>
        <p className="text-sm mt-2 leading-relaxed text-textSecundar">
          Formularul acesta e pentru „m-am răzgândit”: 14 zile, fără motiv, piesa nefolosită.
          Dacă piesa are un defect, e altceva — atunci vorbim de{" "}
          <Link href="/legal/certificat-garantie" className="accentuat font-semibold">garanție</Link>,
          care ține 90 de zile și cere alte documente. Sună-ne și îți spunem în care dintre cele două cazuri te afli.
        </p>
      </div>

      <div className="mt-6"><ReturnForm /></div>

      <p className="text-sm text-textSecundar mt-6">
        Condițiile complete, inclusiv formularul-model prevăzut de lege, sunt în{" "}
        <Link href="/legal/politica-de-retur" className="accentuat font-semibold">Politica de retur</Link>.
      </p>
    </div>
  );
}
