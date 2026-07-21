import Breadcrumbs from "@/components/Breadcrumbs";
import ReturnForm from "@/components/ReturnForm";
import Link from "next/link";
export const metadata = { title: "Formular de retur" };

export default function FormularRetur() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Breadcrumbs items={[{ t: "Acasă", href: "/" }, { t: "Informații legale", href: "/legal/politica-de-retur" }, { t: "Formular de retur" }]} />
      <h1 className="font-disp font-bold text-3xl mt-2">Formular de retur</h1>
      <p className="text-mut mt-2">Completează formularul în cele 14 zile de la primirea piesei. Îți confirmăm returul pe e-mail, cu instrucțiunile de expediere. Detalii în <Link href="/legal/politica-de-retur" className="text-acc font-semibold">Politica de retur</Link>.</p>
      <div className="mt-6"><ReturnForm /></div>
    </div>
  );
}
