import Breadcrumbs from "@/components/Breadcrumbs";
export const metadata = { title: "Întrebări frecvente" };
const FAQ = [
  ["Piesele sunt testate?","Da. Piesele cu valoare (alternatoare, electromotoare, turbine, compresoare) sunt testate în atelier și verificate înainte de livrare. Fiecare piesă are descriere, fotografii reale și codul OEM."],
  ["Ce garanție primesc?","90 de zile de la data facturării, conform OUG 140/2021. Consumabilele (filtre, becuri, ștergătoare, bujii, curele, simeringuri) nu sunt acoperite, iar montajul trebuie făcut într-un service autorizat RAR. Condițiile complete sunt în pagina Certificat de garanție."],
  ["Cum verific dacă piesa se potrivește pe mașina mea?","Fiecare produs are lista de compatibilitate. Dacă nu ești sigur, trimite-ne seria de șasiu (VIN) pe WhatsApp — verificăm noi, gratuit."],
  ["Cât durează livrarea și cât costă?","1–3 zile lucrătoare prin FAN Courier, în toată România. Costul livrării depinde de greutatea și dimensiunile piesei, așa că nu are un tarif fix: după ce plasezi comanda, calculăm transportul și te sunăm cu totalul exact — produse plus transport. Nu expediem nimic până nu ești de acord cu suma, iar dacă nu îți convine poți anula fără niciun cost."],
  ["Pot returna piesa?","Da, te poți retrage din contract în 14 zile calendaristice de la primire, fără să motivezi decizia (OUG 34/2014), folosind Formularul de retur din subsol. Îți rambursăm tot ce ai plătit, inclusiv livrarea standard, în cel mult 14 zile; costul direct al returnării îl suporți tu. Atenție: retragerea în 14 zile („m-am răzgândit”) e diferită de garanția de 90 de zile („piesa are un defect”)."],
  ["Cum plătesc?","Ramburs la curier sau transfer bancar (proformă). Plata cu cardul online va fi disponibilă în curând."],
  ["Cumpărați mașini pentru dezmembrare?","Da — avariate, defecte sau vechi. Plata pe loc, transport gratuit cu platforma în zona Neamț și certificat de distrugere emis imediat. Vezi paginile «Predă mașina» și «Programul Rabla»."],
  ["Emiteti certificat pentru programul Rabla?","Da, pe loc — suntem centru autorizat RAR pentru tratarea vehiculelor scoase din uz. Detalii în pagina «Programul Rabla»."],
  ["Pot ridica piesa personal?","Da, de la depozitul nostru din Str. Petru Rareș nr. 181, pe DN 15 între Piatra-Neamț și Bicaz (sat Bistrița, com. Alexandru cel Bun, jud. Neamț). Sună înainte pentru programare — suntem deschiși Luni – Vineri, 8:30 – 17:30. Linkurile către Waze și Google Maps sunt în subsolul site-ului."],
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
