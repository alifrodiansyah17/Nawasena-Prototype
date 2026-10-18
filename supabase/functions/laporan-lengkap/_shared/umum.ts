// Fungsi bersama untuk semua edge function Nawasena.
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-nawasena-internal",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

export function env(nama: string, wajib = true): string {
  const v = Deno.env.get(nama) ?? "";
  if (wajib && !v) throw new Error(`Secret ${nama} belum diisi`);
  return v;
}

function dariKamus(nama: string): string {
  try {
    const d = JSON.parse(Deno.env.get(nama) || "{}");
    return d.default || Object.values(d)[0] || "";
  } catch { return ""; }
}
/** Kunci rahasia (service role / secret key). Mendukung kunci lama dan kunci baru Supabase. */
export function kunciRahasia(): string {
  const k = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || dariKamus("SUPABASE_SECRET_KEYS");
  if (!k) throw new Error("Kunci service role tidak tersedia");
  return k;
}
/** Kunci publik (anon / publishable key). */
export function kunciPublik(): string {
  const k = Deno.env.get("SUPABASE_ANON_KEY") || dariKamus("SUPABASE_PUBLISHABLE_KEYS");
  if (!k) throw new Error("Kunci anon tidak tersedia");
  return k;
}

/** Klien dengan service role: melewati RLS. Hanya dipakai di server. */
export function adminDb(): SupabaseClient {
  return createClient(env("SUPABASE_URL"), kunciRahasia(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Ambil pengguna dari header Authorization (JWT dari aplikasi). */
export async function penggunaDari(req: Request): Promise<{ id: string; email?: string } | null> {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await adminDb().auth.getUser(token);
  if (error || !data?.user) return null;
  return { id: data.user.id, email: data.user.email ?? undefined };
}

/** Panggilan antar-fungsi memakai kunci internal supaya tidak bisa dipanggil dari luar. */
/** Kunci rahasia antar-fungsi. Pakai NAWASENA_INTERNAL_KEY kalau diisi; kalau tidak, diturunkan dari
 *  kunci rahasia Supabase (tersedia otomatis di fungsi, tidak pernah dikirim ke browser). */
let _kunciInternal: string | null = null;
export async function kunciInternal(): Promise<string> {
  if (_kunciInternal) return _kunciInternal;
  const atur = Deno.env.get("NAWASENA_INTERNAL_KEY");
  if (atur) return (_kunciInternal = atur);
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("nawasena-internal:" + kunciRahasia()));
  return (_kunciInternal = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join(""));
}

export async function panggilanInternal(req: Request): Promise<boolean> {
  const k = req.headers.get("x-nawasena-internal") ?? "";
  return !!k && k === await kunciInternal();
}

export async function picuFungsi(nama: string, body: unknown): Promise<Response> {
  return fetch(`${env("SUPABASE_URL")}/functions/v1/${nama}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": kunciPublik(),
      "x-nawasena-internal": await kunciInternal(),
    },
    body: JSON.stringify(body),
  });
}

/** Jalankan pekerjaan panjang setelah respons dikirim (batas wall clock fungsi tetap berlaku). */
export function latar(p: Promise<unknown>) {
  // deno-lint-ignore no-explicit-any
  const er = (globalThis as any).EdgeRuntime;
  if (er?.waitUntil) er.waitUntil(p);
  else p.catch((e) => console.error(e));
}

/** Usia dari tahun lahir saja (lahir 1999 bulan apa pun = 27 tahun di 2026). Tahun dihitung di WIB. */
export function umur(tglLahir: string, hari = new Date()): number {
  const tahunIni = new Date(hari.getTime() + 7 * 3600 * 1000).getUTCFullYear();
  return tahunIni - parseInt(String(tglLahir).slice(0, 4), 10);
}

/** Level dari usia: Entry ≤ 25, Mid 26–30, Senior > 30 (tidak pernah ditampilkan ke pengguna). */
export function levelUsia(tglLahir: string): "entry" | "mid" | "senior" {
  const u = umur(tglLahir);
  return u <= 25 ? "entry" : u <= 30 ? "mid" : "senior";
}

export function tanggalIndo(d = new Date()): string {
  const B = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const w = new Date(d.getTime() + 7 * 3600 * 1000); // WIB
  return `${w.getUTCDate()} ${B[w.getUTCMonth()]} ${w.getUTCFullYear()}`;
}

/** Amankan teks sebelum masuk ke HTML email. */
export function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
