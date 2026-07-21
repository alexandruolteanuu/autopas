"use client";
// ALERTĂ COMANDĂ NOUĂ — varianta fără serviciu de e-mail:
// verifică la fiecare 30 de secunde dacă a intrat o comandă nouă și te anunță
// sonor + vizual, cât timp ai panoul deschis. Titlul paginii afișează numărul.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { sbBrowser } from "@/lib/supabase";

type Noua = { id: number; numar: string; nume: string; total: number };

export default function NewOrderAlert() {
  const [noi, setNoi] = useState<Noua[]>([]);
  const [sunet, setSunet] = useState(true);
  const stiute = useRef<Set<number>>(new Set());
  const pornit = useRef(false);
  const titluInitial = useRef("");

  useEffect(() => {
    titluInitial.current = document.title;
    try { setSunet(localStorage.getItem("autopas_sunet") !== "off"); } catch {}
    const sb = sbBrowser(); if (!sb) return;

    const verifica = async () => {
      const { data } = await sb.from("orders").select("id,numar,nume,total")
        .eq("status", "noua").order("created_at", { ascending: false }).limit(10);
      const list = (data ?? []) as Noua[];
      if (!pornit.current) {            // prima rulare: memorăm ce există deja
        list.forEach((o) => stiute.current.add(o.id));
        pornit.current = true; return;
      }
      const proaspete = list.filter((o) => !stiute.current.has(o.id));
      if (proaspete.length) {
        proaspete.forEach((o) => stiute.current.add(o.id));
        setNoi((p) => [...proaspete, ...p].slice(0, 5));
        if (localStorage.getItem("autopas_sunet") !== "off") clopotel();
        document.title = `(${proaspete.length}) Comandă nouă · Autopas`;
      }
    };
    verifica();
    const t = setInterval(verifica, 30000);
    return () => clearInterval(t);
  }, []);

  // sunet scurt generat în browser (fără fișier audio)
  function clopotel() {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      [880, 1175].forEach((hz, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = hz; o.type = "sine";
        g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
        g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.18 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.35);
        o.connect(g); g.connect(ctx.destination);
        o.start(ctx.currentTime + i * 0.18); o.stop(ctx.currentTime + i * 0.18 + 0.4);
      });
    } catch {}
  }

  function inchide(id: number) {
    setNoi((p) => p.filter((o) => o.id !== id));
    document.title = titluInitial.current;
  }

  if (noi.length === 0) return null;
  return (
    <div className="fixed bottom-5 right-5 z-50 space-y-2 w-[300px]">
      {noi.map((o) => (
        <div key={o.id} className="bg-ink text-white rounded-xl shadow-2xl p-4 border border-acc/40 animate-[pulse_1s_ease-in-out_2]">
          <div className="flex items-start gap-2">
            <span className="text-acc text-lg leading-none">●</span>
            <div className="flex-1 min-w-0">
              <b className="block text-sm">Comandă nouă — {o.numar}</b>
              <span className="text-white/70 text-xs">{o.nume} · {Number(o.total).toLocaleString("ro-RO")} lei</span>
            </div>
            <button onClick={() => inchide(o.id)} className="text-white/50 hover:text-white text-lg leading-none">×</button>
          </div>
          <Link href={`/admin/comenzi/${o.id}`} onClick={() => inchide(o.id)}
            className="mt-2.5 block text-center bg-acc rounded-lg py-2 text-sm font-semibold">Deschide comanda</Link>
        </div>
      ))}
      <button onClick={() => { const nou = !sunet; setSunet(nou); localStorage.setItem("autopas_sunet", nou ? "on" : "off"); }}
        className="w-full text-[11px] text-mut hover:text-ink">{sunet ? "🔔 sunet pornit — oprește" : "🔕 sunet oprit — pornește"}</button>
    </div>
  );
}
