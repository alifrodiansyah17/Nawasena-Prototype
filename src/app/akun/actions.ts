"use server";
import { redirect } from "next/navigation";
import { db, supabaseSession } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/session";

async function removeFolder(bucket: string, prefix: string) {
  const { data } = await db().storage.from(bucket).list(prefix, { limit: 1000 });
  const paths = (data ?? []).map((f) => `${prefix}/${f.name}`);
  if (paths.length) await db().storage.from(bucket).remove(paths);
}

// Pengguna bisa menghapus file serta akun beserta seluruh datanya (§9, UU PDP).
export async function deleteFiles() {
  const profile = await requireProfile();
  await removeFolder("cv", profile.id);
  await removeFolder("attachments", profile.id);
  await db().from("attachments").delete().eq("user_id", profile.id);
  await db().from("cvs").update({ file_path: null } as never).eq("user_id", profile.id);
  redirect("/akun?file=1");
}

export async function deleteAccount(fd: FormData) {
  const profile = await requireProfile();
  if (String(fd.get("konfirmasi")).trim().toUpperCase() !== "HAPUS") redirect("/akun?salah=1");
  await removeFolder("cv", profile.id);
  await removeFolder("attachments", profile.id);
  const { data: orders } = await db().from("orders").select("id").eq("user_id", profile.id);
  for (const o of (orders ?? []) as { id: string }[]) await removeFolder("proofs", o.id);
  await db().auth.admin.deleteUser(profile.id); // baris lain ikut terhapus lewat ON DELETE CASCADE
  const sb = await supabaseSession();
  await sb.auth.signOut();
  redirect("/?terhapus=1");
}
