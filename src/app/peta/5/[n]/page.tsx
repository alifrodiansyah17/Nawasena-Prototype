import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { TrackView } from "@/components/TrackView";
import { ArahDetail } from "@/components/report/Sections";
import { requirePaidPeta } from "../../guard";

export default async function ArahPage({ params }: { params: Promise<{ n: string }> }) {
  const n = Number((await params).n);
  const { peta } = await requirePaidPeta();
  if (!peta.paid) redirect("/peta");
  const a = peta.arah.find((x) => x.no === n);
  if (!a) notFound();
  return (
    <Shell layar="detail_arah" back="/peta/5">
      <TrackView name="role_detail_view" props={{ arah: n, role: a.role.id }} />
      <div className="stack" style={{ ["--gap" as string]: "24px" }}>
        <ArahDetail a={a} />
        <div className="row between">
          {n > 1 ? <Link href={`/peta/5/${n - 1}`} className="btn btn-ghost">‹ Arah {n - 1}</Link> : <span />}
          {n < peta.arah.length ? <Link href={`/peta/5/${n + 1}`} className="btn btn-secondary">Arah {n + 1} ›</Link> : <Link href="/peta/6" className="btn btn-secondary">Bagian 6 ›</Link>}
        </div>
      </div>
    </Shell>
  );
}
