import { NextResponse } from "next/server";
import { currentUser, ensureProfile, loadJourney } from "@/lib/session";
import { renderCvPdf } from "@/lib/pdf";
import { track } from "@/lib/analytics";
import type { BuiltCv } from "@/lib/cv-text";

export const runtime = "nodejs";

// Unduh CV hanya untuk jalur A (CV disusun di Nawasena) dan setelah bayar (AC-D1.4, AC-D2.2).
export async function GET() {
  const user = await currentUser();
  const profile = user ? await ensureProfile(user) : null;
  if (!profile) return new NextResponse("Login dulu ya.", { status: 401 });
  const j = await loadJourney(profile);
  if (!j.paid) return new NextResponse("CV bisa diunduh setelah pembayaran dikonfirmasi.", { status: 403 });
  if (j.cv?.source !== "built" || !j.cv.built) return new NextResponse("Tidak tersedia.", { status: 404 });
  const built = j.cv.built as BuiltCv;
  const pdf = await renderCvPdf(built);
  await track(profile.id, "cv_download", { level: j.cvLevel, cv_source: "built" });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="CV-${(built.diri.nama || profile.nickname).replace(/[^\w-]+/g, "_")}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
