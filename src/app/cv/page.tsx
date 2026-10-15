import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { TrackView } from "@/components/TrackView";
import { requireProfile } from "@/lib/session";
import { chooseCvBranch } from "./actions";

// Layar "Sudah punya CV belum?" hanya untuk entry (AC-E1.4, AC-M1.2).
export default async function CekCv() {
  const profile = await requireProfile();
  if (profile.age_level !== "entry") redirect("/cv/unggah");
  return (
    <Shell layar="cek_cv">
      <TrackView name="cv_branch_shown" />
      <form action={chooseCvBranch} className="stack">
        <div className="stack" style={{ ["--gap" as string]: "6px" }}>
          <h1>Halo {profile.nickname}, sudah punya CV belum?</h1>
          <p className="muted">Dua-duanya oke. Kalau belum, kami bantu menyusunnya dari nol.</p>
        </div>
        <button className="opt" name="choice" value="sudah">
          <span style={{ fontSize: 24 }} aria-hidden>📄</span>
          <span><b>Sudah punya</b><br /><span className="muted">Tinggal unggah</span></span>
        </button>
        <button className="opt" name="choice" value="belum">
          <span style={{ fontSize: 24 }} aria-hidden>✍️</span>
          <span><b>Belum punya</b><br /><span className="muted">CV kamu, kami bantu rapiin</span></span>
        </button>
      </form>
    </Shell>
  );
}
