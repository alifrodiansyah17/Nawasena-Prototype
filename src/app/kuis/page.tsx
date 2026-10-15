import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { requireProfile, loadJourney } from "@/lib/session";
import { ITEMS, PAGES } from "@/lib/quiz";
import { Quiz } from "./Quiz";

export default async function Kuis() {
  const profile = await requireProfile();
  const j = await loadJourney(profile);
  if (!j.cv?.text_content) redirect("/cv");
  if (!j.assessment) redirect("/kuis/intro");
  if (j.assessment.completed_at) redirect("/kuis/target");
  return (
    <Shell layar="kuis">
      <Quiz
        items={ITEMS.map((i) => i.teks)}
        pages={PAGES}
        initialAnswers={j.assessment.answers.map((a) => a ?? null)}
        initialPage={j.assessment.page}
      />
    </Shell>
  );
}
