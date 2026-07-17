// Ilustrațiile desenate ale pieselor (fără casete gri goale — cerință din brief).
// Se folosesc pe carduri, pe pagina de produs și pe categorii, până apar fotografiile reale.
const INK = "#2A2F36", ST = "#3A4048", AC = "#FF6B1A", LT = "#535B65";

function art(kind: string): JSX.Element {
  switch (kind) {
    case "alternator": return (<g><circle cx="50" cy="40" r="26" fill={INK}/><circle cx="50" cy="40" r="9" fill={LT}/>
      {[0,45,90,135].map(a=><rect key={a} x="48.5" y="16" width="3" height="48" fill={ST} transform={`rotate(${a} 50 40)`}/>)}
      <rect x="20" y="34" width="8" height="12" rx="2" fill={ST}/><circle cx="50" cy="40" r="3.5" fill={AC}/></g>);
    case "headlight": return (<g><path d="M18 40c14-9 28-13 38-13 16 0 26 11 26 26s-10 26-26 26c-10 0-24-4-38-13 9-5 13-9 13-13s-4-8-13-13z" fill={INK}/>
      <circle cx="54" cy="53" r="9" fill={LT}/><circle cx="54" cy="53" r="4" fill={AC}/></g>);
    case "gearbox": return (<g><path d="M26 34h34l14 10v22H30l-10-8V40z" fill={INK}/>
      <rect x="42" y="20" width="7" height="16" fill={ST}/><circle cx="45.5" cy="17" r="5" fill={LT}/>
      <circle cx="34" cy="56" r="4" fill={LT}/><circle cx="50" cy="56" r="4" fill={LT}/><circle cx="66" cy="52" r="4" fill={AC}/></g>);
    case "turbo": return (<g><circle cx="46" cy="46" r="24" fill={INK}/><circle cx="46" cy="46" r="10" fill={LT}/>
      <path d="M70 40h14v14H70z" fill={ST}/><path d="M46 22c14 0 24 10 24 24" stroke={ST} strokeWidth="7" fill="none"/>
      <circle cx="46" cy="46" r="4" fill={AC}/></g>);
    case "mirror": return (<g><path d="M24 32h44c6 0 10 4 10 10v16c0 6-4 10-10 10H30z" fill={INK}/>
      <path d="M30 38h36v20H34z" fill={LT}/><rect x="16" y="52" width="10" height="14" rx="3" fill={ST}/><rect x="62" y="40" width="8" height="4" fill={AC}/></g>);
    case "egr": return (<g><path d="M24 52h20v-14h16v14h16" stroke={INK} strokeWidth="10" fill="none"/>
      <circle cx="52" cy="30" r="9" fill={ST}/><rect x="20" y="52" width="56" height="12" rx="4" fill={ST}/><circle cx="52" cy="30" r="3.5" fill={AC}/></g>);
    case "compressor": return (<g><circle cx="46" cy="46" r="22" fill={INK}/><circle cx="46" cy="46" r="8" fill={LT}/>
      {[0,60,120,180,240,300].map(a=><rect key={a} x="44.5" y="26" width="3" height="12" fill={ST} transform={`rotate(${a} 46 46)`}/>)}
      <rect x="66" y="36" width="14" height="20" rx="4" fill={ST}/><circle cx="46" cy="46" r="3" fill={AC}/></g>);
    case "wheel": return (<g><circle cx="50" cy="46" r="27" fill={INK}/><circle cx="50" cy="46" r="18" fill={LT}/>
      {[0,72,144,216,288].map(a=><rect key={a} x="48" y="30" width="4" height="16" rx="2" fill={INK} transform={`rotate(${a} 50 46)`}/>)}
      <circle cx="50" cy="46" r="5" fill={AC}/></g>);
    case "engine": return (<g><rect x="24" y="34" width="44" height="30" rx="4" fill={INK}/>
      <path d="M32 34v-8h8v8M48 34v-8h8v8" stroke={INK} strokeWidth="6"/><rect x="68" y="42" width="12" height="10" rx="2" fill={ST}/>
      <circle cx="44" cy="48" r="7" fill={LT}/><circle cx="44" cy="48" r="2.5" fill={AC}/></g>);
    case "suspension": return (<g><path d="M40 22h20M40 70h20" stroke={INK} strokeWidth="7" strokeLinecap="round"/>
      <path d="M44 28l14 5-14 7 14 7-14 7 14 5" stroke={ST} strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="50" cy="46" r="3" fill={AC}/></g>);
    case "brake": return (<g><circle cx="48" cy="46" r="24" fill={INK}/><circle cx="48" cy="46" r="9" fill={LT}/>
      {[20,80,140,200,260,320].map(a=><circle key={a} cx={48+16*Math.cos(a*Math.PI/180)} cy={46+16*Math.sin(a*Math.PI/180)} r="2.5" fill={ST}/>)}
      <path d="M64 26a24 24 0 0 1 8 20h-8" fill={AC} opacity=".9"/></g>);
    case "seat": return (<g><path d="M36 22c-4 0-6 3-6 7l-2 26c0 3 2 5 5 5h4l2-32c0-4-1-6-3-6z" fill={INK}/>
      <path d="M34 60h28c4 0 6 3 6 6v4H32z" fill={INK}/><path d="M38 26l-2 30" stroke={LT} strokeWidth="4"/><rect x="40" y="62" width="18" height="4" rx="2" fill={AC} opacity=".8"/></g>);
    case "panel": return (<g><path d="M22 40c10-10 24-16 40-16h12c4 0 6 2 6 6v34H26c-3 0-5-2-5-5z" fill={INK}/>
      <path d="M30 40h32v14H34z" fill={LT}/><circle cx="70" cy="52" r="3" fill={AC}/></g>);
    default: return art("engine");
  }
}

export default function PartArt({ kind, className = "" }: { kind: string; className?: string }) {
  return (
    <svg viewBox="0 0 100 84" className={className} role="img" aria-label="ilustrație piesă">
      <rect width="100" height="84" fill="#ECE9E2" />
      <circle cx="82" cy="14" r="26" fill="#E4E1DA" />
      {art(kind)}
    </svg>
  );
}
