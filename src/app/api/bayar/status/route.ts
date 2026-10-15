import { NextResponse } from "next/server";
import { currentUser, ensureProfile, loadJourney } from "@/lib/session";

// Dipoll layar status supaya keputusan tim terlihat tanpa memuat ulang (AC-A2.12).
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ status: null }, { status: 401 });
  const profile = await ensureProfile(user);
  if (!profile) return NextResponse.json({ status: null }, { status: 401 });
  const j = await loadJourney(profile);
  return NextResponse.json({ status: j.order?.status ?? null, decided_at: j.order?.decided_at ?? null }, { headers: { "Cache-Control": "no-store" } });
}
