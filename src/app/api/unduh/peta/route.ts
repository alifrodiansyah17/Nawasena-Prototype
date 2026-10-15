import { NextResponse } from "next/server";
import { currentUser, ensureProfile, loadJourney } from "@/lib/session";
import { loadPeta } from "@/lib/peta";
import { renderReportPdf } from "@/lib/pdf";
import { track } from "@/lib/analytics";

export const runtime = "nodejs";

export async function GET() {
  const user = await currentUser();
  const profile = user ? await ensureProfile(user) : null;
  if (!profile) return NextResponse.redirect(new URL("/masuk", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));
  const j = await loadJourney(profile);
  if (!j.paid) return new NextResponse("Peta Potensimu lengkap baru kebuka setelah pembayaran dikonfirmasi.", { status: 403 });
  const peta = await loadPeta(j);
  if (!peta?.paid) return new NextResponse("Bagian 2–6 masih disusun. Coba lagi sebentar lagi.", { status: 409 });
  const pdf = await renderReportPdf(peta, profile.nickname);
  await track(profile.id, "report_download", { level: j.cvLevel, cv_source: j.cv?.source, target_terisi: !!peta.target });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Peta-Potensimu-${profile.nickname.replace(/[^\w-]+/g, "_")}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
