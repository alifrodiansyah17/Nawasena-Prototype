"use server";
import { after } from "next/server";
import { db } from "@/lib/supabase/server";
import { loadJourney, requireProfile } from "@/lib/session";
import { generatePaid } from "@/lib/report";
import { track } from "@/lib/analytics";
import { NEEDS } from "@/lib/config";

export async function ensurePaidReport() {
  const profile = await requireProfile();
  const j = await loadJourney(profile);
  if (!j.paid) return { status: "locked" };
  const { data } = await db().from("reports").select("paid_status").eq("user_id", profile.id).single();
  const st = (data as { paid_status: string }).paid_status;
  if (st === "pending" || st === "error") after(() => generatePaid(profile.id));
  return { status: st };
}

async function ctx() {
  const profile = await requireProfile();
  const j = await loadJourney(profile);
  if (!j.paid) throw new Error("locked");
  return { profile, props: { level: j.cvLevel, cv_source: j.cv?.source === "built" ? "built" : "uploaded", target_terisi: !!j.target?.filled } };
}

// Kartu kebutuhan (§6.5). need_selected menyimpan KEBUTUHAN, bukan layanan (AC-04.3c).
export async function trackNeed(event: "need_selected" | "need_offer_view" | "need_tier_pick" | "need_price_vote" | "need_wish_view", props: Record<string, unknown>) {
  const { profile, props: base } = await ctx();
  await track(profile.id, event, { ...base, ...props });
}

export async function submitNeed(input: { need: string; tier?: string | null; price_vote?: string | null }) {
  const { profile, props } = await ctx();
  if (!NEEDS.some((n) => n.kode === input.need)) return { error: "invalid" };
  const { data: existing } = await db().from("need_responses").select("user_id").eq("user_id", profile.id).maybeSingle();
  if (existing) return { ok: true }; // terkunci setelah dikirim (AC-04.7)
  const waitlist = input.need !== "cukup";
  await db().from("need_responses").insert({ user_id: profile.id, need: input.need, tier: input.tier ?? null, price_vote: input.price_vote ?? null, waitlist } as never);
  if (waitlist) await track(profile.id, "need_waitlist_submit", { ...props, kebutuhan: input.need, tier: input.tier ?? null });
  return { ok: true };
}

export async function submitWish(wish: string | null) {
  const { profile, props } = await ctx();
  await db().from("need_responses").update({ wish: wish?.slice(0, 2000) ?? null, wish_skipped: !wish } as never).eq("user_id", profile.id);
  await track(profile.id, "need_wish_submit", { ...props, isi_terisi: !!wish });
  return { ok: true };
}

// Kartu penilaian (§6.6). Bintang terkirim begitu dipilih (AC-05.6).
export async function rateStars(stars: number) {
  const { profile, props } = await ctx();
  if (!(stars >= 1 && stars <= 5)) return { error: "invalid" };
  const { data } = await db().from("ratings").select("locked").eq("user_id", profile.id).maybeSingle();
  if ((data as { locked: boolean } | null)?.locked) return { ok: true };
  await db().from("ratings").upsert({ user_id: profile.id, stars, updated_at: new Date().toISOString() } as never);
  await track(profile.id, "rating_submit", { ...props, bintang: stars });
  return { ok: true };
}

export async function submitRating(input: { chips: string[]; text: string }) {
  const { profile, props } = await ctx();
  const { data } = await db().from("ratings").select("locked,stars").eq("user_id", profile.id).maybeSingle();
  const row = data as { locked: boolean; stars: number } | null;
  if (!row || row.locked) return { ok: true };
  await db().from("ratings").update({ chips: input.chips, text: input.text.slice(0, 4000) || null, locked: true, updated_at: new Date().toISOString() } as never).eq("user_id", profile.id);
  for (const chip of input.chips) await track(profile.id, "rating_improve_pick", { ...props, chip });
  if (input.text.trim()) await track(profile.id, "rating_text_submit", props);
  return { ok: true };
}
