"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/session";
import { ATTACHMENT_EXT, CV_MIME, MAX_ATTACHMENT_BYTES, MAX_CV_BYTES } from "@/lib/config";
import { builtCvToText, draftProfile, type BuiltCv } from "@/lib/cv-text";
import { extractText, MIN_CV_CHARS } from "@/lib/cv-extract";
import { readCvFacts } from "@/lib/ai";
import { levelFromWorkYears } from "@/lib/level";
import { track } from "@/lib/analytics";

export type CvState = { error?: string } | undefined;

function safeName(n: string) {
  return n.replace(/[^\w.\-]+/g, "_").slice(-120);
}

// Baca fakta CV (lama kerja → level untuk pertanyaan target). Effort rendah.
export async function refreshCvFacts(userId: string, fallbackLevel: "entry" | "mid" | "senior") {
  const { data } = await db().from("cvs").select("text_content").eq("user_id", userId).single();
  const text = (data as { text_content: string | null } | null)?.text_content;
  if (!text) return;
  try {
    const facts = await readCvFacts(text);
    const years = facts.lama_kerja_tahun >= 0 ? facts.lama_kerja_tahun : null;
    await db()
      .from("cvs")
      .update({ facts, work_years: years, cv_level: levelFromWorkYears(years, fallbackLevel) } as never)
      .eq("user_id", userId);
  } catch (e) {
    console.error("readCvFacts gagal", e);
  }
}

export async function chooseCvBranch(fd: FormData) {
  const profile = await requireProfile();
  const choice = String(fd.get("choice"));
  await track(profile.id, "cv_branch_choice", { level: profile.age_level, pilihan: choice });
  if (choice === "belum" && profile.age_level === "entry") redirect("/cv/susun");
  redirect("/cv/unggah");
}

export async function uploadCv(_: CvState, fd: FormData): Promise<CvState> {
  const profile = await requireProfile();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Pilih file CV dulu ya." };
  if (file.size > MAX_CV_BYTES) return { error: "Ukurannya lebih dari 5 MB. Coba simpan ulang jadi PDF yang lebih ringan." };
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!CV_MIME.includes(file.type) && !["pdf", "doc", "docx"].includes(ext)) return { error: "Formatnya PDF, DOC, atau DOCX ya." };

  const buf = Buffer.from(await file.arrayBuffer());
  let text = "";
  try {
    text = await extractText(buf, file.type, file.name);
  } catch {
    text = "";
  }
  if (text.length < MIN_CV_CHARS) {
    return {
      error:
        ext === "doc"
          ? "File .doc lama belum bisa kami baca. Simpan ulang sebagai PDF atau DOCX, lalu unggah lagi."
          : "Isi CV-nya belum terbaca, kemungkinan karena hasil scan atau gambar. Unggah versi PDF yang teksnya bisa diblok, ya.",
    };
  }
  const path = `${profile.id}/${Date.now()}-${safeName(file.name)}`;
  const up = await db().storage.from("cv").upload(path, buf, { contentType: file.type || "application/octet-stream", upsert: false });
  if (up.error) return { error: "Unggahan gagal. Coba lagi sebentar lagi." };

  const { data: old } = await db().from("cvs").select("file_path").eq("user_id", profile.id).maybeSingle();
  await db()
    .from("cvs")
    .upsert({
      user_id: profile.id,
      source: "uploaded",
      file_path: path,
      file_name: file.name,
      file_size: file.size,
      mime: file.type,
      text_content: text,
      built: null,
      facts: null,
      work_years: null,
      cv_level: null,
      updated_at: new Date().toISOString(),
    } as never);
  const oldPath = (old as { file_path: string | null } | null)?.file_path;
  if (oldPath && oldPath !== path) await db().storage.from("cv").remove([oldPath]);
  await track(profile.id, "cv_upload_success", { level: profile.age_level, cv_source: "uploaded" });
  after(() => refreshCvFacts(profile.id, profile.age_level));
  return undefined;
}

export async function continueFromUpload() {
  const profile = await requireProfile();
  const { data } = await db().from("cvs").select("text_content").eq("user_id", profile.id).maybeSingle();
  if (!(data as { text_content: string | null } | null)?.text_content) redirect("/cv/unggah");
  redirect("/cv/lampiran");
}

// Lampiran opsional: file atau link; tidak pernah memblokir (AC-M2.4, AC-M2.5).
export async function saveAttachment(_: CvState, fd: FormData): Promise<CvState> {
  const profile = await requireProfile();
  const skip = fd.get("skip") === "1";
  if (!skip) {
    const file = fd.get("file");
    const url = String(fd.get("url") ?? "").trim();
    let saved = false;
    if (file instanceof File && file.size > 0) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!ATTACHMENT_EXT.includes(ext)) return { error: "Formatnya PDF, DOCX, PPTX, atau ZIP ya." };
      if (file.size > MAX_ATTACHMENT_BYTES) return { error: "Ukurannya lebih dari 10 MB." };
      const path = `${profile.id}/${Date.now()}-${safeName(file.name)}`;
      const up = await db().storage.from("attachments").upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type || "application/octet-stream" });
      if (up.error) return { error: "Unggahan gagal. Coba lagi, atau lewati dulu." };
      await db().from("attachments").insert({ user_id: profile.id, file_path: path, file_name: file.name } as never);
      saved = true;
    }
    if (url) {
      if (!/^https?:\/\/\S+\.\S+/.test(url)) return { error: "Linknya belum pas. Awali dengan https://" };
      await db().from("attachments").insert({ user_id: profile.id, url } as never);
      saved = true;
    }
    if (saved) await track(profile.id, "portfolio_upload_success", { level: profile.age_level, cv_source: "uploaded" });
  }
  await db().from("cvs").update({ attachment_done: true } as never).eq("user_id", profile.id);
  redirect("/kuis/intro");
}

// CV builder: progres tersimpan per langkah (AC-E3.9).
export async function saveBuilder(step: number, built: BuiltCv) {
  const profile = await requireProfile();
  if (profile.age_level !== "entry") return { error: "forbidden" };
  if (step === 7 && !built.profil.trim()) built.profil = draftProfile(built);
  await db()
    .from("cvs")
    .upsert({
      user_id: profile.id,
      source: "built",
      built,
      builder_step: step,
      file_path: null,
      file_name: null,
      text_content: null,
      updated_at: new Date().toISOString(),
    } as never);
  await track(profile.id, "cv_builder_step_complete", { level: "entry", cv_source: "built", langkah: step - 1 });
  return { ok: true, profil: built.profil };
}

export async function finishBuilder() {
  const profile = await requireProfile();
  const { data } = await db().from("cvs").select("built,source").eq("user_id", profile.id).single();
  const row = data as { built: BuiltCv | null; source: string } | null;
  if (!row?.built || row.source !== "built") redirect("/cv/susun");
  const text = builtCvToText(row.built);
  // Jalur CV builder tidak melewati halaman lampiran (AC-M3.2).
  await db()
    .from("cvs")
    .update({ text_content: text, builder_step: 8, attachment_done: true, cv_level: "entry", work_years: null } as never)
    .eq("user_id", profile.id);
  redirect("/kuis/intro");
}
