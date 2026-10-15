"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ensureProfile, loadJourney, nextPath } from "@/lib/session";
import { detectContact, normalizePhone } from "@/lib/format";
import { ageOn, levelFromAge } from "@/lib/level";
import { db, supabaseSession } from "@/lib/supabase/server";
import { track } from "@/lib/analytics";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export type FormState = { error?: string; ok?: boolean } | undefined;

// Buat akun: hanya 4 data (AC-01.1). Tanpa password; Supabase mengirim tautan verifikasi.
export async function signup(_: FormState, fd: FormData): Promise<FormState> {
  const nickname = String(fd.get("nickname") ?? "").trim();
  const birth = String(fd.get("birth_date") ?? "").trim();
  const wa = String(fd.get("whatsapp") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!nickname || !birth || !wa || !email) return { error: "Keempat isian perlu diisi dulu ya." };
  if (ageOn(birth) === null) return { error: "Tanggal lahirnya sepertinya belum pas. Coba cek lagi." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Alamat emailnya belum pas." };
  if (!/^(\+?62|0)8\d{7,12}$/.test(wa.replace(/[^\d+]/g, ""))) return { error: "Nomor WhatsApp-nya belum pas. Contoh: 0812 3456 7890." };

  const sb = await supabaseSession();
  // Sudah login (mis. lewat WhatsApp) tapi profil belum ada: lengkapi langsung.
  const { data: me } = await sb.auth.getUser();
  if (me.user) {
    await db().from("profiles").upsert({
      id: me.user.id, nickname, birth_date: birth, whatsapp: normalizePhone(wa), email, age_level: levelFromAge(birth),
    } as never);
    await track(me.user.id, "signup_submit", {});
    await track(me.user.id, "email_verified", {});
    const profile = await ensureProfile(me.user);
    redirect(nextPath(await loadJourney(profile!)));
  }
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${APP_URL}/auth/callback`,
      data: { nickname, birth_date: birth, whatsapp: normalizePhone(wa), email },
    },
  });
  if (error) return { error: "Emailnya belum bisa dikirim. Coba lagi sebentar lagi." };
  (await cookies()).set("nws_email", email, { httpOnly: true, sameSite: "lax", maxAge: 86400, path: "/" });
  await track(null, "signup_submit", {});
  redirect("/daftar/cek-email");
}

export async function resendVerification(): Promise<FormState> {
  const email = (await cookies()).get("nws_email")?.value;
  if (!email) return { error: "Alamat emailnya tidak ketemu. Daftar ulang ya." };
  const sb = await supabaseSession();
  const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: `${APP_URL}/auth/callback` } });
  if (error) return { error: "Belum bisa mengirim ulang. Tunggu sebentar, lalu coba lagi." };
  return { ok: true };
}

// Login: satu kolom email atau nomor HP, OTP 6 digit (AC-02.2, AC-02.2b).
export async function requestLoginCode(_: FormState, fd: FormData): Promise<FormState> {
  const c = detectContact(String(fd.get("contact") ?? ""));
  if (!c) return { error: "Tulis email atau nomor HP yang kamu pakai waktu daftar." };
  const sb = await supabaseSession();
  const { error } =
    c.kind === "email"
      ? await sb.auth.signInWithOtp({ email: c.value, options: { shouldCreateUser: false } })
      : await sb.auth.signInWithOtp({ phone: c.value, options: { shouldCreateUser: false, channel: "whatsapp" } });
  if (error) return { error: c.kind === "email" ? "Email ini belum terdaftar, atau kodenya belum bisa dikirim." : "Nomor ini belum terdaftar, atau kodenya belum bisa dikirim." };
  (await cookies()).set("nws_login", JSON.stringify(c), { httpOnly: true, sameSite: "lax", maxAge: 900, path: "/" });
  redirect("/masuk/kode");
}

export async function resendLoginCode(): Promise<FormState> {
  const raw = (await cookies()).get("nws_login")?.value;
  if (!raw) return { error: "Mulai lagi dari layar login ya." };
  const c = JSON.parse(raw) as { kind: "email" | "phone"; value: string };
  const sb = await supabaseSession();
  const { error } =
    c.kind === "email"
      ? await sb.auth.signInWithOtp({ email: c.value, options: { shouldCreateUser: false } })
      : await sb.auth.signInWithOtp({ phone: c.value, options: { shouldCreateUser: false, channel: "whatsapp" } });
  if (error) return { error: "Kodenya belum bisa dikirim ulang. Tunggu sebentar, lalu coba lagi." };
  return { ok: true };
}

export async function verifyLoginCode(_: FormState, fd: FormData): Promise<FormState> {
  const raw = (await cookies()).get("nws_login")?.value;
  if (!raw) return { error: "Mulai lagi dari layar login ya." };
  const c = JSON.parse(raw) as { kind: "email" | "phone"; value: string };
  const token = String(fd.get("token") ?? "").replace(/\D/g, "");
  if (token.length !== 6) return { error: "Kodenya 6 angka." };
  const sb = await supabaseSession();
  const { data, error } =
    c.kind === "email"
      ? await sb.auth.verifyOtp({ email: c.value, token, type: "email" })
      : await sb.auth.verifyOtp({ phone: c.value, token, type: "sms" });
  if (error || !data.user) return { error: "Kodenya belum cocok atau sudah kedaluwarsa." };
  const profile = await ensureProfile(data.user);
  if (!profile) redirect("/daftar?lengkapi=1");
  redirect(nextPath(await loadJourney(profile)));
}

export async function signOut() {
  const sb = await supabaseSession();
  await sb.auth.signOut();
  redirect("/");
}
