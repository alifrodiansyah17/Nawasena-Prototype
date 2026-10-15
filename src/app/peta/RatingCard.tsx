"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { IMPROVE_CHIPS, STAR_WORDS } from "@/lib/config";
import { track } from "@/components/track";
import { rateStars, submitRating } from "./actions";

type Saved = { stars: number; chips: string[]; text: string | null; locked: boolean } | null;

// Kartu penilaian tiga lapis (§6.6, US-05). Terpisah dari kartu kebutuhan.
export function RatingCard({ saved }: { saved: Saved }) {
  const [stars, setStars] = useState(saved?.stars ?? 0);
  const [chips, setChips] = useState<string[]>(saved?.chips ?? []);
  const [text, setText] = useState("");
  const [locked, setLocked] = useState(!!saved?.locked);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) {
        track("rating_card_view");
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  function pick(n: number) {
    if (locked) return;
    setStars(n);
    start(async () => { await rateStars(n); }); // terkirim langsung (AC-05.6)
  }

  if (locked) {
    return (
      <section ref={ref} className="panel stack" style={{ ["--gap" as string]: "6px" }}>
        <h2>Makasih atas penilaianmu</h2>
        <div className="stars" aria-label={`${stars} dari 5 bintang`}>
          {[1, 2, 3, 4, 5].map((n) => <button key={n} disabled className={n <= stars ? "on" : ""} aria-hidden>★</button>)}
        </div>
        <p className="muted">Masukanmu dibaca tim tiap minggu. Bagian yang paling sering dipilih untuk dibenahi jadi prioritas perbaikan bulan berikutnya.</p>
      </section>
    );
  }

  return (
    <section ref={ref} className="panel stack" style={{ ["--gap" as string]: "12px" }}>
      <h2>Seberapa pas petamu buat kamu?</h2>
      <div className="stars" role="radiogroup" aria-label="Nilai 1 sampai 5 bintang">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} role="radio" aria-checked={stars === n} aria-label={`${n} bintang · ${STAR_WORDS[n]}`} className={n <= stars ? "on" : ""} onClick={() => pick(n)}>★</button>
        ))}
      </div>
      {stars ? <p style={{ fontWeight: 700, color: "var(--ink)" }}>{STAR_WORDS[stars]}</p> : null}
      {stars ? (
        <>
          <span className="caption">Apa yang paling perlu dibenahi? Boleh lebih dari satu, boleh juga dikosongkan.</span>
          <div className="row wrap">
            {IMPROVE_CHIPS.map((c) => {
              const on = chips.includes(c);
              return <button key={c} type="button" className={`chip${on ? " on" : ""}`} aria-pressed={on} onClick={() => setChips(on ? chips.filter((x) => x !== c) : [...chips, c])}>{c}</button>;
            })}
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Ada masukan lain? (opsional)" rows={3} />
          <button className="btn btn-primary btn-block" disabled={pending} onClick={() => start(async () => { await submitRating({ chips, text }); setLocked(true); })}>Kirim penilaian</button>
        </>
      ) : null}
    </section>
  );
}
