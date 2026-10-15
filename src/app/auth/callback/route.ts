import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseSession } from "@/lib/supabase/server";
import { ensureProfile, loadJourney, nextPath } from "@/lib/session";
import { track } from "@/lib/analytics";

// Link verifikasi email (AC-01.2, AC-01.4). Mendukung PKCE (?code) dan token_hash.
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const sb = await supabaseSession();
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = (url.searchParams.get("type") ?? "email") as EmailOtpType;
  let ok = false;
  if (code) ok = !(await sb.auth.exchangeCodeForSession(code)).error;
  else if (tokenHash) ok = !(await sb.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  if (!ok) return NextResponse.redirect(new URL("/daftar/gagal", url));

  const { data } = await sb.auth.getUser();
  if (!data.user) return NextResponse.redirect(new URL("/daftar/gagal", url));
  const profile = await ensureProfile(data.user);
  if (!profile) return NextResponse.redirect(new URL("/daftar?lengkapi=1", url));
  await track(data.user.id, "email_verified", { level: profile.age_level });
  return NextResponse.redirect(new URL(nextPath(await loadJourney(profile)), url));
}
