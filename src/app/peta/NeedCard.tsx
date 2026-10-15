"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { NEEDS, PRICE_VOTES, SERVICES } from "@/lib/config";
import { track } from "@/components/track";
import { submitNeed, submitWish, trackNeed } from "./actions";

type Saved = { need: string; tier: string | null; wish: string | null; wish_skipped: boolean | null } | null;

// Kartu kebutuhan lanjutan (§6.5, US-04). Bukan pop-up, di ujung Bagian 6.
export function NeedCard({ saved }: { saved: Saved }) {
  const [need, setNeed] = useState<string | null>(saved?.need ?? null);
  const [tier, setTier] = useState<string | null>(saved?.tier ?? null);
  const [vote, setVote] = useState<string | null>(null);
  const [stage, setStage] = useState<"pick" | "offer" | "wish" | "done">(
    saved ? (saved.wish !== null || saved.wish_skipped !== null ? "done" : "wish") : "pick",
  );
  const [wish, setWish] = useState("");
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  // need_card_view begitu kartu masuk viewport (AC-04.9)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) {
        track("need_card_view");
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (stage === "wish") track("need_wish_view");
  }, [stage]);

  const chosen = NEEDS.find((n) => n.kode === need);
  const svc = chosen?.layanan ? SERVICES[chosen.layanan] : null;

  function choose(kode: string) {
    setNeed(kode);
    setTier(null);
    setVote(null);
    start(() => trackNeed("need_selected", { kebutuhan: kode }));
  }

  function toOffer() {
    if (!chosen) return;
    if (chosen.kode === "cukup") {
      // Tidak ada tawaran untuk "segini dulu cukup" (AC-04.11)
      start(async () => {
        await submitNeed({ need: "cukup" });
        setStage("wish");
      });
      return;
    }
    setStage("offer");
    start(() => trackNeed("need_offer_view", { kebutuhan: chosen.kode, layanan: chosen.layanan }));
  }

  function sendOffer() {
    start(async () => {
      await submitNeed({ need: need!, tier, price_vote: vote });
      setStage("wish");
    });
  }

  function sendWish(text: string | null) {
    start(async () => {
      await submitWish(text);
      setStage("done");
    });
  }

  return (
    <section ref={ref} className="panel stack" style={{ ["--gap" as string]: "12px", borderColor: "#bae6fd" }} aria-live="polite">
      {stage === "pick" && (
        <>
          <h2>Setelah membaca petamu, apa yang paling kamu butuhkan sekarang?</h2>
          <p className="caption">Pilih satu.</p>
          {NEEDS.map((n) => (
            <button key={n.kode} type="button" className={`opt${need === n.kode ? " on" : ""}`} onClick={() => choose(n.kode)} aria-pressed={need === n.kode}>
              {n.pilih}
            </button>
          ))}
          <button className="btn btn-primary btn-block" disabled={!need || pending} onClick={toOffer}>Lanjut</button>
        </>
      )}

      {stage === "offer" && chosen && svc && (
        <>
          <p className="muted">{chosen.kenapa}</p>
          <div className="row between wrap">
            <h2>{svc.nama}</h2>
            <span className="tag tag-gray">Belum tersedia</span>
          </div>
          <p>{svc.apa}</p>
          {"tiers" in svc ? (
            <div className="stack" style={{ ["--gap" as string]: "10px" }}>
              {svc.tiers.map((t) => (
                <button key={t.kode} type="button" className={`opt${tier === t.kode ? " on" : ""}`} style={{ flexDirection: "column", alignItems: "flex-start" }} onClick={() => { setTier(t.kode); start(() => trackNeed("need_tier_pick", { tier: t.kode })); }} aria-pressed={tier === t.kode}>
                  <div className="row between" style={{ width: "100%" }}><b>{t.nama}</b><b>{t.harga} <span className="caption">{t.satuan}</span></b></div>
                  <span className="caption">{t.ringkas}</span>
                  <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>{t.isi.map((x) => <li key={x}>{x}</li>)}</ul>
                </button>
              ))}
            </div>
          ) : (
            <>
              <dl className="kv">{svc.detail.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
              <div className="row between"><span className="muted">Harga yang sedang kami uji</span><b>{svc.harga}</b></div>
            </>
          )}
          <div className="stack" style={{ ["--gap" as string]: "6px" }}>
            <span className="caption">Menurutmu harganya? (opsional)</span>
            <div className="row wrap">
              {PRICE_VOTES.map((v) => (
                <button key={v} type="button" className={`chip${vote === v ? " on" : ""}`} onClick={() => { setVote(v); start(() => trackNeed("need_price_vote", { nilai: v })); }}>{v}</button>
              ))}
            </div>
          </div>
          <button className="btn btn-primary btn-block" disabled={pending || ("tiers" in svc && !tier)} onClick={sendOffer}>Kabari aku kalau sudah ada</button>
          <p className="caption">Datamu hanya dipakai untuk mengabarimu waktu layanan ini siap.</p>
          <button type="button" className="btn btn-ghost" onClick={() => setStage("pick")} disabled={pending}>Ganti jawaban</button>
        </>
      )}

      {stage === "wish" && (
        <>
          <h2>Apa lagi yang kamu mau kami sediain buat bantu kamu lebih jauh?</h2>
          <textarea value={wish} onChange={(e) => setWish(e.target.value)} placeholder="Tulis apa saja" rows={3} />
          <button className="btn btn-primary btn-block" disabled={pending || !wish.trim()} onClick={() => sendWish(wish.trim())}>Kirim</button>
          <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => sendWish(null)}>Nggak ada, lewati aja</button>
        </>
      )}

      {stage === "done" && (
        <div className="stack" style={{ ["--gap" as string]: "6px" }}>
          <h2>Makasih, sudah tersimpan</h2>
          {chosen?.kode === "cukup" || !svc ? (
            <p className="muted">Jawabanmu tetap berguna: dari situ kami tahu bagian mana dari petamu yang sudah cukup menjawab, jadi kami tidak menambah hal yang tidak perlu.</p>
          ) : (
            <p className="muted">Begitu {svc.nama}{tier && "tiers" in svc ? ` (${svc.tiers.find((t) => t.kode === tier)?.nama})` : ""} siap, kamu orang pertama yang kami kabari lewat email dan WhatsApp.</p>
          )}
        </div>
      )}
    </section>
  );
}
