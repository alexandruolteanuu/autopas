import Link from "next/link";
export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center">
      <div className="font-disp font-bold text-[90px] leading-none text-line">404</div>
      <h1 className="font-disp font-bold text-3xl mt-2">Pagina asta a fost dezmembrată.</h1>
      <p className="text-mut mt-2">Se pare că ai ajuns la o piesă care nu mai e pe stoc. Dar avem alte 7.800.</p>
      <div className="mt-6 flex gap-3 justify-center">
        <Link href="/" className="btn-dark">Înapoi acasă</Link>
        <Link href="/piese" className="btn-acc">Vezi piesele</Link>
      </div>
    </div>
  );
}
