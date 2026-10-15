"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ensurePaidReport } from "./actions";

// Bagian 2–6 biasanya sudah siap sejak hasil gratis. Kalau belum, susun dan tunggu.
export function PaidPending() {
  const router = useRouter();
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const r = await ensurePaidReport();
      if (!alive) return;
      if (r.status === "ready") router.refresh();
      else setTimeout(tick, 6000);
    };
    tick();
    return () => { alive = false; };
  }, [router]);
  return (
    <div className="card soft row" role="status">
      <div className="spinner" style={{ width: 28, height: 28, borderWidth: 4 }} aria-hidden />
      <p>Bagian 2–6 sedang kami susun. Biasanya selesai dalam satu sampai dua menit, halaman ini akan terbarui sendiri.</p>
    </div>
  );
}
