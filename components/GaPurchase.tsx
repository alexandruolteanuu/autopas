"use client";
// ============================================================
// `purchase` — o singură dată per comandă, oricâte reîncărcări ar urma
//
// PROBLEMA: pagina de mulțumire e o adresă normală. Omul o poate reîncărca, o
// poate lăsa deschisă și reveni la ea, sau o poate deschide de două ori din
// istoric. Fiecare reîncărcare ar trimite încă un `purchase`, iar în rapoarte
// aceeași comandă ar apărea vândută de mai multe ori. Într-un magazin cu piese
// unicat, asta strică exact cifra pentru care instalezi Analytics.
//
// CUM SE REZOLVĂ, în doi timpi:
//   1. Checkout-ul, imediat după ce serverul confirmă comanda, lasă în
//      `sessionStorage` conținutul ei — valoarea calculată DE SERVER și piesele.
//      URL-ul paginii de mulțumire nu poate purta datele astea: ar fi vizibile,
//      și oricine le-ar putea modifica din bara de adrese.
//   2. Pagina asta îl citește, trimite evenimentul O DATĂ și lasă în urmă un
//      semn legat de numărul comenzii. La reîncărcare semnul e acolo, iar
//      evenimentul nu mai pleacă.
//
// `sessionStorage`, nu `localStorage`: semnul trebuie să dispară când se închide
// fila. O comandă nouă, altă zi, are oricum alt număr — dar nu vrem să umplem
// browserul clientului cu semne care nu mai folosesc nimănui.
//
// Fără date personale: pleacă numărul comenzii (un cod intern, AP-2026-01000),
// valoarea și piesele. Niciodată numele, telefonul, e-mailul sau adresa.
// ============================================================
import { useEffect } from "react";
import { ev, MONEDA } from "@/lib/analytics";

const PAYLOAD = "autopas_purchase";
const semn = (numar: string) => `autopas_purchase_trimis_${numar}`;

export default function GaPurchase({ numar }: { numar?: string }) {
  useEffect(() => {
    if (!numar) return;
    try {
      if (sessionStorage.getItem(semn(numar))) return;   // deja trimis în sesiunea asta

      const brut = sessionStorage.getItem(PAYLOAD);
      if (!brut) return;
      const d = JSON.parse(brut) as { numar: string; valoare: number; items: unknown[] };
      // Datele din sesiune trebuie să fie ale ACESTEI comenzi. Altfel (două file,
      // două comenzi) am raporta valoarea uneia pe numărul celeilalte.
      if (d?.numar !== numar) return;

      ev("purchase", {
        transaction_id: numar,
        value: d.valoare,
        currency: MONEDA,
        items: d.items,
      });

      sessionStorage.setItem(semn(numar), "1");
      sessionStorage.removeItem(PAYLOAD);
    } catch { /* stocare blocată: mai bine fără statistică decât cu pagina stricată */ }
  }, [numar]);

  return null;
}
