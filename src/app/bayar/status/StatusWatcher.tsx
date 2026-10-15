"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function StatusWatcher({ current }: { current: string }) {
  const router = useRouter();
  useEffect(() => {
    if (current === "confirmed") return;
    const t = setInterval(async () => {
      try {
        const r = await fetch("/api/bayar/status", { cache: "no-store" });
        const d = (await r.json()) as { status: string | null };
        if (d.status && d.status !== current) router.refresh();
      } catch {
        /* coba lagi di putaran berikutnya */
      }
    }, 8000);
    return () => clearInterval(t);
  }, [current, router]);
  return null;
}
