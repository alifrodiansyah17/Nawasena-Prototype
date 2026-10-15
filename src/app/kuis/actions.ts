"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/supabase/server";
import { loadJourney, requireProfile } from "@/lib/session";
import { ITEMS, PAGE_COUNT, pageItems, scoreAnswers, isComplete } from "@/lib/quiz";
import { track } from "@/lib/analytics";
import { refreshCvFacts } from "../cv/actions";
import { generateFree, generatePaid } from "@/lib/report";
import { levelFromWorkYears } from "@/lib/level";

async function ctx() {
  const profile = await requireProfile();
  const j = await loadJourney(profile);
  return { profile, j, props: { level: j.cvLevel, cv_source: j.cv?.source === "built" ? "built" : "uploaded" } };
}

export async function startQuiz() {
  const { profile, j, props } = await ctx();
  if (!j.cv?.text_content) redirect("/cv");
  if (!j.assessment) {
    await db().from("assessments").upsert({ user_id: profile.id } as never, { onConflict: "user_id", ignoreDuplicates: true });
    await track(profile.id, "assessment_start", props);
  }
  redirect("/kuis");
}

// Jawaban tersimpan per halaman (AC-A1.7). `answers` = nilai 1–4 untuk 6 item halaman itu.
export async function savePage(page: number, answers: number[]) {
  const { profile, j, props } = await ctx();
  if (page < 0 || page >= PAGE_COUNT || answers.length !== 6 || answers.some((a) => !(a >= 1 && a <= 4))) {
    return { error: "Jawaban belum lengkap" };
  }
  const all = [...(j.assessment?.answers ?? Array(ITEMS.length).fill(null))];
  pageItems(page).forEach((idx, i) => (all[idx] = answers[i]));
  const last = page === PAGE_COUNT - 1;
  const patch: Record<string, unknown> = { user_id: profile.id, answers: all, page: last ? page : page + 1, updated_at: new Date().toISOString() };
  if (last) {
    if (!isComplete(all)) return { error: "Masih ada jawaban yang kosong di halaman sebelumnya" };
    patch.completed_at = new Date().toISOString();
    patch.scores = scoreAnswers(all);
  }
  await db().from("assessments").upsert(patch as never);
  await track(profile.id, "assessment_page_complete", { ...props, halaman: page + 1 });
  if (last) {
    await track(profile.id, "assessment_complete", props);
    redirect("/kuis/target");
  }
  return { ok: true };
}

export async function goToPage(page: number) {
  const { profile } = await ctx();
  await db().from("assessments").update({ page } as never).eq("user_id", profile.id);
}

// Level untuk pertanyaan target dibaca dari lama kerja di CV (AC-A5.2).
export async function ensureCvLevel() {
  const { profile, j } = await ctx();
  if (j.cv && !j.cv.cv_level && j.cv.source === "uploaded") {
    await refreshCvFacts(profile.id, profile.age_level);
    const { data } = await db().from("cvs").select("work_years,cv_level").eq("user_id", profile.id).single();
    const row = data as { work_years: number | null; cv_level: "entry" | "mid" | "senior" | null };
    return row.cv_level ?? levelFromWorkYears(row.work_years, profile.age_level);
  }
  return j.cvLevel;
}

export async function submitTarget(fd: FormData) {
  const { profile, j, props } = await ctx();
  if (!j.assessment?.completed_at) redirect("/kuis");
  const raw = String(fd.get("target") ?? "").trim().slice(0, 200);
  const skip = fd.get("skip") === "1" || raw === "";
  const level = j.cvLevel;
  await db().from("targets").upsert({ user_id: profile.id, text: skip ? null : raw, filled: !skip, level } as never);
  // Hasil lama (kalau ada) dihapus supaya disusun ulang dengan target baru.
  await db().from("reports").delete().eq("user_id", profile.id).neq("free_status", "generating");
  await track(profile.id, skip ? "target_skip" : "target_submit", { ...props, level, terisi: !skip, target_terisi: !skip });
  redirect("/analisis");
}

// Dipanggil dari layar proses analisis: Bagian 1 ditunggu, Bagian 2–6 disusun di belakang.
export async function runAnalysis(): Promise<{ status: "ready" | "error"; message?: string }> {
  const { profile, j } = await ctx();
  if (!j.target) redirect("/kuis/target");
  try {
    await generateFree(profile.id);
  } catch (e) {
    console.error("generateFree", e);
  }
  const { data } = await db().from("reports").select("free_status,paid_status").eq("user_id", profile.id).single();
  const rep = data as { free_status: string; paid_status: string } | null;
  if (rep?.free_status === "ready") {
    if (rep.paid_status !== "ready") after(() => generatePaid(profile.id));
    return { status: "ready" };
  }
  return { status: "error", message: "Analisisnya belum berhasil. Coba sekali lagi ya." };
}
