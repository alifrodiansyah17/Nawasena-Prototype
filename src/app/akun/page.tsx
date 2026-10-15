import { Shell } from "@/components/Shell";
import { requireProfile, loadJourney, nextPath } from "@/lib/session";
import { deleteAccount, deleteFiles } from "./actions";

export default async function Akun({ searchParams }: { searchParams: Promise<{ file?: string; salah?: string }> }) {
  const profile = await requireProfile();
  const j = await loadJourney(profile);
  const sp = await searchParams;
  return (
    <Shell layar="akun" back={nextPath(j)}>
      <div className="stack" style={{ ["--gap" as string]: "18px" }}>
        <h1>Akun dan datamu</h1>
        <div className="card stack" style={{ ["--gap" as string]: "6px" }}>
          <div className="row between"><span className="muted">Panggilan</span><b>{profile.nickname}</b></div>
          <div className="row between"><span className="muted">Email</span><b>{profile.email}</b></div>
          <div className="row between"><span className="muted">WhatsApp</span><b>{profile.whatsapp}</b></div>
        </div>
        <p className="caption">CV, lampiran, dan bukti bayar disimpan privat dan otomatis dihapus 12 bulan setelah diunggah. Nomor WhatsApp hanya untuk kabar soal akun dan pembayaran.</p>
        <form action={deleteFiles} className="card stack" style={{ ["--gap" as string]: "8px" }}>
          <h3>Hapus file CV dan lampiran</h3>
          <p className="muted">Peta Potensimu yang sudah jadi tetap bisa kamu baca.</p>
          {sp.file ? <p className="caption" role="status">File sudah dihapus.</p> : null}
          <button className="btn btn-secondary">Hapus file</button>
        </form>
        <form action={deleteAccount} className="card stack" style={{ ["--gap" as string]: "8px", borderColor: "#fecaca" }}>
          <h3>Hapus akun</h3>
          <p className="muted">Akun, jawaban kuis, Peta Potensimu, dan semua file dihapus permanen. Tulis HAPUS untuk melanjutkan.</p>
          <input type="text" name="konfirmasi" aria-label="Tulis HAPUS" />
          {sp.salah ? <p className="error">Tulis HAPUS persis seperti itu.</p> : null}
          <button className="btn btn-secondary" style={{ color: "var(--danger)", borderColor: "var(--danger)" }}>Hapus akun permanen</button>
        </form>
        <form action="/auth/keluar" method="post"><button className="btn btn-ghost btn-block">Keluar</button></form>
      </div>
    </Shell>
  );
}
