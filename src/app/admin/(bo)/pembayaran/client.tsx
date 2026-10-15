"use client";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { confirmOrder, logOpen, proofUrl, rejectOrder, undoDecision } from "../../actions";
import { REJECT_REASONS } from "@/lib/config";
import { rupiah, tanggalJam, ukuranFile } from "@/lib/format";
import type { OrderRow } from "@/lib/admin";

// Daftar terbarui sendiri; bukti baru muncul ≤ 1 menit (BO AC-01.2).
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(t);
  }, [router]);
  return null;
}

// Menyaring tanpa memuat ulang halaman penuh (BO AC-01.4).
export function SearchBox({ initial }: { initial: string }) {
  const [v, setV] = useState(initial);
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  useEffect(() => {
    const t = setTimeout(() => {
      const u = new URLSearchParams(sp.toString());
      if (v) u.set("q", v);
      else u.delete("q");
      u.delete("id");
      router.replace(`${path}?${u.toString()}`);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v]);
  return <input type="text" placeholder="Cari nama, email, atau nomor pesanan" value={v} onChange={(e) => setV(e.target.value)} style={{ maxWidth: 360 }} />;
}

interface DetailData {
  order: OrderRow;
  proofs: { id: string; file_name: string; mime: string; size: number; uploaded_at: string }[];
  dup: boolean;
  deciderName: string | null;
  canUndo: boolean;
  history: { action: string; reason: string | null; at: string; by: string }[];
  dest: string;
}

const ACTION_LABEL: Record<string, string> = { confirm: "Dikonfirmasi", reject: "Ditolak", undo: "Keputusan dibatalkan" };

export function Detail({ d, closeHref }: { d: DetailData; closeHref: string }) {
  const o = d.order;
  const router = useRouter();
  const [amount, setAmount] = useState(o.proof_amount ? String(o.proof_amount) : "");
  const [preview, setPreview] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const amt = Number(amount.replace(/[^\d]/g, "")) || null;
  const diff = amt !== null && amt !== o.amount;
  const [reason, setReason] = useState<string>("");
  const [cs, confirm, p1] = useActionState(confirmOrder, undefined);
  const [rs, reject, p2] = useActionState(rejectOrder, undefined);
  const [us, undo, p3] = useActionState(undoDecision, undefined);
  const latest = d.proofs[0];

  useEffect(() => {
    logOpen(o.id);
  }, [o.id]);

  useEffect(() => {
    if (!latest) return;
    proofUrl(o.id, latest.id).then((r) => setPreview(r.url ?? null));
  }, [o.id, latest]);

  useEffect(() => {
    if (cs?.ok || rs?.ok || us?.ok) router.refresh();
  }, [cs, rs, us, router]);

  // Nominal beda → alasan "Nominal tidak sesuai tagihan" sudah terpilih (BO AC-04.2)
  useEffect(() => {
    if (rejecting && diff && !reason) setReason(REJECT_REASONS[0]);
  }, [rejecting, diff, reason]);

  return (
    <aside className="panel stack" style={{ ["--gap" as string]: "12px", position: "sticky", top: 12 }}>
      <div className="row between"><h2>{o.order_no}</h2><Link href={closeHref} className="chip">Tutup</Link></div>
      <p><b>{o.nickname}</b> · <span className="caption">{o.email}</span></p>

      {latest ? (
        <div className="stack" style={{ ["--gap" as string]: "6px" }}>
          {preview && latest.mime !== "application/pdf" ? (
            <a href={preview} target="_blank" rel="noopener">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Bukti bayar" style={{ width: "100%", maxHeight: 320, objectFit: "contain", background: "#f8fafc", borderRadius: 12 }} />
            </a>
          ) : null}
          <button className="btn btn-secondary" style={{ minHeight: 40 }} onClick={async () => { const r = await proofUrl(o.id, latest.id); if (r.url) window.open(r.url, "_blank", "noopener"); }}>
            Buka ukuran penuh {latest.mime === "application/pdf" ? "(PDF)" : ""}
          </button>
          <span className="caption">{latest.file_name} · {ukuranFile(latest.size)} · diunggah {tanggalJam(latest.uploaded_at)}</span>
          {d.dup ? <p className="error">File yang sama pernah diunggah untuk pesanan lain.</p> : null}
        </div>
      ) : <p className="muted">Belum ada bukti.</p>}

      <dl className="kv">
        <dt>Metode</dt><dd>{o.method === "transfer" ? "Transfer bank" : "QRIS"}</dd>
        <dt>Tujuan bayar</dt><dd>{d.dest}</dd>
        <dt>Tagihan</dt><dd>{rupiah(o.amount)}</dd>
      </dl>

      {o.status === "pending_review" ? (
        <>
          <label className="field">
            Nominal di bukti
            <input type="text" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="25000" />
          </label>
          {diff ? <p className="diff">Selisih {rupiah(Math.abs(amt! - o.amount))} dari tagihan. Cek mutasi dulu sebelum memutuskan.</p> : null}
          <div className="card soft">
            <b>Checklist cek</b>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              <li>Dana sudah masuk di mutasi rekening atau dasbor QRIS</li>
              <li>Nominal sama dengan tagihan</li>
              <li>Tanggal dan nama pengirim masuk akal</li>
            </ul>
          </div>
          {!rejecting ? (
            <div className="row">
              <form action={confirm} className="grow">
                <input type="hidden" name="order_id" value={o.id} />
                <input type="hidden" name="proof_amount" value={amt ?? ""} />
                <button className="btn btn-primary btn-block" disabled={p1}>Konfirmasi pembayaran</button>
              </form>
              <button className="btn btn-secondary" onClick={() => setRejecting(true)}>Tolak</button>
            </div>
          ) : (
            <form action={reject} className="stack" style={{ ["--gap" as string]: "8px" }}>
              <input type="hidden" name="order_id" value={o.id} />
              <input type="hidden" name="proof_amount" value={amt ?? ""} />
              <b>Alasan penolakan</b>
              {REJECT_REASONS.map((r) => (
                <label key={r} className="row" style={{ gap: 8 }}><input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} />{r}</label>
              ))}
              <div className="row">
                <button className="btn btn-primary grow" disabled={!reason || p2}>Kirim penolakan</button>
                <button type="button" className="btn btn-ghost" onClick={() => setRejecting(false)}>Batal</button>
              </div>
            </form>
          )}
          {cs?.error || rs?.error ? <p className="error">{cs?.error ?? rs?.error}</p> : null}
        </>
      ) : (
        <div className="card soft stack" style={{ ["--gap" as string]: "6px" }}>
          <b>{o.status === "confirmed" ? "Terkonfirmasi" : `Ditolak · ${o.reject_reason}`}</b>
          <span className="caption">oleh {d.deciderName ?? "—"} · {tanggalJam(o.decided_at)}</span>
          {o.proof_amount !== null ? <span className="caption">Nominal di bukti {rupiah(o.proof_amount)}</span> : null}
          {d.canUndo ? (
            <form action={undo}>
              <input type="hidden" name="order_id" value={o.id} />
              <button className="btn btn-ghost" disabled={p3}>Batalkan keputusan</button>
            </form>
          ) : null}
          {us?.error ? <p className="error">{us.error}</p> : null}
        </div>
      )}

      {d.history.length ? (
        <div className="stack" style={{ ["--gap" as string]: "4px" }}>
          <b>Riwayat</b>
          {d.history.map((h, i) => (
            <span key={i} className="caption">{tanggalJam(h.at)} · {ACTION_LABEL[h.action] ?? h.action}{h.reason ? ` (${h.reason})` : ""} · {h.by}</span>
          ))}
        </div>
      ) : null}
    </aside>
  );
}
