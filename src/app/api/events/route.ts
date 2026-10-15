import { NextResponse, type NextRequest } from "next/server";
import { currentUser, ensureProfile, loadJourney } from "@/lib/session";
import { track } from "@/lib/analytics";

// Daftar putih event dari klien (§10).
const ALLOWED = new Set([
  "landing_view", "signup_start", "cv_branch_shown", "cv_builder_step_view", "cv_builder_abandon",
  "assessment_start", "target_view", "target_example_pick", "result_free_view", "locked_section_click",
  "paywall_view", "payment_status_view", "report_section_view", "role_detail_view",
  "need_card_view", "need_offer_view", "need_wish_view", "rating_card_view",
  "share_teaser_view", "share_teaser_hover",
]);

export async function POST(req: NextRequest) {
  let body: { name?: string; props?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!body.name || !ALLOWED.has(body.name)) return NextResponse.json({ ok: false }, { status: 400 });
  const user = await currentUser().catch(() => null);
  let ctx: Record<string, unknown> = {};
  if (user) {
    const profile = await ensureProfile(user);
    if (profile) {
      const j = await loadJourney(profile);
      ctx = {
        level: j.cvLevel ?? profile.age_level,
        cv_source: j.cv?.source === "built" ? "built" : j.cv ? "uploaded" : null,
        ...(j.target ? { target_terisi: j.target.filled } : {}),
      };
    }
  }
  await track(user?.id ?? null, body.name, { ...ctx, ...(body.props ?? {}) });
  return NextResponse.json({ ok: true });
}
