import Breadcrumbs from "@/components/Breadcrumbs";
import { IconPin } from "@/components/Icoane";
import { PROGRAM, ADRESA } from "@/lib/config";
export const metadata = { title: "Despre noi" };
// Varianta STANDARD cerută în feedback — fără date inventate.
// Adresa depozitului vine din `ADRESA` (lib/config.ts), un singur loc pentru tot site-ul.
export default function DespreNoi() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Breadcrumbs items={[{ t: "Acasă", href: "/" }, { t: "Despre noi" }]} />
      <h1 className="t-sectiune mt-2">Despre noi</h1>
      <div className="mt-5 space-y-4 leading-relaxed">
        <p>Autopas Dezmembrări este un centru autorizat de dezmembrări auto din județul Neamț, pe DN 15 între Piatra-Neamț și Bicaz, specializat în vânzarea de piese auto second-hand verificate. Oferim piese pentru o gamă largă de mărci și modele, cu fotografii reale ale fiecărui produs și informații complete despre proveniență.</p>
        <p>Fiecare vehicul care intră în curtea noastră trece printr-un proces controlat: identificare, dezmembrare, verificarea pieselor, fotografiere și etichetare cu cod OEM. Toate piesele vândute beneficiază de garanție și pot fi returnate conform legislației în vigoare.</p>
      </div>
      <div className="card p-5 mt-6">
        <b className="font-disp font-semibold text-[13px]">Activitate autorizată</b>
        <ul className="mt-3 space-y-2 text-sm">
          {["Autorizație de mediu pentru tratarea vehiculelor scoase din uz",
            "Autorizat RAR pentru dezmembrare și emiterea certificatului de distrugere",
            "Predare vehicule în programul Rabla — certificat de distrugere pe loc"].map((a) => (
            <li key={a} className="flex gap-2"><span className="text-ok font-bold">✓</span>{a}</li>
          ))}
        </ul>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
        {[["Piese verificate","înainte de listare"],["Garanție 90 de zile","conform OUG 140/2021"],["Livrare în toată țara","prin curier rapid"],["Retur în 14 zile","conform legislației"]].map(([t,d]) => (
          <div key={t} className="bg-headerBg text-headerText rounded-xl p-4 text-center">
            <b className="font-disp block">{t}</b><span className="text-headerText/60 text-xs">{d}</span>
          </div>
        ))}
      </div>
      <div className="card p-5 mt-6 flex items-center justify-between flex-wrap gap-3">
        <span className="flex items-center gap-2"><IconPin className="w-[18px] h-[18px] shrink-0 text-accent" /><span><b>{ADRESA.scurt}</b> · deschis {PROGRAM}</span></span>
        <span className="text-textSecundar text-sm">Ridicare personală posibilă, cu programare telefonică.</span>
      </div>
    </div>
  );
}
