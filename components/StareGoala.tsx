import Link from "next/link";
import type { ReactNode } from "react";

// Starea goală: iconiță, titlu, o propoziție și un buton care duce mai departe.
// O listă goală e o invitație, nu o scuză — de asta are întotdeauna o acțiune.
export default function StareGoala({ icon, titlu, text, actiune, secundar, copii }: {
  icon: ReactNode;
  titlu: string;
  text: string;
  actiune?: { eticheta: string; href: string };
  secundar?: { eticheta: string; href: string };
  copii?: ReactNode;
}) {
  return (
    <div className="card px-5 py-10 text-center">
      <div className="mx-auto w-14 h-14 rounded-full grid place-items-center bg-suprafata2 text-textSecundar">
        {icon}
      </div>
      <h2 className="font-disp font-bold text-xl mt-4">{titlu}</h2>
      <p className="text-textSecundar mt-2 text-[15px] leading-relaxed max-w-md mx-auto">{text}</p>
      {(actiune || secundar) && (
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          {actiune && <Link href={actiune.href} className="btn-acc">{actiune.eticheta}</Link>}
          {secundar && <Link href={secundar.href} className="btn-sec">{secundar.eticheta}</Link>}
        </div>
      )}
      {copii && <div className="mt-6">{copii}</div>}
    </div>
  );
}
