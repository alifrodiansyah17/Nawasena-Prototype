import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { requireProfile, loadJourney } from "@/lib/session";
import { Analysis } from "./Analysis";

export const maxDuration = 300;

export default async function Analisis() {
  const profile = await requireProfile();
  const j = await loadJourney(profile);
  if (!j.target) redirect("/kuis/target");
  if (j.report?.free_status === "ready") redirect(j.paid ? "/peta" : "/hasil");
  return (
    <Shell layar="proses_analisis">
      <Analysis nickname={profile.nickname} />
    </Shell>
  );
}
