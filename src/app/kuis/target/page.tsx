import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { TrackView } from "@/components/TrackView";
import { requireProfile, loadJourney } from "@/lib/session";
import { ensureCvLevel } from "../actions";
import { TargetForm } from "./TargetForm";

// Satu pertanyaan terakhir, kalimatnya mengikuti level dari CV (AC-A5.1–A5.6).
export default async function Target() {
  const profile = await requireProfile();
  const j = await loadJourney(profile);
  if (!j.assessment?.completed_at) redirect("/kuis");
  const level = await ensureCvLevel();
  const entry = level === "entry";
  return (
    <Shell layar="target_karir" back="/kuis">
      <TrackView name="target_view" props={{ level }} />
      <div className="stack">
        <span className="caption">Satu pertanyaan terakhir</span>
        <h1>{entry ? "Pekerjaan seperti apa yang ingin kamu coba cari tahu?" : "Role apa yang ingin kamu capai berikutnya?"}</h1>
        <p className="muted">
          {entry
            ? "Tidak harus nama jabatan. Gambaran kegiatannya saja sudah cukup. Kalau diisi, 3 dari 6 arah karir di petamu akan membahas keinginan ini."
            : "Kalau diisi, 1 dari 6 arah karir di petamu akan membahas role ini, lengkap dengan jarak dan yang perlu disiapkan."}
        </p>
        <TargetForm
          initial={j.target?.text ?? ""}
          examples={entry ? ["Ikut menentukan fitur aplikasi", "Banyak mengolah data", "Merapikan cara kerja tim"] : ["Head of Product", "Finance Manager", "Engineering Manager"]}
          skipLabel={entry ? "Lewati, aku belum kebayang" : "Lewati pertanyaan ini"}
        />
      </div>
    </Shell>
  );
}
