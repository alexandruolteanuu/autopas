"use client";
// Galeria piesei: pozele reale încărcate din admin; dacă nu există, ilustrația desenată.
//
// Aceeași galerie servește și paginile de mașină dezmembrată (`/masini/[slug]`),
// care n-au `art` fiindcă nu sunt piese. De aceea ilustrația de rezervă poate fi
// trimisă din afară, prin `rezerva`; fără ea se desenează `PartArt`, ca înainte.
import { useState, type ReactNode } from "react";
import PartArt from "./PartArt";

export default function ProductGallery({ poze, art = "engine", nume, rezerva }:
  { poze: string[]; art?: string; nume: string; rezerva?: ReactNode }) {
  const [activ, setActiv] = useState(0);
  if (!poze || poze.length === 0)
    return (
      <div className="card overflow-hidden">
        {rezerva ?? <PartArt kind={art} className="w-full aspect-[100/72]" />}
      </div>
    );
  return (
    <div>
      <div className="card overflow-hidden">
        {/* fundalul zonei de imagine: --imagine-bg din app/globals.css */}
        {/* Imaginea mare e elementul LCP al paginii de produs (măsurat: 876 ms).
            Era deja încărcată devreme, dar fără prioritate declarată. */}
        <img src={poze[activ]} alt={nume} className="w-full aspect-[100/72] object-cover bg-imagineBg"
          fetchPriority="high" decoding="sync" />
      </div>
      {poze.length > 1 && (
        <div className="grid grid-cols-5 gap-2 mt-2">
          {poze.map((u, i) => (
            <button key={u} onClick={() => setActiv(i)}
              className={`rounded-lg overflow-hidden border-2 ${i === activ ? "border-accentChenar" : "border-chenar"}`}>
              <img src={u} alt="" className="w-full aspect-[100/72] object-cover bg-imagineBg" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
