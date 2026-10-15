import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { HelpCard } from "@/components/Help";
import { requireProfile, loadJourney } from "@/lib/session";
import { PAYMENT } from "@/lib/config";
import { rupiah, tanggalJam } from "@/lib/format";
import { CopyButton, ProofForm } from "./client";

// Satu layar, dua langkah: tujuan bayar, lalu unggah bukti (§6.1 layar 17b).
export default async function Kirim() {
  const profile = await requireProfile();
  const j = await loadJourney(profile);
  if (j.paid) redirect("/peta");
  const o = j.order;
  if (!o) redirect("/bayar/metode");
  if (o.status === "pending_review") redirect("/bayar/status");
  const qris = o.method !== "transfer";
  return (
    <Shell layar="bayar_unggah_bukti" back="/bayar/metode">
      <div className="stack" style={{ ["--gap" as string]: "18px" }}>
        <div className="stack" style={{ ["--gap" as string]: "6px" }}>
          <h1>{qris ? "Bayar pakai QRIS" : "Transfer ke rekening Nawasena"}</h1>
          <p className="muted">Pesanan {o.order_no} · bayar sebelum {tanggalJam(o.expires_at)}</p>
        </div>
        <section className="panel stack" style={{ ["--gap" as string]: "12px" }}>
          <span className="tag tag-sky">Langkah 1 · Bayar</span>
          <div className="row between"><span>Total</span><b className="display" style={{ fontSize: 24 }}>{rupiah(o.amount)}</b></div>
          {qris ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={PAYMENT.qrisImage} alt="Kode QRIS Nawasena" style={{ width: 240, maxWidth: "100%", alignSelf: "center", borderRadius: 12 }} />
              <p className="center caption">{PAYMENT.qrisMerchant} · NMID {PAYMENT.qrisNmid}</p>
              <a className="btn btn-secondary" href={PAYMENT.qrisImage} download="QRIS-Nawasena">Simpan gambar QR</a>
            </>
          ) : (
            <div className="stack" style={{ ["--gap" as string]: "8px" }}>
              <div className="row between"><span className="muted">Bank</span><b>{PAYMENT.bankName}</b></div>
              <div className="row between"><span className="muted">Nomor rekening</span><span className="row"><b>{PAYMENT.bankAccount}</b><CopyButton text={PAYMENT.bankAccount} /></span></div>
              <div className="row between"><span className="muted">Atas nama</span><b>{PAYMENT.bankHolder}</b></div>
            </div>
          )}
          <p className="sorot">Bayar persis {rupiah(o.amount)} ya, supaya cepat dicocokkan.</p>
        </section>
        {o.status === "rejected" && o.reject_reason ? (
          <p className="card" style={{ borderColor: "#fecaca", background: "#fef2f2" }}>Bukti sebelumnya belum bisa dikonfirmasi: <b>{o.reject_reason}</b>.</p>
        ) : null}
        <section className="panel stack" style={{ ["--gap" as string]: "12px" }}>
          <span className="tag tag-sky">Langkah 2 · Unggah bukti bayar</span>
          <ProofForm />
        </section>
        <HelpCard layar="pembayaran" />
      </div>
    </Shell>
  );
}
