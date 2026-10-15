"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { track } from "@/components/track";

export function LockedRow({ no, nama, sub, warna, href }: { no: number; nama: string; sub: string; warna: string; href: string }) {
  return (
    <Link href={href} className="lock-row" onClick={() => track("locked_section_click", { bagian: no })}>
      <span className="num" style={{ background: warna }}>{no}</span>
      <div className="grow">
        <h3>{nama}</h3>
        <p className="caption">{sub}</p>
      </div>
      <span aria-label="Terkunci">🔒</span>
    </Link>
  );
}

// Penggoda kartu (AC-06.19, §6.7.2): statis, tidak bisa diklik, MVP.
export function ShareTeaser({ color }: { color: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) {
        track("share_teaser_view");
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className="card row" style={{ alignItems: "center", gap: 14 }} onMouseEnter={() => track("share_teaser_hover")}>
      <div aria-hidden style={{ width: 56, height: 56, borderRadius: 16, background: color, opacity: 0.35, flexShrink: 0, display: "grid", placeItems: "center", fontSize: 26 }}>✦</div>
      <div className="grow">
        <div className="row wrap" style={{ gap: 6 }}>
          <h3>Kartu buat dibagikan</h3>
          <span className="tag tag-gray">Kebuka setelah bayar</span>
          <span className="badge-f2">Fase 2 · di luar MVP</span>
        </div>
        <p className="caption" style={{ marginTop: 4 }}>Satu kartu bergambar maskot dan warna tipemu, lengkap dengan QR, siap diposting ke story.</p>
      </div>
    </div>
  );
}
