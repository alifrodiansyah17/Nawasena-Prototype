import "server-only";
import { db } from "./supabase/server";
import { writeFreePart, writePaidPart, type ReportInput } from "./ai";
import { scoreAnswers, type ConstructCode } from "./quiz";
import { pickArchetype } from "./archetypes";
import { ageOn, levelFromWorkYears, type Level } from "./level";
import { extractText } from "./cv-extract";
import type { FreePart } from "./report-schema";

async function buildInput(userId: string): Promise<ReportInput> {
  const [p, cv, as, tg, att] = await Promise.all([
    db().from("profiles").select("nickname,birth_date,age_level").eq("id", userId).single(),
    db().from("cvs").select("source,text_content,work_years,cv_level").eq("user_id", userId).single(),
    db().from("assessments").select("answers").eq("user_id", userId).single(),
    db().from("targets").select("text,filled,level").eq("user_id", userId).maybeSingle(),
    db().from("attachments").select("file_path,file_name,url").eq("user_id", userId),
  ]);
  const prof = p.data as { nickname: string; birth_date: string | null; age_level: Level };
  const cvRow = cv.data as { source: "uploaded" | "built"; text_content: string; work_years: number | null; cv_level: Level | null };
  const answers = (as.data as { answers: number[] }).answers;
  const summary = scoreAnswers(answers);
  const target = tg.data as { text: string | null; filled: boolean; level: Level | null } | null;
  const level = target?.level ?? cvRow.cv_level ?? levelFromWorkYears(cvRow.work_years, prof.age_level);

  // Isi lampiran ikut diperhitungkan di Bagian 5 (AC-M2.6), dibatasi panjangnya.
  const parts: string[] = [];
  for (const a of (att.data as { file_path: string | null; file_name: string | null; url: string | null }[]) ?? []) {
    if (a.url) parts.push(`Link: ${a.url}`);
    if (a.file_path && a.file_name) {
      let text = "";
      if (/\.(pdf|docx)$/i.test(a.file_name)) {
        const { data } = await db().storage.from("attachments").download(a.file_path);
        if (data) {
          try {
            text = await extractText(Buffer.from(await data.arrayBuffer()), data.type, a.file_name);
          } catch {
            text = "";
          }
        }
      }
      parts.push(`File: ${a.file_name}${text ? `\n${text.slice(0, 12000)}` : " (isi tidak dibaca)"}`);
    }
  }

  return {
    nickname: prof.nickname,
    age: prof.birth_date ? ageOn(prof.birth_date) : null,
    level,
    cvSource: cvRow.source,
    cvText: cvRow.text_content,
    attachments: parts.join("\n\n"),
    summary,
    answers,
    archetype: pickArchetype(summary.scores, summary.topRiasec[0] as ConstructCode),
    target: target?.filled ? target.text : null,
  };
}

async function setReport(userId: string, patch: Record<string, unknown>) {
  await db()
    .from("reports")
    .upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() } as never);
}

// Klaim status secara atomik supaya dua permintaan tidak menggenerate bersamaan.
async function claim(userId: string, col: "free_status" | "paid_status"): Promise<boolean> {
  await db().from("reports").upsert({ user_id: userId } as never, { onConflict: "user_id", ignoreDuplicates: true });
  const staleBefore = new Date(Date.now() - 5 * 60_000).toISOString();
  const { data } = await db()
    .from("reports")
    .update({ [col]: "generating", updated_at: new Date().toISOString() } as never)
    .eq("user_id", userId)
    .or(`${col}.in.(pending,error),and(${col}.eq.generating,updated_at.lt."${staleBefore}")`)
    .select("user_id");
  return !!data?.length;
}

export async function generateFree(userId: string) {
  if (!(await claim(userId, "free_status"))) return;
  try {
    const inp = await buildInput(userId);
    const { data, usage } = await writeFreePart(inp);
    await setReport(userId, {
      free: data,
      free_status: "ready",
      archetype: inp.archetype.kode,
      level: inp.level,
      error: null,
      usage: { free: usage },
    });
  } catch (e) {
    await setReport(userId, { free_status: "error", error: String((e as Error).message ?? e) });
    throw e;
  }
}

export async function generatePaid(userId: string) {
  const { data: rep } = await db().from("reports").select("free,usage").eq("user_id", userId).single();
  const free = (rep as { free: FreePart | null } | null)?.free;
  if (!free) return;
  if (!(await claim(userId, "paid_status"))) return;
  try {
    const inp = await buildInput(userId);
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { data, usage } = await writePaidPart(inp, free);
        await setReport(userId, {
          paid: data,
          paid_status: "ready",
          error: null,
          generated_at: new Date().toISOString(),
          usage: { ...((rep as { usage: object | null }).usage ?? {}), paid: usage },
        });
        return;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr;
  } catch (e) {
    await setReport(userId, { paid_status: "error", error: String((e as Error).message ?? e) });
  }
}
