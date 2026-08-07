import Breadcrumbs from "@/components/Breadcrumbs";
import ContactForm from "@/components/ContactForm";
import PartRequestForm from "@/components/PartRequestForm";
import { getSetariServer } from "@/lib/settings";
import { PROGRAM, LIVRARE, ADRESA, telLink } from "@/lib/config";
export const metadata = { title: "Contact" };

export const dynamic = "force-dynamic";

export default async function Contact() {
  const { firma } = await getSetariServer();
  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumbs items={[{ t: "Acasă", href: "/" }, { t: "Contact" }]} />
      <h1 className="font-disp font-bold text-3xl mt-2 mb-7">Contact</h1>
      <div className="grid lg:grid-cols-3 gap-6 items-start">
        <div className="card p-5 space-y-3 text-sm">
          <b className="font-disp font-semibold text-[13px]">Date de contact</b>
          <p>☎ <a href={telLink(firma.telefon)}><b>{firma.telefon}</b></a><br /><span className="text-textSecundar">Program: {PROGRAM}</span></p>
          <p>💬 WhatsApp: <b>{firma.telefon}</b><br /><span className="text-textSecundar">trimite cod OEM sau poze cu piesa</span></p>
          <p>✉ {firma.email}</p>
          <p>🚚 {LIVRARE}</p>
          <p>📍 {ADRESA.lung}<br /><span className="text-textSecundar">{ADRESA.reper} · ridicare personală cu programare</span></p>
        </div>
        <div><b className="font-disp font-semibold text-[13px] block mb-3">Scrie-ne un mesaj</b><ContactForm /></div>
        <div><b className="font-disp font-semibold text-[13px] block mb-3">Caut o piesă</b><PartRequestForm sursa="contact" /></div>
      </div>
    </div>
  );
}
