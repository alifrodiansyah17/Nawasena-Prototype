"use server";

import { after } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, supabaseSession } from "@/lib/supabase/server";
import { audit, requireAdmin } from "@/lib/admin";
import { REJECT_REASONS } from "@/lib/config";
import { track } from "@/lib/analytics";
import { confirmedEmail, rejectedEmail, sendEmail } from "@/lib/email";
import { generatePaid } from "@/lib/report";

export type BoState = { error?: string; ok?: boolean } | undefined;

// Login admin: email kantor + OTP, lalu TOTP.
export async function adminRequestCode(_: BoState, fd: FormData): Promise<BoState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const { data } = await db().from("admins").select("user_id").eq("email", email).maybeSingle();
  if (!data) return { error: "Email ini tidak terdaftar sebagai admin." };
  const sb = await supabaseSession();
  const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (error) return { error: "Kode belum bisa dikirim. Coba lagi." };
  (await cookies()).set("bo_email", email, { httpOnly: true, sameSite: "lax", maxAge: 900, path: "/" });
  return { ok: true };
}

export async function adminVerifyCode(_: BoState, fd: FormData): Promise<BoState> {
  const email = (await cookies()).get("bo_email")?.value;
  const token = String(fd.get("token") ?? "").replace(/\D/g, "");
  if (!email) return { error: "Mulai lagi dari awal." };
  const sb = await supabaseSession();
  const { error } = await sb.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { error: "Kode salah atau kedaluwarsa." };
  redirect("/admin/mfa");
}

export async function adminSignOut() {
  const sb = await supabaseSession();
  await sb.auth.signOut();
  (await cookies()).delete("bo_seen");
  redirect("/admin/masuk");
}

async function orderOwner(orderId: string) {
  const { data } = await db().from("orders").select("order_no,user_id,method,amount,proof_amount").eq("id", orderId).single();
  const o = data as { order_no: string; user_id: string; method: string; amount: number; proof_amount: number | null };
  const { data: p } = await db().from("profiles").select("nickname,email").eq("id", o.user_id).single();
  return { ...o, ...(p as { nickname: string; email: string }) };
}

function parseAmount(v: FormDataEntryValue | null): number | null {
  const n = Number(String(v ?? "").replace(/[^\d]/g, ""));
  return n > 0 ? n : null;
}

// Konfirmasi: hanya dari status Menunggu; keputusan pertama yang tersimpan menang (BO-03).
export async function confirmOrder(_: BoState, fd: FormData): Promise<BoState> {
  const admin = await requireAdmin();
  const orderId = String(fd.get("order_id"));
  const proofAmount = parseAmount(fd.get("proof_amount"));
  const { data, error } = await db().rpc("bo_decide", { p_order: orderId, p_admin: admin.user_id, p_action: "confirm", p_reason: null, p_proof_amount: proofAmount });
  if (error || !data || !(data as { id?: string }).id) return { error: "Pesanan ini sudah diputuskan admin lain. Muat ulang untuk melihat status terbaru." };
  const o = await orderOwner(orderId);
  await track(o.user_id, "payment_confirmed", { metode: o.method });
  const mail = confirmedEmail(o.nickname, o.order_no);
  await sendEmail(o.email, mail.subject, mail.text);
  after(() => generatePaid(o.user_id)); // jaga-jaga kalau Bagian 2–6 belum siap
  return { ok: true };
}

export async function rejectOrder(_: BoState, fd: FormData): Promise<BoState> {
  const admin = await requireAdmin();
  const orderId = String(fd.get("order_id"));
  const reason = String(fd.get("reason") ?? "");
  if (!(REJECT_REASONS as readonly string[]).includes(reason)) return { error: "Pilih satu alasan dulu." };
  const proofAmount = parseAmount(fd.get("proof_amount"));
  const { data, error } = await db().rpc("bo_decide", { p_order: orderId, p_admin: admin.user_id, p_action: "reject", p_reason: reason, p_proof_amount: proofAmount });
  if (error || !data || !(data as { id?: string }).id) return { error: "Pesanan ini sudah diputuskan admin lain. Muat ulang untuk melihat status terbaru." };
  const o = await orderOwner(orderId);
  await track(o.user_id, "payment_rejected", { metode: o.method, alasan: reason });
  const mail = rejectedEmail(o.nickname, o.order_no, reason);
  await sendEmail(o.email, mail.subject, mail.text);
  return { ok: true };
}

// Batalkan keputusan sendiri, maksimal 15 menit (BO-05). Keputusan awal tetap di audit log.
export async function undoDecision(_: BoState, fd: FormData): Promise<BoState> {
  const admin = await requireAdmin();
  const orderId = String(fd.get("order_id"));
  const { data, error } = await db().rpc("bo_decide", { p_order: orderId, p_admin: admin.user_id, p_action: "undo", p_reason: null, p_proof_amount: null });
  if (error || !data || !(data as { id?: string }).id) return { error: "Keputusan ini sudah tidak bisa dibatalkan (lewat 15 menit atau bukan keputusanmu)." };
  const o = await orderOwner(orderId);
  await track(o.user_id, "payment_decision_undo", { admin: admin.user_id });
  return { ok: true };
}

// Link sementara 10 menit; setiap pembukaan bukti tercatat di audit log.
export async function proofUrl(orderId: string, proofId: string): Promise<{ url?: string; error?: string }> {
  const admin = await requireAdmin();
  const { data } = await db().from("payment_proofs").select("file_path,order_id").eq("id", proofId).single();
  const p = data as { file_path: string; order_id: string } | null;
  if (!p || p.order_id !== orderId) return { error: "Tidak ditemukan" };
  const { data: signed } = await db().storage.from("proofs").createSignedUrl(p.file_path, 600);
  await audit(admin.user_id, "proof_view", orderId, { proof_id: proofId });
  return { url: signed?.signedUrl };
}

export async function logOpen(orderId: string) {
  const admin = await requireAdmin();
  await track(null, "bo_payment_open", { admin: admin.user_id, order_id: orderId });
}
