"use client";
import { useState, useTransition } from "react";
import { goToPage, savePage } from "./actions";
import { PAGE_COUNT, PER_PAGE, SCALE } from "@/lib/quiz";

const ICONS = ["🔎", "✨", "🛠️", "✅", "🤝", "🌦️"];

export function Quiz({ items, pages, initialAnswers, initialPage }: { items: string[]; pages: { judul: string; warna: string }[]; initialAnswers: (number | null)[]; initialPage: number }) {
  const [answers, setAnswers] = useState(initialAnswers);
  const [page, setPage] = useState(Math.min(Math.max(initialPage, 0), PAGE_COUNT - 1));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const idx = Array.from({ length: PER_PAGE }, (_, i) => page * PER_PAGE + i);
  const pageDone = idx.every((i) => answers[i] !== null);
  const color = pages[page].warna;

  function pick(i: number, v: number) {
    const next = [...answers];
    next[i] = v;
    setAnswers(next);
  }

  function next() {
    setError(null);
    start(async () => {
      const res = await savePage(page, idx.map((i) => answers[i] as number));
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setPage(page + 1);
      window.scrollTo({ top: 0 });
    });
  }

  function back() {
    const p = page - 1;
    setPage(p);
    start(() => goToPage(p));
    window.scrollTo({ top: 0 });
  }

  return (
    <div className="stack">
      <div className="stack" style={{ ["--gap" as string]: "8px" }}>
        <span className="caption">Halaman {page + 1} dari {PAGE_COUNT}</span>
        <div className="progress" aria-hidden><i style={{ width: `${((page + (pageDone ? 1 : 0)) / PAGE_COUNT) * 100}%` }} /></div>
        <h1>{pages[page].judul}</h1>
        <p className="muted">Pilih yang paling sesuai sama kamu.</p>
      </div>
      {idx.map((i) => (
        <fieldset key={i} className={`q${answers[i] !== null ? " done" : ""}`} style={{ border: undefined, margin: 0 }}>
          <legend className="qt" style={{ padding: 0, float: "left", width: "100%" }}>
            <span className="badge" style={{ background: color }} aria-hidden>{ICONS[page]}</span>
            <span>{items[i]}</span>
          </legend>
          <div style={{ clear: "both" }} />
          <div className="scale" role="radiogroup" aria-label={items[i]}>
            {[1, 2, 3, 4].map((v) => {
              const on = answers[i] === v;
              return (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={SCALE[v - 1]}
                  onClick={() => pick(i, v)}
                  style={on ? { background: color, borderColor: color } : undefined}
                >
                  {on ? "✓" : ""}
                </button>
              );
            })}
          </div>
          <div className="scale-labels" aria-hidden><span>{SCALE[0]}</span><span>{SCALE[3]}</span></div>
        </fieldset>
      ))}
      {error ? <p className="error" role="alert">{error}</p> : null}
      <button className="btn btn-primary btn-block" disabled={!pageDone || pending} onClick={next}>
        {pending ? "Menyimpan..." : page === PAGE_COUNT - 1 ? "Selesai" : "Lanjut"}
      </button>
      {page > 0 ? <button className="btn btn-ghost" onClick={back} disabled={pending}>Halaman sebelumnya</button> : null}
    </div>
  );
}
