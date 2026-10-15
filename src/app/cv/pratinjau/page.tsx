import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { requireProfile, loadJourney } from "@/lib/session";
import { builtCvToText, type BuiltCv } from "@/lib/cv-text";
import { finishBuilder } from "../actions";

// Pratinjau CV ATS: tanpa area unggah apa pun (AC-M3.1).
export default async function Pratinjau() {
  const profile = await requireProfile();
  if (profile.age_level !== "entry") redirect("/cv/unggah");
  const j = await loadJourney(profile);
  if (j.cv?.source !== "built" || !j.cv.built) redirect("/cv/susun");
  const text = builtCvToText(j.cv.built as BuiltCv);
  const [name, contact, ...rest] = text.split("\n");
  return (
    <Shell layar="pratinjau_cv" back="/cv/susun">
      <div className="stack">
        <div className="stack" style={{ ["--gap" as string]: "6px" }}>
          <h1>CV-mu sudah jadi</h1>
          <p className="muted">Satu kolom, tanpa tabel, ikon, atau foto, jadi aman dibaca sistem penyaring lamaran. Versi PDF-nya bisa kamu unduh setelah Peta Potensimu kebuka.</p>
        </div>
        <article className="card" style={{ fontFamily: "Arial, sans-serif", fontSize: 13, lineHeight: "19px", color: "#111" }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{name}</div>
          <div style={{ color: "#444", marginBottom: 10 }}>{contact}</div>
          {rest.map((line, i) =>
            /^[A-Z ]{4,}$/.test(line) ? (
              <div key={i} style={{ fontWeight: 800, marginTop: 10, borderBottom: "1px solid #ccc" }}>{line}</div>
            ) : (
              <div key={i}>{line}</div>
            ),
          )}
        </article>
        <form action={finishBuilder}>
          <button className="btn btn-primary btn-block">Lanjut ke kuis</button>
        </form>
        <a href="/cv/susun" className="btn btn-ghost">Ubah isian</a>
      </div>
    </Shell>
  );
}
