"use client";
// Galeria piesei: pozele reale încărcate din admin; dacă nu există, ilustrația desenată.
import { useState } from "react";
import PartArt from "./PartArt";

export default function ProductGallery({ poze, art, nume }: { poze: string[]; art: string; nume: string }) {
  const [activ, setActiv] = useState(0);
  if (!poze || poze.length === 0)
    return (
      <div className="card overflow-hidden">
        <PartArt kind={art} className="w-full aspect-[100/72]" />
      </div>
    );
  return (
    <div>
      <div className="card overflow-hidden">
        <img src={poze[activ]} alt={nume} className="w-full aspect-[100/72] object-cover bg-paper" />
      </div>
      {poze.length > 1 && (
        <div className="grid grid-cols-5 gap-2 mt-2">
          {poze.map((u, i) => (
            <button key={u} onClick={() => setActiv(i)}
              className={`rounded-lg overflow-hidden border-2 ${i === activ ? "border-acc" : "border-line"}`}>
              <img src={u} alt="" className="w-full aspect-[100/72] object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
