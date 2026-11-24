import Breadcrumbs from "@/components/Breadcrumbs";
import ReturnForm from "@/components/ReturnForm";
import Link from "next/link";
export const metadata = { title: "Formular de retur", alternates: { canonical: "/formular-retur" }, description: "Retur în 14 zile, conform OUG 34/2014. Completezi formularul, iar curierul FAN Courier vine la tine să ridice piesa. Primești AWB-ul pe e-mail, fără cont." };

export default function FormularRetur() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Breadcrumbs items={[{ t: "Acasă", href: "/" }, { t: "Informații legale", href: "/legal/politica-de-retur" }, { t: "Formular de retur" }]} />
      <h1 className="t-sectiune mt-2">Formular de retur</h1>
      <p className="text-textSecundar mt-2 leading-relaxed">
        Te-ai răzgândit? Ai dreptul să te retragi din contract în 14 zile calendaristice de la primirea piesei,
        fără să ne dai vreun motiv. Completează formularul de mai jos — nu ai nevoie de cont. Curierul vine la tine.
      </p>

      <div className="card p-5 mt-6">
        <b className="font-disp font-semibold text-[13px]">Ce se întâmplă după ce trimiți formularul</b>
        <ol className="mt-3 space-y-2 text-sm leading-relaxed">
          {[
            "Generăm pe loc AWB-ul de retur și comandăm curierul FAN Courier, la adresa și în ziua alese de tine.",
            "Primești pe e-mail AWB-ul, ziua ridicării și costul transportului — confirmarea retragerii, pe suport durabil, cum cere legea.",
            "Curierul vine între 09:00 și 14:00 și aduce eticheta printată. Dacă te-ai răzgândit sau piesa nu se potrivește, transportul îl plătești curierului, cash; dacă piesa e neconformă, îl plătim noi.",
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
        </ul>
      </div>

      <div className="mt-6"><ReturnForm /></div>

      <p className="text-sm text-textSecundar mt-6">
        Condițiile complete, inclusiv formularul-model prevăzut de lege, sunt în{" "}
        <Link href="/legal/politica-de-retur" className="accentuat font-semibold">Politica de retur</Link>.
      </p>
    </div>
  );
}
