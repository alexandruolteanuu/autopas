// Afișează poza reală dacă există; altfel, ilustrația desenată (rezervă).
import PartArt from "./PartArt";

export default function ProductPhoto({ poze, art, className = "", alt = "" }:
  { poze?: string[] | null; art: string; className?: string; alt?: string }) {
  const prima = poze && poze.length > 0 ? poze[0] : null;
  if (prima) return <img src={prima} alt={alt} className={`object-cover bg-paper ${className}`} loading="lazy" />;
  return <PartArt kind={art} className={className} />;
}
