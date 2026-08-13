// Afișează poza reală dacă există; altfel, ilustrația desenată (rezervă).
import PartArt from "./PartArt";

export default function ProductPhoto({ poze, art, className = "", alt = "" }:
  { poze?: string[] | null; art: string; className?: string; alt?: string }) {
  const prima = poze && poze.length > 0 ? poze[0] : null;
  // Fundalul zonei de imagine vine din --imagine-bg (app/globals.css): pozele de
  // piese sunt fotografiate pe fundal deschis, iar pe site-ul negru se vede prin
  // marginile pozei. Se schimbă dintr-un singur loc, nu de aici.
  if (prima) return <img src={prima} alt={alt} className={`object-cover bg-imagineBg ${className}`} loading="lazy" />;
  return <PartArt kind={art} className={className} />;
}
