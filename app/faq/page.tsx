import Breadcrumbs from "@/components/Breadcrumbs";
export const metadata = { title: "Întrebări frecvente" };
const FAQ = [
  ["Piesele sunt testate?","Da. Piesele cu valoare (alternatoare, electromotoare, turbine, compresoare) sunt testate în atelier și verificate înainte de livrare. Fiecare piesă are descriere, fotografii reale și codul OEM."],
  ["Ce garanție primesc?","30 de zile de la livrare, conform regulamentului, pentru toate piesele, cu factura și eticheta intactă. Detalii complete în pagina Certificat de garanție."],
  ["Cum verific dacă piesa se potrivește pe mașina mea?","Fiecare produs are lista de compatibilitate. Dacă nu ești sigur, trimite-ne seria de șasiu (VIN) pe WhatsApp — verificăm noi, gratuit."],
  ["Cât durează livrarea și cât costă?","1–3 zile lucrătoare prin FAN Courier (19,90 lei), Cargus (21,50 lei) sau Sameday easybox (14,90 lei). Piesele voluminoase se livrează paletizat, cu tarif comunicat înainte de expediere."],
  ["Pot returna piesa?","Da, în 14 zile calendaristice, conform OUG 34/2014, folosind Formularul de retur din subsol. Dacă piesa e neconformă, transportul de retur îl plătim noi."],
  ["Cum plătesc?","Ramburs la curier sau transfer bancar (proformă). Plata cu cardul online va fi disponibilă în curând."],
  ["Cumpărați mașini pentru dezmembrare?","Da — avariate, defecte sau vechi. Plata pe loc, transport gratuit cu platforma în zona Neamț și certificat de distrugere emis imediat. Vezi paginile «Predă mașina» și «Programul Rabla»."],
  ["Emiteti certificat pentru programul Rabla?","Da, pe loc — suntem centru autorizat RAR pentru tratarea vehiculelor scoase din uz. Detalii în pagina «Programul Rabla»."],
  ["Pot ridica piesa personal?","Da, de la depozitul din Piatra-Neamț, cu programare telefonică, în programul L–V 08–17, S 09–13."],
];
export default function Faq() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Breadcrumbs items={[{ t: "Acasă", href: "/" }, { t: "Întrebări frecvente" }]} />
      <h1 className="font-disp font-bold text-3xl mt-2 mb-6">Întrebări frecvente</h1>
      <div className="space-y-3">
        {FAQ.map(([q, a]) => (
          <details key={q} className="card p-4 group">
            <summary className="font-semibold cursor-pointer list-none flex justify-between items-center">
              {q}<span className="text-acc text-xl group-open:rotate-45 transition">+</span></summary>
            <p className="text-sm text-mut mt-2 leading-relaxed">{a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
