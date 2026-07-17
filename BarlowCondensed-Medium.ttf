import Link from "next/link";
export const metadata = { title: "Comandă plasată" };
export const dynamic = "force-dynamic";

export default function ComandaPlasata({ searchParams }: { searchParams: { nr?: string; email?: string } }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <div className="w-16 h-16 mx-auto rounded-full bg-ok text-white grid place-items-center text-3xl">✓</div>
      <h1 className="font-disp font-black uppercase text-3xl mt-5">Comanda a fost plasată!</h1>
      <p className="text-mut mt-2">Numărul comenzii tale: <b className="text-ink font-disp text-lg">{searchParams.nr ?? "—"}</b></p>
      <div className="card p-6 mt-7 text-left text-sm space-y-3">
        <b className="font-disp uppercase tracking-widest text-[13px]">Ce urmează</b>
        {[
          ["1","Confirmăm telefonic comanda și verificăm încă o dată piesa înainte de ambalare."],
          ["2","Primești pe e-mail" + (searchParams.email ? ` (${searchParams.email})` : "") + " factura și numărul AWB pentru urmărirea coletului."],
          ["3","Curierul livrează în 24–48h. Plătești ramburs la primire (dacă ai ales ramburs)."],
        ].map(([n,t]) => (
          <div key={n} className="flex gap-3"><span className="w-6 h-6 rounded-full bg-acc text-white grid place-items-center text-xs font-bold shrink-0">{n}</span><span>{t}</span></div>
        ))}
      </div>
      <div className="mt-7 flex gap-3 justify-center">
        <Link href="/piese" className="btn-dark">Continuă cumpărăturile</Link>
        <Link href="/" className="btn-acc">Înapoi acasă</Link>
      </div>
    </div>
  );
}
