import { Shell } from "@/components/Shell";
import { requireProfile, loadJourney } from "@/lib/session";
import { UploadCv } from "./UploadCv";

export default async function UnggahCv() {
  const profile = await requireProfile();
  const j = await loadJourney(profile);
  const existing = j.cv?.source === "uploaded" && j.cv.file_name ? j.cv.file_name : null;
  // Kembali: entry → "Sudah punya CV?", mid/senior → verifikasi email (AC-E2.5, AC-M1.4)
  const back = profile.age_level === "entry" ? "/cv" : "/daftar/cek-email";
  return (
    <Shell layar="unggah_cv" back={back}>
      <div className="stack">
        <div className="stack" style={{ ["--gap" as string]: "6px" }}>
          <h1>Kirim CV terbaikmu</h1>
          <p className="muted">PDF, DOC, atau DOCX, maksimal 5 MB.</p>
        </div>
        <UploadCv existing={existing} />
        <p className="caption">
          CV-mu hanya dipakai untuk analisis kamu sendiri. Tidak dibagikan ke perusahaan atau pihak ketiga mana pun, dan tidak dipakai untuk melatih model.
        </p>
      </div>
    </Shell>
  );
}
