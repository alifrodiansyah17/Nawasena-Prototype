import "server-only";
import { db } from "./supabase/server";
import { startOfDayWIB, withUsers, type OrderRow } from "./admin";

export function periodStart(kode: string) {
  const today = startOfDayWIB();
  if (kode === "hari") return today;
  if (kode === "bulan") {
    const wib = new Date(Date.now() + 7 * 3600_000);
    return new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), 1) - 7 * 3600_000);
  }
  return new Date(today.getTime() - 6 * 86400_000);
}

export async function revenueRows(kode: string) {
  const from = periodStart(kode).toISOString();
  // Hanya Terkonfirmasi, sebesar nominal di bukti, menurut tanggal dikonfirmasi (BO AC-06.1).
  const { data } = await db()
    .from("orders")
    .select("id,order_no,user_id,amount,method,status,proof_amount,reject_reason,submitted_at,decided_at,decided_by,created_at")
    .eq("status", "confirmed")
    .gte("decided_at", from)
    .order("decided_at", { ascending: false });
  const rows = await withUsers((data ?? []) as OrderRow[]);
  const ids = [...new Set(rows.map((r) => r.decided_by).filter(Boolean))] as string[];
  const { data: names } = ids.length ? await db().from("admins").select("user_id,name").in("user_id", ids) : { data: [] };
  const nameOf = new Map(((names ?? []) as { user_id: string; name: string }[]).map((n) => [n.user_id, n.name]));
  return rows.map((r) => ({ ...r, nominal: r.proof_amount ?? r.amount, adminName: nameOf.get(r.decided_by ?? "") ?? "—" }));
}

