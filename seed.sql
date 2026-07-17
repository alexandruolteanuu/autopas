import IntakeForm from "@/components/IntakeForm";
import Link from "next/link";
export const metadata = { title: "Predă mașina la dezmembrat" };

export default function PredaMasina() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="dim">Acasă / Predă mașina</div>
      <h1 className="font-disp font-black uppercase text-3xl mt-2">Predă mașina la dezmembrat</h1>
      <p className="text-mut mt-2 max-w-2xl">Cumpărăm mașini avariate, defecte sau pur și simplu bătrâne. Plata pe loc, acte făcute corect și <b className="text-ink">certificat de distrugere emis imediat</b> — ești șters de la fisc pentru mașină, fără drumuri.</p>
      <div className="grid lg:grid-cols-2 gap-8 mt-8 items-start">
        <div className="space-y-4">
          {[["Evaluare pe loc sau pe poze","Trimite-ne poze pe WhatsApp — îți spunem prețul în aceeași zi."],
            ["Transport gratuit cu platforma","În zona Neamț, ridicăm noi mașina, chiar dacă nu pornește."],
            ["Plata pe loc + acte complete","Contract, certificat de distrugere, tot ce trebuie pentru radiere."]].map(([t,d],i) => (
            <div key={t} className="card p-4 flex gap-4">
              <span className="w-9 h-9 rounded-full bg-ok text-white font-disp font-black grid place-items-center shrink-0">{i+1}</span>
              <div><b>{t}</b><p className="text-sm text-mut mt-0.5">{d}</p></div>
            </div>
          ))}
          <p className="text-sm text-mut">Vrei ecotichetul Rabla în loc de vânzare directă? Vezi <Link href="/programul-rabla" className="text-acc font-bold">Programul Rabla</Link>.</p>
        </div>
        <IntakeForm tip="predare" />
      </div>
    </div>
  );
}
