// Aceeași așezare ca pagina de piesă: galerie în stânga, fișa în dreapta.
import { Bloc } from "@/components/Schelete";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
      <Bloc className="h-4 w-64" />
      <div className="grid lg:grid-cols-2 gap-8 mt-4">
        {/* Galeria: același raport 100/72 ca `ProductGallery`, plus miniaturile. */}
        <div>
          <Bloc className="w-full aspect-[100/72]" />
          <div className="grid grid-cols-5 gap-2 mt-2">
            {Array.from({ length: 5 }).map((_, i) => <Bloc key={i} className="w-full aspect-[100/72]" />)}
          </div>
        </div>
        <div>
          <Bloc className="h-8 w-5/6" />
          <Bloc className="h-4 w-40 mt-3" />
          <Bloc className="h-10 w-48 mt-4" />
          <Bloc className="h-12 w-full mt-5" />
          {/* Fișa tehnică: opt rânduri, cât are pagina adevărată. */}
          <div className="card mt-6 divide-y divide-chenar">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex gap-4 px-4 py-3">
                <Bloc className="h-4 w-28 shrink-0" /><Bloc className="h-4 w-2/5" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
