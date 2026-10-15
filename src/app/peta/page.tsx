import Link from "next/link";
import { Shell } from "@/components/Shell";
import { TrackView } from "@/components/TrackView";
import { SECTIONS } from "@/lib/config";
import { requirePaidPeta } from "./guard";
import { PaidPending } from "./PaidPending";

export const maxDuration = 300;

// Daftar isi 6 bagian + unduhan (layar 19, 21). Unduhan berbeda per asal CV (§7.4).
export default async function Peta() {
  const { profile, j, peta } = await requirePaidPeta();
  const built = j.cv?.source === "built";
  return (
    <Shell layar="peta_lengkap">
      <div className="stack" style={{ ["--gap" as string]: "20px" }}>
        <div className="stack" style={{ ["--gap" as string]: "6px" }}>
          <span className="tag tag-ok" style={{ alignSelf: "flex-start" }}>Semua bagian kebuka</span>
          <h1>Peta Potensimu, {profile.nickname}</h1>
          <p className="muted">{peta.archetype.nama} · {peta.free.julukan_sub}</p>
        </div>
        {!peta.paid ? <PaidPending /> : <TrackView name="report_section_view" props={{ bagian: "daftar_isi" }} />}
        <nav className="stack" style={{ ["--gap" as string]: "10px" }} aria-label="Daftar isi">
          {SECTIONS.map((s) => {
            const ready = s.no === 1 || !!peta.paid;
            return ready ? (
              <Link key={s.no} href={`/peta/${s.no}`} className="lock-row">
                <span className="num" style={{ background: s.warna }}>{s.no}</span>
                <div className="grow"><h3>{s.nama}</h3><p className="caption">{s.sub}</p></div>
                <span aria-hidden>›</span>
              </Link>
            ) : (
              <div key={s.no} className="lock-row" style={{ opacity: 0.6 }}>
                <span className="num" style={{ background: s.warna }}>{s.no}</span>
                <div className="grow"><h3>{s.nama}</h3><p className="caption">Sedang disusun</p></div>
              </div>
            );
          })}
        </nav>
        {peta.paid ? (
          <section className="panel soft stack" style={{ ["--gap" as string]: "10px" }}>
            <h2>{built ? "CV dan unduhan" : "Unduhan"}</h2>
            <p className="muted">{built ? "CV rapi + laporan PDF" : "Laporan PDF lengkap"}</p>
            <a className="btn btn-primary" href="/api/unduh/peta">Unduh laporan PDF</a>
            {built ? <a className="btn btn-secondary" href="/api/unduh/cv">Unduh CV</a> : null}
          </section>
        ) : null}
        <a href="/akun" className="btn btn-ghost">Akun dan datamu</a>
      </div>
    </Shell>
  );
}
