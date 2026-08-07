"use client";
// Sortarea din paginile de listare — dropdown, nu săgeți.
import { useRouter, useSearchParams, usePathname } from "next/navigation";

const OPTIUNI = [
  { id: "", t: "Cele mai noi" },
  { id: "pret-asc", t: "Preț: crescător" },
  { id: "pret-desc", t: "Preț: descrescător" },
  { id: "nume", t: "Denumire A–Z" },
];

export default function SortSelect() {
  const router = useRouter(); const sp = useSearchParams(); const path = usePathname();
  const curent = sp.get("sort") ?? "";
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-textSecundar whitespace-nowrap">Sortează:</span>
      <select value={curent}
        onChange={(e) => {
          const p = new URLSearchParams(Array.from(sp.entries()));
          e.target.value ? p.set("sort", e.target.value) : p.delete("sort");
          router.push(`${path}?${p.toString()}`);
        }}
        className="rounded-xl border-2 border-chenar bg-suprafata px-3 py-1.5 text-sm outline-none focus:border-accent">
        {OPTIUNI.map((o) => <option key={o.id} value={o.id}>{o.t}</option>)}
      </select>
    </label>
  );
}
