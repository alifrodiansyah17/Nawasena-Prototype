import "server-only";
import { redirect } from "next/navigation";
import { requireProfile, loadJourney } from "@/lib/session";
import { loadPeta } from "@/lib/peta";

// Bagian 2–6 hanya untuk pesanan Terkonfirmasi (AC-A2.5).
export async function requirePaidPeta() {
  const profile = await requireProfile();
  const j = await loadJourney(profile);
  if (!j.paid) redirect(j.report?.free_status === "ready" ? "/hasil" : "/analisis");
  const peta = await loadPeta(j);
  if (!peta) redirect("/analisis");
  return { profile, j, peta };
}
