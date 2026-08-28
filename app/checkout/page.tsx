"use client";
// CHECKOUT — comanda se plasează prin funcția `plaseaza_comanda` din Supabase.
// Browserul trimite DOAR ce vrea să cumpere (id-urile pieselor) și datele de
// livrare. Prețurile, costul livrării, reducerea și totalul le calculează
// serverul, din bază — ca să nu poată fi modificate din consola browserului.
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/CartContext";
import { sbBrowser } from "@/lib/supabase";
import { lei } from "@/lib/format";
import DiscountBox, { type Reducere } from "@/components/DiscountBox";
import { getSetariBrowser, CURIERI_IMPLICITI, type Curier } from "@/lib/settings";
import Link from "next/link";
import { useVacanta } from "@/components/VacantaContext";
import { VacantaBanner } from "@/components/VacantaNota";
import StareGoala from "@/components/StareGoala";

export default function Checkout() {
  const { items, total, clear } = useCart();
  const router = useRouter();
  const vacanta = useVacanta();
  const [tip, setTip] = useState<"pf" | "firma">("pf");
  const [curier, setCurier] = useState("fan");
  const [plata, setPlata] = useState("ramburs");
  const [stare, setStare] = useState<"idle" | "trimit" | "eroare">("idle");
  const [msg, setMsg] = useState("");
  const [curieri, setCurieri] = useState<Curier[]>(CURIERI_IMPLICITI);
  const [reducere, setReducere] = useState<Reducere>(null);
  useEffect(() => {
    getSetariBrowser().then((s) => { setCurieri(s.curieri); if (!s.curieri.some((c) => c.id === curier)) setCurier(s.curieri[0].id); });
    try { const r = sessionStorage.getItem("autopas_reducere"); if (r) setReducere(JSON.parse(r)); } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Transportul nu intră în totalul de acum — se stabilește după comandă,
  // pe baza greutății și dimensiunilor reale, și se comunică telefonic.
  const reducereVal = Math.min(reducere?.valoare ?? 0, total);

  async function trimite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const sb = sbBrowser();
    if (!sb) { setStare("eroare"); setMsg("Baza de date nu e configurată (vezi README)."); return; }
    if (items.length === 0) { router.push("/cos"); return; }
    setStare("trimit");
    // Trimitem doar id-ul și cantitatea fiecărei piese — prețul îl știe serverul.
    // `p_total_asteptat` e totalul afișat pe ecran: dacă serverul calculează
    // altceva (s-a schimbat un preț, a expirat codul), comanda NU se plasează
    // pe tăcute cu altă sumă, ci primim un mesaj de reîncărcare a coșului.
    const { data, error } = await sb.rpc("plaseaza_comanda", {
      p_client: {
        tip_client: tip,
        nume: f.get("nume"), email: f.get("email"), telefon: f.get("telefon"),
        firma: tip === "firma" ? f.get("firma") : null,
        cui: tip === "firma" ? f.get("cui") : null,
        adresa: f.get("adresa"), oras: f.get("oras"), judet: f.get("judet"),
        gdpr: f.get("gdpr") === "on",
      },
      p_items: items.map((i) => ({ id: i.id, cantitate: i.cantitate })),
      p_curier: curier,
      p_plata: plata,
      p_cod: reducere?.cod ?? null,
      p_total_asteptat: total - reducereVal,
    });
    if (error) { setStare("eroare"); setMsg(error.message); return; }
    const r = data as { ok: boolean; mesaj?: string; numar?: string; reincarca?: boolean };
    if (!r?.ok || !r.numar) {
      setStare("eroare");
      setMsg(r?.mesaj ?? "Comanda nu a putut fi înregistrată. Verifică datele de livrare și încearcă din nou.");
      // dacă s-a schimbat ceva în coș (piesă vândută, preț nou), scoatem reducerea
      // veche din sesiune ca să nu rămână aplicată o valoare depășită
      if (r?.reincarca) { setReducere(null); sessionStorage.removeItem("autopas_reducere"); }
      return;
    }
    sessionStorage.removeItem("autopas_reducere");
    clear();
    router.push(`/comanda-plasata?nr=${r.numar}&email=${encodeURIComponent(String(f.get("email")))}`);
  }

  if (items.length === 0 && stare === "idle")
    return <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="font-disp font-bold text-2xl">Coșul e gol</h1>
      <Link href="/piese" className="btn-acc mt-5">Vezi piesele</Link></div>;

  // MOD VACANȚĂ — formularul nici nu se mai afișează. Nu e o măsură de
  // securitate (aia e în `plaseaza_comanda`, pe server), ci de bun-simț: n-are
  // rost ca omul să completeze adresa, ca la final să primească un refuz.
  // Coșul rămâne intact — se poate întoarce la el.
  if (vacanta.activ)
    return (
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 py-12 space-y-5">
        <VacantaBanner vacanta={vacanta} />
        <StareGoala
          icon={<span className="text-2xl" aria-hidden="true">⏸</span>}
          titlu="Comanda nu poate fi plasată acum"
          text="Piesele rămân în coșul tău și le găsești acolo când reluăm activitatea."
          actiune={{ eticheta: "Înapoi la coș", href: "/cos" }}
          secundar={{ eticheta: "Vezi piesele", href: "/piese" }}
        />
      </div>
    );

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="dim">Coș → <b className="text-text">Livrare și plată</b> → Confirmare</div>
      <h1 className="t-sectiune mt-2 mb-6">Finalizează comanda</h1>
      <form onSubmit={trimite} className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr),340px] gap-6 items-start">
        <div className="space-y-5">
          {/* 1. Datele tale */}
          <div className="card p-5">
            <b className="font-disp font-semibold text-[13px]">1 · Datele tale</b>
            <div className="flex gap-2 mt-3">
              {(["pf","firma"] as const).map((t) => (
                <button type="button" key={t} onClick={() => setTip(t)}
                  className={`px-4 min-h-[44px] rounded-lg text-sm font-bold border-2 ${tip === t ? "border-accentChenar bg-accent/5 accentuat" : "border-chenar"}`}>
                  {t === "pf" ? "Persoană fizică" : "Firmă (B2B)"}</button>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-3 mt-4">
              <div className="fld"><label>Nume complet *</label><input name="nume" required autoComplete="name" /></div>
              <div className="fld"><label>Telefon *</label><input name="telefon" required type="tel" inputMode="numeric" autoComplete="tel" /></div>
              <div className="fld sm:col-span-2"><label>E-mail * <span className="font-normal text-textSecundar">(aici primești confirmarea)</span></label><input name="email" type="email" inputMode="email" required autoComplete="email" /></div>
              {tip === "firma" && (<>
                <div className="fld"><label>Denumirea firmei *</label><input name="firma" required autoComplete="organization" /></div>
                <div className="fld"><label>CUI * <span className="font-normal text-textSecundar">(nu cerem CNP)</span></label><input name="cui" required placeholder="RO…" autoComplete="off" /></div>
              </>)}
              <div className="fld sm:col-span-2"><label>Adresa de livrare *</label><input name="adresa" required autoComplete="address-line1" /></div>
              <div className="fld"><label>Oraș *</label><input name="oras" required autoComplete="address-level2" /></div>
              <div className="fld"><label>Județ *</label><input name="judet" required autoComplete="address-level1" /></div>
            </div>
          </div>
          {/* 2. Livrarea — un singur curier, cost stabilit ulterior */}
          <div className="card p-5">
            <b className="font-disp font-semibold text-[13px]">2 · Livrarea</b>
            <div className="mt-3 space-y-3">
              <div className="rounded-lg border-2 border-accentChenar bg-accent/5 px-4 py-3">
                <b>{curieri.find((c) => c.id === curier)?.nume ?? "FAN Courier"}</b>
                <span className="text-textSecundar text-sm"> · livrare 1–3 zile lucrătoare în toată România</span>
              </div>
              <div className="rounded-lg bg-suprafata2 px-4 py-3 text-sm leading-relaxed">
                <b>Costul livrării se calculează separat.</b> Piesele auto diferă mult ca greutate
                și dimensiuni, iar curierul taxează în funcție de ele. După ce primim comanda,
                calculăm transportul exact și <b>te sunăm cu totalul final înainte de expediere</b>.
                Nu expediem nimic până nu ești de acord cu suma.
              </div>
              <p className="text-xs text-textSecundar">Piesele voluminoase (motoare, cutii de viteze) se livrează paletizat. Detalii în <Link href="/legal/livrare" className="accentuat font-semibold">pagina Livrare</Link>.</p>
            </div>
          </div>
          {/* 3. Plata */}
          <div className="card p-5">
            <b className="font-disp font-semibold text-[13px]">3 · Metoda de plată</b>
            <div className="mt-3 space-y-2">
              {[["card","Card online","Visa / Mastercard — plată securizată"],["ramburs","Ramburs la curier","plătești când primești piesa"],["transfer","Transfer bancar","primești proforma pe e-mail"]].map(([id,t,d]) => (
                <label key={id} className={`flex items-center gap-3 rounded-lg border-2 px-4 min-h-[44px] py-3 cursor-pointer ${plata === id ? "border-accentChenar bg-accent/5" : "border-chenar"}`}>
                  <input type="radio" name="plata" checked={plata === id} onChange={() => setPlata(id)} className="w-5 h-5 shrink-0 accent-[rgb(var(--accent))]" />
                  <span><b>{t}</b> <span className="text-textSecundar text-sm">· {d}</span></span>
                </label>
              ))}
              {plata === "card" && <p className="text-[12px] text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                Plata cu cardul se activează la conectarea procesatorului. Până atunci, comanda se înregistrează și te contactăm cu linkul de plată sau poți alege ramburs.</p>}
            </div>
          </div>
          {/* 4. GDPR */}
          <div className="card p-5 space-y-2 text-sm">
            <label className="flex gap-3 items-start min-h-[44px] py-2 cursor-pointer"><input type="checkbox" required className="w-5 h-5 shrink-0 mt-0.5 accent-[rgb(var(--accent))]" />
              <span>Am citit și sunt de acord cu <Link href="/legal/termeni-si-conditii" className="accentuat font-semibold">Termenii și condițiile</Link> și cu <Link href="/legal/politica-de-retur" className="accentuat font-semibold">Politica de retur</Link>. *</span></label>
            <label className="flex gap-3 items-start min-h-[44px] py-2 cursor-pointer"><input type="checkbox" name="gdpr" className="w-5 h-5 shrink-0 mt-0.5 accent-[rgb(var(--accent))]" />
              <span className="text-textSecundar">Sunt de acord să primesc, ocazional, oferte pe e-mail (opțional).</span></label>
          </div>
        </div>
        {/* Sumar */}
        <div className="card p-5 space-y-3 text-sm lg:sticky lg:top-24">
          <b className="font-disp font-semibold text-[13px]">Comanda ta</b>
          {items.map((i) => (
            <div key={i.id} className="flex justify-between gap-3"><span className="text-textSecundar">{i.nume.slice(0, 42)}…</span><b className="whitespace-nowrap">{lei(i.pret)}</b></div>
          ))}
          <DiscountBox subtotal={total} reducere={reducere} setReducere={setReducere} />
          {reducereVal > 0 && <div className="flex justify-between text-ok"><span>Reducere {reducere?.cod}</span><b>−{lei(reducereVal)}</b></div>}
          <div className="flex justify-between border-t border-chenar pt-3 text-textSecundar"><span>Livrare</span><span className="text-[12px] text-right">se calculează<br />și ți-o comunicăm</span></div>
          <div className="flex justify-between text-base"><span>Total piese</span>
            <b className="font-disp text-2xl accentuat tabular-nums">{lei(total - reducereVal)}</b></div>
          <button disabled={stare === "trimit"} className="btn-acc w-full">{stare === "trimit" ? "Se plasează…" : "Plasează comanda"}</button>
          {stare === "eroare" && <p className="text-red-600 text-[13px]">{msg}</p>}
          <p className="text-[12px] text-textSecundar text-center">Comanda se salvează securizat. Nu cerem date de card.</p>
          <p className="text-[12px] text-textSecundar text-center leading-relaxed">
            La suma de mai sus se adaugă transportul, pe care ți-l comunicăm telefonic
            înainte de expediere.
          </p>
          {/* Mențiunile legale obligatorii înainte de plasarea comenzii */}
          <p className="text-[12px] text-textSecundar text-center leading-relaxed">
            Garanție 90 de zile conform <Link href="/legal/certificat-garantie" className="accentuat font-semibold">OUG 140/2021</Link> ·
            drept de retragere în 14 zile conform <Link href="/legal/politica-de-retur" className="accentuat font-semibold">OUG 34/2014</Link>
          </p>
        </div>
      </form>
    </div>
  );
}
