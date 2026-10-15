import Link from "next/link";
import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { TrackView } from "@/components/TrackView";
import { HelpCard } from "@/components/Help";
import { requireProfile, loadJourney } from "@/lib/session";
import { PRICE_IDR, SECTIONS } from "@/lib/config";
import { rupiah } from "@/lib/format";

// Paywall (AC-A2.3)
export default async function Paywall() {
  const profile = await requireProfile();
  const j = await loadJourney(profile);
  if (j.paid) redirect("/peta");
  if (j.order && ["pending_review", "rejected"].includes(j.order.status)) redirect("/bayar/status");
  const built = j.cv?.source === "built";
  return (
    <Shell layar="paywall" back="/hasil">
      <TrackView name="paywall_view" />
      <div className="stack" style={{ ["--gap" as string]: "18px" }}>
        <div className="stack" style={{ ["--gap" as string]: "6px" }}>
          <h1>Raih karirmu sekarang</h1>
          <p className="muted">Bagian 1 sudah kamu baca. Ini yang kebuka setelah pembayaranmu dikonfirmasi tim.</p>
        </div>
        <div className="card stack" style={{ ["--gap" as string]: "10px" }}>
          {SECTIONS.slice(1).map((s) => (
            <div key={s.no} className="row" style={{ alignItems: "flex-start" }}>
              <span className="num" style={{ background: s.warna }}>{s.no}</span>
              <div><b>{s.nama}</b><p className="caption">{s.sub}</p></div>
            </div>
          ))}
          <div className="row" style={{ alignItems: "flex-start" }}>
            <span className="num" style={{ background: "var(--success)" }}>↓</span>
            <div><b>{built ? "CV rapi + Peta Potensimu PDF" : "Peta Potensimu PDF lengkap"}</b><p className="caption">Bisa diunduh dan dibaca ulang kapan saja</p></div>
          </div>
        </div>
        <div className="panel soft row between">
          <div><span className="caption">Sekali bayar</span><div className="display" style={{ fontSize: 28 }}>{rupiah(PRICE_IDR)}</div></div>
          <span className="tag tag-ok">QRIS atau transfer</span>
        </div>
        <Link href="/bayar/metode" className="btn btn-primary btn-block">Lanjut ke pembayaran</Link>
        <Link href="/hasil" className="btn btn-ghost">Baca lagi Bagian 1</Link>
        <HelpCard layar="paywall" />
      </div>
    </Shell>
  );
}
