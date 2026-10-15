import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { requireProfile, loadJourney } from "@/lib/session";
import { emptyBuiltCv, type BuiltCv } from "@/lib/cv-text";
import { Builder } from "./Builder";

// CV builder hanya untuk entry, termasuk lewat URL langsung (AC-M1.3).
export default async function Susun() {
  const profile = await requireProfile();
  if (profile.age_level !== "entry") redirect("/cv/unggah");
  const j = await loadJourney(profile);
  const built = j.cv?.source === "built" && j.cv.built ? (j.cv.built as BuiltCv) : null;
  const initial = built ?? { ...emptyBuiltCv(), diri: { ...emptyBuiltCv().diri, email: profile.email ?? "" } };
  return (
    <Shell layar="susun_cv" back="/cv">
      <Builder initial={initial} initialStep={built ? j.cv!.builder_step : 1} />
    </Shell>
  );
}
