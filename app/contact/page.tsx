import ContactForm from "@/components/ContactForm";
import PartRequestForm from "@/components/PartRequestForm";
export const metadata = { title: "Contact" };

export default function Contact() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="dim">Acasă / Contact</div>
      <h1 className="font-disp font-bold text-3xl mt-2 mb-7">Contact</h1>
      <div className="grid lg:grid-cols-3 gap-6 items-start">
        <div className="card p-5 space-y-3 text-sm">
          <b className="font-disp font-semibold text-[13px]">Date de contact</b>
          <p>☎ <b>0740 123 456</b><br /><span className="text-mut">L–V 08–17 · S 09–13</span></p>
          <p>💬 WhatsApp: <b>0740 123 456</b><br /><span className="text-mut">trimite cod OEM sau poze cu piesa</span></p>
          <p>✉ comenzi@autopas.ro</p>
          <p>📍 Piatra-Neamț, jud. Neamț<br /><span className="text-mut">ridicare personală cu programare</span></p>
        </div>
        <div><b className="font-disp font-semibold text-[13px] block mb-3">Scrie-ne un mesaj</b><ContactForm /></div>
        <div><b className="font-disp font-semibold text-[13px] block mb-3">Caut o piesă</b><PartRequestForm sursa="contact" /></div>
      </div>
    </div>
  );
}
