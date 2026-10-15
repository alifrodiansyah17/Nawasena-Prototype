import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { requireProfile, loadJourney } from "@/lib/session";
import { AttachmentForm } from "./AttachmentForm";

// Halaman lampiran tersendiri, judul menyesuaikan level (AC-M2.3).
export default async function Lampiran() {
  const profile = await requireProfile();
  const j = await loadJourney(profile);
  if (!j.cv || j.cv.source !== "uploaded") redirect("/cv/unggah");
  const entry = profile.age_level === "entry";
  return (
    <Shell layar="lampiran" back="/cv/unggah">
      <div className="stack">
        <div className="stack" style={{ ["--gap" as string]: "6px" }}>
          <h1>{entry ? "Ada transkrip atau sertifikat?" : "Ada contoh hasil kerjamu?"}</h1>
          <p className="muted">
            Opsional. {entry ? "Transkrip atau sertifikat" : "Contoh hasil kerja"} membantu kami membaca bekalmu lebih lengkap waktu menyusun arah karir.
          </p>
        </div>
        <AttachmentForm />
      </div>
    </Shell>
  );
}
