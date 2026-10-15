import "server-only";
import { db } from "./supabase/server";

// Semua event membawa level dan cv_source (§10). Setelah kuis juga target_terisi.
export async function track(userId: string | null, name: string, props: Record<string, unknown> = {}) {
  try {
    await db().from("events").insert({ user_id: userId, name, props } as never);
  } catch {
    // Analytics tidak boleh menggagalkan alur pengguna.
  }
}
