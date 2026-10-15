import Link from "next/link";
import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { TrackView } from "@/components/TrackView";
import { HelpCard } from "@/components/Help";
import { requireProfile, loadJourney } from "@/lib/session";
import { PAYMENT } from "@/lib/config";
import { rupiah, tanggalJam } from "@/lib/format";
import { StatusWatcher } from "./StatusWatcher";

export default async function Status() {
  const profile = await requireProfile();
  const j = await loadJourney(profile);
  const o = j.order;
  if (!o) redirect("/bayar");
  if (o.status === "awaiting_payment") redirect("/bayar/kirim");
  const metode = o.method === "transfer" ? "Transfer bank" : "QRIS";
  const ringkas = (
    <div className="card stack" style={{ ["--gap" as string]: "6px" }}>
      <div className="row between"><span className="muted">Nomor pesanan</span><b>{o.order_no}</b></div>
      <div className="row between"><span className="muted">Paket</span><b>Paket Mulai Karir</b></div>
      <div className="row between"><span className="muted">Cara bayar</span><b>{metode}</b></div>
      <div className="row between"><span className="muted">Jumlah</span><b>{rupiah(o.amount)}</b></div>
      {o.status === "confirmed" ? <div className="row between"><span className="muted">Dikonfirmasi</span><b>{tanggalJam(o.decided_at)}</b></div> : null}
    </div>
  );

  return (
    <Shell layar="status_pembayaran" back="/hasil">
      <TrackView name="payment_status_view" props={{ status: o.status }} />
      <StatusWatcher current={o.status} />
      {o.status === "pending_review" ? (
        <div className="stack" style={{ ["--gap" as string]: "18px" }}>
          <div className="stack" style={{ ["--gap" as string]: "6px" }}>
            <h1>Bukti bayarmu sudah masuk</h1>
            <p className="muted">Tim kami sedang mengecek pembayaranmu, {PAYMENT.reviewTarget}. Kabarnya juga dikirim ke {profile.email}.</p>
          </div>
          <ol className="timeline card">
            <li><span className="dot ok">✓</span><span>Bukti bayar terkirim <span className="caption">· {tanggalJam(o.submitted_at)}</span></span></li>
            <li><span className="dot now" /><span><b>Dicek tim Nawasena</b></span></li>
            <li><span className="dot" /><span className="muted">Enam bagian Peta Potensimu kebuka</span></li>
          </ol>
          {ringkas}
          <Link href="/hasil" className="btn btn-secondary">Baca lagi Bagian 1</Link>
          <HelpCard layar="menunggu_dicek" />
        </div>
      ) : o.status === "rejected" ? (
        <div className="stack" style={{ ["--gap" as string]: "18px" }}>
          <div className="stack" style={{ ["--gap" as string]: "6px" }}>
            <h1>Pembayaranmu belum bisa dikonfirmasi</h1>
            <p className="muted">Tenang, pesananmu masih aktif. Kirim ulang bukti bayar, dan tim kami cek lagi.</p>
          </div>
          <div className="card" style={{ borderColor: "#fecaca", background: "#fef2f2" }}>
            <span className="caption" style={{ fontWeight: 800, color: "#991b1b" }}>ALASAN DARI TIM</span>
            <p style={{ fontWeight: 700, color: "var(--ink)" }}>{o.reject_reason}</p>
          </div>
          {ringkas}
          <Link href="/bayar/kirim" className="btn btn-primary btn-block">Kirim ulang bukti bayar</Link>
          <Link href="/hasil" className="btn btn-ghost">Baca lagi Bagian 1</Link>
          <HelpCard layar="pembayaran_ditolak" />
        </div>
      ) : (
        <div className="stack" style={{ ["--gap" as string]: "18px" }}>
          <div className="center stack" style={{ ["--gap" as string]: "8px" }}>
            <div style={{ fontSize: 48 }} aria-hidden>🎉</div>
            <h1>Pembayaranmu sudah terkonfirmasi</h1>
            <p className="muted">Tim kami sudah mengecek pembayaranmu. Enam bagian Peta Potensimu sudah kebuka.</p>
          </div>
          {ringkas}
          <Link href="/peta" className="btn btn-primary btn-block">Baca peta potensimu</Link>
        </div>
      )}
    </Shell>
  );
}
