"use client";
// ============================================================
// STAREA VACANȚEI, pentru paginile din browser (coș, checkout, favorite).
//
// Valoarea vine de pe SERVER, prin `SiteChrome`, nu dintr-o cerere proprie:
// layout-ul o citește oricum pentru hello bar, deci ar fi o cerere în plus pe
// fiecare pagină, pentru aceeași informație.
//
// Blocarea reală a comenzilor NU e aici. Ea stă în `plaseaza_comanda`, pe server
// (vezi supabase/mod-vacanta.sql): cine are checkout-ul deja deschis nu vede
// niciodată contextul ăsta actualizat, dar tot nu poate plasa comanda. Ce e aici
// e cosmetică — necesară, ca omul să nu piardă timp completând un formular care
// va fi oricum refuzat, dar cosmetică.
// ============================================================
import { createContext, useContext } from "react";
import type { Vacanta } from "@/lib/settings";

const Ctx = createContext<Vacanta>({ activ: false, mesaj: "" });

export function VacantaProvider({ vacanta, children }:
  { vacanta?: Vacanta; children: React.ReactNode }) {
  return <Ctx.Provider value={vacanta ?? { activ: false, mesaj: "" }}>{children}</Ctx.Provider>;
}

export const useVacanta = () => useContext(Ctx);
