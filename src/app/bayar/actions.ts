"use server";

import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { db } from "@/lib/supabase/server";
import { loadJourney, requireProfile } from "@/lib/session";
import { MAX_PROOF_BYTES, PAYMENT, PRICE_IDR, PROOF_MIME, type PaymentMethod } from "@/lib/config";
import { track } from "@/lib/analytics";

async function ctx() {
  const profile = await requireProfile();
  const j = await loadJourney(profile);
  return { profile, j, props: { level: j.cvLevel, cv_source: j.cv?.source === "built" ? "built" : "uploaded", target_terisi: !!j.target?.filled } };
}

// Pesanan dibuat dengan status Menunggu bayar dan batas waktu bayar (§6.8 langkah 1).
export async function chooseMethod(fd: FormData) {
  const { profile, j, props } = await ctx();
  if (j.paid) redirect("/peta");
  const method = String(fd.get("method")) as PaymentMethod;
  if (!["qris", "transfer"].includes(method)) redirect("/bayar/metode");
  if (j.order && ["pending_review"].includes(j.order.status)) redirect("/bayar/status");
  if (j.order) {
    await db().from("orders").update({ method, updated_at: new Date().toISOString() } as never).eq("id", j.order.id);
  } else {
    const { error } = await db()
      .from("orders")
      .insert({
        user_id: profile.id,
        amount: PRICE_IDR,
        method,
        expires_at: new Date(Date.now() + PAYMENT.payWindowHours * 3600_000).toISOString(),
      } as never);
    if (error) console.error("order insert", error);
    await track(profile.id, "payment_start", props);
  }
  await track(profile.id, "payment_method_pick", { ...props, metode: method });
  redirect("/bayar/kirim");
}

export type ProofState = { error?: string } | undefined;

// Unggah bukti (JPG, PNG, PDF, maks. 5 MB). Status jadi Menunggu dicek (AC-A2.8, AC-A2.9).
export async function submitProof(_: ProofState, fd: FormData): Promise<ProofState> {
  const { profile, j, props } = await ctx();
  const order = j.order;
  if (!order || !["awaiting_payment", "rejected"].includes(order.status)) redirect("/bayar/status");
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Pilih file bukti bayar dulu ya." };
  if (file.size > MAX_PROOF_BYTES) return { error: "Ukurannya lebih dari 5 MB." };
  if (!PROOF_MIME.includes(file.type)) return { error: "Formatnya JPG, PNG, atau PDF ya." };
  const buf = Buffer.from(await file.arrayBuffer());
  const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
  const path = `${order.id}/${Date.now()}.${file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg"}`;
  const up = await db().storage.from("proofs").upload(path, buf, { contentType: file.type });
  if (up.error) return { error: "Unggahan gagal. Coba lagi sebentar lagi." };
  await db().from("payment_proofs").insert({ order_id: order.id, file_path: path, file_name: file.name, mime: file.type, size: file.size, sha256 } as never);
  const wasRejected = order.status === "rejected";
  const { data: updated } = await db()
    .from("orders")
    .update({ status: "pending_review", submitted_at: new Date().toISOString(), reject_reason: null, proof_amount: null, updated_at: new Date().toISOString() } as never)
    .eq("id", order.id)
    .in("status", ["awaiting_payment", "rejected"])
    .select("id");
  if (!updated?.length) return { error: "Status pesananmu sudah berubah. Muat ulang halaman ini." };
  await track(profile.id, "payment_proof_upload", props);
  await track(profile.id, wasRejected ? "payment_resubmit" : "payment_proof_submit", { ...props, metode: order.method });
  redirect("/bayar/status");
}
