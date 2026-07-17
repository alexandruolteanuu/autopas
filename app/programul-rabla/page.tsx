// PAGINA CERUTĂ EXPLICIT DE CLIENT: Programul Rabla — detalii + „primesc la Rabla".
import IntakeForm from "@/components/IntakeForm";
export const metadata = { title: "Programul Rabla — predă mașina, primești certificatul pe loc" };

const PASI = [
  ["Ne suni sau completezi formularul","Ne spui ce mașină ai (marcă, model, an). Nu trebuie să fie funcțională."],
  ["Aducem noi mașina, gratuit","Dacă nu se deplasează, venim cu platforma și o ridicăm de la adresa ta, fără cost în zona Neamț."],
  ["Primești certificatul de distrugere PE LOC","Documentul obligatoriu pentru programul Rabla și pentru radierea de la DRPCIV — îl emitem imediat, fiind centru autorizat RAR."],
  ["Folosești certificatul la Rabla","Cu certificatul + actele mașinii beneficiezi de ecotichetul programului Rabla la achiziția unei mașini noi."],
];

export default function Rabla() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="dim">Acasă / Programul Rabla</div>
      <h1 className="font-disp font-black uppercase text-3xl mt-2">Programul Rabla — simplu, cu certificat pe loc</h1>
      <p className="text-mut mt-2 max-w-2xl">Suntem centru autorizat pentru tratarea vehiculelor scoase din uz: preluăm mașina ta veche și îți emitem <b className="text-ink">certificatul de distrugere</b> — actul de care ai nevoie ca să primești ecotichetul Rabla.</p>
      <div className="grid lg:grid-cols-2 gap-8 mt-8 items-start">
        <div className="space-y-4">
          {PASI.map(([t, d], i) => (
            <div key={t} className="card p-4 flex gap-4">
              <span className="w-9 h-9 rounded-full bg-acc text-white font-disp font-black grid place-items-center shrink-0">{i + 1}</span>
              <div><b>{t}</b><p className="text-sm text-mut mt-0.5">{d}</p></div>
            </div>
          ))}
          <div className="card p-4 text-sm">
            <b className="font-disp uppercase tracking-widest text-[13px]">Acte necesare</b>
            <ul className="mt-2 space-y-1 text-mut">
              <li>• Cartea de identitate a vehiculului (CIV) și certificatul de înmatriculare</li>
              <li>• Actul de identitate al proprietarului</li>
              <li>• Dacă nu ești proprietarul din acte: procură sau contract de vânzare</li>
            </ul>
            <p className="mt-3 text-xs text-mut">Condițiile exacte ale ecotichetului (valoare, sesiuni) sunt stabilite anual de AFM — te ajutăm cu îndrumare la zi când ne contactezi.</p>
          </div>
        </div>
        <div>
          <div className="card p-5 mb-4 bg-ink text-white border-ink">
            <b className="font-disp uppercase text-lg">Vrei să predai mașina prin Rabla?</b>
            <p className="text-white/70 text-sm mt-1">Completează formularul — te sunăm în aceeași zi lucrătoare cu toți pașii.</p>
          </div>
          <IntakeForm tip="rabla" />
        </div>
      </div>
    </div>
  );
}
