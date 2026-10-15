import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/supabase/server";

// Retensi file mentah 12 bulan (§9). Dijadwalkan harian lewat vercel.json.
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const cutoff = new Date(Date.now() - 365 * 86400_000).toISOString();
  let removed = 0;

  const { data: proofs } = await db().from("payment_proofs").select("id,file_path").lt("uploaded_at", cutoff).limit(500);
  const pp = (proofs ?? []) as { id: string; file_path: string }[];
  if (pp.length) {
    await db().storage.from("proofs").remove(pp.map((p) => p.file_path));
    await db().from("payment_proofs").delete().in("id", pp.map((p) => p.id));
    removed += pp.length;
  }

  const { data: cvs } = await db().from("cvs").select("user_id,file_path").lt("updated_at", cutoff).not("file_path", "is", null).limit(500);
  const cc = (cvs ?? []) as { user_id: string; file_path: string }[];
  if (cc.length) {
    await db().storage.from("cv").remove(cc.map((c) => c.file_path));
    await db().from("cvs").update({ file_path: null } as never).in("user_id", cc.map((c) => c.user_id));
    removed += cc.length;
  }

  const { data: att } = await db().from("attachments").select("id,file_path").lt("created_at", cutoff).limit(500);
  const aa = (att ?? []) as { id: string; file_path: string | null }[];
  const files = aa.map((a) => a.file_path).filter(Boolean) as string[];
  if (files.length) await db().storage.from("attachments").remove(files);
  if (aa.length) await db().from("attachments").delete().in("id", aa.map((a) => a.id));
  removed += aa.length;

  return NextResponse.json({ ok: true, removed });
}
