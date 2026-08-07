import Breadcrumbs from "@/components/Breadcrumbs";
import IntakeForm from "@/components/IntakeForm";
import WhatsAppIcon from "@/components/WhatsAppIcon";
import Link from "next/link";
import { getSetariServer, waLinkCu } from "@/lib/settings";
export const metadata = { title: "Predă mașina la dezmembrat" };

// Actele cerute la predare: aceleași ca la Rabla, plus certificatul fiscal.
// Lista de bază stă în /programul-rabla — dacă o modifici acolo, adu-o și aici.
const ACTE = [
  "Cartea de identitate a vehiculului (CIV) și certificatul de înmatriculare",
  "Actul de identitate al proprietarului",
  "Dacă nu ești proprietarul din acte: procură și/sau contract",
  "Certificat fiscal",
];

export default async function PredaMasina() {
  // Numărul de telefon vine din Admin → Setări, nu e scris în cod.
  const { firma } = await getSetariServer();
  const waLink = waLinkCu(
    firma.whatsapp,
    "Bună! Vreau să predau o mașină la dezmembrat. Trimit pozele aici.",
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Breadcrumbs items={[{ t: "Acasă", href: "/" }, { t: "Predă mașina" }]} />
      <h1 className="font-disp font-bold text-3xl mt-2">Predă mașina la dezmembrat</h1>
      <p className="text-mut mt-2 max-w-2xl">
        Cumpărăm mașini avariate, defecte sau pur și simplu bătrâne. Plata pe loc, acte făcute corect
        și <b className="text-ink">certificat de distrugere emis pe loc</b>. Asigurăm și radierea de la
        DRPCIV pentru cei din județul Neamț, fără alte drumuri.
      </p>

      <div className="grid lg:grid-cols-2 gap-8 mt-8 items-start">
        <div className="space-y-4">
          {/* PASUL 1 — are numărul și legătura directă către WhatsApp, deci e scris separat */}
          <div className="card p-4 flex gap-4">
            <span className="w-9 h-9 rounded-full bg-ok text-white font-disp font-bold grid place-items-center shrink-0">1</span>
            <div className="min-w-0">
              <b>Evaluare pe loc sau pe poze</b>
              <p className="text-sm text-mut mt-0.5">Trimite-ne poze pe WhatsApp și îți spunem prețul în aceeași zi.</p>
              <a href={waLink} target="_blank" rel="noopener noreferrer"
                className="mt-2.5 inline-flex items-center gap-2 rounded-xl bg-[#25D366] text-white px-4 py-2.5 text-sm font-semibold hover:brightness-110">
                <WhatsAppIcon className="w-5 h-5" />
                {firma.telefon}
              </a>
            </div>
          </div>

          {[["Transport gratuit cu platforma", "Pe raza județului Neamț ridicăm noi mașina, chiar dacă nu pornește."],
            ["Plata pe loc și documente complete pentru radiere", "Contract, certificat de distrugere, tot ce trebuie pentru radiere."]].map(([t, d], i) => (
            <div key={t} className="card p-4 flex gap-4">
              <span className="w-9 h-9 rounded-full bg-ok text-white font-disp font-bold grid place-items-center shrink-0">{i + 2}</span>
              <div><b>{t}</b><p className="text-sm text-mut mt-0.5">{d}</p></div>
            </div>
          ))}

          <div className="card p-4 text-sm">
            <b className="font-disp font-semibold text-[13px]">Acte necesare</b>
            <ul className="mt-2 space-y-1 text-mut">
              {ACTE.map((a) => <li key={a}>• {a}</li>)}
            </ul>
          </div>

          <p className="text-sm text-mut">Vrei ecotichetul Rabla în loc de vânzare directă? Vezi <Link href="/programul-rabla" className="text-acc font-bold">Programul Rabla</Link>.</p>
        </div>
        <IntakeForm tip="predare" />
      </div>
    </div>
  );
}
