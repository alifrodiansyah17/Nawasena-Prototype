import "server-only";
import { redirect } from "next/navigation";
import { db, supabaseSession } from "./supabase/server";
import { levelFromAge, levelFromWorkYears, type Level } from "./level";

export interface Profile {
  id: string;
  nickname: string;
  birth_date: string | null;
  whatsapp: string | null;
  email: string | null;
  age_level: Level;
}

export async function currentUser() {
  const sb = await supabaseSession();
  const { data } = await sb.auth.getUser();
  return data.user ?? null;
}

// Membuat profil dari metadata pendaftaran saat pertama kali login.
export async function ensureProfile(user: { id: string; email?: string | null; phone?: string | null; user_metadata?: Record<string, unknown> }) {
  const { data: existing } = await db().from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (existing) return existing as Profile;
  const m = user.user_metadata ?? {};
  const nickname = typeof m.nickname === "string" && m.nickname ? m.nickname : null;
  if (!nickname) return null; // login tanpa pernah daftar
  const birth = typeof m.birth_date === "string" ? m.birth_date : null;
  const row = {
    id: user.id,
    nickname,
    birth_date: birth,
    whatsapp: typeof m.whatsapp === "string" ? m.whatsapp : user.phone ?? null,
    email: user.email ?? (typeof m.email === "string" ? m.email : null),
    age_level: levelFromAge(birth),
  };
  await db().from("profiles").upsert(row as never);
  return row as Profile;
}

export async function requireProfile(): Promise<Profile> {
  const user = await currentUser();
  if (!user) redirect("/masuk");
  const profile = await ensureProfile(user);
  if (!profile) redirect("/daftar?lengkapi=1");
  return profile;
}

export interface Journey {
  profile: Profile;
  cv: { source: "uploaded" | "built"; file_name: string | null; builder_step: number; attachment_done: boolean; text_content: string | null; work_years: number | null; cv_level: Level | null; built: unknown; facts: { ringkas?: string } | null } | null;
  assessment: { answers: (number | null)[]; page: number; completed_at: string | null } | null;
  target: { text: string | null; filled: boolean; level: Level | null } | null;
  report: { free_status: string; paid_status: string } | null;
  order: { id: string; order_no: string; status: string; method: string | null; amount: number; reject_reason: string | null; expires_at: string; submitted_at: string | null; decided_at: string | null } | null;
  cvLevel: Level;
  paid: boolean;
}

export async function loadJourney(profile: Profile): Promise<Journey> {
  const id = profile.id;
  const [cv, as, tg, rp, od] = await Promise.all([
    db().from("cvs").select("source,file_name,builder_step,attachment_done,text_content,work_years,cv_level,built,facts").eq("user_id", id).maybeSingle(),
    db().from("assessments").select("answers,page,completed_at").eq("user_id", id).maybeSingle(),
    db().from("targets").select("text,filled,level").eq("user_id", id).maybeSingle(),
    db().from("reports").select("free_status,paid_status").eq("user_id", id).maybeSingle(),
    db()
      .from("orders")
      .select("id,order_no,status,method,amount,reject_reason,expires_at,submitted_at,decided_at")
      .eq("user_id", id)
      .neq("status", "expired")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  let order = (od.data as Journey["order"]) ?? null;
  // Pesanan yang belum dibayar dan lewat batas waktu jadi kedaluwarsa.
  if (order && order.status === "awaiting_payment" && new Date(order.expires_at) < new Date()) {
    await db().from("orders").update({ status: "expired", updated_at: new Date().toISOString() } as never).eq("id", order.id).eq("status", "awaiting_payment");
    order = null;
  }
  const cvRow = (cv.data as Journey["cv"]) ?? null;
  return {
    profile,
    cv: cvRow,
    assessment: (as.data as Journey["assessment"]) ?? null,
    target: (tg.data as Journey["target"]) ?? null,
    report: (rp.data as Journey["report"]) ?? null,
    order,
    cvLevel: cvRow?.cv_level ?? levelFromWorkYears(cvRow?.work_years, profile.age_level),
    paid: order?.status === "confirmed",
  };
}

// Langkah berikutnya untuk pengguna ini (AC-02.3: pengguna lama langsung ke petanya).
export function nextPath(j: Journey): string {
  const cv = j.cv;
  if (!cv) return j.profile.age_level === "entry" ? "/cv" : "/cv/unggah";
  if (cv.source === "built" && !cv.text_content) return cv.builder_step > 7 ? "/cv/pratinjau" : "/cv/susun";
  if (cv.source === "uploaded" && !cv.attachment_done) return "/cv/lampiran";
  if (!j.assessment?.completed_at) return "/kuis";
  if (!j.target) return "/kuis/target";
  if (j.report?.free_status !== "ready") return "/analisis";
  if (j.paid) return "/peta";
  return "/hasil";
}
