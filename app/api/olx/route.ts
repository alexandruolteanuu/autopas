// ============================================================
// RUTA OLX (pasul 1 din docs/olx-plan.md). POST, JSON `{ actiune }`, doar ADMIN:
//   · stare               — starea contului, fără tokeni / secret;
//   · salveaza-aplicatia  — client_id + client_secret (scrise de om; nu ies niciodată);
//   · conecteaza          — creează `state` (10 min, o folosire) și întoarce adresa OLX;
//   · deconecteaza        — șterge tokenii din bază;
//   · testeaza            — GET /users/me + numărul anunțurilor existente pe cont;
//   · salveaza-setari     — orașul și contactul anunțurilor;
//   · cauta-oras          — GET /locations după coordonate;
//   · aduce-categorii     — catalogul OLX (ramura „Auto…”), în `olx_categorii`;
//   · atribute            — atributele unei frunze, salvate lângă ea;
//   · sugestie            — GET /categories/suggestion pe un titlu de piesă.
// Pasul 2 (doar citire, toată echipa; NU cheamă OLX):
//   · previzualizeaza     — anunțul generat pentru o piesă (`product_id`);
//   · raport              — generatorul rulat pe tot catalogul publicat cu stoc.
// Tokenii și secretul intră aici doar la salvare și nu ies în niciun răspuns.
// ============================================================
import { NextResponse } from "next/server";
import { esteAdmin, esteEchipa, citesteTot } from "@/lib/supabase";
import { clientOlx, stareOlx, admin, cere, adresaCallback, contextAnunt, COLOANE_PIESA, EroareOlx, type SetariOlx } from "@/lib/olx";
import { construiesteAnunt, incalcariBrute } from "@/lib/olx-anunt.mjs";
import { adresaAutorizare, dinData } from "@/lib/olx-api.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const nuAi = () => NextResponse.json({ ok: false, eroare: "Doar administratorul poate lucra cu legătura OLX. Autentifică-te din nou în panou." }, { status: 401 });
const greseala = (t: string) => NextResponse.json({ ok: false, eroare: t }, { status: 400 });
const eroare = (e: unknown) => NextResponse.json({
  ok: false,
  cod: e instanceof EroareOlx ? (e as any).cod : "eroare",
  eroare: e instanceof EroareOlx ? e.message : `Eroare la legătura cu OLX: ${(e as Error)?.message ?? e}`,
});

type CatOlx = { id: number; name: string; parent_id: number | null; is_leaf: boolean; photos_limit?: number | null };
const lista = (j: unknown): CatOlx[] => { const d = dinData(j); return Array.isArray(d) ? d : []; };

export async function POST(req: Request) {
  const corp = await req.json().catch(() => ({} as Record<string, any>));
  const actiune = String(corp.actiune ?? "");
  const sb = admin();

  try {
    // Pasul 2: doar citire, fără niciun apel spre OLX — deschise întregii echipe.
    if (actiune === "previzualizeaza" || actiune === "raport") {
      if (!(await esteEchipa(req))) return NextResponse.json({ ok: false, eroare: "Autentifică-te din nou în panou." }, { status: 401 });
      const ctx = await contextAnunt();
      if (actiune === "previzualizeaza") {
        const id = Number(corp.product_id);
        if (!Number.isInteger(id) || id <= 0) return greseala("Piesa lipsește.");
        const p = await cere(sb.from("products").select(COLOANE_PIESA).eq("id", id).maybeSingle(), "piesa");
        if (!p) return greseala("Piesa nu există.");
        const a = construiesteAnunt(p as any, ctx);
        const pr = p as any;
        return NextResponse.json({ ...a, ok: true, publicabil: a.ok, brute: incalcariBrute(pr),
          piesa_eligibila: !!pr.publicat && Number(pr.stoc) > 0 });
      }
      return NextResponse.json(await raport(ctx));
    }

    const de = await esteAdmin(req);
    if (!de) return nuAi();

    if (actiune === "stare") return NextResponse.json({ ok: true, ...(await stareOlx()), callback: adresaCallback(req) });

    if (actiune === "salveaza-aplicatia") {
      const id = String(corp.client_id ?? "").trim();
      const secret = String(corp.client_secret ?? "").trim();
      if (!/^\d{1,12}$/.test(id) && !/^[A-Za-z0-9_-]{2,64}$/.test(id)) return greseala("client_id pare greșit.");
      if (secret.length < 8 || /\s/.test(secret)) return greseala("client_secret pare greșit (prea scurt sau cu spații).");
      const vechi = (await cere(sb.from("olx_cont").select("client_id").eq("unic", true).maybeSingle(), "cont")) as any;
      const camp: Record<string, unknown> = { client_id: id, client_secret: secret };
      // Altă aplicație = tokenii vechi nu mai sunt ai ei.
      if (vechi?.client_id && vechi.client_id !== id) Object.assign(camp, { access_token: null, access_expira: null, refresh_token: null, utilizator: null });
      await cere(sb.from("olx_cont").update(camp).eq("unic", true).select("unic"), "aplicația");
      return NextResponse.json({ ok: true, mesaj: "✓ Aplicația OLX e salvată. Apasă „Conectează OLX”.", ...(await stareOlx()) });
    }

    if (actiune === "conecteaza") {
      const c = (await cere(sb.from("olx_cont").select("client_id,client_secret").eq("unic", true).maybeSingle(), "cont")) as any;
      if (!c?.client_id || !c?.client_secret) return greseala("Salvează întâi client_id și client_secret.");
      const state = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
      await cere(sb.from("olx_cont").update({ stare_oauth: state, stare_oauth_expira: new Date(Date.now() + 10 * 60_000).toISOString(), stare_oauth_de: de })
        .eq("unic", true).select("unic"), "state");
      return NextResponse.json({ ok: true, url: adresaAutorizare({ client_id: c.client_id, state, redirect_uri: adresaCallback(req) }) });
    }

    if (actiune === "deconecteaza") {
      await cere(sb.from("olx_cont").update({ access_token: null, access_expira: null, refresh_token: null, utilizator: null,
        deconectat_la: new Date().toISOString(), deconectat_motiv: "Deconectat din admin" }).eq("unic", true).select("unic"), "cont");
      return NextResponse.json({ ok: true, mesaj: "Contul OLX a fost deconectat (tokenii au fost șterși).", ...(await stareOlx()) });
    }

    if (actiune === "testeaza") {
      const client = clientOlx();
      const { json } = await client.cere({ cale: "/users/me", tip: "test", de });
      const u = dinData(json) ?? {};
      const utilizator = { id: u.id, name: u.name, email: u.email, is_business: u.is_business };
      await cere(sb.from("olx_cont").update({ utilizator }).eq("unic", true).select("unic"), "cont");
      const { anunturi, complet } = await client.toateAnunturile({ de });
      const peStare: Record<string, number> = {};
      for (const a of anunturi) peStare[a.status ?? "?"] = (peStare[a.status ?? "?"] ?? 0) + 1;
      const detalii = Object.entries(peStare).map(([s, n]) => `${n} ${s}`).join(", ");
      return NextResponse.json({ ok: true, ...(await stareOlx()),
        mesaj: `✓ Conectat la OLX ca „${u.name ?? "?"}”${u.is_business ? " (cont business)" : " — ⚠ contul NU apare ca business"}. ` +
               `Anunțuri existente pe cont: ${anunturi.length}${complet ? "" : "+"}${detalii ? ` (${detalii})` : ""}.` });
    }

    if (actiune === "salveaza-setari") {
      const vechi = ((await cere(sb.from("olx_cont").select("setari").eq("unic", true).maybeSingle(), "cont")) as any)?.setari ?? {};
      const num = (v: unknown) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null; };
      const s: SetariOlx = {
        ...vechi,
        city_id: num(corp.city_id), district_id: num(corp.district_id), oras: String(corp.oras ?? "").trim().slice(0, 120),
        contact_nume: String(corp.contact_nume ?? "").trim().slice(0, 80), contact_telefon: String(corp.contact_telefon ?? "").replace(/[^\d+]/g, "").slice(0, 20),
      };
      if (!s.city_id) return greseala("Orașul (city_id) lipsește — caută-l după coordonate.");
      if (!s.contact_nume) return greseala("Numele de contact lipsește.");
      await cere(sb.from("olx_cont").update({ setari: s }).eq("unic", true).select("unic"), "setări");
      return NextResponse.json({ ok: true, mesaj: "✓ Setările anunțurilor OLX sunt salvate.", ...(await stareOlx()) });
    }

    if (actiune === "cauta-oras") {
      const lat = Number(String(corp.lat ?? "").replace(",", ".")), lon = Number(String(corp.lon ?? "").replace(",", "."));
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return greseala("Scrie coordonatele (latitudine, longitudine).");
      const { json } = await clientOlx().cere({ cale: `/locations?latitude=${lat}&longitude=${lon}`, tip: "locatii", de });
      const d = dinData(json);
      const loc = (Array.isArray(d) ? d : []).map((x: any) => ({
        city_id: x.city?.id, oras: [x.city?.name, x.city?.municipality, x.city?.county].filter(Boolean).join(", "),
        district_id: x.district?.id ?? null, cartier: x.district?.name ?? null,
      }));
      return NextResponse.json({ ok: true, locatii: loc });
    }

    if (actiune === "aduce-categorii") return NextResponse.json(await aduCategorii(de));

    if (actiune === "atribute") {
      const id = Number(corp.id);
      if (!Number.isInteger(id) || id <= 0) return greseala("Categoria OLX lipsește.");
      const client = clientOlx();
      const [cat, at] = await Promise.all([
        client.cere({ cale: `/categories/${id}`, tip: "categorie", de }),
        client.cere({ cale: `/categories/${id}/attributes`, tip: "atribute", de }),
      ]);
      const c = dinData(cat.json) ?? {};
      const atribute = (() => { const d = dinData(at.json); return Array.isArray(d) ? d : []; })();
      if (!c.is_leaf) return greseala(`„${c.name ?? id}” nu e o categorie finală pe OLX — alege una dintre subcategoriile ei.`);
      await cere(sb.from("olx_categorii").upsert({ id, nume: c.name ?? String(id), parent_id: c.parent_id ?? null, is_leaf: true,
        photos_limit: c.photos_limit ?? null, atribute, atribute_la: new Date().toISOString() }, { onConflict: "id" }).select("id"), "atribute");
      return NextResponse.json({ ok: true, categorie: { id, nume: c.name, photos_limit: c.photos_limit }, atribute });
    }

    if (actiune === "sugestie") {
      const q = String(corp.q ?? "").trim();
      if (q.length < 3) return greseala("Titlul e prea scurt pentru o sugestie.");
      const { json } = await clientOlx().cere({ cale: `/categories/suggestion?q=${encodeURIComponent(q.slice(0, 150))}`, tip: "sugestie", de });
      const d = dinData(json);
      const sugestii = (Array.isArray(d) ? d : []).map((x: any) => ({
        id: x.id, nume: x.name, cale: [...(Array.isArray(x.path) ? x.path.map((p: any) => p.name) : []), x.name].filter((v, i, a) => a.indexOf(v) === i).join(" › "),
      }));
      return NextResponse.json({ ok: true, sugestii });
    }

    return greseala(`Acțiune necunoscută: „${actiune}”.`);
  } catch (e) {
    return eroare(e);
  }
}

/**
 * Catalogul OLX: întâi `/categories`; dacă vin doar rădăcinile, coboară pe ramurile
 * cu „auto” în nume, câte un nivel pe cerere. Are termen (45 s): ce n-a apucat se
 * ia la apăsarea următoare (coboară doar unde copiii lipsesc din tabel).
 */
async function aduCategorii(de: string) {
  const sb = admin();
  const client = clientOlx();
  const pana = Date.now() + 45_000;
  const acum = new Date().toISOString();
  const rand = (c: CatOlx) => ({ id: c.id, nume: c.name, parent_id: c.parent_id || null, is_leaf: !!c.is_leaf, photos_limit: c.photos_limit ?? null, adus_la: acum });
  const scrie = async (cats: CatOlx[]) => {
    for (let i = 0; i < cats.length; i += 500)
      await cere(sb.from("olx_categorii").upsert(cats.slice(i, i + 500).map(rand), { onConflict: "id", ignoreDuplicates: false }).select("id"), "categorii");
  };

  await scrie(lista((await client.cere({ cale: "/categories", tip: "categorii", de, pana })).json));
  const toate = await citesteTot<{ id: number; nume: string; parent_id: number | null; is_leaf: boolean }>(
    () => sb.from("olx_categorii").select("id,nume,parent_id,is_leaf", { count: "exact" }).order("id"), { eticheta: "categoriile OLX" });
  const dupaId = new Map(toate.map((c) => [c.id, c]));
  const copii = new Map<number, number[]>();
  for (const c of toate) if (c.parent_id) copii.set(c.parent_id, [...(copii.get(c.parent_id) ?? []), c.id]);

  const radacini = toate.filter((c) => !c.parent_id && /auto/i.test(c.nume));
  const coada = radacini.map((c) => c.id);
  let cereri = 0, incomplet = false;
  while (coada.length) {
    const id = coada.shift()!;
    const c = dupaId.get(id)!;
    if (c.is_leaf) continue;
    let fii = copii.get(id) ?? [];
    if (!fii.length) {
      if (Date.now() > pana || cereri >= 300) { incomplet = true; break; }
      const noi = lista((await client.cere({ cale: `/categories?parent_id=${id}`, tip: "categorii", de, pana })).json);
      cereri++;
      await scrie(noi);
      for (const n of noi) dupaId.set(n.id, { id: n.id, nume: n.name, parent_id: n.parent_id || null, is_leaf: !!n.is_leaf });
      fii = noi.map((n) => n.id);
      copii.set(id, fii);
    }
    coada.push(...fii);
  }

  // Calea completă („Auto › Piese auto › Motor”) pentru fiecare categorie cunoscută.
  const cale = (id: number) => { const p: string[] = []; let c = dupaId.get(id); let g = 0;
    while (c && g++ < 10) { p.unshift(c.nume); c = c.parent_id ? dupaId.get(c.parent_id) : undefined; } return p.join(" › "); };
  const cuCale = Array.from(dupaId.values()).map((c) => ({ id: c.id, nume: c.nume, parent_id: c.parent_id, is_leaf: c.is_leaf, cale: cale(c.id) }));
  for (let i = 0; i < cuCale.length; i += 500)
    await cere(sb.from("olx_categorii").upsert(cuCale.slice(i, i + 500), { onConflict: "id" }).select("id"), "căile categoriilor");

  const frunze = Array.from(dupaId.values()).filter((c) => c.is_leaf).length;
  return {
    ok: true, incomplet, total: dupaId.size, frunze, radacini: radacini.map((r) => r.nume),
    mesaj: incomplet
      ? `Am adus ${dupaId.size} categorii (${frunze} finale), dar n-am terminat. Apasă din nou „Adu categoriile OLX”.`
      : `✓ Catalogul OLX e adus: ${dupaId.size} categorii, ${frunze} finale (ramurile: ${radacini.map((r) => r.nume).join(", ") || "—"}).`,
  };
}

/** Generatorul pe tot catalogul publicat cu stoc: câte piese ar pleca, câte nu și de ce. */
async function raport(ctx: Awaited<ReturnType<typeof contextAnunt>>) {
  const sb = admin();
  const piese = await citesteTot<any>(() => sb.from("products").select(COLOANE_PIESA, { count: "exact" })
    .eq("publicat", true).gt("stoc", 0).order("id"), { eticheta: "piesele publicate" });
  const numara = () => ({} as Record<string, { n: number; exemple: { id: number; cod: string; nume: string }[] }>);
  const motive = numara(), brute = numara(), corectari = numara(), riscuri = numara();
  const adauga = (h: ReturnType<typeof numara>, cheie: string, p: any) => {
    const x = (h[cheie] ??= { n: 0, exemple: [] });
    x.n++;
    if (x.exemple.length < 20) x.exemple.push({ id: p.id, cod: p.cod_intern, nume: p.nume });
  };
  let gata = 0, cuIncalcariBrute = 0;
  for (const p of piese) {
    const a = construiesteAnunt(p, ctx);
    // „Gata” = nimic nu ține de piesă; setările lipsă se raportează o singură dată, separat.
    if (a.motive.every((m: string) => /Integrări → OLX/.test(m))) gata++;
    // Lipsa setărilor e una singură pentru tot catalogul: nu se numără pe piese.
    for (const m of a.motive) if (!/Integrări → OLX/.test(m)) adauga(motive, m.replace(/ \(.*\)$/, ""), p);
    const b = incalcariBrute(p);
    if (b.titlu.length || b.descriere.length) cuIncalcariBrute++;
    for (const r of b.titlu) adauga(brute, `titlu: ${r}`, p);
    for (const r of b.descriere) adauga(brute, `descriere: ${r}`, p);
    for (const c of a.corectari) adauga(corectari, c, p);
    for (const r of a.riscuri) adauga(riscuri, r, p);
  }
  const setariLipsa = construiesteAnunt({ nume: "x".repeat(20), pret_lei: 1 }, { ...ctx, mapari: new Map() }).motive.filter((m: string) => /Integrări → OLX/.test(m));
  return { ok: true, total: piese.length, gata, cuIncalcariBrute, setariLipsa, motive, brute, corectari, riscuri };
}
