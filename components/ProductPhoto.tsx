// Afișează poza reală dacă există; altfel, ilustrația desenată (rezervă).
import PartArt from "./PartArt";

/**
 * `prioritara` se pune pe O SINGURĂ imagine dintr-o pagină: cea care e, sau
 * poate deveni, elementul LCP. Ea se încarcă devreme și cu prioritate mare.
 *
 * Măsurat pe producție, mobil, 28 august 2026: pe `/piese`, pentru un vizitator
 * care a trecut deja de bannerul de cookie-uri, elementul LCP e chiar prima poză
 * din listă — și era marcată `loading="lazy"`. Adică browserului i se spunea să
 * amâne exact imaginea de care depinde momentul în care pagina pare încărcată.
 * 3.044 ms.
 *
 * Pe prima pagină LCP e titlul, nu o poză, deci acolo pozele rămân toate leneșe.
 * Marcarea mai multor imagini ca prioritare anulează efectul: dacă totul e
 * prioritar, nimic nu e.
 */
export default function ProductPhoto({ poze, art, className = "", alt = "", prioritara = false }:
  { poze?: string[] | null; art: string; className?: string; alt?: string; prioritara?: boolean }) {
  const prima = poze && poze.length > 0 ? poze[0] : null;
  // Fundalul zonei de imagine vine din --imagine-bg (app/globals.css): pozele de
  // piese sunt fotografiate pe fundal deschis, iar pe site-ul negru se vede prin
  // marginile pozei. Se schimbă dintr-un singur loc, nu de aici.
  if (prima) return (
    <img src={prima} alt={alt} className={`object-cover bg-imagineBg ${className}`}
      loading={prioritara ? "eager" : "lazy"}
      fetchPriority={prioritara ? "high" : undefined}
      decoding={prioritara ? "sync" : "async"} />
  );
  return <PartArt kind={art} className={className} />;
}
