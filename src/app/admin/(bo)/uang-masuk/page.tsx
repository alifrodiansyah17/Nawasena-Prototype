import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { periodStart, revenueRows } from "@/lib/revenue";
import { rupiah, tanggalJam } from "@/lib/format";

const PERIODS = [
  { kode: "hari", label: "Hari ini" },
  { kode: "7hari", label: "7 hari terakhir" },
  { kode: "bulan", label: "Bulan berjalan" },
];

const dayKey = (iso: string) => new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(0, 10);

export default async function UangMasuk({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  const admin = await requireAdmin();
  const periode = (await searchParams).periode;
  const kode = PERIODS.some((p) => p.kode === periode) ? periode! : "7hari";
  const rows = await revenueRows(kode);
  const total = rows.reduce((s, r) => s + r.nominal, 0);
  const qris = rows.filter((r) => r.method === "qris").reduce((s, r) => s + r.nominal, 0);
  const transfer = rows.filter((r) => r.method === "transfer").reduce((s, r) => s + r.nominal, 0);

  // Satu batang per tanggal; jumlah batang = total (BO AC-06.2)
  const start = periodStart(kode);
  const days: { key: string; label: string; sum: number; n: number }[] = [];
  for (let d = new Date(start); d <= new Date(); d = new Date(d.getTime() + 86400_000)) {
    const key = dayKey(d.toISOString());
    if (days.some((x) => x.key === key)) continue;
    days.push({ key, label: key.slice(8, 10) + "/" + key.slice(5, 7), sum: 0, n: 0 });
  }
  rows.forEach((r) => {
    const day = days.find((d) => d.key === dayKey(r.decided_at!));
    if (day) { day.sum += r.nominal; day.n += 1; }
  });
  const max = Math.max(1, ...days.map((d) => d.sum));

  return (
    <div className="stack" style={{ ["--gap" as string]: "18px" }}>
      <div className="row between">
        <h1>Uang masuk</h1>
        <div className="row">
          {PERIODS.map((p) => <Link key={p.kode} href={`/admin/uang-masuk?periode=${p.kode}`} className={`chip${p.kode === kode ? " on" : ""}`}>{p.label}</Link>)}
          {admin.role === "owner" ? <a className="btn btn-secondary" style={{ minHeight: 40 }} href={`/api/admin/csv?periode=${kode}`}>Unduh CSV</a> : null}
        </div>
      </div>
      <div className="kpis">
        <div className="kpi"><span className="caption">Total uang masuk</span><b>{rupiah(total)}</b></div>
        <div className="kpi"><span className="caption">Pembayaran dikonfirmasi</span><b>{rows.length}</b></div>
        <div className="kpi"><span className="caption">Lewat QRIS</span><b>{rupiah(qris)}</b></div>
        <div className="kpi"><span className="caption">Lewat transfer</span><b>{rupiah(transfer)}</b></div>
      </div>
      <div className="panel">
        <h3>Per hari</h3>
        <div className="bars">
          {days.map((d) => (
            <div key={d.key} className="bar" title={`${d.label}: ${rupiah(d.sum)} · ${d.n} pembayaran`}>
              <span>{d.n || ""}</span>
              <i style={{ height: `${(d.sum / max) * 120}px` }} />
              <span>{d.label}</span>
            </div>
          ))}
        </div>
      </div>
      <table>
        <thead><tr><th>Dikonfirmasi</th><th>Pesanan</th><th>Pengguna</th><th>Metode</th><th>Nominal</th><th>Admin</th></tr></thead>
        <tbody>
          {rows.length === 0 ? <tr><td colSpan={6} className="muted">Belum ada pembayaran terkonfirmasi di periode ini.</td></tr> : null}
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{tanggalJam(r.decided_at)}</td>
              <td>{r.order_no}</td>
              <td><b>{r.nickname}</b><br /><span className="caption">{r.email}</span></td>
              <td>{r.method === "transfer" ? "Transfer" : "QRIS"}</td>
              <td>{rupiah(r.nominal)}</td>
              <td>{r.adminName}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
