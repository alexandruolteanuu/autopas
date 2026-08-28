"use client";
// ============================================================
// Linkul către o piesă, care raportează `select_item` la click.
//
// De ce o componentă separată: `ProductCard` e componentă de SERVER (vezi
// CLAUDE.md — de asta și butonul de coș stă în `AddToCart`, nu în card), iar o
// componentă de server nu poate avea `onClick`. În loc să trecem tot cardul în
// client doar pentru o statistică — ceea ce ar trimite în browser și codul de
// randare al fiecărei piese din listă — trecem doar linkul.
//
// `select_item` e evenimentul care leagă o listare de o vizualizare de produs:
// fără el, GA4 nu poate spune din ce listă a plecat clientul spre piesa
// cumpărată.
// ============================================================
import Link from "next/link";
import { ev, piesaGa } from "@/lib/analytics";
import type { Product } from "@/lib/types";

export default function LinkPiesa({ p, className, children }:
  { p: Product; className?: string; children: React.ReactNode }) {
  return (
    <Link href={`/piese/${p.slug}`} className={className}
      onClick={() => ev("select_item", { items: [piesaGa(p)] })}>
      {children}
    </Link>
  );
}
