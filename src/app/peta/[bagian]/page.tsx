import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { TrackView } from "@/components/TrackView";
import { Bagian1, Bagian2, Bagian3, Bagian4, Bagian5, Bagian6Body } from "@/components/report/Sections";
import { db } from "@/lib/supabase/server";
import { requirePaidPeta } from "../guard";
import { NeedCard } from "../NeedCard";
import { RatingCard } from "../RatingCard";

export default async function BagianPage({ params }: { params: Promise<{ bagian: string }> }) {
  const no = Number((await params).bagian);
  if (!(no >= 1 && no <= 6)) notFound();
  const { profile, peta } = await requirePaidPeta();
  if (no > 1 && !peta.paid) redirect("/peta");
  const p = peta.paid!;

  let tail: React.ReactNode = null;
  if (no === 6) {
    const [need, rating] = await Promise.all([
      db().from("need_responses").select("need,tier,wish,wish_skipped").eq("user_id", profile.id).maybeSingle(),
      db().from("ratings").select("stars,chips,text,locked").eq("user_id", profile.id).maybeSingle(),
    ]);
    tail = (
      <>
        <NeedCard saved={need.data as never} />
        <RatingCard saved={rating.data as never} />
      </>
    );
  }

  return (
    <Shell layar={`peta_bagian_${no}`} back="/peta">
      <TrackView name="report_section_view" props={{ bagian: no }} />
      <div className="stack" style={{ ["--gap" as string]: "28px" }}>
        {no === 1 && <Bagian1 peta={peta} nickname={profile.nickname} />}
        {no === 2 && <Bagian2 p={p.bagian2} />}
        {no === 3 && <Bagian3 p={p.bagian3} />}
        {no === 4 && <Bagian4 p={p.bagian4} />}
        {no === 5 && <Bagian5 peta={peta} />}
        {no === 6 && <Bagian6Body p={p.bagian6} />}
        {tail}
        <div className="row between">
          {no > 1 ? <Link href={`/peta/${no - 1}`} className="btn btn-ghost">‹ Bagian {no - 1}</Link> : <span />}
          {no < 6 ? <Link href={`/peta/${no + 1}`} className="btn btn-secondary">Bagian {no + 1} ›</Link> : <Link href="/peta" className="btn btn-secondary">Daftar isi</Link>}
        </div>
      </div>
    </Shell>
  );
}
