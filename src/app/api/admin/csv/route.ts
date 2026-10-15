import { NextResponse, type NextRequest } from "next/server";
import { audit, requireAdmin } from "@/lib/admin";
import { revenueRows } from "@/lib/revenue";
import { track } from "@/lib/analytics";

// CSV uang masuk: hanya pemilik (BO AC-06.4).
export async function GET(req: NextRequest) {
  const admin = await requireAdmin({ owner: true });
  const kode = req.nextUrl.searchParams.get("periode") ?? "7hari";
  const rows = await revenueRows(kode);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [["tanggal_konfirmasi", "jam", "nomor_pesanan", "nama", "email", "metode", "nominal", "admin"].join(",")];
  for (const r of rows) {
    const d = new Date(new Date(r.decided_at!).getTime() + 7 * 3600_000).toISOString();
    lines.push([d.slice(0, 10), d.slice(11, 16), r.order_no, r.nickname, r.email, r.method, r.nominal, r.adminName].map(esc).join(","));
  }
  await audit(admin.user_id, "revenue_export", null, { periode: kode, baris: rows.length });
  await track(null, "bo_revenue_export", { admin: admin.user_id, periode: kode });
  return new NextResponse("﻿" + lines.join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="uang-masuk-${kode}.csv"` },
  });
}
