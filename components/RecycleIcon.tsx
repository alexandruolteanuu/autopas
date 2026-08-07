// Simbolul reciclării — trei săgeți pline care se urmăresc în triunghi.
// Desenat de mână: un singur braț (bandă + vârf de săgeată de-a lungul unei
// laturi), repetat prin rotire la 120°, ca toate trei să iasă identice.
// Formă plină, nu contur — la 20px conturul subțire se pierdea.
const BRAT = "M12.69 6.2 L14.42 5.2 L17.54 10.6 L18.93 9.8 L18.7 14.61 L14.42 12.4 L15.81 11.6 Z";
const UNGHIURI = [0, 120, 240];

export default function RecycleIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true" focusable="false">
      {UNGHIURI.map((u) => <path key={u} d={BRAT} transform={`rotate(${u} 12 12)`} />)}
    </svg>
  );
}
