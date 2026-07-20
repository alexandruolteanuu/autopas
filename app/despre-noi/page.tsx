export const metadata = { title: "Despre noi" };
// Varianta STANDARD cerută în feedback — fără date inventate, adresa doar Piatra-Neamț.
export default function DespreNoi() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="dim">Autopas Dezmembrări · Piatra-Neamț</div>
      <h1 className="font-disp font-bold text-3xl mt-2">Despre noi</h1>
      <div className="mt-5 space-y-4 leading-relaxed">
        <p>Autopas Dezmembrări este un centru autorizat de dezmembrări auto din Piatra-Neamț, specializat în vânzarea de piese auto second-hand verificate. Oferim piese pentru o gamă largă de mărci și modele, cu fotografii reale ale fiecărui produs și informații complete despre proveniență.</p>
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
        {[["Piese verificate","înainte de listare"],["Garanție 30 de zile","la toate piesele"],["Livrare în toată țara","prin curier rapid"],["Retur în 14 zile","conform legislației"]].map(([t,d]) => (
          <div key={t} className="bg-ink text-white rounded-xl p-4 text-center">
            <b className="font-disp block">{t}</b><span className="text-white/60 text-xs">{d}</span>
          </div>
        ))}
      </div>
      <div className="card p-5 mt-6 flex items-center justify-between flex-wrap gap-3">
        <span>📍 <b>Piatra-Neamț</b> · deschis L–V 08–17, S 09–13</span>
        <span className="text-mut text-sm">Ridicare personală posibilă, cu programare telefonică.</span>
      </div>
    </div>
  );
}
