"use client";
// CASETA OLX DE PE PAGINA PIESEI (pasul 2 din docs/olx-plan.md).
// „Previzualizează anunțul OLX”: anunțul exact cum ar pleca (după curățarea
// textului), cu ce s-a corectat și de ce nu s-ar putea publica. Doar citire.
// Anunțul real: starea din `olx_anunturi` + butoanele Publică / Actualizează /
// Dezactivează / Activează / Reîmprospătează (doar admin; logica în lib/olx-publicare.mjs).
import { useCallback, useEffect, useState } from "react";
import { sbBrowser } from "@/lib/supabase";

type Previzualizare = {
  ok: boolean; eroare?: string; motive: string[]; riscuri: string[]; corectari: string[]; categorie: string | null;
  piesa_eligibila: boolean; brute: { titlu: string[]; descriere: string[] };
  corp: { title: string; description: string; price: { value: number }; images: { url: string }[];
          attributes: { code: string; value: string }[]; external_id: string; external_url?: string;
          location: { city_id: number | null }; contact: { name: string; phone?: string } };
};

/** Textul pentru om al fiecărei corectări / reguli. */
export const ETICHETE: Record<string, string> = {
  telefon: "număr de telefon", email: "adresă de e-mail", www: "adresă web", majuscule: "peste 50% majuscule",
  semne: "3 semne la rând", prea_scurt: "prea scurt", prea_lung: "prea lung",
  titlu_completat: "titlu completat (sub 16 caractere)", titlu_taiat: "titlu tăiat (peste 150)",
  descriere_completata: "descriere completată (sub 80 caractere)", descriere_taiata: "descriere tăiată (peste 9000)",
  poze_taiate: "poze peste limita OLX (se trimit primele)",
};
export const eticheta = (c: string) => {
  const m = /^(titlu|descriere)_(.+)$/.exec(c);
  if (ETICHETE[c]) return ETICHETE[c];
  return m ? `${m[1]}: ${ETICHETE[m[2]] ?? m[2]} — scos / corectat` : c;
};

type Anunt = { advert_id: number | null; status: string; url: string | null; valid_to: string | null; motiv_moderare: string | null;
               eroare: string | null; amprenta: string | null; publicat_la: string | null; actualizat_la: string };
const STARI: Record<string, string> = {
  in_curs: "se publică…", new: "nou — în moderare la OLX", active: "activ pe OLX", limited: "LIMITED — peste limita gratuită (nu se plătește nimic)",
  removed_by_user: "dezactivat", outdated: "expirat", moderated: "RESPINS de moderare", blocked: "BLOCAT de moderare",
  disabled: "dezactivat de moderare (în verificare)", removed_by_moderator: "șters de moderator", eroare: "eroare la publicare",
  unconfirmed: "așteaptă confirmare", unpaid: "așteaptă plată (nu se plătește nimic din aplicație)",
};

async function cheama(corp: Record<string, unknown>) {
  const sb = sbBrowser();
  const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
  const r = await fetch("/api/olx", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
    body: JSON.stringify(corp) });
  return r.json().catch(() => ({ ok: false, eroare: `Răspuns neașteptat (HTTP ${r.status}).` }));
}

export default function OlxPiesa({ id }: { id: number }) {
  const [p, setP] = useState<Previzualizare | null>(null);
  const [lucru, setLucru] = useState(false);
  const [anunt, setAnunt] = useState<Anunt | null>(null);
  const [act, setAct] = useState("");
  const [rez, setRez] = useState<{ bun: boolean; text: string } | null>(null);

  const citesteAnunt = useCallback(async () => {
    const sb = sbBrowser(); if (!sb) return;
    const { data } = await sb.from("olx_anunturi").select("*").eq("product_id", id).maybeSingle();
    setAnunt((data as Anunt) ?? null);
  }, [id]);
  useEffect(() => { citesteAnunt(); }, [citesteAnunt]);

  async function fa(actiune: string, extra: Record<string, unknown> = {}, intrebare?: string) {
    if (intrebare && !confirm(intrebare)) return;
    setAct(actiune); setRez(null);
    const j = await cheama({ actiune, product_id: id, ...extra });
    setAct("");
    if (j?.anunt !== undefined) setAnunt(j.anunt); else citesteAnunt();
    setRez(j?.ok ? { bun: true, text: `✓ ${j.actiune ?? "Gata"}${j.preluat ? " (anunțul exista deja pe OLX cu același cod — a fost preluat, nu dublat)" : ""}. Stare: ${STARI[j.status] ?? j.status ?? "—"}.` }
      : { bun: false, text: j?.eroare ?? "N-a mers." });
  }

  async function previzualizeaza() {
    setLucru(true);
    const sb = sbBrowser();
    const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
    const r = await fetch("/api/olx", { method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
      body: JSON.stringify({ actiune: "previzualizeaza", product_id: id }) });
    setP(await r.json().catch(() => ({ ok: false, eroare: `Răspuns neașteptat (HTTP ${r.status}).` })));
    setLucru(false);
  }

  return (
    <div className="card p-5 mt-5 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <b className="font-disp text-base">OLX</b>
        <button type="button" onClick={previzualizeaza} disabled={lucru} className="rounded-xl border-2 border-line px-3 py-1.5 text-xs font-bold hover:border-acc">
          {lucru ? "Se generează…" : p ? "Generează din nou" : "Previzualizează anunțul OLX"}</button>
        <span className="text-xs text-mut">Doar previzualizare — nu se trimite nimic la OLX. Folosește datele SALVATE ale piesei.</span>
      </div>
      <div className="mt-3 grid gap-2 rounded-xl border-2 border-line p-3">
        {!anunt ? <p className="text-xs text-mut">Piesa n-are anunț pe OLX.</p> : (
          <div className="text-xs grid gap-0.5">
            <p>Stare: <b className={["moderated", "blocked", "disabled", "removed_by_moderator", "eroare", "limited"].includes(anunt.status) ? "text-red-700" : ""}>{STARI[anunt.status] ?? anunt.status}</b>
              {anunt.advert_id ? ` · anunț #${anunt.advert_id}` : ""}
              {anunt.url ? <> · <a href={anunt.url} target="_blank" rel="noreferrer" className="underline font-semibold">vezi pe OLX</a></> : ""}</p>
            {anunt.motiv_moderare && <p className="text-red-700">Motivul OLX: {anunt.motiv_moderare}</p>}
            {anunt.eroare && <p className="text-red-700">Ultima eroare: {anunt.eroare}</p>}
            <p className="text-mut">Publicat: {anunt.publicat_la ? new Date(anunt.publicat_la).toLocaleString("ro-RO") : "—"} · actualizat: {new Date(anunt.actualizat_la).toLocaleString("ro-RO")}
              {anunt.valid_to ? ` · valabil până la ${new Date(anunt.valid_to).toLocaleDateString("ro-RO")}` : ""}</p>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {!anunt?.advert_id && <button type="button" disabled={!!act} className="btn-dark !py-1.5 text-xs"
            onClick={() => fa("publica", {}, "Publici piesa pe OLX? Se creează un anunț real, pe contul firmei.")}>{act === "publica" ? "Se publică…" : "Publică pe OLX"}</button>}
          {anunt?.advert_id && <>
            <button type="button" disabled={!!act} className="btn-dark !py-1.5 text-xs" onClick={() => fa("actualizeaza")}>{act === "actualizeaza" ? "Se actualizează…" : "Actualizează pe OLX (preț, text, poze)"}</button>
            <button type="button" disabled={!!act} className="rounded-xl border-2 border-line px-3 py-1.5 text-xs font-bold" onClick={() => fa("improspateaza")}>{act === "improspateaza" ? "…" : "Reîmprospătează starea"}</button>
            <button type="button" disabled={!!act} className="rounded-xl border-2 border-line px-3 py-1.5 text-xs font-bold"
              onClick={() => fa("dezactiveaza", { vanduta: false }, "Dezactivezi anunțul OLX (fără vânzare)?")}>Dezactivează</button>
            <button type="button" disabled={!!act} className="rounded-xl border-2 border-line px-3 py-1.5 text-xs font-bold"
              onClick={() => fa("dezactiveaza", { vanduta: true }, "Dezactivezi anunțul OLX ca VÂNDUT?")}>Dezactivează — vândută</button>
            <button type="button" disabled={!!act || anunt.status === "limited"} className="rounded-xl border-2 border-line px-3 py-1.5 text-xs font-bold"
              onClick={() => fa("activeaza")}>Activează</button>
          </>}
        </div>
        <p className="text-[11px] text-mut">Butoanele folosesc datele SALVATE ale piesei. Aplicația nu cumpără nimic pe OLX (pachete, promovări).</p>
        {rez && <p className={`text-xs ${rez.bun ? "text-ok" : "text-red-700"}`}>{rez.text}</p>}
      </div>
      {p && !p.corp && <p className="text-xs text-red-700 mt-2">{p.eroare}</p>}
      {p?.corp && (
        <div className="mt-3 grid gap-2">
          {p.motive.length > 0
            ? <div className="rounded-lg border-2 border-red-300 bg-red-50 text-red-800 p-2 text-xs">✗ NU s-ar putea publica: {p.motive.join("; ")}.</div>
            : <div className="rounded-lg border border-ok/30 bg-ok/10 text-ok p-2 text-xs">✓ Anunțul respectă regulile OLX și s-ar putea publica.</div>}
          {!p.piesa_eligibila && <p className="text-xs text-amber-800">⚠ Piesa nu e publicată pe site sau n-are stoc — n-ar pleca la OLX.</p>}
          {p.corectari.length > 0 && <p className="text-xs text-amber-800">Corectat automat: {p.corectari.map(eticheta).join("; ")}.</p>}
          {p.riscuri.length > 0 && <p className="text-xs text-amber-800">De urmărit: {p.riscuri.join("; ")}.</p>}
          <div className="rounded-xl border-2 border-line p-3 grid gap-1">
            <div className="text-xs text-mut">Categoria OLX: {p.categorie ?? "—"}{p.corp.attributes.length ? ` · ${p.corp.attributes.map((a) => `${a.code}=${a.value}`).join(", ")}` : ""}</div>
            <b>{p.corp.title}</b> <span className="text-xs text-mut">({p.corp.title.length} caractere)</span>
            <div className="font-bold">{p.corp.price.value} lei</div>
            <pre className="whitespace-pre-wrap font-sans text-xs bg-paper rounded-lg p-2 max-h-80 overflow-auto">{p.corp.description}</pre>
            <div className="text-xs text-mut">{p.corp.description.length} caractere · {p.corp.images.length} poze · external_id {p.corp.external_id || "—"}
              {p.corp.external_url ? <> · <a className="underline" href={p.corp.external_url} target="_blank" rel="noreferrer">linkul piesei</a></> : ""}
              {" "}· contact {p.corp.contact.name || "—"}{p.corp.contact.phone ? `, ${p.corp.contact.phone}` : ""} · city_id {p.corp.location.city_id ?? "—"}</div>
            <div className="flex flex-wrap gap-1 mt-1">
              {p.corp.images.map((i) => <a key={i.url} href={i.url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={i.url} alt="" className="w-16 h-16 object-cover rounded-lg border border-line" loading="lazy" /></a>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
