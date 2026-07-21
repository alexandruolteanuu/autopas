"use client";
// ============================================================
// SCHELETUL PANOULUI DE ADMINISTRARE
// - gardă: doar admin / operator / contabil (rolul din profiles)
// - sidebar cu module + badge-uri live (comenzi noi, cereri noi)
// - căutare globală: comenzi, piese, clienți — un singur câmp
// - clopoțel cu alertele care cer acțiune
// ============================================================
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { sbBrowser } from "@/lib/supabase";

type Rol = "verific" | "anonim" | "client" | "admin" | "operator" | "contabil";
type Cauta = { tip: string; titlu: string; sub: string; href: string };

const MENIU = [
  { href: "/admin", t: "Dashboard", ic: "▦", roluri: ["admin", "operator"] },
  { href: "/admin/comenzi", t: "Comenzi", ic: "⬚", roluri: ["admin", "operator", "contabil"], badge: "comenzi" },
  { href: "/admin/cereri", t: "Cereri (Inbox)", ic: "✉", roluri: ["admin", "operator"], badge: "cereri" },
  { href: "/admin/produse", t: "Produse / Inventar", ic: "⚙", roluri: ["admin", "operator"] },
  { href: "/admin/categorii", t: "Categorii", ic: "☰", roluri: ["admin"] },
  { href: "/admin/marci", t: "Mărci și modele", ic: "✧", roluri: ["admin"] },
  { href: "/admin/masini", t: "Mașini la dezmembrat", ic: "⛭", roluri: ["admin", "operator"] },
  { href: "/admin/expedieri", t: "Expedieri (AWB)", ic: "⇥", roluri: ["admin", "operator"] },
  { href: "/admin/clienti", t: "Clienți", ic: "☺", roluri: ["admin", "operator"] },
  { href: "/admin/facturi", t: "Facturi", ic: "▤", roluri: ["admin", "contabil"] },
  { href: "/admin/rapoarte", t: "Rapoarte", ic: "◫", roluri: ["admin"] },
  { href: "/admin/marketing", t: "Marketing", ic: "✦", roluri: ["admin"] },
  { href: "/admin/setari", t: "Setări", ic: "⚙", roluri: ["admin"] },
  { href: "/admin/integrari", t: "Integrări", ic: "⊞", roluri: ["admin"] },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [rol, setRol] = useState<Rol>("verific");
  const [email, setEmail] = useState("");
  const [badges, setBadges] = useState<{ comenzi: number; cereri: number }>({ comenzi: 0, cereri: 0 });
  const [alerte, setAlerte] = useState<{ t: string; href: string }[]>([]);
  const [clopotel, setClopotel] = useState(false);
  const [q, setQ] = useState("");
  const [rez, setRez] = useState<Cauta[]>([]);
  const path = usePathname();
  const router = useRouter();

  const incarcaContor = useCallback(async () => {
    const sb = sbBrowser(); if (!sb) return;
    const [o, p1, p2, p3, p4] = await Promise.all([
      sb.from("orders").select("id", { count: "exact", head: true }).eq("status", "noua"),
      sb.from("part_requests").select("id", { count: "exact", head: true }).eq("status", "noua"),
      sb.from("car_intake_requests").select("id", { count: "exact", head: true }).eq("status", "noua"),
      sb.from("return_requests").select("id", { count: "exact", head: true }).eq("status", "noua"),
      sb.from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "noua"),
    ]);
    const cereri = (p1.count ?? 0) + (p2.count ?? 0) + (p3.count ?? 0) + (p4.count ?? 0);
    setBadges({ comenzi: o.count ?? 0, cereri });
    const a: { t: string; href: string }[] = [];
    if (o.count) a.push({ t: `${o.count} comenzi noi de confirmat`, href: "/admin/comenzi?f=noua" });
    if (p1.count) a.push({ t: `${p1.count} cereri „caut o piesă" nerezolvate`, href: "/admin/cereri?tab=piese" });
    if (p2.count) a.push({ t: `${p2.count} cereri de predare / Rabla`, href: "/admin/cereri?tab=predare" });
    if (p3.count) a.push({ t: `${p3.count} cereri de retur în așteptare`, href: "/admin/cereri?tab=retur" });
    if (p4.count) a.push({ t: `${p4.count} mesaje de contact necitite`, href: "/admin/cereri?tab=contact" });
    setAlerte(a);
  }, []);

  useEffect(() => {
    const sb = sbBrowser(); if (!sb) { setRol("anonim"); return; }
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) { setRol("anonim"); return; }
      setEmail(data.user.email ?? "");
      const { data: p } = await sb.from("profiles").select("role").eq("id", data.user.id).single();
      const r = (p?.role ?? "client") as Rol;
      setRol(["admin", "operator", "contabil"].includes(r) ? r : "client");
      if (["admin", "operator", "contabil"].includes(r)) incarcaContor();
    });
  }, [incarcaContor]);

  // căutarea globală — comenzi (număr/nume/telefon) + piese (OEM/nume)
  useEffect(() => {
    const t = setTimeout(async () => {
      if (q.trim().length < 2) { setRez([]); return; }
      const sb = sbBrowser(); if (!sb) return;
      const [o, pr] = await Promise.all([
        sb.from("orders").select("id,numar,nume,telefon,total,status")
          .or(`numar.ilike.%${q}%,nume.ilike.%${q}%,telefon.ilike.%${q}%,email.ilike.%${q}%`).limit(5),
        sb.from("products").select("id,slug,nume,oem,pret_lei,stoc")
          .or(`oem.ilike.%${q}%,nume.ilike.%${q}%`).limit(5),
      ]);
      const r: Cauta[] = [];
      (o.data ?? []).forEach((x: any) => r.push({ tip: "Comandă", titlu: `${x.numar} · ${x.nume}`, sub: `${x.telefon} · ${x.total} lei · ${x.status}`, href: `/admin/comenzi/${x.id}` }));
      (pr.data ?? []).forEach((x: any) => r.push({ tip: "Piesă", titlu: x.nume, sub: `OEM ${x.oem} · ${x.pret_lei} lei · stoc ${x.stoc}`, href: `/piese/${x.slug}` }));
      setRez(r);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  if (rol === "verific") return <div className="min-h-screen grid place-items-center text-mut">Se verifică accesul…</div>;
  if (rol === "anonim" || rol === "client")
    return (
      <div className="min-h-screen grid place-items-center bg-paper px-4">
        <div className="card p-8 max-w-md text-center">
          <h1 className="font-disp font-bold text-2xl">Panou de administrare</h1>
          <p className="text-mut mt-2 text-sm">
            {rol === "anonim" ? "Autentifică-te cu un cont de echipă (admin, operator sau contabil)."
              : "Contul tău nu face parte din echipă. Cere administratorului să îți atribuie un rol (vezi README)."}
          </p>
          <Link href="/autentificare" className="btn-acc mt-5">Autentificare</Link>
          <Link href="/" className="block mt-3 text-sm text-mut hover:text-acc">← Înapoi la site</Link>
        </div>
      </div>
    );

  const meniu = MENIU.filter((m) => m.roluri.includes(rol));
  const iesi = async () => { await sbBrowser()?.auth.signOut(); location.href = "/"; };

  return (
    <div className="min-h-screen bg-paper lg:grid lg:grid-cols-[240px,1fr]">
      {/* ===== SIDEBAR ===== */}
      <aside className="bg-ink text-white lg:min-h-screen lg:sticky lg:top-0 lg:h-screen flex lg:flex-col overflow-x-auto">
        <Link href="/admin" className="hidden lg:block px-5 py-5 border-b border-white/10">
          <span className="font-disp font-bold text-xl tracking-wide">AUTOPAS</span>
          <span className="block text-[9px] tracking-[0.4em] text-white/50">ADMINISTRARE</span>
        </Link>
        <nav className="flex lg:flex-col flex-1 lg:py-3">
          {meniu.map((m) => {
            const activ = m.href === "/admin" ? path === "/admin" : path.startsWith(m.href);
            const b = m.badge ? badges[m.badge as "comenzi" | "cereri"] : 0;
            return (
              <Link key={m.href} href={m.href}
                className={`flex items-center gap-3 px-5 py-3 text-sm whitespace-nowrap ${activ ? "bg-acc text-white" : "text-white/75 hover:bg-white/10"}`}>
                <span className="w-4 text-center">{m.ic}</span>{m.t}
                {b > 0 && <span className="ml-auto bg-white text-ink text-[11px] font-bold rounded-full px-1.5 min-w-[20px] h-5 grid place-items-center">{b}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="hidden lg:block px-5 py-4 border-t border-white/10 text-xs text-white/60">
          <b className="block text-white/90 truncate">{email}</b>
          rol: {rol}
          <div className="mt-2 flex gap-3">
            <Link href="/" className="hover:text-white">← Site</Link>
            <button onClick={iesi} className="hover:text-white underline underline-offset-2">Ieșire</button>
          </div>
        </div>
      </aside>

      {/* ===== CONȚINUT ===== */}
      <div className="min-w-0">
        <header className="bg-white border-b border-line sticky top-0 z-30">
          <div className="px-4 lg:px-6 py-3 flex items-center gap-3">
            <div className="relative flex-1 max-w-xl">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Caută: nr. comandă, client, telefon, cod OEM…"
                className="w-full rounded-xl border-2 border-line px-4 py-2 text-sm outline-none focus:border-acc" />
              {rez.length > 0 && (
                <div className="absolute top-full mt-1 inset-x-0 bg-white border border-line rounded-xl shadow-card overflow-hidden z-40">
                  {rez.map((r, i) => (
                    <button key={i} onClick={() => { setQ(""); setRez([]); router.push(r.href); }}
                      className="w-full text-left px-4 py-2.5 hover:bg-paper flex items-center gap-3 text-sm">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-ink text-white shrink-0">{r.tip}</span>
                      <span className="min-w-0"><b className="block truncate">{r.titlu}</b>
                        <span className="text-mut text-xs">{r.sub}</span></span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative ml-auto">
              <button onClick={() => setClopotel(!clopotel)} className="relative w-10 h-10 rounded-xl border-2 border-line grid place-items-center hover:border-acc" aria-label="notificări">
                🔔{alerte.length > 0 && <span className="absolute -top-1 -right-1 bg-acc text-white text-[10px] font-bold rounded-full w-5 h-5 grid place-items-center">{alerte.length}</span>}
              </button>
              {clopotel && (
                <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-line rounded-xl shadow-card overflow-hidden z-40">
                  <b className="block px-4 py-2.5 border-b border-line text-sm">Cer acțiunea ta</b>
                  {alerte.length === 0 && <p className="px-4 py-4 text-sm text-mut">Totul e la zi. ✓</p>}
                  {alerte.map((a) => (
                    <Link key={a.href + a.t} href={a.href} onClick={() => setClopotel(false)}
                      className="block px-4 py-2.5 text-sm hover:bg-paper border-b border-line last:border-0">⚠ {a.t}</Link>
                  ))}
                </div>
              )}
            </div>
            {rol !== "contabil" && (
              <Link href="/admin/produse/nou" className="btn-acc !py-2 !px-4 text-sm whitespace-nowrap">+ Adaugă piesă</Link>
            )}
          </div>
        </header>
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
