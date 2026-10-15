import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { requireProfile, loadJourney } from "@/lib/session";
import { PAYMENT_METHODS } from "@/lib/config";
import { chooseMethod } from "../actions";

export default async function Metode() {
  const profile = await requireProfile();
  const j = await loadJourney(profile);
  if (j.paid) redirect("/peta");
  const current = j.order?.method ?? "qris";
  return (
    <Shell layar="pilih_cara_bayar" back="/bayar">
      <form action={chooseMethod} className="stack">
        <h1>Mau bayar pakai apa?</h1>
        {PAYMENT_METHODS.map((m) => (
          <button key={m.kode} className={`opt${current === m.kode ? " on" : ""}`} name="method" value={m.kode}>
            <span style={{ fontSize: 24 }} aria-hidden>{m.kode === "qris" ? "📱" : "🏦"}</span>
            <span className="grow"><b>{m.nama}</b><br /><span className="muted">{m.ket}</span></span>
            <span aria-hidden>›</span>
          </button>
        ))}
        <p className="caption">Belum ada pembayaran otomatis. Setelah bayar, kamu unggah bukti bayarnya dan tim kami mengeceknya.</p>
      </form>
    </Shell>
  );
}
