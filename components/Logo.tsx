// Logo-ul firmei — o singură sursă pentru tot site-ul.
// Imaginea (`public/logo.png`) conține deja scrisul „AUTOPAS DEZMEMBRĂRI",
// așa că nu-l mai dublăm cu text alături. Ca să schimbi logo-ul mai târziu,
// înlocuiești fișierul din `public/` — nu trebuie umblat prin pagini.
//
// `width`/`height` sunt proporțiile reale ale fișierului (600×289). Browserul
// rezervă locul din prima, deci pagina nu sare cât timp imaginea se încarcă.
// Înălțimea o dai din `className` (ex. „h-11"); lățimea se calculează singură.
export default function Logo({
  className = "h-11",
  eager = false,
}: {
  className?: string;
  /** true doar pentru logo-ul din header, care se vede fără scroll. */
  eager?: boolean;
}) {
  return (
    <img
      src="/logo.png"
      alt="Autopas Dezmembrări"
      width={600}
      height={289}
      className={`w-auto ${className}`}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
    />
  );
}
