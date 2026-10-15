import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { requireProfile, loadJourney } from "@/lib/session";
import { startQuiz } from "../actions";

export default async function IntroKuis() {
  const profile = await requireProfile();
  const j = await loadJourney(profile);
  if (j.assessment?.completed_at) redirect("/kuis/target");
  return (
    <Shell layar="intro_kuis">
      <form action={startQuiz} className="stack center" style={{ ["--gap" as string]: "16px", paddingTop: 16 }}>
        <div style={{ fontSize: 48 }} aria-hidden>🧭</div>
        <h1>Sekarang kenalan sama cara kerjamu</h1>
        <p className="muted">
          Ada beberapa kalimat tentang kebiasaan sehari-hari. Pilih seberapa kalimat itu kamu banget. Nggak ada jawaban yang salah.
        </p>
        <div className="card soft" style={{ textAlign: "left" }}>
          <p><b>10 menit</b> · selesai!</p>
          <p className="caption">Jawabanmu tersimpan per halaman, jadi kamu bisa lanjut kapan saja.</p>
        </div>
        <button className="btn btn-primary btn-block">{j.assessment ? "Lanjut kuis" : "Mulai"}</button>
      </form>
    </Shell>
  );
}
