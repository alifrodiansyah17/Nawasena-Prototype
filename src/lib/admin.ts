import "server-only";
import { redirect } from "next/navigation";
import { db, supabaseSession } from "./supabase/server";

export interface Admin {
  user_id: string;
  name: string;
  email: string;
  role: "admin" | "owner";
  last_list_seen_at: string | null;
}

// Akun per orang, dibuat manual oleh pemilik; login email kantor + verifikasi dua langkah.
export async function requireAdmin(opts: { owner?: boolean } = {}): Promise<Admin> {
  const sb = await supabaseSession();
  const { data } = await sb.auth.getUser();
  if (!data.user) redirect("/admin/masuk");
  const { data: row } = await db().from("admins").select("*").eq("user_id", data.user.id).maybeSingle();
  if (!row) redirect("/admin/masuk?bukan=1");
  if (process.env.ADMIN_REQUIRE_MFA !== "false") {
    const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel !== "aal2") redirect("/admin/mfa");
  }
  const admin = row as Admin;
  if (opts.owner && admin.role !== "owner") redirect("/admin");
  return admin;
}

export async function audit(adminId: string, action: string, orderId: string | null, detail: Record<string, unknown> = {}) {
  await db().from("audit_log").insert({ admin_id: adminId, action, order_id: orderId, detail } as never);
}

export interface OrderRow {
  id: string;
  order_no: string;
  user_id: string;
  amount: number;
  method: "qris" | "transfer" | null;
  status: string;
  proof_amount: number | null;
  reject_reason: string | null;
  submitted_at: string | null;
  decided_at: string | null;
  decided_by: string | null;
  created_at: string;
  nickname?: string;
  email?: string;
}

export async function withUsers(rows: OrderRow[]): Promise<OrderRow[]> {
  const ids = [...new Set(rows.map((r) => r.user_id))];
  if (!ids.length) return rows;
  const { data } = await db().from("profiles").select("id,nickname,email").in("id", ids);
  const map = new Map((data as { id: string; nickname: string; email: string }[]).map((p) => [p.id, p]));
  return rows.map((r) => ({ ...r, nickname: map.get(r.user_id)?.nickname, email: map.get(r.user_id)?.email }));
}

// Batas hari menurut WIB.
export function startOfDayWIB(d = new Date()) {
  const wib = new Date(d.getTime() + 7 * 3600_000);
  wib.setUTCHours(0, 0, 0, 0);
  return new Date(wib.getTime() - 7 * 3600_000);
}
