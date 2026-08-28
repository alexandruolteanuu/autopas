"use client";
// ============================================================
// Trimite un eveniment GA4 la afișarea unei pagini.
//
// Există fiindcă paginile de catalog sunt componente de SERVER, iar evenimentele
// pleacă din browser. În loc să transformăm pagini întregi în componente de
// client doar ca să trimitem o statistică, punem în ele componenta asta, care
// n-are niciun randament vizual.
//
// `cheie` există pentru navigarea din interiorul aplicației: React refolosește
// componenta când doar propsurile se schimbă (de la o piesă la alta, de la o
// pagină de listare la următoarea), iar fără o cheie care se schimbă odată cu
// conținutul, efectul n-ar mai rula și al doilea `view_item` s-ar pierde.
// ============================================================
import { useEffect } from "react";
import { ev } from "@/lib/analytics";

export default function EvenimentGa({ nume, date = {}, cheie }:
  { nume: string; date?: Record<string, unknown>; cheie?: string }) {
  useEffect(() => {
    ev(nume, date);
    // `date` e un obiect nou la fiecare randare, deci n-are ce căuta în lista de
    // dependențe: ar retrimite evenimentul la fiecare re-randare a paginii.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nume, cheie]);
  return null;
}
