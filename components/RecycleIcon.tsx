// Simbolul reciclării — trei săgeți care se urmăresc în triunghi.
// Desenat de mână, ca restul iconurilor din proiect: un singur braț, repetat
// prin rotire la 120°, ca cele trei săgeți să iasă perfect identice.
const BRATE = [0, 120, 240];

export default function RecycleIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {BRATE.map((unghi) => (
        <g key={unghi} transform={`rotate(${unghi} 12 12)`}>
          {/* corpul săgeții, de-a lungul unei laturi a triunghiului */}
          <path d="M12 4.6 L16.3 12" />
          {/* vârful săgeții */}
          <path d="M16.3 9.4 L16.3 12 L14.05 10.7" />
        </g>
      ))}
    </svg>
  );
}
