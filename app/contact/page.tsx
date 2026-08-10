import Breadcrumbs from "@/components/Breadcrumbs";
import ContactForm from "@/components/ContactForm";
import { IconTelefon, IconMesaj, IconMail, IconCamion, IconPin } from "@/components/Icoane";
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
      <h1 className="t-sectiune mt-2 mb-7">Contact</h1>
      <div className="grid lg:grid-cols-3 gap-6 items-start">
        <div className="card p-5 space-y-3 text-sm">
          <b className="font-disp font-semibold text-[13px]">Date de contact</b>
          <p className="flex gap-2.5"><IconTelefon className="w-[18px] h-[18px] shrink-0 mt-0.5 text-accent" />
            <span><a href={telLink(firma.telefon)} className="inline-flex items-center min-h-[44px]"><b>{firma.telefon}</b></a><br /><span className="text-textSecundar">Program: {PROGRAM}</span></span></p>
          <p className="flex gap-2.5"><IconMesaj className="w-[18px] h-[18px] shrink-0 mt-0.5 text-accent" />
            <span>WhatsApp: <b>{firma.telefon}</b><br /><span className="text-textSecundar">trimite cod OEM sau poze cu piesa</span></span></p>
          <p className="flex gap-2.5"><IconMail className="w-[18px] h-[18px] shrink-0 mt-0.5 text-accent" /><span className="break-words min-w-0">{firma.email}</span></p>
          <p className="flex gap-2.5"><IconCamion className="w-[18px] h-[18px] shrink-0 mt-0.5 text-accent" /><span>{LIVRARE}</span></p>
          <p className="flex gap-2.5"><IconPin className="w-[18px] h-[18px] shrink-0 mt-0.5 text-accent" />
            <span>{ADRESA.lung}<br /><span className="text-textSecundar">{ADRESA.reper} · ridicare personală cu programare</span></span></p>
          {/* Datele de identificare ale societății — legea cere să fie ușor de găsit,
              nu ascunse în subsolul unui document. */}
          <div className="border-t border-chenar pt-3 mt-3 text-textSecundar text-[13px] leading-relaxed">
            <b className="font-disp font-semibold text-[12px] text-text block mb-1">Date de identificare</b>
            <span className="block break-words">{firma.denumire}</span>
            {firma.cui && <span className="block">Cod fiscal: {firma.cui}</span>}
            {firma.reg_com && <span className="block">Reg. Com.: {firma.reg_com}</span>}
            {firma.adresa && <span className="block break-words">Sediu social: {firma.adresa}</span>}
          </div>
        </div>
        <div><b className="font-disp font-semibold text-[13px] block mb-3">Scrie-ne un mesaj</b><ContactForm /></div>
        <div><b className="font-disp font-semibold text-[13px] block mb-3">Caut o piesă</b><PartRequestForm sursa="contact" /></div>
      </div>
    </div>
  );
}
