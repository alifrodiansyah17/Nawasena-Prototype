import Link from "next/link";
import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { TrackView } from "@/components/TrackView";
import { Bagian1 } from "@/components/report/Sections";
import { requireProfile, loadJourney } from "@/lib/session";
import { loadPeta } from "@/lib/peta";
import { SECTIONS } from "@/lib/config";
import { LockedRow, ShareTeaser } from "./client";

// Hasil gratis: Bagian 1 terbuka penuh, Bagian 2–6 terlihat tapi terkunci (AC-A2.1, AC-A2.2).
export default async function Hasil() {
  const profile = await requireProfile();
  const j = await loadJourney(profile);
  if (j.paid) redirect("/peta");
  const peta = await loadPeta(j);
  if (!peta) redirect("/analisis");
  const waiting = j.order && ["pending_review", "rejected"].includes(j.order.status);
  const cta = waiting ? { href: "/bayar/status", label: "Lihat status pembayaran" } : { href: "/bayar", label: "Raih karirmu sekarang" };
  const props = { target_terisi: !!peta.target };
  return (
    <Shell layar="hasil_gratis">
      <TrackView name="result_free_view" props={props} />
      <div className="stack" style={{ ["--gap" as string]: "28px" }}>
        <Bagian1 peta={peta} nickname={profile.nickname} />

        <ShareTeaser color={peta.archetype.warna} />

        <section className="stack" style={{ ["--gap" as string]: "10px" }}>
          <h2>Lima bagian lagi buat kamu</h2>
          {SECTIONS.slice(1).map((s) => (
            <LockedRow key={s.no} no={s.no} nama={s.nama} sub={s.sub} warna={s.warna} href={cta.href} />
          ))}
        </section>

        <div className="stack" style={{ ["--gap" as string]: "8px", position: "sticky", bottom: 12 }}>
          <Link href={cta.href} className="btn btn-primary btn-block" style={{ boxShadow: "0 8px 24px rgba(15,23,42,.15)" }}>{cta.label}</Link>
        </div>
        <Link href="/akun" className="btn btn-ghost">Akun dan datamu</Link>
      </div>
    </Shell>
  );
}
