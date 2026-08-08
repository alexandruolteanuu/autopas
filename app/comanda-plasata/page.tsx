import Link from "next/link";
export const metadata = { title: "Comandă plasată" };
export const dynamic = "force-dynamic";

export default function ComandaPlasata({ searchParams }: { searchParams: { nr?: string; email?: string } }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <div className="w-16 h-16 mx-auto rounded-full bg-ok text-white grid place-items-center text-3xl">✓</div>
      <h1 className="font-disp font-bold text-3xl mt-5">Comanda a fost înregistrată</h1>
      <p className="text-textSecundar mt-2">Numărul comenzii tale: <b className="text-text font-disp text-lg">{searchParams.nr ?? "—"}</b></p>
      <div className="card p-6 mt-7 text-left text-sm space-y-3">
        <b className="font-disp font-semibold text-[13px]">Ce urmează</b>
        {[
          ["1","Verificăm piesa încă o dată și calculăm costul transportului, în funcție de greutatea și dimensiunile ei."],
          ["2","Te sunăm cu totalul final — piese plus transport. Nu expediem nimic până nu ești de acord cu suma."],
          ["3","Primești pe e-mail" + (searchParams.email ? ` (${searchParams.email})` : "") + " factura și numărul AWB pentru urmărirea coletului."],
          ["4","Curierul livrează în 1–3 zile lucrătoare. Plătești ramburs la primire (dacă ai ales ramburs)."],
        ].map(([n,t]) => (
          <div key={n} className="flex gap-3"><span className="w-6 h-6 rounded-full bg-accent text-accentText grid place-items-center text-xs font-bold shrink-0">{n}</span><span>{t}</span></div>
        ))}
      </div>
      <div className="mt-7 flex gap-3 justify-center">
        <Link href="/piese" className="btn-dark">Continuă cumpărăturile</Link>
        <Link href="/" className="btn-acc">Înapoi acasă</Link>
      </div>
    </div>
  );
}
