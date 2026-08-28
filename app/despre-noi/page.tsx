import Breadcrumbs from "@/components/Breadcrumbs";
import Link from "next/link";
import { IconPin } from "@/components/Icoane";
import { PROGRAM, ADRESA } from "@/lib/config";
export const metadata = { title: "Despre noi", alternates: { canonical: "/despre-noi" } };
// Fără date inventate: nicio cifră de vechime, de suprafață sau de număr de mașini.
// Tot ce scrie aici descrie procesul real, verificabil în felul în care funcționează site-ul.
// Adresa depozitului vine din `ADRESA` (lib/config.ts), un singur loc pentru tot site-ul.

// Pașii prin care trece o piesă până ajunge pe site.
const PASI = [
  ["Intrarea vehiculului", "Mașina este identificată, iar documentele ei sunt verificate. Pentru vehiculele scoase din uz emitem certificatul de distrugere."],
  ["Dezmembrarea", "Fluidele și componentele periculoase sunt tratate separat, conform autorizației de mediu. Restul se demontează controlat, nu la întâmplare."],
  ["Verificarea piesei", "Piesele cu valoare — alternatoare, electromotoare, turbine, compresoare — sunt testate în atelier. Restul sunt verificate vizual și funcțional, după caz."],
  ["Fotografierea", "Fiecare piesă e fotografiată așa cum arată. Pozele de pe site sunt ale piesei pe care o primești, nu imagini de catalog."],
  ["Etichetarea", "Piesa primește codul OEM al producătorului și un cod intern al nostru, de forma AP-000123, după care o găsim în depozit."],
  ["Listarea", "Piesa apare pe site cu lista de compatibilitate și cu mașina din care provine, ca să poți verifica singur potrivirea."],
];

export default function DespreNoi() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Breadcrumbs items={[{ t: "Acasă", href: "/" }, { t: "Despre noi" }]} />
      <h1 className="t-sectiune mt-2">Despre noi</h1>

      <div className="mt-5 space-y-4 leading-relaxed">
        <p>Autopas Dezmembrări este un centru autorizat de dezmembrări auto din județul Neamț, pe DN 15 între Piatra-Neamț și Bicaz, specializat în vânzarea de piese auto second-hand verificate. Oferim piese pentru o gamă largă de mărci și modele, cu fotografii reale ale fiecărui produs și informații complete despre proveniență.</p>
        <p>Lucrăm cu piese care au avut deja o viață. Asta înseamnă un preț mult mai mic decât la piesa nouă și, de multe ori, singura variantă rezonabilă pentru o mașină mai veche, unde o piesă originală nouă costă cât jumătate din valoarea mașinii.</p>
      </div>

      {/* Cel mai util lucru pe care îl poate citi un client nou: de unde vine piesa. */}
      <h2 className="t-sectiune text-xl mt-8">Cum ajunge o piesă pe site</h2>
      <div className="grid sm:grid-cols-2 gap-3 mt-4">
        {PASI.map(([t, d], i) => (
          <div key={t} className="card p-4">
            <div className="flex items-center gap-2.5">
              <span className="shrink-0 w-6 h-6 rounded-full bg-accent text-accentContrast grid place-items-center text-xs font-bold">{i + 1}</span>
              <b className="font-disp font-semibold text-[14px]">{t}</b>
            </div>
            <p className="text-sm text-textSecundar mt-2 leading-relaxed">{d}</p>
          </div>
        ))}
      </div>

      <h2 className="t-sectiune text-xl mt-8">Ce trebuie să știi despre piesele second-hand</h2>
      <div className="mt-4 space-y-4 leading-relaxed">
        <p><b>Fiecare piesă e unicat.</b> Nu avem stoc de zece bucăți din același reper: e o piesă anume, dintr-o mașină anume. De aceea, când o comanzi, se rezervă imediat — iar dacă ai văzut ceva ce îți trebuie, nu are rost să amâni.</p>
        <p><b>Urmele de folosire sunt normale.</b> Zgârieturi, praf, vopsea mată, plastice îmbătrânite — toate acestea vin la pachet cu o piesă demontată dintr-o mașină folosită și nu sunt considerate defecte. Ce nu e normal — fisuri, deformări, componente lipsă — scriem în anunț. Dacă un aspect anume contează pentru tine, întreabă-ne înainte și îți trimitem poze suplimentare.</p>
        <p><b>Verificăm noi compatibilitatea, gratuit.</b> Dacă nu ești sigur că piesa se potrivește, trimite-ne seria de șasiu pe WhatsApp și verificăm noi înainte să comanzi. E mai simplu pentru toată lumea decât un retur.</p>
        <p><b>Montajul se face la un service autorizat RAR.</b> E o condiție a garanției, dar în primul rând o chestiune de siguranță — vorbim de piese care ajung pe drum, la viteză.</p>
      </div>

      <div className="card p-5 mt-8">
        <b className="font-disp font-semibold text-[13px]">Activitate autorizată</b>
        <ul className="mt-3 space-y-2 text-sm">
          {["Autorizație de mediu pentru tratarea vehiculelor scoase din uz",
            "Autorizat RAR pentru dezmembrare și emiterea certificatului de distrugere",
            "Predare vehicule în programul Rabla — certificat de distrugere pe loc"].map((a) => (
            <li key={a} className="flex gap-2"><span className="text-ok font-bold">✓</span>{a}</li>
          ))}
        </ul>
      </div>

      <h2 className="t-sectiune text-xl mt-8">Cumpărăm și mașini</h2>
      <p className="mt-3 leading-relaxed">
        Dacă ai o mașină avariată, defectă sau pur și simplu prea veche ca să mai merite reparată, o preluăm.
        Plata se face pe loc, transportul cu platforma este gratuit în zona Neamț, iar certificatul de distrugere
        se emite imediat — cel de care ai nevoie ca să radiezi mașina.
        Detalii în paginile <Link href="/preda-masina" className="accentuat font-semibold">Predă mașina</Link> și{" "}
        <Link href="/programul-rabla" className="accentuat font-semibold">Programul Rabla</Link>.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-8">
        {[["Piese verificate","înainte de listare"],["Garanție 90 de zile","conform OUG 140/2021"],["Livrare în toată țara","prin curier rapid"],["Retur în 14 zile","conform legislației"]].map(([t,d]) => (
          <div key={t} className="bg-headerBg text-headerText rounded-xl p-4 text-center">
            <b className="font-disp block">{t}</b><span className="text-headerText/60 text-xs">{d}</span>
          </div>
        ))}
      </div>

      <div className="card p-5 mt-6 flex items-center justify-between flex-wrap gap-3">
        <span className="flex items-center gap-2"><IconPin className="w-[18px] h-[18px] shrink-0 accentuat" /><span><b>{ADRESA.scurt}</b> · deschis {PROGRAM}</span></span>
        <span className="text-textSecundar text-sm">Ridicare personală posibilă, cu programare telefonică.</span>
      </div>
    </div>
  );
}
