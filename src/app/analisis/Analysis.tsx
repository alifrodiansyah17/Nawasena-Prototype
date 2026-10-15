"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { runAnalysis } from "../kuis/actions";

const STAGES = ["Membaca CV-mu", "Menghitung jawaban kuismu", "Mencocokkan polanya", "Menyusun bagian pertama petamu"];

// Progres bertahap selama analisis berjalan (§8).
export function Analysis({ nickname }: { nickname: string }) {
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const router = useRouter();

  async function go() {
    setError(null);
    const res = await runAnalysis();
    if (res.status === "ready") router.replace("/hasil");
    else setError(res.message ?? "Belum berhasil.");
  }

  useEffect(() => {
    const t = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 3500);
    if (!started.current) {
      started.current = true;
      go();
    }
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="stack center" style={{ ["--gap" as string]: "20px", paddingTop: 40, alignItems: "center" }}>
      {!error ? <div className="spinner" aria-hidden /> : <div style={{ fontSize: 40 }} aria-hidden>😕</div>}
      <h1>{error ? "Ada yang tersendat" : `Sebentar ya, ${nickname}`}</h1>
      {error ? (
        <>
          <p className="muted">{error}</p>
          <button className="btn btn-primary btn-block" onClick={go}>Coba lagi</button>
        </>
      ) : (
        <ul className="timeline" aria-live="polite" style={{ textAlign: "left" }}>
          {STAGES.map((s, i) => (
            <li key={s}>
              <span className={`dot${i < stage ? " ok" : i === stage ? " now" : ""}`}>{i < stage ? "✓" : ""}</span>
              <span style={{ color: i <= stage ? "var(--ink)" : "var(--caption)" }}>{s}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
