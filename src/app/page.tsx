import Link from "next/link";
import { redirect } from "next/navigation";
import { HelpCard } from "@/components/Help";
import { Shell } from "@/components/Shell";
import { TrackView } from "@/components/TrackView";
import { currentUser, ensureProfile, loadJourney, nextPath } from "@/lib/session";
import { PRICE_IDR } from "@/lib/config";
import { rupiah } from "@/lib/format";

export default async function Landing() {
  const user = await currentUser();
  if (user) {
    const profile = await ensureProfile(user);
    if (profile) redirect(nextPath(await loadJourney(profile)));
  }
  return (
    <Shell layar="landing">
      <TrackView name="landing_view" />
      <div className="stack" style={{ ["--gap" as string]: "24px" }}>
        <section className="stack" style={{ ["--gap" as string]: "12px" }}>
          <span className="tag tag-sky">Buat kamu yang mau meraih masa depanmu</span>
          <h1 className="display">Kenali potensimu, raih masa depanmu</h1>
          <p className="muted" style={{ fontSize: 16, lineHeight: "24px" }}>
            Hal-hal yang selama ini kamu kira biasa saja, ternyata justru yang bikin kamu beda. Kami bantu kamu
            melihatnya, lalu menerjemahkannya jadi arah karir dan CV yang siap dipakai melamar.
          </p>
          <Link href="/daftar" className="btn btn-primary btn-block">
            Raih masa depanmu di sini
          </Link>
          <p className="center">
            Udah punya akun? <Link href="/masuk">Login di sini</Link>
          </p>
        </section>

        <section className="stack" style={{ ["--gap" as string]: "10px" }}>
          <h2>Empat langkah, kelar hari ini juga</h2>
          {[
            ["1", "Kenalan dulu", "Panggilan kamu, tanggal lahir, dan kontak."],
            ["2", "Kirim CV terbaikmu", "Belum punya CV? Kami bantu rapiin dari nol, ramah sistem penyaring lamaran."],
            ["3", "Isi kuis singkat", "Pilih yang paling sesuai sama kamu. Nggak ada jawaban yang salah."],
            ["4", "Baca Peta Potensimu", "Bagian pertama langsung kebuka gratis."],
          ].map(([n, t, d]) => (
            <div key={n} className="pcard">
              <span className="num" style={{ background: "var(--sky)" }}>{n}</span>
              <div>
                <h3>{t}</h3>
                <p className="muted">{d}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="panel soft stack" style={{ ["--gap" as string]: "8px" }}>
          <h2>Yang kamu bawa pulang</h2>
          <p>Siapa kamu waktu bekerja, tipe karirmu, cara menceritakan dirimu di wawancara, catatan untuk CV-mu, enam arah karir lengkap dengan kisaran gaji, dan langkah yang bisa kamu kerjakan minggu ini.</p>
          <p className="caption">Bagian pertama gratis. Semuanya {rupiah(PRICE_IDR)}, sekali bayar.</p>
        </section>

        <HelpCard layar="landing" />
        <p className="caption center">
          CV dan jawabanmu hanya dipakai untuk analisis kamu sendiri. Tidak dibagikan ke perusahaan mana pun dan tidak dipakai untuk melatih model.
        </p>
      </div>
    </Shell>
  );
}
